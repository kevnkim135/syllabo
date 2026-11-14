// Low-poly, procedural objects for diagram bodies, so physics figures read like textbook drawings
// (a car, a plane, a person) instead of anonymous spheres. Built from primitives: no model files to load.
// Each faces +x (the direction of travel) and fits roughly inside a sphere of radius `r` around its centre.
import type { BodyShape } from '../../../shared/types';

const Mat = ({ color, rough = 0.5, metal = 0.05, emissive }: { color: string; rough?: number; metal?: number; emissive?: string }) => (
  <meshStandardMaterial color={color} roughness={rough} metalness={metal} emissive={emissive ?? '#000000'} emissiveIntensity={emissive ? 0.9 : 0} />
);

function Wheel({ x, y, z, r }: { x: number; y: number; z: number; r: number }) {
  return (
    <mesh position={[x, y, z]} rotation={[Math.PI / 2, 0, 0]}>
      <cylinderGeometry args={[r, r, r * 0.6, 18]} />
      <Mat color="#2a2a30" rough={0.8} />
    </mesh>
  );
}

const DEFAULT_COLOR: Partial<Record<BodyShape, string>> = {
  ball: '#f2f2f2', block: '#c98d4b', box: '#c98d4b', car: '#e0473c', cart: '#3f7fd9', plane: '#e8eaf0', rocket: '#eef0f4',
  person: '#4f8cff', planet: '#3d7fd6', sun: '#ffcf3f', moon: '#c9c9cf', satellite: '#c0c4cc', boat: '#d9a066', pulley: '#9aa0ad',
  spring: '#9aa0ad', ramp: '#b7a17e', charge: '#e0473c',
};

