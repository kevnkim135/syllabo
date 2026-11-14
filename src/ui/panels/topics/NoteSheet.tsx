import { NoteFigure } from './NoteFigure';
import { useEffect, useRef, useState } from 'react';
import type { TopicDetail, TopicNode } from '../../../../shared/types';
import { fetchExpand } from '../../../core/api';
import { lesson, useLesson } from '../../../core/lesson';

type Entry = { detail?: TopicDetail; error?: string };
type Sheet = { entries: Record<string, Entry>; open: string[] }; // keyed by JSON of the title path, root first

// What the student has built so far, per lesson + focus, so the sheet survives a visit to another section.
const sheets = new Map<string, Sheet>();

const keyOf = (path: string[]) => JSON.stringify(path);
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

interface Ctx {
  subject: string;
  sheet: Sheet;
  toggle: (path: string[]) => void;
  retry: (path: string[]) => void;
}

/** An outline that grows in place: every line opens into deeper notes, whose own lines open again. */
export function NoteSheet({ topics }: { topics: TopicNode[] }) {
  const { subject, level, focus, scope, loading } = useLesson();
  const id = `${subject}|${level}|${focus ?? ''}`;
  const [sheet, setSheet] = useState<Sheet>(() => sheets.get(id) ?? { entries: {}, open: [] });
  const pending = useRef(new Set<string>());

  useEffect(() => {
    sheets.set(id, sheet);
  }, [id, sheet]);

  // Any open note without notes yet gets fetched (also covers retry, and a request cut off by leaving the section).
  useEffect(() => {
    if (!subject) return;
    for (const key of sheet.open) {
      if (sheet.entries[key] || pending.current.has(key)) continue;
      pending.current.add(key);
      const path = JSON.parse(key) as string[];
      const put = (entry: Entry) => {
        pending.current.delete(key);
        setSheet((s) => ({ ...s, entries: { ...s.entries, [key]: entry } }));
      };
      fetchExpand({ subject, level, topic: path[path.length - 1], path: [...(focus ? [focus] : []), ...path.slice(0, -1)] })
        .then((detail) => put({ detail }))
        .catch((err: Error) => put({ error: err.message }));
    }
  }, [sheet, subject, level, focus]);

  const ctx: Ctx = {
    subject: focus ? `${subject ?? ""} ${focus}` : (subject ?? ""),
    sheet,
    toggle(path) {
      const key = keyOf(path);
      const opening = !sheet.open.includes(key);
      if (opening) lesson.markExplored(path[path.length - 1]);
      setSheet((s) => ({ ...s, open: opening ? [...s.open, key] : s.open.filter((k) => k !== key) }));
    },
    retry(path) {
      const key = keyOf(path);
      setSheet(({ entries: { [key]: _drop, ...entries }, open }) => ({ entries, open }));
    },
  };

  const built = Object.values(sheet.entries).filter((e) => e.detail).length;
  const rewriting = !!loading.topics; // the outline on screen belongs to the previous focus

  return (
    <article className="card sheet">
      <header className="sheet-head">
        <span className="sheet-eyebrow">Notes{focus && subject ? ` · ${subject}` : ''}</span>
        <h2>{focus ?? subject}</h2>
        {!focus && scope?.overview && <p className="muted">{scope.overview}</p>}
        <p className="sheet-meta">
          {built ? `${built} ${built === 1 ? 'note' : 'notes'} built out. ` : ''}
          Click any line to build it out; the sheet grows as you go.
        </p>
      </header>

      {rewriting ? (
        <div className="skeleton" aria-busy>
          <p className="muted pulse">Writing the outline…</p>
          <div className="bar" />
          <div className="bar short" />
          <div className="bar" />
        </div>
      ) : (
        <ol className="notes">
          {topics.map((t, i) => (
            <Note key={t.title} node={t} path={[]} num={`${i + 1}`} ctx={ctx} />
          ))}
        </ol>
      )}
    </article>
  );
}

function Note({ node, path, num, ctx }: { node: TopicNode; path: string[]; num: string; ctx: Ctx }) {
  const here = [...path, node.title];
  const key = keyOf(here);
  const open = ctx.sheet.open.includes(key);
  const entry = ctx.sheet.entries[key];
  const detail = entry?.detail;
  const given = node.children ?? [];
  // Deeper lines discovered by expanding; they stay on the sheet once found.
  const found = (detail?.subtopics ?? []).filter((s) => !given.some((g) => same(g.title, s.title)) && !same(s.title, node.title));
  const kids = [...given, ...(open ? found : [])];

  return (
    <li className={`note${path.length ? '' : ' top'}${open ? ' open' : ''}${detail ? ' seen' : ''}`}>
      <div className="note-row">
        <button className="note-line" aria-expanded={open} onClick={() => ctx.toggle(here)}>
          <span className="note-num">{num}</span>
          <span className="note-text">
            <span className="note-title">{node.title}</span>
            {node.summary && <span className="note-sum">{node.summary}</span>}
          </span>
          <span className="note-mark" aria-hidden>
            +
          </span>
        </button>
        <button className="chip note-focus" onClick={() => lesson.setFocus(node.title)}>
          Focus the whole lesson on this
        </button>
      </div>

      {open && (
        <div className="note-body">
          {!entry && <p className="muted pulse">Writing deeper notes…</p>}
          {entry?.error && (
            <p className="error">
              {entry.error} <button onClick={() => ctx.retry(here)}>Retry</button>
            </p>
          )}
          {detail && (
            <>
              <NoteFigure query={detail.imageQuery ?? `${node.title} ${ctx.subject}`} alt={node.title} />
              {detail.explanation.split(/\n{2,}/).map((p, i) => (
                <p key={i}>{p}</p>
              ))}
              {!!detail.keyPoints.length && (
                <ul className="note-points" aria-label="Key points">
                  {detail.keyPoints.map((k, i) => (
                    <li key={i} style={{ animationDelay: `${0.06 + i * 0.05}s` }}>
                      {k}
                    </li>
                  ))}
                </ul>
              )}
              {detail.example && (
                <p className="note-example">
                  <span>Example</span>
                  {detail.example}
                </p>
              )}
            </>
          )}
        </div>
      )}

      {!!kids.length && (
        <ol className="note-kids">
          {kids.map((k, i) => (
            <Note key={k.title} node={k} path={here} num={`${num}.${i + 1}`} ctx={ctx} />
          ))}
        </ol>
      )}
    </li>
  );
}
