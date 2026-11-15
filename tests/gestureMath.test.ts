import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  assignSides,
  classifyHand,
  detectSwipe,
  indexDirection,
  isotropic,
  landmarkFilter,
  oneEuro,
  openness,
  pinchRatio,
  rotationBetween,
  straightness,
  windingStats,
  type SwipeSample,
  type Vec3,
} from '../src/utils/gestureMath';
import { makeHand } from '../src/core/input/syntheticHand';

const near = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} is not within ${eps} of ${b}`);
const world = (o: Parameters<typeof makeHand>[0]) => makeHand(o).world!;
const SWIPE = { windowMs: 350, minTravel: 0.3, minSpeed: 1.5, maxSideways: 0.5, minOpen: 0.6 };

// ---- One Euro filter ----
test('one euro: a constant signal passes through unchanged', () => {
  const f = oneEuro({ minCutoff: 1, beta: 0.5, dCutoff: 1 });
  for (let i = 0; i < 30; i++) near(f(0.4, i / 30), 0.4);
});

test('one euro: jitter on a still value is strongly attenuated', () => {
  const f = oneEuro({ minCutoff: 1.2, beta: 8, dCutoff: 1 });
  let maxErr = 0;
  for (let i = 0; i < 90; i++) {
    const out = f(0.5 + (i % 2 ? 0.004 : -0.004), i / 30);
    if (i > 10) maxErr = Math.max(maxErr, Math.abs(out - 0.5));
  }
  assert.ok(maxErr < 0.002, `jitter ${maxErr}`);
});

test('one euro: a fast move is followed with little lag', () => {
  const f = oneEuro({ minCutoff: 1.2, beta: 8, dCutoff: 1 });
  let out = 0;
  for (let i = 0; i <= 15; i++) out = f(i * 0.05, i / 30); // 1.5 units/s
  assert.ok(0.75 - out < 0.06, `lag ${0.75 - out}`);
});

test('landmark filter keeps the array shape and restarts when the point count changes', () => {
  const f = landmarkFilter({ minCutoff: 1, beta: 0, dCutoff: 1 });
  const a = f([{ x: 0.1, y: 0.2, z: 0.3 }], 0);
  assert.deepEqual(a, [{ x: 0.1, y: 0.2, z: 0.3 }]);
  assert.equal(f(makeHand().image, 33).length, 21);
});

// ---- hand shape ----
test('straightness is 1 for a straight finger and low for a curled one', () => {
  near(straightness(world({ curl: 0 }), 5), 1, 1e-9);
  assert.ok(straightness(world({ curl: 1 }), 5) < 0.5);
  assert.ok(straightness(world({ curl: 0.5 }), 9) < straightness(world({ curl: 0.2 }), 9));
});

test('poses: open, fist, point, pinch', () => {
  assert.equal(classifyHand(world({ curl: 0, spread: 1 })).pose, 'open');
  assert.equal(classifyHand(world({ curl: 0, spread: 0 })).pose, 'open');
  assert.equal(classifyHand(world({ curl: 1 })).pose, 'fist');
  assert.equal(classifyHand(world({ curl: [0, 1, 1, 1] })).pose, 'point');
  assert.equal(classifyHand(world({ pinch: true })).pose, 'pinch');
  assert.equal(classifyHand(world({ pinch: true, curl: [0, 0.8, 0.8, 0.8] })).pose, 'pinch');
  assert.equal(classifyHand(world({ curl: [0, 0, 1, 1] })).pose, 'other'); // victory sign is nobody's gesture
});

test('poses do not depend on hand size or position, and work from image landmarks too', () => {
  for (const o of [{ curl: 0 }, { curl: 1 }, { curl: [0, 1, 1, 1] as [number, number, number, number] }, { pinch: true }]) {
    const expected = classifyHand(world(o)).pose;
    for (const scale of [1, 2, 4]) {
      const h = makeHand({ ...o, scale, at: [0.2, 0.4], aspect: 16 / 9 });
      assert.equal(classifyHand(isotropic(h.image, 16 / 9)).pose, expected);
    }
  }
});

test('a fist is not a pinch, an open hand is not a pinch', () => {
  assert.equal(classifyHand(world({ curl: 1 })).pinching, false);
  assert.ok(pinchRatio(world({ curl: 0 })) > 0.8);
  near(pinchRatio(world({ pinch: true })), 0, 1e-9);
});

test('pinch has hysteresis', () => {
  // slide the thumb tip away from the index tip to a ratio between the on and off thresholds
  const h = world({ pinch: true });
  const size = Math.hypot(h[9].x - h[0].x, h[9].y - h[0].y);
  h[4] = { x: h[8].x + 0.35 * size, y: h[8].y, z: h[8].z };
  assert.equal(classifyHand(h, false).pinching, false);
  assert.equal(classifyHand(h, true).pinching, true);
});

test('uniform: all fingers together (zoom) vs. one finger out (point)', () => {
  assert.equal(classifyHand(world({ curl: 0 })).uniform, true);
  assert.equal(classifyHand(world({ curl: 0.5 })).uniform, true);
  assert.equal(classifyHand(world({ curl: 1 })).uniform, true);
  assert.equal(classifyHand(world({ curl: [0, 1, 1, 1] })).uniform, false);
});

test('openness falls steadily as the hand closes, and is scale invariant', () => {
  const steps = [0, 0.25, 0.5, 0.75, 1].map((c) => openness(world({ curl: c, spread: 1 - c })));
  for (let i = 1; i < steps.length; i++) assert.ok(steps[i] < steps[i - 1], steps.join(' '));
  assert.ok(steps[0] - steps[4] > 0.5, `range ${steps[0] - steps[4]}`);
  // fingers straight but drawn together is also "less open" than a spread hand
  assert.ok(openness(world({ curl: 0, spread: 0 })) < openness(world({ curl: 0, spread: 1 })));
  const a = makeHand({ scale: 1 });
  const b = makeHand({ scale: 3, at: [0.3, 0.3] });
  near(openness(isotropic(a.image, 4 / 3)), openness(isotropic(b.image, 4 / 3)), 1e-9);
});

test('MediaPipe gesture hint only breaks ties', () => {
  const half = world({ curl: 0.72 }); // geometry says "other"
  assert.equal(classifyHand(half).pose, 'other');
  assert.equal(classifyHand(half, false, { name: 'Closed_Fist', score: 0.9 }).pose, 'fist');
  assert.equal(classifyHand(half, false, { name: 'Closed_Fist', score: 0.3 }).pose, 'other');
  assert.equal(classifyHand(world({ curl: 0 }), false, { name: 'Closed_Fist', score: 0.9 }).pose, 'open');
});

// ---- handedness ----
test('handedness: MediaPipe labels are swapped for a raw frame', () => {
  assert.deepEqual(assignSides([{ label: 'Left', x: 0.3 }]), ['right']);
  assert.deepEqual(assignSides([{ label: 'Right', x: 0.7 }, { label: 'Left', x: 0.3 }]), ['left', 'right']);
  assert.deepEqual(assignSides([{ label: 'Left', x: 0.3 }], true), ['left']);
});

test('handedness: duplicate or missing labels fall back to position (user right = smaller raw x)', () => {
  assert.deepEqual(assignSides([{ label: 'Left', x: 0.7 }, { label: 'Left', x: 0.3 }]), ['left', 'right']);
  assert.deepEqual(assignSides([{ x: 0.2 }, { x: 0.8 }]), ['right', 'left']);
});

// ---- finger rotation ----
test('index direction is reported in view space (x user-right, y up, z toward the user)', () => {
  const up = indexDirection(world({ curl: [0, 1, 1, 1], indexDir: [0, -1, 0] }));
  assert.deepEqual(up.map((v) => Math.round(v * 1e6) / 1e6 + 0), [0, 1, 0]);
  // raw image +x is the user's LEFT
  near(indexDirection(world({ indexDir: [1, 0, 0] }))[0], -1);
  // toward the camera (smaller z) is away from the user
  near(indexDirection(world({ indexDir: [0, 0, -1] }))[2], -1);
});

test('rotationBetween: axis by the right-hand rule, angle positive', () => {
  const y: Vec3 = [0, 1, 0];
  const r = rotationBetween(y, [-Math.sin(0.3), Math.cos(0.3), 0]); // up -> toward -x: counter-clockwise on screen
  near(r.angle, 0.3);
  near(r.axis[2], 1);
  near(rotationBetween(y, [Math.sin(0.3), Math.cos(0.3), 0]).axis[2], -1); // clockwise on screen
  near(rotationBetween(y, [0, Math.cos(0.2), Math.sin(0.2)]).axis[0], 1); // tip toward the user: about +x
  near(rotationBetween(y, y).angle, 0);
});

// ---- twirl ----
const circle = (turns: number, n = 40, r = 0.05, dir = 1) =>
  Array.from({ length: n + 1 }, (_, i) => ({ x: 0.5 + r * Math.cos((dir * turns * 2 * Math.PI * i) / n), y: 0.5 + r * Math.sin((dir * turns * 2 * Math.PI * i) / n) }));

test('winding: a full circle is about 2 PI, signed by direction, and round', () => {
  const w = windingStats(circle(1));
  near(w.winding, 2 * Math.PI, 0.2);
  near(w.radius, 0.05, 0.005);
  assert.ok(w.roundness > 0.9);
  near(windingStats(circle(1, 40, 0.05, -1)).winding, -2 * Math.PI, 0.2);
});

test('winding: lines, wiggles and half circles are far from a full turn', () => {
  const line = Array.from({ length: 30 }, (_, i) => ({ x: 0.2 + i * 0.02, y: 0.5 + i * 0.001 }));
  const wiggle = Array.from({ length: 60 }, (_, i) => ({ x: 0.5 + 0.1 * Math.sin(i / 3), y: 0.5 + 0.002 * Math.cos(i) }));
  assert.ok(Math.abs(windingStats(line).winding) < 3.5);
  assert.ok(windingStats(line).fill < 0.1);
  assert.ok(windingStats(wiggle).fill < 0.1);
  assert.ok(Math.abs(windingStats(circle(0.5)).winding) < 4.5);
  assert.ok(windingStats(circle(1)).fill > 0.9);
  assert.equal(windingStats([]).winding, 0);
});

// ---- swipe ----
const stroke = (dy: number, ms: number, opts: { dx?: number; open?: boolean; frames?: number } = {}): SwipeSample[] => {
  const n = opts.frames ?? Math.max(2, Math.round(ms / 33));
  return Array.from({ length: n + 1 }, (_, i) => ({ x: 0.6 + ((opts.dx ?? 0) * i) / n, y: 0.8 + (dy * i) / n, t: 1000 + (ms * i) / n, open: opts.open ?? true }));
};

test('swipe: hard fast vertical moves only', () => {
  assert.equal(detectSwipe(stroke(-0.4, 180), SWIPE), 'up');
  assert.equal(detectSwipe(stroke(0.4, 180), SWIPE), 'down');
  assert.equal(detectSwipe(stroke(-0.4, 340, { frames: 30 }).slice(0, 20), SWIPE), null); // not far enough yet
  assert.equal(detectSwipe(stroke(-0.4, 600), SWIPE), null); // too slow
  assert.equal(detectSwipe(stroke(-0.2, 100), SWIPE), null); // too short
  assert.equal(detectSwipe(stroke(-0.4, 180, { dx: 0.3 }), SWIPE), null); // diagonal
  assert.equal(detectSwipe(stroke(0, 180, { dx: 0.5 }), SWIPE), null); // the old sideways swipe is gone
  assert.equal(detectSwipe(stroke(-0.4, 180, { open: false }), SWIPE), null); // not an open hand
  assert.equal(detectSwipe([], SWIPE), null);
});

// ---------------- three-finger poses, fingertip in 3D, circulation ----------------
import { angleAbout, circulation, dominantAxis, tipPosition, toView } from '../src/utils/gestureMath';

test('poses: three-finger pinch is "gather", three fingers spread with the thumb out is "spread"', () => {
  assert.equal(classifyHand(world({ gather: true })).pose, 'gather');
  assert.equal(classifyHand(world({ gather: true, curl: [0, 0, 0.6, 0.6] })).pose, 'gather');
  assert.equal(classifyHand(world({ curl: [0, 0, 1, 1], thumbCurl: 0 })).pose, 'spread');
  assert.equal(classifyHand(world({ curl: [0, 0, 1, 1], thumbCurl: 1 })).pose, 'other'); // peace sign, thumb tucked
  assert.equal(classifyHand(world({ curl: 0 })).pose, 'open'); // all five out is an open hand, not "spread"
});

test('tipPosition recovers where the fingertip is in 3D, and the hand tilting does not move it', () => {
  const F = 0.9;
  const aspect = 4 / 3;
  for (const P of [[0, 0, 0.5], [0.1, -0.05, 0.4], [-0.08, 0.06, 0.7]] as [number, number, number][]) {
    for (const turn of [undefined, { axis: [1, 0, 0] as [number, number, number], angle: 0.5 }, { axis: [0, 1, 0] as [number, number, number], angle: -0.6 }]) {
      const s = F / P[2];
      const h = makeHand({ curl: [0, 1, 1, 1], scale: s, aspect, at: [0.5 + (-P[0] * s) / aspect, 0.5 - P[1] * s], turn });
      const tip = tipPosition(h.image, h.world, aspect, F);
      const w8 = h.world![8];
      const offset = toView([w8.x, w8.y, w8.z ?? 0]);
      for (let k = 0; k < 3; k++) near(tip[k], P[k] + offset[k], 1e-6);
    }
  }
});

test('circulation: plane normal and direction of a circle; a back-and-forth line is not circling', () => {
  const ring = Array.from({ length: 30 }, (_, i): [number, number, number] => [Math.cos(i / 4.7), 0, Math.sin(i / 4.7)]);
  const c = circulation(ring);
  assert.equal(dominantAxis(c.area, null), 1);
  assert.ok(c.coherence > 0.95);
  const line = Array.from({ length: 30 }, (_, i): [number, number, number] => [Math.sin(i / 3), 0.01 * (i % 2), 0]);
  assert.ok(circulation(line).coherence < 0.3);
});

test('dominantAxis keeps the current axis unless another is clearly stronger', () => {
  assert.equal(dominantAxis([1, 1.2, 0], 0), 0);
  assert.equal(dominantAxis([1, 1.6, 0], 0), 1);
  assert.equal(dominantAxis([0.1, -2, 0.3], null), 1);
});

test('angleAbout is signed by the right-hand rule and ignores the along-axis part', () => {
  near(angleAbout([0, 0, 1], [1, 0, 5], [0, 1, -3]), Math.PI / 2);
  near(angleAbout([0, 0, -1], [1, 0, 0], [0, 1, 0]), -Math.PI / 2);
});

import { fitCircle } from '../src/utils/gestureMath';
test('fitCircle finds the true centre from a partial arc; a straight line has none', () => {
  const arc = Array.from({ length: 12 }, (_, i): [number, number] => [3 + 2 * Math.cos(i / 6), -1 + 2 * Math.sin(i / 6)]); // under a third of a circle
  const c = fitCircle(arc)!;
  near(c[0], 3, 1e-9);
  near(c[1], -1, 1e-9);
  assert.equal(fitCircle(Array.from({ length: 10 }, (_, i): [number, number] => [i, 2 * i])), null);
});

import { handDepth } from '../src/utils/gestureMath';
test('handDepth: curling the fingers into a pinch does not read as moving toward or away from the camera', () => {
  const at = (o: object, dist = 0.5) => {
    const s = 0.9 / dist;
    const h = makeHand({ ...o, scale: s, aspect: 4 / 3, at: [0.5, 0.5] });
    return handDepth(h.image, h.world, 4 / 3, 0.9);
  };
  const open = at({ curl: [0, 1, 1, 1] });
  near(at({ pinch: true }), open, 1e-6);
  near(at({ curl: [0.4, 1, 1, 1] }), open, 1e-6);
  near(open, 0.5, 1e-6);
  near(at({ curl: [0, 1, 1, 1] }, 0.62), 0.62, 1e-6); // but really moving the hand does
});
