import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Command } from '../src/core/commands';
import { createGestureInterpreter, GESTURE, type GestureFrame, type HandInput } from '../src/core/input/gestureEngine';
import { makeHand, type HandOptions } from '../src/core/input/syntheticHand';

const DT = 1000 / 30;
/** Selecting and carrying only exist while the sandbox is on screen. */
const sandboxTest = (name: string, fn: () => void) =>
  test(name, () => {
    GESTURE.directManipulation = true;
    try {
      fn();
    } finally {
      GESTURE.directManipulation = false;
    }
  });
type Script = (frame: number, tMs: number) => HandInput[];

/** Runs a scripted sequence at 30 fps through a fresh interpreter. */
function run(script: Script, frames: number) {
  const cmds: Command[] = []; // everything except the per-frame pointer and the press, which most tests do not care about
  const all: Command[] = [];
  const step = createGestureInterpreter((c) => (all.push(c), c.type !== 'pointer' && c.type !== 'press' && cmds.push(c)));
  const out: GestureFrame[] = [];
  for (let i = 0; i < frames; i++) out.push(step(script(i, i * DT), 1000 + i * DT));
  return { cmds, all, out, types: [...new Set(cmds.map((c) => c.type))] };
}
const ramp = (i: number, from: number, to: number) => Math.min(1, Math.max(0, (i - from) / (to - from)));
// The user's hands in a RAW frame: the right hand is on the image's left and MediaPipe calls it "Left".
const R = (o: HandOptions = {}): HandInput => makeHand({ at: [0.3, 0.7], label: 'Left', ...o });
const L = (o: HandOptions = {}): HandInput => makeHand({ at: [0.7, 0.7], label: 'Right', ...o });
const POINT: [number, number, number, number] = [0, 1, 1, 1];

// ---------------- zoom (three fingers: pinched together = in, spread apart = out) ----------------
const only = (cmds: Command[], type: Command['type']) => cmds.filter((c) => c.type === type);
const zooms = (cmds: Command[]) => cmds.flatMap((c) => (c.type === 'zoom' ? [c.factor] : []));
const product = (fs: number[]) => fs.reduce((a, b) => a * b, 1);
const RELAXED = { curl: 0.5, thumbCurl: 0.2 }; // neither open, nor a fist, nor a pinch: the neutral hand
const SPREAD3 = { curl: [0, 0, 1, 1] as [number, number, number, number], thumbCurl: 0 };

test('zoom: holding a three-finger pinch zooms in steadily, only after a short hold, and speeds up', () => {
  const r = run(() => [R({ gather: true })], 90); // 3 s
  assert.deepEqual(r.types, ['zoom']);
  const fs = zooms(r.cmds);
  assert.ok(fs.every((f) => f < 1), 'a three-finger pinch only ever zooms in');
  assert.ok(product(fs) < 0.25, `3 s of holding is a big zoom (${product(fs)})`);
  const firstAt = r.out.findIndex((f) => f.label === 'zoomIn');
  assert.ok(firstAt * DT >= GESTURE.zoomHoldMs, 'nothing happens during the hold delay');
  assert.ok(fs.at(-1)! < fs[0], 'the rate ramps up the longer it is held');
});

test('zoom: holding thumb, index and middle spread (ring and pinky folded) zooms out', () => {
  const r = run(() => [R(SPREAD3)], 60);
  assert.deepEqual(r.types, ['zoom']);
  assert.ok(zooms(r.cmds).every((f) => f > 1));
  assert.ok(r.out.some((f) => f.label === 'zoomOut'));
});

test('zoom: an open hand, a two-finger pinch and a peace sign never zoom', () => {
  assert.deepEqual(run(() => [R()], 60).cmds, []);
  assert.deepEqual(only(run(() => [R({ pinch: true })], 60).cmds, 'zoom'), []); // a two-finger pinch is the sandbox grab, never zoom
  assert.deepEqual(run(() => [R({ curl: [0, 0, 1, 1], thumbCurl: 1 })], 60).cmds, []);
});

test('zoom: letting go of the pinch never zooms back out (the old return-stroke problem)', () => {
  // pinch held, then the hand opens briefly as people do when letting go, then relaxes
  const r = run((i) => [R(i < 45 ? { gather: true } : i < 53 ? {} : RELAXED)], 90);
  const fs = zooms(r.cmds);
  assert.ok(fs.length > 5 && fs.every((f) => f < 1), 'only zoom-in steps, even while the hand relaxes');
});

