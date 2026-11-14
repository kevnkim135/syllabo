import { useEffect, useRef, useState, type ClipboardEvent, type FormEvent } from 'react';
import { IMAGE_TYPES, type Problem, type SolveRequest } from '../../../shared/types';
import { fetchSolve } from '../../core/api';
import { lesson, useLesson } from '../../core/lesson';

type Filter = 'all' | Problem['difficulty'];
type Shot = NonNullable<SolveRequest['image']> & { url: string };
const FILTERS: [Filter, string][] = [
  ['all', 'All'],
  ['base', 'Base cases'],
  ['intro', 'Intro'],
  ['core', 'Core'],
  ['edge', 'Edge cases'],
];
const LABEL: Record<Problem['difficulty'], string> = { base: 'base case', intro: 'intro', core: 'core', edge: 'edge case' };

/** Read an image file as base64 for POST /api/solve. */
function readShot(file: File): Promise<Shot> {
  return new Promise((resolve, reject) => {
    if (!(IMAGE_TYPES as readonly string[]).includes(file.type)) return reject(new Error('Use a PNG, JPEG, WebP or GIF image.'));
    if (file.size > 5_000_000) return reject(new Error('Image must be under 5 MB.'));
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.onload = () => {
      const url = String(reader.result);
      resolve({ mediaType: file.type as Shot['mediaType'], data: url.slice(url.indexOf(',') + 1), url });
    };
    reader.readAsDataURL(file);
  });
}

export function ProblemsView({ problems }: { problems: Problem[] }) {
  const { subject, level, focus, asked, solved } = useLesson();
  const [filter, setFilter] = useState<Filter>('all');
  const [text, setText] = useState('');
  const [shot, setShot] = useState<Shot | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function solve(question: string, image?: Shot | null) {
    if (!subject || (!question.trim() && !image)) return;
    setBusy(true);
    setError('');
    try {
      const p = await fetchSolve({
        subject,
        level,
        focus: focus ?? undefined,
        question: question.trim() || undefined,
        image: image ? { mediaType: image.mediaType, data: image.data } : undefined,
      });
      lesson.addSolved(p);
      setText('');
      setShot(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // Spoken problems ("solve ...") arrive through the lesson store.
  const handled = useRef(0);
  useEffect(() => {
    if (!asked || asked.id === handled.current) return;
    handled.current = asked.id;
    lesson.consumeAsk();
    void solve(asked.question);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asked]);

  const attach = (file?: File | null) => file && readShot(file).then(setShot, (e: Error) => setError(e.message));
  const onPaste = (e: ClipboardEvent) => attach([...e.clipboardData.files].find((f) => f.type.startsWith('image/')));
  const submit = (e: FormEvent) => {
    e.preventDefault();
    void solve(text, shot);
  };

  const shown = problems.map((p, i) => ({ p, n: i + 1 })).filter(({ p }) => filter === 'all' || p.difficulty === filter);
  const count = (f: Filter) => (f === 'all' ? problems.length : problems.filter((p) => p.difficulty === f).length);

  return (
    <div className="problems">
      <form className="solve-bar" onSubmit={submit} onPaste={onPaste}>
        <input type="text" value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a problem, or paste / attach a screenshot of one" aria-label="Your problem" />
        {shot && <img className="thumb" src={shot.url} alt="Attached screenshot" title="Click to remove" onClick={() => setShot(null)} />}
        <label className="attach">
          Screenshot
          <input type="file" accept={IMAGE_TYPES.join(',')} hidden onChange={(e) => (attach(e.target.files?.[0]), (e.target.value = ''))} />
        </label>
        <button type="submit" className="primary" disabled={busy}>
          {busy ? 'Solving…' : 'Solve'}
        </button>
      </form>
      <p className="muted solve-hint">With voice on, say "solve" followed by your problem.</p>
      {error && <p className="error">{error}</p>}

      {solved.map((p, i) => (
        <Card key={`mine-${solved.length - i}`} p={p} tag="yours" open />
      ))}

      <div className="filters">
        {FILTERS.filter(([f]) => count(f) > 0).map(([f, label]) => (
          <button key={f} className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>
            {label} <span className="muted">{count(f)}</span>
          </button>
        ))}
      </div>
      {shown.map(({ p, n }) => (
        <Card key={n} p={p} n={n} />
      ))}
    </div>
  );
}

function Card({ p, n, tag, open }: { p: Problem; n?: number; tag?: string; open?: boolean }) {
  return (
    <article className={`card ${tag ? 'mine' : ''}`}>
      <header>
        {n && <span className="num">{n}</span>}
        {tag && <span className="badge yours">{tag}</span>}
        <span className={`badge ${p.difficulty}`}>{LABEL[p.difficulty]}</span>
      </header>
      <p className="prompt">{p.prompt}</p>
      {p.why && (
        <details className="hint">
          <summary>Hint: what this tests</summary>
          <p className="muted">{p.why}</p>
        </details>
      )}
      <details open={open}>
        <summary>Show worked solution</summary>
        <p className="solution">{p.solution}</p>
      </details>
    </article>
  );
}
