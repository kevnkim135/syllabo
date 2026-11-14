// Runtime validation of model output against shared/types.ts. Returns a cleaned value or undefined.
import { evaluate } from 'mathjs';
import { BODY_SHAPES, LESSON_KINDS, SCENES, type BodyShape, type MoleculeSpec, type ReactionResult, type SceneKind, type IntentResult, type LessonKind, type LessonMap, type Problem, type ScopeInfo, type TopicDetail, type TopicNode, type VisualSpec, type VoiceIntent } from '../shared/types';

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function topic(v: unknown, depth = 0): TopicNode | undefined {
  if (!isObj(v) || !str(v.title) || depth > 4) return undefined;
  const children = Array.isArray(v.children)
    ? v.children.map((c) => topic(c, depth + 1)).filter((c): c is TopicNode => !!c)
    : undefined;
  return {
    title: v.title,
    summary: str(v.summary) ? v.summary : undefined,
    children: children?.length ? children : undefined,
  };
}

function visual(v: unknown): VisualSpec | undefined {
  if (!isObj(v) || !str(v.title)) return undefined;
  if (v.kind === 'molecule') {
    if (!Array.isArray(v.atoms) || !Array.isArray(v.bonds) || v.atoms.length === 0) return undefined;
    const atoms = v.atoms.filter((a) => isObj(a) && str(a.element) && num(a.x) && num(a.y) && num(a.z));
    if (atoms.length !== v.atoms.length) return undefined;
    const bonds = v.bonds
      .filter((b) => isObj(b) && num(b.a) && num(b.b) && b.a < atoms.length && b.b < atoms.length && b.a >= 0 && b.b >= 0)
      .map((b) => ({ ...(b as object), order: [1, 2, 3].includes((b as { order: number }).order) ? (b as { order: number }).order : 1 }));
    return { ...v, atoms, bonds, scene: scene(v.scene) } as VisualSpec;
  }
  if (v.kind === 'surface') {
    const ok = (r: unknown) => Array.isArray(r) && r.length === 2 && num(r[0]) && num(r[1]) && r[0] < r[1];
    if (!str(v.expr) || !ok(v.xRange) || !ok(v.yRange)) return undefined;
    try {
      if (!num(evaluate(v.expr, { x: 0.5, y: 0.5 }))) return undefined; // must be a real-valued f(x, y)
    } catch {
      return undefined;
    }
    return { ...v, scene: scene(v.scene) } as unknown as VisualSpec;
  }
  if (v.kind === 'diagram') {
    if (!Array.isArray(v.elements)) return undefined;
    const ids = new Set(v.elements.filter((e) => isObj(e) && e.type === 'body').map((e) => (e as { id: string }).id));
    // Drop dangling vectors/links instead of failing the whole lesson.
    const elements = v.elements.filter((e) => {
      if (!isObj(e)) return false;
      if (e.type === 'body') return str(e.id) && str(e.label) && num(e.x) && num(e.y);
      if (e.type === 'path') return Array.isArray(e.points) && e.points.length >= 2 && e.points.every((p) => Array.isArray(p) && num(p[0]) && num(p[1]));
      if (e.type === 'vector') return typeof e.from === 'string' && ids.has(e.from) && num(e.dx) && num(e.dy);
      if (e.type === 'link') return typeof e.a === 'string' && typeof e.b === 'string' && ids.has(e.a) && ids.has(e.b);
      return false;
    });
    // Unknown shapes fall back to a sphere; malformed motion is dropped rather than failing the model.
    const cleaned = elements.map((e) => {
      if (!isObj(e) || e.type !== 'body') return e;
      const m = e.motion;
      const motion = isObj(m) && num(m.vx) && num(m.vy) ? { vx: m.vx, vy: m.vy, ax: num(m.ax) ? m.ax : 0, ay: num(m.ay) ? m.ay : 0, duration: num(m.duration) && m.duration > 0.3 && m.duration < 30 ? m.duration : 3 } : undefined;
      return { ...e, shape: BODY_SHAPES.includes(e.shape as BodyShape) ? e.shape : undefined, color: str(e.color) ? e.color : undefined, motion };
    });
    return elements.length ? ({ ...v, elements: cleaned, scene: scene(v.scene), ground: num(v.ground) ? v.ground : undefined } as unknown as VisualSpec) : undefined;
  }
  return undefined;
}

