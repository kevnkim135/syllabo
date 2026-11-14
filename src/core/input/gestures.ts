// Thin browser glue: webcam -> MediaPipe GestureRecognizer -> gestureEngine (pure) -> command bus,
// plus the skeleton overlay. All gesture logic and thresholds live in gestureEngine.ts / gestureMath.ts.
import { FilesetResolver, GestureRecognizer } from '@mediapipe/tasks-vision';
import { createGestureInterpreter, GESTURE, type GestureFrame, type HandInput } from './gestureEngine';
import { drawHands, readOverlayColors } from './overlay';

export { GESTURE, GESTURE_GUIDE, type GestureLabel } from './gestureEngine';

// Keep the WASM version in step with the installed @mediapipe/tasks-vision.
const WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm';
const MODEL = 'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task';

/**
 * Starts the webcam and hand tracking. The <video> shows the RAW frame; mirror it (and the canvas) in CSS.
 * `onFrame` is called for every processed video frame. Returns a stop function.
 */
export async function startGestures(video: HTMLVideoElement, canvas: HTMLCanvasElement | null, onFrame?: (frame: GestureFrame) => void) {
  const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: 'user' } });
  let recognizer: GestureRecognizer;
  try {
    video.srcObject = stream;
    await video.play();
    const fileset = await FilesetResolver.forVisionTasks(WASM);
    recognizer = await GestureRecognizer.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL, delegate: 'GPU' },
      runningMode: 'VIDEO',
      numHands: 2,
      minHandDetectionConfidence: 0.6,
      minHandPresenceConfidence: 0.6,
      minTrackingConfidence: 0.6,
    });
  } catch (e) {
    stream.getTracks().forEach((t) => t.stop());
    video.srcObject = null;
    throw e;
  }

  const step = createGestureInterpreter();
  const colors = canvas ? readOverlayColors(canvas) : null;
  let raf = 0;
  let lastVideoTime = -1;

  const loop = () => {
    if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
      lastVideoTime = video.currentTime;
      if (video.videoWidth && video.videoHeight) GESTURE.aspect = video.videoWidth / video.videoHeight;
      const now = performance.now();
      const r = recognizer.recognizeForVideo(video, now);
      const hands: HandInput[] = r.landmarks.map((image, i) => ({
        image,
        world: r.worldLandmarks[i],
        label: r.handedness[i]?.[0]?.categoryName,
        hint: r.gestures[i]?.[0] && { name: r.gestures[i][0].categoryName, score: r.gestures[i][0].score },
      }));
      const frame = step(hands, now);
      if (canvas && colors) {
        if (canvas.width !== video.videoWidth) canvas.width = video.videoWidth;
        if (canvas.height !== video.videoHeight) canvas.height = video.videoHeight;
        drawHands(canvas, frame.hands, GestureRecognizer.HAND_CONNECTIONS, colors);
      }
      onFrame?.(frame);
    }
    raf = requestAnimationFrame(loop);
  };
  loop();

  return () => {
    cancelAnimationFrame(raf);
    stream.getTracks().forEach((t) => t.stop());
    video.srcObject = null;
    canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    recognizer.close();
  };
}
