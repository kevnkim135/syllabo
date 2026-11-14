import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import * as THREE from 'three';
import type { BodyElement, DiagramElement, DiagramSpec } from '../../../shared/types';
import { Label } from './Label';
import { BodyShapeMesh } from './shapes';

const isBody = (e: DiagramElement): e is BodyElement => e.type === 'body';
const PAUSE_S = 0.7; // rest at the end of each loop before replaying

/** Position of a moving body t seconds into its loop (constant acceleration). */
function at(b: BodyElement, t: number): [number, number] {
  const m = b.motion!;
  return [b.x + m.vx * t + 0.5 * (m.ax ?? 0) * t * t, b.y + m.vy * t + 0.5 * (m.ay ?? 0) * t * t];
}

/**
 * A labeled diagram drawn like a textbook figure: bodies are recognisable objects, moving bodies replay
 * their motion in a loop with a fading trail, and force or velocity vectors ride along with their body.
 */
export function Diagram({ spec }: { spec: DiagramSpec }) {
  const bodies = useMemo(() => new Map(spec.elements.filter(isBody).map((b) => [b.id, b])), [spec]);
  const groups = useRef(new Map<string, THREE.Group>());
  const clock = useRef(0);

  useFrame((_, delta) => {
    clock.current += Math.min(delta, 0.05);
    for (const b of bodies.values()) {
      if (!b.motion) continue;
      const loop = (b.motion.duration ?? 3) + PAUSE_S;
      const t = Math.min(clock.current % loop, b.motion.duration ?? 3);
      const [x, y] = at(b, t);
      let gy = y;
      if (spec.ground !== undefined) gy = Math.max(y, spec.ground + (b.radius ?? 0.4) * 0.9); // never sink into the ground
      groups.current.get(b.id)?.position.set(x, gy, 0);
      // face the direction of travel (cars, planes, rockets)
      const vx = b.motion.vx + (b.motion.ax ?? 0) * t;
      const vy = b.motion.vy + (b.motion.ay ?? 0) * t;
      const g = groups.current.get(`${b.id}:shape`);
      if (g && b.shape && ['plane', 'rocket'].includes(b.shape)) g.rotation.z = Math.atan2(vy, vx);
      else if (g && vx < 0) g.rotation.y = Math.PI;
    }
  });

  const register = (id: string) => (g: THREE.Group | null) => {
    if (g) groups.current.set(id, g);
    else groups.current.delete(id);
  };

  return (
    <group>
      {spec.elements.map((el, i) => {
        if (el.type === 'body') {
          const r = el.radius ?? 0.4;
          return (
            <group key={i} ref={register(el.id)} position={[el.x, el.y, 0]}>
              <group ref={register(`${el.id}:shape`)}>
                <BodyShapeMesh shape={el.shape} r={r} color={el.color} />
              </group>
              <Label text={el.label} position={[0, r + 0.42, 0]} />
              {/* vectors drawn from this body move with it */}
              {spec.elements.map((v, k) =>
                v.type === 'vector' && v.from === el.id ? <Vector key={k} dx={v.dx} dy={v.dy} label={v.label} /> : null,
              )}
            </group>
          );
        }
        if (el.type === 'path') {
          return (
            <group key={i}>
              <Line points={el.points.map(([x, y]) => [x, y, 0] as [number, number, number])} color="#8b6bd6" lineWidth={2} dashed dashSize={0.18} gapSize={0.12} />
              {el.label && <Label text={el.label} position={[el.points[Math.floor(el.points.length / 2)][0], el.points[Math.floor(el.points.length / 2)][1] + 0.4, 0]} height={0.26} />}
            </group>
          );
        }
        if (el.type === 'link') {
          const a = bodies.get(el.a);
          const b = bodies.get(el.b);
          if (!a || !b) return null;
          return <Line key={i} points={[[a.x, a.y, 0], [b.x, b.y, 0]]} color="#8a8fa3" lineWidth={2} />;
        }
        return null; // vectors are drawn with their body
      })}
      {[...bodies.values()].filter((b) => b.motion).map((b) => (
        <Trail key={b.id} body={b} ground={spec.ground} />
      ))}
    </group>
  );
}

function Vector({ dx, dy, label }: { dx: number; dy: number; label: string }) {
  const dir = new THREE.Vector3(dx, dy, 0);
  const len = dir.length();
  if (!len) return null;
  return (
    <>
      <arrowHelper args={[dir.normalize(), new THREE.Vector3(0, 0, 0), len, 0xff9f1c, Math.min(0.35, len * 0.35), 0.2]} />
      <Label text={label} position={[dx * 1.12, dy * 1.12 + (dy >= 0 ? 0.2 : -0.2), 0]} height={0.28} />
    </>
  );
}

/** The path a moving body traces over one loop, drawn faintly so the motion's shape is visible. */
function Trail({ body, ground }: { body: BodyElement; ground?: number }) {
  const points = useMemo(() => {
    const d = body.motion!.duration ?? 3;
    return Array.from({ length: 40 }, (_, k) => {
      const [x, y] = at(body, (k / 39) * d);
      return [x, ground !== undefined ? Math.max(y, ground + (body.radius ?? 0.4) * 0.9) : y, 0] as [number, number, number];
    });
  }, [body, ground]);
  return <Line points={points} color="#b9a0f0" lineWidth={1.5} transparent opacity={0.6} />;
}
