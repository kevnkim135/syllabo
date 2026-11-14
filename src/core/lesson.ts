// The lesson workspace. Several lessons can be open at once (tabs); each keeps its own data, focus,
// explored topics, solved problems and a gallery of every 3D model built in it. Every section reads the
// ACTIVE lesson with useLesson() and changes it through `lesson`, so narrowing the focus or exploring a
// topic in one section is reflected in all four. Saved lessons (core/library.ts) stay in sync
// automatically and reopen without generating anything again.
import { useSyncExternalStore } from 'react';
import type { LessonKind, LessonMap, Problem, ScopeInfo, VisualSpec } from '../../shared/types';
import { fetchLesson, fetchScope } from './api';
import { commands } from './commands';
import { library, lessonTitle, newId, type SavedLesson } from './library';

export type Section = LessonKind;
export const SECTIONS: readonly Section[] = ['visual', 'timeline', 'topics', 'problems'];
type PerKind<T> = Partial<Record<LessonKind, T>>;
export type View = 'home' | 'lesson' | 'library';

export interface LessonState {
  id: string;
  subject: string | null; // null = no lesson (home page)
  level: string;
  focus: string | null; // specific topic inside the subject
  scope: ScopeInfo | null; // broad subject vs specific topic, plus suggestions
  section: Section;
  data: Partial<LessonMap>; // data.visual is the model on screen (models[modelIndex])
  loading: PerKind<boolean>;
  errors: PerKind<string>;
  stale: PerKind<boolean>; // reloaded the next time the section is opened
  explored: string[]; // topics the student opened; problems build on these
  visualRequest: string | null; // "benzene", "graph x^2 - y^2"
  visualVariant: number; // bumped for "new example"
  models: VisualSpec[]; // every model built in this lesson, in order (swipe left / right through them)
  modelIndex: number;
  solved: Problem[]; // the student's own problems, newest first
  asked: { id: number; question: string } | null; // pending spoken/typed problem for the problems section
  savedAt: number | null; // set once saved; later changes are saved automatically
  folderId: string | null;
  createdAt: number;
}

export interface Workspace {
  view: View;
  activeId: string | null;
  level: string; // default level for new lessons
  tabs: { id: string; title: string; loading: boolean; saved: boolean }[];
}

const blank = (level: string): LessonState => ({
  id: '',
  subject: null,
  level,
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
  models: [],
  modelIndex: 0,
  solved: [],
  asked: null,
  savedAt: null,
  folderId: null,
  createdAt: 0,
});

// ---------------------------------------------------------------------------------------------------
// store
// ---------------------------------------------------------------------------------------------------
const sessions = new Map<string, LessonState>();
let order: string[] = []; // tab order
let ws: Workspace = { view: 'home', activeId: null, level: 'high school', tabs: [] };
let home = blank(ws.level); // what useLesson() returns when no lesson is active
const listeners = new Set<() => void>();

function emit() {
  ws = {
    ...ws,
    tabs: order.map((id) => {
      const s = sessions.get(id)!;
      return { id, title: lessonTitle(s), loading: Object.values(s.loading).some(Boolean), saved: s.savedAt !== null };
    }),
  };
  listeners.forEach((l) => l());
}
const active = (): LessonState => (ws.activeId && sessions.get(ws.activeId)) || home;

function update(id: string, patch: Partial<LessonState> | ((s: LessonState) => Partial<LessonState>)) {
  const s = sessions.get(id);
  if (!s) return;
  const next = { ...s, ...(typeof patch === 'function' ? patch(s) : patch) };
  sessions.set(id, next);
  if (next.savedAt !== null) scheduleSave(id);
  emit();
}

// ---- auto-save for saved lessons ----
const saveTimers = new Map<string, ReturnType<typeof setTimeout>>();
function snapshot(s: LessonState): SavedLesson {
  const { visual: _visual, ...data } = s.data;
  return {
    id: s.id,
    subject: s.subject ?? '',
    level: s.level,
    focus: s.focus,
    scope: s.scope,
    section: s.section,
    data,
    models: s.models,
    modelIndex: s.modelIndex,
    explored: s.explored,
    solved: s.solved,
    folderId: s.folderId,
    createdAt: s.createdAt,
    updatedAt: Date.now(),
  };
}
function scheduleSave(id: string) {
  clearTimeout(saveTimers.get(id));
  saveTimers.set(
    id,
    setTimeout(() => {
      const s = sessions.get(id);
      if (s && s.savedAt !== null) library.put(snapshot(s));
    }, 400),
  );
}

// ---- loading ----
// A response is applied only if it is still the newest request for that lesson and kind.
const epoch = new Map<string, number>();
let askId = 0;
const addUnique = (list: string[], item: string) => [item, ...list.filter((x) => x.toLowerCase() !== item.toLowerCase())].slice(0, 12);

