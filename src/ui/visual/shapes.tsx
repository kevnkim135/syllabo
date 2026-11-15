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
  spring: '#9aa0ad', ramp: '#b7a17e', charge: '#e0473c', crate: '#b07d45', truck: '#3f7fd9', ladder: '#c98d4b', wall: '#d9cbb8',
  battery: '#2b2b33', resistor: '#d9c39a', bulb: '#fff6c8', switch: '#3a3d45', capacitor: '#4f8fe8',
  node: '#8b6bd6', chip: '#3a3d45', database: '#4f8fe8', document: '#f4f1ea',
  tank: '#9fb6c9', cylinder: '#c0c4cc', cone: '#e8a33d', tree: '#3f8f4e', house: '#e8d6b8', cannon: '#3a3d45', balloon: '#e0473c', table: '#a0703f',
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
    case 'crate':
      return (
        <group>
          <mesh>
            <boxGeometry args={[r * 1.3, r * 1.3, r * 1.3]} />
            <Mat color={c} rough={0.85} />
          </mesh>
          {[-1, 1].map((k) => (
            <mesh key={k} position={[0, 0, k * r * 0.66]} rotation={[0, 0, Math.PI / 4]}>
              <boxGeometry args={[r * 1.7, r * 0.14, r * 0.04]} />
              <Mat color="#8a5a2b" rough={0.9} />
            </mesh>
          ))}
        </group>
      );
    case 'truck':
      return (
        <group>
          <mesh position={[-r * 0.35, r * 0.25, 0]}>
            <boxGeometry args={[r * 1.9, r * 1.0, r * 1.1]} />
            <Mat color="#e8eaf0" rough={0.6} />
          </mesh>
          <mesh position={[r * 1.0, r * 0.05, 0]}>
            <boxGeometry args={[r * 0.8, r * 0.75, r * 1.05]} />
            <Mat color={c} metal={0.3} rough={0.35} />
          </mesh>
          {[-0.95, 0.2, 1.05].flatMap((x) => [-0.5, 0.5].map((z) => <Wheel key={`${x}${z}`} x={x * r} y={-r * 0.35} z={z * r} r={r * 0.25} />))}
        </group>
      );
    case 'ladder':
      return (
        <group>
          {[-1, 1].map((k) => (
            <mesh key={k} position={[0, 0, k * r * 0.35]}>
              <boxGeometry args={[r * 0.08, r * 3, r * 0.08]} />
              <Mat color={c} rough={0.8} />
            </mesh>
          ))}
          {Array.from({ length: 7 }, (_, i) => (
            <mesh key={i} position={[0, -r * 1.3 + i * r * 0.43, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[r * 0.035, r * 0.035, r * 0.7, 8]} />
              <Mat color={c} rough={0.8} />
            </mesh>
          ))}
        </group>
      );
    case 'wall':
      return (
        <mesh>
          <boxGeometry args={[r * 0.35, r * 3, r * 2]} />
          <Mat color={c} rough={0.95} />
        </mesh>
      );
    case 'tank':
      return (
        <group>
          <mesh rotation={[Math.PI, 0, 0]}>
            <coneGeometry args={[r * 1.0, r * 1.8, 32, 1, true]} />
            <meshStandardMaterial color={c} metalness={0.3} roughness={0.3} transparent opacity={0.45} side={2} />
          </mesh>
          <mesh rotation={[Math.PI, 0, 0]} position={[0, -r * 0.3, 0]}>
            <coneGeometry args={[r * 0.66, r * 1.2, 32]} />
            <meshStandardMaterial color="#3d8ec9" transparent opacity={0.8} roughness={0.15} />
          </mesh>
        </group>
      );
    case 'cylinder':
      return (
        <mesh>
          <cylinderGeometry args={[r * 0.55, r * 0.55, r * 1.5, 28]} />
          <Mat color={c} metal={0.6} rough={0.3} />
        </mesh>
      );
    case 'cone':
      return (
        <mesh>
          <coneGeometry args={[r * 0.7, r * 1.5, 28]} />
          <Mat color={c} rough={0.6} />
        </mesh>
      );
    case 'tree':
      return (
        <group>
          <mesh position={[0, -r * 0.6, 0]}>
            <cylinderGeometry args={[r * 0.12, r * 0.16, r * 1.0, 10]} />
            <Mat color="#7a5230" rough={0.9} />
          </mesh>
          <mesh position={[0, r * 0.35, 0]}>
            <coneGeometry args={[r * 0.75, r * 1.5, 12]} />
            <Mat color={c} rough={0.9} />
          </mesh>
        </group>
      );
    case 'house':
      return (
        <group>
          <mesh position={[0, -r * 0.2, 0]}>
            <boxGeometry args={[r * 1.6, r * 1.2, r * 1.4]} />
            <Mat color={c} rough={0.9} />
          </mesh>
          <mesh position={[0, r * 0.75, 0]} rotation={[0, Math.PI / 4, 0]}>
            <coneGeometry args={[r * 1.25, r * 0.8, 4]} />
            <Mat color="#b5473a" rough={0.8} />
          </mesh>
        </group>
      );
    case 'cannon':
      return (
        <group>
          <mesh rotation={[0, 0, -Math.PI / 2]} position={[r * 0.3, r * 0.15, 0]}>
            <cylinderGeometry args={[r * 0.22, r * 0.3, r * 1.5, 18]} />
            <Mat color={c} metal={0.6} rough={0.35} />
          </mesh>
          {[-0.45, 0.45].map((z) => <Wheel key={z} x={-r * 0.1} y={-r * 0.15} z={z * r} r={r * 0.35} />)}
        </group>
      );
    case 'balloon':
      return (
        <group>
          <mesh scale={[1, 1.2, 1]}>
            <sphereGeometry args={[r * 0.7, 28, 20]} />
            <Mat color={c} rough={0.25} />
          </mesh>
          <mesh position={[0, -r * 1.3, 0]}>
            <cylinderGeometry args={[r * 0.01, r * 0.01, r * 1.2, 4]} />
            <Mat color="#555" />
          </mesh>
        </group>
      );
    case 'table':
      return (
        <group>
          <mesh position={[0, r * 0.4, 0]}>
            <boxGeometry args={[r * 2.4, r * 0.12, r * 1.4]} />
            <Mat color={c} rough={0.7} />
          </mesh>
          {[-1, 1].flatMap((x) => [-1, 1].map((z) => (
            <mesh key={`${x}${z}`} position={[x * r * 1.05, -r * 0.2, z * r * 0.55]}>
              <boxGeometry args={[r * 0.1, r * 1.1, r * 0.1]} />
              <Mat color={c} rough={0.7} />
            </mesh>
          )))}
        </group>
      );
    case 'ball':
      return (
        <group>
          <mesh>
            <sphereGeometry args={[r, 32, 20]} />
            <Mat color={color ?? '#f08a24'} rough={0.55} />
          </mesh>
          {/* seams, like a basketball, so it reads as a ball and shows spin */}
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[r * 1.002, r * 0.03, 6, 40]} />
            <Mat color="#2a2a30" />
          </mesh>
          <mesh rotation={[0, Math.PI / 2, 0]}>
            <torusGeometry args={[r * 1.002, r * 0.03, 6, 40]} />
            <Mat color="#2a2a30" />
          </mesh>
        </group>
      );
    case 'battery':
      // a cell lying along x: dark body, copper top band, + and − ends with terminals
      return (
        <group rotation={[0, 0, -Math.PI / 2]}>
          <mesh>
            <cylinderGeometry args={[r * 0.42, r * 0.42, r * 1.5, 32]} />
            <Mat color={c} rough={0.35} metal={0.3} />
          </mesh>
          <mesh position={[0, r * 0.52, 0]}>
            <cylinderGeometry args={[r * 0.43, r * 0.43, r * 0.46, 32]} />
            <Mat color="#d98a3d" rough={0.3} metal={0.6} />
          </mesh>
          <mesh position={[0, r * 0.82, 0]}>
            <cylinderGeometry args={[r * 0.14, r * 0.14, r * 0.14, 20]} />
            <Mat color="#cfd3da" rough={0.2} metal={0.9} />
          </mesh>
          <mesh position={[0, -r * 0.77, 0]}>
            <cylinderGeometry args={[r * 0.3, r * 0.3, r * 0.04, 24]} />
            <Mat color="#cfd3da" rough={0.2} metal={0.9} />
          </mesh>
          {/* + and − marks on the body */}
          <mesh position={[r * 0.43, r * 0.5, 0]}>
            <boxGeometry args={[r * 0.02, r * 0.22, r * 0.06]} />
            <Mat color="#ffffff" />
          </mesh>
          <mesh position={[r * 0.43, r * 0.5, 0]}>
            <boxGeometry args={[r * 0.02, r * 0.06, r * 0.22]} />
            <Mat color="#ffffff" />
          </mesh>
          <mesh position={[r * 0.43, -r * 0.45, 0]}>
            <boxGeometry args={[r * 0.02, r * 0.06, r * 0.22]} />
            <Mat color="#ffffff" />
          </mesh>
        </group>
      );
    case 'resistor':
      // a beige body with the four colour bands, silver leads out both ends along x
      return (
        <group rotation={[0, 0, Math.PI / 2]}>
          <mesh>
            <capsuleGeometry args={[r * 0.24, r * 0.8, 8, 24]} />
            <Mat color={c} rough={0.6} />
          </mesh>
          {['#8b4a2b', '#2b2b33', '#e0473c', '#d9b13d'].map((band, k) => (
            <mesh key={k} position={[0, r * (0.33 - k * 0.2), 0]}>
              <cylinderGeometry args={[r * 0.255, r * 0.255, r * 0.08, 24]} />
              <Mat color={band} rough={0.5} />
            </mesh>
          ))}
          <mesh>
            <cylinderGeometry args={[r * 0.04, r * 0.04, r * 2.1, 10]} />
            <Mat color="#c9ccd3" rough={0.25} metal={0.85} />
          </mesh>
        </group>
      );
    case 'bulb':
      // a glowing glass bulb with its filament, on a threaded metal base
      return (
        <group>
          <mesh position={[0, r * 0.25, 0]}>
            <sphereGeometry args={[r * 0.6, 32, 24]} />
            <meshPhysicalMaterial color={c} emissive="#ffd84a" emissiveIntensity={0.55} transparent opacity={0.6} roughness={0.05} transmission={0.3} depthWrite={false} />
          </mesh>
          <mesh position={[0, r * 0.25, 0]}>
            <torusGeometry args={[r * 0.16, r * 0.025, 8, 24, Math.PI]} />
            <Mat color="#ffb020" emissive="#ffb020" />
          </mesh>
          {[-1, 1].map((k) => (
            <mesh key={k} position={[k * r * 0.16, -r * 0.08, 0]}>
              <cylinderGeometry args={[r * 0.015, r * 0.015, r * 0.5, 6]} />
              <Mat color="#8a8fa3" />
            </mesh>
          ))}
          {[0, 1, 2].map((k) => (
            <mesh key={k} position={[0, -r * (0.42 + k * 0.12), 0]}>
              <cylinderGeometry args={[r * (0.27 - k * 0.015), r * (0.27 - k * 0.015), r * 0.1, 24]} />
              <Mat color="#c9ccd3" rough={0.25} metal={0.85} />
            </mesh>
          ))}
          <mesh position={[0, -r * 0.8, 0]}>
            <sphereGeometry args={[r * 0.1, 12, 8]} />
            <Mat color="#3a3d45" />
          </mesh>
        </group>
      );
    case 'switch':
      // a knife switch on a base: open lever tilted up from the hinge on the left
      return (
        <group>
          <mesh position={[0, -r * 0.18, 0]}>
            <boxGeometry args={[r * 1.8, r * 0.14, r * 0.7]} />
            <Mat color={c} rough={0.6} />
          </mesh>
          {[-1, 1].map((k) => (
            <mesh key={k} position={[k * r * 0.7, -r * 0.02, 0]}>
              <boxGeometry args={[r * 0.14, r * 0.22, r * 0.2]} />
              <Mat color="#d98a3d" rough={0.3} metal={0.7} />
            </mesh>
          ))}
          <mesh position={[-r * 0.7 + Math.cos(0.5) * r * 0.65, r * 0.08 + Math.sin(0.5) * r * 0.65, 0]} rotation={[0, 0, 0.5]}>
            <boxGeometry args={[r * 1.3, r * 0.07, r * 0.12]} />
            <Mat color="#d98a3d" rough={0.3} metal={0.7} />
          </mesh>
          <mesh position={[-r * 0.7 + Math.cos(0.5) * r * 1.3, r * 0.08 + Math.sin(0.5) * r * 1.3, 0]}>
            <sphereGeometry args={[r * 0.1, 12, 8]} />
            <Mat color="#2b2b33" />
          </mesh>
        </group>
      );
    case 'capacitor':
      // two metal plates facing each other across a gap, leads out along x
      return (
        <group>
          {[-1, 1].map((k) => (
            <group key={k}>
              <mesh position={[k * r * 0.16, 0, 0]}>
                <boxGeometry args={[r * 0.08, r * 1.2, r * 0.9]} />
                <Mat color={c} rough={0.3} metal={0.6} />
              </mesh>
              <mesh position={[k * r * 0.6, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[r * 0.04, r * 0.04, r * 0.8, 10]} />
                <Mat color="#c9ccd3" rough={0.25} metal={0.85} />
              </mesh>
            </group>
          ))}
        </group>
      );
    case 'node':
      // a glowing unit with an orbiting ring: a neuron, a vertex, an abstract idea
      return (
        <group>
          <mesh>
            <sphereGeometry args={[r * 0.72, 36, 24]} />
            <meshPhysicalMaterial color={c} emissive={c} emissiveIntensity={0.55} roughness={0.25} clearcoat={0.7} />
          </mesh>
          <mesh rotation={[Math.PI / 2.4, 0.3, 0]}>
            <torusGeometry args={[r * 1.0, r * 0.045, 10, 56]} />
            <Mat color={c} rough={0.3} metal={0.4} />
          </mesh>
          <mesh scale={1.25}>
            <sphereGeometry args={[r * 0.72, 24, 16]} />
            <meshBasicMaterial color={c} transparent opacity={0.14} depthWrite={false} />
          </mesh>
        </group>
      );
    case 'chip':
      // a processor: dark package, bright die, rows of gold pins
      return (
        <group>
          <mesh>
            <boxGeometry args={[r * 1.7, r * 0.26, r * 1.7]} />
            <Mat color={c} rough={0.45} metal={0.3} />
          </mesh>
          <mesh position={[0, r * 0.15, 0]}>
            <boxGeometry args={[r * 0.8, r * 0.08, r * 0.8]} />
            <Mat color="#8b6bd6" rough={0.2} metal={0.5} emissive="#8b6bd6" />
          </mesh>
          {[-1, 1].flatMap((side) =>
            [-3, -2, -1, 0, 1, 2, 3].flatMap((k) => [
              <mesh key={`x${side}${k}`} position={[side * r * 0.93, -r * 0.05, k * r * 0.22]}>
                <boxGeometry args={[r * 0.18, r * 0.06, r * 0.09]} />
                <Mat color="#e0b84a" rough={0.3} metal={0.8} />
              </mesh>,
              <mesh key={`z${side}${k}`} position={[k * r * 0.22, -r * 0.05, side * r * 0.93]}>
                <boxGeometry args={[r * 0.09, r * 0.06, r * 0.18]} />
                <Mat color="#e0b84a" rough={0.3} metal={0.8} />
              </mesh>,
            ]),
          )}
        </group>
      );
    case 'database':
      // three stacked disks, the classic storage symbol
      return (
        <group>
          {[-1, 0, 1].map((k) => (
            <group key={k} position={[0, k * r * 0.56, 0]}>
              <mesh>
                <cylinderGeometry args={[r * 0.8, r * 0.8, r * 0.46, 40]} />
                <Mat color={c} rough={0.35} metal={0.35} />
              </mesh>
              <mesh position={[0, r * 0.235, 0]}>
                <cylinderGeometry args={[r * 0.8, r * 0.8, r * 0.02, 40]} />
                <Mat color="#dbe8ff" rough={0.3} metal={0.2} />
              </mesh>
            </group>
          ))}
        </group>
      );
    case 'document':
      // a sheet of paper with lines of text and a folded corner
      return (
        <group rotation={[0, 0.6, 0]}>
          <mesh>
            <boxGeometry args={[r * 1.3, r * 1.75, r * 0.05]} />
            <Mat color={c} rough={0.85} />
          </mesh>
          {[0.55, 0.3, 0.05, -0.2, -0.45].map((y, k) => (
            <mesh key={k} position={[k === 0 ? -r * 0.15 : 0, y * r, r * 0.03]}>
              <boxGeometry args={[r * (k === 0 ? 0.7 : k === 4 ? 0.6 : 1.0), r * (k === 0 ? 0.11 : 0.06), r * 0.01]} />
              <Mat color={k === 0 ? '#8b6bd6' : '#8a8fa3'} rough={0.8} />
            </mesh>
          ))}
        </group>
      );
    case 'charge':
    default:
      return (
        <mesh>
          <sphereGeometry args={[r, 32, 20]} />
          <Mat color={c} rough={0.4} />
        </mesh>
      );
  }
}
