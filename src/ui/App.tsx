import { useEffect, useState, type FormEvent } from 'react';
import { LESSON_KINDS, type LessonKind, type LessonMap } from '../../shared/types';
import { fetchLesson } from '../core/api';
import { commands } from '../core/commands';
import { TimelineView } from './panels/TimelineView';
import { TopicsView } from './panels/TopicsView';
import { ProblemsView } from './panels/ProblemsView';
import { VisualStage } from './visual/VisualStage';
import { InputControls } from './visual/InputControls';

const LABELS: Record<LessonKind, string> = {
  visual: 'Interactive model',
  timeline: 'History',
  topics: 'Topic map',
  problems: 'Problems',
};
const TABS: LessonKind[] = ['visual', 'timeline', 'topics', 'problems'];
const LEVELS = ['middle school', 'high school', 'undergraduate', 'graduate'];

export function App() {
  const [subject, setSubject] = useState('');
  const [level, setLevel] = useState('high school');
  const [active, setActive] = useState<{ subject: string; level: string } | null>(null);
  const [tab, setTab] = useState<LessonKind>('visual');
  const [cache, setCache] = useState<Partial<LessonMap>>({});
  const [errors, setErrors] = useState<Partial<Record<LessonKind, string>>>({});

  // Lazily generate each lesson type the first time its tab is opened.
  useEffect(() => {
    if (!active || cache[tab] !== undefined || errors[tab]) return;
    let cancelled = false;
    fetchLesson({ ...active, kind: tab })
      .then((r) => !cancelled && setCache((c) => ({ ...c, [tab]: r.data }) as Partial<LessonMap>))
      .catch((e: Error) => !cancelled && setErrors((x) => ({ ...x, [tab]: e.message })));
    return () => {
      cancelled = true;
    };
  }, [active, tab, cache, errors]);

  // Swipe / voice "next" and "previous" switch tabs.
  useEffect(
    () =>
      commands.on((cmd) => {
        if (cmd.type !== 'next' && cmd.type !== 'prev') return;
        setTab((t) => TABS[(TABS.indexOf(t) + (cmd.type === 'next' ? 1 : TABS.length - 1)) % TABS.length]);
      }),
    [],
  );

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!subject.trim()) return;
    setCache({});
    setErrors({});
    setActive({ subject: subject.trim(), level });
  }

  const loading = active && cache[tab] === undefined && !errors[tab];

  return (
    <div className="app">
      <header>
        <h1>LessonLab</h1>
        <form onSubmit={submit}>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Any subject: organic chemistry, multivariable calculus, projectile motion…"
          />
          <select value={level} onChange={(e) => setLevel(e.target.value)}>
            {LEVELS.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
          <button type="submit">Generate</button>
        </form>
      </header>

      {active && (
        <>
          <nav className="tabs">
            {TABS.filter((k) => LESSON_KINDS.includes(k)).map((k) => (
              <button key={k} className={k === tab ? 'on' : ''} onClick={() => setTab(k)}>
                {LABELS[k]}
              </button>
            ))}
          </nav>
          <main>
            {loading && <p className="muted">Generating {LABELS[tab].toLowerCase()}…</p>}
            {errors[tab] && (
              <p className="error">
                {errors[tab]}{' '}
                <button onClick={() => setErrors((x) => ({ ...x, [tab]: undefined }))}>Retry</button>
              </p>
            )}
            {tab === 'visual' && cache.visual && <VisualStage spec={cache.visual} />}
            {tab === 'timeline' && cache.timeline && <TimelineView events={cache.timeline} />}
            {tab === 'topics' && cache.topics && <TopicsView topics={cache.topics} />}
            {tab === 'problems' && cache.problems && <ProblemsView problems={cache.problems} />}
          </main>
        </>
      )}

      <InputControls />
    </div>
  );
}
