// The gesture interpreter: a pure state machine over per-frame hand landmarks. No DOM and no MediaPipe
// import, so it runs under node:test with synthetic hands (tests/gestureEngine.test.ts).
// Coordinate conventions are documented at the top of src/utils/gestureMath.ts.
//
// GESTURE MAP (each frame: classify every hand's pose -> pick ONE candidate mode -> hysteresis -> act)
// Zoom uses only the thumb, index and middle finger, so it can never be confused with an open hand:
//   one hand, thumb + index + middle tips together, HELD -> zoom in, continuously   (mode "gather")
//   one hand, thumb + index + middle spread, ring and pinky folded, HELD -> zoom out (mode "spread")
//   one open hand, hard fast swipe left / right       -> next / previous model       (mode "hand")
//   one hand pointing, fingertip draws a circle       -> newExample                  (mode "point")
//   one hand pinches (clutch) + the other hand's fingertip draws circles -> rotateAxis (mode "rotate")
//   both hands closed fists, held                     -> home                        (mode "fists")
//   one hand pinching (thumb + index), quick          -> tap: select what the pointer is on   (mode "grab")
//   one hand pinching, held                           -> grab: drag the selection, in depth too (mode "grab")
//   both hands pinching, spread / close               -> scale the selection         (mode "scale")
// Whenever one hand points or pinches, its fingertip is also emitted as a screen pointer.
// Zoom is a HOLD, not a motion: holding the pose zooms at a rate that builds up, and relaxing the hand
// stops it, so there is no return stroke that undoes the zoom. Moving the hand pauses zoom.
// Rotate: the model spins about the axis normal to the plane the fingertip circles in, snapped to the
// nearest of the three view axes (circle at one height -> vertical axis; circle toward and away from the
// camera -> horizontal axis; circle parallel to the screen -> axis out of the screen). Circling
// counter-clockwise as seen along that axis is a positive turn. Either hand can be the clutch.
// A mode starts only after its pose has been seen for `enterFrames` frames in a row, ends after
// `exitFrames` frames without it, and always passes through "none" before another mode can start.
// Commands are emitted only on frames where the live pose still matches the active mode.
import { commands, type Command, type Hand } from '../commands';
import {
  assignSides,
  classifyHand,
  clamp,
  detectSwipe,
  dist,
  isotropic,
  landmarkFilter,
  POSE,
  angleAbout,
  circulation,
  cross,
  dominantAxis,
  dot,
  fitCircle,
  norm,
  normalize,
  tipPosition,
  handDepth,
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

  // Zoom (hold an open hand to zoom in, hold a pinch to zoom out)
  zoomHoldMs: 400, // the pose must be held this long, roughly still, before zooming starts
  zoomRateStart: 0.35, // zoom speed when it starts (natural-log units per second; 0.35 = about 1.4x per second)
  zoomRateMax: 1.3, // top speed after ramping up (about 3.7x per second)
  zoomRampMs: 900, // time from start speed to top speed
  zoomMaxSpeed: 0.45, // frame heights/s; a hand moving faster than this is travelling, not zooming
  zoomMaxFrameMs: 100, // longest frame gap used for one zoom step (a stalled camera must not jump)

  // Twirl (one hand pointing, fingertip traces a circle)
  twirlWindowMs: 1800, // the circle must be completed within this
  twirlMinWinding: 4.7, // radians, about 270 degrees: most of a circle is enough
  twirlMinRadius: 0.1, // circle radius in hand sizes (wrist to middle knuckle, as seen in the image)
  twirlMinRoundness: 0.45, // 1 = perfect circle; hand-drawn circles are wobbly
  twirlMinFill: 0.35, // swept area / circle area; still rejects lines and wags
  twirlCooldownMs: 1200,

  // Rotate (one hand pinches as a clutch, the other hand's fingertip draws circles)
  rotateEnterStraight: 0.72, // steering index finger straightness needed to START rotating (1 = straight)
  focal: 0.9, // camera focal length in frame heights (about a 58 degree vertical field of view); scales depth
  rotateWindowMs: 650, // the circle's plane is judged from this much fingertip path
  rotateMinRadius: 0.015, // metres; smaller circles are jitter
  rotateMinCoherence: 0.45, // 0..1, how much of the motion must be circling (rejects back-and-forth)
  rotateSnap: true, // snap the axis to the nearest view axis (x, y or z); false = follow the exact plane
  rotateAxisMargin: 1.5, // another axis must be this much stronger to take over mid-gesture
  rotateGain: 1, // model turns per fingertip turn (1 = one circle spins the model once)
  rotateMaxStep: 0.7, // radians per frame; larger jumps are treated as tracking glitches

  // Swipe (one open hand, hard and fast, sideways): left = next model, right = previous model
  swipe: { windowMs: 350, minTravel: 0.3, minSpeed: 1.5, maxSideways: 0.5, minOpen: 0.6, axis: 'x' as const },
  swipeCooldownMs: 900,
  swipeRearmSpeed: 0.5, // frame heights/s; the hand must slow below this before another swipe counts

  // Home (both fists)
  fistHoldMs: 700,

  // Direct manipulation (point, tap, grab)
  tapMs: 320, // a pinch released sooner than this is a tap; held longer it becomes a grab
  tapMaxMove: 0.04, // screen fraction the pinch may drift and still count as a tap
  /** Set by the app while the sandbox is on screen: hold-to-zoom poses and twirl are off, so pointing and
   *  pinching only ever select, carry and rotate objects. */
  directManipulation: false,
  grabDepthGain: 3, // scene units of depth per metre the hand moves toward / away from the camera
  grabDepthEngage: 0.05, // metres the hand must move in depth before depth starts to follow (then it follows)
  grabDepthSmoothing: 0.2, // 0..1 per frame; depth from a single camera is noisy, so it is heavily smoothed
  grabDepthDeadZone: 0.012, // scene units per frame ignored, so depth only moves on purpose
  scaleDeadZone: 0.01,

  flashMs: 700, // how long an event label ("next model", "home", ...) stays on screen
};

