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

test('LaTeX with single backslashes in JSON is recovered, not thrown away', async () => {
  const { extractJson } = await import('../server/llm');
  const { repairLatex } = await import('../server/validate');
  const raw = '{"a": "$\\sqrt{2} \\cdot \\alpha$", "b": "$\\frac{1}{2}$", "c": "line\\nbreak", "d": "$\\\\pi$"}';
  const v = extractJson(raw) as Record<string, string>;
  assert.equal(v.a, '$\\sqrt{2} \\cdot \\alpha$');
  assert.equal(repairLatex(v.b), '$\\frac{1}{2}$');
  assert.equal(v.c, 'line\nbreak');
  assert.equal(v.d, '$\\pi$');
});

test('network models: built-ins pass, composed networks are cleaned, dangling edges dropped', async () => {
  const builtin = validate('visual', { kind: 'network', title: 'LLM', model: 'transformer', focus: ['Self-attention'] });
  assert.equal(builtin?.kind, 'network');
  const made = validate('visual', {
    kind: 'network', title: 'Autoencoder', layout: 'layers',
    groups: [{ name: 'Encoder', info: 'compresses' }, { name: 'Decoder' }],
    nodes: [{ id: 'a', group: 'Encoder', shape: 'neuron', value: 3 }, { id: 'a', group: 'Encoder' }, { id: 'b', group: 'Decoder', shape: 'nonsense' }, { nope: 1 }],
    edges: [{ a: 'a', b: 'b', weight: -5, kind: 'flow' }, { from: 'a', to: 'b' }, { a: 'a', b: 'ghost' }],
  });
  assert.ok(made && made.kind === 'network');
  assert.deepEqual(made.nodes?.map((n) => n.id), ['a', 'b'], 'duplicate and malformed nodes dropped');
  assert.equal(made.nodes?.[0].value, 1);
  assert.equal(made.nodes?.[1].shape, undefined);
  assert.equal(made.edges?.length, 2, 'the edge to a missing node is dropped');
  assert.equal(made.edges?.[0].weight, -1);
  assert.equal(validate('visual', { kind: 'network', title: 'Empty', nodes: [{ id: 'x' }] }), undefined, 'needs a built-in or at least two nodes');
});

test('built-in networks are well formed and every node gets a place', async () => {
  const { NETWORK_MODELS } = await import('../shared/types');
  const { builtinNetwork, partOf } = await import('../src/ui/visual/network/builtins');
  const { layoutNetwork } = await import('../src/ui/visual/network/layout');
  for (const model of NETWORK_MODELS) {
    const net = builtinNetwork(model);
    const ids = new Set(net.nodes.map((n) => n.id));
    assert.equal(ids.size, net.nodes.length, `${model}: unique ids`);
    for (const e of net.edges) assert.ok(ids.has(e.a) && ids.has(e.b), `${model}: edge ${e.a}-${e.b} joins real nodes`);
    const groups = new Set(net.groups.map((g) => g.name));
    for (const n of net.nodes) assert.ok(groups.has(partOf(n)), `${model}: node ${n.id} belongs to a described part`);
    const pos = layoutNetwork(net);
    for (const n of net.nodes) {
      const p = pos.get(n.id);
      assert.ok(p && p.every((v) => Number.isFinite(v) && Math.abs(v) < 8), `${model}: node ${n.id} placed in view`);
    }
    // no two units on top of each other
    const pts = net.nodes.filter((n) => n.shape !== 'block').map((n) => pos.get(n.id)!);
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) assert.ok(Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1], pts[i][2] - pts[j][2]) > 0.3, `${model}: nodes overlap`);
  }
});

test('the sandbox lab follows the subject: physics, chemistry, or neither', async () => {
  const { labOf } = await import('../shared/lab');
  assert.equal(labOf('Physics'), 'physics');
  assert.equal(labOf('Projectile motion'), 'physics');
  assert.equal(labOf('Organic chemistry'), 'chemistry');
  assert.equal(labOf('Acids and bases'), 'chemistry');
  for (const s of ['Neural networks', 'Large language models', 'World War II', 'Cell biology', 'Linear algebra', 'Databases', 'Psychology']) assert.equal(labOf(s), 'none', s);
  assert.equal(labOf('Science', null, 'physics'), 'physics', 'the model\'s classification is used');
  assert.equal(labOf('Biology', 'Enzyme reaction rates'), 'chemistry', 'a clearly chemical focus wins');
  assert.equal(labOf('Machine learning', null, 'none'), 'none');
});
