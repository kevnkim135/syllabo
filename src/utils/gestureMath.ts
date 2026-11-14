// Pure helpers over MediaPipe hand landmarks. No DOM, no MediaPipe import: everything here is unit tested
// with synthetic landmarks (tests/gestureMath.test.ts).
//
// COORDINATE CONVENTIONS (read before changing any sign)
// - "Image" landmarks: 21 points, x and y normalized to 0..1 of the RAW camera frame. x grows to the right
//   of the raw frame, y grows DOWN. z is depth relative to the wrist in roughly the same scale as x;
//   smaller z = closer to the camera.
// - "World" landmarks: same axis directions as the image, but metric (metres), isotropic and centred on
//   the hand. Shape features (curl, openness, pinch, finger direction) prefer these.
// - We feed MediaPipe the raw, UNMIRRORED frame. Only the on-screen preview is mirrored (CSS scaleX(-1)).
//   In the raw frame the user's right hand is on the image's LEFT side.
// - MediaPipe handedness labels assume a mirrored (selfie) image. With a raw frame they are therefore
//   swapped: label "Left" is the user's RIGHT hand. See `assignSides`.
// - "View" space (what the `rotateAxis` command uses) is how the user perceives things, and matches the
//   three.js camera frame: +x = the user's right (screen right), +y = up, +z = out of the screen toward
//   the user. Image -> view is (x, y, z) -> (-x, -y, +z): a proper rotation, so cross products carry over.
//
// Landmark ids: 0 wrist; thumb 1-4; index 5-8; middle 9-12; ring 13-16; pinky 17-20 (MCP..tip).

export type Pt = { x: number; y: number; z?: number };
export type Vec3 = [number, number, number];

/** 2D distance in the image plane. */
export const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
/** 3D distance (z defaults to 0). */
export const dist3 = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y, (a.z ?? 0) - (b.z ?? 0));
export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const norm = (a: Vec3) => Math.hypot(a[0], a[1], a[2]);
export const normalize = (a: Vec3): Vec3 => {
  const n = norm(a) || 1;
  return [a[0] / n, a[1] / n, a[2] / n];
};

// ---------------------------------------------------------------------------------------------------
// One Euro filter (Casiez, Roussel, Vogel 2012): a low-pass whose cutoff rises with speed, so a still
// hand is very smooth and a fast hand has little lag.
// ---------------------------------------------------------------------------------------------------
export interface OneEuroParams {
  minCutoff: number; // Hz. Lower = smoother when still.
  beta: number; // cutoff gain per unit of speed (units/s). Higher = less lag when moving.
  dCutoff: number; // Hz, cutoff for the speed estimate.
}
const smoothing = (cutoff: number, dt: number) => 1 / (1 + 1 / (2 * Math.PI * cutoff) / dt);

/** Scalar filter. Call with the value and its timestamp in SECONDS. */
export function oneEuro({ minCutoff, beta, dCutoff }: OneEuroParams = { minCutoff: 1, beta: 0, dCutoff: 1 }) {
  let prev: number | null = null;
  let dPrev = 0;
  let tPrev = 0;
  return (value: number, t: number): number => {
    if (prev === null || t <= tPrev) {
      prev = value;
      tPrev = t;
      return value;
    }
    const dt = t - tPrev;
    const dRaw = (value - prev) / dt;
    dPrev += (dRaw - dPrev) * smoothing(dCutoff, dt);
    prev += (value - prev) * smoothing(minCutoff + beta * Math.abs(dPrev), dt);
    tPrev = t;
    return prev;
  };
}

/** One Euro filter over a whole landmark array (x, y, z of each point). Timestamp in MILLISECONDS. */
export function landmarkFilter(params: OneEuroParams) {
  let filters: ((v: number, t: number) => number)[] = [];
  return (pts: Pt[], tMs: number): Pt[] => {
    if (filters.length !== pts.length * 3) filters = Array.from({ length: pts.length * 3 }, () => oneEuro(params));
    const t = tMs / 1000;
    return pts.map((p, i) => ({ x: filters[i * 3](p.x, t), y: filters[i * 3 + 1](p.y, t), z: filters[i * 3 + 2](p.z ?? 0, t) }));
  };
}

