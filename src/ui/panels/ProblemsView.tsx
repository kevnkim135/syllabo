import { useEffect, useState } from 'react';
import type { Problem } from '../../../shared/types';
import { lesson, useLesson } from '../../core/lesson';
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
        <div className="filters" role="group" aria-label="Filter by difficulty">
          {FILTERS.filter(([f]) => count(f) > 0).map(([f, label]) => (
            <button key={f} className={`chip ${active === f ? 'on' : ''}`} aria-pressed={active === f} onClick={() => setFilter(f)}>
              {label} <span className="count">{count(f)}</span>
            </button>
          ))}
        </div>
      </div>

      <PracticeTree
        problems={problems}
        explored={explored}
        subject={subject ?? ''}
        focus={focus}
        updating={!!loading.problems}
        show={(p) => active === 'all' || p.difficulty === active}
      />
    </div>
  );
}
