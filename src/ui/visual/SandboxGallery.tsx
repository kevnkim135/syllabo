import { lesson, useLesson } from '../../core/lesson';

/** This lesson's sandboxes: flip with an open-hand swipe, the arrows, or "next sandbox"; + makes a new one. */
export function SandboxGallery() {
  const { sandboxes, sandboxIndex } = useLesson();
  return (
    <div className="gallery" role="group" aria-label="Sandboxes in this lesson">
      {sandboxes.length > 1 && (
        <button onClick={() => lesson.sandboxStep(-1)} aria-label="Previous sandbox" title="Previous sandbox (swipe right)">
          ‹
        </button>
      )}
      {sandboxes.length > 1 && (
        <div className="gallery-dots">
          {sandboxes.map((_, i) => (
            <button key={i} className={i === sandboxIndex ? 'on' : ''} onClick={() => lesson.sandboxGo(i)} aria-label={`Sandbox ${i + 1}`} />
          ))}
        </div>
      )}
      <span className="gallery-count">
        Sandbox {sandboxIndex + 1}
        {sandboxes.length > 1 ? ` / ${sandboxes.length}` : ''}
      </span>
      {sandboxes.length > 1 && (
        <button onClick={() => lesson.sandboxStep(1)} aria-label="Next sandbox" title="Next sandbox (swipe left)">
          ›
        </button>
      )}
      <button onClick={lesson.sandboxNew} aria-label="New sandbox" title="New sandbox">
        +
      </button>
      {sandboxes.length > 1 && (
        <button className="gallery-x" onClick={lesson.sandboxDelete} aria-label="Delete this sandbox" title="Delete this sandbox">
          ×
        </button>
      )}
    </div>
  );
}