// ---------------------------------------------------------------------------------------------------
// Hand shape (use world landmarks, or image landmarks made isotropic with `isotropic`)
// ---------------------------------------------------------------------------------------------------
/** Image landmarks scaled so one unit is the frame height on every axis (aspect = width / height). */
export const isotropic = (lm: Pt[], aspect: number): Pt[] => lm.map((p) => ({ x: p.x * aspect, y: p.y, z: (p.z ?? 0) * aspect }));

/** Wrist to middle-finger knuckle. Every shape feature is divided by this, so distance to the camera does not matter. */
export const handSize = (lm: Pt[]) => dist3(lm[0], lm[9]) || 1e-6;

const FINGERS = [5, 9, 13, 17] as const; // MCP ids of index, middle, ring, pinky
export const TIPS = [4, 8, 12, 16, 20] as const;

/**
 * 1 = perfectly straight finger, about 0.3-0.5 = fully curled. Knuckle-to-tip distance divided by the
 * length of the finger's three bones, in 3D, so it does not depend on which way the hand faces.
 */
export function straightness(lm: Pt[], mcp: number) {
  const bones = dist3(lm[mcp], lm[mcp + 1]) + dist3(lm[mcp + 1], lm[mcp + 2]) + dist3(lm[mcp + 2], lm[mcp + 3]);
  return dist3(lm[mcp], lm[mcp + 3]) / (bones || 1e-6);
}
/** [index, middle, ring, pinky] straightness. */
export const fingerStraightness = (lm: Pt[]) => FINGERS.map((m) => straightness(lm, m)) as [number, number, number, number];

/** Thumb tip to index tip, in hand sizes. About 0 when pinching, 0.8+ for an open hand. */
export const pinchRatio = (lm: Pt[]) => dist3(lm[4], lm[8]) / handSize(lm);

/**
 * Hand openness in hand sizes: (mean fingertip distance from the palm centre) + (mean fingertip distance
 * from the fingertips' own centroid). The first term falls as the fingers curl toward a fist, the second
 * as they are drawn together, so both ways of "closing all fingers" lower it.
 * Roughly 1.7 for a spread hand and 0.8 for a fist.
 */
export function openness(lm: Pt[]) {
  const mean = (ids: readonly number[]) => ({
    x: ids.reduce((s, k) => s + lm[k].x, 0) / ids.length,
    y: ids.reduce((s, k) => s + lm[k].y, 0) / ids.length,
    z: ids.reduce((s, k) => s + (lm[k].z ?? 0), 0) / ids.length,
  });
  const palm = mean([0, 5, 9, 13, 17]);
  const tips = mean(TIPS);
  return TIPS.reduce((s, t) => s + dist3(lm[t], palm) + dist3(lm[t], tips), 0) / 5 / handSize(lm);
}

export type Pose = 'open' | 'fist' | 'point' | 'pinch' | 'other';

export const POSE = {
  extended: 0.85, // straightness above this = finger extended
  curled: 0.7, // straightness below this = finger curled (for "point")
  fist: 0.6, // all four fingers below this = fist
  pinchOn: 0.28, // pinch ratio to start a pinch
  pinchOff: 0.42, // pinch ratio to end it (hysteresis)
  uniform: 0.25, // max spread of the four straightness values for "all fingers move together"
  hintScore: 0.6, // minimum MediaPipe gesture score to use as a tie-breaker
};

/** MediaPipe GestureRecognizer category names we map onto our poses. */
const HINTS: Record<string, Pose> = { Closed_Fist: 'fist', Open_Palm: 'open', Pointing_Up: 'point' };