function load(id: string, kind: LessonKind) {
  const s = sessions.get(id);
  if (!s?.subject) return;
  const key = `${id}:${kind}`;
  const token = (epoch.get(key) ?? 0) + 1;
  epoch.set(key, token);
  update(id, (x) => ({
    loading: { ...x.loading, [kind]: true },
    errors: { ...x.errors, [kind]: undefined },
    stale: { ...x.stale, [kind]: false },
  }));
  fetchLesson({
    subject: s.subject,
    level: s.level,
    kind,
    focus: s.focus ?? undefined,
    ...(kind === 'visual' ? { request: s.visualRequest ?? undefined, variant: s.visualVariant } : {}),
    ...(kind === 'problems' ? { explored: s.explored } : {}),
  })
    .then((r) => {
      if (epoch.get(key) !== token) return;
      update(id, (x) => {
        if (kind !== 'visual') return { data: { ...x.data, [kind]: r.data } as Partial<LessonMap>, loading: { ...x.loading, [kind]: false } };
        // every new model joins the gallery and becomes the one on screen
        const spec = r.data as VisualSpec;
        const models = [...x.models, spec];
        return { models, modelIndex: models.length - 1, data: { ...x.data, visual: spec }, loading: { ...x.loading, visual: false } };
      });
    })
    .catch((e: Error) => {
      if (epoch.get(key) !== token) return;
      update(id, (x) => ({ errors: { ...x.errors, [kind]: e.message }, loading: { ...x.loading, [kind]: false } }));
    });
}

/** Current section first, then the rest, so switching feels instant. */
function loadAll(id: string) {
  const s = sessions.get(id);
  if (!s) return;
  [s.section, ...SECTIONS.filter((k) => k !== s.section)].forEach((k) => load(id, k));
}

function loadScope(id: string) {
  const s = sessions.get(id);
  if (!s?.subject) return;
  fetchScope(s.subject, s.level)
    .then((scope) => update(id, { scope }))
    .catch(() => update(id, { scope: { scope: 'specific', overview: '', suggestions: [] } }));
}

function activate(id: string) {
  ws = { ...ws, view: 'lesson', activeId: id };
  const s = sessions.get(id);
  if (s && s.stale[s.section] && !s.loading[s.section]) load(id, s.section);
  emit();
}

const withActive = (fn: (s: LessonState) => void) => {
  const s = ws.activeId ? sessions.get(ws.activeId) : undefined;
  if (s) fn(s);
};

