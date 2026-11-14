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

export function parseVoiceCommand(transcript: string): Command[] {
  const t = transcript.toLowerCase();
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
