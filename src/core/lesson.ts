// The lesson workspace. Several lessons can be open at once (tabs); each keeps its own data, focus,
// explored topics, solved problems and a gallery of every 3D model built in it. Every section reads the
// ACTIVE lesson with useLesson() and changes it through `lesson`, so narrowing the focus or exploring a
// topic in one section is reflected in all four. Saved lessons (core/library.ts) stay in sync
// automatically and reopen without generating anything again.
import { useSyncExternalStore } from 'react';
import type { LessonKind, LessonMap, Problem, SandboxSetting, ScopeInfo, VisualSpec } from '../../shared/types';
import { fetchExamples, fetchLesson, fetchReact, fetchSandboxItem, fetchScope } from './api';
import { commands } from './commands';
import { library, lessonTitle, newId, type SandboxItem, type SandboxReaction, type SavedLesson } from './library';

export type Section = LessonKind;
// Sidebar order AND load priority: the topic map first, then problems, the model, history.
export const SECTIONS: readonly Section[] = ['topics', 'problems', 'visual', 'timeline'];
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
  exampleQueue: VisualSpec[]; // ready-made different examples: "new example" shows the next one instantly
  solved: Problem[]; // the student's own problems, newest first
  asked: { id: number; question: string } | null; // pending spoken/typed problem for the problems section
  stageMode: 'models' | 'sandbox'; // the model gallery, or the chemistry sandbox
  sandbox: Sandbox; // the sandbox on screen
  sandboxes: Sandbox[]; // all of this lesson's sandboxes (the one on screen is kept in `sandbox` while active)
  sandboxIndex: number;
  savedAt: number | null; // set once saved; later changes are saved automatically
  folderId: string | null;
  createdAt: number;
}

export interface Sandbox {
  items: (SandboxItem & { dying?: [number, number, number] })[]; // dying: reactants shrinking toward this point
  selected: string[];
  reaction: SandboxReaction | null;
  busy: null | 'add' | 'react';
  error: string | null;
  gravity: boolean; // bodies fall to the bench floor (planets and stars pull on each other instead)
  friction: boolean; // rolling friction on the floor
  air: boolean; // air resistance (never in space)
  elastic: boolean; // perfectly elastic collisions: no kinetic energy lost
  autoReact: boolean; // molecules react by themselves when they touch
  condition: string; // reaction condition (heat, a spark...), used by the React button and by auto react
  contact: string[] | null; // molecules that are touching: the panel offers to react them
  event: string | null; // last collision, explained (momentum and energy before / after)
}
export type MoveDirection = 'left' | 'right' | 'up' | 'down' | 'closer' | 'farther' | 'together' | 'apart';

