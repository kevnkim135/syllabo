// Rule-based voice intent: used when no API key is set (mock mode), when the model call fails, and
// in the browser if the server cannot be reached. The model-backed version (server/llm.ts) is smarter
// about phrasing; these rules cover the common sentences and make the same related/unrelated call by
// comparing the requested topic with the current subject and its known topics.
import type { IntentContext, IntentResult, LessonKind, VoiceIntent } from './types';

const SECTION_WORDS: [RegExp, LessonKind, string][] = [
  [/\b(?:interactive |3d )?(?:model|visual|visualization)s?\b/, 'visual', 'the model'],
  [/\b(?:history|timeline)\b/, 'timeline', 'history'],
  [/\b(?:topic map|topics|overview|notes|outline)\b/, 'topics', 'the topic map'],
  [/\b(?:problems?|practice|exercises|quiz)\b/, 'problems', 'problems'],
];
const STOP = new Set(['the', 'a', 'an', 'of', 'and', 'in', 'on', 'to', 'for', 'about', 'with', 'how', 'what', 'why', 'is', 'are', 'it', 'its', 'this', 'that', 'me', 'my', 'some', 'more', 'into']);
const words = (s: string) => (s.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((w) => w.length > 2 && !STOP.has(w)).map((w) => w.replace(/s$/, ''));

const clean = (t: string) =>
  t
    .toLowerCase()
    .trim()
    .replace(/[.?!]+$/, '')
    .replace(/^(?:(?:hey|ok|okay|so|um|uh|now|and|then|alright|all right|please|lesson ?lab)[\s,]+)+/, '')
    .replace(/^(?:can you|could you|would you|will you|please|i want you to|i'd like you to)\s+/, '')
    .replace(/[\s,]+(?:please|thanks|thank you)$/, '')
    .replace(/\s+/g, ' ');

const tidyTopic = (s: string) =>
  s
    .replace(/^(?:about|on|into|to|with)\s+/, '')
    .replace(/^(?:the (?:topic|subject|idea|concept) of|the|a|an|some)\s+/, '')
    .replace(/\s+(?:instead|now|next|please|for a bit|for a while)$/, '')
    .trim();

/** Best fuzzy match of `query` among `titles` (most shared words), or undefined. */
export function matchTitle(query: string, titles: string[] = []): string | undefined {
  const q = new Set(words(query));
  if (!q.size) return undefined;
  let best: { t: string; score: number } | undefined;
  for (const t of titles) {
    const w = words(t);
    const hits = w.filter((x) => q.has(x)).length;
    const score = hits / Math.max(q.size, 1);
    if (hits && (!best || score > best.score)) best = { t, score };
  }
  return best && best.score >= 0.5 ? best.t : undefined;
}

/** Does `topic` belong to the current subject? Shares a meaningful word with it or with one of its known topics. */
export function relatedToSubject(topic: string, ctx: IntentContext): boolean {
  if (!ctx.subject) return false;
  const t = new Set(words(topic));
  const pool = [ctx.subject, ctx.focus ?? '', ...(ctx.topics ?? [])].flatMap(words);
  return pool.some((w) => t.has(w));
}

const SAY: Record<LessonKind, string> = { visual: 'the model', timeline: 'history', topics: 'the topic map', problems: 'problems' };

export function ruleIntent(transcript: string, ctx: IntentContext = {}): IntentResult {
  const t = clean(transcript);
  const r = (intent: VoiceIntent, say: string): IntentResult => ({ intent, say });
  if (!t) return r({ action: 'none' }, "I didn't catch that.");

  // save / library / open
  const save = /\b(?:save|bookmark|keep|store)\b(?: (?:this|it|the lesson|this lesson|that))?(?:.*?\b(?:in|into|to|under)\s+(?:the |my |a )?(?:folder (?:called |named )?)?(.+?)(?: folder)?)?$/.exec(t);
  if (save) {
    const folder = save[1]?.trim();
    return r({ action: 'save', folder }, folder ? `Saved to "${folder}"` : 'Saved this lesson');
  }
  if (/\b(?:my |the )?(?:library|saved lessons|saved stuff|folders)\b/.test(t) && /\b(?:open|show|go|see|view|take)\b|^(?:my |the )?library$/.test(t)) return r({ action: 'library' }, 'Opening your library');
  const open = /^(?:open|reopen|load|go back to|return to|pull up|bring up|switch (?:back )?to|resume)\s+(?:my |the )?(?:saved |old |previous )?(.+?)(?: lesson| one)?$/.exec(t);
  if (open) {
    const title = matchTitle(open[1], [...(ctx.open ?? []), ...(ctx.saved ?? [])]);
    if (title) return r({ action: 'open', title }, `Opening ${title}`);
  }

  // chemistry sandbox
  const inBox = ctx.sandbox !== undefined || /\bsandbox\b/.test(t);
  if (/\b(?:open|show|go to|start|use)\b.*\bsandbox\b|^sandbox$/.test(t)) return r({ action: 'sandbox' }, 'Opening the sandbox');
  if (/\b(?:clear|empty|reset)\b.*\bsandbox\b|^clear (?:it|everything|all)$/.test(t)) return r({ action: 'sandboxClear' }, 'Cleared the sandbox');
  const NUM: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };
  const add = /^(?:add|put|place|drop|bring in|throw in|insert)\s+(?:(a|an|one|two|three|four|five|six|\d)\s+)?(?:molecules? of\s+)?(.+?)(?:\s+molecules?)?(?:\s+(?:to|into|in) (?:the )?sandbox)?$/.exec(t);
  if (add && (inBox || /\bsandbox\b/.test(t))) {
    const count = add[1] ? (NUM[add[1]] ?? Number(add[1])) : 1;
    const name = add[2].replace(/\s+and\s+.*$/, '').replace(/s$/, (m) => (count > 1 ? '' : m));
    return r({ action: 'sandboxAdd', name, count }, `Adding ${count > 1 ? `${count} ` : ''}${name}`);
  }
  if (inBox) {
    const react = /\b(?:react|mix|combine|heat|ignite|burn|spark|light)\b/.exec(t);
    if (react) {
      const cond = /\b(?:with|using|under|add(?:ing)?|in)\s+(?:some\s+|a\s+|an\s+)?(heat|a spark|spark|fire|flame|light|water|(?:an? )?(?:\w+ )?catalyst|acid|base|pressure)\b/.exec(t)?.[1] ??
        (/\b(?:heat|ignite|burn|spark|light)\b/.test(t) ? 'heat' : undefined);
      return r({ action: 'sandboxReact', condition: cond }, cond ? `Reacting them with ${cond}` : 'Reacting them');
    }
    const move = /^(?:move|push|pull|put|shift|slide|bring|take)\s+(.+?)\s+(?:to the |over to the |towards? the |a bit |)?(left|right|up|down|closer|nearer|farther|further|away|back|forward|together|apart)\b/.exec(t);
    if (move) {
      const dirMap: Record<string, 'left' | 'right' | 'up' | 'down' | 'closer' | 'farther' | 'together' | 'apart'> = {
        left: 'left', right: 'right', up: 'up', down: 'down', closer: 'closer', nearer: 'closer', forward: 'closer', farther: 'farther', further: 'farther', away: 'farther', back: 'farther', together: 'together', apart: 'apart',
      };
      return r({ action: 'sandboxMove', target: move[1], direction: dirMap[move[2]] }, `Moving ${move[1]} ${move[2]}`);
    }
    const remove = /^(?:remove|delete|take out|get rid of)\s+(.+)$/.exec(t);
    if (remove) return r({ action: 'sandboxRemove', target: remove[1] }, `Removing ${remove[1]}`);
  }

  // navigation
  if (/^(?:(?:go|take me|return|back)(?: back)?(?: to)? )?(?:the )?home(?: page| screen)?$|\bgo home\b|^start over$/.test(t)) return r({ action: 'home' }, 'Going home');
  if (/\b(?:whole|entire|overall|general|broader|bigger) (?:subject|topic|picture)\b|\bwiden\b|\bzoom out of (?:the|this) topic\b|\bback to the (?:main|whole) (?:subject|topic)\b/.test(t)) return r({ action: 'widen' }, 'Back to the whole subject');
  // models (before sections, so "previous model" is not "open the model")
  if (/\b(?:next|following) (?:model|one)\b|\bswipe (?:left|forward)\b/.test(t)) return r({ action: 'modelStep', step: 1 }, 'Next model');
  if (/\b(?:previous|last|prior) (?:model|one)\b|\bgo back a model\b/.test(t)) return r({ action: 'modelStep', step: -1 }, 'Previous model');
  if (/\b(?:new|another|different|random|other) (?:example|model|molecule|shape|graph|diagram)\b|\b(?:another|a different) one\b|\bsomething else\b|\bsurprise me\b/.test(t)) return r({ action: 'newExample' }, 'Building a new example');

  const nav = /^(?:(?:go|head|jump|switch|move|take me|bring me)(?: back| over)? to |back to |open |show(?: me)? |see |view |pull up )?(?:the |my )?(.+?)(?: section| tab| page)?$/.exec(t);
  if (nav) {
    const hit = SECTION_WORDS.find(([re]) => re.test(nav[1]) && nav[1].split(' ').length <= 3);
    if (hit && !/\bof\b/.test(nav[1])) return r({ action: 'goto', section: hit[1] }, `Opening ${hit[2]}`);
  }

  // solve
  const solve =
    /\b(?:solve|work out|how (?:do|would|can|should) (?:i|you|we) (?:solve|find|do|calculate|work out)|help me (?:with|solve|find|do))\s+(?:this:?\s+)?(.{3,})/.exec(t) ??
    /\b((?:calculate|compute|evaluate|simplify|factor(?:ise|ize)?|differentiate|integrate|find the (?:derivative|integral|roots?|value|area|slope|solution)) .{3,})/.exec(t);
  if (solve) return r({ action: 'solve', question: solve[1] }, `Solving "${solve[1]}"`);

  // build a model: "show me benzene", "graph x squared", "what does methane look like"
  const looks = /\bwhat (?:does|do) (?:an?\s+|the\s+)?(.{2,}?) looks? like/.exec(t);
  const gen = looks ?? /\b(?:show me|show us|draw|graph|plot|model|build|render|visuali[sz]e|let me see|can (?:i|we) see)\s+(?:an?\s+|the\s+|some\s+)?(?:(?:3d |interactive )?(?:model|diagram|graph|picture) of\s+(?:an?\s+|the\s+)?)?(.{3,})/.exec(t);
  if (gen && !/\b(?:history|timeline|topics|problems)\b/.test(gen[1])) return r({ action: 'model', request: gen[1] }, `Building a model of ${gen[1]}`);

  // change topic: related -> focus this lesson, unrelated -> new lesson
  const topicRe =
    /^(?:let'?s|let us|i want to|i'd like to|i wanna|can we|could we|time to|now|okay now)?\s*(?:learn|study|talk|dive|go|move|switch|jump|look|get)(?: (?:about|into|on to|onto|on|to|at|over to|more about))?\s+(.{3,})|\b(?:teach me|tell me about|explain|what about|how about|i'?m curious about|change (?:the )?(?:topic|subject) to|new (?:topic|subject|lesson)(?: on| about|:)?)\s+(.{3,})/;
  const m = topicRe.exec(t);
  if (m) {
    const topic = tidyTopic(m[1] ?? m[2]);
    if (topic) {
      if (relatedToSubject(topic, ctx)) return r({ action: 'focus', topic }, `Focusing on ${topic}`);
      return r({ action: 'newLesson', subject: topic }, `Starting a new lesson on ${topic}`);
    }
  }
  return r({ action: 'none' }, `I'm not sure what to do with "${transcript.trim()}".`);
}
