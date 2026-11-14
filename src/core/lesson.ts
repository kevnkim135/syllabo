// The one shared lesson state. Every section reads it with useLesson() and changes it through `lesson`,
// so narrowing the focus or exploring a topic in one section is reflected in all four.
import { useSyncExternalStore } from 'react';
import type { LessonKind, LessonMap, Problem, ScopeInfo } from '../../shared/types';
import { fetchLesson, fetchScope } from './api';
import { commands } from './commands';

export type Section = LessonKind;
export const SECTIONS: readonly Section[] = ['visual', 'timeline', 'topics', 'problems'];
type PerKind<T> = Partial<Record<LessonKind, T>>;

export interface LessonState {
  subject: string | null; // null = home page
  level: string;
  focus: string | null; // specific topic inside the subject
  scope: ScopeInfo | null; // broad subject vs specific topic, plus suggestions
  section: Section;
  data: Partial<LessonMap>; // stays visible while a newer version loads
  loading: PerKind<boolean>;
  errors: PerKind<string>;
  stale: PerKind<boolean>; // reloaded the next time the section is opened
  explored: string[]; // topics the student opened; problems build on these
  visualRequest: string | null; // "benzene", "graph x^2 - y^2"
  visualVariant: number; // bumped for "new example"
  solved: Problem[]; // the student's own problems, newest first
  asked: { id: number; question: string } | null; // pending spoken/typed problem for the problems section
}

const initial: LessonState = {
  subject: null,
  level: 'high school',
  focus: null,
  scope: null,
  section: 'topics',
  data: {},
  loading: {},
  errors: {},
  stale: {},
  explored: [],
  visualRequest: null,
  visualVariant: 0,
  solved: [],
  asked: null,
};

let state = initial;
const listeners = new Set<() => void>();
function set(patch: Partial<LessonState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

// A response is applied only if it is still the newest request for its kind.
const epoch: Record<LessonKind, number> = { visual: 0, timeline: 0, topics: 0, problems: 0 };
let lessonEpoch = 0;
let askId = 0;
const addUnique = (list: string[], item: string) => [item, ...list.filter((x) => x.toLowerCase() !== item.toLowerCase())].slice(0, 12);

function load(kind: LessonKind) {
  const { subject, level, focus } = state;
  if (!subject) return;
  const token = ++epoch[kind];
  set({
    loading: { ...state.loading, [kind]: true },
    errors: { ...state.errors, [kind]: undefined },
    stale: { ...state.stale, [kind]: false },
  });
  fetchLesson({
    subject,
    level,
    kind,
    focus: focus ?? undefined,
    ...(kind === 'visual' ? { request: state.visualRequest ?? undefined, variant: state.visualVariant } : {}),
    ...(kind === 'problems' ? { explored: state.explored } : {}),
  })
    .then((r) => {
      if (token !== epoch[kind]) return;
      set({ data: { ...state.data, [kind]: r.data } as Partial<LessonMap>, loading: { ...state.loading, [kind]: false } });
    })
    .catch((e: Error) => {
      if (token !== epoch[kind]) return;
      set({ errors: { ...state.errors, [kind]: e.message }, loading: { ...state.loading, [kind]: false } });
    });
}

/** Current section first, then the rest, so switching feels instant. */
const loadAll = () => [state.section, ...SECTIONS.filter((k) => k !== state.section)].forEach(load);

export const lesson = {
  /** Start a new lesson from the home page input. */
  start(subject: string, level = state.level) {
    const name = subject.trim();
    if (!name) return;
    const token = ++lessonEpoch;
    set({ ...initial, subject: name, level });
    loadAll();
    fetchScope(name, level)
      .then((scope) => token === lessonEpoch && set({ scope }))
      .catch(() => token === lessonEpoch && set({ scope: { scope: 'specific', overview: '', suggestions: [] } }));
  },

  /** Narrow the whole lesson to one topic (or pass null to widen back out). All four sections regenerate. */
  setFocus(topic: string | null) {
    const focus = topic?.trim() || null;
    if (focus === state.focus) return;
    set({ focus, visualRequest: null, visualVariant: 0, explored: focus ? addUnique(state.explored, focus) : state.explored });
    loadAll();
  },

  /** Record that the student opened a topic; the problems section picks it up next time it is shown. */
  markExplored(topic: string) {
    set({ explored: addUnique(state.explored, topic), stale: { ...state.stale, problems: true } });
  },

  goto(section: Section) {
    if (!state.subject) return;
    set({ section });
    if (state.stale[section] && !state.loading[section]) load(section);
  },

  home() {
    lessonEpoch++;
    SECTIONS.forEach((k) => epoch[k]++);
    set({ ...initial, level: state.level });
  },

  setLevel: (level: string) => set({ level }),
  retry: (kind: LessonKind) => load(kind),

  /** Replace the 3D model with something the student asked for. */
  requestVisual(request: string) {
    set({ visualRequest: request.trim(), visualVariant: 0, section: 'visual' });
    load('visual');
  },

  /** A different example model for the current topic. */
  newExample() {
    set({ visualRequest: null, visualVariant: state.visualVariant + 1 });
    load('visual');
  },

  /** Queue a spoken or typed problem; the problems section solves it. */
  ask(question: string) {
    lesson.goto('problems'); // also refreshes stale problems
    set({ asked: { id: ++askId, question: question.trim() } });
  },
  consumeAsk: () => set({ asked: null }),
  addSolved: (p: Problem) => set({ solved: [p, ...state.solved] }),
};

// Navigation and content commands from gestures, voice, keys and buttons.
commands.on((cmd) => {
  if (!state.subject) return;
  const step = (d: number) => lesson.goto(SECTIONS[(SECTIONS.indexOf(state.section) + d + SECTIONS.length) % SECTIONS.length]);
  switch (cmd.type) {
    case 'next':
      return step(1);
    case 'prev':
      return step(-1);
    case 'goto':
      return lesson.goto(cmd.section);
    case 'home':
      return lesson.home();
    case 'newExample':
      return lesson.newExample();
    case 'generate':
      return lesson.requestVisual(cmd.request);
    case 'solve':
      return lesson.ask(cmd.question);
  }
});

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
export const useLesson = () => useSyncExternalStore(subscribe, () => state);
export const getLesson = () => state;
