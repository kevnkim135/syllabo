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

/**
 * open   all four fingers straight (swipe)
 * fist   all four curled
 * point  index straight, the rest curled (twirl; steering finger for rotate)
 * pinch  thumb tip on index tip (the rotate clutch)
 * gather thumb, index AND middle tips together: a three-finger pinch (zoom in)
 * spread thumb, index and middle held apart with ring and pinky folded (zoom out)
 */
export type Pose = 'open' | 'fist' | 'point' | 'pinch' | 'gather' | 'spread' | 'other';

export const POSE = {
  extended: 0.85, // straightness above this = finger extended
  curled: 0.7, // straightness below this = finger curled (for "point")
  fist: 0.6, // all four fingers below this = fist
  pinchOn: 0.33, // pinch ratio to start a pinch (registers a little before the fingertips fully touch)
  pinchOff: 0.42, // pinch ratio to end it (hysteresis)
  uniform: 0.25, // max spread of the four straightness values for "all fingers move together"
  gatherMiddle: 0.27, // middle tip within this of BOTH the thumb and index tips (hand sizes) = three-finger pinch; off at +0.1
  pointIndex: 0.8, // pointing: index straighter than this...
  pointOthers: 0.78, // ...the other three bent past this...
  pointMargin: 0.15, // ...and the index clearly the straightest
  spreadStraight: 0.8, // index and middle straighter than this for "spread"
  spreadFolded: 0.8, // ring and pinky must be bent more than this (straightness below it) for "spread"
  spreadThumb: 0.6, // thumb tip to index tip (hand sizes) at least this for "spread"
  spreadThumbOut: 0.85, // thumb tip to ring knuckle (hand sizes): the thumb sticks out, not tucked like a peace sign
  spreadFingers: 0.28, // index tip to middle tip (hand sizes) at least this for "spread"
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
  gathering: boolean; // three-finger pinch, with hysteresis
  /** True when the four fingers are equally bent: an open hand, a fist or anything between (the zoom gesture). */
  uniform: boolean;
}

/**
 * Classify one hand. Geometry decides; the MediaPipe gesture (`hint`) only breaks ties when the geometry
 * says "other". `wasPinching` gives the pinch its hysteresis. Order matters: fist, pinch, point, open.
 */
