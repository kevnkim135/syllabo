import { commands, type Command } from '../commands';

// Phrase -> command. Extend freely; first match per phrase list wins, all matches fire.
const PHRASES: [RegExp, Command][] = [
  [/zoom in|closer/, { type: 'zoom', factor: 0.75 }],
  [/zoom out|farther|further/, { type: 'zoom', factor: 1.33 }],
  [/(rotate|turn) left/, { type: 'rotate', dx: -0.5, dy: 0 }],
  [/(rotate|turn) right/, { type: 'rotate', dx: 0.5, dy: 0 }],
  [/(rotate|tilt) up/, { type: 'rotate', dx: 0, dy: -0.4 }],
  [/(rotate|tilt) down/, { type: 'rotate', dx: 0, dy: 0.4 }],
  [/top view|from above/, { type: 'view', view: 'top' }],
  [/front view/, { type: 'view', view: 'front' }],
  [/side view/, { type: 'view', view: 'side' }],
  [/reset|center/, { type: 'reset' }],
  [/next/, { type: 'next' }],
  [/previous|go back/, { type: 'prev' }],
];

// Navigation: "go to history", "open the topic map", "show problems", "go home".
const GO = String.raw`\b(?:go(?: back)? to|open|switch to|show(?: me)?|take me to)\s+(?:the\s+)?`;
const NAV: [RegExp, Command][] = [
  [new RegExp(GO + '(?:interactive |3d )?model'), { type: 'goto', section: 'visual' }],
  [new RegExp(GO + '(?:history|timeline)'), { type: 'goto', section: 'timeline' }],
  [new RegExp(GO + '(?:topic map|topics|overview|notes)'), { type: 'goto', section: 'topics' }],
  [new RegExp(GO + '(?:problems|practice)'), { type: 'goto', section: 'problems' }],
  [/\b(?:go(?: back)? )?home\b|start over|main page/, { type: 'home' }],
  [/\b(?:new|another|different|next|random) (?:example|model|one)\b/, { type: 'newExample' }],
];
// Content: "show me benzene", "graph x squared minus y squared", "solve two x plus three equals seven".
const GENERATE = /\b(?:show me|generate|draw|graph|plot|model|create|build|visuali[sz]e)\s+(?:an?\s+|the\s+)?(.{3,})/;
const SOLVE = /\b(?:solve|how do i (?:solve|find|do)|help me with)\s+(.{3,})/;

/** Navigation and content requests win over camera phrases, so "show me a rotating top" is not a rotate command. */
export function parseVoiceCommand(transcript: string): Command[] {
  const t = transcript.toLowerCase().trim().replace(/[.?!]+$/, '');
  const nav = NAV.find(([re]) => re.test(t));
  if (nav) return [nav[1]];
  const solve = SOLVE.exec(t);
  if (solve) return [{ type: 'solve', question: solve[1] }];
  const gen = GENERATE.exec(t);
  if (gen) return [{ type: 'generate', request: gen[1] }];
  return PHRASES.filter(([re]) => re.test(t)).map(([, cmd]) => cmd);
}

/** Web Speech API (Chrome/Edge). Returns a stop function, or null if unsupported. */
export function startVoice(onHeard?: (transcript: string) => void): (() => void) | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  if (!SR) return null;

  const rec = new SR();
  rec.continuous = true;
  rec.interimResults = false;
  rec.lang = 'en-US';
  let stopped = false;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rec.onresult = (e: any) => {
    const transcript: string = e.results[e.results.length - 1][0].transcript;
    onHeard?.(transcript.trim());
    parseVoiceCommand(transcript).forEach(commands.emit);
  };
  rec.onend = () => {
    if (!stopped) rec.start(); // Chrome ends sessions periodically; keep listening.
  };
  rec.start();

  return () => {
    stopped = true;
    rec.stop();
  };
}
