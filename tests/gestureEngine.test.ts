import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Command } from '../src/core/commands';
import { createGestureInterpreter, GESTURE, type GestureFrame, type HandInput } from '../src/core/input/gestureEngine';
import { makeHand, type HandOptions } from '../src/core/input/syntheticHand';

const DT = 1000 / 30;
type Script = (frame: number, tMs: number) => HandInput[];

/** Runs a scripted sequence at 30 fps through a fresh interpreter. */
function run(script: Script, frames: number) {
  const cmds: Command[] = [];
  const step = createGestureInterpreter((c) => cmds.push(c));
  const out: GestureFrame[] = [];
  for (let i = 0; i < frames; i++) out.push(step(script(i, i * DT), 1000 + i * DT));
  return { cmds, out, types: [...new Set(cmds.map((c) => c.type))] };
}
const ramp = (i: number, from: number, to: number) => Math.min(1, Math.max(0, (i - from) / (to - from)));
// The user's hands in a RAW frame: the right hand is on the image's left and MediaPipe calls it "Left".
const R = (o: HandOptions = {}): HandInput => makeHand({ at: [0.3, 0.7], label: 'Left', ...o });
const L = (o: HandOptions = {}): HandInput => makeHand({ at: [0.7, 0.7], label: 'Right', ...o });
const POINT: [number, number, number, number] = [0, 1, 1, 1];

// ---------------- zoom ----------------
test('zoom: closing all fingers zooms out, opening zooms in, and nothing else fires', () => {
  const close = run((i) => [R({ curl: ramp(i, 10, 40), spread: 1 - ramp(i, 10, 40) })], 55);
  assert.deepEqual(close.types, ['zoom']);
  const factors = close.cmds.map((c) => (c.type === 'zoom' ? c.factor : 0));
  assert.ok(factors.every((f) => f > 1), 'closing must only zoom out');
  assert.ok(factors.reduce((a, b) => a * b, 1) > 1.5, 'a full close is a clear zoom');
  assert.ok(close.out.some((f) => f.label === 'zoomOut'));

  const open = run((i) => [R({ curl: 1 - ramp(i, 10, 40), spread: ramp(i, 10, 40) })], 55);
  assert.deepEqual(open.types, ['zoom']);
  assert.ok(open.cmds.every((c) => c.type === 'zoom' && c.factor < 1), 'opening must only zoom in');
});

test('zoom: a still or jittery open hand does nothing (dead zone)', () => {
  const still = run((i) => [R({ curl: 0.02 * (i % 2), at: [0.3 + 0.002 * (i % 3), 0.7] })], 90);
  assert.deepEqual(still.cmds, []);
  assert.equal(still.out.at(-1)!.label, 'hand');
});

test('zoom: an open hand that just moves around (slowly or quickly sideways) does not zoom or navigate', () => {
  const drift = run((i) => [R({ at: [0.3 + 0.3 * ramp(i, 10, 70), 0.7 - 0.2 * ramp(i, 10, 70)] })], 80);
  assert.deepEqual(drift.cmds, []);
  const sideways = run((i) => [R({ at: [0.2 + 0.6 * ramp(i, 10, 16), 0.7] })], 40);
  assert.deepEqual(sideways.cmds, []);
});

// ---------------- twirl ----------------
const twirl = (i: number, start: number, period = 30, r = 0.06): [number, number] => {
  const a = (2 * Math.PI * Math.max(0, i - start)) / period;
  return [0.4 + (r * Math.cos(a)) / GESTURE.aspect, 0.7 + r * Math.sin(a)];
};

test('twirl: one fingertip circle emits exactly one newExample', () => {
  const r = run((i) => [R({ curl: POINT, at: i < 45 ? twirl(i, 10) : twirl(45, 10) })], 100);
  assert.deepEqual(r.cmds, [{ type: 'newExample' }]);
  assert.ok(r.out.some((f) => f.label === 'newExample'));
});

test('twirl: cooldown, so twirling on for two circles still gives one', () => {
  const r = run((i) => [R({ curl: POINT, at: twirl(Math.min(i, 70), 10) })], 110);
  assert.deepEqual(r.cmds, [{ type: 'newExample' }]);
});

