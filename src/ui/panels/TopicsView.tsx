import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { TopicDetail, TopicNode } from '../../../shared/types';
import { fetchExpand } from '../../core/api';
import { lesson, useLesson } from '../../core/lesson';

type Entry = { detail?: TopicDetail; error?: string };

/**
 * Broad subject with no focus yet: a hub that asks what to explore.
 * Otherwise: the overview on the left, and an in-depth explanation of the clicked topic on the right.
 */
export function TopicsView({ topics }: { topics: TopicNode[] }) {
  const { subject, level, focus, scope } = useLesson();
  const [trail, setTrail] = useState<string[]>([]); // selected topic path, root first
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  const requested = useRef(new Set<string>());
  const key = trail.join(' > ');

  useEffect(() => {
    if (!subject || !trail.length || requested.current.has(key)) return;
    requested.current.add(key);
    const topic = trail[trail.length - 1];
    lesson.markExplored(topic);
    fetchExpand({ subject, level, topic, path: [...(focus ? [focus] : []), ...trail.slice(0, -1)] })
      .then((detail) => setEntries((e) => ({ ...e, [key]: { detail } })))
      .catch((err: Error) => {
        requested.current.delete(key);
        setEntries((e) => ({ ...e, [key]: { error: err.message } }));
      });
  }, [key, trail, subject, level, focus]);

  const entry = entries[key];
  const retry = () => setEntries(({ [key]: _drop, ...rest }) => rest);

  return (
    <>
    {scope?.scope === 'broad' && !focus && <ScopeHub />}
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
            {entry?.detail && (
              <p className="detail-actions">
                <button className="chip" onClick={() => lesson.setFocus(trail[trail.length - 1])}>
                  Focus the whole lesson on this
                </button>
              </p>
            )}
          </>
        )}
      </div>
    </div>
    </>
  );
}

/** Centre bubble for a broad subject: brief overview, an input to narrow down, and suggested branches. */
function ScopeHub() {
  const { subject, scope } = useLesson();
  const [text, setText] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    lesson.setFocus(text);
  };
  return (
    <>
      <section className="card hub">
        <h2>{subject}</h2>
        <p className="muted">{scope?.overview}</p>
        <form className="ask" onSubmit={submit}>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder={`What in ${subject} do you want to explore?`} aria-label="Specific topic" />
          <button type="submit" className="primary go" aria-label="Explore">
            ↑
          </button>
        </form>
      </section>
      <div className="branches">
        {scope?.suggestions.map((t, i) => (
          <button key={t} style={{ animationDelay: `${0.08 + i * 0.05}s` }} onClick={() => lesson.setFocus(t)}>
            {t}
          </button>
        ))}
      </div>
      <p className="browse">or browse the whole subject</p>
    </>
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
