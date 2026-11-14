import { useEffect, useMemo, useState } from 'react';
import type { Problem } from '../../../shared/types';
import { lesson, useLesson } from '../../core/lesson';
import { branchByExplored } from './problems/branches';
import { PracticeTree } from './problems/PracticeTree';
import { PendingCard, ProblemCard } from './problems/ProblemCard';
import { SolveBar } from './problems/SolveBar';
import { originOf, startSolve, useJobs } from './problems/solveQueue';

type Filter = 'all' | Problem['difficulty'];
const FILTERS: [Filter, string][] = [
  ['all', 'All'],
  ['base', 'Base cases'],
  ['intro', 'Intro'],
  ['core', 'Core'],
  ['edge', 'Edge cases'],
];

let lastAsk = 0; // id of the last spoken problem handed to the solve queue

/**
 * Problems section: the student's own problems (typed, spoken or from a screenshot) on top,
 * then a practice set that branches from the topics they explored in the topic map.
 */
export function ProblemsView({ problems }: { problems: Problem[] }) {
  const { id: lessonId, subject, focus, explored, solved, asked, loading } = useLesson();
  const jobs = useJobs().filter((j) => j.lessonId === lessonId);
  const [filter, setFilter] = useState<Filter>('all');
  const [mode, setMode] = useState<'one' | 'all'>(() => {
    try {
      return localStorage.getItem('lessonlab.problemsMode') === 'all' ? 'all' : 'one';
    } catch {
      return 'one';
    }
  });
  const [at, setAt] = useState(0);
  const pick = (m: 'one' | 'all') => {
    setMode(m);
    try {
      localStorage.setItem('lessonlab.problemsMode', m);
    } catch {
      /* per-browser preference only */
    }
  };

  // Spoken problems ("solve ...") arrive through the lesson store.
  useEffect(() => {
    if (!asked) return;
    lesson.consumeAsk();
    if (asked.id === lastAsk) return; // StrictMode runs effects twice
    lastAsk = asked.id;
    if (asked.question) startSolve(asked.question, null, 'spoken');
  }, [asked]);

  const count = (f: Filter) => (f === 'all' ? problems.length : problems.filter((p) => p.difficulty === f).length);
  const active = count(filter) ? filter : 'all'; // a regenerated set may not have the chosen label

  return (
    <div className="problems">
      <SolveBar />

      {(jobs.length > 0 || solved.length > 0) && (
        <section className="own" aria-label="Your problems">
          <h3>
            Your problems <span className="count">{solved.length}</span>
          </h3>
          {jobs.map((j) => (
            <PendingCard key={`job-${j.id}`} job={j} />
          ))}
          {solved.map((p, i) => (
            <ProblemCard key={`mine-${solved.length - i}`} p={p} origin={originOf(p)} mine />
          ))}
        </section>
      )}

      <div className="practice-head">
        <h3>Practice set</h3>
        <div className="view-toggle" role="group" aria-label="Show problems">
          <button className={mode === 'one' ? 'on' : ''} aria-pressed={mode === 'one'} onClick={() => pick('one')}>
            One at a time
          </button>
          <button className={mode === 'all' ? 'on' : ''} aria-pressed={mode === 'all'} onClick={() => pick('all')}>
            All
          </button>
        </div>
        <div className="filters" role="group" aria-label="Filter by difficulty">
          {FILTERS.filter(([f]) => count(f) > 0).map(([f, label]) => (
            <button key={f} className={`chip ${active === f ? 'on' : ''}`} aria-pressed={active === f} onClick={() => setFilter(f)}>
              {label} <span className="count">{count(f)}</span>
            </button>
          ))}
        </div>
      </div>

      {mode === 'one' ? (
        <OneAtATime
          problems={problems}
          explored={explored}
          subject={subject ?? ''}
          show={(p) => active === 'all' || p.difficulty === active}
          at={at}
          setAt={setAt}
        />
      ) : (
      <PracticeTree
        problems={problems}
        explored={explored}
        subject={subject ?? ''}
        focus={focus}
        updating={!!loading.problems}
        show={(p) => active === 'all' || p.difficulty === active}
      />
      )}
    </div>
  );
}

/** One problem on screen, with previous / next and a progress row. Arrow keys work too. */
function OneAtATime({ problems, explored, subject, show, at, setAt }: { problems: Problem[]; explored: string[]; subject: string; show: (p: Problem) => boolean; at: number; setAt: (n: number) => void }) {
  const items = useMemo(() => branchByExplored(problems, explored, subject).flatMap((b) => b.items).filter((it) => show(it.p)).sort((a, b) => a.n - b.n), [problems, explored, subject, show]);
  const i = Math.min(at, Math.max(0, items.length - 1));
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest?.('input, textarea, select')) return;
      if (e.key === 'ArrowRight') setAt(Math.min(items.length - 1, i + 1));
      if (e.key === 'ArrowLeft') setAt(Math.max(0, i - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [i, items.length, setAt]);
  const it = items[i];
  if (!it) return null;
  return (
    <section className="one-at-a-time" aria-label="Practice problem">
      <div className="oat-progress" role="group" aria-label="Problems">
        {items.map((x, k) => (
          <button key={x.n} className={`${k === i ? 'on' : ''} ${x.p.difficulty}`} onClick={() => setAt(k)} aria-label={`Problem ${x.n}`} title={`Problem ${x.n} (${x.p.difficulty})`} />
        ))}
      </div>
      <ProblemCard key={it.n} p={it.p} id={`problem-${it.n}`} n={it.n} builds={it.builds} />
      <div className="oat-nav">
        <button className="chip" disabled={i === 0} onClick={() => setAt(i - 1)}>
          ← Previous
        </button>
        <span className="muted">
          {i + 1} of {items.length}
        </span>
        <button className="chip on" disabled={i >= items.length - 1} onClick={() => setAt(i + 1)}>
          Next →
        </button>
      </div>
    </section>
  );
}
