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
  subtopics: TopicNode[]; // clickable, expand again
}

export interface ExpandRequest {
  subject: string;
  topic: string; // the clicked topic's title
  path?: string[]; // ancestors, root first, for context
  level?: string;
}

/** Recognisable objects drawn instead of plain spheres, like textbook figures. */
export const BODY_SHAPES = [
  'ball', 'block', 'box', 'crate', 'car', 'truck', 'cart', 'plane', 'rocket', 'person', 'planet', 'sun', 'moon', 'satellite', 'boat',
  'pulley', 'spring', 'ramp', 'charge', 'ladder', 'wall', 'tank', 'cylinder', 'cone', 'tree', 'house', 'cannon', 'balloon', 'table',
] as const;
export type BodyShape = (typeof BODY_SHAPES)[number];

/** Constant-acceleration motion, replayed in a loop: x = x0 + vx t + ax t^2 / 2 (same for y). Units per second. */
export interface BodyMotion {
  vx: number;
  vy: number;
  ax?: number;
  ay?: number;
  duration?: number; // seconds per loop (default 3)
}

export type BodyElement = {
  type: 'body'; id: string; label: string; x: number; y: number;
  z?: number; // depth, for 3D arrangements (default 0)
  angle?: number; // degrees, rotation in the x-y plane (a leaning ladder, a tilted cannon)
  radius?: number; // overall size (default 0.4)
  shape?: BodyShape; color?: string; motion?: BodyMotion;
};
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

/** Hand-built, detailed models for the most common biology and psychology topics. */
export const ANATOMY_MODELS = ['brain', 'neuron', 'cell', 'dna', 'heart'] as const;
export type AnatomyModel = (typeof ANATOMY_MODELS)[number];
export const PART_SHAPES = ['sphere', 'ellipsoid', 'blob', 'capsule', 'cylinder', 'cone', 'torus', 'box', 'tube'] as const;
export type PartShape = (typeof PART_SHAPES)[number];
export const PART_SURFACES = ['smooth', 'folded', 'bumpy', 'glossy', 'translucent'] as const;
export type PartSurface = (typeof PART_SURFACES)[number];

/** One named, clickable piece of a realistic model (an organ, a lobe, an organelle, a vessel...). */
export interface AnatomyPart {
  name: string;
  shape: PartShape;
  position: [number, number, number];
  size: [number, number, number]; // full extent in x, y, z (tube: radius in x; path below)
  rotation?: [number, number, number]; // degrees
  color: string;
  surface?: PartSurface;
  path?: [number, number, number][]; // tube only: the points it runs through
  info?: string; // one or two sentences: what it is and what it does
}

/**
 * A realistic, colored 3D structure: biology, anatomy, psychology / neuroscience, medicine, geology...
 * Either a built-in model (with optional part notes) or one composed from parts.
 */
export interface AnatomySpec {
  kind: 'anatomy';
  title: string;
  scene?: SceneKind;
  model?: AnatomyModel;
  parts?: AnatomyPart[];
  notes?: Record<string, string>; // built-in models: part name -> what to say about it for this lesson
  focus?: string[]; // part names to highlight first
}

export type VisualSpec = MoleculeSpec | SurfaceSpec | DiagramSpec | AnatomySpec;

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
  | { action: 'sandboxPush'; target: string; direction: 'left' | 'right' | 'up' | 'down' | 'closer' | 'farther' | 'together' | 'apart'; force?: number } // shove bodies (newtons optional)
  | { action: 'sandboxSetting'; setting: SandboxSetting; on: boolean } // physics switches
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

/** A physical object in the sandbox: it has mass, can be pushed, thrown, collide, and feel gravity or charge. */
export interface SandboxBody {
  shape: BodyShape;
  mass: number; // kg (shown in readouts; the simulation uses it for momentum and collisions)
  radius: number; // scene units, about 0.3 (a ball) to 1.5 (a car)
  color?: string;
  charge?: number; // e.g. +1 proton, -1 electron: like charges repel, opposite attract
}
/** POST /api/sandbox-item body { name, subject?, level? } -> what to put in the sandbox for that name. */
export type SandboxItemSpec = { kind: 'molecule'; name: string; molecule: MoleculeSpec } | { kind: 'body'; name: string; body: SandboxBody };

/** Physics switches in the sandbox. */
export const SANDBOX_SETTINGS = ['gravity', 'friction', 'air', 'elastic'] as const;
export type SandboxSetting = (typeof SANDBOX_SETTINGS)[number];
