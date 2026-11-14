import { useState } from 'react';
import type { Problem } from '../../../shared/types';

type Filter = 'all' | Problem['difficulty'];
const FILTERS: [Filter, string][] = [
  ['all', 'All'],
  ['base', 'Base cases'],
  ['intro', 'Intro'],
  ['core', 'Core'],
  ['edge', 'Edge cases'],
];

export function ProblemsView({ problems }: { problems: Problem[] }) {
  const [filter, setFilter] = useState<Filter>('all');
  const shown = problems.map((p, i) => ({ p, n: i + 1 })).filter(({ p }) => filter === 'all' || p.difficulty === filter);
  const count = (f: Filter) => (f === 'all' ? problems.length : problems.filter((p) => p.difficulty === f).length);

  return (
    <div className="problems">
      <div className="filters">
        {FILTERS.filter(([f]) => count(f) > 0).map(([f, label]) => (
          <button key={f} className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>
            {label} <span className="muted">{count(f)}</span>
          </button>
        ))}
      </div>
      {shown.map(({ p, n }) => (
        <article key={n} className="card">
          <header>
            <span className="num">{n}</span>
            <span className={`badge ${p.difficulty}`}>{p.difficulty === 'edge' ? 'edge case' : p.difficulty === 'base' ? 'base case' : p.difficulty}</span>
          </header>
          <p className="prompt">{p.prompt}</p>
          {p.why && (
            <details className="hint">
              <summary>Hint: what this tests</summary>
              <p className="muted">{p.why}</p>
            </details>
          )}
          <details>
            <summary>Show worked solution</summary>
            <p className="solution">{p.solution}</p>
          </details>
        </article>
      ))}
    </div>
  );
}