test('twirl: needs the pointing pose and a real circle', () => {
  // an open hand moving in the same circle
  assert.deepEqual(run((i) => [R({ at: twirl(i, 10, 60) })], 100).types.filter((t) => t === 'newExample'), []);
  // pointing and holding still, or waving side to side
  assert.deepEqual(run(() => [R({ curl: POINT })], 90).cmds, []);
  assert.deepEqual(run((i) => [R({ curl: POINT, at: [0.4 + 0.08 * Math.sin(i / 4), 0.7] })], 120).cmds, []);
  // a tiny circle (jitter-sized)
  assert.deepEqual(run((i) => [R({ curl: POINT, at: twirl(i, 10, 30, 0.01) })], 100).cmds, []);
  // pointing with the finger direction changing is not a rotate without the left-hand clutch
  assert.deepEqual(run((i) => [R({ curl: POINT, indexDir: [Math.sin(0.6 * ramp(i, 10, 40)), -Math.cos(0.6 * ramp(i, 10, 40)), 0] })], 60).cmds, []);
});

// ---------------- rotate ----------------
const sumAngle = (cmds: Command[]) => cmds.reduce((s, c) => s + (c.type === 'rotateAxis' ? c.angle : 0), 0);

test('rotate: left pinch + right index turning counter-clockwise (as the user sees it) rotates about +z', () => {
  const total = 0.6;
  // The user's finger tips toward the user's LEFT, which is +x in the raw image.
  const r = run((i) => {
    const a = total * ramp(i, 15, 45);
    return [L({ pinch: true }), R({ curl: POINT, indexDir: [Math.sin(a), -Math.cos(a), 0] })];
  }, 70);
  assert.deepEqual(r.types, ['rotateAxis']);
  for (const c of r.cmds) {
    assert.ok(c.type === 'rotateAxis' && c.angle > 0);
    assert.ok(c.axis[2] > 0.98, `axis ${c.axis}`);
  }
  const got = sumAngle(r.cmds);
  assert.ok(Math.abs(got - total * GESTURE.rotateGain) < 0.15, `rotated ${got}`);
  assert.ok(r.out.some((f) => f.label === 'rotate'));
});

test('rotate: the axis follows the finger (clockwise = -z, tipping away from the user = -x)', () => {
  const cw = run((i) => {
    const a = 0.5 * ramp(i, 15, 45);
    return [L({ pinch: true }), R({ curl: POINT, indexDir: [-Math.sin(a), -Math.cos(a), 0] })];
  }, 60);
  assert.ok(cw.cmds.length > 3 && cw.cmds.every((c) => c.type === 'rotateAxis' && c.axis[2] < -0.98));

  const away = run((i) => {
    const a = 0.5 * ramp(i, 15, 45); // toward the camera = smaller z
    return [L({ pinch: true }), R({ curl: POINT, indexDir: [0, -Math.cos(a), -Math.sin(a)] })];
  }, 60);
  assert.ok(away.cmds.length > 3 && away.cmds.every((c) => c.type === 'rotateAxis' && c.axis[0] < -0.98));
});

test('rotate: no clutch, no rotation; releasing the pinch stops it at once', () => {
  const dir = (i: number): [number, number, number] => [Math.sin(0.02 * i), -Math.cos(0.02 * i), 0];
  assert.deepEqual(run((i) => [L(), R({ curl: POINT, indexDir: dir(i) })], 60).cmds, []);
  const r = run((i) => [L({ pinch: i < 30 }), R({ curl: POINT, indexDir: dir(i) })], 60);
  const before = sumAngle(r.cmds);
  assert.ok(before > 0.3 && before < 0.02 * 31 * GESTURE.rotateGain, `rotated ${before}`);
});

test('rotate: the clutch must be the LEFT hand and the finger the RIGHT hand', () => {
  const r = run((i) => [R({ pinch: true }), L({ curl: POINT, indexDir: [Math.sin(0.02 * i), -Math.cos(0.02 * i), 0] })], 60);
  assert.deepEqual(r.cmds, []);
});

test('rotate: a still finger emits nothing while clutched (dead zone), label shows the clutch', () => {
  const r = run(() => [L({ pinch: true }), R({ curl: POINT })], 40);
  assert.deepEqual(r.cmds, []);
  assert.equal(r.out.at(-1)!.label, 'rotate');
  assert.equal(run(() => [L({ pinch: true }), R()], 20).out.at(-1)!.label, 'clutch');
});

// ---------------- swipe ----------------
const swipeY = (i: number, from: number, to: number, start = 15, frames = 6) => from + (to - from) * ramp(i, start, start + frames);

