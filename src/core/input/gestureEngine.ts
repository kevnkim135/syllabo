// The gesture interpreter: a pure state machine over per-frame hand landmarks. No DOM and no MediaPipe
// import, so it runs under node:test with synthetic hands (tests/gestureEngine.test.ts).
// Coordinate conventions are documented at the top of src/utils/gestureMath.ts.
//
// GESTURE MAP (each frame: classify every hand's pose -> pick ONE candidate mode -> hysteresis -> act)
//   one hand, fingers all opening / closing together  -> zoom            (mode "hand")
//   one hand, open, hard fast swipe up / down         -> next / prev     (mode "hand")
//   one hand pointing, fingertip draws a circle       -> newExample      (mode "point")
//   LEFT hand pinch (clutch) + RIGHT index finger     -> rotateAxis      (mode "rotate")
//   both hands closed fists, held                     -> home            (mode "fists")
// A mode starts only after its pose has been seen for `enterFrames` frames in a row, ends after
// `exitFrames` frames without it, and always passes through "none" before another mode can start.
// Commands are emitted only on frames where the live pose still matches the active mode.
import { commands, type Command } from '../commands';
import {
  assignSides,
  classifyHand,
  clamp,
  detectSwipe,
  dist,
  indexDirection,
  isotropic,
  landmarkFilter,
  POSE,
  rotationBetween,
  windingStats,
  type HandShape,
  type Pose,
  type Pt,
  type Side,
  type SwipeSample,
  type Vec3,
} from '../../utils/gestureMath';

/** Every tunable number in one place. Distances in "frame heights" are image y units (x is multiplied by the aspect ratio). */
export const GESTURE = {
  aspect: 4 / 3, // camera frame width / height; set from the real video in gestures.ts
  swapHands: false, // flip left/right if the camera already mirrors the frame (toggle in the dock)

  enterFrames: 3, // frames a pose must be held before its mode starts (about 100 ms at 30 fps)
  exitFrames: 4, // frames without the pose before the mode ends

  // One Euro filters
  imageFilter: { minCutoff: 1.2, beta: 8, dCutoff: 1 }, // normalized image coords
  worldFilter: { minCutoff: 1.5, beta: 40, dCutoff: 1 }, // metres

  // Zoom (one hand, all fingers open / close together)
  zoomDeadZone: 0.08, // openness change ignored before zooming starts (openness spans roughly 0.8 to 1.7)
  zoomGain: 1.4, // zoom factor = exp(-gain * openness change); a full open/close is about 3x
  zoomMaxStep: 0.2, // largest openness change used per frame
  zoomMaxSpeed: 0.45, // frame heights/s; a hand moving faster than this is travelling, not zooming

  // Twirl (one hand pointing, fingertip traces a circle)
  twirlWindowMs: 1600, // the circle must be completed within this
  twirlMinWinding: 5.6, // radians, about 320 degrees
  twirlMinRadius: 0.15, // circle radius in hand sizes (wrist to middle knuckle, as seen in the image)
  twirlMinRoundness: 0.6, // 1 = perfect circle
  twirlMinFill: 0.5, // swept area / circle area; rejects lines and wags
  twirlCooldownMs: 1500,

  // Rotate (left pinch clutch + right index finger)
  rotateDeadZone: 0.035, // radians (2 degrees) of finger rotation before a step is emitted
  rotateGain: 2, // model radians per radian of finger rotation
  rotateMaxStep: 0.7, // radians per frame; larger jumps are treated as tracking glitches

  // Swipe (one open hand, hard and fast, vertical)
  swipe: { windowMs: 350, minTravel: 0.3, minSpeed: 1.5, maxSideways: 0.5, minOpen: 0.6 },
  swipeCooldownMs: 900,
  swipeRearmSpeed: 0.5, // frame heights/s; the hand must slow below this before another swipe counts

  // Home (both fists)
  fistHoldMs: 700,

  flashMs: 700, // how long an event label ("next", "home", ...) stays on screen
};

/** One detected hand for one frame. `world` (MediaPipe worldLandmarks) is optional but gives better shape features. */
export interface HandInput {
  image: Pt[]; // 21 normalized landmarks of the raw (unmirrored) frame
  world?: Pt[]; // 21 metric landmarks
  label?: string; // MediaPipe handedness category name: "Left" | "Right"
  hint?: { name: string; score: number }; // top MediaPipe gesture category
}

export type Mode = 'none' | 'hand' | 'point' | 'rotate' | 'fists';
export type GestureLabel =
  | 'none' // no hands
  | 'idle' // hands visible, no gesture
  | 'hand' // one hand ready: zoom or swipe
  | 'zoomIn'
  | 'zoomOut'
  | 'point' // pointing: twirl to get a new example
  | 'newExample'
  | 'clutch' // left hand pinching, right hand not pointing yet
  | 'rotate'
  | 'fists' // holding both fists
  | 'home'
  | 'next'
  | 'prev';

export interface TrackedHand {
  side: Side;
  pose: Pose;
  image: Pt[]; // filtered landmarks, for the overlay
}
export interface GestureFrame {
  label: GestureLabel;
  mode: Mode;
  hands: TrackedHand[];
  hold: number; // 0..1 progress of the two-fist hold
}

