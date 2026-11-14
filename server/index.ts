import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { LESSON_KINDS, type LessonRequest } from '../shared/types';
import { generateLesson, usingMock } from './llm';

try {
  process.loadEnvFile();
} catch {
  /* no .env file: fine, falls back to mock mode */
}

const app = new Hono();

app.get('/api/health', (c) => c.json({ ok: true, mock: usingMock() }));

app.post('/api/lesson', async (c) => {
  const { subject, kind, level } = await c.req.json<LessonRequest>();
  if (!subject?.trim() || !LESSON_KINDS.includes(kind)) {
    return c.json({ error: `subject and kind (${LESSON_KINDS.join('|')}) are required` }, 400);
  }
  const data = await generateLesson(subject.trim(), kind, level);
  if (data === undefined) return c.json({ error: 'Model returned invalid JSON, try again' }, 502);
  return c.json({ kind, subject, data });
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
