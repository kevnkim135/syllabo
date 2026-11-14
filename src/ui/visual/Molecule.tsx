import { useMemo } from 'react';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import type { MoleculeSpec } from '../../../shared/types';
import { element } from '../../utils/elements';

const SCALE = 1.6; // angstroms -> scene units

export function Molecule({ spec }: { spec: MoleculeSpec }) {
  // Center on the centroid so rotation orbits the molecule.
  const pts = useMemo(() => {
    const v = spec.atoms.map((a) => new THREE.Vector3(a.x, a.y, a.z));
    const c = v.reduce((sum, p) => sum.add(p), new THREE.Vector3()).divideScalar(v.length || 1);
    return v.map((p) => p.sub(c).multiplyScalar(SCALE));
  }, [spec]);

  return (
    <group>
      {spec.atoms.map((a, i) => {
        const e = element(a.element);
        return (
          <mesh key={i} position={pts[i]}>
            <sphereGeometry args={[e.radius, 32, 32]} />
            <meshStandardMaterial color={e.color} roughness={0.35} />
            <Html center distanceFactor={10}>
              <span className="label">{a.element}</span>
            </Html>
          </mesh>
        );
      })}
      {spec.bonds.map((b, i) =>
        pts[b.a] && pts[b.b] ? <Bond key={i} from={pts[b.a]} to={pts[b.b]} order={b.order} /> : null,
      )}
    </group>
  );
}

function Bond({ from, to, order }: { from: THREE.Vector3; to: THREE.Vector3; order: number }) {
  const { mid, len, quat } = useMemo(() => {
    const dir = to.clone().sub(from);
    return {
      mid: from.clone().add(to).multiplyScalar(0.5),
      len: dir.length(),
      quat: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()),
    };
  }, [from, to]);
  const r = 0.07 * order; // TODO: draw double/triple bonds as parallel cylinders

  return (
    <mesh position={mid} quaternion={quat}>
      <cylinderGeometry args={[r, r, len, 12]} />
      <meshStandardMaterial color="#c8c8c8" />
    </mesh>
  );
}