const emptySandbox = (): Sandbox => ({ items: [], selected: [], reaction: null, busy: null, error: null, gravity: true, friction: true, air: true, elastic: false, autoReact: false, condition: '', contact: null, event: null });

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
  exampleQueue: [],
  solved: [],
  asked: null,
  stageMode: 'models',
  sandbox: emptySandbox(),
  sandboxes: [emptySandbox()],
  sandboxIndex: 0,
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
    sandbox: shelfOf(s.sandbox),
    sandboxes: s.sandboxes.map((b, i) => shelfOf(i === s.sandboxIndex ? s.sandbox : b)),
    sandboxIndex: s.sandboxIndex,
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
      update(s.id, { focus, visualRequest: null, visualVariant: 0, exampleQueue: [], explored: focus ? addUnique(s.explored, focus) : s.explored });
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
      // opening the model section gets the next examples ready, so the first twirl is instant
      if (section === 'visual' && !s.exampleQueue.length && s.models.length) refillExamples(s.id);
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
      ...(() => {
        const shelf = (saved.sandboxes?.length ? saved.sandboxes : [saved.sandbox ?? {}]).map(fromShelf);
        const idx = Math.min(saved.sandboxIndex ?? 0, shelf.length - 1);
        return { sandboxes: shelf, sandboxIndex: idx, sandbox: shelf[idx] };
      })(),
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
  /**
   * A different example for the current topic, never one already in this lesson. It comes from a queue of
   * ready-made examples (instant), which refills itself in the background before it runs out.
   */
  newExample() {
    withActive((s) => {
      const id = s.id;
      const seen = new Set(s.models.map((m) => m.title.toLowerCase()));
      const queue = s.exampleQueue.filter((v) => !seen.has(v.title.toLowerCase()));
      const next = queue[0];
      if (next) {
        const models = [...s.models, next];
        update(id, { exampleQueue: queue.slice(1), models, modelIndex: models.length - 1, data: { ...s.data, visual: next }, visualRequest: null });
        if (queue.length <= 2) refillExamples(id);
        return;
      }
      update(id, (x) => ({ loading: { ...x.loading, visual: true }, errors: { ...x.errors, visual: undefined } }));
      refillExamples(id, true);
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

  // ---- chemistry sandbox ----
  setStageMode(stageMode: 'models' | 'sandbox') {
    withActive((s) => {
      ws = { ...ws, view: 'lesson' };
      update(s.id, { stageMode, section: 'visual' });
    });
  },
  /** Add things by name: a molecule ("water") or a physical body ("a car", "a proton"); the server decides which. */
  sandboxAdd(name: string, count = 1) {
    withActive((s) => {
      const id = s.id;
      ws = { ...ws, view: 'lesson' };
      update(id, (x) => ({ stageMode: 'sandbox', section: 'visual', sandbox: { ...x.sandbox, busy: 'add', error: null } }));
      fetchSandboxItem(name.trim(), s.focus ? `${s.subject} (${s.focus})` : (s.subject ?? undefined), s.level)
        .then((spec) =>
          update(id, (x) => {
            const items = [...x.sandbox.items];
            for (let k = 0; k < Math.max(1, Math.min(count, 6)); k++) {
              const base = { id: newId(), name: spec.name || tidyName(name, name), pos: freeSlot(items), scale: 1 };
              const pos: [number, number, number] = spec.kind === 'body' && !isCelestial(spec.body.shape) ? [base.pos[0], -2.6 + spec.body.radius, base.pos[2]] : base.pos;
              items.push(spec.kind === 'molecule' ? { ...base, kind: 'molecule', molecule: spec.molecule } : { ...base, pos, kind: 'body', body: spec.body, vel: [0, 0, 0] });
            }
            // adding never changes the selection: selecting stays a deliberate act
            return { sandbox: { ...x.sandbox, items, busy: null } };
          }),
        )
        .catch((e: Error) => update(id, (x) => ({ sandbox: { ...x.sandbox, busy: null, error: `Could not add ${name}: ${e.message}` } })));
    });
  },
  /** Give bodies a shove (voice: "push the car right with 50 newtons"). Molecules just move a step. */
  sandboxPush(ids: string[], dir: MoveDirection, force?: number) {
    withActive((s) => {
      const unit: Record<string, [number, number, number]> = { left: [-1, 0, 0], right: [1, 0, 0], up: [0, 1, 0], down: [0, -1, 0], closer: [0, 0, 1], farther: [0, 0, -1] };
      const items = s.sandbox.items.filter((i) => ids.includes(i.id));
      const bodies = items.filter((i) => i.kind === 'body');
      const centre = centroid(s.sandbox.items.map((i) => i.pos));
      for (const b of bodies) {
        let u = unit[dir];
        if (dir === 'together' || dir === 'apart') {
          const d = [centre[0] - b.pos[0], centre[1] - b.pos[1], centre[2] - b.pos[2]];
          const n = Math.hypot(...d) || 1;
          u = d.map((v) => ((dir === 'together' ? 1 : -1) * v) / n) as [number, number, number];
        }
        // a shove lasting about half a second: dv = F t / m, kept visible for very light and very heavy things
        const mass = b.body!.mass;
        const dv = force ? Math.min(12, Math.max(2, (force * 0.5) / Math.max(mass, 0.05))) : 5;
        commands.emit({ type: 'impulse', ids: [b.id], dv: u.map((v) => v * dv) as [number, number, number] });
      }
      const molecules = items.filter((i) => i.kind !== 'body').map((i) => i.id);
      if (molecules.length) lesson.sandboxNudge(molecules, dir);
    });
  },
  /** Physics switches: gravity, friction, air resistance, perfectly elastic collisions. */
  sandboxSetting(setting: SandboxSetting, on: boolean) {
    withActive((s) => update(s.id, { sandbox: { ...s.sandbox, [setting]: on } }));
  },
  /** The scene reports where moving bodies are, so saving and reopening keeps them in place. */
  sandboxSync(states: { id: string; pos: [number, number, number]; vel: [number, number, number] }[]) {
    withActive((s) => {
      const by = new Map(states.map((x) => [x.id, x]));
      const items = s.sandbox.items.map((i) => (by.has(i.id) ? { ...i, pos: by.get(i.id)!.pos, vel: by.get(i.id)!.vel } : i));
      update(s.id, { sandbox: { ...s.sandbox, items } });
    });
  },
  sandboxContact(ids: string[] | null) {
    withActive((s) => {
      const same = (s.sandbox.contact ?? []).join() === (ids ?? []).join();
      if (!same) update(s.id, { sandbox: { ...s.sandbox, contact: ids && ids.length ? ids : null } });
      // auto react: each new group of touching molecules is tried once (not again while it stays touching)
      const key = (ids ?? []).slice().sort().join();
      if (s.sandbox.autoReact && ids && ids.length >= 2 && !s.sandbox.busy && autoTried.get(s.id) !== key && Date.now() > (autoQuiet.get(s.id) ?? 0)) {
        autoTried.set(s.id, key);
        lesson.sandboxReact(s.sandbox.condition);
      }
      if (!ids) autoTried.delete(s.id);
    });
  },
  sandboxCondition(condition: string) {
    withActive((s) => update(s.id, { sandbox: { ...s.sandbox, condition } }));
  },
  sandboxEvent(text: string | null) {
    withActive((s) => update(s.id, { sandbox: { ...s.sandbox, event: text } }));
  },
  /** Select sandbox items: replace the selection, toggle items in it, or add to it. */
  sandboxSelect(ids: string[], how: 'set' | 'toggle' | 'add' | 'remove' = 'set') {
    withActive((s) => {
      const cur = s.sandbox.selected;
      const selected =
        how === 'set' ? ids
        : how === 'add' ? [...new Set([...cur, ...ids])]
        : how === 'remove' ? cur.filter((i) => !ids.includes(i))
        : cur.filter((i) => !ids.includes(i)).concat(ids.filter((i) => !cur.includes(i)));
      update(s.id, { sandbox: { ...s.sandbox, selected } });
    });
  },
  /** Move items by a world-space offset (mouse and hand drags). */
  sandboxMove(ids: string[], d: [number, number, number]) {
    withActive((s) => {
      const items = s.sandbox.items.map((i) => (ids.includes(i.id) ? { ...i, pos: clampPos([i.pos[0] + d[0], i.pos[1] + d[1], i.pos[2] + d[2]]) } : i));
      update(s.id, { sandbox: { ...s.sandbox, items } });
    });
  },
  /** Move items in a named direction (voice). "together" / "apart" are relative to the other items. */
  sandboxNudge(ids: string[], dir: MoveDirection, amount = 1.5) {
    withActive((s) => {
      const all = s.sandbox.items;
      const centre = centroid(all.map((i) => i.pos));
      const step: Record<Exclude<MoveDirection, 'together' | 'apart'>, [number, number, number]> = {
        left: [-amount, 0, 0], right: [amount, 0, 0], up: [0, amount, 0], down: [0, -amount, 0], closer: [0, 0, amount], farther: [0, 0, -amount],
      };
      const items = all.map((i) => {
        if (!ids.includes(i.id)) return i;
        if (dir === 'together' || dir === 'apart') {
          const k = dir === 'together' ? 0.72 : 1.5;
          return { ...i, pos: clampPos([centre[0] + (i.pos[0] - centre[0]) * k, centre[1] + (i.pos[1] - centre[1]) * k, centre[2] + (i.pos[2] - centre[2]) * k]) };
        }
        const d = step[dir];
        return { ...i, pos: clampPos([i.pos[0] + d[0], i.pos[1] + d[1], i.pos[2] + d[2]]) };
      });
      update(s.id, { sandbox: { ...s.sandbox, items } });
    });
  },
  sandboxScale(ids: string[], factor: number) {
    withActive((s) => {
      const items = s.sandbox.items.map((i) => (ids.includes(i.id) ? { ...i, scale: Math.min(4, Math.max(0.3, i.scale * factor)) } : i));
      update(s.id, { sandbox: { ...s.sandbox, items } });
    });
  },
  /** Store orientations after a rotation gesture (the scene rotates live, then reports here). */
  sandboxSetRot(rots: Record<string, [number, number, number, number]>) {
    withActive((s) => update(s.id, { sandbox: { ...s.sandbox, items: s.sandbox.items.map((i) => (rots[i.id] ? { ...i, rot: rots[i.id] } : i)) } }));
  },
  sandboxRemove(ids: string[]) {
    withActive((s) =>
      update(s.id, { sandbox: { ...s.sandbox, items: s.sandbox.items.filter((i) => !ids.includes(i.id)), selected: s.sandbox.selected.filter((i) => !ids.includes(i)) } }),
    );
  },
  sandboxClear() {
    withActive((s) => update(s.id, { sandbox: { ...emptySandbox(), gravity: s.sandbox.gravity, friction: s.sandbox.friction, air: s.sandbox.air, elastic: s.sandbox.elastic, autoReact: s.sandbox.autoReact, condition: s.sandbox.condition } }));
  },
  /** A fresh, empty sandbox after the others (swipe or the arrows to go back). */
  sandboxNew() {
    withActive((s) => {
      const shelf = [...s.sandboxes];
      shelf[s.sandboxIndex] = s.sandbox;
      shelf.push(emptySandbox());
      ws = { ...ws, view: 'lesson' };
      update(s.id, { sandboxes: shelf, sandboxIndex: shelf.length - 1, sandbox: shelf[shelf.length - 1], stageMode: 'sandbox', section: 'visual' });
    });
  },
  sandboxGo(index: number) {
    withActive((s) => {
      const shelf = [...s.sandboxes];
      shelf[s.sandboxIndex] = s.sandbox;
      const i = ((index % shelf.length) + shelf.length) % shelf.length;
      update(s.id, { sandboxes: shelf, sandboxIndex: i, sandbox: { ...shelf[i], selected: [], contact: null } });
    });
  },
  sandboxStep: (d: number) => withActive((s) => lesson.sandboxGo(s.sandboxIndex + d)),
  sandboxDelete() {
    withActive((s) => {
      if (s.sandboxes.length <= 1) return lesson.sandboxClear();
      const shelf = s.sandboxes.filter((_, i) => i !== s.sandboxIndex);
      const i = Math.min(s.sandboxIndex, shelf.length - 1);
      update(s.id, { sandboxes: shelf, sandboxIndex: i, sandbox: shelf[i] });
    });
  },
  /**
   * Ask what happens when the selected molecules (or all of them) meet under a condition. If they react,
   * the reactants shrink together and the products bloom out where they met.
   */
  sandboxReact(condition = '') {
    withActive((s) => {
      const id = s.id;
      const pool = s.sandbox.items.filter((i) => !i.dying && i.kind !== 'body' && i.molecule);
      // molecules that are touching first, then two or more selected, otherwise every molecule in the space
      const touching = pool.filter((i) => s.sandbox.contact?.includes(i.id));
      const picked = pool.filter((i) => s.sandbox.selected.includes(i.id));
      const chosen = touching.length >= 2 ? touching : picked.length >= 2 ? picked : pool;
      if (!chosen.length) return update(id, { sandbox: { ...s.sandbox, error: 'Reactions need molecules: try "add methane and two oxygens".' } });
      const counts = new Map<string, number>();
      for (const i of chosen) counts.set(i.name, (counts.get(i.name) ?? 0) + 1);
      update(id, (x) => ({ sandbox: { ...x.sandbox, busy: 'react', error: null } }));
      fetchReact({ reactants: [...counts].map(([name, count]) => ({ name, count })), condition: condition.trim() || undefined, level: s.level })
        .then((result) => {
          const reaction: SandboxReaction = { result, condition: condition.trim(), reactants: [...counts].map(([n, c]) => (c > 1 ? `${c} ${n}` : n)) };
          if (!result.reacts) return update(id, (x) => ({ sandbox: { ...x.sandbox, busy: null, reaction } }));
          const meet = centroid(chosen.map((i) => i.pos));
          const gone = new Set(chosen.map((i) => i.id));
          update(id, (x) => ({ sandbox: { ...x.sandbox, busy: null, reaction, selected: [], contact: null, items: x.sandbox.items.map((i) => (gone.has(i.id) ? { ...i, dying: meet } : i)) } }));
          autoQuiet.set(id, Date.now() + 2500);
          setTimeout(() => {
            update(id, (x) => {
              const items = x.sandbox.items.filter((i) => !gone.has(i.id));
              const total = result.products.reduce((n, p) => n + p.count, 0);
              let k = 0;
              for (const p of result.products) {
                for (let c = 0; c < p.count; c++, k++) {
                  const a = (k / Math.max(total, 1)) * Math.PI * 2;
                  const r = total > 1 ? 3.2 + total * 0.9 : 0; // products fan out around where they formed, far enough apart not to touch
                  const item = { id: newId(), name: p.name, kind: 'molecule' as const, molecule: p.molecule, pos: clampPos([meet[0] + Math.cos(a) * r, meet[1] + Math.sin(a) * r * 0.35, meet[2] + Math.sin(a) * r * 0.9]), scale: 1 };
                  items.push(item);
                }
              }
              return { sandbox: { ...x.sandbox, items, selected: [] } };
            });
          }, 700);
        })
        .catch((e: Error) => update(id, (x) => ({ sandbox: { ...x.sandbox, busy: null, error: `Could not run the reaction: ${e.message}` } })));
    });
  },
  /** Items named like `target` ("water", "the methane", "it", "selected", "all"). */
  sandboxFind(target: string): string[] {
    const s = active();
    const items = s.sandbox.items.filter((i) => !i.dying);
    const t = target.toLowerCase().replace(/^(?:the|a|an|my)\s+/, '').replace(/\s+molecules?$/, '').trim();
    if (!t || /^(?:it|them|these|those|this|that|selected|selection|the selection)$/.test(t)) return s.sandbox.selected.length ? s.sandbox.selected : items.slice(-1).map((i) => i.id);
    if (/^(?:all|everything|every(?:thing| molecule)|both)$/.test(t)) return items.map((i) => i.id);
    const words = t.split(/\s+/).filter((w) => w.length > 1);
    return items.filter((i) => words.some((w) => i.name.toLowerCase().includes(w) || (i.molecule?.title ?? i.body?.shape ?? '').toLowerCase().includes(w))).map((i) => i.id);
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

// ---- example queue ----
const refilling = new Set<string>();
function refillExamples(id: string, showFirst = false) {
  const s = sessions.get(id);
  if (!s?.subject || refilling.has(id)) return;
  refilling.add(id);
  const avoid = [...s.models, ...s.exampleQueue].map((m) => m.title);
  fetchExamples({ subject: s.subject, level: s.level, focus: s.focus ?? undefined, avoid })
    .then((batch) =>
      update(id, (x) => {
        const seen = new Set([...x.models, ...x.exampleQueue].map((m) => m.title.toLowerCase()));
        const fresh = batch.filter((v) => !seen.has(v.title.toLowerCase()));
        const queue = [...x.exampleQueue, ...fresh];
        if (!showFirst || !queue.length) return { exampleQueue: queue, loading: { ...x.loading, visual: false } };
        const [next, ...rest] = queue;
        const models = [...x.models, next];
        return { exampleQueue: rest, models, modelIndex: models.length - 1, data: { ...x.data, visual: next }, loading: { ...x.loading, visual: false } };
      }),
    )
    .catch((e: Error) => update(id, (x) => ({ loading: { ...x.loading, visual: false }, errors: showFirst ? { ...x.errors, visual: e.message } : x.errors })))
    .finally(() => refilling.delete(id));
}

// ---- sandbox helpers ----
const autoTried = new Map<string, string>(); // lesson id -> the touching group auto react last tried
const autoQuiet = new Map<string, number>(); // lesson id -> no auto react before this time (just reacted)
type Shelved = NonNullable<SavedLesson['sandbox']>;
const shelfOf = (b: Sandbox): Shelved => ({
  items: b.items.filter((i) => !i.dying).map(({ dying: _d, ...i }) => i),
  reaction: b.reaction, gravity: b.gravity, friction: b.friction, air: b.air, elastic: b.elastic, autoReact: b.autoReact, condition: b.condition,
});
const fromShelf = (b: Partial<Shelved>): Sandbox => ({
  ...emptySandbox(), items: b.items ?? [], reaction: b.reaction ?? null,
  gravity: b.gravity ?? true, friction: b.friction ?? true, air: b.air ?? true, elastic: b.elastic ?? false,
  autoReact: b.autoReact ?? false, condition: b.condition ?? '',
});
export const isCelestial = (shape?: string) => shape === 'sun' || shape === 'planet' || shape === 'moon' || shape === 'satellite';
const centroid = (ps: [number, number, number][]): [number, number, number] =>
  ps.length ? [0, 1, 2].map((k) => ps.reduce((a, p) => a + p[k], 0) / ps.length) as [number, number, number] : [0, 0, 0];
const clampPos = (p: [number, number, number]): [number, number, number] => p.map((v) => Math.max(-40, Math.min(40, v))) as [number, number, number]; // generous: carried things can go far
/** "Water (H2O)" or "Methane (CH4): tetrahedral" -> "Water" / "Methane"; falls back to what was asked for. */
const tidyName = (title: string, asked: string) => {
  const name = title.split(/[(:,]/)[0].trim();
  return name && name.length <= 40 ? name : asked.replace(/^./, (c) => c.toUpperCase());
};
/** Next free spot: a widening spiral on the bench, about 3 units apart. */
function freeSlot(items: { pos: [number, number, number] }[]): [number, number, number] {
  for (let k = 0; k < 60; k++) {
    const a = k * 2.4;
    const r = k === 0 ? 0 : 3 + Math.sqrt(k) * 2.4;
    const p: [number, number, number] = [Math.cos(a) * r, 0, Math.sin(a) * r * 0.8];
    if (items.every((i) => Math.hypot(i.pos[0] - p[0], i.pos[2] - p[2]) > 5.2)) return p; // far apart: nothing touches (or auto-reacts) on arrival
  }
  return [0, 2, 0];
}

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
      return s.stageMode === 'sandbox' && s.section === 'visual' ? lesson.sandboxStep(cmd.step) : lesson.stepModel(cmd.step);
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
