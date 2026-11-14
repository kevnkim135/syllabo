import { useEffect, useRef, useState, type ReactNode } from 'react';
import { commands, type Command } from '../../core/commands';

// Every control emits the same commands as gestures, voice and keys, so the camera eases the same way.
const STEP = 0.32; // radians per tap
const HOLD = 0.055; // radians per tick while held
const ZOOM = 0.82;

type Icon = keyof typeof ICONS;
const ICONS = {
  rotate: <path d="M4.5 12a7.5 7.5 0 1 0 2.4-5.5M4 4.5v3.6h3.6" />,
  tilt: <path d="M12 4v16M8 7.5 12 4l4 3.5M8 16.5l4 3.5 4-3.5" />,
  zoom: <path d="M10.5 17a6.5 6.5 0 1 1 0-13 6.5 6.5 0 0 1 0 13ZM15.2 15.2 20 20M8 10.5h5M10.5 8v5" />,
  views: <path d="M12 3.5 19.5 8v8L12 20.5 4.5 16V8L12 3.5ZM4.5 8 12 12.5 19.5 8M12 12.5v8" />,
  reset: <path d="M12 8.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6ZM12 3v3M12 18v3M3 12h3M18 12h3" />,
  spark: <path d="M10 4.5 11.6 9l4.4 1.5-4.4 1.6L10 16.5 8.4 12.1 4 10.5 8.4 9 10 4.5ZM17.5 14.5l.8 2.200 2.200.8-2.200.8-.8 2.200-.8-2.200-2.200-.8 2.200-.8.8-2.200Z" />,
  left: <path d="M14.5 6 8.5 12l6 6" />,
  right: <path d="m9.5 6 6 6-6 6" />,
  up: <path d="m6 14.5 6-6 6 6" />,
  down: <path d="m6 9.5 6 6 6-6" />,
  minus: <path d="M6 12h12" />,
  plus: <path d="M6 12h12M12 6v12" />,
  panel: <path d="M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v10a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 17V7A1.5 1.5 0 0 1 5 5.5ZM9 5.5v13" />,
} as const;

const Glyph = ({ name }: { name: Icon }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {ICONS[name]}
  </svg>
);

/** Tap for one step; press and hold to keep moving in small steps. Keyboard activation still works. */
function HoldButton({ icon, title, tap, hold }: { icon: Icon; title: string; tap: Command; hold: Command }) {
  const timers = useRef<{ delay?: number; tick?: number }>({});
  const stop = () => {
    window.clearTimeout(timers.current.delay);
    window.clearInterval(timers.current.tick);
  };
  useEffect(() => stop, []);

  return (
    <button
      type="button"
      className="seg"
      title={title}
      aria-label={title}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        stop();
        commands.emit(tap);
        timers.current.delay = window.setTimeout(() => {
          timers.current.tick = window.setInterval(() => commands.emit(hold), 40);
        }, 280);
      }}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onClick={(e) => e.detail === 0 && commands.emit(tap)} // keyboard (Enter / Space)
    >
      <Glyph name={icon} />
    </button>
  );
}

function Row({ icon, label, children }: { icon: Icon; label: string; children: ReactNode }) {
  return (
    <div className="row" role="group" aria-label={label}>
      <span className="ico">
        <Glyph name={icon} />
      </span>
      <span className="name">{label}</span>
      <span className="segs">{children}</span>
    </div>
  );
}

const rot = (dx: number, dy: number): Command => ({ type: 'rotate', dx, dy });
const zoom = (factor: number): Command => ({ type: 'zoom', factor });

/**
 * Slim vertical bar on the edge of the stage. Collapsed it is a column of icons; on hover, keyboard focus
 * or a click on the top button (pin) it springs open into labelled controls.
 */
export function ControlBar({ busy = false }: { busy?: boolean }) {
  const [pinned, setPinned] = useState(false);

  return (
    <nav className={`controlbar${pinned ? ' open' : ''}`} aria-label="Model controls">
      <button
        type="button"
        className="row action head"
        aria-pressed={pinned}
        title={pinned ? 'Collapse controls' : 'Keep controls open'}
        onClick={() => setPinned((p) => !p)}
      >
        <span className="ico">
          <Glyph name="panel" />
        </span>
        <span className="name">Controls</span>
        <span className="hint">{pinned ? 'Pinned' : 'Pin'}</span>
      </button>
      <hr />
      <Row icon="rotate" label="Rotate">
        <HoldButton icon="left" title="Rotate left (←)" tap={rot(-STEP, 0)} hold={rot(-HOLD, 0)} />
        <HoldButton icon="right" title="Rotate right (→)" tap={rot(STEP, 0)} hold={rot(HOLD, 0)} />
      </Row>
      <Row icon="tilt" label="Tilt">
        <HoldButton icon="up" title="Tilt up (↑)" tap={rot(0, -STEP)} hold={rot(0, -HOLD)} />
        <HoldButton icon="down" title="Tilt down (↓)" tap={rot(0, STEP)} hold={rot(0, HOLD)} />
      </Row>
      <Row icon="zoom" label="Zoom">
        <HoldButton icon="minus" title="Zoom out (-)" tap={zoom(1 / ZOOM)} hold={zoom(1.035)} />
        <HoldButton icon="plus" title="Zoom in (+)" tap={zoom(ZOOM)} hold={zoom(1 / 1.035)} />
      </Row>
      <Row icon="views" label="View">
        {(['top', 'front', 'side'] as const).map((view) => (
          <button key={view} type="button" className="seg text" title={`${view[0].toUpperCase()}${view.slice(1)} view (${view[0].toUpperCase()})`} onClick={() => commands.emit({ type: 'view', view })}>
            {view}
          </button>
        ))}
      </Row>
      <hr />
      <button type="button" className="row action" title="Reset the view (R)" onClick={() => commands.emit({ type: 'reset' })}>
        <span className="ico">
          <Glyph name="reset" />
        </span>
        <span className="name">Reset view</span>
        <kbd className="hint">R</kbd>
      </button>
      <button type="button" className="row action" title="Show a different example" onClick={() => commands.emit({ type: 'newExample' })}>
        <span className="ico">{busy ? <span className="spinner" /> : <Glyph name="spark" />}</span>
        <span className="name">New example</span>
      </button>
    </nav>
  );
}
