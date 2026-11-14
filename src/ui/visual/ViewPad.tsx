import { commands, type Command } from '../../core/commands';

// On-screen "visual commands": every button emits the same commands as gestures, voice and keys.
const PAD: [string, Command, string][] = [
  ['↺', { type: 'rotate', dx: -0.3, dy: 0 }, 'Rotate left (←)'],
  ['↑', { type: 'rotate', dx: 0, dy: -0.3 }, 'Tilt up (↑)'],
  ['↻', { type: 'rotate', dx: 0.3, dy: 0 }, 'Rotate right (→)'],
  ['−', { type: 'zoom', factor: 1.2 }, 'Zoom out (-)'],
  ['↓', { type: 'rotate', dx: 0, dy: 0.3 }, 'Tilt down (↓)'],
  ['+', { type: 'zoom', factor: 0.83 }, 'Zoom in (+)'],
];
const VIEWS: [string, Command][] = [
  ['Top', { type: 'view', view: 'top' }],
  ['Front', { type: 'view', view: 'front' }],
  ['Side', { type: 'view', view: 'side' }],
  ['Reset', { type: 'reset' }],
  ['New example', { type: 'newExample' }],
];

export function ViewPad() {
  return (
    <div className="viewpad">
      <div className="pad">
        {PAD.map(([label, cmd, title]) => (
          <button key={title} title={title} aria-label={title} onClick={() => commands.emit(cmd)}>
            {label}
          </button>
        ))}
      </div>
      <div className="views">
        {VIEWS.map(([label, cmd]) => (
          <button key={label} onClick={() => commands.emit(cmd)}>
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
