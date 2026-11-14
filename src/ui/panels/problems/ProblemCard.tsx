import { useState, type CSSProperties } from 'react';
import type { Problem } from '../../../../shared/types';
import { dismissJob, retryJob, type Job, type Origin } from './solveQueue';
import { splitSteps } from './steps';

const LABEL: Record<Problem['difficulty'], string> = { base: 'base case', intro: 'intro', core: 'core', edge: 'edge case' };
const SOURCE = { typed: 'typed', spoken: 'spoken', screenshot: 'screenshot' } as const;

interface CardProps {
  p: Problem;
  id?: string;
  n?: number;
  builds?: string[]; // explored topics this problem names
  origin?: Origin; // set for the student's own problems
  mine?: boolean;
  delay?: number; // entrance stagger, seconds
}

export function ProblemCard({ p, id, n, builds = [], origin, mine, delay = 0 }: CardProps) {
  const steps = splitSteps(p.solution);
  const [shown, setShown] = useState(mine ? steps.length : 0); // the student asked for their own answer: show it all
  const total = steps.length;

  return (
    <article id={id} className={`card problem ${mine ? 'mine' : ''}`} style={{ animationDelay: `${delay}s` }}>
      <header>
        {n !== undefined && <span className="num">{n}</span>}
        {mine && <span className="badge yours">yours{origin ? ` · ${SOURCE[origin.source]}` : ''}</span>}
        <span className={`badge ${p.difficulty}`}>{LABEL[p.difficulty]}</span>
        {builds.map((t) => (
          <span key={t} className="builds" title={`Builds on "${t}" from your topic map`}>
            {t}
          </span>
        ))}
      </header>

      <div className="problem-body">
        {origin?.shot && <img className="asked-shot" src={origin.shot.url} alt="The screenshot you attached" />}
        <p className="prompt">{p.prompt}</p>
      </div>

      {p.why && (
        <details className="hint">
          <summary>Hint: what this tests</summary>
          <p className="muted">{p.why}</p>
        </details>
      )}

      <div className="worked">
        {shown > 0 && (
          <ol className="steps" aria-label="Worked solution">
            {steps.slice(0, shown).map((s, i) => (
              <li key={i} style={{ '--i': i + 1 } as CSSProperties}>
                {total > 1 && <span className="step-n">{i + 1}</span>}
                <span className="step-text">{s}</span>
              </li>
            ))}
          </ol>
        )}
        <div className="step-actions">
          {shown < total && (
            <button className="chip on" onClick={() => setShown(shown + 1)}>
              {total === 1 ? 'Show worked solution' : shown === 0 ? 'Show first step' : `Next step (${shown + 1} of ${total})`}
            </button>
          )}
          {shown < total - 1 && (
            <button className="chip" onClick={() => setShown(total)}>
              Show all {total} steps
            </button>
          )}
          {shown > 0 && (
            <button className="chip quiet" onClick={() => setShown(0)}>
              Hide solution
            </button>
          )}
          {shown > 0 && shown === total && total > 1 && <span className="muted step-done">All {total} steps shown</span>}
        </div>
      </div>
    </article>
  );
}

/** A problem that is being solved (or failed): shows exactly what was typed, heard or attached. */
export function PendingCard({ job }: { job: Job }) {
  const failed = !!job.error;
  return (
    <article className={`card problem mine pending ${failed ? 'failed' : ''}`} aria-busy={!failed}>
      <header>
        <span className="badge yours">yours · {SOURCE[job.source]}</span>
        {!failed && (
          <span className="solving">
            <span className="spinner" /> {job.shot ? 'Reading your screenshot and solving…' : 'Solving…'}
          </span>
        )}
      </header>
      <div className="problem-body">
        {job.shot && <img className="asked-shot" src={job.shot.url} alt="The screenshot you attached" />}
        {job.question ? (
          <p className="prompt">
            {job.source === 'spoken' && <span className="heard-label">Heard</span>}
            {job.source === 'spoken' ? `“${job.question}”` : job.question}
          </p>
        ) : (
          <p className="prompt muted">{job.shot?.name}</p>
        )}
      </div>
      {failed ? (
        <div className="error job-error" role="alert">
          <span>{job.error}</span>
          <button className="chip on" onClick={() => retryJob(job.id)}>
            Try again
          </button>
          <button className="chip" onClick={() => dismissJob(job.id)}>
            Dismiss
          </button>
        </div>
      ) : (
        <div className="skeleton" aria-hidden>
          <div className="bar" />
          <div className="bar short" />
        </div>
      )}
    </article>
  );
}
