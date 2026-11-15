// Saved lessons and folders, kept in this browser (localStorage) so a lesson reopens instantly without
// generating anything again. Read with useLibrary(), change with `library.*`. Lesson snapshots are
// written by core/lesson.ts whenever a saved lesson changes.
import { useSyncExternalStore } from 'react';
import type { LessonKind, LessonMap, MoleculeSpec, Problem, ReactionResult, SandboxBody, ScopeInfo, VisualSpec } from '../../shared/types';

export interface SandboxItem {
  id: string;
  name: string;
  kind?: 'molecule' | 'body'; // missing = molecule (older saves)
  molecule?: MoleculeSpec;
  body?: SandboxBody;
  pos: [number, number, number];
  vel?: [number, number, number]; // bodies only
  rot?: [number, number, number, number]; // orientation quaternion (x, y, z, w)
  scale: number;
}
export interface SandboxReaction {
  result: ReactionResult;
  condition: string;
  reactants: string[];
}

export interface Folder {
  id: string;
  name: string;
  createdAt: number;
}

export interface SavedLesson {
  id: string; // same id as the open lesson it came from
  subject: string;
  level: string;
  focus: string | null;
  scope: ScopeInfo | null;
  section: LessonKind;
  data: Partial<Omit<LessonMap, 'visual'>>;
  models: VisualSpec[];
  modelIndex: number;
  explored: string[];
  solved: Problem[];
  folderId: string | null;
  sandbox?: { items: SandboxItem[]; reaction: SandboxReaction | null; gravity?: boolean; friction?: boolean; air?: boolean; elastic?: boolean; autoReact?: boolean; condition?: string };
  sandboxes?: NonNullable<SavedLesson['sandbox']>[];
  sandboxIndex?: number;
  createdAt: number;
  updatedAt: number;
}

export interface LibraryState {
  folders: Folder[];
  lessons: SavedLesson[]; // newest first
  error: string | null; // e.g. storage full
}

const KEY = 'lessonlab.library.v1';
const newId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
export const lessonTitle = (l: { subject: string | null; focus: string | null }) => (l.focus ? `${l.subject} › ${l.focus}` : (l.subject ?? ''));

function read(): LibraryState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const v = JSON.parse(raw) as Partial<LibraryState>;
      return { folders: v.folders ?? [], lessons: v.lessons ?? [], error: null };
    }
  } catch {
    /* unavailable or corrupt: start empty */
  }
  return { folders: [], lessons: [], error: null };
}

let state: LibraryState = typeof localStorage === 'undefined' ? { folders: [], lessons: [], error: null } : read();
const listeners = new Set<() => void>();

function set(next: Omit<LibraryState, 'error'>) {
  let error: string | null = null;
  try {
    localStorage.setItem(KEY, JSON.stringify({ folders: next.folders, lessons: next.lessons }));
  } catch {
    error = 'Could not save: browser storage is full or blocked. Delete a few saved lessons and try again.';
  }
  state = { ...next, error };
  listeners.forEach((l) => l());
}

export const library = {
  get: () => state,
  find: (id: string) => state.lessons.find((l) => l.id === id),

  /** Insert or update a lesson snapshot (keeps its folder unless one is given). */
  put(snap: SavedLesson) {
    const old = library.find(snap.id);
    const merged = { ...snap, createdAt: old?.createdAt ?? snap.createdAt, updatedAt: Date.now() };
    set({ folders: state.folders, lessons: [merged, ...state.lessons.filter((l) => l.id !== snap.id)] });
  },
  remove(id: string) {
    set({ folders: state.folders, lessons: state.lessons.filter((l) => l.id !== id) });
  },
  move(id: string, folderId: string | null) {
    set({ folders: state.folders, lessons: state.lessons.map((l) => (l.id === id ? { ...l, folderId } : l)) });
  },

  createFolder(name: string): Folder {
    const folder = { id: newId(), name: name.trim() || 'Untitled folder', createdAt: Date.now() };
    set({ folders: [...state.folders, folder], lessons: state.lessons });
    return folder;
  },
  /** The folder with this name (case-insensitive), created if missing. */
  ensureFolder(name: string): Folder {
    return state.folders.find((f) => f.name.toLowerCase() === name.trim().toLowerCase()) ?? library.createFolder(name);
  },
  renameFolder(id: string, name: string) {
    if (!name.trim()) return;
    set({ folders: state.folders.map((f) => (f.id === id ? { ...f, name: name.trim() } : f)), lessons: state.lessons });
  },
  /** Deleting a folder keeps its lessons; they become unfiled. */
  deleteFolder(id: string) {
    set({ folders: state.folders.filter((f) => f.id !== id), lessons: state.lessons.map((l) => (l.folderId === id ? { ...l, folderId: null } : l)) });
  },
};

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
export const useLibrary = () => useSyncExternalStore(subscribe, () => state);
export { newId };
