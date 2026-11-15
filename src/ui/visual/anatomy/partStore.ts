// Which part of a realistic model is pointed at or picked, shared between the 3D scene and the info card.
import { useSyncExternalStore } from 'react';

export interface PartState {
  hover: string | null;
  picked: string | null;
}
let state: PartState = { hover: null, picked: null };
const listeners = new Set<() => void>();
const set = (patch: Partial<PartState>) => {
  const next = { ...state, ...patch };
  if (next.hover === state.hover && next.picked === state.picked) return;
  state = next;
  listeners.forEach((l) => l());
};

export const parts = {
  hover: (name: string | null) => set({ hover: name }),
  pick: (name: string | null) => set({ picked: state.picked === name ? null : name }),
  reset: () => set({ hover: null, picked: null }),
  get: () => state,
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
export const useParts = () => useSyncExternalStore(subscribe, () => state);
