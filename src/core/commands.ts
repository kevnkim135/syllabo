// Single command bus: gestures, voice, keyboard and buttons all emit these; visuals and UI subscribe.
// Adding a new interaction = add a Command variant, emit it from input/, handle it in ui/ or core/lesson.ts.
import type { LessonKind } from '../../shared/types';

export type Command =
  // ---- camera (handled by the 3D stage) ----
  | { type: 'rotate'; dx: number; dy: number } // radians: yaw, pitch
  | { type: 'rotateAxis'; axis: [number, number, number]; angle: number } // radians about a view-space axis
  | { type: 'zoom'; factor: number } // <1 zooms in, >1 zooms out
  | { type: 'view'; view: 'top' | 'front' | 'side' }
  | { type: 'reset' }
  // ---- navigation (handled by core/lesson.ts) ----
  | { type: 'next' }
  | { type: 'prev' }
  | { type: 'goto'; section: LessonKind }
  | { type: 'home' }
  // ---- content (handled by core/lesson.ts) ----
  | { type: 'newExample' } // a different random model
  | { type: 'generate'; request: string } // "show me benzene", "graph x squared minus y squared"
  | { type: 'solve'; question: string }; // spoken or typed problem

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
