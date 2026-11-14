// Runtime validation of model output against shared/types.ts. Returns a cleaned value or undefined.
import { evaluate } from 'mathjs';
import type { LessonKind, LessonMap, TopicDetail, TopicNode, VisualSpec } from '../shared/types';

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
    return { ...v, atoms, bonds } as VisualSpec;
  }
  if (v.kind === 'surface') {
    const ok = (r: unknown) => Array.isArray(r) && r.length === 2 && num(r[0]) && num(r[1]) && r[0] < r[1];
    if (!str(v.expr) || !ok(v.xRange) || !ok(v.yRange)) return undefined;
    try {
      if (!num(evaluate(v.expr, { x: 0.5, y: 0.5 }))) return undefined; // must be a real-valued f(x, y)
    } catch {
      return undefined;
    }
    return v as unknown as VisualSpec;
  }
  if (v.kind === 'diagram') {
    if (!Array.isArray(v.elements)) return undefined;
    const ids = new Set(v.elements.filter((e) => isObj(e) && e.type === 'body').map((e) => (e as { id: string }).id));
    // Drop dangling vectors/links instead of failing the whole lesson.
    const elements = v.elements.filter((e) => {
      if (!isObj(e)) return false;
      if (e.type === 'body') return str(e.id) && str(e.label) && num(e.x) && num(e.y);
      if (e.type === 'vector') return typeof e.from === 'string' && ids.has(e.from) && num(e.dx) && num(e.dy);
      if (e.type === 'link') return typeof e.a === 'string' && typeof e.b === 'string' && ids.has(e.a) && ids.has(e.b);
      return false;
    });
    return elements.length ? ({ ...v, elements } as unknown as VisualSpec) : undefined;
  }
  return undefined;
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
    subtopics,
  };
}

export function validate<K extends LessonKind>(kind: K, raw: unknown): LessonMap[K] | undefined {
  // Models sometimes wrap arrays: {"events": [...]}
  const arr = (x: unknown) => (Array.isArray(x) ? x : isObj(x) ? Object.values(x).find(Array.isArray) : undefined);
  switch (kind) {
    case 'timeline': {
      const out = arr(raw)?.filter((e) => isObj(e) && str(e.year) && str(e.title) && str(e.detail))
        .map((e) => ({ ...(e as object), type: ['discovery', 'event', 'figure'].includes((e as { type: string }).type) ? (e as { type: string }).type : undefined }));
      return (out?.length ? out : undefined) as LessonMap[K] | undefined;
    }
    case 'topics': {
      const out = arr(raw)?.map((t) => topic(t)).filter((t): t is TopicNode => !!t);
      return (out?.length ? out : undefined) as LessonMap[K] | undefined;
    }
    case 'problems': {
      const out = arr(raw)
        ?.filter((p) => isObj(p) && str(p.prompt) && str(p.solution))
        .map((p) => ({ ...(p as object), difficulty: ['base', 'intro', 'core', 'edge'].includes((p as { difficulty: string }).difficulty) ? (p as { difficulty: string }).difficulty : 'core' }));
      return (out?.length ? out : undefined) as LessonMap[K] | undefined;
    }
    case 'visual':
      return visual(raw) as LessonMap[K] | undefined;
  }
}
