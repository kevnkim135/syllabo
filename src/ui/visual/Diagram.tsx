import { Line } from '@react-three/drei';
import * as THREE from 'three';
import { Label } from './Label';
import { palette } from './palette';
import type { BodyElement, DiagramElement, DiagramSpec } from '../../../shared/types';

const isBody = (e: DiagramElement): e is BodyElement => e.type === 'body';

// TODO(visuals agent): make bodies draggable and animate forces (the "highly interactive" part).
export function Diagram({ spec }: { spec: DiagramSpec }) {
  const p = palette();
  const bodies = new Map(spec.elements.filter(isBody).map((b) => [b.id, b]));

  return (
    <group>
      {spec.elements.map((el, i) => {
        if (el.type === 'body') {
          return (
            <group key={i} position={[el.x, el.y, 0]}>
              <mesh>
                <sphereGeometry args={[el.radius ?? 0.4, 32, 16]} />
                <meshStandardMaterial color={p.violet} roughness={0.4} />
              </mesh>
              <Label text={el.label} position={[0, (el.radius ?? 0.4) + 0.35, 0]} />
            </group>
          );
        }
        if (el.type === 'vector') {
          const o = bodies.get(el.from);
          const dir = new THREE.Vector3(el.dx, el.dy, 0);
          const len = dir.length();
          if (!o || !len) return null;
          return (
            <group key={i}>
              <arrowHelper args={[dir.normalize(), new THREE.Vector3(o.x, o.y, 0), len, p.forest, 0.3, 0.2]} />
              <Label text={el.label} position={[o.x + el.dx * 1.12, o.y + el.dy * 1.12 + (el.dy >= 0 ? 0.2 : -0.2), 0]} />
            </group>
          );
        }
        const a = bodies.get(el.a);
        const b = bodies.get(el.b);
        if (!a || !b) return null;
        return <Line key={i} points={[[a.x, a.y, 0], [b.x, b.y, 0]]} color={p.lilac200} lineWidth={2} />;
      })}
    </group>
  );
}
