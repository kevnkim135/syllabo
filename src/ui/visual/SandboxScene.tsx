import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { commands } from '../../core/commands';
import { lesson, useLesson } from '../../core/lesson';
import type { SandboxItem } from '../../core/library';
import { Label } from './Label';
import { Molecule } from './Molecule';

const ANGSTROM = 1.6; // Molecule.tsx scale
const EASE = 9; // 1/s, how fast items glide to where the store says they are

/**
 * The chemistry sandbox: every molecule the student added, in one shared space. Items glide to their
 * stored positions (so voice moves are smooth), selected items wear a halo, and a drag (mouse or hand)
 * moves the whole selection live, committing to the store when it ends.
 */
export function SandboxScene() {
  const { sandbox } = useLesson();
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const controls = useThree((s) => s.controls) as unknown as { enabled: boolean } | null;
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const groups = useRef(new Map<string, THREE.Group>());
  const drag = useRef(new THREE.Vector3()); // live offset applied to the selection while dragging
  const dragging = useRef(false);
  const selected = useRef<string[]>(sandbox.selected);
  selected.current = sandbox.selected;
  const [hover, setHover] = useState<string | null>(null);
  const pointer = useRef<{ ndc: THREE.Vector2; visible: boolean }>({ ndc: new THREE.Vector2(), visible: false });
  const cursor = useRef<THREE.Mesh>(null);

  const commit = () => {
    if (drag.current.lengthSq() > 1e-6) lesson.sandboxMove(selected.current, [drag.current.x, drag.current.y, drag.current.z]);
    drag.current.set(0, 0, 0);
    dragging.current = false;
  };

  /** World size of one screen at the selection's depth, for converting screen drags into scene units. */
  const screenToWorld = () => {
    const ids = selected.current;
    const centre = new THREE.Vector3();
    let n = 0;
    for (const id of ids) {
      const g = groups.current.get(id);
      if (g) centre.add(g.position), n++;
    }
    if (n) centre.divideScalar(n);
    const cam = camera as THREE.PerspectiveCamera;
    const dist = cam.position.distanceTo(centre);
    const h = 2 * dist * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    return { w: h * cam.aspect, h };
  };

  // ---- hands: pointer, tap, grab, scale ----
  useEffect(
    () =>
      commands.on((cmd) => {
        if (cmd.type === 'pointer') {
          pointer.current.visible = cmd.visible;
          pointer.current.ndc.set(cmd.x * 2 - 1, -(cmd.y * 2 - 1));
        } else if (cmd.type === 'tap') {
          const id = hoverRef.current;
          if (id) lesson.sandboxSelect([id], 'toggle');
          else lesson.sandboxSelect([], 'set');
        } else if (cmd.type === 'grab') {
          if (cmd.phase === 'start') {
            const id = hoverRef.current;
            if (id && !selected.current.includes(id)) lesson.sandboxSelect([id], 'set'), (selected.current = [id]);
            dragging.current = selected.current.length > 0;
          } else if (cmd.phase === 'move' && dragging.current) {
            const { w, h } = screenToWorld();
            const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
            const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
            const back = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 2); // toward the viewer
            drag.current.addScaledVector(right, cmd.dx * w).addScaledVector(up, -cmd.dy * h).addScaledVector(back, cmd.dz);
          } else if (cmd.phase === 'end' && dragging.current) commit();
        } else if (cmd.type === 'scaleSel' && selected.current.length) {
          lesson.sandboxScale(selected.current, cmd.factor);
        }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [camera],
  );
  const hoverRef = useRef<string | null>(null);

  useFrame((_, delta) => {
    const k = 1 - Math.exp(-EASE * Math.min(delta, 0.05));
    for (const item of sandbox.items) {
      const g = groups.current.get(item.id);
      if (!g) continue;
      const target = new THREE.Vector3(...(item.dying ?? item.pos));
      if (dragging.current && selected.current.includes(item.id)) target.add(drag.current);
      g.position.lerp(target, item.dying ? k * 0.8 : k);
      const s = item.dying ? 0 : item.scale;
      g.scale.setScalar(THREE.MathUtils.lerp(g.scale.x, s, k));
    }
    // hand pointer: what is under it, and a small cursor riding the ray
    if (pointer.current.visible) {
      raycaster.setFromCamera(pointer.current.ndc, camera);
      const hit = raycaster.intersectObjects([...groups.current.values()], true)[0];
      let id: string | null = null;
      if (hit) for (let o: THREE.Object3D | null = hit.object; o && !id; o = o.parent) id = (o.userData.itemId as string) ?? null;
      if (id !== hoverRef.current) (hoverRef.current = id), setHover(id);
      const at = hit ? hit.point : raycaster.ray.at(10, new THREE.Vector3());
      cursor.current?.position.copy(at);
      cursor.current?.quaternion.copy(camera.quaternion);
    } else if (hoverRef.current) (hoverRef.current = null), setHover(null);
    if (cursor.current) cursor.current.visible = pointer.current.visible;
  });

  // ---- mouse: click selects (shift adds), drag moves the selection in the camera's plane ----
  const onDown = (item: SandboxItem) => (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const ids = e.shiftKey ? null : selected.current.includes(item.id) ? selected.current : [item.id];
    if (e.shiftKey) lesson.sandboxSelect([item.id], 'toggle');
    else if (!selected.current.includes(item.id)) lesson.sandboxSelect([item.id], 'set');
    if (ids) selected.current = ids;
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()).negate(), e.point.clone());
    const start = e.point.clone();
    const rect = gl.domElement.getBoundingClientRect();
    if (controls) controls.enabled = false;
    dragging.current = true;
    const move = (ev: PointerEvent) => {
      const ndc = new THREE.Vector2(((ev.clientX - rect.left) / rect.width) * 2 - 1, -((ev.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      const p = raycaster.ray.intersectPlane(plane, new THREE.Vector3());
      if (p) drag.current.copy(p.sub(start));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      if (controls) controls.enabled = true;
      commit();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  return (
    <group>
      {sandbox.items.map((item) => (
        <group
          key={item.id}
          ref={(g) => {
            if (g) {
              if (!groups.current.has(item.id)) g.position.set(...item.pos), g.scale.setScalar(0.01); // bloom in from nothing
              groups.current.set(item.id, g);
            } else groups.current.delete(item.id);
          }}
          userData={{ itemId: item.id }}
          onPointerDown={onDown(item)}
          onPointerOver={(e) => (e.stopPropagation(), (gl.domElement.style.cursor = 'grab'))}
          onPointerOut={() => (gl.domElement.style.cursor = '')}
        >
          <Molecule spec={item.molecule} />
          <Halo item={item} on={sandbox.selected.includes(item.id)} hot={hover === item.id} />
          <Label text={item.name} position={[0, radiusOf(item) + 0.35, 0]} height={0.3} />
        </group>
      ))}
      <mesh ref={cursor} visible={false} renderOrder={20}>
        <ringGeometry args={[0.12, 0.2, 32]} />
        <meshBasicMaterial color="#8b6bd6" transparent opacity={0.9} depthTest={false} />
      </mesh>
    </group>
  );
}

/** Bounding radius of a molecule in scene units (atoms are centred on their centroid by Molecule.tsx). */
function radiusOf(item: SandboxItem) {
  const a = item.molecule.atoms;
  const c = a.reduce((s, p) => [s[0] + p.x / a.length, s[1] + p.y / a.length, s[2] + p.z / a.length], [0, 0, 0]);
  return Math.max(0.6, ...a.map((p) => Math.hypot(p.x - c[0], p.y - c[1], p.z - c[2]) * ANGSTROM + 0.55));
}

function Halo({ item, on, hot }: { item: SandboxItem; on: boolean; hot: boolean }) {
  if (!on && !hot) return null;
  return (
    <mesh>
      <sphereGeometry args={[radiusOf(item) + 0.15, 32, 20]} />
      <meshBasicMaterial color="#8b6bd6" transparent opacity={on ? 0.16 : 0.08} depthWrite={false} />
    </mesh>
  );
}
