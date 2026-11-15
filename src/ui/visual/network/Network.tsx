import { useEffect, useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { Line, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import type { NetEdge, NetNode, NetworkSpec } from '../../../../shared/types';
import { Label } from '../Label';
import { plainMath } from '../../math/MathText';
import { parts as partStore, useParts } from '../anatomy/partStore';
import { hash01, NET_COLORS, partOf, resolveNetwork } from './builtins';
import { layoutNetwork, type V3 } from './layout';

const POSITIVE = '#8b6bd6';
const NEGATIVE = '#e2783c';
const SEGMENTS = 24;

interface Wire {
  edge: NetEdge;
  a: THREE.Vector3;
  b: THREE.Vector3;
  c: THREE.Vector3 | null; // control point of a curved wire
  color: string;
  weight: number; // 0..1
  points: V3[];
}
const along = (w: Wire, t: number, out: THREE.Vector3) => {
  if (!w.c) return out.lerpVectors(w.a, w.b, t);
  const u = 1 - t;
  return out.set(u * u * w.a.x + 2 * u * t * w.c.x + t * t * w.b.x, u * u * w.a.y + 2 * u * t * w.c.y + t * t * w.b.y, u * u * w.a.z + 2 * u * t * w.c.z + t * t * w.b.z);
};

/**
 * A network of nodes: neural networks, language models, any machine-learning pipeline, graphs and trees.
 * Neurons glow with their activation, connections are as thick as their weight, and signals travel along
 * them. Pointing at a node highlights its whole layer (or block) and the panel explains it.
 */
export function Network({ spec }: { spec: NetworkSpec }) {
  const net = useMemo(() => resolveNetwork(spec), [spec]);
  const pos = useMemo(() => layoutNetwork(net), [net]);
  const { hover, picked } = useParts();
  useEffect(() => {
    partStore.reset();
    if (spec.focus?.[0]) partStore.pick(spec.focus[0]);
  }, [spec]);
  const active = hover ?? picked;
  const byId = useMemo(() => new Map(net.nodes.map((n) => [n.id, n])), [net]);
  const groupColor = useMemo(() => new Map(net.groups.map((g) => [g.name, g.color])), [net]);
  const colorOf = (n: NetNode) => n.color ?? (n.group ? groupColor.get(n.group) : undefined) ?? NET_COLORS.hidden;

  // neurons shrink when a layer is crowded, so they never overlap
  const radius = useMemo(() => {
    const balls = net.nodes.filter((n) => (n.shape ?? 'neuron') === 'neuron' || n.shape === 'data').map((n) => pos.get(n.id)!).filter(Boolean);
    let near = Infinity;
    for (let i = 0; i < balls.length; i++) for (let j = i + 1; j < balls.length; j++) near = Math.min(near, Math.hypot(balls[i][0] - balls[j][0], balls[i][1] - balls[j][1], balls[i][2] - balls[j][2]));
    return Math.max(0.12, Math.min(0.3, near * 0.36));
  }, [net, pos]);

  const wires = useMemo<Wire[]>(() => {
    const tmp = new THREE.Vector3();
    return net.edges.flatMap((edge): Wire[] => {
      const pa = pos.get(edge.a);
      const pb = pos.get(edge.b);
      if (!pa || !pb || !byId.has(edge.a) || !byId.has(edge.b)) return [];
      const a = new THREE.Vector3(...pa);
      const b = new THREE.Vector3(...pb);
      const kind = edge.kind ?? 'plain';
      const span = a.distanceTo(b);
      // attention arcs bow toward the viewer, residual (skip) connections pass behind
      const c = kind === 'attention' ? a.clone().add(b).multiplyScalar(0.5).add(new THREE.Vector3(0, 0.25, 0.7 + span * 0.28)) : kind === 'skip' ? a.clone().add(b).multiplyScalar(0.5).add(new THREE.Vector3(0, 0, -1.25)) : null;
      const w: Wire = {
        edge, a, b, c,
        color: kind === 'attention' ? NET_COLORS.attention : kind === 'skip' ? NET_COLORS.neutral : (edge.weight ?? 1) < 0 ? NEGATIVE : POSITIVE,
        weight: Math.min(1, Math.abs(edge.weight ?? 0.6)),
        points: [],
      };
      w.points = c ? Array.from({ length: SEGMENTS + 1 }, (_, i) => along(w, i / SEGMENTS, tmp).toArray() as V3) : [pa, pb];
      return [w];
    });
  }, [net, pos, byId]);

  const isLit = (n: NetNode) => !!active && (partOf(n) === active || n.label === active);
  const touches = (w: Wire) => isLit(byId.get(w.edge.a)!) || isLit(byId.get(w.edge.b)!);

  // labels above each auto-placed layer
  const layerLabels = useMemo(() => {
    if (net.layout !== 'layers') return [];
    return net.groups.flatMap((g) => {
      const members = net.nodes.filter((n) => n.group === g.name);
      if (!members.length || members.some((n) => n.pos)) return [];
      const ps = members.map((n) => pos.get(n.id)!);
      return [{ name: g.name, at: [ps[0][0], Math.max(...ps.map((p) => p[1])) + 0.85, 0] as V3 }];
    });
  }, [net, pos]);

  return (
    <group>
      {wires.map((w, i) => {
        const kind = w.edge.kind ?? 'plain';
        const base = kind === 'plain' ? 0.5 : kind === 'skip' ? 0.45 : 0.16 + 0.6 * w.weight;
        const opacity = active ? (touches(w) ? 0.95 : base * 0.3) : base;
        return (
          <group key={i}>
            <Line points={w.points} color={w.color} lineWidth={kind === 'attention' ? 1.2 + 5 * w.weight : kind === 'skip' ? 1.4 : 0.8 + 2.6 * w.weight} transparent opacity={opacity} dashed={kind === 'skip'} dashSize={0.16} gapSize={0.1} />
            {w.edge.label && <Label text={plainMath(w.edge.label)} position={along(w, 0.5, new THREE.Vector3()).toArray() as V3} height={0.22} />}
          </group>
        );
      })}
      <Pulses wires={wires} />
      {net.nodes.map((n) => {
        const p = pos.get(n.id);
        return p ? <NodeMesh key={n.id} node={n} position={p} color={colorOf(n)} radius={radius} lit={isLit(n)} dim={!!active && !isLit(n)} /> : null;
      })}
      {layerLabels.map((l) => (
        <Label key={l.name} text={l.name} position={l.at} height={0.3} />
      ))}
    </group>
  );
}

/** Small bright beads running along every "flow" and "attention" connection: the signal moving through. */
function Pulses({ wires }: { wires: Wire[] }) {
  const live = useMemo(() => wires.filter((w) => w.edge.kind === 'flow' || w.edge.kind === 'attention').slice(0, 260), [wires]);
  const mesh = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const clock = useRef(0);
  useEffect(() => {
    const m = mesh.current;
    if (!m) return;
    const c = new THREE.Color();
    live.forEach((w, i) => m.setColorAt(i, c.set(w.color).lerp(new THREE.Color('#ffffff'), 0.25)));
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [live]);
  useFrame((_, dt) => {
    const m = mesh.current;
    if (!m) return;
    clock.current += Math.min(dt, 0.05);
    live.forEach((w, i) => {
      const t = (clock.current * 0.45 + hash01(`${w.edge.a}|${w.edge.b}`)) % 1;
      along(w, t, dummy.position);
      // fade in and out at the ends so beads do not pop
      dummy.scale.setScalar((0.045 + 0.05 * w.weight) * Math.min(1, t * 6, (1 - t) * 6));
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });
  if (!live.length) return null;
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, live.length]} key={live.length} frustumCulled={false}>
      <sphereGeometry args={[1, 12, 10]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  );
}

/** Pixel / feature-map / vector texture: a grid of cells in shades of one color. */
function gridTexture(id: string, color: string, cols: number, rows: number) {
  const cell = 24;
  const c = document.createElement('canvas');
  c.width = cols * cell;
  c.height = rows * cell;
  const ctx = c.getContext('2d')!;
  const base = new THREE.Color(color);
  const white = new THREE.Color('#ffffff');
  const dark = base.clone().multiplyScalar(0.45);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const t = hash01(`${id}:${x}:${y}`);
      ctx.fillStyle = `#${(t < 0.5 ? dark.clone().lerp(base, t * 2) : base.clone().lerp(white, (t - 0.5) * 1.5)).getHexString()}`;
      ctx.fillRect(x * cell, y * cell, cell, cell);
    }
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1.5;
  for (let x = 0; x <= cols; x++) ctx.strokeRect(x * cell, 0, 0.01, c.height);
  for (let y = 0; y <= rows; y++) ctx.strokeRect(0, y * cell, c.width, 0.01);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  return tex;
}

function NodeMesh({ node, position, color, radius, lit, dim }: { node: NetNode; position: V3; color: string; radius: number; lit: boolean; dim: boolean }) {
  const shape = node.shape ?? 'neuron';
  const part = partOf(node);
  const value = Math.max(0, Math.min(1, node.value ?? 0.5));
  const label = node.label ? plainMath(node.label) : '';
  const group = useRef<THREE.Group>(null);
  const size = node.size ?? (shape === 'block' ? [3, 1, 1] : [1.2, 1.2, 0.08]);
  const cols = size[0] / size[1] > 2 ? 8 : size[0] > 2 ? 8 : size[0] < 1.2 ? 3 : 6;
  const texture = useMemo(() => (shape === 'grid' ? gridTexture(node.id, color, cols, size[0] / size[1] > 2 ? 1 : cols) : null), [shape, node.id, color, cols, size[0], size[1]]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => texture?.dispose(), [texture]);

  useFrame((_, dt) => {
    const g = group.current;
    if (g && shape !== 'block') g.scale.setScalar(THREE.MathUtils.lerp(g.scale.x, lit ? 1.14 : 1, 1 - Math.exp(-12 * dt)));
  });

  const handlers = {
    onPointerOver: (e: ThreeEvent<PointerEvent>) => (e.stopPropagation(), partStore.hover(part)),
    onPointerOut: () => partStore.get().hover === part && partStore.hover(null),
    onClick: (e: ThreeEvent<MouseEvent>) => (e.stopPropagation(), partStore.pick(part)),
  };
  const glow = (lit ? 0.55 : 0) + (dim ? 0.03 : 0.12);

  if (shape === 'block') {
    // a big translucent stage (an attention block, a pooling stage); the units inside stay visible and clickable
    return (
      <group position={position}>
        <RoundedBox args={size} radius={Math.min(0.18, size[1] * 0.3)} smoothness={4} {...handlers} renderOrder={2}>
          <meshPhysicalMaterial color={color} emissive={color} emissiveIntensity={lit ? 0.3 : 0.05} transparent opacity={lit ? 0.3 : 0.16} roughness={0.2} depthWrite={false} side={THREE.DoubleSide} />
        </RoundedBox>
        {label && <Label text={label} position={[-size[0] / 2 + 0.2 + label.length * 0.085, size[1] / 2 + 0.24, size[2] / 2]} height={0.3} />}
      </group>
    );
  }
  if (shape === 'token') {
    const w = Math.max(0.8, label.length * 0.16 + 0.45);
    return (
      <group ref={group} position={position}>
        <RoundedBox args={[w, 0.52, 0.24]} radius={0.1} smoothness={4} {...handlers}>
          <meshPhysicalMaterial color={color} emissive={color} emissiveIntensity={glow} roughness={0.35} clearcoat={0.5} />
        </RoundedBox>
        {label && <Label text={label} position={[0, 0, 0]} height={0.36} />}
      </group>
    );
  }
  if (shape === 'grid') {
    return (
      <group ref={group} position={position}>
        <mesh {...handlers}>
          <boxGeometry args={[size[0], size[1], size[2]]} />
          <meshStandardMaterial map={texture} emissive={color} emissiveIntensity={lit ? 0.35 : 0.04} roughness={0.6} />
        </mesh>
        {label && <Label text={label} position={[0, size[1] / 2 + 0.32, 0]} height={0.28} />}
      </group>
    );
  }
  if (shape === 'bar') {
    const h = 0.15 + 1.7 * value;
    return (
      <group ref={group} position={position}>
        <mesh position={[0, h / 2, 0]} {...handlers}>
          <boxGeometry args={[0.6, h, 0.6]} />
          <meshPhysicalMaterial color={color} emissive={color} emissiveIntensity={glow + 0.25 * value} roughness={0.3} clearcoat={0.5} />
        </mesh>
        {label && <Label text={label} position={[0, h + 0.3, 0]} height={0.27} />}
      </group>
    );
  }
  if (shape === 'data') {
    return (
      <group ref={group} position={position}>
        <mesh {...handlers}>
          <boxGeometry args={[radius * 1.5, radius * 1.5, radius * 1.5]} />
          <meshPhysicalMaterial color={color} emissive={color} emissiveIntensity={glow} roughness={0.35} clearcoat={0.4} />
        </mesh>
        {label && <Label text={label} position={[0, radius + 0.3, 0]} height={0.26} />}
      </group>
    );
  }
  // neuron: a glossy unit that glows with its activation, inside a soft halo
  return (
    <group ref={group} position={position}>
      <mesh {...handlers}>
        <sphereGeometry args={[radius, 36, 24]} />
        <meshPhysicalMaterial color={color} emissive={color} emissiveIntensity={(dim ? 0.05 : 0.1 + 0.75 * value) + (lit ? 0.4 : 0)} roughness={0.25} clearcoat={0.7} clearcoatRoughness={0.3} />
      </mesh>
      <mesh scale={1.5} raycast={() => null}>
        <sphereGeometry args={[radius, 24, 16]} />
        <meshBasicMaterial color={color} transparent opacity={dim ? 0.04 : 0.07 + 0.2 * value} depthWrite={false} />
      </mesh>
      {label && <Label text={label} position={[0, radius + 0.3, 0]} height={0.26} />}
    </group>
  );
}
