import { useEffect, useRef, useState, type ReactNode } from 'react';
import { GESTURE, GESTURE_GUIDE, startGestures, type GestureLabel } from '../../core/input/gestures';
import { startKeyboard } from '../../core/input/keyboard';
import { startVoice, type VoiceEvent } from '../../core/input/voice';
import { useLesson } from '../../core/lesson';
import { useAssistant } from '../../core/assistant';

// What the chip on the camera preview says for each recognized gesture.
const GESTURE_TEXT: Record<GestureLabel, string> = {
  none: 'Show a hand',
  idle: 'Hands seen',
  hand: 'Open hand: swipe left or right through models',
  gather: 'Three-finger pinch: hold to zoom in',
  spread: 'Three fingers spread: hold to zoom out',
  zoomIn: 'Zooming in',
  zoomOut: 'Zooming out',
  point: 'Pointing: twirl for a new example',
  newExample: 'New example',
  clutch: 'Pinch held: draw circles with your other index finger',
  rotate: 'Rotating',
  fists: 'Hold both fists to go home',
  home: 'Home',
  modelNext: 'Next model',
  grab: 'Pinch: tap to select, hold to drag',
  dragging: 'Dragging the selection',
  scale: 'Both pinches: spread or close to scale',
  modelPrev: 'Previous model',
};
const EVENTS: GestureLabel[] = ['newExample', 'home', 'modelNext', 'modelPrev'];
const SWAP_KEY = 'lessonlab.swapHands';

const icon = (children: ReactNode) => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {children}
  </svg>
);
const ICONS = {
  hand: icon(<path d="M6.5 10V5a1.2 1.2 0 0 1 2.4 0v4-5.5a1.2 1.2 0 0 1 2.4 0V9 4.5a1.2 1.2 0 0 1 2.4 0V10 7a1.2 1.2 0 0 1 2.4 0v5.5c0 3-2 5-5 5-2.2 0-3.4-.8-4.6-2.6L4 11.5c-.6-1 .8-2 1.7-1L6.5 12" />),
  mic: icon(
    <>
      <rect x="7.5" y="2.5" width="5" height="9" rx="2.5" />
      <path d="M4.5 9.5a5.5 5.5 0 0 0 11 0M10 15v2.5" />
    </>,
  ),
  help: icon(
    <>
      <circle cx="10" cy="10" r="7.5" />
      <path d="M7.8 7.8a2.3 2.3 0 1 1 3.3 2.1c-.7.4-1.1.8-1.1 1.6M10 14.2v.1" />
    </>,
  ),
  expand: icon(<path d="M11.5 3.5h5v5M8.5 16.5h-5v-5M16.5 3.5l-5.5 5.5M3.5 16.5 9 11" />),
};

/**
 * The input dock: a compact pill in the bottom-left corner (inside the sidebar column, so it never sits
 * on lesson content). Turning on gestures grows a small mirrored camera preview with the hand skeleton
 * above it; the preview can be enlarged on demand.
 */
