import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validate } from '../server/validate';

const p = (extra: object) => ({ prompt: 'q', solution: 's', difficulty: 'core', ...extra });

test('problem topic is kept only when it matches an explored topic', () => {
  const out = validate('problems', [p({ topic: 'chain rule' }), p({ topic: 'invented topic' }), p({})], ['Chain Rule', 'Limits'])!;
  assert.equal(out[0].topic, 'Chain Rule'); // normalized to the explored spelling
  assert.equal(out[1].topic, undefined);
  assert.equal(out[2].topic, undefined);
});

test('unknown difficulty falls back to core; invalid problems are dropped', () => {
  const out = validate('problems', [p({ difficulty: 'weird' }), { prompt: 'no solution' }])!;
  assert.equal(out.length, 1);
  assert.equal(out[0].difficulty, 'core');
});

test('surface with an expression that is not a real-valued f(x, y) is rejected', () => {
  assert.equal(validate('visual', { kind: 'surface', title: 't', expr: 'foo(', xRange: [0, 1], yRange: [0, 1] }), undefined);
  assert.ok(validate('visual', { kind: 'surface', title: 't', expr: 'x^2 - y^2', xRange: [-1, 1], yRange: [-1, 1] }));
});
