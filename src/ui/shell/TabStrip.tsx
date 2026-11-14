import { lesson, useWorkspace } from '../../core/lesson';

/** Open lessons, like browser tabs. Switching keeps every lesson exactly as it was. */
export function TabStrip() {
  const { tabs, activeId, view } = useWorkspace();
  if (!tabs.length) return null;
  return (
    <nav className="tabstrip" aria-label="Open lessons">
      {tabs.map((t) => (
        <div key={t.id} className={`tab ${t.id === activeId && view === 'lesson' ? 'on' : ''}`}>
          <button className="tab-open" onClick={() => lesson.switchTo(t.id)} title={t.title}>
            {t.loading ? <span className="spinner" /> : t.saved ? <span className="tab-dot" aria-label="saved" /> : null}
            <span className="tab-title">{t.title}</span>
          </button>
          <button className="tab-close" onClick={() => lesson.close(t.id)} aria-label={`Close ${t.title}`} title="Close (saved lessons stay in your library)">
            ×
          </button>
        </div>
      ))}
      <button className="tab-new" onClick={lesson.home} title="New lesson">
        + New
      </button>
    </nav>
  );
}
