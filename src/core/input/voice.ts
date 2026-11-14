// Voice. Short, unambiguous phrases (open a section, camera moves, next / new model) are handled right here
// so they feel instant. Everything else, a whole sentence like "let's look at photosynthesis instead" or
// "save this to my chemistry folder", goes to core/assistant.ts as an `ask`, which works out what it
// means in the context of the current lesson (with Claude when a key is set, shared rules otherwise). `parseVoiceCommand` and `createVoiceSession` are pure and unit tested.
import type { LessonKind } from '../../../shared/types';
import { commands, type Command } from '../commands';

// ---- camera fallback: every matching phrase fires ----
const CAMERA: [RegExp, Command][] = [
  [/zoom in|closer|bigger|enlarge|magnify/, { type: 'zoom', factor: 0.75 }],
  [/zoom out|farther|further|smaller|shrink/, { type: 'zoom', factor: 1.33 }],
  [/(rotate|turn|spin) (?:it |that )?(?:to the )?left/, { type: 'rotate', dx: -0.5, dy: 0 }],
  [/(rotate|turn|spin) (?:it |that )?(?:to the )?right/, { type: 'rotate', dx: 0.5, dy: 0 }],
  [/(rotate|tilt|turn) (?:it |that )?up/, { type: 'rotate', dx: 0, dy: -0.4 }],
  [/(rotate|tilt|turn) (?:it |that )?down/, { type: 'rotate', dx: 0, dy: 0.4 }],
  [/top view|from above|from the top/, { type: 'view', view: 'top' }],
  [/front view|from the front/, { type: 'view', view: 'front' }],
  [/side view|from the side/, { type: 'view', view: 'side' }],
  [/reset|recenter|center/, { type: 'reset' }],
  [/^next$/, { type: 'next' }],
  [/^(?:previous|go back)$/, { type: 'prev' }],
];

// ---- navigation: "go to history", "open the topic map", "problems", "go home", "next section" ----
const GO = String.raw`(?:(?:(?:go|head|jump|switch|move|navigate|take me|bring me)(?: back| over)? to|back to|open(?: up)?|show(?: me)?|see|view|bring up|pull up|display)\s+)?(?:the\s+|my\s+)?`;
const END = String.raw`(?:\s+(?:section|tab|page|view))?$`;
const SECTIONS: [string, LessonKind][] = [
  ['(?:interactive |3d |three d )?(?:model|visual|visualization|stage)', 'visual'],
  ['(?:history|timeline|time line)', 'timeline'],
  ['(?:topic map|topics?|overview|notes|outline|concepts)', 'topics'],
  ['(?:practice )?(?:problems?|practice|exercises|questions|quiz)', 'problems'],
];
const NAV: [RegExp, Command][] = [
  // The section name must END the phrase, so "show me the model of benzene" is a content request, not navigation.
  ...SECTIONS.map(([names, section]): [RegExp, Command] => [new RegExp(`^${GO}${names}${END}`), { type: 'goto', section }]),
  [/^(?:go to |show(?: me)? )?(?:the )?next (?:model|one)$|^swipe left$/, { type: 'modelStep', step: 1 }],
  [/^(?:go (?:back )?to |show(?: me)? )?(?:the )?(?:previous|last) (?:model|one)$|^swipe right$/, { type: 'modelStep', step: -1 }],
  [/\b(?:new|another|different|random|other) (?:example|model|molecule|shape|graph)\b|\bnext example\b|\b(?:another|a different) one\b|\bsomething else\b|\b(?:change|switch|swap) (?:the |this )?(?:example|model)\b|\btry another\b|\bsurprise me\b/, { type: 'newExample' }],
  [/^(?:(?:go|take me|return|back)(?: back)?(?: to)? )?(?:the )?home(?: page| screen)?$|\bgo home\b|^start over$|^(?:go to |open )?(?:the )?main (?:page|menu)$|^(?:start a )?new (?:lesson|subject)$/, { type: 'home' }],
  [/^(?:go |move |skip )?(?:to (?:the )?)?(?:next|forward)(?: section| tab| page)?$|^(?:scroll|move|go) down$/, { type: 'next' }],
  [/^(?:go |move )?(?:to (?:the )?)?(?:previous|back|last)(?: section| tab| page)?$|^go back$|^(?:scroll|move|go) up$/, { type: 'prev' }],
];

