import { lazy, Suspense, useEffect, useRef, useState, type FormEvent } from 'react';
import { LESSON_KINDS, type LessonKind, type LessonMap, type VisualSpec } from '../../shared/types';
import { fetchLesson } from '../core/api';
import { commands } from '../core/commands';
import { isTyping } from '../core/input/keyboard';
import { TimelineView } from './panels/TimelineView';
import { TopicsView } from './panels/TopicsView';
import { ProblemsView } from './panels/ProblemsView';
import { InputControls } from './visual/InputControls';

const VisualStage = lazy(() => import('./visual/VisualStage').then((m) => ({ default: m.VisualStage })));

const EXAMPLES = ['Organic chemistry', 'Multivariable calculus', 'Projectile motion', 'Quantum mechanics'];

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
  const inflight = useRef(new Set<LessonKind>());
  const lessonId = useRef(0);
  // Last visual spec, kept across subjects so the 3D canvas never unmounts.
  const [stageSpec, setStageSpec] = useState<VisualSpec | null>(null);
  useEffect(() => {
    if (cache.visual) setStageSpec(cache.visual);
  }, [cache.visual]);
  const [errors, setErrors] = useState<Partial<Record<LessonKind, string>>>({});

  // Generate the active tab first, then prefetch the rest so switching (or swiping) feels instant.
  // Results are tagged with the lesson they belong to, so a stale response from a previous
  // subject is ignored without cancelling requests for the current one.
  useEffect(() => {
    if (!active) return;
    const lesson = lessonId.current;
    for (const kind of [tab, ...TABS.filter((k) => k !== tab)]) {
      if (cache[kind] !== undefined || errors[kind] || inflight.current.has(kind)) continue;
      inflight.current.add(kind);
      fetchLesson({ ...active, kind })
        .then((r) => lesson === lessonId.current && setCache((c) => ({ ...c, [kind]: r.data }) as Partial<LessonMap>))
        .catch((e: Error) => lesson === lessonId.current && setErrors((x) => ({ ...x, [kind]: e.message })))
        .finally(() => lesson === lessonId.current && inflight.current.delete(kind));
    }
  }, [active, tab, cache, errors]);

  // Keyboard: 1-4 jump to a tab (arrows / +/- / R are handled by the keyboard input module).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!active || isTyping(e) || e.metaKey || e.ctrlKey) return;
      const i = Number(e.key) - 1;
      if (TABS[i]) setTab(TABS[i]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active]);

  // Swipe / voice "next" and "previous" switch tabs.
  useEffect(
    () =>
      commands.on((cmd) => {
        if (cmd.type !== 'next' && cmd.type !== 'prev') return;
        setTab((t) => TABS[(TABS.indexOf(t) + (cmd.type === 'next' ? 1 : TABS.length - 1)) % TABS.length]);
      }),
    [],
  );

  function start(s: string) {
    if (!s.trim()) return;
    setSubject(s);
    lessonId.current++;
    inflight.current.clear();
    setCache({});
    setErrors({});
    setActive({ subject: s.trim(), level });
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    start(subject);
  }

  const loading = active && cache[tab] === undefined && !errors[tab];
  const showStage = !!active && tab === 'visual' && cache.visual !== undefined;

  return (
    <div className="app">
      <header className="topbar">
        <button className="brand" onClick={() => setActive(null)} aria-label="Home">
          <span className="logo" aria-hidden>◆</span> LessonLab
        </button>
        <form onSubmit={submit} className="search">
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Any subject: organic chemistry, multivariable calculus, projectile motion…"
            aria-label="Subject"
          />
          <select value={level} onChange={(e) => setLevel(e.target.value)} aria-label="Level">
            {LEVELS.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
          <button type="submit" className="primary">Generate</button>
        </form>
      </header>

      {!active && (
        <section className="empty">
          <h2>Learn anything, then reach out and touch it.</h2>
          <p className="muted">History, an explorable overview, problems from base cases to edge cases, and a 3D model you steer with both hands.</p>
          <div className="chips">
            {EXAMPLES.map((x) => (
              <button key={x} type="button" className="chip" onClick={() => start(x)}>
                {x}
              </button>
            ))}
          </div>
        </section>
      )}

      {active && (
        <>
          <div className="lesson-head">
            <div>
              <h1>{active.subject}</h1>
              <span className="muted">{active.level}</span>
            </div>
            <nav className="tabs" role="tablist">
              {TABS.filter((k) => LESSON_KINDS.includes(k)).map((k, i) => (
                <button key={k} role="tab" aria-selected={k === tab} className={k === tab ? 'on' : ''} onClick={() => setTab(k)}>
                  <span className="key">{i + 1}</span> {LABELS[k]}
                  {cache[k] === undefined && !errors[k] && <span className="spinner" aria-label="loading" />}
                </button>
              ))}
            </nav>
          </div>
          <main>
            {loading && <Skeleton label={`Generating ${LABELS[tab].toLowerCase()}…`} />}
            {errors[tab] && (
              <p className="error card">
                {errors[tab]} <button onClick={() => setErrors((x) => ({ ...x, [tab]: undefined }))}>Retry</button>
              </p>
            )}
            {tab === 'timeline' && cache.timeline && <TimelineView events={cache.timeline} />}
            {tab === 'topics' && cache.topics && <TopicsView subject={active.subject} level={active.level} topics={cache.topics} />}
            {tab === 'problems' && cache.problems && <ProblemsView problems={cache.problems} />}
          </main>
        </>
      )}

      {/* Mounted once and kept alive: tearing down a WebGL canvas root is slow and crashes on
          React 19 + R3F 9, so it is hidden and paused instead. */}
      {stageSpec && (
        <div hidden={!showStage}>
          <Suspense fallback={<Skeleton label="Loading 3D engine…" />}>
            <VisualStage spec={stageSpec} paused={!showStage} />
          </Suspense>
        </div>
      )}

      <InputControls />
    </div>
  );
}

function Skeleton({ label }: { label: string }) {
  return (
    <div className="skeleton" aria-busy>
      <p className="muted pulse">{label}</p>
      <div className="bar" />
      <div className="bar short" />
      <div className="bar" />
    </div>
  );
}