/** One detected hand for one frame. `world` (MediaPipe worldLandmarks) is optional but gives better shape features. */
export interface HandInput {
  image: Pt[]; // 21 normalized landmarks of the raw (unmirrored) frame
  world?: Pt[]; // 21 metric landmarks
  label?: string; // MediaPipe handedness category name: "Left" | "Right"
  hint?: { name: string; score: number }; // top MediaPipe gesture category
}

export type Mode = 'none' | 'hand' | 'gather' | 'spread' | 'point' | 'rotate' | 'fists' | 'grab' | 'scale';
export type GestureLabel =
  | 'none' // no hands
  | 'idle' // hands visible, no gesture
  | 'hand' // one open hand: swipe left / right
  | 'gather' // three-finger pinch held: zoom in
  | 'spread' // three fingers spread: zoom out
  | 'zoomIn'
  | 'zoomOut'
  | 'point' // pointing: twirl to get a new example
  | 'newExample'
  | 'clutch' // one hand pinching, the other not pointing yet
  | 'rotate'
  | 'fists' // holding both fists
  | 'home'
  | 'modelNext'
  | 'modelPrev'
  | 'grab' // pinch: tap to select, hold to drag
  | 'dragging'
  | 'scale';

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
  { gesture: 'Thumb, index and middle tips pinched together, held', action: 'Zoom in (keeps going while you hold)' },
  { gesture: 'Thumb, index and middle spread apart (ring and pinky folded), held', action: 'Zoom out (keeps going while you hold)' },
  { gesture: 'One hand: point and twirl the index finger in a circle', action: 'New example' },
  { gesture: 'Pinch with one hand (hold) + draw circles with the other index finger', action: 'Spin the model about the axis of your circle' },
  { gesture: 'One open hand: hard, fast swipe left / right', action: 'Next / previous model in this lesson' },
  { gesture: 'Both fists, held for a moment', action: 'Home' },
  { gesture: 'Sandbox: point at a molecule, quick pinch', action: 'Select it (pinch more to select several)' },
  { gesture: 'Sandbox: pinch and hold, then move', action: 'Drag the selection, toward or away from you too' },
  { gesture: 'Sandbox: pinch with both hands, spread / close', action: 'Scale the selection' },
];

