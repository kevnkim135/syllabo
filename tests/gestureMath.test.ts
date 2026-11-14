import { test } from 'node:test';
import assert from 'node:assert/strict';
import { twoHandPose, wheelDelta } from '../src/utils/gestureMath';

const pose = (l: [number, number], r: [number, number]) => twoHandPose({ x: l[0], y: l[1] }, { x: r[0], y: r[1] });

test('hand order does not change the pose', () => {
  const a = twoHandPose({ x: 0.3, y: 0.5 }, { x: 0.7, y: 0.5 });
  const b = twoHandPose({ x: 0.7, y: 0.5 }, { x: 0.3, y: 0.5 });
  assert.deepEqual(a, b);
});

test('holding still produces no commands (dead zones)', () => {
  const p = pose([0.3, 0.5], [0.7, 0.5]);
  assert.deepEqual(wheelDelta(p, p), { dx: 0, dy: 0, zoom: 1 });
  const jitter = pose([0.3, 0.5005], [0.7, 0.4995]);
  assert.equal(wheelDelta(p, jitter).dx, 0);
});

test('turning the wheel yaws, sign follows the turn direction', () => {
  const level = pose([0.3, 0.5], [0.7, 0.5]);
  const turned = pose([0.3, 0.45], [0.7, 0.55]);
  const back = pose([0.3, 0.55], [0.7, 0.45]);
  assert.ok(Math.abs(wheelDelta(level, turned).dx) > 0);
  assert.equal(Math.sign(wheelDelta(level, turned).dx), -Math.sign(wheelDelta(level, back).dx));
});

test('raising both hands pitches, spreading hands zooms in', () => {
  const base = pose([0.3, 0.5], [0.7, 0.5]);
  assert.ok(wheelDelta(base, pose([0.3, 0.4], [0.7, 0.4])).dy < 0);
  assert.ok(wheelDelta(base, pose([0.2, 0.5], [0.8, 0.5])).zoom < 1); // factor < 1 zooms in
  assert.ok(wheelDelta(base, pose([0.4, 0.5], [0.6, 0.5])).zoom > 1);
});

test('zoom per frame is clamped', () => {
  const base = pose([0.3, 0.5], [0.7, 0.5]);
  assert.equal(wheelDelta(base, pose([0.0, 0.5], [1.0, 0.5])).zoom, 0.92);
});
