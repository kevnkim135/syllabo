// Canned responses so the UI works with no API key (MOCK mode).
import type { LessonKind, LessonMap, TopicDetail, VisualSpec } from '../shared/types';

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

export function fixture<K extends LessonKind>(kind: K, subject: string): LessonMap[K] {
  const s = subject.toLowerCase();
  const visual = /chem|molec|bond|atom/.test(s) ? water : /phys|force|motion|mechanic/.test(s) ? forces : surface;
  const all: LessonMap = {
    timeline: [
      { year: '300 BC', type: 'figure', title: 'Elements', figure: 'Euclid', detail: `Mock event for ${subject}: axiomatic reasoning becomes the model for rigorous science.` },
      { year: '1543', type: 'event', title: 'De revolutionibus published', figure: 'Nicolaus Copernicus', detail: 'Mock event: a sun-centered model reopens the question of how nature is organized.' },
      { year: '1687', type: 'discovery', title: 'Principia Mathematica', figure: 'Isaac Newton', detail: 'Mock discovery: laws of motion and universal gravitation unify earth and sky.' },
      { year: '1869', type: 'discovery', title: 'Periodic table', figure: 'Dmitri Mendeleev', detail: 'Mock discovery: patterns in the elements predict undiscovered ones.' },
      { year: '1905', type: 'discovery', title: 'Annus mirabilis', figure: 'Albert Einstein', detail: 'Mock discovery: relativity and the photoelectric effect reshape physics.' },
      { year: '1927', type: 'event', title: 'Solvay Conference', figure: 'Bohr, Heisenberg, Schrodinger', detail: 'Mock event: the founders of quantum theory debate its meaning.' },
    ],
    topics: [
      { title: 'Foundations', summary: 'Core definitions and the language of the field.', children: [{ title: 'Key terms', summary: 'The vocabulary you need first.' }, { title: 'Notation', summary: 'How ideas are written down.' }] },
      { title: 'Core methods', summary: 'The main problem-solving toolkit.', children: [{ title: 'Method A', summary: 'The most common technique.' }, { title: 'Method B', summary: 'The fallback when A fails.' }] },
      { title: 'Applications', summary: 'Where the ideas are used in practice.', children: [{ title: 'In science', summary: 'Modeling natural systems.' }, { title: 'In engineering', summary: 'Designing and predicting.' }] },
      { title: 'Common pitfalls', summary: 'Where learners usually go wrong.', children: [{ title: 'Base cases', summary: 'Zero, one and empty inputs.' }, { title: 'Units and signs', summary: 'Small slips with large effects.' }] },
    ],
    problems: [
      { prompt: 'Base case: evaluate the setup when the input is 0.', solution: '1. Substitute 0.\n2. Simplify.\n3. The result is the identity of the operation.', difficulty: 'base', why: 'Checks you know the trivial case' },
      { prompt: 'Base case: what is the smallest valid input?', solution: '1. State the domain.\n2. Take its minimum.\n3. Evaluate.', difficulty: 'base', why: 'Domain awareness' },
      { prompt: 'Apply the main idea once to a clean example.', solution: '1. Identify the quantities.\n2. Apply the rule.\n3. Check units.', difficulty: 'intro', why: 'Single-step practice' },
      { prompt: 'Combine two ideas to solve a standard problem.', solution: '1. Split into parts.\n2. Solve each.\n3. Recombine.', difficulty: 'core', why: 'Multi-step reasoning' },
      { prompt: 'What happens at the boundary, where the usual rule breaks down?', solution: '1. Take the limit.\n2. Note the rule no longer applies.\n3. Handle the case separately.', difficulty: 'edge', why: 'Common mistake: applying the rule blindly' },
    ],
    visual,
  };
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
