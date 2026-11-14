import type { TimelineEvent, TimelineEventType } from '../../../shared/types';

const TYPE_LABEL: Record<TimelineEventType, string> = { discovery: 'Discovery', event: 'Event', figure: 'Figure' };

export function TimelineView({ events }: { events: TimelineEvent[] }) {
  return (
    <div className="timeline-wrap">
      <ul className="legend">
        {(Object.keys(TYPE_LABEL) as TimelineEventType[]).map((t) => (
          <li key={t}>
            <span className={`dot ${t}`} /> {TYPE_LABEL[t]}
          </li>
        ))}
      </ul>
      <ol className="timeline">
        {events.map((e, i) => (
          <li key={i} className={e.type ?? 'event'}>
            <span className="year">{e.year}</span>
            <span className={`dot ${e.type ?? 'event'}`} aria-hidden />
            <div className="card">
              <strong>{e.title}</strong>
              {e.figure && <span className="person">{e.figure}</span>}
              <p>{e.detail}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
