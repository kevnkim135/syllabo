import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { commands } from '../commands';
import { isOpenHand, isPinching, palm, smoothPt, twoHandPose, wheelDelta, type Pt, type TwoHandPose } from '../../utils/gestureMath';

// Keep the WASM version in step with @mediapipe/tasks-vision in package.json.
const WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm';
const MODEL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

const ROTATE_GAIN = 6; // radians per full-frame hand movement
const SWIPE_DIST = 0.3; // fraction of frame width
const SWIPE_MS = 400;

export type GestureLabel = 'none' | 'rotate' | 'wheel' | 'open' | 'swipe';

/**
 * Gesture map:
 *   two-hand pinch "steering wheel": tilt the line between hands -> turn the view left/right,
 *                                    raise/lower both hands -> tilt up/down,
 *                                    spread/close hands -> zoom
 *   one-hand pinch + drag      -> rotate (fallback)
 *   open-hand fast swipe       -> next / previous tab
 */
export function createGestureInterpreter(emit = commands.emit) {
  let last: Pt | null = null;
  let wheel: TwoHandPose | null = null;
  let smooth: [Pt, Pt] | null = null;
  let swipe: { x: number; t: number } | null = null;
  let cooldownUntil = 0;

  return function step(hands: Pt[][], now: number): GestureLabel {
    if (hands.length === 2 && hands.every((h) => isPinching(h))) {
      const raw = [palm(hands[0]), palm(hands[1])] as const;
      // Hand order from the tracker can flip between frames; match each hand to its nearest previous point.
      const flip = smooth && Math.hypot(raw[0].x - smooth[1].x, raw[0].y - smooth[1].y) < Math.hypot(raw[0].x - smooth[0].x, raw[0].y - smooth[0].y);
      const ordered = flip ? [raw[1], raw[0]] : [raw[0], raw[1]];
      smooth = [smoothPt(smooth?.[0] ?? null, ordered[0]), smoothPt(smooth?.[1] ?? null, ordered[1])];
      const pose = twoHandPose(smooth[0], smooth[1]);
      if (wheel) {
        const d = wheelDelta(wheel, pose);
        if (d.dx || d.dy) emit({ type: 'rotate', dx: d.dx, dy: d.dy });
        if (d.zoom !== 1) emit({ type: 'zoom', factor: d.zoom });
      }
      wheel = pose;
      last = null;
      return 'wheel';
    }
    wheel = smooth = null;

    const h = hands[0];
    if (!h) {
      last = swipe = null;
      return 'none';
    }

    if (isPinching(h)) {
      const p = palm(h);
      // Camera image is not mirrored, so negate x to match the user's motion.
      if (last) emit({ type: 'rotate', dx: -(p.x - last.x) * ROTATE_GAIN, dy: (p.y - last.y) * ROTATE_GAIN });
      last = p;
      swipe = null;
      return 'rotate';
    }
    last = null;

    if (isOpenHand(h) && now > cooldownUntil) {
      const p = palm(h);
      if (!swipe || now - swipe.t > SWIPE_MS) swipe = { x: p.x, t: now };
      else if (Math.abs(p.x - swipe.x) > SWIPE_DIST) {
        emit({ type: p.x < swipe.x ? 'next' : 'prev' });
        swipe = null;
        cooldownUntil = now + 800;
        return 'swipe';
      }
      return 'open';
    }
    return 'none';
  };
}

/** Starts the webcam + hand tracking. Returns a stop function. */
export async function startGestures(video: HTMLVideoElement, onGesture?: (g: GestureLabel) => void) {
  const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
  video.srcObject = stream;
  await video.play();

  const fileset = await FilesetResolver.forVisionTasks(WASM);
  const landmarker = await HandLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: MODEL, delegate: 'GPU' },
    runningMode: 'VIDEO',
    numHands: 2,
  });

  const step = createGestureInterpreter();
  let raf = 0;
  let lastVideoTime = -1;
  let lastLabel: GestureLabel = 'none';

  const loop = () => {
    if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
      lastVideoTime = video.currentTime;
      const now = performance.now();
      const label = step(landmarker.detectForVideo(video, now).landmarks, now);
      if (label !== lastLabel) onGesture?.((lastLabel = label));
    }
    raf = requestAnimationFrame(loop);
  };
  loop();

  return () => {
    cancelAnimationFrame(raf);
    stream.getTracks().forEach((t) => t.stop());
    landmarker.close();
  };
}
