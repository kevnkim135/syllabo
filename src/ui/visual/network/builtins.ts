import type { NetEdge, NetGroup, NetLayout, NetNode, NetworkModel, NetworkSpec } from '../../../../shared/types';

export interface Net {
  layout: NetLayout;
  groups: NetGroup[];
  nodes: NetNode[];
  edges: NetEdge[];
}

export const NET_COLORS = { input: '#4f8fe8', hidden: '#8b6bd6', output: '#e2783c', attention: '#d9499a', dense: '#e9a923', stack: '#6a5acd', neutral: '#8a8fa3' };
const C = NET_COLORS;

/** Deterministic pseudo-random number in 0..1 from a string, so a model looks the same every time. */
export function hash01(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  h ^= h >>> 13;
  h = Math.imul(h, 0x5bd1e995);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967295;
}
const w = (a: string, b: string) => +(hash01(`${a}>${b}`) * 2 - 1).toFixed(2);
const spread = (n: number, i: number, gap: number) => (i - (n - 1) / 2) * gap;

/** A feed-forward network: every neuron in one layer feeds every neuron in the next. */
function neuralNetwork(): Net {
  const layers: [string, string, number, string[]?][] = [
    ['Input layer', C.input, 4, ['x₁', 'x₂', 'x₃', 'x₄']],
    ['Hidden layer 1', C.hidden, 6],
    ['Hidden layer 2', C.hidden, 6],
    ['Output layer', C.output, 3, ['cat 82%', 'dog 13%', 'bird 5%']],
  ];
  const out = [0.82, 0.13, 0.05];
  const nodes: NetNode[] = [];
  const edges: NetEdge[] = [];
  layers.forEach(([group, color, n, labels], li) => {
    for (let i = 0; i < n; i++) {
      const id = `n${li}_${i}`;
      nodes.push({ id, group, color, shape: 'neuron', label: labels?.[i], value: li === 3 ? out[i] : 0.25 + 0.75 * hash01(id) });
      if (li > 0) for (let j = 0; j < layers[li - 1][2]; j++) edges.push({ a: `n${li - 1}_${j}`, b: id, weight: w(`n${li - 1}_${j}`, id), kind: 'flow' });
    }
  });
  return {
    layout: 'layers',
    groups: [
      { name: 'Input layer', color: C.input, info: 'One neuron per input feature (a pixel, a measurement, a word score). It only passes the numbers in.' },
      { name: 'Hidden layer 1', color: C.hidden, info: 'Each neuron takes a weighted sum of all inputs, adds a bias and applies an activation such as ReLU. It learns simple patterns.' },
      { name: 'Hidden layer 2', color: C.hidden, info: 'Combines the simple patterns from the layer before into more abstract features. Deeper layers build on shallower ones.' },
      { name: 'Output layer', color: C.output, info: 'One neuron per answer. Softmax turns the scores into probabilities; the brightest neuron is the prediction.' },
    ],
    nodes,
    edges,
  };
}

