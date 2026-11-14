import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { LESSON_KINDS, type ExpandRequest, type LessonRequest } from '../shared/types';
import { expandTopic, generateLesson, usingMock } from './llm';

try {
  process.loadEnvFile();
} catch {
  /* no .env file: fine, falls back to mock mode */
}

const app = new Hono();

app.get('/api/health', (c) => c.json({ ok: true, mock: usingMock() }));

app.post('/api/lesson', async (c) => {
  const body = await c.req.json<Partial<LessonRequest>>().catch(() => ({}) as Partial<LessonRequest>);
  const { subject, kind, level } = body;
  if (typeof subject !== 'string' || !subject.trim() || !kind || !LESSON_KINDS.includes(kind)) {
    return c.json({ error: `subject and kind (${LESSON_KINDS.join('|')}) are required` }, 400);
  }
  if (subject.length > 200) return c.json({ error: 'subject too long (max 200 chars)' }, 400);
  const data = await generateLesson(subject.trim(), kind, typeof level === 'string' ? level : undefined);
  if (data === undefined) return c.json({ error: 'Model returned invalid JSON, try again' }, 502);
  return c.json({ kind, subject, data });
});

app.post('/api/expand', async (c) => {
  const b = await c.req.json<Partial<ExpandRequest>>().catch(() => ({}) as Partial<ExpandRequest>);
  if (typeof b.subject !== 'string' || typeof b.topic !== 'string' || !b.subject.trim() || !b.topic.trim()) {
    return c.json({ error: 'subject and topic are required' }, 400);
  }
  if (b.subject.length > 200 || b.topic.length > 200) return c.json({ error: 'subject/topic too long' }, 400);
  const path = Array.isArray(b.path) ? b.path.filter((p) => typeof p === 'string').slice(0, 6) : [];
  const data = await expandTopic({
    subject: b.subject.trim(),
    topic: b.topic.trim(),
    path,
    level: typeof b.level === 'string' ? b.level : undefined,
  });
  if (data === undefined) return c.json({ error: 'Model returned invalid JSON, try again' }, 502);
  return c.json(data);
});

// Production: serve the built frontend from the same process.
app.use('/*', serveStatic({ root: './dist' }));

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: err.message }, 500);
});

const port = Number(process.env.PORT ?? 8787);
serve({ fetch: app.fetch, port });
console.log(`API on http://localhost:${port}${usingMock() ? ' (MOCK mode: no LLM calls)' : ''}`);
