import { commands } from '../commands';

/** True when the user is typing in a form field (shortcuts must not fire). */
export const isTyping = (e: Event) => e.target instanceof Element && !!e.target.closest('input, select, textarea, [contenteditable]');

/** Arrow keys rotate, +/- zoom, T/F/S views, R resets. Ignored while typing in a field. Returns a stop function. */
export function startKeyboard(target: Window = window) {
  const onKey = (e: KeyboardEvent) => {
    if (isTyping(e)) return;
    const step = e.shiftKey ? 0.4 : 0.15;
    const map: Record<string, Parameters<typeof commands.emit>[0]> = {
      ArrowLeft: { type: 'rotate', dx: -step, dy: 0 },
      ArrowRight: { type: 'rotate', dx: step, dy: 0 },
      ArrowUp: { type: 'rotate', dx: 0, dy: -step },
      ArrowDown: { type: 'rotate', dx: 0, dy: step },
      '+': { type: 'zoom', factor: 0.85 },
      '=': { type: 'zoom', factor: 0.85 },
      '-': { type: 'zoom', factor: 1.18 },
      t: { type: 'view', view: 'top' },
      f: { type: 'view', view: 'front' },
      s: { type: 'view', view: 'side' },
      r: { type: 'reset' },
      '[': { type: 'modelStep', step: -1 },
      ']': { type: 'modelStep', step: 1 },
    };
    const cmd = map[e.key] ?? map[e.key.toLowerCase()];
    if (!cmd || e.metaKey || e.ctrlKey) return;
    e.preventDefault();
    commands.emit(cmd);
  };
  target.addEventListener('keydown', onKey);
  return () => target.removeEventListener('keydown', onKey);
}