/** One layer of a language model (a transformer) predicting the next word, drawn bottom to top. */
function transformer(): Net {
  const words = ['The', 'cat', 'sat', 'on', 'the'];
  const attention = [0.08, 0.5, 0.27, 0.1, 0.05]; // how much the last position looks at each word
  const next: [string, number][] = [['mat', 0.62], ['floor', 0.21], ['sofa', 0.09], ['roof', 0.05], ['moon', 0.03]];
  const nodes: NetNode[] = [];
  const edges: NetEdge[] = [];
  const n = words.length;
  const last = n - 1;
  nodes.push({ id: 'attBlock', group: 'Self-attention', shape: 'block', label: 'Self-attention', color: C.attention, size: [9, 1.3, 1.3], pos: [0, -0.8, 0] });
  nodes.push({ id: 'ffBlock', group: 'Feed-forward network', shape: 'block', label: 'Feed-forward network', color: C.dense, size: [9, 0.9, 1.3], pos: [0, 0.75, 0] });
  nodes.push({ id: 'stack', group: 'Stacked layers', shape: 'block', label: '× 12 more layers like this', color: C.stack, size: [9, 0.5, 1.3], pos: [0, 1.85, 0] });
  words.forEach((word, i) => {
    const x = spread(n, i, 1.7);
    nodes.push({ id: `tok${i}`, group: 'Input tokens', shape: 'token', label: word, color: C.input, pos: [x, -3.5, 0] });
    nodes.push({ id: `emb${i}`, group: 'Embeddings', shape: 'grid', color: C.hidden, size: [1.25, 0.3, 0.08], pos: [x, -2.45, 0] });
    nodes.push({ id: `att${i}`, group: 'Self-attention', shape: 'neuron', color: C.attention, value: 0.3 + attention[i], pos: [x, -0.8, 0] });
    nodes.push({ id: `ff${i}`, group: 'Feed-forward network', shape: 'neuron', color: C.dense, value: 0.35 + 0.6 * hash01(`ff${i}`), pos: [x, 0.75, 0] });
    edges.push({ a: `tok${i}`, b: `emb${i}`, kind: 'flow', weight: 0.6 }, { a: `emb${i}`, b: `att${i}`, kind: 'flow', weight: 0.6 }, { a: `att${i}`, b: `ff${i}`, kind: 'flow', weight: 0.6 });
    edges.push({ a: `emb${i}`, b: `ff${i}`, kind: 'skip', weight: 0.35 });
    if (i !== last) edges.push({ a: `att${i}`, b: `att${last}`, kind: 'attention', weight: attention[i], label: `${Math.round(attention[i] * 100)}%` });
  });
  edges.push({ a: `ff${last}`, b: 'stack', kind: 'flow', weight: 0.8 });
  next.forEach(([word, p], i) => {
    nodes.push({ id: `out${i}`, group: 'Next-token probabilities', shape: 'bar', label: `${word} ${Math.round(p * 100)}%`, color: C.output, value: p, pos: [spread(next.length, i, 1.5), 2.75, 0] });
    edges.push({ a: 'stack', b: `out${i}`, kind: 'flow', weight: 0.25 + p });
  });
  return {
    layout: 'layers',
    groups: [
      { name: 'Input tokens', color: C.input, info: 'The prompt is cut into tokens (words or word pieces). Here: "The cat sat on the", and the model must guess what comes next.' },
      { name: 'Embeddings', color: C.hidden, info: 'Each token becomes a long vector of numbers that encodes its meaning, plus its position in the sentence.' },
      { name: 'Self-attention', color: C.attention, info: 'Every position looks at every other one and decides how much each matters. To predict the next word, the last position attends mostly to "cat" and "sat". The grey arcs are residual connections that carry the original signal past the block.' },
      { name: 'Feed-forward network', color: C.dense, info: 'A small neural network applied to each position separately. It transforms what attention gathered into richer features.' },
      { name: 'Stacked layers', color: C.stack, info: 'Attention plus feed-forward is one layer. Large language models repeat it dozens of times; each layer refines the representation.' },
      { name: 'Next-token probabilities', color: C.output, info: 'The final vector becomes a probability for every token in the vocabulary. The model samples one ("mat"), appends it and repeats.' },
    ],
    nodes,
    edges,
  };
}

