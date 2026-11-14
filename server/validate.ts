// Runtime validation of model output against shared/types.ts. Returns a cleaned value or undefined.
import { evaluate } from 'mathjs';
import type { LessonKind, LessonMap, Problem, ScopeInfo, TopicDetail, TopicNode, VisualSpec } from '../shared/types';

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

export function validateScope(raw: unknown): ScopeInfo | undefined {
  if (!isObj(raw) || !str(raw.overview)) return undefined;
  return {
    scope: raw.scope === 'specific' ? 'specific' : 'broad',
    overview: raw.overview,
    suggestions: Array.isArray(raw.suggestions) ? raw.suggestions.filter(str).slice(0, 8) : [],
  };
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
          return { ...rest, difficulty, ...(match ? { topic: match } : {}) };
        });
      return (out?.length ? out : undefined) as LessonMap[K] | undefined;
    }
    case 'visual':
      return visual(raw) as LessonMap[K] | undefined;
  }
}