export function classifyHand(lm: Pt[], wasPinching = false, hint?: { name: string; score: number }, wasGathering = false): HandShape {
  const straight = fingerStraightness(lm);
  const pinch = pinchRatio(lm);
  const isFist = straight.every((s) => s < POSE.fist);
  // Thumb tip on index tip is a pinch even when the other fingers are folded (that is how most people pinch);
  // in a real fist the thumb wraps over the fingers, so its tip is not on the index tip.
  const pinching = pinch < (wasPinching ? POSE.pinchOff : POSE.pinchOn);
  const size = handSize(lm);
  const middleGap = dist3(lm[4], lm[12]) / size;
  const gatherTol = POSE.gatherMiddle + (wasGathering ? 0.1 : 0);
  // All three tips together: a two-finger pinch with the middle finger merely nearby stays a pinch (select, not zoom).
  const gathering = pinching && middleGap < gatherTol && dist3(lm[8], lm[12]) / size < gatherTol + 0.05;
  const spreading =
    straight[0] > POSE.spreadStraight &&
    straight[1] > POSE.spreadStraight &&
    straight[2] < POSE.spreadFolded &&
    straight[3] < POSE.spreadFolded &&
    pinch > POSE.spreadThumb &&
    dist3(lm[4], lm[13]) / size > POSE.spreadThumbOut &&
    dist3(lm[8], lm[12]) / size > POSE.spreadFingers;
  let pose: Pose = 'other';
  if (gathering) pose = 'gather';
  else if (pinching) pose = 'pinch';
  else if (isFist) pose = 'fist';
  else if (spreading) pose = 'spread';
  else if (straight[0] > POSE.pointIndex && straight.slice(1).every((s) => s < POSE.pointOthers) && straight[0] - Math.max(...straight.slice(1)) > POSE.pointMargin) pose = 'point';
  else if (straight.every((s) => s > POSE.extended)) pose = 'open';
  else if (hint && hint.score >= POSE.hintScore && HINTS[hint.name]) {
    const h = HINTS[hint.name];
    // Pointing_Up is only trusted when the index finger is not curled.
    if (h !== 'point' || straight[0] > POSE.curled) pose = h;
  }
  const uniform = Math.max(...straight) - Math.min(...straight) < POSE.uniform;
  return { pose, straight, openness: openness(lm), pinch, pinching, gathering, uniform };
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
// Fingertip in 3D (the two-hand rotate traces circles with it)
// ---------------------------------------------------------------------------------------------------
/**
 * Index fingertip position in view space, in metres from the camera's optical axis (z = distance from
 * the camera, so +z points at the user like the view axis).
 *
 * World landmarks are metric but centred on the hand, so they cannot see the whole hand moving toward
 * the camera. Image landmarks see the hand's position but not its distance. So: fit the weak-perspective
 * scale s (frame heights per metre) that maps world x,y onto image x,y. World landmarks keep the camera's
 * orientation, so this fit does not shrink when the hand tilts (unlike measuring one bone in the image).
 * Distance = focal / s; the hand centre's lateral position = image offset / s; the fingertip is that
 * centre plus its world offset. Without world landmarks, an average hand size stands in.
 */
/** Distance of the hand from the camera in metres, from the rigid palm only (finger curl does not change it). */
export function handDepth(image: Pt[], world: Pt[] | undefined, aspect: number, focal: number): number {
  const p = tipPosition(image, world, aspect, focal);
  const t = world?.[8];
  return p[2] - (t?.z ?? 0); // tip depth minus the tip's own offset from the hand = the hand's depth
}

export function tipPosition(image: Pt[], world: Pt[] | undefined, aspect: number, focal: number): Vec3 {
  const cx = 0.5 * aspect;
  const cy = 0.5;
  const img = image.map((p) => ({ x: p.x * aspect, y: p.y }));
  if (!world) {
    const s = dist(img[0], img[9]) / 0.09 || 1e-6; // wrist to middle knuckle is about 9 cm
    return toView([(img[8].x - cx) / s, (img[8].y - cy) / s, focal / s]);
  }
  // Fit on the palm only (wrist, thumb base, the four knuckles): it is rigid, so curling the fingers into a
  // pinch does not read as the hand moving toward or away from the camera.
  const PALM = [0, 1, 5, 9, 13, 17];
  const n = PALM.length;
  const mi = { x: PALM.reduce((a, q) => a + img[q].x, 0) / n, y: PALM.reduce((a, q) => a + img[q].y, 0) / n };
  const mw = { x: PALM.reduce((a, q) => a + world[q].x, 0) / n, y: PALM.reduce((a, q) => a + world[q].y, 0) / n };
  let num = 0;
  let den = 0;
  for (const q of PALM) {
    const wx = world[q].x - mw.x;
    const wy = world[q].y - mw.y;
    num += (img[q].x - mi.x) * wx + (img[q].y - mi.y) * wy;
    den += wx * wx + wy * wy;
  }
  const s = num / (den || 1e-12) || 1e-6;
  // where the world origin lands in the image, then back out to metres
  const ox = mi.x - s * mw.x;
  const oy = mi.y - s * mw.y;
  const t = world[8];
  return toView([(ox - cx) / s + t.x, (oy - cy) / s + t.y, focal / s + (t.z ?? 0)]);
}

/**
 * How a 3D path circulates. `area` is the path's vector area: its direction is the normal of the plane
 * the path circles in (right-hand rule: counter-clockwise when the vector points at you) and its length
 * the area swept. `coherence` (0..1) is how much of the motion is circling rather than back-and-forth,
 * and `radius` the mean distance from the centroid.
 */
export function circulation(path: Vec3[]): { area: Vec3; coherence: number; radius: number; centre: Vec3 } {
  const n = path.length;
  const centre: Vec3 = [0, 1, 2].map((k) => path.reduce((a, p) => a + p[k], 0) / (n || 1)) as Vec3;
  const sub3 = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const area: Vec3 = [0, 0, 0];
  let swept = 0;
  let radius = 0;
  for (let i = 0; i < n; i++) radius += norm(sub3(path[i], centre)) / n;
  for (let i = 0; i + 1 < n; i++) {
    const r = sub3(path[i], centre);
    const d = sub3(path[i + 1], path[i]);
    const c = cross(r, d);
    area[0] += c[0] / 2;
    area[1] += c[1] / 2;
    area[2] += c[2] / 2;
    swept += (norm(r) * norm(d)) / 2;
  }
  return { area, coherence: swept > 0 ? norm(area) / swept : 0, radius, centre };
}

/** Index of the dominant axis of `v`, keeping `current` unless another axis is `margin` times stronger. */
export function dominantAxis(v: Vec3, current: number | null, margin = 1.5): number {
  const m = v.map(Math.abs);
  const best = m[0] >= m[1] && m[0] >= m[2] ? 0 : m[1] >= m[2] ? 1 : 2;
  if (current !== null && best !== current && m[best] < m[current] * margin) return current;
  return best;
}

/**
 * Least-squares circle through 2D points (Kasa fit): the centre, or null when the points are nearly
 * collinear. Unlike the centroid, this stays on the true centre when the points cover only part of a circle.
 */
export function fitCircle(pts: [number, number][]): [number, number] | null {
  // minimise sum (x^2 + y^2 + D x + E y + F)^2 -> normal equations in D, E, F
  let sxx = 0, sxy = 0, syy = 0, sx = 0, sy = 0, sxz = 0, syz = 0, sz = 0;
  for (const [x, y] of pts) {
    const z = x * x + y * y;
    sxx += x * x; sxy += x * y; syy += y * y; sx += x; sy += y; sxz += x * z; syz += y * z; sz += z;
  }
  const n = pts.length;
  const A = [[sxx, sxy, sx], [sxy, syy, sy], [sx, sy, n]];
  const b = [-sxz, -syz, -sz];
  const det = (m: number[][]) => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  const d = det(A);
  const scale = Math.max(sxx, syy, 1e-30) ** 2 * n;
  if (Math.abs(d) < 1e-9 * scale) return null;
  const col = (k: number) => A.map((row, i) => row.map((v, j) => (j === k ? b[i] : v)));
  const D = det(col(0)) / d;
  const E = det(col(1)) / d;
  return [-D / 2, -E / 2];
}

/** Signed angle from a to b about unit `axis`, ignoring their components along it. */
export function angleAbout(axis: Vec3, a: Vec3, b: Vec3): number {
  const flat = (v: Vec3): Vec3 => {
    const d = dot(v, axis);
    return [v[0] - d * axis[0], v[1] - d * axis[1], v[2] - d * axis[2]];
  };
  const fa = flat(a);
  const fb = flat(b);
  return Math.atan2(dot(cross(fa, fb), axis), dot(fa, fb));
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
  maxSideways: number; // off-axis travel must be below this fraction of the on-axis travel
  minOpen: number; // fraction of the swipe's frames that must be an open hand
  axis?: 'x' | 'y'; // 'y' (default) = up / down, 'x' = left / right
}

/**
 * Looks back from the newest sample for a start point that makes a long, fast, mostly vertical move.
 * Returns 'up' (image y decreased: the hand moved up) or 'down', else null.
 */
export function detectSwipe(samples: SwipeSample[], p: SwipeParams): 'up' | 'down' | 'left' | 'right' | null {
  const last = samples[samples.length - 1];
  if (!last) return null;
  const horizontal = p.axis === 'x';
  let open = last.open ? 1 : 0;
  for (let j = samples.length - 2; j >= 0; j--) {
    const s = samples[j];
    const dt = last.t - s.t;
    if (dt > p.windowMs) break;
    open += s.open ? 1 : 0;
    const along = horizontal ? last.x - s.x : last.y - s.y;
    const across = horizontal ? last.y - s.y : last.x - s.x;
    if (dt <= 0 || Math.abs(along) < p.minTravel) continue;
    if (Math.abs(along) / (dt / 1000) < p.minSpeed) continue;
    if (Math.abs(across) > p.maxSideways * Math.abs(along)) continue;
    if (open / (samples.length - j) < p.minOpen) continue;
    // The raw frame is unmirrored: image x grows toward the USER's left.
    if (horizontal) return along > 0 ? 'left' : 'right';
    return along < 0 ? 'up' : 'down';
  }
  return null;
}