/** A convolutional network classifying an image: the image shrinks into stacks of feature maps, then a decision. */
function cnn(): Net {
  const nodes: NetNode[] = [{ id: 'img', group: 'Input image', shape: 'grid', label: 'Input image', color: C.input, size: [2.3, 2.3, 0.08], pos: [-5, 0, 0] }];
  const edges: NetEdge[] = [];
  const maps = 4;
  for (let i = 0; i < maps; i++) {
    const z = spread(maps, i, 0.55);
    const lift = spread(maps, i, 0.16);
    nodes.push({ id: `conv${i}`, group: 'Convolution', shape: 'grid', label: i === maps - 1 ? 'Feature maps' : undefined, color: C.hidden, size: [1.7, 1.7, 0.06], pos: [-2.4 + lift, lift, z] });
    nodes.push({ id: `pool${i}`, group: 'Pooling', shape: 'grid', label: i === maps - 1 ? 'Pooled maps' : undefined, color: C.attention, size: [1, 1, 0.06], pos: [-0.2 + lift, lift, z] });
    edges.push({ a: 'img', b: `conv${i}`, kind: 'flow', weight: 0.5 }, { a: `conv${i}`, b: `pool${i}`, kind: 'flow', weight: 0.5 });
  }
  const dense = 6;
  const classes: [string, number][] = [['cat 91%', 0.91], ['dog 7%', 0.07], ['bird 2%', 0.02]];
  for (let j = 0; j < dense; j++) {
    nodes.push({ id: `fc${j}`, group: 'Fully connected', shape: 'neuron', color: C.dense, value: 0.3 + 0.7 * hash01(`fc${j}`), pos: [2.1, spread(dense, j, 0.8), 0] });
    for (let i = 0; i < maps; i++) edges.push({ a: `pool${i}`, b: `fc${j}`, kind: 'flow', weight: w(`pool${i}`, `fc${j}`) });
  }
  classes.forEach(([label, p], k) => {
    nodes.push({ id: `cls${k}`, group: 'Output classes', shape: 'neuron', label, color: C.output, value: p, pos: [4.3, -spread(classes.length, k, 1.3), 0] });
    for (let j = 0; j < dense; j++) edges.push({ a: `fc${j}`, b: `cls${k}`, kind: 'flow', weight: w(`fc${j}`, `cls${k}`) });
  });
  return {
    layout: 'layers',
    groups: [
      { name: 'Input image', color: C.input, info: 'The picture as a grid of pixel values. Nothing is learned here.' },
      { name: 'Convolution', color: C.hidden, info: 'Small filters slide across the image. Each produces a feature map that lights up where its pattern (an edge, a corner, a texture) appears.' },
      { name: 'Pooling', color: C.attention, info: 'Each feature map is shrunk by keeping only the strongest response in every small patch, so the network cares about what is there more than exactly where.' },
      { name: 'Fully connected', color: C.dense, info: 'The pooled maps are flattened into one list and combined by ordinary neurons to weigh the evidence.' },
      { name: 'Output classes', color: C.output, info: 'One neuron per label. Softmax gives probabilities; the brightest is the answer.' },
    ],
    nodes,
    edges,
  };
}

/** A recurrent network unrolled over time: the hidden state carries memory from word to word. */
function rnn(): Net {
  const words = ['I', 'love', 'deep', 'learning'];
  const nodes: NetNode[] = [];
  const edges: NetEdge[] = [];
  words.forEach((word, t) => {
    const x = spread(words.length, t, 2.5);
    nodes.push({ id: `x${t}`, group: 'Inputs over time', shape: 'token', label: word, color: C.input, pos: [x, -2.4, 0] });
    nodes.push({ id: `h${t}`, group: 'Hidden state', shape: 'neuron', label: `h${'₁₂₃₄'[t]}`, color: C.hidden, value: 0.4 + 0.15 * t, pos: [x, 0, 0] });
    nodes.push({ id: `y${t}`, group: 'Outputs', shape: 'token', label: `ŷ${'₁₂₃₄'[t]}`, color: C.output, pos: [x, 2.4, 0] });
    edges.push({ a: `x${t}`, b: `h${t}`, kind: 'flow', weight: 0.6 }, { a: `h${t}`, b: `y${t}`, kind: 'flow', weight: 0.6 });
    if (t) edges.push({ a: `h${t - 1}`, b: `h${t}`, kind: 'flow', weight: 0.95, label: 'memory' });
  });
  return {
    layout: 'layers',
    groups: [
      { name: 'Inputs over time', color: C.input, info: 'The sequence arrives one item per time step (a word, a sound frame, a stock price).' },
      { name: 'Hidden state', color: C.hidden, info: 'The same neurons are reused at every step. Each step mixes the new input with the previous hidden state, which is the network\'s memory of what came before.' },
      { name: 'Outputs', color: C.output, info: 'A prediction at each step, for example the next word. Training compares these with the right answers and sends the error back through time.' },
    ],
    nodes,
    edges,
  };
}

