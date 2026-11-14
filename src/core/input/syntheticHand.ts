// A small parametric hand that produces MediaPipe-shaped landmarks. Used by the unit tests (there is no
// camera in CI); not imported by the app, so it is tree-shaken out of the bundle.
// Axes follow MediaPipe: x right in the RAW image, y DOWN, z away from the camera. The hand is built
// palm-to-camera with the fingers pointing up (-y), in metres, then projected into normalized image coords.
import type { Pt, Vec3 } from '../../utils/gestureMath';
import type { HandInput } from './gestureEngine';

export interface HandOptions {
  /** 0 = straight, 1 = fully curled. One number for all four fingers, or [index, middle, ring, pinky]. */
  curl?: number | [number, number, number, number];
  /** 0 = fingers side by side, 1 = fanned out. */
  spread?: number;
  /** 0 = thumb out to the side, 1 = thumb folded across the palm. Defaults to the mean finger curl. */
  thumbCurl?: number;
  /** Thumb tip and index tip touch (the index finger bends to meet the thumb). */
  pinch?: boolean;
  /** Thumb, index and middle tips meet (a three-finger pinch). */
  gather?: boolean;
  /** Direction of the index finger in image-oriented axes (x right in the raw image, y down, z away from the camera). */
  indexDir?: Vec3;
  /** Wrist position in normalized image coords. */
  at?: [number, number];
  /** Frame heights per metre (2 means the frame is 0.5 m tall at the hand's distance). */
  scale?: number;
  aspect?: number;
  label?: 'Left' | 'Right';
  /** Turn the whole hand about the wrist (axis in image-oriented axes, angle in radians, right-hand rule). */
  turn?: { axis: Vec3; angle: number };
}

const DEG = Math.PI / 180;
// knuckle x, y (metres from the wrist), fan angle when spread (degrees), bone lengths
const FINGERS: [number, number, number, [number, number, number]][] = [
  [-0.03, -0.09, -12, [0.04, 0.025, 0.02]],
  [-0.01, -0.095, -2, [0.045, 0.03, 0.02]],
  [0.01, -0.09, 8, [0.04, 0.027, 0.02]],
  [0.03, -0.08, 20, [0.03, 0.02, 0.018]],
];

export function makeHand(o: HandOptions = {}): HandInput {
  const curls = typeof o.curl === 'number' || o.curl === undefined ? Array(4).fill(o.curl ?? 0) : [...o.curl];
  if (o.pinch || o.gather) curls[0] = Math.max(curls[0], 0.45);
  if (o.gather) curls[1] = Math.max(curls[1], 0.45);
  const spread = o.spread ?? 1;
  const w: Vec3[] = [[0, 0, 0]];

  // thumb (1-4)
  const tc = o.thumbCurl ?? curls.reduce((a, b) => a + b, 0) / 4;
  const mix = (a: number, b: number) => a + (b - a) * tc;
  const td: Vec3 = [mix(-0.7 - 0.2 * spread, 0.6), mix(-0.7, -0.5), mix(0, -0.6)];
  const tn = Math.hypot(...td);
  let p: Vec3 = [-0.025, -0.025, 0];
  w.push(p);
  for (const len of [0.04, 0.03, 0.025]) {
    p = [p[0] + (td[0] / tn) * len, p[1] + (td[1] / tn) * len, p[2] + (td[2] / tn) * len];
    w.push(p);
  }

  // fingers (5-20): each joint bends a further curl * 85 degrees toward the camera, then back to the palm
  FINGERS.forEach(([kx, ky, fan, bones], f) => {
    const phi = fan * spread * DEG;
    const base: Vec3 = [Math.sin(phi), -Math.cos(phi), 0];
    let q: Vec3 = [kx, ky, 0];
    w.push(q);
    bones.forEach((len, k) => {
      const a = (k + 1) * curls[f] * 85 * DEG;
      let d: Vec3 = [base[0] * Math.cos(a), base[1] * Math.cos(a), -Math.sin(a)];
      if (f === 0 && o.indexDir) {
        const n = Math.hypot(...o.indexDir);
        d = [o.indexDir[0] / n, o.indexDir[1] / n, o.indexDir[2] / n];
      }
      q = [q[0] + d[0] * len, q[1] + d[1] * len, q[2] + d[2] * len];
      w.push(q);
    });
  });

  if (o.pinch || o.gather) {
    // lay the thumb in a straight line from its base to the index fingertip (gather: to the middle of
    // the index and middle tips, and bring those two tips together there)
    let tip = w[8];
    if (o.gather) {
      tip = [(w[8][0] + w[12][0]) / 2, (w[8][1] + w[12][1]) / 2, (w[8][2] + w[12][2]) / 2];
      w[8] = [tip[0] - 0.004, tip[1], tip[2]];
      w[12] = [tip[0] + 0.004, tip[1], tip[2]];
    }
    for (let k = 1; k <= 3; k++) w[1 + k] = [w[1][0] + ((tip[0] - w[1][0]) * k) / 3, w[1][1] + ((tip[1] - w[1][1]) * k) / 3, w[1][2] + ((tip[2] - w[1][2]) * k) / 3];
  }

  if (o.turn && o.turn.angle) {
    // Rodrigues' rotation of every point about the wrist (the origin)
    const n = Math.hypot(...o.turn.axis);
    const [kx, ky, kz] = o.turn.axis.map((v) => v / n);
    const c = Math.cos(o.turn.angle);
    const s = Math.sin(o.turn.angle);
    for (let i = 0; i < w.length; i++) {
      const [x, y, z] = w[i];
      const d = kx * x + ky * y + kz * z;
      w[i] = [
        x * c + (ky * z - kz * y) * s + kx * d * (1 - c),
        y * c + (kz * x - kx * z) * s + ky * d * (1 - c),
        z * c + (kx * y - ky * x) * s + kz * d * (1 - c),
      ];
    }
  }

  const scale = o.scale ?? 2;
  const aspect = o.aspect ?? 4 / 3;
  const [cx, cy] = o.at ?? [0.5, 0.7];
  const world: Pt[] = w.map(([x, y, z]) => ({ x, y, z }));
  const image: Pt[] = w.map(([x, y, z]) => ({ x: cx + (x * scale) / aspect, y: cy + y * scale, z: (z * scale) / aspect }));
  return { image, world, label: o.label };
}
