// THE contract between server and UI. Change deliberately; every agent codes against this.

export const LESSON_KINDS = ['timeline', 'topics', 'problems', 'visual'] as const;
export type LessonKind = (typeof LESSON_KINDS)[number];

export type TimelineEventType = 'discovery' | 'event' | 'figure';

export interface TimelineEvent {
  year: string;
  type?: TimelineEventType; // discovery = a finding, event = historical event, figure = a person's milestone
  title: string;
  figure?: string;
  detail: string;
  related?: string[]; // short related terms the reader can open (expand via POST /api/expand)
}

export interface TopicNode {
  title: string;
  summary?: string;
  children?: TopicNode[];
}

export interface Problem {
  prompt: string;
  solution: string;
  difficulty: 'base' | 'intro' | 'core' | 'edge'; // base = trivial/base case, edge = borderline case
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

// ---- Topic drill-down (POST /api/expand) ----
export interface TopicDetail {
  title: string;
  explanation: string; // 2-4 short paragraphs, plain text
  keyPoints: string[];
  example?: string;
  subtopics: TopicNode[]; // clickable, expand again
}

export interface ExpandRequest {
  subject: string;
  topic: string; // the clicked topic's title
  path?: string[]; // ancestors, root first, for context
  level?: string;
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
  focus?: string; // specific topic inside the subject; when set, every kind is generated about it
  explored?: string[]; // problems only: topics the student opened, so problems build on them
  request?: string; // visual only: free-text ask, e.g. "benzene" or "graph x^2 - y^2"
  variant?: number; // visual only: 0 = default example, 1, 2, ... = a different example each time
}

// ---- Broad subject vs specific topic (POST /api/scope) ----
export interface ScopeInfo {
  scope: 'broad' | 'specific';
  overview: string; // 1-2 sentences
  suggestions: string[]; // specific topics worth exploring inside it
}

// ---- Solve a student's own problem (POST /api/solve) ----
export const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const;
export interface SolveRequest {
  subject: string;
  level?: string;
  focus?: string;
  question?: string; // typed or spoken
  image?: { mediaType: (typeof IMAGE_TYPES)[number]; data: string }; // base64, no data: prefix
}

export interface LessonResponse<K extends LessonKind = LessonKind> {
  kind: K;
  subject: string;
  data: LessonMap[K];
}