export function InputControls() {
  const assistant = useAssistant();
  const inLesson = !!useLesson().subject;
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stopCam = useRef<(() => void) | null>(null);
  const stopMic = useRef<(() => void) | null>(null);
  const heardTimer = useRef(0);
  const [cam, setCam] = useState<'off' | 'loading' | 'on'>('off');
  const [micOn, setMicOn] = useState(false);
  const [big, setBig] = useState(false);
  const [help, setHelp] = useState(false);
  const [gesture, setGesture] = useState<{ label: GestureLabel; hold: number }>({ label: 'none', hold: 0 });
  const [heard, setHeard] = useState<VoiceEvent | null>(null);
  const [error, setError] = useState('');
  const [swap, setSwap] = useState(() => {
    try {
      return localStorage.getItem(SWAP_KEY) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => startKeyboard(), []);
  useEffect(
    () => () => {
      stopCam.current?.();
      stopMic.current?.();
      clearTimeout(heardTimer.current);
    },
    [],
  );
  useEffect(() => {
    GESTURE.swapHands = swap;
    try {
      localStorage.setItem(SWAP_KEY, swap ? '1' : '0');
    } catch {
      /* private mode */
    }
  }, [swap]);
  useEffect(() => {
    if (!help) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setHelp(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [help]);

  async function toggleCam() {
    if (cam === 'loading') return;
    if (stopCam.current) {
      stopCam.current();
      stopCam.current = null;
      setCam('off');
      setBig(false);
      return;
    }
    setError('');
    setCam('loading');
    try {
      stopCam.current = await startGestures(videoRef.current!, canvasRef.current, (f) => {
        const hold = Math.round(f.hold * 20) / 20;
        setGesture((g) => (g.label === f.label && g.hold === hold ? g : { label: f.label, hold }));
      });
      setCam('on');
    } catch (e) {
      setCam('off');
      const err = e as Error;
      setError(err.name === 'NotAllowedError' ? 'Camera access was blocked. Allow it in the address bar and try again.' : `Camera error: ${err.message}`);
    }
  }

  function toggleMic() {
    if (stopMic.current) {
      stopMic.current();
      stopMic.current = null;
      setMicOn(false);
      setHeard(null);
      return;
    }
    setError('');
    const stop = startVoice(
      (e) => {
        // Keep showing the action that an interim result triggered while the sentence finishes.
        setHeard((prev) => (e.actions.length || !prev || prev.final ? e : { ...e, actions: prev.actions }));
        clearTimeout(heardTimer.current);
        if (e.final) heardTimer.current = window.setTimeout(() => setHeard(null), 6000);
      },
      (message) => {
        setError(message);
        stopMic.current = null;
        setMicOn(false);
      },
    );
    if (!stop) return setError('Voice needs Chrome or Edge (Web Speech API).');
    stopMic.current = stop;
    setMicOn(true);
  }

  const camShown = cam !== 'off';
  return (
    <aside className={`dock ${inLesson ? 'in-lesson' : ''} ${big ? 'big' : ''}`} aria-label="Gesture and voice input">
      {help && (
        <div className="dock-help card" role="dialog" aria-label="Gesture and voice guide">
          <h3>Gestures</h3>
          <ul>
            {GESTURE_GUIDE.map((g) => (
              <li key={g.action}>
                <b>{g.action}</b>
                <span>{g.gesture}</span>
              </li>
            ))}
          </ul>
          <h3>Voice</h3>
          <p className="muted">"Go to history" · "Show me benzene" · "Solve two x plus three equals seven" · "Another example" · "Go home"</p>
          <button className="chip" onClick={() => setSwap((s) => !s)} aria-pressed={swap} title="Use this if the L and R tags on the preview are on the wrong hands">
            Left / right hands swapped? {swap ? 'Swapped' : 'Swap them'}
          </button>
        </div>
      )}

      <div className="dock-preview" hidden={!camShown}>
        <video ref={videoRef} muted playsInline />
        <canvas ref={canvasRef} />
        {cam === 'loading' ? (
          <span className="dock-gesture">
            <span className="spinner" /> Loading hand tracking…
          </span>
        ) : (
          <span key={gesture.label} className={`dock-gesture ${EVENTS.includes(gesture.label) ? 'event' : ''}`} aria-live="polite">
            {GESTURE_TEXT[gesture.label]}
          </span>
        )}
        {gesture.label === 'fists' && <span className="dock-hold" style={{ width: `${gesture.hold * 100}%` }} />}
        <button className="dock-expand" onClick={() => setBig((b) => !b)} aria-label={big ? 'Shrink camera preview' : 'Enlarge camera preview'} title={big ? 'Shrink' : 'Enlarge'}>
          {ICONS.expand}
        </button>
      </div>

      {micOn && (
        <div className="dock-heard" aria-live="polite">
          {heard ? (
            <>
              <p className={heard.final ? '' : 'interim'}>“{heard.transcript}”</p>
              {assistant && assistant.heard === heard.transcript ? (
                <p className={assistant.state === 'unsure' ? 'muted' : assistant.state === 'thinking' ? 'did pulse' : 'did'}>{assistant.say}</p>
              ) : heard.actions.length > 0 ? (
                <p className="did">{heard.actions.join(' · ')}</p>
              ) : (
                heard.final && <p className="muted">No command heard</p>
              )}
            </>
          ) : (
            <p className="muted pulse">Listening…</p>
          )}
        </div>
      )}
      {error && <p className="dock-error">{error}</p>}

      <div className="dock-bar">
        <button className={camShown ? 'on' : ''} onClick={toggleCam} aria-pressed={camShown} title={camShown ? 'Stop gestures' : 'Start gestures (camera)'}>
          {ICONS.hand}
          <span>Gestures</span>
        </button>
        <button className={micOn ? 'on' : ''} onClick={toggleMic} aria-pressed={micOn} title={micOn ? 'Stop voice' : 'Start voice (microphone)'}>
          {ICONS.mic}
          <span>Voice</span>
        </button>
        <button className={`round ${help ? 'on' : ''}`} onClick={() => setHelp((h) => !h)} aria-expanded={help} aria-label="Gesture and voice guide" title="Gesture and voice guide">
          {ICONS.help}
        </button>
      </div>
    </aside>
  );
}
