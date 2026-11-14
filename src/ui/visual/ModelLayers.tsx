import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { VisualSpec } from '../../../shared/types';
import { Diagram } from './Diagram';
import { Molecule } from './Molecule';
import { Surface } from './Surface';

const FADE_S = 0.55;
const smooth = (t: number) => t * t * (3 - 2 * t);

interface Layer {
  id: number;
  spec: VisualSpec;
  leaving: boolean;
}

/** Crossfade between models: the old one fades and shrinks away while the new one blooms outward from the centre. */
export function ModelLayers({ spec }: { spec: VisualSpec }) {
  const [layers, setLayers] = useState<Layer[]>(() => [{ id: 0, spec, leaving: false }]);
  const current = layers[layers.length - 1];
  // Derived state: at most one outgoing and one incoming layer, even if models change while the stage is paused.
  if (current.spec !== spec) setLayers([{ ...current, leaving: true }, { id: current.id + 1, spec, leaving: false }]);

  return (
    <>
      {layers.map((l) => (
        <FadeLayer key={l.id} leaving={l.leaving} onGone={() => setLayers((ls) => ls.filter((x) => x.id !== l.id))}>
          {l.spec.kind === 'molecule' && <Molecule spec={l.spec} />}
          {l.spec.kind === 'surface' && <Surface spec={l.spec} />}
          {l.spec.kind === 'diagram' && <Diagram spec={l.spec} />}
        </FadeLayer>
      ))}
    </>
  );
}

type Fadeable = THREE.Material & { userData: { base?: { opacity: number; transparent: boolean; depthWrite: boolean } } };

function setOpacity(root: THREE.Object3D, alpha: number) {
  root.traverse((o) => {
    const mat = (o as THREE.Mesh).material as Fadeable | Fadeable[] | undefined;
    if (!mat) return;
    for (const m of Array.isArray(mat) ? mat : [mat]) {
      const base = (m.userData.base ??= { opacity: m.opacity, transparent: m.transparent, depthWrite: m.depthWrite });
      const transparent = alpha < 1 ? true : base.transparent;
      if (m.transparent !== transparent) {
        m.transparent = transparent;
        m.needsUpdate = true;
      }
      m.depthWrite = alpha < 0.5 ? false : base.depthWrite; // a ghost must not hide the model behind it
      m.opacity = base.opacity * alpha;
    }
  });
}

function FadeLayer({ leaving, onGone, children }: { leaving: boolean; onGone: () => void; children: React.ReactNode }) {
  const group = useRef<THREE.Group>(null);
  const t = useRef(0); // 0 = invisible, 1 = fully shown
  const settled = useRef(false);
  const wasLeaving = useRef(leaving);
  if (wasLeaving.current !== leaving) {
    wasLeaving.current = leaving;
    settled.current = false;
  }

  useFrame((_, delta) => {
    const g = group.current;
    if (!g || settled.current) return;
    const step = Math.min(delta, 0.05) / FADE_S;
    t.current = leaving ? Math.max(0, t.current - step) : Math.min(1, t.current + step);
    const e = smooth(t.current);
    g.scale.setScalar(leaving ? 0.9 + 0.1 * e : 0.82 + 0.18 * e);
    g.visible = e > 0.001;
    setOpacity(g, e);
    if (t.current === (leaving ? 0 : 1)) {
      settled.current = true;
      if (leaving) onGone();
    }
  });

  return (
    <group ref={group} visible={false}>
      {children}
    </group>
  );
}
