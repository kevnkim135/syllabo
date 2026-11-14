import type { TimelineEvent } from '../../../shared/types';

export function TimelineView({ events }: { events: TimelineEvent[] }) {
  return (
    <ol className="timeline">
      {events.map((e, i) => (
        <li key={i}>
          <span className="year">{e.year}</span>
          <div>
            <strong>{e.title}</strong>
            {e.figure && <span className="muted"> · {e.figure}</span>}
            <p>{e.detail}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
