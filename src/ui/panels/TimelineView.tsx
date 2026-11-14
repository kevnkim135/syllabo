import { useEffect, useRef, useState } from 'react';
import type { TimelineEvent, TimelineEventType } from '../../../shared/types';
import { useLesson } from '../../core/lesson';
import { AirflowField } from './history/AirflowField';
import { Bubble } from './history/Bubble';

const TYPE_LABEL: Record<TimelineEventType, string> = { discovery: 'Discovery', event: 'Event', figure: 'Figure' };
const TYPES = Object.keys(TYPE_LABEL) as TimelineEventType[];
const LEAD = 0.68; // the line's tip sits this far down the visible area
const eventId = (e: TimelineEvent, i: number) => `${i}|${e.year}|${e.title}`;

export function TimelineView({ events }: { events: TimelineEvent[] }) {
  const { subject, level, focus } = useLesson();
  const scope = `${subject}|${level}|${focus ?? ''}`;
  const track = useRef<HTMLDivElement>(null);
  const rail = useRef<HTMLDivElement>(null);
  const tip = useRef<HTMLDivElement>(null);
  const boost = useRef(0); // opening a card draws the line on to the events after it
  const [reached, setReached] = useState(0); // events the line has passed; they stay revealed

  // A new set of events (new subject or focus) draws from the top again.
  const signature = events.map(eventId).join('\n');
  useEffect(() => {
    boost.current = 0;
    setReached(0);
  }, [signature]);

  // The line: its tip eases toward the reader's progress (scroll position, or the last card opened).
  useEffect(() => {
    const el = track.current!;
    const scroller = (el.closest('.content') as HTMLElement | null) ?? document.documentElement;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let length = 0;
    let count = 0;
    let last = performance.now();
    let raf = 0;

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const top = el.getBoundingClientRect().top;
      const total = el.offsetHeight;
      const dots = Array.from(el.querySelectorAll<HTMLElement>('.h-dot'), (d) => {
        const r = d.getBoundingClientRect();
        return r.top + r.height / 2 - top;
      });
      const atEnd = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 12;
      let goal = atEnd ? total : scroller.getBoundingClientRect().top + scroller.clientHeight * LEAD - top;
      if (boost.current > 0 && dots.length) goal = Math.max(goal, dots[Math.min(boost.current, dots.length - 1)] + 36);
      goal = Math.max(0, Math.min(total, goal));

      // Never retreat, and stay attached to revealed events when cards above them grow.
      const floor = count > 0 ? (dots[Math.min(count, dots.length) - 1] ?? 0) : 0;
      if (goal > length) length = still ? goal : length + (goal - length) * (1 - Math.exp(-dt * 3.2));
      length = Math.min(total, Math.max(length, floor));

      rail.current!.style.height = `${length}px`;
      tip.current!.style.transform = `translateY(${length}px)`;
      tip.current!.classList.toggle('done', total - length < 2);

      const passed = dots.filter((y) => y <= length + 1).length;
      if (passed > count) {
        count = passed;
        setReached((r) => Math.max(r, passed));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [signature]);

  const present = TYPES.filter((t) => events.some((e) => (e.type ?? 'event') === t));

  return (
    <div className="history">
      <AirflowField />

      <header className="h-top">
        <ul className="h-legend">
          {present.map((t) => (
            <li key={t}>
              <span className={`h-dot ${t}`} aria-hidden /> {TYPE_LABEL[t]}
            </li>
          ))}
        </ul>
        {events.length > 0 && (
          <div className="h-origin">
            <strong>{events[0].year}</strong>
            {events.length > 1 && (
              <>
                <span aria-hidden>→</span>
                <strong>{events[events.length - 1].year}</strong>
              </>
            )}
            <span className="h-count">
              {events.length} {events.length === 1 ? 'moment' : 'moments'}
            </span>
          </div>
        )}
      </header>

      <div className="h-track" ref={track} key={signature}>
        <div className="h-rail" ref={rail} aria-hidden />
        <div className="h-tip" ref={tip} aria-hidden />
        <ol className="h-list">
          {events.map((e, i) => {
            const type = e.type ?? 'event';
            return (
              <li key={eventId(e, i)} className={`h-row ${i % 2 ? 'right' : 'left'} ${type}${i < reached ? ' seen' : ''}`}>
                <div className="h-cell">
                  <Bubble
                    topic={e.title}
                    path={focus ? [focus] : []}
                    scope={scope}
                    id={eventId(e, i)}
                    related={e.related}
                    onOpenChange={(open) => {
                      if (open) boost.current = Math.max(boost.current, i + 1);
                    }}
                    head={
                      <>
                        <span className="h-meta">
                          <span className={`h-type ${type}`}>{TYPE_LABEL[type]}</span>
                          {e.figure && <span className="h-person">{e.figure}</span>}
                        </span>
                        <strong className="h-title">{e.title}</strong>
                        <span className="h-detail">{e.detail}</span>
                      </>
                    }
                  />
                </div>
                <div className="h-node" aria-hidden>
                  <span className={`h-dot ${type}`} />
                </div>
                <div className="h-year">{e.year}</div>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
