// The voice assistant: turns a free-form spoken sentence (an `ask` command from core/input/voice.ts)
// into an action, using what is on screen as context: the current subject, focus, topics, open tabs,
// saved lessons and folders. The server decides with Claude when a key is set; the same shared rules
// run here if the server cannot be reached. The latest exchange is shown in the input dock.
import { useSyncExternalStore } from 'react';
import type { IntentContext, IntentResult, TopicNode } from '../../shared/types';
import { ruleIntent, matchTitle } from '../../shared/intentRules';
import { fetchIntent } from './api';
import { commands } from './commands';
import { getLesson, getWorkspace, lesson } from './lesson';
import { library, lessonTitle } from './library';

export interface AssistantStatus {
  heard: string;
  state: 'thinking' | 'done' | 'unsure';
  say: string;
}
let status: AssistantStatus | null = null;
const listeners = new Set<() => void>();
const setStatus = (s: AssistantStatus) => {
  status = s;
  listeners.forEach((l) => l());
};

function context(): IntentContext {
  const s = getLesson();
  const ws = getWorkspace();
  const lib = library.get();
  const titles = (nodes: TopicNode[] = []): string[] => nodes.flatMap((n) => [n.title, ...(n.children ?? []).map((c) => c.title)]);
  return {
    subject: s.subject ?? undefined,
    focus: s.focus ?? undefined,
    section: s.subject ? s.section : undefined,
    model: s.data.visual?.title,
    topics: [...(s.scope?.suggestions ?? []), ...titles(s.data.topics)].slice(0, 30),
    open: ws.tabs.map((t) => t.title),
    saved: lib.lessons.map(lessonTitle),
    folders: lib.folders.map((f) => f.name),
    sandbox: s.subject && s.stageMode === 'sandbox' ? s.sandbox.items.filter((i) => !i.dying).map((i) => i.name) : undefined,
  };
}

/** Carry out a resolved intent. Returns false when there was nothing to do. */
export function perform({ intent }: IntentResult): boolean {
  const inLesson = !!getLesson().subject;
  switch (intent.action) {
    case 'newLesson':
      lesson.start(intent.subject);
      return true;
    case 'focus':
      if (!inLesson) lesson.start(intent.topic);
      else lesson.setFocus(intent.topic);
      return true;
    case 'widen':
      lesson.setFocus(null);
      return inLesson;
    case 'goto':
      lesson.goto(intent.section);
      return inLesson;
    case 'model':
      if (!inLesson) lesson.start(intent.request);
      lesson.requestVisual(intent.request);
      return true;
    case 'newExample':
      lesson.newExample();
      return inLesson;
    case 'modelStep':
      lesson.stepModel(intent.step);
      return inLesson;
    case 'solve':
      lesson.ask(intent.question);
      return inLesson;
    case 'save':
      lesson.save(intent.folder);
      return inLesson;
    case 'open': {
      const ws = getWorkspace();
      const tab = ws.tabs.find((t) => t.title === intent.title) ?? ws.tabs.find((t) => t.title === matchTitle(intent.title, ws.tabs.map((x) => x.title)));
      if (tab) return lesson.switchTo(tab.id), true;
      const lessons = library.get().lessons;
      const title = matchTitle(intent.title, lessons.map(lessonTitle));
      const saved = lessons.find((l) => lessonTitle(l) === intent.title) ?? lessons.find((l) => lessonTitle(l) === title);
      if (saved) return lesson.openSaved(saved.id), true;
      return false;
    }
    case 'library':
      lesson.showLibrary();
      return true;
    case 'home':
      lesson.home();
      return true;
    case 'sandbox':
      lesson.setStageMode('sandbox');
      return inLesson;
    case 'sandboxAdd':
      if (!inLesson) lesson.start(intent.name);
      lesson.sandboxAdd(intent.name, intent.count);
      return true;
    case 'sandboxMove': {
      const ids = lesson.sandboxFind(intent.target);
      if (!ids.length) return false;
      lesson.sandboxNudge(ids, intent.direction);
      return true;
    }
    case 'sandboxRemove': {
      const ids = lesson.sandboxFind(intent.target);
      if (!ids.length) return false;
      lesson.sandboxRemove(ids);
      return true;
    }
    case 'sandboxReact':
      lesson.sandboxReact(intent.condition);
      return inLesson;
    case 'sandboxClear':
      lesson.sandboxClear();
      return inLesson;
    case 'none':
      return false;
  }
}

let latest = 0;
export async function handleSpoken(text: string) {
  const id = ++latest;
  setStatus({ heard: text, state: 'thinking', say: 'Thinking…' });
  const ctx = context();
  let result: IntentResult;
  try {
    result = await fetchIntent({ transcript: text, context: ctx });
  } catch {
    result = ruleIntent(text, ctx); // server unreachable: same rules, in the browser
  }
  if (id !== latest) return; // a newer sentence arrived meanwhile
  const did = perform(result);
  const say = did ? result.say : result.intent.action === 'none' ? result.say : `${result.say} (open a lesson first)`;
  setStatus({ heard: text, state: did ? 'done' : 'unsure', say });
}

commands.on((cmd) => {
  if (cmd.type === 'ask') void handleSpoken(cmd.text);
});

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
export const useAssistant = () => useSyncExternalStore(subscribe, () => status);
