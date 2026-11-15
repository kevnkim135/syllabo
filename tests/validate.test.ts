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

test('anatomy models: built-ins pass, composed parts are cleaned, a tube needs a path', () => {
  assert.ok(validate('visual', { kind: 'anatomy', title: 'Brain', model: 'brain', focus: ['Frontal lobe'] }));
  const v = validate('visual', {
    kind: 'anatomy', title: 'Plant cell',
    parts: [
      { name: 'Chloroplast', shape: 'ellipsoid', position: [1, 0, 0], size: [1, 0.5, 0.5], color: '#3f8f4e', surface: 'folded' },
      { name: 'Bad tube', shape: 'tube', position: [0, 0, 0], size: [0.1, 0, 0], color: '#000' }, // no path: dropped
      { name: 'Weird', shape: 'hexagon', position: [0, 0, 0], size: [1, 1, 1], color: '#000' }, // unknown shape: dropped
    ],
  });
  assert.ok(v && v.kind === 'anatomy' && v.parts?.length === 1 && v.parts[0].name === 'Chloroplast');
  assert.equal(validate('visual', { kind: 'anatomy', title: 'Nothing' }), undefined);
});
