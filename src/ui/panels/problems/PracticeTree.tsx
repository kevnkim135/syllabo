import { useMemo } from 'react';
import type { Problem } from '../../../../shared/types';
import { lesson } from '../../../core/lesson';
import { branchByExplored } from './branches';
import { ProblemCard } from './ProblemCard';

interface TreeProps {
  problems: Problem[];
  explored: string[];
  subject: string;
  focus: string | null;
  updating: boolean; // a newer set is being written
  show: (p: Problem) => boolean; // difficulty filter
}

/**
 * The sample problems drawn as a tree: the root holds the topics the student opened in the topic map,
 * and each topic that a problem names grows its own branch of cards.
 */
export function PracticeTree({ problems, explored, subject, focus, updating, show }: TreeProps) {
  const branches = useMemo(() => branchByExplored(problems, explored, subject), [problems, explored, subject]);
  const visible = branches.map((b) => ({ ...b, items: b.items.filter((it) => show(it.p)) })).filter((b) => b.items.length);
  const about = focus ?? subject;
  const naming = (t: string) => branches.flatMap((b) => b.items).filter((it) => it.builds.includes(t)); // problems that name a topic
  const jumpTo = (t: string) => {
    const first = visible.flatMap((b) => b.items).find((it) => it.builds.includes(t));
    if (first) document.getElementById(`problem-${first.n}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
  let order = 0; // stagger cards outward from the root

  return (
    <section className={`ptree ${updating ? 'updating' : ''}`} aria-label="Practice problems">
      <div className="ptree-root card">
        <p className="eyebrow">From your topic map</p>
        {explored.length ? (
          <>
            <p className="root-line">
              {updating ? (
                <span className="pulse">Rewriting the set to follow what you explored…</span>
              ) : (
                <>This set was written to build on the {explored.length === 1 ? 'topic' : `${explored.length} topics`} you opened.</>
              )}
            </p>
            <div className="chips">
              {explored.map((t, i) => {
                const count = naming(t).length;
                return count ? (
                  <button
                    key={t}
                    className="chip on topic"
                    style={{ animationDelay: `${0.12 + i * 0.05}s` }}
                    title={`Jump to the ${count === 1 ? 'problem' : `${count} problems`} that name this topic`}
                    onClick={() => jumpTo(t)}
                  >
                    {t} <span className="count">{count}</span>
                  </button>
                ) : (
                  <span key={t} className="chip topic woven" style={{ animationDelay: `${0.12 + i * 0.05}s` }} title="No problem names this topic outright; it shaped the set as a whole">
                    {t}
                  </span>
                );
              })}
            </div>
          </>
        ) : (
          <p className="root-line">
            Nothing opened yet, so this is a general set for {about}. Open a topic in the topic map and the problems will be rewritten to follow it.
          </p>
        )}
        <button className="chip map-link" onClick={() => lesson.goto('topics')}>
          {explored.length ? 'Explore more in the topic map' : 'Open the topic map'}
        </button>
      </div>

      <div className="pbranches">
        {visible.map((b) => (
          <section key={b.topic ?? '*'} className="pbranch">
            <h4 className={`pbranch-node ${b.topic ? '' : 'rest'}`} style={{ animationDelay: `${0.1 + order * 0.06}s` }}>
              {b.topic ? (
                <>
                  <span className="muted">Builds on</span> {b.topic}
                </>
              ) : explored.length ? (
                <>Across {about}</>
              ) : (
                <>Practice for {about}</>
              )}
              <span className="count">{b.items.length}</span>
            </h4>
            <div className="pbranch-cards">
              {b.items.map(({ p, n, builds }) => (
                <ProblemCard key={`${n}|${p.prompt}`} id={`problem-${n}`} p={p} n={n} builds={builds} delay={0.14 + order++ * 0.06} />
              ))}
            </div>
          </section>
        ))}
        {!visible.length && <p className="muted none">No problems with that label in this set.</p>}
      </div>
    </section>
  );
}
