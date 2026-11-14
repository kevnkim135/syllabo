import Anthropic from '@anthropic-ai/sdk';
import type { ExpandRequest, LessonKind, LessonMap, TopicDetail } from '../shared/types';
import { buildExpandPrompt, buildPrompt, SYSTEM } from './prompts';
import { expandFixture, fixture } from './fixtures';
import { validate, validateDetail } from './validate';

let client: Anthropic | null = null;

export const usingMock = () => !process.env.ANTHROPIC_API_KEY || process.env.MOCK_LLM === '1';

/** Mock responses, optionally delayed (MOCK_DELAY_MS) to rehearse real loading states. */
const mock = <T>(value: T) => {
  const ms = Number(process.env.MOCK_DELAY_MS ?? 0) * (0.5 + Math.random());
  return new Promise<T>((r) => setTimeout(() => r(value), ms));
};

// Cache by (subject, level, kind). In-flight promises are cached too, so duplicate
// requests (e.g. React StrictMode double effects) share one model call.
const cache = new Map<string, Promise<unknown>>();
const MAX_CACHE = 200;

export function generateLesson<K extends LessonKind>(
  subject: string,
  kind: K,
  level = 'high school',
): Promise<LessonMap[K] | undefined> {
  if (usingMock()) return mock(fixture(kind, subject));

  const key = `${kind}|${level.toLowerCase()}|${subject.toLowerCase()}`;
  const hit = cache.get(key);
  if (hit) return hit as Promise<LessonMap[K] | undefined>;

  const p = generateUncached(subject, kind, level).then((data) => {
    if (data === undefined) cache.delete(key); // never cache failures
    return data;
  }, (err) => {
    cache.delete(key);
    throw err;
  });
  if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value!);
  cache.set(key, p);
  return p;
}

/** Click-to-expand deeper explanation for one topic. Cached like lessons. */
export function expandTopic(req: ExpandRequest): Promise<TopicDetail | undefined> {
  if (usingMock()) return mock(expandFixture(req.topic));
  const level = req.level ?? 'high school';
  const key = `expand|${level.toLowerCase()}|${req.subject.toLowerCase()}|${(req.path ?? []).join('>').toLowerCase()}>${req.topic.toLowerCase()}`;
  const hit = cache.get(key);
  if (hit) return hit as Promise<TopicDetail | undefined>;
  const p = ask(buildExpandPrompt({ ...req, level }), validateDetail, req.topic).then(
    (d) => (d === undefined ? (cache.delete(key), d) : d),
    (e) => {
      cache.delete(key);
      throw e;
    },
  );
  if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value!);
  cache.set(key, p);
  return p;
}

function generateUncached<K extends LessonKind>(subject: string, kind: K, level: string) {
  return ask(buildPrompt(subject, kind, level), (raw) => validate(kind, raw), `${kind} for "${subject}"`);
}

async function ask<T>(firstPrompt: string, check: (raw: unknown) => T | undefined, label: string) {
  client ??= new Anthropic();
  let prompt = firstPrompt;
  // One retry: on invalid output, tell the model what went wrong.
  for (let attempt = 0; attempt < 2; attempt++) {
    const msg = await client.messages.create({
      model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-5-5',
      max_tokens: 8192,
      system: SYSTEM,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = msg.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');
    const data = check(extractJson(text));
    if (data !== undefined) return data;
    console.warn(`[llm] invalid output for ${label} (attempt ${attempt + 1})`);
    prompt += '\n\nYour previous reply was not valid JSON for this exact shape. Reply again with ONLY the JSON.';
  }
  return undefined;
}

/** Tolerates code fences or stray prose around the JSON. */
export function extractJson(text: string): unknown {
  const t = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    return JSON.parse(t);
  } catch {
    /* fall through */
  }
  const start = t.search(/[[{]/);
  const end = Math.max(t.lastIndexOf('}'), t.lastIndexOf(']'));
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(t.slice(start, end + 1));
    } catch {
      /* fall through */
    }
  }
  return undefined;
}