export interface HandShape {
  pose: Pose;
  straight: [number, number, number, number];
  openness: number;
  pinch: number; // pinch ratio
  pinching: boolean; // with hysteresis
  /** True when the four fingers are equally bent: an open hand, a fist or anything between (the zoom gesture). */
  uniform: boolean;
}

/**
 * Classify one hand. Geometry decides; the MediaPipe gesture (`hint`) only breaks ties when the geometry
 * says "other". `wasPinching` gives the pinch its hysteresis. Order matters: fist, pinch, point, open.
 */
export function classifyHand(lm: Pt[], wasPinching = false, hint?: { name: string; score: number }): HandShape {
  const straight = fingerStraightness(lm);
  const pinch = pinchRatio(lm);
  const isFist = straight.every((s) => s < POSE.fist);
  const pinching = !isFist && pinch < (wasPinching ? POSE.pinchOff : POSE.pinchOn);
  let pose: Pose = 'other';
  if (isFist) pose = 'fist';
  else if (pinching) pose = 'pinch';
  else if (straight[0] > POSE.extended && straight.slice(1).every((s) => s < POSE.curled)) pose = 'point';
  else if (straight.every((s) => s > POSE.extended)) pose = 'open';
  else if (hint && hint.score >= POSE.hintScore && HINTS[hint.name]) {
    const h = HINTS[hint.name];
    // Pointing_Up is only trusted when the index finger is not curled.
    if (h !== 'point' || straight[0] > POSE.curled) pose = h;
  }
  const uniform = Math.max(...straight) - Math.min(...straight) < POSE.uniform;
  return { pose, straight, openness: openness(lm), pinch, pinching, uniform };
}

// ---------------------------------------------------------------------------------------------------
// Handedness
// ---------------------------------------------------------------------------------------------------
export type Side = 'left' | 'right'; // the USER's own left / right hand

/**
 * Map MediaPipe handedness labels to the user's real hands for a RAW (unmirrored) camera frame.
 * MediaPipe assumes a mirrored image, so its "Left" is the user's right hand; `swap` flips that
 * (for cameras or drivers that already mirror the frame). If two hands get the same label, or a label
 * is missing, fall back to position: in a raw frame the user's right hand has the SMALLER image x.
 */
export function assignSides(hands: { label?: string; x: number }[], swap = false): Side[] {
  const fromLabel = (l?: string): Side | null => {
    if (l !== 'Left' && l !== 'Right') return null;
    return (l === 'Left') !== swap ? 'right' : 'left';
  };
  const sides = hands.map((h) => fromLabel(h.label));
  if (hands.length === 2 && (sides[0] === null || sides[1] === null || sides[0] === sides[1])) {
    return hands[0].x <= hands[1].x ? ['right', 'left'] : ['left', 'right'];
  }
  return sides.map((s) => s ?? 'right');
}

// ---------------------------------------------------------------------------------------------------
// Finger rotation (the two-hand rotate gesture)
// ---------------------------------------------------------------------------------------------------
/** Image-oriented vector -> view space (+x user's right, +y up, +z toward the user). */
export const toView = (v: Vec3): Vec3 => [-v[0], -v[1], v[2]];

/** Unit direction of the index finger (knuckle 5 -> tip 8) in view space. Pass world or isotropic landmarks. */
export function indexDirection(lm: Pt[]): Vec3 {
  const a = lm[5];
  const b = lm[8];
  return normalize(toView([b.x - a.x, b.y - a.y, (b.z ?? 0) - (a.z ?? 0)]));
}

/**
 * The rotation that takes unit vector `from` to unit vector `to`: a unit axis and a positive angle,
 * right-hand rule (counter-clockwise when the axis points at you).
 */
