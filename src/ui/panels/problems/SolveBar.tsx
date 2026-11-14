import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { IMAGE_TYPES } from '../../../../shared/types';
import { formatSize, readShot, startSolve, type Shot } from './solveQueue';

const hasFiles = (e: DragEvent) => !!e.dataTransfer && [...e.dataTransfer.types].includes('Files');

/** Type a problem, or attach / paste / drop a screenshot of one. Submitting hands it to the solve queue. */
export function SolveBar() {
  const [text, setText] = useState('');
  const [shot, setShot] = useState<Shot | null>(null);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);

  const attach = (file?: File | null) => {
    if (!file) return;
    readShot(file).then(
      (s) => {
        setShot(s);
        setError('');
      },
      (e: Error) => setError(e.message),
    );
  };
  const attachRef = useRef(attach);
  attachRef.current = attach;

  // Paste and drop work anywhere in the section, not only inside the bar.
  useEffect(() => {
    let depth = 0;
    const onPaste = (e: ClipboardEvent) => {
      const files = [...(e.clipboardData?.files ?? [])];
      if (!files.length) return; // plain text: let it land in the field
      e.preventDefault();
      attachRef.current(files.find((f) => f.type.startsWith('image/')) ?? files[0]);
    };
    const onEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth++;
      setDragging(true);
    };
    const onOver = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault(); // allow the drop (otherwise the browser opens the file)
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    };
    const onLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (!depth) setDragging(false);
    };
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setDragging(false);
      const files = [...(e.dataTransfer?.files ?? [])];
      attachRef.current(files.find((f) => f.type.startsWith('image/')) ?? files[0]);
    };
    document.addEventListener('paste', onPaste);
    window.addEventListener('dragenter', onEnter);
    window.addEventListener('dragover', onOver);
    window.addEventListener('dragleave', onLeave);
    window.addEventListener('drop', onDrop);
    return () => {
      document.removeEventListener('paste', onPaste);
      window.removeEventListener('dragenter', onEnter);
      window.removeEventListener('dragover', onOver);
      window.removeEventListener('dragleave', onLeave);
      window.removeEventListener('drop', onDrop);
    };
  }, []);

  // Grow the field with its content, up to a few lines.
  useEffect(() => {
    const el = field.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 150)}px`;
  }, [text]);

  const ready = !!text.trim() || !!shot;
  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (!ready) return;
    startSolve(text, shot, shot ? 'screenshot' : 'typed');
    setText('');
    setShot(null);
    setError('');
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) submit(e);
  };

  return (
    <div className="solve">
      <form className={`solve-bar ${dragging ? 'dragging' : ''}`} onSubmit={submit}>
        <div className="solve-row">
          <textarea
            ref={field}
            rows={1}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={shot ? 'Add a note about the screenshot (optional)' : 'Type a problem, or paste, drop or attach a screenshot of one'}
            aria-label="Your problem"
          />
          <button type="button" className="attach" onClick={() => fileInput.current?.click()}>
            <svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect x="2.5" y="4" width="15" height="12" rx="3" />
              <circle cx="7" cy="8.5" r="1.4" />
              <path d="M3 14l4-3.5 3 2.5 3-3 4 4" />
            </svg>
            {shot ? 'Replace' : 'Screenshot'}
          </button>
          <input
            ref={fileInput}
            type="file"
            accept={IMAGE_TYPES.join(',')}
            hidden
            aria-label="Attach a screenshot"
            onChange={(e) => {
              attach(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          <button type="submit" className="primary" disabled={!ready}>
            Solve
          </button>
        </div>

        {shot && (
          <figure className="shot">
            <img src={shot.url} alt="Screenshot of your problem" />
            <figcaption>
              <strong>{shot.name}</strong>
              <span className="muted">{formatSize(shot.size)} · ready to solve</span>
              <button type="button" className="chip" onClick={() => setShot(null)}>
                Remove
              </button>
            </figcaption>
          </figure>
        )}

        {dragging && (
          <div className="drop-veil" aria-hidden>
            Drop the screenshot to attach it
          </div>
        )}
      </form>

      {error && (
        <p className="error solve-error" role="alert">
          <span>{error}</span>
          <button type="button" className="chip" onClick={() => setError('')}>
            Dismiss
          </button>
        </p>
      )}
      <p className="muted solve-hint">
        Enter to solve, Shift + Enter for a new line. With voice on, say "solve" followed by your problem.
      </p>
    </div>
  );
}
