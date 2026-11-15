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
      groups.current.get(b.id)?.position.set(x, gy, b.z ?? 0);
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
            <group key={i} ref={register(el.id)} position={[el.x, el.y, el.z ?? 0]}>
              <group ref={register(`${el.id}:shape`)} rotation={[0, 0, el.angle ? (el.angle * Math.PI) / 180 - Math.PI / 2 * (el.shape === 'ladder' ? 1 : 0) : 0]}>
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
        if (el.type === 'wire') return <Wire key={i} points={el.points} current={!!el.current} label={el.label} />;
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

/** A solid copper wire through its corners; with current on, charges stream along it from first point to last. */
function Wire({ points, current, label }: { points: [number, number][]; current: boolean; label?: string }) {
  const { geo, path, length } = useMemo(() => {
    const v = points.map(([x, y]) => new THREE.Vector3(x, y, 0));
    const p = new THREE.CurvePath<THREE.Vector3>();
    for (let i = 1; i < v.length; i++) p.add(new THREE.LineCurve3(v[i - 1], v[i]));
    return { geo: new THREE.TubeGeometry(p, Math.max(8, v.length * 16), 0.055, 10, false), path: p, length: p.getLength() };
  }, [points]);
  const beads = useRef<THREE.InstancedMesh>(null);
  const n = current ? Math.max(3, Math.round(length / 0.7)) : 0;
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const clock = useRef(0);
  useFrame((_, dt) => {
    const m = beads.current;
    if (!m || !n) return;
    clock.current += Math.min(dt, 0.05);
    for (let k = 0; k < n; k++) {
      const t = ((k / n + (clock.current * 0.9) / length) % 1 + 1) % 1;
      dummy.position.copy(path.getPointAt(t));
      dummy.position.z += 0.06;
      dummy.updateMatrix();
      m.setMatrixAt(k, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  });
  const mid = points[Math.floor(points.length / 2)];
  return (
    <group>
      <mesh geometry={geo}>
        <meshStandardMaterial color="#c8743a" roughness={0.35} metalness={0.7} />
      </mesh>
      {/* rounded joints at the corners */}
      {points.map(([x, y], k) => (
        <mesh key={k} position={[x, y, 0]}>
          <sphereGeometry args={[0.07, 12, 8]} />
          <meshStandardMaterial color="#c8743a" roughness={0.35} metalness={0.7} />
        </mesh>
      ))}
      {n > 0 && (
        <instancedMesh ref={beads} args={[undefined, undefined, n]} key={n} frustumCulled={false}>
          <sphereGeometry args={[0.075, 12, 8]} />
          <meshBasicMaterial color="#ffd84a" toneMapped={false} />
        </instancedMesh>
      )}
      {label && mid && <Label text={label} position={[mid[0], mid[1] + 0.35, 0]} height={0.26} />}
    </group>
  );
}
