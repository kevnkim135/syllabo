import { lesson, useLesson } from '../../core/lesson';

/** Every model built in this lesson. Swipe left / right with an open hand, say "next model", or press [ and ]. */
export function ModelGallery() {
  const { models, modelIndex } = useLesson();
  if (models.length < 2) return null;
  return (
    <div className="gallery" role="group" aria-label="Models in this lesson">
      <button onClick={() => lesson.stepModel(-1)} aria-label="Previous model" title="Previous model ([ or swipe right)">
        ‹
      </button>
      <div className="gallery-dots">
        {models.map((m, i) => (
          <button key={i} className={i === modelIndex ? 'on' : ''} onClick={() => lesson.selectModel(i)} title={m.title} aria-label={`Model ${i + 1}: ${m.title}`} />
        ))}
      </div>
      <span className="gallery-count">
        {modelIndex + 1} / {models.length}
      </span>
      <button onClick={() => lesson.stepModel(1)} aria-label="Next model" title="Next model (] or swipe left)">
        ›
      </button>
      <button className="gallery-x" onClick={() => lesson.removeModel(modelIndex)} aria-label="Remove this model" title="Remove this model from the lesson">
        ×
      </button>
    </div>
  );
}