interface SideState {
  imageFilter: ReturnType<typeof landmarkFilter>;
  worldFilter: ReturnType<typeof landmarkFilter>;
  tipFilter: ReturnType<typeof landmarkFilter>; // smooths the 3D fingertip AFTER fitting on raw landmarks
  pinching: boolean;
  gathering: boolean;
}
const newSide = (): SideState => ({
  imageFilter: landmarkFilter(GESTURE.imageFilter),
  worldFilter: landmarkFilter(GESTURE.worldFilter),
  tipFilter: landmarkFilter(GESTURE.worldFilter),
  pinching: false,
  gathering: false,
});

interface Seen extends TrackedHand {
  shape: HandShape;
  form: Pt[]; // isotropic landmarks used for shape and direction (world if available)
  world?: Pt[]; // filtered metric landmarks, when MediaPipe gives them
  palm: { x: number; y: number }; // RAW palm centre in frame heights (unfiltered: swipes must not lag)
  tip3: Vec3; // index fingertip in metres (view space): fitted on raw landmarks, then smoothed
  depth: number; // the hand's distance from the camera in metres (palm only), raw
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
  let holdSince = 0; // when the current zoom hold started (reset by movement)
  let lastFrame = 0;
  let clutchSide: Side | null = null;
  let lastZoom: { t: number; dir: 'zoomIn' | 'zoomOut' } | null = null;
  let palmTrail: SwipeSample[] = [];
  let swipeArmed = true;
  let swipeCooldownUntil = 0;
  let tipTrail: { x: number; y: number; t: number }[] = [];
  let twirlCooldownUntil = 0;
  let rotTrail: { p: Vec3; t: number }[] = [];
  let rotAxis: number | null = null; // snapped axis index while rotating
  let homeFired = false;
  // direct manipulation
  // per hand: pinch-to-tap / pinch-and-hold-to-drag, and whether its pointer is showing
  type Track = { down: number; start: { x: number; y: number }; last: { x: number; y: number }; z: number; z0: number; depthOn: boolean; dragging: boolean };
  const tracks: Partial<Record<Hand, Track>> = {};
  const pointerShown: Partial<Record<Hand, boolean>> = {};
  let scaleSpan: number | null = null;
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
      const world = h.world ? st.worldFilter(h.world, now) : undefined;
      const form = world ?? isotropic(image, G.aspect);
      const shape = classifyHand(form, st.pinching, h.hint, st.gathering);
      st.pinching = shape.pinching;
      st.gathering = shape.gathering;
      const palmIds = [0, 5, 9, 13, 17];
      const palm = {
        x: (palmIds.reduce((s, k) => s + h.image[k].x, 0) / 5) * G.aspect,
        y: palmIds.reduce((s, k) => s + h.image[k].y, 0) / 5,
      };
      // 3D: fit on the RAW landmarks (per-landmark filtering distorts the palm's apparent size), then smooth the result
      const rawTip = tipPosition(h.image, h.world, G.aspect, G.focal);
      const [ft] = st.tipFilter([{ x: rawTip[0], y: rawTip[1], z: rawTip[2] }], now);
      const tip3: Vec3 = [ft.x, ft.y, ft.z ?? 0];
      const depth = handDepth(h.image, h.world, G.aspect, G.focal);
      return { side, pose: shape.pose, image, shape, form, world, palm, tip3, depth };
    });
    sides = next; // filters of hands that left the frame are dropped, so they restart cleanly
    return seen;
  }

  function candidate(seen: Seen[]): Mode {
    if (seen.length === 1) {
      const pose = seen[0].pose;
      if (pose === 'point') return G.directManipulation ? 'none' : 'point'; // no twirl in the sandbox
      if (pose === 'gather') return G.directManipulation ? 'none' : 'gather'; // no hold-zoom in the sandbox
      if (pose === 'spread') return G.directManipulation ? 'none' : 'spread';
      if (pose === 'open') return 'hand';
      if (pose === 'pinch') return 'grab';
      return 'none';
    }
    if (seen.length === 2) {
      if (seen.every((h) => h.pose === 'fist')) return 'fists';
      if (mode !== 'rotate' && !G.directManipulation && seen.every((h) => h.shape.pinching)) return 'scale';
      const clutch = pickClutch(seen);
      if (!clutch) return 'none';
      const steer = seen.find((h) => h !== clutch)!;
      // Starting needs a clear point; once rotating, the clutch alone keeps it going (no drop-outs when
      // the steering finger bends or turns toward the camera).
      if (mode === 'rotate' && clutch.side === clutchSide) return 'rotate';
      if (steer.pose !== 'fist' && !steer.shape.pinching && steer.shape.straight[0] > G.rotateEnterStraight) return 'rotate';
    }
    return 'none';
  }

  /** The pinching hand of a pair. If both pinch, keep the current clutch, else prefer the user's left. */
  function pickClutch(seen: Seen[]): Seen | undefined {
    const pinching = seen.filter((h) => h.shape.pinching); // a three-finger pinch also grips
    if (pinching.length === 1) return pinching[0];
    if (pinching.length === 2) return pinching.find((h) => h.side === (clutchSide ?? 'left')) ?? pinching[0];
    return undefined;
  }

  /** Where the hand points on screen: the index tip, or between thumb and index when pinching. Mirrored like the preview. */
  const screenPoint = (h: Seen) => {
    const p = h.shape.pinching ? { x: (h.image[4].x + h.image[8].x) / 2, y: (h.image[4].y + h.image[8].y) / 2 } : h.image[8];
    return { x: 1 - p.x, y: p.y };
  };

  function endMode(_prev: Mode, _now: number) {
    scaleSpan = null;
  }

  /**
   * Each hand on its own: a quick two-finger pinch is a tap, a held one drags (both hands can drag at once).
   * The three-finger zoom pinch never counts. Depth (toward / away from the camera) is smoothed hard.
   */
  function trackHands(seen: Seen[], now: number) {
    const present = new Set<Hand>();
    for (const h of seen) {
      const side = h.side as Hand;
      present.add(side);
      const pinch = mode !== 'rotate' && (h.pose === 'pinch' || (mode === 'scale' && h.shape.pinching && h.pose !== 'gather'));
      const sp = screenPoint(h);
      const z = h.depth * G.grabDepthGain; // the palm, so curling into a pinch is not depth (smoothed below)
      const t = tracks[side];
      if (mode === 'rotate' && t) {
        // this pinch turned out to be the rotate clutch: it was never a tap or a drag
        if (t.dragging) emit({ type: 'grab', hand: side, phase: 'end', dx: 0, dy: 0, dz: 0 });
        delete tracks[side];
      } else if (pinch && !t) {
        tracks[side] = { down: now, start: sp, last: sp, z, z0: z, depthOn: false, dragging: false };
      } else if (pinch && t) {
        if (!t.dragging && now - t.down >= G.tapMs) {
          t.dragging = true;
          emit({ type: 'grab', hand: side, phase: 'start', dx: 0, dy: 0, dz: 0 });
        }
        const zs = t.z + (z - t.z) * G.grabDepthSmoothing;
        if (t.dragging) {
          const dx = sp.x - t.last.x;
          const dy = sp.y - t.last.y;
          // depth only follows after a deliberate push or pull, so pinching itself never moves things in depth
          if (!t.depthOn && Math.abs(zs - t.z0) > G.grabDepthEngage * G.grabDepthGain) t.depthOn = true;
          let dz = t.depthOn ? zs - t.z : 0;
          if (Math.abs(dz) < G.grabDepthDeadZone) dz = 0;
          if (Math.abs(dx) + Math.abs(dy) > 0.0015 || dz) emit({ type: 'grab', hand: side, phase: 'move', dx, dy, dz });
        }
        t.last = sp;
        t.z = zs;
      } else if (!pinch && t) {
        if (t.dragging) emit({ type: 'grab', hand: side, phase: 'end', dx: 0, dy: 0, dz: 0 });
        else if (now - t.down < G.tapMs + 150 && Math.hypot(t.last.x - t.start.x, t.last.y - t.start.y) < G.tapMaxMove) fire({ type: 'tap', hand: side }, 'grab', now);
        delete tracks[side];
      }
      // pointer: this hand pointing or two-finger pinching
      const pointing = h.pose === 'point' || h.pose === 'pinch';
      if (pointing) {
        emit({ type: 'pointer', hand: side, x: sp.x, y: sp.y, visible: true });
        pointerShown[side] = true;
      } else if (pointerShown[side]) {
        emit({ type: 'pointer', hand: side, x: 0, y: 0, visible: false });
        pointerShown[side] = false;
      }
    }
    for (const side of ['left', 'right'] as Hand[]) {
      if (present.has(side)) continue;
      const t = tracks[side];
      if (t?.dragging) emit({ type: 'grab', hand: side, phase: 'end', dx: 0, dy: 0, dz: 0 });
      delete tracks[side];
      if (pointerShown[side]) emit({ type: 'pointer', hand: side, x: 0, y: 0, visible: false }), (pointerShown[side] = false);
    }
  }

  /** Both hands pinching: their spread scales the selection. */
  function actScale(seen: Seen[]) {
    const [a, b] = seen.map(screenPoint);
    const span = Math.hypot(a.x - b.x, a.y - b.y);
    if (scaleSpan && acted) {
      const f = span / scaleSpan;
      if (Math.abs(f - 1) > G.scaleDeadZone) {
        emit({ type: 'scaleSel', factor: clamp(f, 0.9, 1.1) });
        scaleSpan = span;
      }
    } else scaleSpan = span;
  }

  function resetModeState() {
    palmTrail = [];
    tipTrail = [];
    rotTrail = [];
    rotAxis = null;
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
        const step = dir === 'left' ? 1 : -1; // like flicking through cards
        fire({ type: 'modelStep', step }, step > 0 ? 'modelNext' : 'modelPrev', now);
        swipeArmed = false;
        swipeCooldownUntil = now + G.swipeCooldownMs;
        palmTrail = [];
        return;
      }
    }

  }

  /** Three-finger pinch (zoom in) or three-finger spread (zoom out), held. */
  function actZoomPose(h: Seen, now: number, dir: 'in' | 'out') {
    const prev = palmTrail[palmTrail.length - 1];
    palmTrail.push({ x: h.palm.x, y: h.palm.y, t: now, open: false });
    while (palmTrail.length > 4) palmTrail.shift();
    const speed = prev && now > prev.t ? Math.hypot(h.palm.x - prev.x, h.palm.y - prev.y) / ((now - prev.t) / 1000) : 0;
    holdZoom(speed, now, dir);
  }

  /**
   * Continuous zoom while a pose is held still. Starts after `zoomHoldMs`, then ramps from
   * `zoomRateStart` to `zoomRateMax`. Any travel (or the first frame of a mode) restarts the hold.
   */
  function holdZoom(speed: number, now: number, dir: 'in' | 'out') {
    if (!acted || speed > G.zoomMaxSpeed) {
      holdSince = now;
      return;
    }
    const held = now - holdSince - G.zoomHoldMs;
    if (held < 0) return;
    const rate = G.zoomRateStart + (G.zoomRateMax - G.zoomRateStart) * clamp(held / G.zoomRampMs, 0, 1);
    const dt = Math.min(now - lastFrame, G.zoomMaxFrameMs) / 1000;
    if (dt <= 0) return;
    const factor = Math.exp((dir === 'in' ? -1 : 1) * rate * dt); // factor < 1 zooms in
    emit({ type: 'zoom', factor });
    lastZoom = { t: now, dir: dir === 'in' ? 'zoomIn' : 'zoomOut' };
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

  /**
   * The steering fingertip draws circles: spin the model about the normal of the circle's plane (snapped
   * to x, y or z), by the angle the fingertip swept around the circle's centre since the last frame.
   */
  function actRotate(steer: Seen, now: number) {
    const p = steer.tip3;
    if (!acted) rotTrail = [];
    rotTrail.push({ p, t: now });
    while (rotTrail.length && now - rotTrail[0].t > G.rotateWindowMs) rotTrail.shift();
    if (rotTrail.length < 6) return;
    const c = circulation(rotTrail.map((s) => s.p));
    if (c.radius < G.rotateMinRadius || c.coherence < G.rotateMinCoherence || norm(c.area) < 1e-9) return;
    let axis: Vec3;
    if (G.rotateSnap) {
      if (rotAxis === null) {
        // do not start until one axis clearly dominates (the first moments of a circle are ambiguous)
        const m = c.area.map(Math.abs).sort((a, b) => b - a);
        if (m[0] < m[1] * 1.6) return;
      }
      rotAxis = dominantAxis(c.area, rotAxis, G.rotateAxisMargin);
      axis = [0, 0, 0];
      axis[rotAxis] = Math.sign(c.area[rotAxis]) || 1;
    } else axis = normalize(c.area);
    // The circle's true centre in its plane (a partial arc's centroid sits off-centre and undercounts).
    const ref: Vec3 = Math.abs(axis[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
    const e1 = normalize(cross(axis, ref));
    const e2 = cross(axis, e1);
    const flat = rotTrail.map(({ p: q }): [number, number] => {
      const d: Vec3 = [q[0] - c.centre[0], q[1] - c.centre[1], q[2] - c.centre[2]];
      return [dot(d, e1), dot(d, e2)];
    });
    const fit = fitCircle(flat);
    const centre: Vec3 = fit ? [0, 1, 2].map((k) => c.centre[k] + fit[0] * e1[k] + fit[1] * e2[k]) as Vec3 : c.centre;
    const prev = rotTrail[rotTrail.length - 2].p;
    const rel = (v: Vec3): Vec3 => [v[0] - centre[0], v[1] - centre[1], v[2] - centre[2]];
    const angle = angleAbout(axis, rel(prev), rel(p));
    if (angle <= 0 || angle > G.rotateMaxStep) return; // only turns in the circle's own direction; skip glitches
    emit({ type: 'rotateAxis', axis, angle: angle * G.rotateGain, hand: (clutchSide ?? undefined) as Hand | undefined });
  }

  return function step(hands: HandInput[], now: number): GestureFrame {
    const seen = see(hands, now);
    const cand = candidate(seen);

    // ---- hysteresis ----
    // Pointing and pinching are one motion (point at a molecule, pinch it): switch between them at once.
    const linked = (a: Mode, b: Mode) => (a === 'point' && b === 'grab') || (a === 'grab' && b === 'point');
    if (mode !== 'none' && cand !== mode && linked(mode, cand)) {
      endMode(mode, now);
      mode = cand;
      misses = 0;
      modeSince = now;
      resetModeState();
    } else if (mode !== 'none') {
      if (cand === mode) misses = 0;
      else if (++misses >= G.exitFrames) {
        endMode(mode, now);
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
      else if (mode === 'gather') actZoomPose(seen[0], now, 'in');
      else if (mode === 'spread') actZoomPose(seen[0], now, 'out');
      else if (mode === 'scale') actScale(seen);
      else if (mode === 'rotate') {
        const clutch = pickClutch(seen)!;
        clutchSide = clutch.side;
        actRotate(seen.find((h) => h !== clutch)!, now);
      }
      else if (mode === 'fists') {
        hold = clamp((now - modeSince) / G.fistHoldMs, 0, 1);
        if (hold >= 1 && !homeFired) {
          homeFired = true; // fists must be released (mode ends) before home can fire again
          fire({ type: 'home' }, 'home', now);
        }
      }
    }
    acted = live;
    lastFrame = now;
    if (mode !== 'rotate') clutchSide = null;

    // ---- per-hand pointers, taps and drags (independent of the mode) ----
    trackHands(seen, now);

    // ---- label ----
    let label: GestureLabel = seen.length ? 'idle' : 'none';
    if (flash && now < flash.until) label = flash.label;
    else if (mode === 'gather' || mode === 'spread') label = lastZoom && now - lastZoom.t < 250 ? lastZoom.dir : mode;
    else if (mode === 'hand') label = 'hand';
    else if (mode === 'point') label = 'point';
    else if (mode === 'rotate') label = 'rotate';
    else if (mode === 'fists') label = 'fists';
    else if (mode === 'grab') label = Object.values(tracks).some((t) => t?.dragging) ? 'dragging' : 'grab';
    else if (mode === 'scale') label = 'scale';
    else if (seen.length === 2 && seen.some((h) => h.shape.pinching)) label = 'clutch';

    return { label, mode, hands: seen.map(({ side, pose, image }) => ({ side, pose, image })), hold };
  };
}
