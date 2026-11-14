// THE contract between server and UI. Change deliberately; every agent codes against this.

export const LESSON_KINDS = ['timeline', 'topics', 'problems', 'visual'] as const;
export type LessonKind = (typeof LESSON_KINDS)[number];

export interface TimelineEvent {
  year: string;
  title: string;
  figure?: string;
  detail: string;
}

export interface TopicNode {
  title: string;
  summary?: string;
  children?: TopicNode[];
}

export interface Problem {
  prompt: string;
  solution: string;
  difficulty: 'intro' | 'core' | 'edge';
  why?: string;
}

// ---- Interactive visual specs (LLM picks one) ----
export interface MoleculeSpec {
  kind: 'molecule';
  title: string;
  atoms: { element: string; x: number; y: number; z: number }[]; // angstroms
  bonds: { a: number; b: number; order: 1 | 2 | 3 }[]; // indices into atoms
}

export interface SurfaceSpec {
  kind: 'surface';
  title: string;
  expr: string; // mathjs syntax in x and y, e.g. "sin(x) * cos(y)"
  xRange: [number, number];
  yRange: [number, number];
}

export type BodyElement = { type: 'body'; id: string; label: string; x: number; y: number; radius?: number };
export type DiagramElement =
  | BodyElement
  | { type: 'vector'; from: string; label: string; dx: number; dy: number }
  | { type: 'link'; a: string; b: string; label?: string };

export interface DiagramSpec {
  kind: 'diagram';
  title: string;
  elements: DiagramElement[]; // coordinates roughly within -5..5
}

export type VisualSpec = MoleculeSpec | SurfaceSpec | DiagramSpec;

export interface LessonMap {
  timeline: TimelineEvent[];
  topics: TopicNode[];
  problems: Problem[];
  visual: VisualSpec;
}

export interface LessonRequest {
  subject: string;
  kind: LessonKind;
  level?: string;
}

export interface LessonResponse<K extends LessonKind = LessonKind> {
  kind: K;
  subject: string;
  data: LessonMap[K];
}
