import { useEffect, useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { AnatomyPart, AnatomySpec } from '../../../../shared/types';
import { Label } from '../Label';
import { builtinParts } from './builtins';
import { parts as partStore, useParts } from './partStore';

const DEG = Math.PI / 180;

/** Organic ridges (like the folds of a brain) pushed out along the normals of a smooth shape. */
function displace(geo: THREE.BufferGeometry, kind: 'folded' | 'bumpy') {
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const n = new THREE.Vector3();
  const p = new THREE.Vector3();
  geo.computeVertexNormals();
  const nor = geo.attributes.normal as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    n.fromBufferAttribute(nor, i);
    const f =
      kind === 'folded'
        ? // rounded, meandering ridges (gyri) and grooves (sulci), like the surface of a brain
          Math.sin(p.x * 19 + Math.sin(p.z * 9) * 2.6) * Math.sin(p.y * 21 + Math.sin(p.x * 8) * 2.4) * Math.sin(p.z * 19 + Math.sin(p.y * 9) * 2.6) * 0.06
        : Math.sin(p.x * 13) * Math.sin(p.y * 11) * Math.sin(p.z * 12) * 0.03;
    pos.setXYZ(i, p.x + n.x * f, p.y + n.y * f, p.z + n.z * f);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

function geometryFor(part: AnatomyPart): THREE.BufferGeometry {
  const fine = part.surface === 'folded' || part.surface === 'bumpy';
  switch (part.shape) {
    case 'box':
      return new THREE.BoxGeometry(1, 1, 1, 4, 4, 4);
    case 'cylinder':
      return new THREE.CylinderGeometry(0.5, 0.5, 1, 32, 4);
    case 'cone':
      return new THREE.ConeGeometry(0.5, 1, 32, 4);
    case 'capsule':
      return new THREE.CapsuleGeometry(0.5, 1, 12, 24);
    case 'torus':
      return new THREE.TorusGeometry(0.5, 0.08, 16, 64);
    case 'tube': {
      const curve = new THREE.CatmullRomCurve3((part.path ?? []).map((q) => new THREE.Vector3(...q)));
      return new THREE.TubeGeometry(curve, 64, part.size[0], 12, false);
    }
    case 'blob': {
      const g = new THREE.IcosahedronGeometry(0.5, 5);
      const pos = g.attributes.position as THREE.BufferAttribute;
      const v = new THREE.Vector3();
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i);
        const k = 1 + 0.08 * Math.sin(v.x * 7 + 1) * Math.cos(v.y * 6) + 0.05 * Math.sin(v.z * 9);
        pos.setXYZ(i, v.x * k, v.y * k, v.z * k);
      }
      g.computeVertexNormals();
      return g;
    }
    case 'sphere':
    case 'ellipsoid':
    default:
      return fine ? new THREE.IcosahedronGeometry(0.5, 6) : new THREE.SphereGeometry(0.5, 48, 32);
  }
}

/**
 * A realistic, colored 3D structure made of named parts. Pointing at a part highlights it and names it;
 * clicking keeps it picked so the info card can explain it.
 */
export function Anatomy({ spec }: { spec: AnatomySpec }) {
  const parts = useMemo(() => [...(spec.model ? builtinParts(spec.model) : []), ...(spec.parts ?? [])], [spec]);
  const { hover, picked } = useParts();
  // a new model starts with its focus part picked (the outgoing model, still fading, must not clear it)
  useEffect(() => {
    partStore.reset();
    if (spec.focus?.[0]) partStore.pick(spec.focus[0]);
  }, [spec]);
  // where to put a part's label: the centre of all its pieces
  const centres = useMemo(() => {
    const m = new Map<string, THREE.Vector3[]>();
    for (const p of parts) {
      const c = p.shape === 'tube' && p.path?.length ? new THREE.Vector3(...p.path[Math.floor(p.path.length / 2)]) : new THREE.Vector3(...p.position);
      (m.get(p.name) ?? m.set(p.name, []).get(p.name)!).push(c);
    }
    return new Map([...m].map(([k, v]) => [k, v.reduce((a, b) => a.add(b), new THREE.Vector3()).divideScalar(v.length)]));
  }, [parts]);
  const active = hover ?? picked;
  const top = useMemo(() => Math.max(...parts.map((p) => p.position[1] + p.size[1] / 2), 2), [parts]);

  return (
    <group>
      {parts.map((p, i) => (
        <PartMesh key={i} part={p} lit={p.name === active} />
      ))}
      {active && centres.get(active) && <Label text={active} position={[centres.get(active)!.x, Math.max(centres.get(active)!.y + 0.9, top * 0.6), centres.get(active)!.z]} height={0.34} />}
    </group>
  );
}

function PartMesh({ part, lit }: { part: AnatomyPart; lit: boolean }) {
  const geo = useMemo(() => {
    // shared corners, so displaced organic surfaces shade smoothly instead of looking faceted
    const g = part.shape === 'tube' ? geometryFor(part) : mergeVertices(geometryFor(part).deleteAttribute('normal').deleteAttribute('uv'));
    if (part.surface === 'folded' || part.surface === 'bumpy') return displace(g, part.surface);
    g.computeVertexNormals(); // the merge dropped them
    return g;
  }, [part]);
  useEffect(() => () => geo.dispose(), [geo]);
  const mat = useRef<THREE.MeshPhysicalMaterial>(null);
  const translucent = part.surface === 'translucent';

  useFrame((_, dt) => {
    const m = mat.current;
    if (!m) return;
    const k = 1 - Math.exp(-10 * dt);
    m.emissiveIntensity = THREE.MathUtils.lerp(m.emissiveIntensity, lit ? 0.35 : 0, k);
    const target = translucent ? (lit ? 0.42 : 0.22) : 1;
    m.opacity = THREE.MathUtils.lerp(m.opacity, target, k);
    m.transparent = translucent || m.opacity < 0.99;
  });

  const isTube = part.shape === 'tube';
  const scale: [number, number, number] = isTube ? [1, 1, 1] : part.shape === 'torus' ? [part.size[0], part.size[1], part.size[0]] : part.size;
  const rot = part.rotation ? (part.rotation.map((d) => d * DEG) as [number, number, number]) : undefined;
  const onOver = (e: ThreeEvent<PointerEvent>) => (e.stopPropagation(), partStore.hover(part.name));
  const onOut = () => partStore.get().hover === part.name && partStore.hover(null);
  const onClick = (e: ThreeEvent<MouseEvent>) => (e.stopPropagation(), partStore.pick(part.name));

  return (
    <mesh geometry={geo} position={isTube ? [0, 0, 0] : part.position} scale={scale} rotation={rot} onPointerOver={onOver} onPointerOut={onOut} onClick={onClick} renderOrder={translucent ? 2 : 0}>
      <meshPhysicalMaterial
        ref={mat}
        color={part.color}
        emissive={part.color}
        emissiveIntensity={0}
        roughness={part.surface === 'glossy' ? 0.2 : part.surface === 'translucent' ? 0.1 : 0.55}
        clearcoat={part.surface === 'glossy' ? 0.6 : 0.15}
        clearcoatRoughness={0.5}
        transparent={translucent}
        opacity={translucent ? 0.22 : 1}
        depthWrite={!translucent}
        side={translucent ? THREE.DoubleSide : THREE.FrontSide}
      />
    </mesh>
  );
}
