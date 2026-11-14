import { useMemo } from 'react';
import * as THREE from 'three';
import type { MoleculeSpec } from '../../../shared/types';
import { element } from '../../utils/elements';
import { Label } from './Label';

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
            <Label text={a.element} height={0.28} />
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
  // One cylinder per bond order, spaced perpendicular to the bond so double/triple bonds read clearly.
  const { len, quat, mid, offsets } = useMemo(() => {
    const dir = to.clone().sub(from);
    const len = dir.length();
    const unit = dir.clone().normalize();
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), unit);
    const ref = Math.abs(unit.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const perp = new THREE.Vector3().crossVectors(unit, ref).normalize();
    const gap = 0.16;
    const offsets = Array.from({ length: order }, (_, i) => perp.clone().multiplyScalar((i - (order - 1) / 2) * gap));
    return { len, quat, mid: from.clone().add(to).multiplyScalar(0.5), offsets };
  }, [from, to, order]);

  return (
    <group>
      {offsets.map((o, i) => (
        <mesh key={i} position={mid.clone().add(o)} quaternion={quat}>
          <cylinderGeometry args={[0.05, 0.05, len, 12]} />
          <meshStandardMaterial color="#c8c8c8" />
        </mesh>
      ))}
    </group>
  );
}