test('swipe: a hard fast open-hand swipe up emits exactly one next; down emits prev', () => {
  const up = run((i) => [R({ at: [0.4, swipeY(i, 0.9, 0.4)] })], 60);
  assert.deepEqual(up.cmds, [{ type: 'next' }]);
  assert.ok(up.out.some((f) => f.label === 'next'));
  const down = run((i) => [R({ at: [0.4, swipeY(i, 0.4, 0.9)] })], 60);
  assert.deepEqual(down.cmds, [{ type: 'prev' }]);
});

test('swipe: the return stroke does not count', () => {
  const r = run((i) => [R({ at: [0.4, i < 24 ? swipeY(i, 0.9, 0.4) : swipeY(i, 0.4, 0.9, 24)] })], 70);
  assert.deepEqual(r.cmds, [{ type: 'next' }]);
});

test('swipe: ordinary movement, short flicks, fists and pointing hands never navigate', () => {
  assert.deepEqual(run((i) => [R({ at: [0.4, swipeY(i, 0.9, 0.4, 15, 30)] })], 70).cmds, []); // slow
  assert.deepEqual(run((i) => [R({ at: [0.4, swipeY(i, 0.7, 0.55, 15, 3)] })], 50).cmds, []); // short
  assert.deepEqual(run((i) => [R({ curl: 1, at: [0.4, swipeY(i, 0.9, 0.4)] })], 50).cmds, []); // fist
  assert.deepEqual(run((i) => [R({ curl: POINT, at: [0.4, swipeY(i, 0.9, 0.4)] })], 50).cmds, []); // pointing
});

// ---------------- home ----------------
test('home: both fists held about 0.7 s emit one home; shorter holds and single fists do nothing', () => {
  const fists = (n: number): Script => (i) => (i < n ? [L({ curl: 1 }), R({ curl: 1 })] : [L(), R()]);
  assert.deepEqual(run(fists(15), 60).cmds, []); // 0.5 s
  assert.deepEqual(run(fists(30), 60).cmds, [{ type: 'home' }]); // 1 s
  assert.deepEqual(run(fists(150), 160).cmds, [{ type: 'home' }]); // held 5 s: still one
  assert.deepEqual(run(() => [R({ curl: 1 })], 60).cmds, []);
  assert.deepEqual(run(() => [L({ curl: 1 }), R()], 60).cmds, []);
  const hold = run(fists(150), 12).out.at(-1)!;
  assert.equal(hold.label, 'fists');
  assert.ok(hold.hold > 0.2 && hold.hold < 1);
});

// ---------------- hysteresis / exclusivity ----------------
test('hysteresis: a pose must be held a few frames, and modes pass through none', () => {
  const blip = run((i) => (i >= 10 && i < 10 + GESTURE.enterFrames - 1 ? [R({ curl: POINT })] : []), 30);
  assert.ok(blip.out.every((f) => f.mode === 'none'));

  const r = run((i) => [R(i < 20 ? {} : { curl: POINT })], 40);
  const modes = r.out.map((f) => f.mode);
  assert.equal(modes[19], 'hand');
  const firstPoint = modes.indexOf('point');
  assert.ok(firstPoint > 20);
  assert.equal(modes[firstPoint - 1], 'none'); // released before the next one begins
  assert.deepEqual(r.cmds, []); // switching pose is not itself a gesture
});

test('hysteresis: one dropped tracking frame does not end a mode', () => {
  const r = run((i) => (i === 20 ? [] : [L({ curl: 1 }), R({ curl: 1 })]), 40);
  assert.deepEqual(r.cmds, [{ type: 'home' }]);
  assert.equal(r.out[21].mode, 'fists');
});

test('two open hands, or no hands, do nothing', () => {
  assert.deepEqual(run((i) => [L({ at: [0.7, 0.7 - 0.3 * ramp(i, 10, 16)] }), R({ at: [0.3, 0.7 - 0.3 * ramp(i, 10, 16)] })], 50).cmds, []);
  const none = run(() => [], 10);
  assert.deepEqual(none.cmds, []);
  assert.equal(none.out.at(-1)!.label, 'none');
});

test('overlay data: each hand reports the user side, pose and 21 filtered landmarks', () => {
  const f = run(() => [L({ pinch: true }), R({ curl: POINT })], 5).out.at(-1)!;
  assert.deepEqual(f.hands.map((h) => [h.side, h.pose, h.image.length]), [['left', 'pinch', 21], ['right', 'point', 21]]);
});
