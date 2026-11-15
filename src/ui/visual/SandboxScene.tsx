import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { commands, type Hand } from '../../core/commands';
import { isCelestial, labFor, lesson, useLesson } from '../../core/lesson';
import type { SandboxItem } from '../../core/library';
import { Label } from './Label';
import { Molecule } from './Molecule';
import { BodyShapeMesh } from './shapes';

const ANGSTROM = 1.6; // Molecule.tsx scale
const EASE = 9; // 1/s, how fast molecules glide to where the store says they are
const FLOOR = -2.6; // the lab bench (Environment.tsx)
const WALL = 11; // bodies bounce off invisible walls this far from the centre
const MAGNET = 0.16; // pointer snaps to the nearest object within this much of the screen (in NDC units) beyond its edge
const G_DOWN = 6; // gravity, scene units / s^2
const G_ORBIT = 0.05; // between celestial bodies: a = G m / r^2
const K_CHARGE = 6; // between charges: a = K q1 q2 / (m r^2)
const BOUNCE = 0.45; // floor and walls (0.95 with elastic collisions on)
const RESTITUTION = 0.8; // body-body collisions (1 with elastic collisions on)
type Pointer = 'left' | 'right' | 'mouse';
type V3 = [number, number, number];

interface Sim {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  synced: V3; // the store position this sim was last aligned with
}
interface Drag {
  ids: string[];
  offset: THREE.Vector3;
  history: { t: number; offset: THREE.Vector3 }[]; // for the throw velocity on release
}

/** Bounding radius of an item in scene units. */
export function radiusOf(item: SandboxItem) {
  if (item.kind === 'body' && item.body) return item.body.radius * item.scale;
  const a = item.molecule?.atoms ?? [];
  if (!a.length) return 0.6;
  const c = a.reduce((s, p) => [s[0] + p.x / a.length, s[1] + p.y / a.length, s[2] + p.z / a.length], [0, 0, 0]);
  return Math.max(0.5, ...a.map((p) => Math.hypot(p.x - c[0], p.y - c[1], p.z - c[2]) * ANGSTROM + 0.42)) * item.scale; // farthest atom plus about one atom radius
}
const isBody = (i: SandboxItem) => i.kind === 'body' && !!i.body;

/**
 * A crisp rim glow: bright where the surface turns away from the camera (the object's silhouette), clear in
 * the middle, so a selected object reads as outlined rather than wrapped in fog.
 */
function rimMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { color: { value: new THREE.Color('#8b6bd6') }, strength: { value: 1 }, power: { value: 2.6 } },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 color;
      uniform float strength;
      uniform float power;
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        float rim = pow(1.0 - abs(dot(normalize(vNormal), normalize(vView))), power);
        gl_FragColor = vec4(color, clamp(rim * strength, 0.0, 1.0));
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

/**
 * The sandbox: molecules and physical bodies in one shared space.
 * - Molecules float and glide to their stored positions; when two touch, the panel offers to react them.
 * - Bodies obey a small physics simulation: gravity to the bench (planets and stars pull on each other
 *   instead), charges attract or repel, and collisions conserve momentum, with the energy change explained.
 * - Each hand (and the mouse) has its own pointer and drag, so two objects can be carried at once and
 *   thrown: a body released while moving keeps that velocity.
 */
