// Single command bus: gestures, voice, keyboard and buttons all emit these; visuals and UI subscribe.
// Adding a new interaction = add a Command variant, emit it from input/, handle it in ui/ or core/lesson.ts.
import type { LessonKind } from '../../shared/types';

export type Hand = 'left' | 'right';

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
  | { type: 'modelStep'; step: 1 | -1 } // next / previous model in this lesson's gallery (swipe left / right)
  | { type: 'ask'; text: string }
  // ---- direct manipulation (handled by the sandbox; ignored elsewhere) ----
  // `hand` is the user's own left / right hand: each hand has its own pointer, taps and drags
  | { type: 'pointer'; hand: Hand; x: number; y: number; visible: boolean } // fingertip as a screen pointer, 0..1 (x right, y down)
  | { type: 'tap'; hand: Hand } // quick two-finger pinch: select / deselect what that hand points at
  | { type: 'grab'; hand: Hand; phase: 'start' | 'move' | 'end'; dx: number; dy: number; dz: number } // pinch held: drag; dx, dy screen fractions, dz scene units toward the user
  | { type: 'impulse'; ids: string[]; dv: [number, number, number] } // sandbox physics: change these bodies' velocity
  | { type: 'scaleSel'; factor: number } // a free-form spoken request: core/assistant.ts works out what it means
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
