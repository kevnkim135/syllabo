import { Html, Line } from '@react-three/drei';
import * as THREE from 'three';
import type { BodyElement, DiagramElement, DiagramSpec } from '../../../shared/types';

const isBody = (e: DiagramElement): e is BodyElement => e.type === 'body';

// TODO(visuals agent): make bodies draggable and animate forces (the "highly interactive" part).
export function Diagram({ spec }: { spec: DiagramSpec }) {
  const bodies = new Map(spec.elements.filter(isBody).map((b) => [b.id, b]));

  return (
    <group>
      {spec.elements.map((el, i) => {
        if (el.type === 'body') {
          return (
            <group key={i} position={[el.x, el.y, 0]}>
              <mesh>
                <sphereGeometry args={[el.radius ?? 0.4, 32, 16]} />
                <meshStandardMaterial color="#4f8cff" />
              </mesh>
              <Label text={el.label} />
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
              <arrowHelper args={[dir.normalize(), new THREE.Vector3(o.x, o.y, 0), len, 0xffb000, 0.3, 0.2]} />
              <group position={[o.x + el.dx, o.y + el.dy, 0]}>
                <Label text={el.label} />
              </group>
            </group>
          );
        }
        const a = bodies.get(el.a);
        const b = bodies.get(el.b);
        if (!a || !b) return null;
        return <Line key={i} points={[[a.x, a.y, 0], [b.x, b.y, 0]]} color="#9aa4c7" lineWidth={2} />;
      })}
    </group>
  );
}

function Label({ text }: { text: string }) {
  return (
    <Html center position={[0, 0.7, 0]}>
      <span className="label">{text}</span>
    </Html>
  );
}
