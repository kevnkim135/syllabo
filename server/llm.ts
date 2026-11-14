import Anthropic from '@anthropic-ai/sdk';
import type { LessonKind, LessonMap } from '../shared/types';
import { buildPrompt, SYSTEM } from './prompts';
import { fixture } from './fixtures';

let client: Anthropic | null = null;

export const usingMock = () => !process.env.ANTHROPIC_API_KEY || process.env.MOCK_LLM === '1';

export async function generateLesson<K extends LessonKind>(
  subject: string,
  kind: K,
  level?: string,
): Promise<LessonMap[K] | undefined> {
  if (usingMock()) return fixture(kind, subject);

  client ??= new Anthropic();
  const msg = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-5-5',
    max_tokens: 4096,
    system: SYSTEM,
    messages: [{ role: 'user', content: buildPrompt(subject, kind, level) }],
  });
  const text = msg.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');
  return extractJson(text) as LessonMap[K] | undefined;
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
