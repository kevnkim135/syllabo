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
  topic?: string; // the explored topic this problem builds on, copied verbatim from LessonRequest.explored
}

// ---- Interactive visual specs (LLM picks one) ----
/** The world the model sits in. */
export const SCENES = ['plain', 'ground', 'space', 'lab', 'water'] as const;
export type SceneKind = (typeof SCENES)[number];

export interface MoleculeSpec {
  kind: 'molecule';
  title: string;
  scene?: SceneKind;
  atoms: { element: string; x: number; y: number; z: number }[]; // angstroms
  bonds: { a: number; b: number; order: 1 | 2 | 3 }[]; // indices into atoms
}

export interface SurfaceSpec {
  kind: 'surface';
  title: string;
  scene?: SceneKind;
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
  imageQuery?: string; // Wikipedia article title whose lead image illustrates the topic
  subtopics: TopicNode[]; // clickable, expand again
}

export interface ExpandRequest {
  subject: string;
  topic: string; // the clicked topic's title
  path?: string[]; // ancestors, root first, for context
  level?: string;
}

/** Recognisable objects drawn instead of plain spheres, like textbook figures. */
export const BODY_SHAPES = ['ball', 'block', 'box', 'car', 'cart', 'plane', 'rocket', 'person', 'planet', 'sun', 'moon', 'satellite', 'boat', 'pulley', 'spring', 'ramp', 'charge'] as const;
export type BodyShape = (typeof BODY_SHAPES)[number];

/** Constant-acceleration motion, replayed in a loop: x = x0 + vx t + ax t^2 / 2 (same for y). Units per second. */
export interface BodyMotion {
  vx: number;
  vy: number;
  ax?: number;
  ay?: number;
  duration?: number; // seconds per loop (default 3)
}

export type BodyElement = { type: 'body'; id: string; label: string; x: number; y: number; radius?: number; shape?: BodyShape; color?: string; motion?: BodyMotion };
export type DiagramElement =
  | BodyElement
  | { type: 'path'; points: [number, number][]; label?: string } // a trajectory or outline, drawn dashed
  | { type: 'vector'; from: string; label: string; dx: number; dy: number }
  | { type: 'link'; a: string; b: string; label?: string };

export interface DiagramSpec {
  kind: 'diagram';
  title: string;
  scene?: SceneKind;
  ground?: number; // y of the ground line, when there is one
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

// ---- Voice assistant (POST /api/intent) ----
/** What a spoken request should do, decided with the current lesson in mind. */
export type VoiceIntent =
  | { action: 'newLesson'; subject: string } // a different or unrelated subject: open a new lesson
  | { action: 'focus'; topic: string } // a topic inside the current subject: narrow this lesson
  | { action: 'widen' } // back to the whole subject
  | { action: 'goto'; section: LessonKind }
  | { action: 'model'; request: string } // build a new 3D model
  | { action: 'newExample' }
  | { action: 'modelStep'; step: 1 | -1 } // next / previous model in this lesson's gallery
  | { action: 'solve'; question: string }
  | { action: 'save'; folder?: string }
  | { action: 'open'; title: string } // switch to an open lesson or reopen a saved one
  | { action: 'library' }
  | { action: 'home' }
  // chemistry sandbox: a shared 3D space of molecules
  | { action: 'sandbox' } // open the sandbox
  | { action: 'sandboxAdd'; name: string; count?: number }
  | { action: 'sandboxMove'; target: string; direction: 'left' | 'right' | 'up' | 'down' | 'closer' | 'farther' | 'together' | 'apart' }
  | { action: 'sandboxRemove'; target: string }
  | { action: 'sandboxReact'; condition?: string }
  | { action: 'sandboxClear' }
  | { action: 'none' };

export interface IntentContext {
  subject?: string;
  focus?: string;
  section?: LessonKind;
  model?: string; // current model title
  topics?: string[]; // topic titles and suggestions inside the current subject
  open?: string[]; // titles of lessons open in tabs
  saved?: string[]; // titles of saved lessons
  folders?: string[];
  sandbox?: string[]; // names of molecules in the sandbox, when it is open
}

export interface IntentRequest {
  transcript: string;
  context: IntentContext;
}

export interface IntentResult {
  intent: VoiceIntent;
  say: string; // short confirmation shown to the user
}

// ---- Chemistry sandbox ----
/** POST /api/molecule body { name } -> MoleculeSpec */
export interface ReactRequest {
  reactants: { name: string; formula?: string; count?: number }[];
  condition?: string; // "heat", "a platinum catalyst", "in water"...
  level?: string;
}
/** POST /api/react -> what happens when the reactants meet under the condition. */
export interface ReactionResult {
  reacts: boolean;
  equation: string; // balanced, plain text, e.g. "CH4 + 2 O2 -> CO2 + 2 H2O"
  explanation: string; // 2-3 sentences: what happens and why (or why nothing happens)
  products: { name: string; count: number; molecule: MoleculeSpec }[];
}
