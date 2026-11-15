// Canned responses so the UI works with no API key (MOCK mode).
import { labHint } from '../shared/lab';
import type { SandboxItemSpec, BodyShape, LessonKind, LessonMap, LessonRequest, MoleculeSpec, Problem, ReactionResult, ReactRequest, ScopeInfo, SolveRequest, TopicDetail, VisualSpec } from '../shared/types';

const water: VisualSpec = {
  kind: 'molecule',
  title: 'Water (H2O): bent geometry, 104.5 degrees',
  atoms: [
    { element: 'O', x: 0, y: 0, z: 0 },
    { element: 'H', x: 0.757, y: 0.586, z: 0 },
    { element: 'H', x: -0.757, y: 0.586, z: 0 },
  ],
  bonds: [
    { a: 0, b: 1, order: 1 },
    { a: 0, b: 2, order: 1 },
  ],
};

const surface: VisualSpec = {
  kind: 'surface',
  title: 'z = sin(x) cos(y): saddle points and extrema',
  expr: 'sin(x) * cos(y)',
  xRange: [-3.14, 3.14],
  yRange: [-3.14, 3.14],
};

const forces: VisualSpec = {
  kind: 'diagram',
  scene: 'lab',
  title: 'Atwood machine: two masses on a pulley',
  elements: [
    { type: 'body', id: 'p', label: 'Pulley', x: 0, y: 3, radius: 0.6 },
    { type: 'body', id: 'm1', label: 'm1 = 2 kg', x: -1.5, y: 0 },
    { type: 'body', id: 'm2', label: 'm2 = 3 kg', x: 1.5, y: -1 },
    { type: 'link', a: 'p', b: 'm1' },
    { type: 'link', a: 'p', b: 'm2' },
    { type: 'vector', from: 'm1', label: 'm1 g', dx: 0, dy: -1.6 },
    { type: 'vector', from: 'm2', label: 'm2 g', dx: 0, dy: -2.4 },
    { type: 'vector', from: 'm1', label: 'T', dx: 0, dy: 2 },
    { type: 'vector', from: 'm2', label: 'T', dx: 0, dy: 2 },
  ],
};

const methane: VisualSpec = {
  kind: 'molecule',
  title: 'Methane (CH4): tetrahedral, 109.5 degrees',
  atoms: [
    { element: 'C', x: 0, y: 0, z: 0 },
    { element: 'H', x: 0.629, y: 0.629, z: 0.629 },
    { element: 'H', x: -0.629, y: -0.629, z: 0.629 },
    { element: 'H', x: -0.629, y: 0.629, z: -0.629 },
    { element: 'H', x: 0.629, y: -0.629, z: -0.629 },
  ],
  bonds: [1, 2, 3, 4].map((b) => ({ a: 0, b, order: 1 as const })),
};

const co2: VisualSpec = {
  kind: 'molecule',
  title: 'Carbon dioxide (CO2): linear, two double bonds',
  atoms: [
    { element: 'C', x: 0, y: 0, z: 0 },
    { element: 'O', x: 1.16, y: 0, z: 0 },
    { element: 'O', x: -1.16, y: 0, z: 0 },
  ],
  bonds: [
    { a: 0, b: 1, order: 2 },
    { a: 0, b: 2, order: 2 },
  ],
};

const paraboloid: VisualSpec = { kind: 'surface', title: 'z = x^2 + y^2: paraboloid with a global minimum', expr: 'x^2 + y^2', xRange: [-2, 2], yRange: [-2, 2] };
const saddle: VisualSpec = { kind: 'surface', title: 'z = x^2 - y^2: saddle point at the origin', expr: 'x^2 - y^2', xRange: [-2, 2], yRange: [-2, 2] };

const incline: VisualSpec = {
  kind: 'diagram',
  title: 'Block on an incline: gravity, normal force and friction',
  elements: [
    { type: 'body', id: 'b', label: 'Block (2 kg)', x: 0, y: 0 },
    { type: 'vector', from: 'b', label: 'mg', dx: 0, dy: -2.4 },
    { type: 'vector', from: 'b', label: 'N', dx: -1.1, dy: 1.9 },
    { type: 'vector', from: 'b', label: 'friction', dx: 1.3, dy: 0.75 },
  ],
};

