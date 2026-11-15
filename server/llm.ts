import Anthropic from '@anthropic-ai/sdk';
import type { SandboxItemSpec, VisualSpec, ExpandRequest, IntentRequest, IntentResult, LessonKind, LessonMap, LessonRequest, MoleculeSpec, Problem, ReactionResult, ReactRequest, ScopeInfo, SolveRequest, TopicDetail } from '../shared/types';
import { ruleIntent } from '../shared/intentRules';
import { buildExamplesPrompt, buildExpandPrompt, buildSandboxItemPrompt, buildIntentPrompt, buildMoleculePrompt, buildPrompt, buildReactPrompt, buildScopePrompt, buildSolvePrompt, SYSTEM } from './prompts';
import { examplesFixture, expandFixture, fixture, sandboxItemFixture, moleculeFixture, reactFixture, scopeFixture, solveFixture } from './fixtures';
import { repairLatex, validate, validateDetail, validateIntent, validateMolecule, validateProblem, validateReaction, validateSandboxItem, validateScope, validateVisuals } from './validate';

let client: Anthropic | null = null;

export const usingMock = () => !process.env.ANTHROPIC_API_KEY || process.env.MOCK_LLM === '1';

/** Mock responses, optionally delayed (MOCK_DELAY_MS) to rehearse real loading states. */
const mock = <T>(value: T) => {
  const ms = Number(process.env.MOCK_DELAY_MS ?? 0) * (0.5 + Math.random());
  return new Promise<T>((r) => setTimeout(() => r(value), ms));
};

// In-flight promises are cached too, so duplicate requests share one model call. Failures are never cached.
const cache = new Map<string, Promise<unknown>>();
const MAX_CACHE = 300;
const keyOf = (...parts: unknown[]) => parts.map((p) => String(p ?? '').toLowerCase()).join('|');

function cached<T>(key: string, make: () => Promise<T | undefined>): Promise<T | undefined> {
  const hit = cache.get(key);
  if (hit) return hit as Promise<T | undefined>;
  const p = make().then(
    (d) => {
      if (d === undefined) cache.delete(key);
      return d;
    },
    (e) => {
      cache.delete(key);
      throw e;
    },
  );
  if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value!);
  cache.set(key, p);
  return p;
}

export function generateLesson<K extends LessonKind>(req: LessonRequest & { kind: K }): Promise<LessonMap[K] | undefined> {
  if (usingMock()) return mock(fixture(req.kind, req.subject, req));
  const key = keyOf('lesson', req.kind, req.level, req.subject, req.focus, req.request, req.variant, req.explored?.join(';'));
  return cached(key, () => ask(buildPrompt(req), (raw) => validate(req.kind, raw, req.explored), `${req.kind} for "${req.subject}"`));
}

/** Click-to-expand deeper explanation for one topic. */
export function expandTopic(req: ExpandRequest): Promise<TopicDetail | undefined> {
  if (usingMock()) return mock(expandFixture(req.topic));
  const key = keyOf('expand', req.level, req.subject, req.path?.join('>'), req.topic);
  return cached(key, () => ask(buildExpandPrompt(req), validateDetail, `expand "${req.topic}"`));
}

/** Is the typed subject a whole field or one concept? */
export function classifyScope(subject: string, level?: string): Promise<ScopeInfo | undefined> {
  if (usingMock()) return mock(scopeFixture(subject));
  return cached(keyOf('scope', level, subject), () => ask(buildScopePrompt(subject, level), validateScope, `scope "${subject}"`));
}

/** Solve a typed, spoken or photographed problem. Not cached. */
export function solveProblem(req: SolveRequest): Promise<Problem | undefined> {
  if (usingMock()) return mock(solveFixture(req));
  const text = buildSolvePrompt(req, !!req.image);
  const content: Anthropic.ContentBlockParam[] = req.image
    ? [
        { type: 'image', source: { type: 'base64', media_type: req.image.mediaType, data: req.image.data } },
        { type: 'text', text },
      ]
    : [{ type: 'text', text }];
  return ask(content, validateProblem, 'solve');
}

