import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { commands } from '../commands';
import { clamp, dist, isOpenHand, isPinching, palm, type Pt } from '../../utils/gestureMath';

// Keep the WASM version in step with @mediapipe/tasks-vision in package.json.
const WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm';
const MODEL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

const ROTATE_GAIN = 6; // radians per full-frame hand movement
const SWIPE_DIST = 0.3; // fraction of frame width
const SWIPE_MS = 400;

export type GestureLabel = 'none' | 'rotate' | 'zoom' | 'open' | 'swipe';

/**
 * Gesture map:
 *   one-hand pinch + drag      -> rotate
 *   two-hand pinch, spread/close -> zoom in/out
 *   open-hand fast swipe        -> next / previous tab
 */
export function createGestureInterpreter(emit = commands.emit) {
  let last: Pt | null = null;
  let lastSpan: number | null = null;
  let swipe: { x: number; t: number } | null = null;
  let cooldownUntil = 0;

  return function step(hands: Pt[][], now: number): GestureLabel {
    if (hands.length === 2 && hands.every((h) => isPinching(h))) {
      const span = dist(palm(hands[0]), palm(hands[1]));
      if (lastSpan) emit({ type: 'zoom', factor: clamp(lastSpan / span, 0.9, 1.1) });
      lastSpan = span;
      last = null;
      return 'zoom';
    }
    lastSpan = null;

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