test('zoom: a relaxed hand does nothing, and a moving hand pauses the zoom', () => {
  assert.deepEqual(run(() => [R(RELAXED)], 60).cmds, []);
  const moving = run((i) => [R({ gather: true, at: [0.15 + 0.6 * ramp(i, 0, 30), 0.7] })], 30); // about 0.8 frame heights/s
  assert.deepEqual(moving.cmds, [], 'travelling is not zooming');
});

test('zoom: switching from pinched to spread changes direction with a fresh hold', () => {
  const r = run((i) => [R(i < 40 ? { gather: true } : SPREAD3)], 100);
  const fs = zooms(r.cmds);
  const firstOut = fs.findIndex((f) => f > 1);
  assert.ok(firstOut > 0 && fs.slice(0, firstOut).every((f) => f < 1) && fs.slice(firstOut).every((f) => f > 1));
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

// ---------------- rotate (pinch clutch + the other fingertip draws circles) ----------------
const sumAngle = (cmds: Command[]) => cmds.reduce((s, c) => s + (c.type === 'rotateAxis' ? c.angle : 0), 0);
type V3 = [number, number, number];

/** A pointing hand whose wrist sits at view position P (metres; z = distance from the camera). */
function handAt(P: V3, o: HandOptions = {}): HandOptions {
  const s = GESTURE.focal / P[2]; // frame heights per metre at that distance
  return { curl: POINT, ...o, scale: s, at: [0.5 + (-P[0] * s) / GESTURE.aspect, 0.5 + -P[1] * s] };
}
const D0 = 0.5; // half a metre from the camera
const RAD = 0.07;
const PLANES: Record<string, (t: number) => V3> = {
  level: (t) => [RAD * Math.cos(t), 0, D0 + RAD * Math.sin(t)], // same height, toward and away from the camera
  depth: (t) => [0, RAD * Math.cos(t), D0 + RAD * Math.sin(t)], // up and down, toward and away from the camera
  screen: (t) => [RAD * Math.cos(t), RAD * Math.sin(t), D0], // flat to the screen
};
/** Clutch with one hand while the other draws `turns` circles in `plane` (one circle per second). */
const circling = (plane: keyof typeof PLANES, dir = 1, steer = R, clutch = L, turns = 2) => (i: number) => {
  const t = dir * 2 * Math.PI * Math.min(turns, Math.max(0, i - 10) / 30);
  return [clutch({ pinch: true }), steer(handAt(PLANES[plane](t)))];
};
const axesOf = (cmds: Command[]) => cmds.flatMap((c) => (c.type === 'rotateAxis' ? [c.axis] : []));

test('rotate: a circle at one height spins only about the vertical axis', () => {
  const r = run(circling('level'), 80);
  assert.deepEqual(r.types, ['rotateAxis']);
  assert.ok(axesOf(r.cmds).every((a) => Math.abs(a[1]) === 1 && a[0] === 0 && a[2] === 0), 'vertical axis only');
  assert.ok(r.out.some((f) => f.label === 'rotate'));
});

test('rotate: a circle toward and away from the camera spins about the horizontal axis', () => {
  const r = run(circling('depth'), 80);
  assert.deepEqual(r.types, ['rotateAxis']);
  assert.ok(axesOf(r.cmds).every((a) => Math.abs(a[0]) === 1 && a[1] === 0 && a[2] === 0), 'horizontal axis only');
});

test('rotate: a circle flat to the screen spins about the axis out of the screen, in the same direction', () => {
  const ccw = run(circling('screen', 1), 80);
  assert.ok(ccw.cmds.length > 10 && axesOf(ccw.cmds).every((a) => a[2] === 1), 'counter-clockwise as the user sees it = +z');
  const cw = run(circling('screen', -1), 80);
  assert.ok(cw.cmds.length > 10 && axesOf(cw.cmds).every((a) => a[2] === -1), 'clockwise = -z');
});

test('rotate: one circle of the fingertip spins the model about one turn', () => {
  const r = run(circling('screen', 1, R, L, 3), 120); // three circles
  const got = sumAngle(r.cmds) / (2 * Math.PI * GESTURE.rotateGain);
  assert.ok(got > 2.5 && got < 3.05, `turned ${got.toFixed(2)} times for 3 circles`);
});

test('rotate: noisy depth from the camera does not tip the axis', () => {
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5) * 2;
  const r = run((i) => {
    const t = 2 * Math.PI * Math.max(0, i - 10) / 30;
    const [x, y, z] = PLANES.screen(t);
    return [L({ pinch: true }), R(handAt([x + 0.003 * rand(), y + 0.003 * rand(), z + 0.015 * rand()]))];
  }, 80);
  assert.ok(r.cmds.length > 10 && axesOf(r.cmds).every((a) => a[2] === 1), `axes ${JSON.stringify(axesOf(r.cmds).slice(0, 3))}`);
});

test('rotate: either hand can be the clutch', () => {
  const r = run(circling('screen', 1, L, R), 80);
  assert.ok(r.cmds.length > 10 && axesOf(r.cmds).every((a) => a[2] === 1));
});

test('rotate: no clutch, a still finger, back-and-forth motion or tiny jitter circles do nothing', () => {
  assert.deepEqual(run((i) => [L(), R(handAt(PLANES.screen(2 * Math.PI * i / 30)))], 80).cmds, []); // no clutch
  assert.deepEqual(run(() => [L({ pinch: true }), R(handAt([0, 0, D0]))], 60).cmds, []); // still
  assert.deepEqual(run((i) => [L({ pinch: true }), R(handAt([0.08 * Math.sin(i / 4), 0, D0]))], 80).cmds, []); // wag
  assert.deepEqual(run((i) => [L({ pinch: true }), R(handAt([0.004 * Math.cos(i / 3), 0.004 * Math.sin(i / 3), D0]))], 80).cmds, []); // jitter
});

test('rotate: once rotating, a bending steering finger does not drop the rotation', () => {
  const r = run((i) => {
    const t = 2 * Math.PI * Math.min(2, Math.max(0, i - 10) / 30);
    const curl: [number, number, number, number] = [0.45 * ramp(i, 25, 35), 1, 1, 1];
    return [L({ pinch: true }), R(handAt(PLANES.screen(t), { curl }))];
  }, 80);
  assert.ok(sumAngle(r.cmds) > 2 * Math.PI * 1.5 * GESTURE.rotateGain, `turned ${sumAngle(r.cmds)}`);
});

test('rotate: label shows the clutch until the other hand points', () => {
  assert.equal(run(() => [L({ pinch: true }), R({ curl: 1 })], 20).out.at(-1)!.label, 'clutch');
});

// ---------------- swipe (sideways: flick through this lesson's models) ----------------
// Raw image x grows toward the USER's left, so a swipe to the user's left is increasing x.
const swipeX = (i: number, from: number, to: number, start = 15, frames = 6) => from + (to - from) * ramp(i, start, start + frames);

test('swipe: a hard fast swipe to the left shows the next model, to the right the previous one', () => {
  const left = run((i) => [R({ at: [swipeX(i, 0.25, 0.75), 0.6] })], 60);
  assert.deepEqual(left.cmds, [{ type: 'modelStep', step: 1 }]);
  assert.ok(left.out.some((f) => f.label === 'modelNext'));
  const right = run((i) => [R({ at: [swipeX(i, 0.75, 0.25), 0.6] })], 60);
  assert.deepEqual(right.cmds, [{ type: 'modelStep', step: -1 }]);
});

test('swipe: up and down no longer do anything (saved for something else)', () => {
  assert.deepEqual(run((i) => [R({ at: [0.4, 0.9 - 0.5 * ramp(i, 15, 21)] })], 60).cmds, []);
  assert.deepEqual(run((i) => [R({ at: [0.4, 0.4 + 0.5 * ramp(i, 15, 21)] })], 60).cmds, []);
});

test('swipe: the return stroke does not count', () => {
  const r = run((i) => [R({ at: [i < 24 ? swipeX(i, 0.25, 0.75) : swipeX(i, 0.75, 0.25, 24), 0.6] })], 70);
  assert.deepEqual(r.cmds, [{ type: 'modelStep', step: 1 }]);
});

test('swipe: slow drifts, short flicks, fists and pointing hands never flip models', () => {
  assert.deepEqual(run((i) => [R({ at: [swipeX(i, 0.25, 0.75, 15, 30), 0.6] })], 70).cmds, []); // slow
  assert.deepEqual(run((i) => [R({ at: [swipeX(i, 0.4, 0.52, 15, 3), 0.6] })], 50).cmds, []); // short
  assert.deepEqual(run((i) => [R({ curl: 1, at: [swipeX(i, 0.25, 0.75), 0.6] })], 50).cmds, []); // fist
  assert.deepEqual(run((i) => [R({ curl: POINT, at: [swipeX(i, 0.25, 0.75), 0.6] })], 50).cmds, []); // pointing
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
  assert.deepEqual(r.types.filter((t) => t !== 'zoom'), []); // switching pose is not itself a gesture
  assert.ok(zooms(r.cmds).every((f) => f < 1)); // only the open hand's own hold-zoom
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

// ---------------- direct manipulation (sandbox): point, then close a fist ----------------
const FIST = { curl: 1 };

sandboxTest('pointer: a pointing hand drives a mirrored screen pointer, hidden when it goes', () => {
  const r = run((i) => (i < 20 ? [R({ curl: POINT, at: [0.3, 0.6] })] : []), 40);
  const ps = only(r.all, 'pointer') as Extract<Command, { type: 'pointer' }>[];
  assert.ok(ps.length > 10 && ps[0].visible && ps[0].x > 0.5, 'raw image left = user right = screen right after mirroring');
  assert.deepEqual(ps.at(-1), { type: 'pointer', hand: 'right', x: 0, y: 0, visible: false });
});

sandboxTest('fist: closing the hand presses (selects) at once; a quick close and open is a click', () => {
  const r = run((i) => [R(i >= 10 && i < 15 ? FIST : { curl: POINT })], 40);
  assert.equal(only(r.all, 'press').length, 1);
  assert.deepEqual(only(r.cmds, 'tap'), [{ type: 'tap', hand: 'right' }]);
  assert.deepEqual(only(r.cmds, 'grab'), []);
});

sandboxTest('fist: held, it carries (start, moves, end) and lets go only when the hand opens', () => {
  const r = run((i) => [R(i >= 10 && i < 50 ? { ...FIST, at: [0.4 - 0.2 * ramp(i, 20, 40), 0.6] } : {})], 70);
  const g = only(r.cmds, 'grab') as Extract<Command, { type: 'grab' }>[];
  assert.equal(g[0].phase, 'start');
  assert.equal(g.at(-1)!.phase, 'end');
  const dx = g.filter((x) => x.phase === 'move').reduce((sum, x) => sum + x.dx, 0);
  assert.ok(dx > 0.1, `carried ${dx} to the user's right`);
});

sandboxTest('fist: a carried object survives half-open frames, a lost frame and the hand leaving the camera briefly', () => {
  const r = run((i) => {
    if (i === 30 || (i >= 40 && i < 60)) return [];
    if (i >= 20 && i < 23) return [R({ curl: 0.55 })]; // blurry, half-curled
    return [R(i < 80 ? { ...FIST, at: [0.3 + 0.003 * i, 0.6] } : {})];
  }, 100);
  const g = (only(r.cmds, 'grab') as Extract<Command, { type: 'grab' }>[]).filter((x) => x.phase !== 'move');
  assert.deepEqual(g.map((x) => x.phase), ['start', 'end']);
});

sandboxTest('fists: each hand carries its own object; two fists are never "home" in the sandbox', () => {
  const r = run((i) => [L({ ...FIST, at: [0.7 - 0.15 * ramp(i, 20, 40), 0.6] }), R({ ...FIST, at: [0.3 + 0.15 * ramp(i, 20, 40), 0.6] })], 60);
  const g = only(r.cmds, 'grab') as Extract<Command, { type: 'grab' }>[];
  for (const hand of ['left', 'right'] as const) {
    const mine = g.filter((x) => x.hand === hand);
    const dx = mine.filter((x) => x.phase === 'move').reduce((sum, x) => sum + x.dx, 0);
    assert.equal(mine[0]?.phase, 'start');
    assert.ok(hand === 'left' ? dx > 0.1 : dx < -0.1, `${hand} moved ${dx}`);
  }
  assert.deepEqual(only(r.cmds, 'home'), []);
});

sandboxTest('depth: moving the fist toward the camera pushes the object away, pulling back brings it closer', () => {
  const toward = run((i) => [R({ ...FIST, at: [0.35, 0.6], scale: 1.8 + 0.8 * ramp(i, 15, 35) })], 50);
  const dzT = (only(toward.cmds, 'grab') as Extract<Command, { type: 'grab' }>[]).reduce((sum, g) => sum + g.dz, 0);
  assert.ok(dzT < -1, `toward the camera: ${dzT.toFixed(2)}`);
  const back = run((i) => [R({ ...FIST, at: [0.35, 0.6], scale: 2.6 - 0.8 * ramp(i, 15, 35) })], 50);
  const dzB = (only(back.cmds, 'grab') as Extract<Command, { type: 'grab' }>[]).reduce((sum, g) => sum + g.dz, 0);
  assert.ok(dzB > 1, `away from the camera: ${dzB.toFixed(2)}`);
});

sandboxTest('aim: closing the fist does not shift where you were pointing', () => {
  const r = run((i) => [R(i < 25 ? { curl: POINT, at: [0.35, 0.6] } : { ...FIST, at: [0.35, 0.6] })], 34);
  const ps = only(r.all, 'pointer') as Extract<Command, { type: 'pointer' }>[];
  assert.ok(ps.length > 25);
  const before = ps[22];
  const shift = Math.max(...ps.slice(27).map((p) => Math.hypot(p.x - before.x, p.y - before.y)));
  assert.ok(shift < 0.01, `aim moved ${shift.toFixed(3)} of the screen`);
});

sandboxTest('open hands: one open hand swipes (sandboxes), both hands open (held) report for deselecting all', () => {
  const swipe = run((i) => [R({ at: [0.25 + 0.5 * ramp(i, 15, 21), 0.6] })], 40);
  assert.deepEqual(only(swipe.cmds, 'modelStep'), [{ type: 'modelStep', step: 1 }]);
  const both = run(() => [L({}), R({})], 20);
  assert.equal(only(both.cmds, 'openHand').length, 2, 'each hand reports its own opening');
  assert.equal(only(both.cmds, 'openBoth').length, 1, 'both open together: one deselect-all');
  // relaxed (not dead-straight) hands, the second raised a moment after the first: still one deselect-all
  const loose = { curl: 0.15, thumbCurl: 0.1 };
  const late = run((i) => (i < 12 ? [L(loose)] : [L(loose), R(loose)]), 40);
  assert.equal(only(late.cmds, 'openBoth').length, 1);
  assert.equal(only(run(() => [L({})], 30).cmds, 'openBoth').length, 0, 'one open hand never deselects all');
});

sandboxTest('sandbox: no zoom or twirl, and a fist holding while the other hand circles turns the held object', () => {
  assert.deepEqual(only(run(() => [R({ gather: true })], 60).cmds, 'zoom'), [], 'no hold-zoom in the sandbox');
  assert.deepEqual(only(run((i) => [R({ curl: POINT, at: twirl(i, 10) })], 100).cmds, 'newExample'), [], 'no twirl');
  const r = run((i) => {
    const t = 2 * Math.PI * Math.min(2, Math.max(0, i - 10) / 30);
    return [L(FIST), R(handAt(PLANES.screen(t)))];
  }, 80);
  const rot = only(r.cmds, 'rotateAxis') as Extract<Command, { type: 'rotateAxis' }>[];
  assert.ok(rot.length > 10 && rot.every((c) => c.hand === 'left'), 'the fist is the holding hand');
});

test('scale: both hands pinching and spreading grows the selection', () => {
  const r = run((i) => [L({ pinch: true, at: [0.65 + 0.15 * ramp(i, 10, 40), 0.6] }), R({ pinch: true, at: [0.35 - 0.15 * ramp(i, 10, 40), 0.6] })], 50);
  const f = (only(r.cmds, 'scaleSel') as Extract<Command, { type: 'scaleSel' }>[]).reduce((p, c) => p * c.factor, 1);
  assert.ok(f > 1.3, `scaled ${f}`);
  assert.deepEqual(only(r.cmds, 'rotateAxis'), []);
});

test('a three-finger pinch zooms and never selects or drags', () => {
  const r = run(() => [R({ gather: true })], 60);
  assert.deepEqual(only(r.all, 'tap'), []);
  assert.deepEqual(only(r.all, 'grab'), []);
  assert.ok(only(r.cmds, 'zoom').length > 5);
});

test('model view: pointing and pinching never select or carry, and never block zoom or rotate', () => {
  const r = run((i) => [R(i < 15 ? { curl: POINT } : { pinch: true, at: [0.3 + 0.005 * i, 0.6] })], 50);
  for (const t of ['pointer', 'press', 'tap', 'grab'] as const) assert.deepEqual(only(r.all, t), [], `no ${t} outside the sandbox`);
  assert.ok(only(run(() => [R({ gather: true })], 60).cmds, 'zoom').length > 5, 'three-finger zoom still works');
  assert.ok(only(run(circling('screen'), 80).cmds, 'rotateAxis').length > 10, 'two-hand rotate still works');
});
