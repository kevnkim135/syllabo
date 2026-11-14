import { useState, type FormEvent } from 'react';
import { lesson } from '../../core/lesson';

/** Small pill on the stage: type what you want to see and the model is replaced. */
export function AskModel({ busy = false }: { busy?: boolean }) {
  const [text, setText] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const request = text.trim();
    if (!request) return;
    lesson.requestVisual(request);
    setText('');
  };

  return (
    <form className="ask stage-ask" onSubmit={submit}>
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Ask for a model: benzene, a saddle surface…"
        aria-label="Ask for a model"
        enterKeyHint="go"
        onKeyDown={(e) => e.key === 'Escape' && e.currentTarget.blur()}
      />
      <button type="submit" className="primary go" aria-label="Build this model" title="Build this model" disabled={!text.trim()}>
        {busy ? <span className="spinner" /> : '↑'}
      </button>
    </form>
  );
}