export function SandboxScene() {
  const state = useLesson();
  const { sandbox } = state;
  // Outside a physics or chemistry lab nothing simulates: objects stay where they are put (no gravity, no
  // throwing, no collisions, no velocity arrows, no reactions).
  const still = labFor(state) === 'none';
  const stillRef = useRef(still);
  stillRef.current = still;
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const controls = useThree((s) => s.controls) as unknown as { enabled: boolean } | null;
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const groups = useRef(new Map<string, THREE.Group>());
  const sims = useRef(new Map<string, Sim>());
  const drags = useRef(new Map<Pointer, Drag>());
  const pointers = useRef(new Map<Hand, THREE.Vector2>());
  const hover = useRef(new Map<Hand, string | null>());
  const hoverSince = useRef(new Map<string, number>()); // last time each object was under a pointer (for a calm halo)
  const cursors = { left: useRef<THREE.Mesh>(null), right: useRef<THREE.Mesh>(null) };
  const items = useRef(sandbox.items);
  items.current = sandbox.items;
  const selected = useRef(sandbox.selected);
  selected.current = sandbox.selected;
  const contactRef = useRef<string[] | null>(null);
  const lastEvent = useRef(0);
  const lastSync = useRef(0);
  const pressed = useRef(new Map<Hand, { id: string | null; wasSelected: boolean; t: number }>());
  const lastTap = useRef(new Map<Hand, number>());
  const owned = useRef(new Map<Hand, Set<string>>()); // what each hand picked or carried, so an open hand can let go of just its own
  const opened = useRef(new Map<Hand, number>()); // when each hand last opened
  const born = useRef(new Set<string>()); // objects that have already bloomed in
  const rims = useRef(new Map<string, THREE.ShaderMaterial>()); // one glow material per object (uniforms differ)
  if (import.meta.env.DEV) (window as unknown as { __sandboxGroups?: unknown }).__sandboxGroups = groups; // inspection in dev only
  const spin = useRef<{ ids: string[]; until: number } | null>(null);
  const liveRot = useRef(new Map<string, THREE.Quaternion>()); // orientations while a rotate gesture is running
  const spinCommit = useRef(0);
  const byId = (id: string) => items.current.find((i) => i.id === id);

  const draggedIds = () => new Set([...drags.current.values()].flatMap((d) => d.ids));

  const lastReported = useRef(new Map<string, V3>());
  /**
   * Keep one simulation entry per body, aligned with the store whenever something other than the
   * simulation moved it (voice, reopening a lesson). Runs every frame, so it never misses a change.
   */
  const syncSims = () => {
    const list = items.current;
    const ids = new Set(list.map((i) => i.id));
    for (const id of sims.current.keys()) if (!ids.has(id)) sims.current.delete(id); // removed or reacted away
    for (const id of groups.current.keys()) if (!ids.has(id)) groups.current.delete(id), born.current.delete(id), rims.current.get(id)?.dispose(), rims.current.delete(id);
    for (const it of list) {
      if (!isBody(it)) continue;
      const s = sims.current.get(it.id);
      if (!s) {
        sims.current.set(it.id, { pos: new THREE.Vector3(...it.pos), vel: new THREE.Vector3(...(it.vel ?? [0, 0, 0])), synced: it.pos });
      } else if (s.synced !== it.pos) {
        if (lastReported.current.get(it.id) !== it.pos) s.pos.set(...it.pos), s.vel.set(...(it.vel ?? [0, 0, 0]));
        s.synced = it.pos;
      }
    }
  };

  /** World size of the screen at a depth, for turning screen drags into scene units. */
  const screenToWorld = (at: THREE.Vector3) => {
    const cam = camera as THREE.PerspectiveCamera;
    const h = 2 * cam.position.distanceTo(at) * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    return { w: h * cam.aspect, h };
  };
  const centreOf = (ids: string[]) => {
    const c = new THREE.Vector3();
    let n = 0;
    for (const id of ids) {
      const g = groups.current.get(id);
      if (g) c.add(g.position), n++;
    }
    return n ? c.divideScalar(n) : c;
  };

  const startDrag = (who: Pointer, ids: string[]) => {
    if (!ids.length) return;
    for (const d of drags.current.values()) d.ids = d.ids.filter((i) => !ids.includes(i)); // an object is carried by one hand
    drags.current.set(who, { ids, offset: new THREE.Vector3(), history: [] });
  };
  const moveDrag = (who: Pointer, delta: THREE.Vector3) => {
    const d = drags.current.get(who);
    if (!d) return;
    d.offset.add(delta);
    d.history.push({ t: performance.now(), offset: d.offset.clone() });
    while (d.history.length > 8) d.history.shift();
  };
  const endDrag = (who: Pointer) => {
    const d = drags.current.get(who);
    drags.current.delete(who);
    if (!d || !d.ids.length) return;
    // throw velocity from the last ~120 ms of the drag
    const now = performance.now();
    const recent = d.history.filter((h) => now - h.t < 160);
    const v = recent.length >= 2 ? recent.at(-1)!.offset.clone().sub(recent[0].offset).divideScalar(Math.max(0.03, (recent.at(-1)!.t - recent[0].t) / 1000)) : new THREE.Vector3();
    if (v.length() > 14) v.setLength(14);
    const molecules: string[] = [];
    for (const id of d.ids) {
      const s = sims.current.get(id);
      if (s) {
        s.pos.add(d.offset);
        if (stillRef.current) s.vel.set(0, 0, 0); // put down, not thrown
        else s.vel.copy(v);
      } else molecules.push(id);
    }
    if (molecules.length && d.offset.lengthSq() > 1e-6) lesson.sandboxMove(molecules, [d.offset.x, d.offset.y, d.offset.z]);
  };

  // ---- hands: pointers, taps, grabs, scale; voice pushes arrive as impulses ----
  useEffect(
    () =>
      commands.on((cmd) => {
        if (cmd.type === 'pointer') {
          if (cmd.visible) pointers.current.set(cmd.hand, new THREE.Vector2(cmd.x * 2 - 1, -(cmd.y * 2 - 1)));
          else pointers.current.delete(cmd.hand), hover.current.delete(cmd.hand);
        } else if (cmd.type === 'press') {
          // the instant the fingers close: select what this hand points at (adds to the group)
          const id = hover.current.get(cmd.hand) ?? null;
          pressed.current.set(cmd.hand, { id, wasSelected: !!id && selected.current.includes(id), t: performance.now() });
          if (id && !selected.current.includes(id)) {
            selected.current = [...selected.current, id];
            lesson.sandboxSelect([id], 'add');
          }
          if (id) (owned.current.get(cmd.hand) ?? owned.current.set(cmd.hand, new Set()).get(cmd.hand)!).add(id);
        } else if (cmd.type === 'openBoth') {
          owned.current.clear();
          selected.current = [];
          lesson.sandboxSelect([], 'set');
        } else if (cmd.type === 'openHand') {
          // an open hand lets go of everything it picked; both hands open (within half a second) clears it all
          const now = performance.now();
          opened.current.set(cmd.hand, now);
          const other = opened.current.get(cmd.hand === 'left' ? 'right' : 'left') ?? -1e9;
          if (now - other < 500) {
            owned.current.clear();
            selected.current = [];
            lesson.sandboxSelect([], 'set');
            return;
          }
          // one open hand alone is for swiping between sandboxes: it does not deselect
        } else if (cmd.type === 'tap') {
          const p = pressed.current.get(cmd.hand);
          const id = p?.id ?? hover.current.get(cmd.hand) ?? null;
          const contact = contactRef.current;
          const now = performance.now();
          if (now - (lastTap.current.get(cmd.hand) ?? 0) < 350) return; // one click per pinch, even if it flickers
          lastTap.current.set(cmd.hand, now);
          if (id && contact?.includes(id) && !stillRef.current) lesson.sandboxReact(); // tapping touching molecules confirms the reaction
          else if (id && p?.wasSelected) lesson.sandboxSelect([id], 'toggle'); // click a selected object again to deselect
          else if (!id) lesson.sandboxSelect([], 'set'); // click empty space to clear
        } else if (cmd.type === 'grab') {
          if (cmd.phase === 'start') {
            const id = hover.current.get(cmd.hand) ?? null;
            const otherDragging = [...drags.current.keys()].some((k) => k !== cmd.hand);
            let ids: string[] = [];
            const twoHands = pointers.current.size > 1;
            if (id && selected.current.includes(id) && !otherDragging && !twoHands) ids = selected.current; // one hand: carry the whole group
            else if (id) ids = [id], lesson.sandboxSelect([id], 'add');
            else if (!otherDragging && !twoHands) ids = selected.current;
            startDrag(cmd.hand, ids);
            const mine = owned.current.get(cmd.hand) ?? owned.current.set(cmd.hand, new Set()).get(cmd.hand)!;
            ids.forEach((x) => mine.add(x));
          } else if (cmd.phase === 'move') {
            const d = drags.current.get(cmd.hand);
            if (!d) return;
            const { w, h } = screenToWorld(centreOf(d.ids));
            const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
            const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
            const back = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 2); // toward the viewer
            moveDrag(cmd.hand, right.multiplyScalar(cmd.dx * w).addScaledVector(up, -cmd.dy * h).addScaledVector(back, cmd.dz));
          } else endDrag(cmd.hand);
        } else if (cmd.type === 'rotateAxis') {
          // pinch an object with one hand and circle with the other: that object turns about the circle's axis
          const now = performance.now();
          if (!spin.current || now > spin.current.until) {
            const held = cmd.hand ? hover.current.get(cmd.hand) : null;
            const ids = held ? (selected.current.includes(held) ? selected.current : [held]) : selected.current;
            spin.current = { ids, until: 0 };
          }
          spin.current.until = now + 450;
          if (!spin.current.ids.length) return;
          const axis = new THREE.Vector3(...cmd.axis).applyQuaternion(camera.quaternion).normalize(); // view -> world
          const turn = new THREE.Quaternion().setFromAxisAngle(axis, cmd.angle);
          for (const id of spin.current.ids) {
            const it = byId(id);
            const q = liveRot.current.get(id) ?? new THREE.Quaternion(...(it?.rot ?? [0, 0, 0, 1]));
            liveRot.current.set(id, turn.clone().multiply(q));
          }
          clearTimeout(spinCommit.current);
          spinCommit.current = window.setTimeout(() => {
            const rots: Record<string, [number, number, number, number]> = {};
            for (const [id, q] of liveRot.current) rots[id] = [q.x, q.y, q.z, q.w];
            lesson.sandboxSetRot(rots);
            liveRot.current.clear();
            spin.current = null;
          }, 500);
        } else if (cmd.type === 'impulse') {
          if (!stillRef.current) for (const id of cmd.ids) sims.current.get(id)?.vel.add(new THREE.Vector3(...cmd.dv));
        }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [camera],
  );

  useFrame((_, rawDelta) => {
    syncSims();
    const frameDt = Math.min(rawDelta, 1 / 20);
    const k = 1 - Math.exp(-EASE * frameDt);
    const dragged = draggedIds();
    const offsetOf = (id: string) => {
      for (const d of drags.current.values()) if (d.ids.includes(id)) return d.offset;
      return null;
    };
    const list = items.current.filter((i) => !i.dying || groups.current.has(i.id));

    // ---- physics for bodies, in small substeps so orbits and fast collisions stay stable ----
    const bodies = still ? [] : list.filter((i) => isBody(i) && !i.dying && !dragged.has(i.id) && sims.current.has(i.id));
    if (still) for (const s of sims.current.values()) s.vel.set(0, 0, 0);
    const bounce = sandbox.elastic ? 0.95 : BOUNCE;
    const steps = Math.max(1, Math.ceil(frameDt / (1 / 240)));
    const dt = frameDt / steps;
    for (let step = 0; step < steps; step++) {
    for (const it of bodies) {
      const s = sims.current.get(it.id)!;
      const acc = new THREE.Vector3();
      const celestial = isCelestial(it.body!.shape);
      if (sandbox.gravity && !celestial) acc.y -= G_DOWN;
      for (const other of list) {
        if (other === it || !isBody(other)) continue;
        const o = sims.current.get(other.id);
        if (!o) continue;
        const d = o.pos.clone().sub(s.pos);
        const r2 = Math.max(d.lengthSq(), 0.36);
        if (celestial && isCelestial(other.body!.shape)) acc.addScaledVector(d.normalize(), (G_ORBIT * other.body!.mass) / r2);
        const q1 = it.body!.charge ?? 0;
        const q2 = other.body!.charge ?? 0;
        if (q1 && q2) acc.addScaledVector(d.clone().normalize(), (-K_CHARGE * q1 * q2) / (Math.max(it.body!.mass, 0.2) * r2));
      }
      s.vel.addScaledVector(acc, dt);
      if (!celestial && sandbox.air) s.vel.multiplyScalar(Math.exp(-0.05 * dt)); // light air drag on the bench; none in space, so orbits keep going
      s.pos.addScaledVector(s.vel, dt);
      const r = radiusOf(it);
      if (!celestial && s.pos.y - r < FLOOR) {
        s.pos.y = FLOOR + r;
        if (s.vel.y < 0) s.vel.y = Math.abs(s.vel.y) < 0.6 ? 0 : -s.vel.y * bounce;
        // rolling friction, frame-rate independent: about a quarter of the speed per second
        const roll = sandbox.friction ? Math.exp(-0.3 * dt) : 1;
        s.vel.x *= roll;
        s.vel.z *= roll;
      }
      for (const ax of ['x', 'z'] as const) {
        if (Math.abs(s.pos[ax]) + r > WALL) {
          s.pos[ax] = Math.sign(s.pos[ax]) * (WALL - r);
          s.vel[ax] *= -bounce;
        }
      }
      if (s.pos.y > 30) (s.pos.y = 30), (s.vel.y = -Math.abs(s.vel.y) * BOUNCE);
    }
    // collisions between bodies: momentum is conserved; some kinetic energy is lost
    for (let a = 0; a < bodies.length; a++) {
      for (let b = a + 1; b < bodies.length; b++) {
        const A = bodies[a];
        const B = bodies[b];
        const sa = sims.current.get(A.id)!;
        const sb = sims.current.get(B.id)!;
        const n = sb.pos.clone().sub(sa.pos);
        const dist = n.length();
        const min = radiusOf(A) + radiusOf(B);
        if (dist >= min || dist < 1e-6) continue;
        n.divideScalar(dist);
        const ma = A.body!.mass;
        const mb = B.body!.mass;
        const ia = 1 / ma;
        const ib = 1 / mb;
        const push = (min - dist) / (ia + ib);
        sa.pos.addScaledVector(n, -push * ia);
        sb.pos.addScaledVector(n, push * ib);
        const vn = sb.vel.clone().sub(sa.vel).dot(n);
        if (vn >= 0) continue; // already separating
        const before = { p: sa.vel.clone().multiplyScalar(ma).add(sb.vel.clone().multiplyScalar(mb)).length(), ke: 0.5 * ma * sa.vel.lengthSq() + 0.5 * mb * sb.vel.lengthSq() };
        const j = (-(1 + (sandbox.elastic ? 1 : RESTITUTION)) * vn) / (ia + ib);
        sa.vel.addScaledVector(n, -j * ia);
        sb.vel.addScaledVector(n, j * ib);
        const after = { p: sa.vel.clone().multiplyScalar(ma).add(sb.vel.clone().multiplyScalar(mb)).length(), ke: 0.5 * ma * sa.vel.lengthSq() + 0.5 * mb * sb.vel.lengthSq() };
        const now = performance.now();
        if (-vn > 0.4 && now - lastEvent.current > 600) {
          lastEvent.current = now;
          const f = (x: number) => (x >= 100 ? x.toFixed(0) : x >= 10 ? x.toFixed(1) : x.toFixed(2));
          lesson.sandboxEvent(
            `${A.name} hit ${B.name}. Momentum before $p = ${f(before.p)}$, after $p = ${f(after.p)}$ (conserved). ` +
              (() => {
                const lost = before.ke > 0 ? Math.max(0, (1 - after.ke / before.ke) * 100) : 0;
                return `Kinetic energy ${f(before.ke)} \u2192 ${f(after.ke)}: ${lost < 1 ? 'almost none was lost (a nearly elastic hit)' : `${Math.round(lost)}% became heat and sound`}.`;
              })(),
          );
        }
      }
    }
    }

    // ---- place everything ----
    for (const it of list) {
      const g = groups.current.get(it.id);
      if (!g) continue;
      const off = offsetOf(it.id);
      if (isBody(it) && !it.dying) {
        const s = sims.current.get(it.id)!;
        g.position.copy(s.pos);
        if (off) g.position.add(off);
      } else {
        const target = new THREE.Vector3(...(it.dying ?? it.pos));
        if (off) target.add(off);
        g.position.lerp(target, off ? 1 : it.dying ? k * 0.8 : k);
      }
      g.scale.setScalar(THREE.MathUtils.lerp(g.scale.x, it.dying ? 0 : it.scale, k));
      const q = liveRot.current.get(it.id) ?? (it.rot ? new THREE.Quaternion(...it.rot) : null);
      const body = g.getObjectByName('shape');
      if (body) q ? body.quaternion.slerp(q, 0.5) : body.quaternion.identity();
      // velocity arrow for moving bodies
      const arrow = g.getObjectByName('vel') as THREE.ArrowHelper | undefined;
      if (arrow) {
        const v = sims.current.get(it.id)?.vel;
        const speed = v ? v.length() : 0;
        arrow.visible = !still && speed > 0.3 && !off;
        if (v && arrow.visible) arrow.setDirection(v.clone().normalize()), arrow.setLength(Math.min(3, 0.4 + speed * 0.3), 0.25, 0.16);
      }
    }

    // ---- molecules touching: offer to react ----
    const mols = still ? [] : list.filter((i) => !isBody(i) && !i.dying);
    const touching = new Set<string>();
    for (let a = 0; a < mols.length; a++) {
      for (let b = a + 1; b < mols.length; b++) {
        const ga = groups.current.get(mols[a].id);
        const gb = groups.current.get(mols[b].id);
        if (ga && gb && ga.position.distanceTo(gb.position) < (radiusOf(mols[a]) + radiusOf(mols[b])) * 0.7) touching.add(mols[a].id), touching.add(mols[b].id);
      }
    }
    const contact = touching.size >= 2 ? [...touching].sort() : null;
    if ((contact ?? []).join() !== (contactRef.current ?? []).join()) {
      contactRef.current = contact;
      lesson.sandboxContact(contact);
    }

    // ---- hand pointers: what each one is over, and a cursor riding its ray ----
    const targets = [...groups.current.values()];
    const now = new Set<string>();
    for (const hand of ['left', 'right'] as Hand[]) {
      const ndc = pointers.current.get(hand);
      const cur = cursors[hand].current;
      if (!ndc) {
        if (cur) cur.visible = false;
        continue;
      }
      raycaster.setFromCamera(ndc, camera);
      const hit = raycaster.intersectObjects(targets, true)[0];
      let id: string | null = null;
      if (hit) for (let o: THREE.Object3D | null = hit.object; o && !id; o = o.parent) id = (o.userData.itemId as string) ?? null;
      // magnetic: not exactly on anything? take the nearest object whose on-screen outline is close to the pointer,
      // so small, far-away objects are as easy to pick as near ones
      if (!id) {
        let best = Infinity;
        const cam = camera as THREE.PerspectiveCamera;
        for (const it of list) {
          const g = groups.current.get(it.id);
          if (!g || it.dying) continue;
          const c = g.position.clone().project(camera);
          if (c.z > 1) continue; // behind the camera
          const dist = cam.position.distanceTo(g.position);
          const screenR = (radiusOf(it) / (dist * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)))) ; // radius in NDC
          const d = Math.hypot((c.x - ndc.x) * cam.aspect, c.y - ndc.y) - screenR;
          if (d < MAGNET && d < best) (best = d), (id = it.id);
        }
      }
      if (!drags.current.has(hand)) hover.current.set(hand, id);
      if (id) now.add(id);
      if (cur) {
        cur.visible = true;
        cur.position.copy(hit ? hit.point : raycaster.ray.at(10, new THREE.Vector3()));
        cur.quaternion.copy(camera.quaternion);
      }
    }
    // halos: selected, touching (orange) or pointed at; a short grace period stops them flickering at edges
    const tNow = performance.now();
    for (const id of now) hoverSince.current.set(id, tNow);
    for (const it of list) {
      const halo = groups.current.get(it.id)?.getObjectByName('halo') as THREE.Mesh | undefined;
      if (!halo) continue;
      const hot = tNow - (hoverSince.current.get(it.id) ?? -1e9) < 250;
      const on = selected.current.includes(it.id);
      const touch = !!contactRef.current?.includes(it.id);
      halo.visible = on || hot || touch;
      const m = halo.material as THREE.ShaderMaterial;
      m.uniforms.color.value.set(touch ? '#ff9f1c' : on ? '#9b7bff' : '#b9a0f0');
      // selected: a strong, sharp outline with a gentle breathing pulse; pointed at: a fainter, softer one
      m.uniforms.strength.value = touch ? 1.6 : on ? 1.35 + 0.25 * Math.sin(tNow / 260) : 0.7;
      m.uniforms.power.value = on || touch ? 3.2 : 2.2;
    }

    // ---- report moving bodies to the store now and then, so saves keep them where they are ----
    const t = performance.now();
    if (t - lastSync.current > 700) {
      lastSync.current = t;
      const states = bodies
        .map((it) => ({ it, s: sims.current.get(it.id)! }))
        .filter(({ it, s }) => s.pos.distanceTo(new THREE.Vector3(...it.pos)) > 0.05 || s.vel.length() > 0.05)
        .map(({ it, s }) => {
          const pos = s.pos.toArray() as V3;
          lastReported.current.set(it.id, pos);
          s.synced = pos;
          return { id: it.id, pos, vel: (s.vel.length() < 0.05 ? [0, 0, 0] : s.vel.toArray()) as V3 };
        });
      if (states.length) lesson.sandboxSync(states);
    }
  });

  // ---- mouse: click selects (shift adds), drag moves (and throws bodies) in the camera's plane ----
  const onDown = (item: SandboxItem) => (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (e.shiftKey) lesson.sandboxSelect([item.id], 'toggle');
    else if (!selected.current.includes(item.id)) lesson.sandboxSelect([item.id], 'set');
    const ids = e.shiftKey ? [item.id] : selected.current.includes(item.id) ? selected.current : [item.id];
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()).negate(), e.point.clone());
    const start = e.point.clone();
    const rect = gl.domElement.getBoundingClientRect();
    if (controls) controls.enabled = false;
    startDrag('mouse', ids);
    const move = (ev: PointerEvent) => {
      const ndc = new THREE.Vector2(((ev.clientX - rect.left) / rect.width) * 2 - 1, -((ev.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      const p = raycaster.ray.intersectPlane(plane, new THREE.Vector3());
      const d = drags.current.get('mouse');
      if (p && d) moveDrag('mouse', p.sub(start).sub(d.offset));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      if (controls) controls.enabled = true;
      endDrag('mouse');
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
            // React calls this again on every re-render (null, then the same group): only the very first time
            // is an object new, so only then does it start tiny and bloom in. Removed objects are dropped in syncSims.
            if (!g) return;
            if (!born.current.has(item.id)) {
              born.current.add(item.id);
              g.position.set(...item.pos);
              g.scale.setScalar(0.01);
            }
            groups.current.set(item.id, g);
          }}
          userData={{ itemId: item.id }}
          onPointerDown={onDown(item)}
          onPointerOver={(e) => (e.stopPropagation(), (gl.domElement.style.cursor = 'grab'))}
          onPointerOut={() => (gl.domElement.style.cursor = '')}
        >
          <group name="shape">
            {isBody(item) ? <BodyShapeMesh shape={item.body!.shape} r={item.body!.radius} color={item.body!.color ?? (item.body!.charge ? (item.body!.charge > 0 ? '#e0473c' : '#3f7fd9') : undefined)} /> : item.molecule && <Molecule spec={item.molecule} fit={false} />}
          </group>
          {isBody(item) && <arrowHelper name="vel" args={[new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 0), 1, 0xff9f1c, 0.25, 0.16]} />}
          <mesh name="halo" visible={false} renderOrder={5}>
            <sphereGeometry args={[radiusOf({ ...item, scale: 1 }) + 0.06, 48, 32]} />
            <primitive object={rims.current.get(item.id) ?? rims.current.set(item.id, rimMaterial()).get(item.id)!} attach="material" />
          </mesh>
          <Label
            text={isBody(item) && item.body!.charge ? `${item.name} (${item.body!.charge > 0 ? '+' : '−'})` : item.name}
            position={[0, radiusOf({ ...item, scale: 1 }) + 0.35, 0]}
            height={0.3}
          />
        </group>
      ))}
      {(['left', 'right'] as Hand[]).map((h) => (
        <mesh key={h} ref={cursors[h]} visible={false} renderOrder={20}>
          <ringGeometry args={[0.12, 0.2, 32]} />
          <meshBasicMaterial color={h === 'left' ? '#8b6bd6' : '#b9a0f0'} transparent opacity={0.9} depthTest={false} />
        </mesh>
      ))}
    </group>
  );
}
