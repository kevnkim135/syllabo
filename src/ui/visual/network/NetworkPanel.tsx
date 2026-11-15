import { useMemo } from 'react';
import type { NetworkSpec } from '../../../../shared/types';
import { MathText, plainMath } from '../../math/MathText';
import { parts as partStore, useParts } from '../anatomy/partStore';
import { NET_COLORS, partOf, resolveNetwork } from './builtins';

/** Side card for networks: every layer, block or cluster as a chip, and what the pointed-at or picked one does. */
export function NetworkPanel({ spec }: { spec: NetworkSpec }) {
  const { hover, picked } = useParts();
  const net = useMemo(() => resolveNetwork(spec), [spec]);
  const chips = useMemo(() => {
    const seen = new Map<string, { color?: string; info?: string }>();
    for (const g of net.groups) seen.set(g.name, { color: g.color, info: g.info });
    // nodes outside any group are their own part
    for (const n of net.nodes) {
      const name = partOf(n);
      const had = seen.get(name);
      if (!had) seen.set(name, { color: n.color, info: n.info });
      else if (!had.color && n.color) had.color = n.color;
    }
    return [...seen].filter(([name]) => net.nodes.some((n) => partOf(n) === name));
  }, [net]);
  const active = hover ?? picked;
  const info = active ? (spec.notes?.[active] ?? chips.find(([n]) => n === active)?.[1].info ?? net.nodes.find((n) => n.label === active)?.info) : null;
  const count = active ? net.nodes.filter((n) => partOf(n) === active && n.shape !== 'block').length : 0;

  return (
    <aside className="card guide anatomy-panel">
      <h3>Layers and parts</h3>
      <div className="chips">
        {chips.map(([n, c]) => (
          <button key={n} className={`chip part-chip ${n === picked ? 'on' : ''}`} onClick={() => partStore.pick(n)} onMouseEnter={() => partStore.hover(n)} onMouseLeave={() => partStore.hover(null)}>
            <span className="part-dot" style={{ background: c.color ?? NET_COLORS.hidden }} /> {plainMath(n)}
          </button>
        ))}
      </div>
      <div className="part-info">
        {active ? (
          <>
            <strong>
              {plainMath(active)}
              {count > 1 && <span className="muted"> · {count} units</span>}
            </strong>
            {info && <MathText as="p" text={info} />}
          </>
        ) : (
          <p className="muted">Point at a node, or click a layer, to see what it does. Thicker lines are stronger connections; the moving beads are signals.</p>
        )}
      </div>
    </aside>
  );
}
