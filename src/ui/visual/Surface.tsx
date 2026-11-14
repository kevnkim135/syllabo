import { useEffect, useMemo } from 'react';
import { compile } from 'mathjs';
import * as THREE from 'three';
import type { SurfaceSpec } from '../../../shared/types';
import { clamp } from '../../utils/gestureMath';
import { palette } from './palette';

const N = 80; // grid resolution
const SIZE = 6; // scene units across

export function Surface({ spec }: { spec: SurfaceSpec }) {
  const p = palette();
  const geom = useMemo(() => {
    const g = new THREE.PlaneGeometry(SIZE, SIZE, N, N);
    let f: (x: number, y: number) => number = () => 0;
    try {
      const c = compile(spec.expr); // mathjs: safe, no eval of arbitrary JS
      f = (x, y) => Number(c.evaluate({ x, y }));
    } catch (e) {
      console.warn('Bad surface expression', spec.expr, e);
    }

    const [x0, x1] = spec.xRange;
    const [y0, y1] = spec.yRange;
    const pos = g.attributes.position as THREE.BufferAttribute;
    const zs: number[] = [];
    for (let i = 0; i < pos.count; i++) {
      const u = pos.getX(i) / SIZE + 0.5;
      const v = pos.getY(i) / SIZE + 0.5;
      let z: number;
      try {
        z = f(x0 + u * (x1 - x0), y0 + v * (y1 - y0));
      } catch {
        z = NaN;
      }
      z = Number.isFinite(z) ? clamp(z, -10, 10) : 0;
      zs.push(z);
      pos.setZ(i, z);
    }

    // Height-based color from the palette: forest (low) -> violet -> lilac (high).
    const lo = Math.min(...zs);
    const span = Math.max(...zs) - lo || 1;
    const [low, mid, high] = [p.forest, p.violet, p.lilac200].map((c) => new THREE.Color(c));
    const color = new THREE.Color();
    const colors = zs.flatMap((z) => {
      const t = (z - lo) / span;
      return (t < 0.5 ? color.lerpColors(low, mid, t * 2) : color.lerpColors(mid, high, t * 2 - 1)).toArray();
    });
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    g.rotateX(-Math.PI / 2); // z-up math -> y-up scene
    g.computeVertexNormals();
    return g;
  }, [spec]);

  useEffect(() => () => geom.dispose(), [geom]);

  return (
    <group>
      <mesh geometry={geom}>
        <meshStandardMaterial vertexColors side={THREE.DoubleSide} roughness={0.6} />
      </mesh>
      <mesh geometry={geom}>
        <meshBasicMaterial wireframe color={p.white} transparent opacity={0.14} />
      </mesh>
      <gridHelper args={[SIZE, 12, p.violet, p.lilac200]} />
      <axesHelper args={[4]} ref={(a) => void a?.setColors(p.violet, p.forest, p.violet)} />
    </group>
  );
}
