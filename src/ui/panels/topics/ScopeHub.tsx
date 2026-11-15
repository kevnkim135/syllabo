import { MathText } from '../../math/MathText';
import { DeltaField } from '../../home/DeltaField';
import { useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { lesson, useLesson } from '../../../core/lesson';

type Side = 'left' | 'right';

/**
 * Centre bubble for a broad subject: the subject, a very brief overview and an input to narrow down.
 * Suggested topics branch out from it on both sides; clicking one is the same as typing it.
 */
export function ScopeHub() {
  const { subject, scope } = useLesson();
  const [text, setText] = useState('');
  const wrap = useRef<HTMLDivElement>(null);
  const core = useRef<HTMLElement>(null);
  const [links, setLinks] = useState<string[]>([]);
  const [box, setBox] = useState({ w: 0, h: 0 });

  const suggestions = scope?.suggestions ?? [];
  const sides: Record<Side, { topic: string; i: number }[]> = { left: [], right: [] };
  suggestions.forEach((topic, i) => sides[i % 2 ? 'right' : 'left'].push({ topic, i }));

  // Connector lines are measured from the laid-out boxes (offset*, so entrance transforms do not skew them).
  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const measure = () => {
      const c = core.current;
      if (!c) return;
      const cy = c.offsetTop + c.offsetHeight / 2;
      const paths: string[] = [];
      el.querySelectorAll<HTMLElement>('[data-branch]').forEach((b) => {
        const left = b.dataset.side === 'left';
        const x1 = left ? c.offsetLeft : c.offsetLeft + c.offsetWidth;
        const x2 = left ? b.offsetLeft + b.offsetWidth : b.offsetLeft;
        const y2 = b.offsetTop + b.offsetHeight / 2;
        const y1 = cy + Math.max(-1, Math.min(1, (y2 - cy) / (c.offsetHeight || 1))) * c.offsetHeight * 0.3;
        const mid = (x1 + x2) / 2;
        paths[Number(b.dataset.branch)] = `M${x1} ${y1} C${mid} ${y1} ${mid} ${y2} ${x2} ${y2}`;
      });
      setLinks(paths);
      setBox({ w: el.offsetWidth, h: el.offsetHeight });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [suggestions.join('|')]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (text.trim()) lesson.setFocus(text);
  };

  const column = (side: Side) => (
    <div className={`hub-side ${side}`}>
      {sides[side].map(({ topic, i }, n, all) => {
        // Middle bubbles sit further out than the top and bottom ones, so the set fans around the centre.
        const t = all.length > 1 ? (n / (all.length - 1)) * 2 - 1 : 0;
        const out = `${(Math.cos((t * Math.PI) / 2) * 2.6).toFixed(2)}vw`;
        return (
          <button
            key={topic}
            className="hub-branch"
            data-branch={i}
            data-side={side}
            style={{ animationDelay: `${0.3 + i * 0.07}s`, [side === 'left' ? 'marginRight' : 'marginLeft']: out }}
            onClick={() => lesson.setFocus(topic)}
          >
            {topic}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="hub" ref={wrap}>
      <DeltaField clearCenter={false} gap={64} faint={0.55} className="hub-field" />
      <svg className="hub-links" width={box.w} height={box.h} aria-hidden>
        {links.map((d, i) => d && <path key={i} d={d} pathLength={1} style={{ animationDelay: `${0.18 + i * 0.07}s` }} />)}
      </svg>
      {column('left')}
      <section className="card hub-core" ref={core}>
        <h2>{subject}</h2>
        {scope?.overview && <MathText as="p" className="muted" text={scope.overview} />}
        <form className="ask" onSubmit={submit}>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`What in ${subject} do you want to explore?`}
            aria-label={`What in ${subject} do you want to explore?`}
          />
          <button type="submit" className="primary go" aria-label="Explore" disabled={!text.trim()}>
            ↑
          </button>
        </form>
        {!!suggestions.length && <p className="hub-hint">or pick a branch</p>}
      </section>
      {column('right')}
    </div>
  );
}