const scene = (s: unknown): SceneKind | undefined => (SCENES.includes(s as SceneKind) ? (s as SceneKind) : undefined);

/** A molecule only (the sandbox needs molecules, whatever the subject). */
export function validateMolecule(raw: unknown): MoleculeSpec | undefined {
  const v = visual(isObj(raw) ? { ...raw, kind: 'molecule' } : raw);
  return v?.kind === 'molecule' ? v : undefined;
}

export function validateReaction(raw: unknown): ReactionResult | undefined {
  if (!isObj(raw) || typeof raw.reacts !== 'boolean' || !str(raw.explanation)) return undefined;
  const products = (Array.isArray(raw.products) ? raw.products : []).flatMap((p) => {
    if (!isObj(p) || !str(p.name)) return [];
    const molecule = validateMolecule(p.molecule);
    if (!molecule) return [];
    const count = num(p.count) && p.count >= 1 && p.count <= 6 ? Math.round(p.count) : 1;
    return [{ name: p.name.trim(), count, molecule }];
  });
  if (raw.reacts && !products.length) return undefined; // a reaction must show what it makes
  return { reacts: raw.reacts, equation: str(raw.equation) ? raw.equation.trim() : '', explanation: raw.explanation.trim(), products: raw.reacts ? products : [] };
}

export function validateDetail(raw: unknown): TopicDetail | undefined {
  if (!isObj(raw) || !str(raw.title) || !str(raw.explanation)) return undefined;
  const subtopics = Array.isArray(raw.subtopics)
    ? raw.subtopics.map((t) => topic(t)).filter((t): t is TopicNode => !!t)
    : [];
  return {
    title: raw.title,
    explanation: raw.explanation,
    keyPoints: Array.isArray(raw.keyPoints) ? raw.keyPoints.filter(str) : [],
    example: str(raw.example) ? raw.example : undefined,
    imageQuery: str(raw.imageQuery) ? raw.imageQuery.trim().slice(0, 120) : undefined,
    subtopics,
  };
}

export function validateScope(raw: unknown): ScopeInfo | undefined {
  if (!isObj(raw) || !str(raw.overview)) return undefined;
  return {
    scope: raw.scope === 'specific' ? 'specific' : 'broad',
    overview: raw.overview,
    suggestions: Array.isArray(raw.suggestions) ? raw.suggestions.filter(str).slice(0, 8) : [],
  };
}

/** A voice intent from the model; anything malformed becomes "none". */
/**
 * Models sometimes write single backslashes inside JSON strings, so "\frac" arrives as a form feed + "rac"
 * and "\times" as a tab + "imes". Put those LaTeX commands back. Real newlines are kept, except before a
 * handful of LaTeX names that start with "n" (\neq, \nabla...).
 */
export function repairLatex(s: string): string {
  return s
    .replace(/\f/g, '\\f')
    .replace(/\x08/g, '\\b')
    .replace(/\t(?=[a-zA-Z])/g, '\\t')
    .replace(/\r(?=[a-zA-Z])/g, '\\r')
    .replace(/\n(?=(?:eq|abla|eg|ot|u\b|i\b|ewline|exists|leq|geq|parallel|mid|subseteq)\b)/g, '\\n');
}
const fixProblem = (p: Record<string, unknown>) => ({
  ...p,
  prompt: repairLatex(String(p.prompt)),
  solution: repairLatex(String(p.solution)),
  ...(typeof p.why === 'string' ? { why: repairLatex(p.why) } : {}),
});