const projectile: VisualSpec = {
  kind: 'diagram',
  title: 'Projectile motion: a kicked ball follows a parabola',
  scene: 'ground',
  ground: -2,
  elements: [
    { type: 'body', id: 'kid', label: 'Kicker', x: -4.4, y: -1.4, shape: 'person' },
    { type: 'body', id: 'p', label: 'Ball', x: -3.8, y: -1.8, radius: 0.25, shape: 'ball', motion: { vx: 2.5, vy: 4.2, ax: 0, ay: -2.8, duration: 3 } },
    { type: 'vector', from: 'p', label: 'g', dx: 0, dy: -1.2 },
    { type: 'path', points: [[-3.8, -1.8], [-2.3, 0.3], [-0.8, 1.3], [0.4, 1.35], [1.6, 0.4], [3.1, -1.8]], label: 'trajectory' },
  ],
};

// [keyword that selects it for a spoken/typed request, spec]
const VISUALS = {
  molecule: [[/water|h2o/, water], [/methane|ch4|tetrahed/, methane], [/co2|carbon dioxide|double/, co2]],
  surface: [[/sin|cos|wave/, surface], [/parabol|bowl|minimum/, paraboloid], [/saddle|hyperbol/, saddle]],
  diagram: [[/atwood|pulley/, forces], [/incline|ramp|friction/, incline], [/projectile|launch|throw/, projectile]],
} satisfies Record<string, [RegExp, VisualSpec][]>;

const brain: VisualSpec = { kind: 'anatomy', title: 'The human brain: lobes and what they do', model: 'brain', focus: ['Frontal lobe'] };
const cell: VisualSpec = { kind: 'anatomy', title: 'An animal cell and its organelles', model: 'cell', focus: ['Nucleus', 'Mitochondria'] };
const neuron: VisualSpec = { kind: 'anatomy', title: 'A neuron: how signals travel', model: 'neuron' };
const dna: VisualSpec = { kind: 'anatomy', title: 'DNA: the double helix and its base pairs', model: 'dna' };
const heart: VisualSpec = { kind: 'anatomy', title: 'The heart: four chambers and great vessels', model: 'heart' };
const NETWORKS: [RegExp, VisualSpec][] = [
  [/llm|language model|transformer|gpt|attention|chatbot|token/, { kind: 'network', title: 'Inside a language model: predicting the next word', model: 'transformer', focus: ['Self-attention'] }],
  [/convolution|cnn|image (?:recogn|classif)|computer vision/, { kind: 'network', title: 'A convolutional network classifying an image', model: 'cnn', focus: ['Convolution'] }],
  [/recurrent|rnn|lstm|sequence model/, { kind: 'network', title: 'A recurrent network unrolled over time', model: 'rnn', focus: ['Hidden state'] }],
  [/decision tree|random forest|classif/, { kind: 'network', title: 'A decision tree classifying iris flowers', model: 'decision-tree' }],
  [/graph|dijkstra|shortest path|vertex|vertices|node|data structure|linked list|network theory/, { kind: 'network', title: 'A weighted graph and its shortest path', model: 'graph', focus: ['Shortest path A to F'] }],
  [/neural|deep learning|machine learning|perceptron|backprop|artificial intelligence|\bai\b|\bml\b/, { kind: 'network', title: 'A neural network: layers of connected neurons', model: 'neural-network', focus: ['Hidden layer 1'] }],
];
const ANATOMY: [RegExp, VisualSpec][] = [[/neuron|nerve|synap/, neuron], [/brain|psych|neuro|cognit|memory|emotion/, brain], [/cell|organelle|mitochond/, cell], [/dna|gene|heredit|helix/, dna], [/heart|cardio|circulat|blood/, heart]];