// ---- content ----
// "solve two x plus three equals seven", "help me with ...": the verb is dropped.
const SOLVE = /\b(?:solve|work out|how (?:do|would|can|should) (?:i|you|we) (?:solve|find|do|calculate|work out)|help me (?:with|solve|find|do))\s+(?:this:?\s+)?(.{3,})/;
// "simplify ...", "factor ...": the verb is part of the question, so it is kept.
const SOLVE_KEEP = /\b((?:calculate|compute|evaluate|simplify|factor(?:ise|ize)?|expand|differentiate|integrate|find the (?:derivative|integral|roots?|value|area|slope|solution)) .{3,})/;
// "show me benzene", "graph x squared minus y squared", "what does methane look like".
const LOOKS = /\bwhat (?:does|do) (?:an?\s+|the\s+)?(.{2,}?) looks? like/;
const GENERATE = /\b(?:show me|show us|show|generate|draw|graph|plot|model|create|build|visuali[sz]e|render|display|give me|let me see|let's see|can (?:i|we) see|i (?:want|would like|need) to see)\s+(?:an?\s+|the\s+|some\s+)?(.{3,})/;
const WRAPPER = /^(?:(?:3d |interactive )?(?:model|picture|diagram|drawing|visual|image|example) of\s+)(?:an?\s+|the\s+)?/;
// Polite or filler openings and endings that carry no meaning.
const FILLER = /^(?:(?:hey|ok|okay|so|um|uh|now|and|then|please|lesson ?lab|can you|could you|would you|will you|i want you to|i'd like you to)[\s,]+)+/;

const normalize = (transcript: string) =>
  transcript
    .toLowerCase()
    .trim()
    .replace(/[.?!,]+$/, '')
    .replace(FILLER, '')
    .replace(/[\s,]+(?:please|thanks|thank you)$/, '')
    .replace(/\s+/g, ' ');

/** Navigation and content requests win over camera phrases, so "show me a rotating top" is not a rotate command. */
export function parseVoiceCommand(transcript: string): Command[] {
  const t = normalize(transcript);
  if (!t) return [];
  const nav = NAV.find(([re]) => re.test(t));
  if (nav) return [nav[1]];
  const solve = SOLVE.exec(t) ?? SOLVE_KEEP.exec(t);
  if (solve) return [{ type: 'solve', question: solve[1] }];
  const gen = LOOKS.exec(t) ?? GENERATE.exec(t);
  if (gen) return [{ type: 'generate', request: gen[1].replace(WRAPPER, '') || gen[1] }];
  return CAMERA.filter(([re]) => re.test(t)).map(([, cmd]) => cmd);
}

const SECTION_NAMES: Record<LessonKind, string> = { visual: 'the model', timeline: 'history', topics: 'the topic map', problems: 'problems' };

/** What we did, in words, for the "heard / did" readout. */
export function describeCommand(cmd: Command): string {
  switch (cmd.type) {
    case 'goto':
      return `Opening ${SECTION_NAMES[cmd.section]}`;
    case 'home':
      return 'Going home';
    case 'next':
      return 'Next section';
    case 'prev':
      return 'Previous section';
    case 'newExample':
      return 'New example';
    case 'generate':
      return `Building a model of "${cmd.request}"`;
    case 'solve':
      return `Solving "${cmd.question}"`;
    case 'zoom':
      return cmd.factor < 1 ? 'Zooming in' : 'Zooming out';
    case 'rotate':
    case 'rotateAxis':
      return 'Rotating';
    case 'view':
      return `${cmd.view[0].toUpperCase()}${cmd.view.slice(1)} view`;
    case 'reset':
      return 'Resetting the view';
    case 'modelStep':
      return cmd.step > 0 ? 'Next model' : 'Previous model';
    case 'ask':
      return 'Thinking…';
    default:
      return '';
  }
}

export interface VoiceEvent {
  transcript: string;
  final: boolean;
  actions: string[]; // what was done because of this result (may be empty)
}

/**
 * Turns the recognizer's stream of interim and final results into commands, each fired once.
 * - Quick commands (navigation, camera, new example) fire on INTERIM results so they feel instant,
 *   but only when the phrase has at least two words and could not still grow into a content request.
 * - Content requests (generate / solve) wait for the FINAL result, because they need the whole sentence.
 * `index` is the recognizer's result index: one utterance keeps one index while it is revised.
 */
export function createVoiceSession(emit: (cmd: Command) => void = commands.emit) {
  const fired = new Map<number, Set<string>>();
  return {
    handle(index: number, transcript: string, isFinal: boolean): VoiceEvent {
      const t = normalize(transcript);
      const cmds = parseVoiceCommand(transcript);
      const done = fired.get(index) ?? new Set<string>();
      fired.set(index, done);
      const actions: string[] = [];
      const mayGrow = !isFinal && (t.split(' ').length < 2 || GENERATE.test(t) || SOLVE.test(t) || SOLVE_KEEP.test(t) || /^(?:what|how)\b/.test(t));
      // A finished sentence that is not a quick command goes to the assistant, which knows the lesson
      // context (a content request, a topic change, saving, reopening a lesson...).
      const quick = cmds.filter((c) => c.type !== 'generate' && c.type !== 'solve');
      if (isFinal && !quick.length && t.split(' ').length >= 2 && done.size === 0) {
        const ask: Command = { type: 'ask', text: transcript.trim() };
        emit(ask);
        actions.push(describeCommand(ask));
        fired.delete(index);
        return { transcript: transcript.trim(), final: isFinal, actions };
      }
      for (const cmd of quick) {
        const content = false;
        if (!isFinal && (content || mayGrow)) continue;
        // If an interim result already acted on this utterance, the final result must not add a
        // second, different quick command (for example "next" and then "next example").
        const key = JSON.stringify(cmd);
        if (done.has(key) || (isFinal && done.size > 0 && !content)) continue;
        done.add(key);
        emit(cmd);
        actions.push(describeCommand(cmd));
      }
      if (isFinal) fired.delete(index);
      return { transcript: transcript.trim(), final: isFinal, actions };
    },
    reset: () => fired.clear(),
  };
}

/**
 * Web Speech API (Chrome / Edge). Returns a stop function, or null if unsupported.
 * `onEvent` receives every interim and final transcript with the actions taken; `onError` a readable message.
 */
export function startVoice(onEvent?: (e: VoiceEvent) => void, onError?: (message: string) => void): (() => void) | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  if (!SR) return null;

  const rec = new SR();
  rec.continuous = true;
  rec.interimResults = true;
  rec.maxAlternatives = 1;
  rec.lang = 'en-US';
  let stopped = false;
  const session = createVoiceSession();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rec.onresult = (e: any) => {
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const transcript: string = e.results[i][0].transcript;
      if (transcript.trim()) onEvent?.(session.handle(i, transcript, e.results[i].isFinal));
    }
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rec.onerror = (e: any) => {
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
      stopped = true;
      onError?.('Microphone access was blocked. Allow it in the address bar and try again.');
    } else if (e.error === 'audio-capture') {
      stopped = true;
      onError?.('No microphone was found.');
    } else if (e.error === 'network') onError?.('Speech recognition needs an internet connection.');
    // "no-speech" and "aborted" are routine; onend restarts the session.
  };
  rec.onend = () => {
    session.reset(); // result indices start again at 0 in the next session
    if (stopped) return;
    try {
      rec.start(); // Chrome ends sessions periodically; keep listening.
    } catch {
      /* already started */
    }
  };
  rec.start();

  return () => {
    stopped = true;
    rec.stop();
  };
}
