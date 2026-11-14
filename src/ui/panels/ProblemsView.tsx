import type { Problem } from '../../../shared/types';

export function ProblemsView({ problems }: { problems: Problem[] }) {
  return (
    <div className="problems">
      {problems.map((p, i) => (
        <article key={i}>
          <header>
            <span className={`badge ${p.difficulty}`}>{p.difficulty === 'edge' ? 'edge case' : p.difficulty}</span>
            {p.why && <span className="muted">{p.why}</span>}
          </header>
          <p>{p.prompt}</p>
          <details>
            <summary>Show solution</summary>
            <p className="solution">{p.solution}</p>
          </details>
        </article>
      ))}
    </div>
  );
}