function pickVisual(subject: string, request = '', variant = 0): VisualSpec {
  const asked = NETWORKS.find(([re]) => request && re.test(request.toLowerCase()));
  if (asked) return asked[1];
  const network = NETWORKS.find(([re]) => re.test(subject.toLowerCase()));
  if (network) return variant ? NETWORKS[(NETWORKS.indexOf(network) + variant) % NETWORKS.length][1] : network[1];
  const anatomy = ANATOMY.find(([re]) => re.test(`${request} ${subject}`.toLowerCase()));
  if (anatomy) return variant ? ANATOMY[(ANATOMY.indexOf(anatomy) + variant) % ANATOMY.length][1] : anatomy[1];
  const r = request.toLowerCase();
  const byRequest = Object.values(VISUALS).flat().find(([re]) => r && re.test(r));
  if (byRequest) return byRequest[1];
  const s = `${r} ${subject}`.toLowerCase();
  const group = /chem|molec|bond|atom/.test(s) ? VISUALS.molecule : /phys|force|motion|mechanic|diagram/.test(s) ? VISUALS.diagram : VISUALS.surface;
  return group[variant % group.length][1];
}

export function fixture<K extends LessonKind>(kind: K, subjectName: string, req: Partial<LessonRequest> = {}): LessonMap[K] {
  const subject = req.focus ?? subjectName; // mock text follows the focused topic so focus changes are visible
  const visual = pickVisual(`${subjectName} ${req.focus ?? ''}`, req.request, req.variant);
  const all: LessonMap = {
    timeline: [
      { year: '300 BC', type: 'figure', title: 'Elements', figure: 'Euclid', detail: `Mock event for ${subject}: axiomatic reasoning becomes the model for rigorous science.`, related: ['Axioms', 'Proof', 'Archimedes'] },
      { year: '1543', type: 'event', title: 'De revolutionibus published', figure: 'Nicolaus Copernicus', detail: 'Mock event: a sun-centered model reopens the question of how nature is organized.' },
      { year: '1687', type: 'discovery', title: 'Principia Mathematica', figure: 'Isaac Newton', detail: 'Mock discovery: laws of motion and universal gravitation unify earth and sky.', related: ['Calculus', 'Gottfried Leibniz', 'Gravitation'] },
      { year: '1869', type: 'discovery', title: 'Periodic table', figure: 'Dmitri Mendeleev', detail: 'Mock discovery: patterns in the elements predict undiscovered ones.' },
      { year: '1905', type: 'discovery', title: 'Annus mirabilis', figure: 'Albert Einstein', detail: 'Mock discovery: relativity and the photoelectric effect reshape physics.' },
      { year: '1927', type: 'event', title: 'Solvay Conference', figure: 'Bohr, Heisenberg, Schrodinger', detail: 'Mock event: the founders of quantum theory debate its meaning.' },
    ],
    topics: [
      { title: `Foundations of ${subject}`, summary: 'Core definitions and the language of the field.', children: [{ title: 'Key terms', summary: 'The vocabulary you need first.' }, { title: 'Notation', summary: 'How ideas are written down.' }] },
      { title: 'Core methods', summary: 'The main problem-solving toolkit.', children: [{ title: 'Method A', summary: 'The most common technique.' }, { title: 'Method B', summary: 'The fallback when A fails.' }] },
      { title: 'Applications', summary: 'Where the ideas are used in practice.', children: [{ title: 'In science', summary: 'Modeling natural systems.' }, { title: 'In engineering', summary: 'Designing and predicting.' }] },
      { title: 'Common pitfalls', summary: 'Where learners usually go wrong.', children: [{ title: 'Base cases', summary: 'Zero, one and empty inputs.' }, { title: 'Units and signs', summary: 'Small slips with large effects.' }] },
    ],
    problems: [
      { prompt: `Base case for ${subject}${req.explored?.length ? ` (building on ${req.explored.join(', ')})` : ''}: evaluate the setup when the input is 0.`, solution: '1. Substitute 0.\n2. Simplify.\n3. The result is the identity of the operation.', difficulty: 'base', why: 'Checks you know the trivial case' },
      { prompt: 'Base case: what is the smallest valid input?', solution: '1. State the domain.\n2. Take its minimum.\n3. Evaluate.', difficulty: 'base', why: 'Domain awareness' },
      { prompt: 'Apply the main idea once to a clean example.', solution: '1. Identify the quantities.\n2. Apply the rule.\n3. Check units.', difficulty: 'intro', why: 'Single-step practice' },
      { prompt: 'Combine two ideas to solve a standard problem.', solution: '1. Split into parts.\n2. Solve each.\n3. Recombine.', difficulty: 'core', why: 'Multi-step reasoning' },
      { prompt: 'What happens at the boundary, where the usual rule breaks down?', solution: '1. Take the limit.\n2. Note the rule no longer applies.\n3. Handle the case separately.', difficulty: 'edge', why: 'Common mistake: applying the rule blindly' },
    ],
    visual,
  };
  const explored = req.explored ?? [];
  if (explored.length) all.problems = all.problems.map((p, i) => (i < explored.length * 2 ? { ...p, topic: explored[i % explored.length] } : p));
  return all[kind];
}

