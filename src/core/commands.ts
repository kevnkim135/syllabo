// Single command bus: gestures, voice, and keyboard all emit these; visuals and UI subscribe.
// Adding a new interaction = add a Command variant, emit it from input/, handle it in ui/.

export type Command =
  | { type: 'rotate'; dx: number; dy: number } // radians
  | { type: 'zoom'; factor: number } // <1 zooms in, >1 zooms out
  | { type: 'view'; view: 'top' | 'front' | 'side' }
  | { type: 'reset' }
  | { type: 'next' }
  | { type: 'prev' };

type Listener = (cmd: Command) => void;
const listeners = new Set<Listener>();

export const commands = {
  emit(cmd: Command) {
    listeners.forEach((l) => l(cmd));
  },
  on(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
