import { useEffect, useRef, useState } from 'react';
import { startGestures } from '../../core/input/gestures';
import { startVoice } from '../../core/input/voice';

export function InputControls() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const stopCam = useRef<(() => void) | null>(null);
  const stopMic = useRef<(() => void) | null>(null);
  const [camOn, setCamOn] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(
    () => () => {
      stopCam.current?.();
      stopMic.current?.();
    },
    [],
  );

  async function toggleCam() {
    if (stopCam.current) {
      stopCam.current();
      stopCam.current = null;
      setCamOn(false);
      return;
    }
    try {
      setStatus('Loading hand tracking…');
      stopCam.current = await startGestures(videoRef.current!, (g) => setStatus(`gesture: ${g}`));
      setCamOn(true);
    } catch (e) {
      setStatus(`Camera error: ${(e as Error).message}`);
    }
  }

  function toggleMic() {
    if (stopMic.current) {
      stopMic.current();
      stopMic.current = null;
      setMicOn(false);
      return;
    }
    const stop = startVoice((t) => setStatus(`heard: "${t}"`));
    if (!stop) return setStatus('Voice needs Chrome or Edge (Web Speech API).');
    stopMic.current = stop;
    setMicOn(true);
  }

  return (
    <aside className="inputs">
      <video ref={videoRef} muted playsInline className={camOn ? '' : 'hidden'} />
      <div className="row">
        <button onClick={toggleCam}>{camOn ? 'Stop' : 'Start'} gestures</button>
        <button onClick={toggleMic}>{micOn ? 'Stop' : 'Start'} voice</button>
      </div>
      {status && <p className="muted">{status}</p>}
      <details>
        <summary>Controls</summary>
        <p>Pinch + drag to rotate · pinch both hands and spread to zoom · open-hand swipe to change tabs</p>
        <p>Say: "zoom in/out", "rotate left/right", "top/front/side view", "reset", "next", "previous"</p>
      </details>
    </aside>
  );
}
