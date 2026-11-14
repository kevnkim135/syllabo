// Canned responses so the UI works with no API key (MOCK mode).
import type { LessonKind, LessonMap, VisualSpec } from '../shared/types';

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
      { year: '300 BC', title: 'Early foundations', figure: 'Euclid', detail: `Mock event for ${subject}.` },
      { year: '1687', title: 'Principia', figure: 'Isaac Newton', detail: 'Mock event: laws of motion and gravitation.' },
      { year: '1905', title: 'Annus mirabilis', figure: 'Albert Einstein', detail: 'Mock event: relativity and the photoelectric effect.' },
    ],
    topics: [
      { title: 'Foundations', summary: 'Core definitions.', children: [{ title: 'Key terms' }, { title: 'Notation' }] },
      { title: 'Core methods', summary: 'The main toolkit.', children: [{ title: 'Method A' }, { title: 'Method B' }] },
    ],
    problems: [
      { prompt: 'Mock intro problem.', solution: 'Mock solution.', difficulty: 'intro', why: 'Warm-up' },
      { prompt: 'What happens when the input is 0?', solution: 'Edge case walkthrough.', difficulty: 'edge', why: 'Base case' },
    ],
    visual,
  };
  return all[kind];
}
