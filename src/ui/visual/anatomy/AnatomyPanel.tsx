import { useMemo } from 'react';
import type { AnatomySpec } from '../../../../shared/types';
import { MathText } from '../../math/MathText';
import { builtinParts, DEFAULT_INFO } from './builtins';
import { parts as partStore, useParts } from './partStore';

/** Side card for realistic models: every part as a chip, and what the pointed-at or picked part does. */
export function AnatomyPanel({ spec }: { spec: AnatomySpec }) {
  const { hover, picked } = useParts();
  const all = useMemo(() => [...(spec.model ? builtinParts(spec.model) : []), ...(spec.parts ?? [])], [spec]);
  const names = useMemo(() => [...new Set(all.map((p) => p.name))], [all]);
  const colors = useMemo(() => new Map(all.map((p) => [p.name, p.color])), [all]);
  const active = hover ?? picked;
  const info = active ? (spec.notes?.[active] ?? all.find((p) => p.name === active && p.info)?.info ?? DEFAULT_INFO[active]) : null;

  return (
    <aside className="card guide anatomy-panel">
      <h3>Parts</h3>
      <div className="chips">
        {names.map((n) => (
          <button
            key={n}
            className={`chip part-chip ${n === picked ? 'on' : ''}`}
            onClick={() => partStore.pick(n)}
            onMouseEnter={() => partStore.hover(n)}
            onMouseLeave={() => partStore.hover(null)}
          >
            <span className="part-dot" style={{ background: colors.get(n) }} /> {n}
          </button>
        ))}
      </div>
      <div className="part-info">
        {active ? (
          <>
            <strong>{active}</strong>
            {info && <MathText as="p" text={info} />}
          </>
        ) : (
          <p className="muted">Point at a part, or click one, to see what it does.</p>
        )}
      </div>
    </aside>
  );
}