export function expandFixture(topic: string): TopicDetail {
  return {
    title: topic,
    explanation: `Mock explanation of "${topic}". Add an ANTHROPIC_API_KEY to .env to get a real in-depth explanation here.\n\nThis second paragraph shows how longer explanations are laid out in the panel.`,
    keyPoints: ['Start from the definition.', 'Check the base case first.', 'Look for the pattern, then generalize.'],
    example: `A short worked example of ${topic}.`,
    subtopics: [
      { title: `${topic}: basics`, summary: 'The simplest version of the idea.' },
      { title: `${topic}: in practice`, summary: 'How it shows up in real problems.' },
      { title: `${topic}: limits`, summary: 'Where the idea stops working.' },
    ],
  };
}

const BROAD = /^(math|maths|mathematics|algebra|geometry|trigonometry|calculus|statistics|physics|chemistry|biology|economics|computer science|artificial intelligence|machine learning|history|astronomy|(organic|inorganic|physical) chem(istry)?|org chem|(multivariable|differential|integral|vector) calculus|linear algebra|(quantum|classical) mechanics|thermodynamics|electromagnetism)$/;

export function scopeFixture(subject: string): ScopeInfo {
  const broad = BROAD.test(subject.trim().toLowerCase());
  return {
    scope: broad ? 'broad' : 'specific',
    lab: labHint(subject) ?? 'none',
    overview: `Mock overview: ${subject} in one or two sentences. Add an API key for a real one.`,
    suggestions: broad ? ['Core definitions', 'Key theorem', 'Standard method', 'Classic application', 'Common pitfalls', 'Advanced extension'] : [],
  };
}

export function solveFixture(req: SolveRequest): Problem {
  return {
    prompt: req.question ?? 'Problem read from your screenshot (mock mode cannot read images; add an API key).',
    solution: '1. Identify what is given and what is asked.\n2. Choose the rule that connects them.\n3. Substitute and simplify.\n4. Check the answer against a base case.',
    difficulty: 'core',
    why: 'Mock solution: shows where your own problems appear',
  };
}

const MOLECULES: [RegExp, MoleculeSpec][] = [
  [/water|h2o/, water as MoleculeSpec],
  [/methane|ch4/, methane as MoleculeSpec],
  [/carbon dioxide|co2/, co2 as MoleculeSpec],
  [/oxygen|o2/, { kind: 'molecule', title: 'Oxygen (O2)', atoms: [{ element: 'O', x: -0.6, y: 0, z: 0 }, { element: 'O', x: 0.6, y: 0, z: 0 }], bonds: [{ a: 0, b: 1, order: 2 }] }],
  [/hydrogen|h2/, { kind: 'molecule', title: 'Hydrogen (H2)', atoms: [{ element: 'H', x: -0.37, y: 0, z: 0 }, { element: 'H', x: 0.37, y: 0, z: 0 }], bonds: [{ a: 0, b: 1, order: 1 }] }],
];

export function moleculeFixture(name: string): MoleculeSpec {
  const n = name.toLowerCase();
  const hit = MOLECULES.find(([re]) => re.test(n));
  return hit ? hit[1] : { ...(water as MoleculeSpec), title: `${name} (mock: shown as water)` };
}