/** A small decision tree classifying iris flowers. */
function decisionTree(): Net {
  return {
    layout: 'tree',
    groups: [
      { name: 'Decision nodes', color: C.hidden, info: 'Each asks one yes / no question about a feature, chosen during training to split the data as cleanly as possible.' },
      { name: 'Leaves', color: C.output, info: 'Where a path ends: the predicted class. A new flower follows the answers from the root down to a leaf.' },
    ],
    nodes: [
      { id: 'root', group: 'Decision nodes', shape: 'token', label: 'Petal length < 2.5 cm?', color: C.hidden },
      { id: 'setosa', group: 'Leaves', shape: 'token', label: 'Setosa', color: C.output },
      { id: 'width', group: 'Decision nodes', shape: 'token', label: 'Petal width < 1.8 cm?', color: C.hidden },
      { id: 'length', group: 'Decision nodes', shape: 'token', label: 'Petal length < 4.9 cm?', color: C.hidden },
      { id: 'virginica', group: 'Leaves', shape: 'token', label: 'Virginica', color: C.output },
      { id: 'versicolor', group: 'Leaves', shape: 'token', label: 'Versicolor', color: C.output },
      { id: 'virginica2', group: 'Leaves', shape: 'token', label: 'Virginica', color: C.output },
    ],
    edges: [
      { a: 'root', b: 'setosa', label: 'yes', kind: 'flow', weight: 0.7 },
      { a: 'root', b: 'width', label: 'no', kind: 'flow', weight: 0.7 },
      { a: 'width', b: 'length', label: 'yes', kind: 'flow', weight: 0.7 },
      { a: 'width', b: 'virginica', label: 'no', kind: 'flow', weight: 0.7 },
      { a: 'length', b: 'versicolor', label: 'yes', kind: 'flow', weight: 0.7 },
      { a: 'length', b: 'virginica2', label: 'no', kind: 'flow', weight: 0.7 },
    ],
  };
}

/** A weighted graph with its shortest path from A to F marked. */
function graph(): Net {
  const path = new Set(['A', 'C', 'E', 'F']);
  const links: [string, string, number][] = [['A', 'B', 7], ['A', 'C', 2], ['B', 'D', 3], ['C', 'B', 4], ['C', 'E', 3], ['D', 'F', 6], ['E', 'D', 5], ['E', 'F', 4], ['B', 'G', 8], ['G', 'F', 2]];
  return {
    layout: 'graph',
    groups: [
      { name: 'Shortest path A to F', color: C.output, info: 'A → C → E → F costs 2 + 3 + 4 = 9, the cheapest route. Dijkstra\'s algorithm finds it by always expanding the closest unvisited vertex.' },
      { name: 'Other vertices', color: C.hidden, info: 'A vertex (node) is a thing; an edge is a connection between two of them. The number on an edge is its weight: a distance, a cost or a time.' },
    ],
    nodes: 'ABCDEFG'.split('').map((id) => ({ id, label: id, shape: 'neuron' as const, group: path.has(id) ? 'Shortest path A to F' : 'Other vertices', color: path.has(id) ? C.output : C.hidden, value: path.has(id) ? 0.9 : 0.35 })),
    edges: links.map(([a, b, cost]) => ({ a, b, label: String(cost), weight: path.has(a) && path.has(b) ? 1 : 0.35, kind: path.has(a) && path.has(b) ? ('flow' as const) : ('plain' as const) })),
  };
}

const BUILTINS: Record<NetworkModel, () => Net> = { 'neural-network': neuralNetwork, transformer, cnn, rnn, 'decision-tree': decisionTree, graph };
const cache = new Map<NetworkModel, Net>();
export const builtinNetwork = (model: NetworkModel): Net => cache.get(model) ?? cache.set(model, BUILTINS[model]()).get(model)!;

/** The network a spec describes: a built-in, plus anything the spec adds or composes itself. */
export function resolveNetwork(spec: NetworkSpec): Net {
  const base = spec.model ? builtinNetwork(spec.model) : null;
  const nodes = [...(base?.nodes ?? []), ...(spec.nodes ?? [])];
  const named = new Set([...(base?.groups ?? []), ...(spec.groups ?? [])].map((g) => g.name));
  // groups that nodes mention but nobody declared still become parts
  const implied = [...new Set(nodes.map((n) => n.group).filter((g): g is string => !!g && !named.has(g)))].map((name) => ({ name }));
  return {
    layout: spec.layout ?? base?.layout ?? 'layers',
    groups: [...(base?.groups ?? []), ...(spec.groups ?? []), ...implied],
    nodes,
    edges: [...(base?.edges ?? []), ...(spec.edges ?? [])],
  };
}

/** The panel chip a node belongs to: its group, else its own label. */
export const partOf = (n: NetNode) => n.group ?? n.label ?? n.id;