export function validateIntent(raw: unknown): IntentResult | undefined {
  if (!isObj(raw) || !isObj(raw.intent)) return undefined;
  const i = raw.intent;
  const s = (v: unknown) => (str(v) ? v.trim().slice(0, 200) : undefined);
  let intent: VoiceIntent | undefined;
  switch (i.action) {
    case 'newLesson': intent = s(i.subject) ? { action: 'newLesson', subject: s(i.subject)! } : undefined; break;
    case 'focus': intent = s(i.topic) ? { action: 'focus', topic: s(i.topic)! } : undefined; break;
    case 'model': intent = s(i.request) ? { action: 'model', request: s(i.request)! } : undefined; break;
    case 'solve': intent = s(i.question) ? { action: 'solve', question: s(i.question)! } : undefined; break;
    case 'open': intent = s(i.title) ? { action: 'open', title: s(i.title)! } : undefined; break;
    case 'goto': intent = LESSON_KINDS.includes(i.section as LessonKind) ? { action: 'goto', section: i.section as LessonKind } : undefined; break;
    case 'modelStep': intent = { action: 'modelStep', step: i.step === -1 ? -1 : 1 }; break;
    case 'save': intent = { action: 'save', folder: s(i.folder) }; break;
    case 'widen': case 'newExample': case 'library': case 'home': case 'none': case 'sandbox': case 'sandboxClear': intent = { action: i.action }; break;
    case 'sandboxAdd': intent = s(i.name) ? { action: 'sandboxAdd', name: s(i.name)!, count: num(i.count) && i.count >= 1 && i.count <= 6 ? Math.round(i.count) : undefined } : undefined; break;
    case 'sandboxRemove': intent = s(i.target) ? { action: 'sandboxRemove', target: s(i.target)! } : undefined; break;
    case 'sandboxReact': intent = { action: 'sandboxReact', condition: s(i.condition) }; break;
    case 'sandboxMove': {
      const dirs = ['left', 'right', 'up', 'down', 'closer', 'farther', 'together', 'apart'] as const;
      const d = dirs.find((x) => x === i.direction);
      intent = s(i.target) && d ? { action: 'sandboxMove', target: s(i.target)!, direction: d } : undefined;
      break;
    }
  }
  return intent ? { intent, say: s(raw.say) ?? '' } : undefined;
}

export const validateProblem = (raw: unknown): Problem | undefined => validate('problems', [raw])?.[0];

export function validate<K extends LessonKind>(kind: K, raw: unknown, explored: string[] = []): LessonMap[K] | undefined {
  // Models sometimes wrap arrays: {"events": [...]}
  const arr = (x: unknown) => (Array.isArray(x) ? x : isObj(x) ? Object.values(x).find(Array.isArray) : undefined);
  switch (kind) {
    case 'timeline': {
      const types = ['discovery', 'event', 'figure'];
      const out = arr(raw)
        ?.filter((e): e is Record<string, unknown> => isObj(e) && str(e.year) && str(e.title) && str(e.detail))
        .map((e) => ({
          ...e,
          type: types.includes(e.type as string) ? e.type : undefined,
          related: Array.isArray(e.related) ? e.related.filter(str).slice(0, 5) : undefined,
        }));
      return (out?.length ? out : undefined) as LessonMap[K] | undefined;
    }
    case 'topics': {
      const out = arr(raw)?.map((t) => topic(t)).filter((t): t is TopicNode => !!t);
      return (out?.length ? out : undefined) as LessonMap[K] | undefined;
    }
    case 'problems': {
      const out = arr(raw)
        ?.filter((p) => isObj(p) && str(p.prompt) && str(p.solution))
        .map((p) => {
          const { topic, ...rest } = p as Record<string, unknown>;
          const difficulty = ['base', 'intro', 'core', 'edge'].includes(rest.difficulty as string) ? rest.difficulty : 'core';
          // A topic is kept only when it names one the student actually explored (case-insensitive).
          const match = str(topic) ? explored.find((t) => t.toLowerCase() === topic.trim().toLowerCase()) : undefined;
          return fixProblem({ ...rest, difficulty, ...(match ? { topic: match } : {}) });
        });
      return (out?.length ? out : undefined) as LessonMap[K] | undefined;
    }
    case 'visual':
      return visual(raw) as LessonMap[K] | undefined;
  }
}
