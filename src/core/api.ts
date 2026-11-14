import type { ExpandRequest, LessonKind, LessonRequest, LessonResponse, TopicDetail } from '../../shared/types';

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

export const fetchExpand = (req: ExpandRequest) => post<TopicDetail>('/api/expand', req);