/** Text for the on-screen guide; exported so other sections can show the same map. */
export const GESTURE_GUIDE: { gesture: string; action: string }[] = [
  { gesture: 'One hand: spread the fingers / draw them together', action: 'Zoom in / out' },
  { gesture: 'One hand: point and twirl the index finger in a circle', action: 'New example' },
  { gesture: 'Left hand pinch (hold) + turn the right index finger', action: 'Rotate the model about the same axis' },
  { gesture: 'One open hand: hard, fast swipe up / down', action: 'Next / previous section' },
  { gesture: 'Both fists, held for a moment', action: 'Home' },
];

interface SideState {
  imageFilter: ReturnType<typeof landmarkFilter>;
  worldFilter: ReturnType<typeof landmarkFilter>;
  pinching: boolean;
}
const newSide = (): SideState => ({ imageFilter: landmarkFilter(GESTURE.imageFilter), worldFilter: landmarkFilter(GESTURE.worldFilter), pinching: false });

interface Seen extends TrackedHand {
  shape: HandShape;
  form: Pt[]; // isotropic landmarks used for shape and direction (world if available)
  palm: { x: number; y: number }; // RAW palm centre in frame heights (unfiltered: swipes must not lag)
}

export function createGestureInterpreter(emit: (cmd: Command) => void = commands.emit) {
  const G = GESTURE;
  let sides: Partial<Record<Side, SideState>> = {};

  // hysteresis
  let mode: Mode = 'none';
  let misses = 0;
  let pending: Mode = 'none';
  let pendingCount = 0;
  let pendingSince = 0;
  let modeSince = 0;
  let acted = false; // did the active mode act on the previous frame?

  // per-mode state
  let zoomAnchor = 0;
  let lastZoom: { t: number; dir: 'zoomIn' | 'zoomOut' } | null = null;
  let palmTrail: SwipeSample[] = [];
  let swipeArmed = true;
  let swipeCooldownUntil = 0;
  let tipTrail: { x: number; y: number; t: number }[] = [];
  let twirlCooldownUntil = 0;
  let fingerRef: Vec3 | null = null;
  let homeFired = false;
  let flash: { label: GestureLabel; until: number } | null = null;

  const fire = (cmd: Command, label: GestureLabel, now: number) => {
    emit(cmd);
    flash = { label, until: now + G.flashMs };
  };

  function see(hands: HandInput[], now: number): Seen[] {
    const assigned = assignSides(
      hands.map((h) => ({ label: h.label, x: h.image[0].x })),
      G.swapHands,
    );
    const next: Partial<Record<Side, SideState>> = {};
    const seen = hands.slice(0, 2).map((h, i): Seen => {
      const side = assigned[i];
      const st = (next[side] = sides[side] ?? newSide());
      const image = st.imageFilter(h.image, now);
      const form = h.world ? st.worldFilter(h.world, now) : isotropic(image, G.aspect);
      const shape = classifyHand(form, st.pinching, h.hint);
      st.pinching = shape.pinching;
      const palmIds = [0, 5, 9, 13, 17];
      const palm = {
        x: (palmIds.reduce((s, k) => s + h.image[k].x, 0) / 5) * G.aspect,
        y: palmIds.reduce((s, k) => s + h.image[k].y, 0) / 5,
      };
      return { side, pose: shape.pose, image, shape, form, palm };
    });
    sides = next; // filters of hands that left the frame are dropped, so they restart cleanly
    return seen;
  }

  function candidate(seen: Seen[]): Mode {
    if (seen.length === 1) {
      const s = seen[0].shape;
      if (s.pose === 'point') return 'point';
      if (s.uniform) return 'hand';
      return 'none';
    }
    if (seen.length === 2) {
      if (seen.every((h) => h.pose === 'fist')) return 'fists';
      const left = seen.find((h) => h.side === 'left');
      const right = seen.find((h) => h.side === 'right');
      if (left?.pose === 'pinch' && right && indexOut(right)) return 'rotate';
    }
    return 'none';
  }
  /** Right hand "pointing enough" to steer: index finger straight and the hand is not open, a fist or pinching. */
  const indexOut = (h: Seen) => h.shape.straight[0] > POSE.extended && h.pose !== 'open' && h.pose !== 'fist' && h.pose !== 'pinch';

  function resetModeState() {
    palmTrail = [];
    tipTrail = [];
    fingerRef = null;
    homeFired = false;
    acted = false;
  }

  function actHand(h: Seen, now: number) {
    const prev = palmTrail[palmTrail.length - 1];
    const sample: SwipeSample = { x: h.palm.x, y: h.palm.y, t: now, open: h.pose === 'open' };
    palmTrail.push(sample);
    while (palmTrail.length && now - palmTrail[0].t > G.swipe.windowMs + 100) palmTrail.shift();
    const speed = prev && now > prev.t ? Math.hypot(sample.x - prev.x, sample.y - prev.y) / ((now - prev.t) / 1000) : 0;

    // Swipe: one event per swipe; re-arm only after the cooldown AND once the hand has slowed down,
    // so the return stroke never counts.
    if (!swipeArmed && now >= swipeCooldownUntil && speed < G.swipeRearmSpeed) swipeArmed = true;
    if (swipeArmed) {
      const dir = detectSwipe(palmTrail, G.swipe);
      if (dir) {
        fire({ type: dir === 'up' ? 'next' : 'prev' }, dir === 'up' ? 'next' : 'prev', now);
        swipeArmed = false;
        swipeCooldownUntil = now + G.swipeCooldownMs;
        palmTrail = [];
        zoomAnchor = h.shape.openness;
        return;
      }
    }

    // Zoom: follow openness with a dead zone (backlash), only while the hand is roughly still.
    const o = h.shape.openness;
    if (!acted || !swipeArmed || speed > G.zoomMaxSpeed) {
      zoomAnchor = o;
      return;
    }
    const d = o - zoomAnchor;
    if (Math.abs(d) <= G.zoomDeadZone) return;
    const step = clamp(d - Math.sign(d) * G.zoomDeadZone, -G.zoomMaxStep, G.zoomMaxStep);
    zoomAnchor += step;
    emit({ type: 'zoom', factor: Math.exp(-G.zoomGain * step) }); // opening the hand (step > 0) zooms in (factor < 1)
    lastZoom = { t: now, dir: step > 0 ? 'zoomIn' : 'zoomOut' };
  }

  function actPoint(h: Seen, now: number) {
    const tip = h.image[8];
    tipTrail.push({ x: tip.x * G.aspect, y: tip.y, t: now });
    while (tipTrail.length && now - tipTrail[0].t > G.twirlWindowMs) tipTrail.shift();
    if (now < twirlCooldownUntil) {
      tipTrail = []; // motion during the cooldown never counts toward the next twirl
      return;
    }
    if (tipTrail.length < 8) return;
    const size = dist({ x: h.image[0].x * G.aspect, y: h.image[0].y }, { x: h.image[9].x * G.aspect, y: h.image[9].y }) || 1e-6;
    const w = windingStats(tipTrail);
    if (Math.abs(w.winding) >= G.twirlMinWinding && w.radius / size >= G.twirlMinRadius && w.roundness >= G.twirlMinRoundness && w.fill >= G.twirlMinFill) {
      fire({ type: 'newExample' }, 'newExample', now);
      twirlCooldownUntil = now + G.twirlCooldownMs;
      tipTrail = [];
    }
  }

  function actRotate(right: Seen) {
    const dir = indexDirection(right.form);
    if (!fingerRef || !acted) {
      fingerRef = dir;
      return;
    }
    const { axis, angle } = rotationBetween(fingerRef, dir);
    if (angle < G.rotateDeadZone) return;
    fingerRef = dir;
    if (angle > G.rotateMaxStep) return; // glitch: re-anchor without rotating
    emit({ type: 'rotateAxis', axis, angle: angle * G.rotateGain });
  }

  return function step(hands: HandInput[], now: number): GestureFrame {
    const seen = see(hands, now);
    const cand = candidate(seen);

    // ---- hysteresis ----
    if (mode !== 'none') {
      if (cand === mode) misses = 0;
      else if (++misses >= G.exitFrames) {
        mode = 'none';
        pending = 'none';
        pendingCount = 0;
        resetModeState();
      }
    } else {
      if (cand === pending) pendingCount++;
      else {
        pending = cand;
        pendingCount = 1;
        pendingSince = now;
      }
      if (cand !== 'none' && pendingCount >= G.enterFrames) {
        mode = cand;
        misses = 0;
        modeSince = pendingSince;
        resetModeState();
      }
    }

    // ---- act (only when this very frame still shows the active mode's pose) ----
    let hold = 0;
    const live = mode !== 'none' && cand === mode;
    if (live) {
      if (mode === 'hand') actHand(seen[0], now);
      else if (mode === 'point') actPoint(seen[0], now);
      else if (mode === 'rotate') actRotate(seen.find((h) => h.side === 'right')!);
      else if (mode === 'fists') {
        hold = clamp((now - modeSince) / G.fistHoldMs, 0, 1);
        if (hold >= 1 && !homeFired) {
          homeFired = true; // fists must be released (mode ends) before home can fire again
          fire({ type: 'home' }, 'home', now);
        }
      }
    }
    acted = live;

    // ---- label ----
    let label: GestureLabel = seen.length ? 'idle' : 'none';
    if (flash && now < flash.until) label = flash.label;
    else if (mode === 'hand') label = lastZoom && now - lastZoom.t < 250 ? lastZoom.dir : 'hand';
    else if (mode === 'point') label = 'point';
    else if (mode === 'rotate') label = 'rotate';
    else if (mode === 'fists') label = 'fists';
    else if (seen.length === 2 && seen.some((h) => h.side === 'left' && h.pose === 'pinch')) label = 'clutch';

    return { label, mode, hands: seen.map(({ side, pose, image }) => ({ side, pose, image })), hold };
  };
}
