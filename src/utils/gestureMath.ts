// Pure helpers over MediaPipe hand landmarks (21 points, normalized 0..1 image coords).
// Landmark ids: 0 wrist, 4 thumb tip, 8 index tip, 9 middle MCP, 12/16/20 other tips.

export type Pt = { x: number; y: number; z?: number };

export const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Hand-size-normalized so it works near or far from the camera. */
export function isPinching(lm: Pt[], threshold = 0.35) {
  const size = dist(lm[0], lm[9]) || 1;
  return dist(lm[4], lm[8]) / size < threshold;
}

/** All four fingertips farther from the wrist than their middle joints. */
export function isOpenHand(lm: Pt[]) {
  return [8, 12, 16, 20].every((tip) => dist(lm[tip], lm[0]) > dist(lm[tip - 2], lm[0]));
}

export const palm = (lm: Pt[]) => lm[9];

// ---- Two-hand "steering wheel" ----
export type TwoHandPose = { angle: number; midY: number; span: number };

/** Left-most hand (in the image) first, so the pair has a stable orientation frame to frame. */
export function twoHandPose(a: Pt, b: Pt): TwoHandPose {
  const [l, r] = a.x <= b.x ? [a, b] : [b, a];
  return { angle: Math.atan2(r.y - l.y, r.x - l.x), midY: (l.y + r.y) / 2, span: dist(l, r) };
}

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const dead = (v: number, d: number) => (Math.abs(v) < d ? 0 : v - Math.sign(v) * d);

export interface WheelGains {
  yaw: number; // radians of view rotation per radian of wheel turn
  pitch: number; // radians per full-frame vertical movement
  deadAngle: number;
  deadY: number;
  deadZoom: number;
}
export const WHEEL: WheelGains = { yaw: 1.5, pitch: 4, deadAngle: 0.012, deadY: 0.004, deadZoom: 0.01 };

/**
 * Turning the wheel (tilting the line between your hands) yaws the view, raising/lowering both
 * hands pitches it, and moving the hands apart / together zooms. Returns command deltas.
 */
export function wheelDelta(prev: TwoHandPose, cur: TwoHandPose, g: WheelGains = WHEEL) {
  const turn = dead(wrap(cur.angle - prev.angle), g.deadAngle);
  const lift = dead(cur.midY - prev.midY, g.deadY);
  const ratio = prev.span / (cur.span || 1);
  const zoom = Math.abs(ratio - 1) < g.deadZoom ? 1 : clamp(ratio, 0.92, 1.08);
  return { dx: turn * g.yaw, dy: lift * g.pitch, zoom };
}

/** Exponential smoothing for landmark jitter. alpha=1 means no smoothing. */
export function smoothPt(prev: Pt | null, next: Pt, alpha = 0.5): Pt {
  return prev ? { x: prev.x + (next.x - prev.x) * alpha, y: prev.y + (next.y - prev.y) * alpha } : next;
}