/** A batch of different example models (not cached: each call should bring new ones). */
export function makeExamples(req: { subject: string; level?: string; focus?: string; avoid?: string[] }): Promise<VisualSpec[] | undefined> {
  if (usingMock()) return mock(examplesFixture(req.subject, req.avoid ?? []));
  return ask(buildExamplesPrompt(req), validateVisuals, `examples for "${req.subject}"`, 16000);
}

/** Whatever the student asked to put in the sandbox: a molecule, or a physical body with mass. Cached. */
export function makeSandboxItem(name: string, subject?: string, level?: string): Promise<SandboxItemSpec | undefined> {
  if (usingMock()) return mock(sandboxItemFixture(name));
  return cached(keyOf('sandbox-item', name, subject), () => ask(buildSandboxItemPrompt(name, subject, level), validateSandboxItem, `sandbox item "${name}"`));
}

/** One molecule by name, for the chemistry sandbox. Cached. */
export function makeMolecule(name: string): Promise<MoleculeSpec | undefined> {
  if (usingMock()) return mock(moleculeFixture(name));
  return cached(keyOf('molecule', name), () => ask(buildMoleculePrompt(name), validateMolecule, `molecule "${name}"`));
}

/** What happens when sandbox molecules meet under a condition. Cached by reactants and condition. */
export function react(req: ReactRequest): Promise<ReactionResult | undefined> {
  if (usingMock()) return mock(reactFixture(req));
  const key = keyOf('react', req.level, req.condition, ...req.reactants.map((r) => `${r.count ?? 1}x${r.name}`).sort());
  return cached(key, () => ask(buildReactPrompt(req), validateReaction, 'reaction'));
}

/**
 * Understand a spoken request in the context of the current lesson. Uses the model when a key is set,
 * and the shared rules otherwise or if the model call fails, so voice always does something sensible.
 */
export async function resolveIntent(req: IntentRequest): Promise<IntentResult> {
  if (usingMock()) return ruleIntent(req.transcript, req.context);
  try {
    const result = await ask(buildIntentPrompt(req), validateIntent, 'intent', 1024);
    if (result) return result.say ? result : { ...result, say: ruleIntent(req.transcript, req.context).say };
  } catch (e) {
    console.warn('[llm] intent failed, using rules:', (e as Error).message);
  }
  return ruleIntent(req.transcript, req.context);
}

async function ask<T>(first: string | Anthropic.ContentBlockParam[], check: (raw: unknown) => T | undefined, label: string, maxTokens = 8192) {
  client ??= new Anthropic();
  const content: Anthropic.ContentBlockParam[] = typeof first === 'string' ? [{ type: 'text', text: first }] : [...first];
  // One retry: on invalid output, tell the model what went wrong.
  for (let attempt = 0; attempt < 2; attempt++) {
    const msg = await client.messages.create({
      model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-5-5',
      max_tokens: maxTokens,
      system: SYSTEM,
      messages: [{ role: 'user', content }],
    });
    const text = msg.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');
    const data = check(repairAll(extractJson(text)));
    if (data !== undefined) return data;
    console.warn(`[llm] invalid output for ${label} (attempt ${attempt + 1})`);
    content.push({ type: 'text', text: 'Your previous reply was not valid JSON for this exact shape. Reply again with ONLY the JSON.' });
  }
  return undefined;
}

/** Repair LaTeX that lost its backslashes to JSON escapes, in every string of a parsed reply. */
function repairAll(v: unknown): unknown {
  if (typeof v === 'string') return repairLatex(v);
  if (Array.isArray(v)) return v.map(repairAll);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, repairAll(x)]));
  return v;
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
    const body = t.slice(start, end + 1);
    try {
      return JSON.parse(body);
    } catch {
      /* fall through */
    }
    // LaTeX written with single backslashes ("\sqrt", "\alpha", "\cdot") is an invalid JSON escape and
    // breaks the whole reply: double every backslash that does not start a valid escape, then parse again.
    try {
      return JSON.parse(body.replace(/\\\\|\\(?!["\\/bfnrtu])/g, (m) => (m.length === 2 ? m : '\\\\')));
    } catch {
      /* fall through */
    }
  }
  return undefined;
}
