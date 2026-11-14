import type { LessonKind, LessonRequest, LessonResponse } from '../../shared/types';

export async function fetchLesson<K extends LessonKind>(req: LessonRequest & { kind: K }): Promise<LessonResponse<K>> {
  const res = await fetch('/api/lesson', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
  return body as LessonResponse<K>;
}
