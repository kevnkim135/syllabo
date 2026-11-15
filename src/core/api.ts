import type { SandboxItemSpec, VisualSpec, ExpandRequest, IntentRequest, IntentResult, MoleculeSpec, ReactionResult, ReactRequest, LessonKind, LessonRequest, LessonResponse, Problem, ScopeInfo, SolveRequest, TopicDetail, LabKind } from '../../shared/types';

async function post<T>(url: string, req: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
  return body as T;
}

export const fetchLesson = <K extends LessonKind>(req: LessonRequest & { kind: K }) =>
  post<LessonResponse<K>>('/api/lesson', req);

// Drill-down explanations are kept in this browser too, so a saved lesson's opened notes and history
// bubbles come back instantly instead of being generated again.
const EXPAND_KEY = 'lessonlab.expand.v1';
const EXPAND_MAX = 400;
const expandKey = (r: ExpandRequest) => [r.level ?? '', r.subject, ...(r.path ?? []), r.topic].join('>').toLowerCase();
function expandCache(): Record<string, TopicDetail> {
  try {
    return JSON.parse(localStorage.getItem(EXPAND_KEY) ?? '{}');
  } catch {
    return {};
  }
}
export async function fetchExpand(req: ExpandRequest): Promise<TopicDetail> {
  const key = expandKey(req);
  const hit = expandCache()[key];
  if (hit) return hit;
  const detail = await post<TopicDetail>('/api/expand', req);
  try {
    const all = expandCache();
    delete all[key];
    all[key] = detail; // newest last
    const keys = Object.keys(all);
    for (const k of keys.slice(0, Math.max(0, keys.length - EXPAND_MAX))) delete all[k];
    localStorage.setItem(EXPAND_KEY, JSON.stringify(all));
  } catch {
    /* storage full or blocked: still return the result */
  }
  return detail;
}
export const fetchScope = (subject: string, level?: string) => post<ScopeInfo>('/api/scope', { subject, level });
export const fetchSolve = (req: SolveRequest) => post<Problem>('/api/solve', req);
export const fetchIntent = (req: IntentRequest) => post<IntentResult>('/api/intent', req);
export const fetchMolecule = (name: string) => post<MoleculeSpec>('/api/molecule', { name });
export const fetchReact = (req: ReactRequest) => post<ReactionResult>('/api/react', req);
export const fetchExamples = (req: { subject: string; level?: string; focus?: string; avoid: string[] }) => post<VisualSpec[]>('/api/examples', req);
export const fetchSandboxItem = (name: string, subject?: string, level?: string, lab?: LabKind) => post<SandboxItemSpec>('/api/sandbox-item', { name, subject, level, lab });