export function BodyShapeMesh({ shape, r = 0.45, color }: { shape?: BodyShape; r?: number; color?: string }) {
  const c = color ?? (shape && DEFAULT_COLOR[shape]) ?? '#4f8cff';
  switch (shape) {
    case 'car':
      return (
        <group>
          <mesh position={[0, r * 0.05, 0]}>
            <boxGeometry args={[r * 2.2, r * 0.55, r * 1.05]} />
            <Mat color={c} metal={0.3} rough={0.35} />
          </mesh>
          <mesh position={[-r * 0.1, r * 0.55, 0]}>
            <boxGeometry args={[r * 1.15, r * 0.5, r * 0.95]} />
            <Mat color="#cfe3f2" metal={0.2} rough={0.15} />
          </mesh>
          {[-0.68, 0.68].flatMap((x) => [-0.5, 0.5].map((z) => <Wheel key={`${x}${z}`} x={x * r} y={-r * 0.3} z={z * r} r={r * 0.28} />))}
        </group>
      );
    case 'cart':
      return (
        <group>
          <mesh position={[0, r * 0.1, 0]}>
            <boxGeometry args={[r * 1.8, r * 0.7, r * 1]} />
            <Mat color={c} />
          </mesh>
          {[-0.55, 0.55].flatMap((x) => [-0.5, 0.5].map((z) => <Wheel key={`${x}${z}`} x={x * r} y={-r * 0.38} z={z * r} r={r * 0.24} />))}
        </group>
      );
    case 'plane':
      return (
        <group>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <capsuleGeometry args={[r * 0.22, r * 1.8, 6, 14]} />
            <Mat color={c} metal={0.4} rough={0.3} />
          </mesh>
          <mesh>
            <boxGeometry args={[r * 0.55, r * 0.06, r * 2.4]} />
            <Mat color="#9aa6ba" metal={0.4} />
          </mesh>
          <mesh position={[-r * 1, r * 0.3, 0]}>
            <boxGeometry args={[r * 0.35, r * 0.55, r * 0.06]} />
            <Mat color="#e0473c" />
          </mesh>
          <mesh position={[-r * 1, r * 0.05, 0]}>
            <boxGeometry args={[r * 0.3, r * 0.05, r * 0.9]} />
            <Mat color="#9aa6ba" />
          </mesh>
        </group>
      );
    case 'rocket':
      return (
        <group rotation={[0, 0, -Math.PI / 2]}>
          <mesh>
            <cylinderGeometry args={[r * 0.32, r * 0.32, r * 1.5, 18]} />
            <Mat color={c} metal={0.3} rough={0.3} />
          </mesh>
          <mesh position={[0, r * 1.0, 0]}>
            <coneGeometry args={[r * 0.32, r * 0.55, 18]} />
            <Mat color="#e0473c" />
          </mesh>
          {[0, 1, 2].map((k) => (
            <mesh key={k} position={[Math.cos((k * 2 * Math.PI) / 3) * r * 0.36, -r * 0.6, Math.sin((k * 2 * Math.PI) / 3) * r * 0.36]} rotation={[0, (-k * 2 * Math.PI) / 3, 0]}>
              <boxGeometry args={[r * 0.3, r * 0.4, r * 0.05]} />
              <Mat color="#e0473c" />
            </mesh>
          ))}
          <mesh position={[0, -r * 0.95, 0]}>
            <coneGeometry args={[r * 0.22, r * 0.5, 14]} />
            <Mat color="#ffb347" emissive="#ff8a1f" />
          </mesh>
        </group>
      );
    case 'person':
      return (
        <group>
          <mesh position={[0, -r * 0.15, 0]}>
            <capsuleGeometry args={[r * 0.28, r * 0.75, 6, 14]} />
            <Mat color={c} />
          </mesh>
          <mesh position={[0, r * 0.68, 0]}>
            <sphereGeometry args={[r * 0.25, 18, 14]} />
            <Mat color="#f1c7a4" />
          </mesh>
        </group>
      );
    case 'planet':
    case 'moon':
      return (
        <mesh>
          <sphereGeometry args={[r, 32, 24]} />
          <Mat color={c} rough={0.85} />
        </mesh>
      );
    case 'sun':
      return (
        <group>
          <mesh>
            <sphereGeometry args={[r, 32, 24]} />
            <Mat color={c} emissive="#ffb200" />
          </mesh>
          <pointLight intensity={2.2} distance={30} color="#fff2c4" />
        </group>
      );
    case 'satellite':
      return (
        <group>
          <mesh>
            <boxGeometry args={[r * 0.6, r * 0.6, r * 0.6]} />
            <Mat color={c} metal={0.7} rough={0.25} />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[0, 0, s * r * 0.85]}>
              <boxGeometry args={[r * 0.5, r * 0.04, r * 0.9]} />
              <Mat color="#2b4a8f" metal={0.4} rough={0.3} />
            </mesh>
          ))}
        </group>
      );
    case 'boat':
      return (
        <group>
          <mesh rotation={[0, 0, Math.PI]} position={[0, 0, 0]}>
            <cylinderGeometry args={[r * 0.55, r * 0.3, r * 0.45, 4, 1]} />
            <Mat color={c} />
          </mesh>
          <mesh position={[0, r * 0.5, 0]}>
            <cylinderGeometry args={[r * 0.03, r * 0.03, r * 0.9, 6]} />
            <Mat color="#6b5b4a" />
          </mesh>
        </group>
      );
    case 'pulley':
      return (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[r * 0.7, r * 0.15, 10, 28]} />
          <Mat color={c} metal={0.6} rough={0.3} />
        </mesh>
      );
    case 'spring':
      return (
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <torusKnotGeometry args={[r * 0.35, r * 0.06, 90, 8, 1, 7]} />
          <Mat color={c} metal={0.7} rough={0.3} />
        </mesh>
      );
    case 'ramp':
      return (
        <mesh rotation={[0, 0, 0]}>
          <cylinderGeometry args={[r * 1.2, r * 1.2, r * 1.2, 3, 1]} />
          <Mat color={c} rough={0.9} />
        </mesh>
      );
    case 'block':
    case 'box':
      return (
        <mesh>
          <boxGeometry args={[r * 1.4, r * 1.1, r * 1.1]} />
          <Mat color={c} rough={0.7} />
        </mesh>
      );
    case 'charge':
    case 'ball':
    default:
      return (
        <mesh>
          <sphereGeometry args={[r, 32, 20]} />
          <Mat color={c} rough={shape === 'ball' ? 0.45 : 0.4} />
        </mesh>
      );
  }
}