export function rotationBetween(from: Vec3, to: Vec3): { axis: Vec3; angle: number } {
  const c = cross(from, to);
  const s = norm(c);
  const angle = Math.atan2(s, dot(from, to));
  return { axis: s > 1e-9 ? [c[0] / s, c[1] / s, c[2] / s] : [0, 0, 1], angle };
}

// ---------------------------------------------------------------------------------------------------
// Twirl (fingertip traces a circle)
// ---------------------------------------------------------------------------------------------------
/**
 * How far a path winds around its own centroid. `winding` is the signed total angle in radians
 * (about +-2*PI for one full circle, near 0 for a line or a back-and-forth wiggle). `radius` is the mean
 * distance from the centroid, `roundness` is 1 minus the radius' coefficient of variation (1 = circle) and
 * `fill` is the area the path sweeps around the centroid divided by PI * radius^2 (about 1 per full
 * circle, about 0 for a line or wiggle, which is what makes a side-to-side wag safe).
 */
export function windingStats(path: { x: number; y: number }[]) {
  const n = path.length;
  if (n < 3) return { winding: 0, radius: 0, roundness: 0, fill: 0 };
  const cx = path.reduce((s, p) => s + p.x, 0) / n;
  const cy = path.reduce((s, p) => s + p.y, 0) / n;
  let winding = 0;
  let area = 0;
  let prev = Math.atan2(path[0].y - cy, path[0].x - cx);
  const radii: number[] = [];
  path.forEach((p, i) => {
    const q = path[i + 1];
    if (q) area += ((p.x - cx) * (q.y - cy) - (q.x - cx) * (p.y - cy)) / 2;
    const a = Math.atan2(p.y - cy, p.x - cx);
    winding += Math.atan2(Math.sin(a - prev), Math.cos(a - prev)); // step wrapped to -PI..PI
    prev = a;
    radii.push(Math.hypot(p.x - cx, p.y - cy));
  });
  const radius = radii.reduce((s, r) => s + r, 0) / n;
  const sd = Math.sqrt(radii.reduce((s, r) => s + (r - radius) ** 2, 0) / n);
  return { winding, radius, roundness: radius > 0 ? 1 - sd / radius : 0, fill: radius > 0 ? Math.abs(area) / (Math.PI * radius * radius) : 0 };
}

// ---------------------------------------------------------------------------------------------------
// Swipe (hard, fast, vertical)
// ---------------------------------------------------------------------------------------------------
export interface SwipeSample {
  x: number; // frame heights (image x times aspect)
  y: number; // frame heights, y DOWN
  t: number; // ms
  open: boolean; // hand classified as open on that frame
}
export interface SwipeParams {
  windowMs: number; // the whole swipe must fit in this
  minTravel: number; // frame heights
  minSpeed: number; // frame heights per second, averaged over the swipe
  maxSideways: number; // |dx| must be below this fraction of |dy|
  minOpen: number; // fraction of the swipe's frames that must be an open hand
}

/**
 * Looks back from the newest sample for a start point that makes a long, fast, mostly vertical move.
 * Returns 'up' (image y decreased: the hand moved up) or 'down', else null.
 */
export function detectSwipe(samples: SwipeSample[], p: SwipeParams): 'up' | 'down' | null {
  const last = samples[samples.length - 1];
  if (!last) return null;
  let open = last.open ? 1 : 0;
  for (let j = samples.length - 2; j >= 0; j--) {
    const s = samples[j];
    const dt = last.t - s.t;
    if (dt > p.windowMs) break;
    open += s.open ? 1 : 0;
    const dy = last.y - s.y;
    const dx = last.x - s.x;
    if (dt <= 0 || Math.abs(dy) < p.minTravel) continue;
    if (Math.abs(dy) / (dt / 1000) < p.minSpeed) continue;
    if (Math.abs(dx) > p.maxSideways * Math.abs(dy)) continue;
    if (open / (samples.length - j) < p.minOpen) continue;
    return dy < 0 ? 'up' : 'down';
  }
  return null;
}
