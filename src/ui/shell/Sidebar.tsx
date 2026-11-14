import type { ReactNode } from 'react';
import { lesson, SECTIONS, useLesson, type Section } from '../../core/lesson';

export const SECTION_LABELS: Record<Section, string> = {
  visual: 'Interactive model',
  timeline: 'History',
  topics: 'Topic map',
  problems: 'Problems',
};

const icon = (children: ReactNode) => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {children}
  </svg>
);
const ICONS: Record<Section, ReactNode> = {
  visual: icon(<path d="M10 2.5 16.5 6v8L10 17.5 3.5 14V6L10 2.5Zm0 7.5 6.5-4M10 10 3.5 6M10 10v7.5" />),
  timeline: icon(<path d="M10 2.5v15M10 5.5h5M10 10H4.5M10 14.5h5" />),
  topics: icon(
    <>
      <rect x="6.5" y="7.5" width="7" height="5" rx="1.5" />
      <path d="M10 7.5V4M10 12.5V16M6.5 10H3M13.5 10H17" />
    </>,
  ),
  problems: icon(<path d="M4 16.5 5 13l8.5-8.5 2.5 2.5L7.5 15.5 4 16.5ZM12 6l2.5 2.5" />),
};

export function Sidebar() {
  const { section, loading } = useLesson();
  return (
    <nav className="sidebar" aria-label="Lesson sections">
      <button className="brand" onClick={lesson.home} title="Home (0)">
        {icon(<path d="M10 3 17.5 16.5h-15L10 3Z" fill="currentColor" />)}
        <span className="label">LessonLab</span>
      </button>
      {SECTIONS.map((k, i) => (
        <button key={k} className={`nav ${k === section ? 'on' : ''}`} aria-current={k === section ? 'page' : undefined} onClick={() => lesson.goto(k)}>
          {ICONS[k]}
          <span className="label">{SECTION_LABELS[k]}</span>
          {loading[k] ? <span className="spinner" aria-label="loading" /> : <span className="key">{i + 1}</span>}
        </button>
      ))}
      <span className="spacer" />
      <p className="hint">Say "go to history" or "show me benzene". Press 0 for home.</p>
    </nav>
  );
}
