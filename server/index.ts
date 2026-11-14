import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono, type Context } from 'hono';
import { IMAGE_TYPES, LESSON_KINDS, type ExpandRequest, type IntentContext, type IntentRequest, type LessonRequest, type ReactRequest, type SolveRequest } from '../shared/types';
import { classifyScope, expandTopic, generateLesson, makeMolecule, react, resolveIntent, solveProblem, usingMock } from './llm';

try {
  process.loadEnvFile();
} catch {
  /* no .env file: fine, falls back to mock mode */
}

const app = new Hono();
const MAX_TEXT = 200;
const MAX_IMAGE_B64 = 7_000_000; // about 5 MB of image

const json = async <T>(c: Context) => (await c.req.json<Partial<T>>().catch(() => ({}))) as Partial<T>;
/** Trimmed string within the length limit, else undefined. */
const text = (v: unknown, max = MAX_TEXT) => (typeof v === 'string' && v.trim() && v.length <= max ? v.trim() : undefined);
const list = (v: unknown, max: number) => (Array.isArray(v) ? v.flatMap((x) => text(x) ?? []).slice(0, max) : undefined);
const invalid = 'Model returned invalid JSON, try again';

app.get('/api/health', (c) => c.json({ ok: true, mock: usingMock() }));

app.post('/api/lesson', async (c) => {
  const b = await json<LessonRequest>(c);
  const subject = text(b.subject);
  if (!subject || !b.kind || !LESSON_KINDS.includes(b.kind)) {
    return c.json({ error: `subject (max ${MAX_TEXT} chars) and kind (${LESSON_KINDS.join('|')}) are required` }, 400);
  }
  const data = await generateLesson({
    subject,
    kind: b.kind,
    level: text(b.level),
    focus: text(b.focus),
    explored: list(b.explored, 12),
    request: text(b.request),
    variant: Number.isInteger(b.variant) && b.variant! > 0 ? b.variant : undefined,
  });
  if (data === undefined) return c.json({ error: invalid }, 502);
  return c.json({ kind: b.kind, subject, data });
});

app.post('/api/expand', async (c) => {
  const b = await json<ExpandRequest>(c);
  const subject = text(b.subject);
  const topic = text(b.topic);
  if (!subject || !topic) return c.json({ error: 'subject and topic are required' }, 400);
  const data = await expandTopic({ subject, topic, path: list(b.path, 6) ?? [], level: text(b.level) });
  if (data === undefined) return c.json({ error: invalid }, 502);
  return c.json(data);
});

app.post('/api/scope', async (c) => {
  const b = await json<{ subject: string; level: string }>(c);
  const subject = text(b.subject);
  if (!subject) return c.json({ error: 'subject is required' }, 400);
  const data = await classifyScope(subject, text(b.level));
  if (data === undefined) return c.json({ error: invalid }, 502);
  return c.json(data);
});

app.post('/api/solve', async (c) => {
  const b = await json<SolveRequest>(c);
  const subject = text(b.subject);
  const question = text(b.question, 2000);
  const img = b.image;
  const image =
    img && IMAGE_TYPES.includes(img.mediaType) && typeof img.data === 'string' && img.data.length <= MAX_IMAGE_B64 ? img : undefined;
  if (img && !image) return c.json({ error: 'image must be png, jpeg, webp or gif under 5 MB' }, 400);
  if (!subject || (!question && !image)) return c.json({ error: 'subject and a question or image are required' }, 400);
  const data = await solveProblem({ subject, level: text(b.level), focus: text(b.focus), question, image });
  if (data === undefined) return c.json({ error: invalid }, 502);
  return c.json(data);
});

app.post('/api/intent', async (c) => {
  const b = await json<IntentRequest>(c);
  const transcript = text(b.transcript, 500);
  if (!transcript) return c.json({ error: 'transcript is required' }, 400);
  const x = (b.context ?? {}) as Partial<IntentContext>;
  const context: IntentContext = {
    subject: text(x.subject),
    focus: text(x.focus),
    section: x.section && LESSON_KINDS.includes(x.section) ? x.section : undefined,
    model: text(x.model),
    topics: list(x.topics, 30),
    open: list(x.open, 20),
    saved: list(x.saved, 50),
    folders: list(x.folders, 30),
    sandbox: list(x.sandbox, 20),
  };
  return c.json(await resolveIntent({ transcript, context }));
});

app.post('/api/molecule', async (c) => {
  const name = text((await json<{ name: string }>(c)).name, 80);
  if (!name) return c.json({ error: 'name is required' }, 400);
  const data = await makeMolecule(name);
  if (data === undefined) return c.json({ error: invalid }, 502);
  return c.json(data);
});

app.post('/api/react', async (c) => {
  const b = await json<ReactRequest>(c);
  const reactants = (Array.isArray(b.reactants) ? b.reactants : []).slice(0, 12).flatMap((r) => {
    const name = text(r?.name, 80);
    return name ? [{ name, formula: text(r.formula, 40), count: Number.isInteger(r.count) && r.count! > 0 && r.count! <= 12 ? r.count : 1 }] : [];
  });
  if (!reactants.length) return c.json({ error: 'at least one reactant is required' }, 400);
  const data = await react({ reactants, condition: text(b.condition, 120), level: text(b.level) });
  if (data === undefined) return c.json({ error: invalid }, 502);
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
