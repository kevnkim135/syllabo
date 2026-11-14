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
