import { lazy, Suspense, useEffect, useState } from 'react';
import type { VisualSpec } from '../../shared/types';
import { isTyping } from '../core/input/keyboard';
import { lesson, SECTIONS, useLesson } from '../core/lesson';
import { Home } from './home/Home';
import { ProblemsView } from './panels/ProblemsView';
import { TimelineView } from './panels/TimelineView';
import { TopicsView } from './panels/TopicsView';
import { SECTION_LABELS, Sidebar } from './shell/Sidebar';
import { InputControls } from './visual/InputControls';

const VisualStage = lazy(() => import('./visual/VisualStage').then((m) => ({ default: m.VisualStage })));

export function App() {
  const s = useLesson();
  const { section, data } = s;
  const inLesson = !!s.subject;

  // Last model, kept so the 3D canvas never unmounts (tearing down a WebGL root crashes on React 19 + R3F 9).
  const [stageSpec, setStageSpec] = useState<VisualSpec | null>(null);
  useEffect(() => {
    if (data.visual) setStageSpec(data.visual);
  }, [data.visual]);

  // Keys: 1-4 jump to a section, 0 goes home (camera keys live in core/input/keyboard.ts).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!inLesson || isTyping(e) || e.metaKey || e.ctrlKey) return;
      if (e.key === '0') lesson.home();
      else if (SECTIONS[Number(e.key) - 1]) lesson.goto(SECTIONS[Number(e.key) - 1]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [inLesson]);

  const has = data[section] !== undefined;
  const showStage = inLesson && section === 'visual' && !!data.visual;

  return (
    <div className="app">
      {!inLesson && <Home />}

      <div className="shell" hidden={!inLesson}>
        <Sidebar />
        <main className="content">
          <header className="lesson-head">
            <h1>{s.subject}</h1>
            {s.focus && (
              <>
                <span className="sep">›</span>
                <span className="focus-chip">
                  {s.focus}
                  <button onClick={() => lesson.setFocus(null)} aria-label="Clear focus" title="Back to the whole subject">
                    ✕
                  </button>
                </span>
              </>
            )}
            {has && s.loading[section] && (
              <span className="updating">
                <span className="spinner" /> Updating {SECTION_LABELS[section].toLowerCase()}…
              </span>
            )}
          </header>

          {inLesson && (
            <div key={section} className="view">
              {!has && s.loading[section] && <Skeleton label={`Generating ${SECTION_LABELS[section].toLowerCase()}…`} />}
              {s.errors[section] && (
                <p className="error">
                  {s.errors[section]} <button onClick={() => lesson.retry(section)}>Retry</button>
                </p>
              )}
              {section === 'timeline' && data.timeline && <TimelineView events={data.timeline} />}
              {section === 'topics' && data.topics && <TopicsView key={`${s.subject}|${s.focus}`} topics={data.topics} />}
              {section === 'problems' && data.problems && <ProblemsView problems={data.problems} />}
            </div>
          )}

          {stageSpec && (
            <div hidden={!showStage} className="view">
              <Suspense fallback={<Skeleton label="Loading 3D engine…" />}>
                <VisualStage spec={stageSpec} paused={!showStage} />
              </Suspense>
            </div>
          )}
        </main>
      </div>

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
