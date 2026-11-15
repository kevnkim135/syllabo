import { MathText, splitMath } from '../../math/MathText';
import { Fragment, type ReactNode, useEffect, useRef } from 'react';
import type { TopicDetail } from '../../../../shared/types';
import { lesson } from '../../../core/lesson';
import { useDetail, usePersistent } from './useDetail';

interface BubbleProps {
  topic: string; // sent to /api/expand
  path: string[]; // ancestors, root first
  scope: string; // lesson identity; open state resets when it changes
  id: string; // stable id for remembering open state
  head: ReactNode; // always-visible summary
  related?: string[]; // extra clickable terms (TimelineEvent.related)
  startOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  onClose?: () => void; // branch bubbles can be dismissed
}

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
const uniq = (terms: string[]) => terms.filter((t, i) => t.trim() && terms.findIndex((u) => same(u, t)) === i);

/**
 * An expandable, collapsible bubble. Collapsed it shows `head`; expanded it reads like a short
 * encyclopedia entry whose terms open new bubbles branching off this one.
 */
export function Bubble({ topic, path, scope, id, head, related = [], startOpen = false, onOpenChange, onClose }: BubbleProps) {
  const [open, setOpen] = usePersistent(scope, `${id}#open`, startOpen);
  const [branches, setBranches] = usePersistent<string[]>(scope, `${id}#branches`, []);
  const everOpen = useRef(open);
  if (open) everOpen.current = true;
  const entry = useDetail(topic, path, everOpen.current);
  const newest = useRef<string | null>(null);
  const branchBox = useRef<HTMLDivElement>(null);

  const toggle = () => {
    setOpen(!open);
    onOpenChange?.(!open);
  };

  const openTerm = (term: string) => {
    if (branches.some((b) => same(b, term))) {
      setBranches(branches.filter((b) => !same(b, term)));
      return;
    }
    newest.current = term;
    setBranches([...branches, term]);
    lesson.markExplored(term);
  };

  // Bring a newly opened branch into view.
  useEffect(() => {
    if (!newest.current) return;
    newest.current = null;
    branchBox.current?.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [branches]);

  const terms = uniq([...related, ...(entry.detail?.subtopics.map((s) => s.title) ?? [])]).filter((t) => !same(t, topic));
  const isOpen = (term: string) => branches.some((b) => same(b, term));

  return (
    <div className="h-tree">
      <article className={`card h-bubble${open ? ' open' : ''}`}>
        <header className="h-head">
          <button className="h-toggle" onClick={toggle} aria-expanded={open} title={open ? 'Collapse' : 'Read more'}>
            <span className="h-head-main">{head}</span>
            <span className="h-chevron" aria-hidden />
          </button>
          {onClose && (
            <button className="h-close" onClick={onClose} aria-label={`Close ${topic}`} title="Close">
              ✕
            </button>
          )}
        </header>
        <div className="h-fold" inert={!open}>
          <div className="h-fold-inner">
            {everOpen.current && (
              <div className="h-entry">
                {entry.loading && (
                  <div className="skeleton" aria-busy>
                    <div className="bar" />
                    <div className="bar short" />
                    <div className="bar" />
                  </div>
                )}
                {entry.error && (
                  <p className="error">
                    {entry.error} <button onClick={entry.retry}>Retry</button>
                  </p>
                )}
                {entry.detail && <Entry detail={entry.detail} related={uniq(related)} terms={terms} isOpen={isOpen} onTerm={openTerm} />}
              </div>
            )}
          </div>
        </div>
      </article>

      {branches.length > 0 && (
        <div className="h-branches" ref={branchBox}>
          {branches.map((term) => (
            <div className="h-branch" key={term.toLowerCase()}>
              <Bubble
                topic={term}
                path={[...path, topic]}
                scope={scope}
                id={`${id}/${term.toLowerCase()}`}
                startOpen
                onClose={() => setBranches(branches.filter((b) => b !== term))}
                head={
                  <>
                    <span className="h-from">Branching from {topic}</span>
                    <strong className="h-title">{term}</strong>
                  </>
                }
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface EntryProps {
  detail: TopicDetail;
  related: string[];
  terms: string[];
  isOpen: (term: string) => boolean;
  onTerm: (term: string) => void;
}

function Entry({ detail, related, terms, isOpen, onTerm }: EntryProps) {
  const link = (text: string) => <Linked text={text} terms={terms} isOpen={isOpen} onTerm={onTerm} />;
  const subtopics = detail.subtopics.filter((s) => terms.some((t) => same(t, s.title)));
  return (
    <div className="h-article">
      {detail.explanation
        .split(/\n{2,}/)
        .filter((p) => p.trim())
        .map((p, i) => (
          <p key={i}>{link(p)}</p>
        ))}
      {detail.keyPoints.length > 0 && (
        <>
          <h3>Key points</h3>
          <ul className="h-points">
            {detail.keyPoints.map((k, i) => (
              <li key={i}>{link(k)}</li>
            ))}
          </ul>
        </>
      )}
      {detail.example && (
        <>
          <h3>Example</h3>
          <p className="h-example">{link(detail.example)}</p>
        </>
      )}
      {related.length > 0 && (
        <>
          <h3>See also</h3>
          <div className="chips">
            {related.map((term) => (
              <button key={term} className={`chip h-term${isOpen(term) ? ' on' : ''}`} onClick={() => onTerm(term)} aria-pressed={isOpen(term)}>
                {term}
              </button>
            ))}
          </div>
        </>
      )}
      {subtopics.length > 0 && (
        <>
          <h3>Go deeper</h3>
          <ul className="h-deeper">
            {subtopics.map((s) => (
              <li key={s.title}>
                <button className={`h-sub${isOpen(s.title) ? ' on' : ''}`} onClick={() => onTerm(s.title)} aria-pressed={isOpen(s.title)}>
                  <MathText className="h-link-text" text={s.title} />
                  {s.summary && <MathText className="h-sub-summary" text={s.summary} />}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Text with every mention of a known term turned into an inline link, encyclopedia style. */
function Linked({ text, terms, isOpen, onTerm }: { text: string; terms: string[]; isOpen: (t: string) => boolean; onTerm: (t: string) => void }) {
  // Math first (rendered with KaTeX), then clickable terms inside the plain-text runs only.
  return (
    <>
      {splitMath(text).map((m, k) =>
        'html' in m ? (
          <span key={k} className={m.display ? 'math-block' : 'math-inline'} dangerouslySetInnerHTML={{ __html: m.html }} />
        ) : (
          <Terms key={k} text={m.text} terms={terms} isOpen={isOpen} onTerm={onTerm} />
        ),
      )}
    </>
  );
}

function Terms({ text, terms, isOpen, onTerm }: { text: string; terms: string[]; isOpen: (t: string) => boolean; onTerm: (t: string) => void }) {
  const usable = terms.filter((t) => t.length >= 3).sort((a, b) => b.length - a.length);
  if (usable.length === 0) return <>{text}</>;
  const parts = text.split(new RegExp(`\\b(${usable.map(escape).join('|')})\\b`, 'gi'));
  return (
    <>
      {parts.map((part, i) => {
        const term = i % 2 === 1 ? usable.find((t) => same(t, part)) : undefined;
        if (!term) return <Fragment key={i}>{part}</Fragment>;
        return (
          <button key={i} className={`h-link${isOpen(term) ? ' on' : ''}`} onClick={() => onTerm(term)}>
            {part}
          </button>
        );
      })}
    </>
  );
}