// ---------------------------------------------------------------------------------------------------
// actions
// ---------------------------------------------------------------------------------------------------
export const lesson = {
  /** Start a lesson. An already open lesson on the same subject is reused instead of duplicated. */
  start(subject: string, level = ws.level) {
    const name = subject.trim();
    if (!name) return;
    const same = order.find((id) => {
      const s = sessions.get(id)!;
      return s.subject?.toLowerCase() === name.toLowerCase() && !s.focus && s.level === level;
    });
    if (same) return activate(same);
    const id = newId();
    sessions.set(id, { ...blank(level), id, subject: name, createdAt: Date.now() });
    order = [...order, id];
    activate(id);
    loadAll(id);
    loadScope(id);
  },

  /** Narrow the active lesson to one topic (or pass null to widen back out). All four sections regenerate. */
  setFocus(topic: string | null) {
    withActive((s) => {
      const focus = topic?.trim() || null;
      if (focus === s.focus) return;
      update(s.id, { focus, visualRequest: null, visualVariant: 0, explored: focus ? addUnique(s.explored, focus) : s.explored });
      loadAll(s.id);
    });
  },

  /** Record that the student opened a topic; the problems section picks it up next time it is shown. */
  markExplored(topic: string) {
    withActive((s) => update(s.id, { explored: addUnique(s.explored, topic), stale: { ...s.stale, problems: true } }));
  },

  goto(section: Section) {
    withActive((s) => {
      ws = { ...ws, view: 'lesson' };
      update(s.id, { section });
      if (s.stale[section] && !s.loading[section]) load(s.id, section);
    });
  },

  // ---- workspace ----
  /** Back to the home page; open lessons stay open in their tabs. */
  home() {
    ws = { ...ws, view: 'home' };
    emit();
  },
  showLibrary() {
    ws = { ...ws, view: 'library' };
    emit();
  },
  switchTo: (id: string) => sessions.has(id) && activate(id),
  close(id: string) {
    const i = order.indexOf(id);
    if (i < 0) return;
    order = order.filter((x) => x !== id);
    sessions.delete(id);
    if (ws.activeId === id) {
      const next = order[Math.min(i, order.length - 1)];
      ws = { ...ws, activeId: next ?? null, view: next ? ws.view : ws.view === 'lesson' ? 'home' : ws.view };
    }
    emit();
  },

  setLevel(level: string) {
    ws = { ...ws, level };
    home = blank(level);
    emit();
  },
  retry: (kind: LessonKind) => withActive((s) => load(s.id, kind)),

  // ---- saving ----
  /** Save the active lesson (optionally into a folder by name, created if needed). */
  save(folderName?: string) {
    withActive((s) => {
      const folderId = folderName?.trim() ? library.ensureFolder(folderName).id : s.folderId;
      update(s.id, { savedAt: s.savedAt ?? Date.now(), folderId });
      library.put(snapshot(sessions.get(s.id)!));
    });
  },
  unsave(id: string) {
    library.remove(id);
    if (sessions.has(id)) update(id, { savedAt: null, folderId: null });
  },
  moveToFolder(id: string, folderId: string | null) {
    library.move(id, folderId);
    if (sessions.has(id)) update(id, { folderId });
  },
  /** Reopen a saved lesson exactly as it was, without generating it again. */
  openSaved(id: string) {
    if (sessions.has(id)) return activate(id);
    const saved = library.find(id);
    if (!saved) return;
    const models = saved.models;
    const modelIndex = Math.min(saved.modelIndex, Math.max(0, models.length - 1));
    sessions.set(id, {
      ...blank(saved.level),
      ...saved,
      data: { ...saved.data, ...(models.length ? { visual: models[modelIndex] } : {}) },
      models,
      modelIndex,
      savedAt: saved.updatedAt,
    });
    order = [...order, id];
    activate(id);
    // anything that was never generated (or failed) is fetched now
    SECTIONS.filter((k) => (k === 'visual' ? !models.length : saved.data[k as Exclude<LessonKind, 'visual'>] === undefined)).forEach((k) => load(id, k));
    if (!saved.scope) loadScope(id);
  },

  // ---- models ----
  /** Build a model the student asked for; it joins the gallery. */
  requestVisual(request: string) {
    withActive((s) => {
      update(s.id, { visualRequest: request.trim(), visualVariant: 0, section: 'visual' });
      ws = { ...ws, view: 'lesson' };
      load(s.id, 'visual');
    });
  },
  /** A different example model for the current topic; it joins the gallery. */
  newExample() {
    withActive((s) => {
      update(s.id, { visualRequest: null, visualVariant: s.visualVariant + 1 });
      load(s.id, 'visual');
    });
  },
  selectModel(index: number) {
    withActive((s) => {
      if (!s.models.length) return;
      const i = ((index % s.models.length) + s.models.length) % s.models.length;
      update(s.id, { modelIndex: i, data: { ...s.data, visual: s.models[i] } });
    });
  },
  stepModel(step: number) {
    withActive((s) => lesson.selectModel(s.modelIndex + step));
  },
  removeModel(index: number) {
    withActive((s) => {
      if (s.models.length <= 1) return;
      const models = s.models.filter((_, i) => i !== index);
      const modelIndex = Math.min(index > s.modelIndex ? s.modelIndex : Math.max(0, s.modelIndex - 1), models.length - 1);
      update(s.id, { models, modelIndex, data: { ...s.data, visual: models[modelIndex] } });
    });
  },

  // ---- problems ----
  /** Queue a spoken or typed problem; the problems section solves it. */
  ask(question: string) {
    lesson.goto('problems'); // also refreshes stale problems
    withActive((s) => update(s.id, { asked: { id: ++askId, question: question.trim() } }));
  },
  consumeAsk: () => withActive((s) => update(s.id, { asked: null })),
  /** Add a solved problem to a lesson (the active one unless an id is given). */
  addSolved(p: Problem, id = ws.activeId) {
    if (id && sessions.has(id)) update(id, (s) => ({ solved: [p, ...s.solved] }));
  },
};

// Navigation and content commands from gestures, voice, keys and buttons.
commands.on((cmd) => {
  if (cmd.type === 'home') return lesson.home();
  const s = active();
  if (!s.subject) return;
  const step = (d: number) => lesson.goto(SECTIONS[(SECTIONS.indexOf(s.section) + d + SECTIONS.length) % SECTIONS.length]);
  switch (cmd.type) {
    case 'next':
      return step(1);
    case 'prev':
      return step(-1);
    case 'goto':
      return lesson.goto(cmd.section);
    case 'newExample':
      return lesson.newExample();
    case 'modelStep':
      return lesson.stepModel(cmd.step);
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
/** The active lesson (or an empty one on the home page / library). */
export const useLesson = () => useSyncExternalStore(subscribe, active);
export const useWorkspace = () => useSyncExternalStore(subscribe, () => ws);
export const getLesson = () => active();
export const getWorkspace = () => ws;