export function reactFixture(req: ReactRequest): ReactionResult {
  const names = req.reactants.map((r) => r.name.toLowerCase()).join(' ');
  const hot = /heat|spark|flame|fire|ignite|burn/.test(req.condition ?? '');
  if (/methane|ch4/.test(names) && /oxygen|o2/.test(names)) {
    if (!hot) return { reacts: false, equation: '', explanation: 'Mock: methane and oxygen do not react at room temperature. Add heat or a spark to start combustion.', products: [] };
    return {
      reacts: true,
      equation: 'CH4 + 2 O2 -> CO2 + 2 H2O',
      explanation: 'Mock: with a spark, methane burns in oxygen to give carbon dioxide and water, releasing heat.',
      products: [
        { name: 'Carbon dioxide', count: 1, molecule: co2 as MoleculeSpec },
        { name: 'Water', count: 2, molecule: water as MoleculeSpec },
      ],
    };
  }
  if (/hydrogen|h2\b/.test(names) && /oxygen|o2/.test(names) && hot) {
    return { reacts: true, equation: '2 H2 + O2 -> 2 H2O', explanation: 'Mock: hydrogen burns in oxygen to make water.', products: [{ name: 'Water', count: 2, molecule: water as MoleculeSpec }] };
  }
  return { reacts: false, equation: '', explanation: 'Mock mode only knows a couple of reactions (methane or hydrogen with oxygen, plus heat). Add an API key for real chemistry.', products: [] };
}

/** Mock "new example" batch: the subject's group, minus what was already shown (cycling when all were seen). */
export function examplesFixture(subject: string, avoid: string[]): VisualSpec[] {
  const s = subject.toLowerCase();
  const anat = /brain|psych|neuro|bio|cell|gene|dna|heart|anatom|medic/.test(s);
  const group = /chem|molec|bond|atom/.test(s) ? VISUALS.molecule : /phys|force|motion|mechanic|diagram/.test(s) ? VISUALS.diagram : VISUALS.surface;
  const net = NETWORKS.some(([re]) => re.test(s));
  const all = net ? NETWORKS.map(([, v]) => v) : anat ? [brain, neuron, cell, dna, heart] : group.map(([, v]) => v);
  const fresh = all.filter((v) => !avoid.includes(v.title));
  return fresh.length ? fresh : all;
}

const MOCK_BODIES: [RegExp, BodyShape, number, number, number?][] = [
  // [name pattern, shape, mass kg, radius, charge]
  [/\bcar\b/, 'car', 1200, 1.1], [/truck/, 'truck', 8000, 1.4], [/ball/, 'ball', 0.6, 0.35], [/crate|box|block/, 'crate', 20, 0.6],
  [/cart/, 'cart', 5, 0.6], [/\bsun\b|star/, 'sun', 1000, 1.4], [/planet|earth|mars/, 'planet', 5, 0.6], [/moon/, 'moon', 0.5, 0.35],
  [/rocket/, 'rocket', 500, 0.9], [/person|man|woman|student/, 'person', 70, 0.8], [/proton/, 'charge', 1, 0.35, 1], [/electron/, 'charge', 1, 0.3, -1],
];

const MOCK_CONCEPTS: [RegExp, BodyShape][] = [[/neuron|node|vertex|layer|token|concept|idea/, 'node'], [/chip|gpu|cpu|processor|model|computer/, 'chip'], [/data|memory|storage|dataset/, 'database'], [/document|book|text|law|file|paper/, 'document']];

export function sandboxItemFixture(name: string): SandboxItemSpec {
  const n = name.toLowerCase();
  const hit = MOCK_BODIES.find(([re]) => re.test(n));
  if (hit) {
    const [, shape, mass, radius, charge] = hit;
    return { kind: 'body', name: name.replace(/^./, (c) => c.toUpperCase()), body: { shape, mass, radius, charge, color: charge && charge < 0 ? '#3f7fd9' : undefined } };
  }
  const concept = MOCK_CONCEPTS.find(([re]) => re.test(n));
  if (concept) return { kind: 'body', name: name.replace(/^./, (c) => c.toUpperCase()), body: { shape: concept[1], mass: 1, radius: 0.55 } };
  const molecule = moleculeFixture(name);
  return { kind: 'molecule', name: molecule.title.split(/[(:]/)[0].trim(), molecule };
}
