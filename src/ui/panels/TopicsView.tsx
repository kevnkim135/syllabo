import { useEffect, useRef, useState } from 'react';
import type { TopicDetail, TopicNode } from '../../../shared/types';
import { fetchExpand } from '../../core/api';

interface Props {
  subject: string;
  level: string;
  topics: TopicNode[];
}

type Entry = { detail?: TopicDetail; error?: string };

/** Left: the overview tree. Right: click any topic or subtopic for an in-depth explanation, then keep drilling. */
export function TopicsView({ subject, level, topics }: Props) {
  const [trail, setTrail] = useState<string[]>([]); // selected topic path, root first
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  const requested = useRef(new Set<string>());
  const key = trail.join(' > ');

  useEffect(() => {
    if (!trail.length || requested.current.has(key)) return;
    requested.current.add(key);
    fetchExpand({ subject, level, topic: trail[trail.length - 1], path: trail.slice(0, -1) })
      .then((detail) => setEntries((e) => ({ ...e, [key]: { detail } })))
      .catch((err: Error) => {
        requested.current.delete(key);
        setEntries((e) => ({ ...e, [key]: { error: err.message } }));
      });
  }, [key, trail, subject, level]);

  const entry = entries[key];
  const retry = () => setEntries(({ [key]: _drop, ...rest }) => rest);

  return (
    <div className="topics-layout">
      <div className="card tree" role="tree" aria-label="Topic overview">
        {topics.map((t) => (
          <section key={t.title}>
            <button className={`node top ${trail[0] === t.title && trail.length === 1 ? 'on' : ''}`} onClick={() => setTrail([t.title])}>
              {t.title}
            </button>
            {t.summary && <p className="muted">{t.summary}</p>}
            <div className="chips">
              {t.children?.map((c) => (
                <button key={c.title} className={`chip ${trail[1] === c.title ? 'on' : ''}`} onClick={() => setTrail([t.title, c.title])} title={c.summary}>
                  {c.title}
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="card detail">
        {!trail.length && (
          <p className="muted">Select any topic to see an in-depth explanation, key points and deeper subtopics.</p>
        )}
        {!!trail.length && (
          <>
            <nav className="crumbs" aria-label="Breadcrumb">
              <button onClick={() => setTrail([])}>Overview</button>
              {trail.map((t, i) => (
                <span key={i}>
                  <span className="muted"> / </span>
                  <button onClick={() => setTrail(trail.slice(0, i + 1))}>{t}</button>
                </span>
              ))}
            </nav>
            {!entry && <p className="muted pulse">Writing a deeper explanation…</p>}
            {entry?.error && (
              <p className="error">
                {entry.error} <button onClick={retry}>Retry</button>
              </p>
            )}
            {entry?.detail && <Detail d={entry.detail} onPick={(t) => setTrail([...trail, t])} />}
          </>
        )}
      </div>
    </div>
  );
}

function Detail({ d, onPick }: { d: TopicDetail; onPick: (title: string) => void }) {
  return (
    <article>
      <h2>{d.title}</h2>
      {d.explanation.split(/\n{2,}/).map((p, i) => (
        <p key={i}>{p}</p>
      ))}
      {!!d.keyPoints.length && (
        <>
          <h3>Key points</h3>
          <ul>
            {d.keyPoints.map((k, i) => (
              <li key={i}>{k}</li>
            ))}
          </ul>
        </>
      )}
      {d.example && (
        <>
          <h3>Example</h3>
          <p className="callout">{d.example}</p>
        </>
      )}
      {!!d.subtopics.length && (
        <>
          <h3>Go deeper</h3>
          <div className="deeper">
            {d.subtopics.map((s) => (
              <button key={s.title} className="card-btn" onClick={() => onPick(s.title)}>
                <strong>{s.title}</strong>
                {s.summary && <span className="muted">{s.summary}</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </article>
  );
}
