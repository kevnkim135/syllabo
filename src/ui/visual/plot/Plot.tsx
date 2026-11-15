import { useEffect, useMemo } from 'react';
import { Line, RoundedBox } from '@react-three/drei';
import { compile } from 'mathjs';
import * as THREE from 'three';
import type { PlotSpec } from '../../../../shared/types';
import { Label } from '../Label';

type V3 = [number, number, number];
const PALETTE = ['#8b6bd6', '#e2783c', '#4f8fe8', '#d9499a', '#e9a923', '#3a3d55'];
const INK = '#2b2740';
const W = 9.4; // board drawing area, scene units
const H = 5.8;

/** A "nice" tick step (1, 2 or 5 times a power of ten) giving about `want` ticks over a span. */
function niceStep(span: number, want = 6) {
  const raw = span / want;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const f = raw / pow;
  return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * pow;
}
const fmt = (v: number) => (Math.abs(v) < 1e-9 ? '0' : Math.abs(v) >= 1000 || Math.abs(v) < 0.01 ? v.toExponential(0) : String(+v.toFixed(2)));

/**
 * A 2D graph drawn as a solid board: axes with ticks, function curves as tubes, data points as beads,
 * bars as blocks, plus line segments, arrows and filled shapes for geometry. The way a textbook plots it.
 */
export function Plot({ spec }: { spec: PlotSpec }) {
  const [x0, x1] = spec.xRange;
  const [y0, y1] = spec.yRange;
  const showAxes = spec.axes !== false;
  // geometry figures keep their true proportions; graphs fill the board
  const sx0 = W / (x1 - x0);
  const sy0 = H / (y1 - y0);
  const sx = showAxes ? sx0 : Math.min(sx0, sy0);
  const sy = showAxes ? sy0 : Math.min(sx0, sy0);
  const xc = (x0 + x1) / 2;
  const yc = (y0 + y1) / 2;
  const at = (x: number, y: number, z = 0): V3 => [(x - xc) * sx, (y - yc) * sy, z];
  const axisY = y0 <= 0 && y1 >= 0 ? 0 : y0; // where the x axis sits
  const axisX = x0 <= 0 && x1 >= 0 ? 0 : x0;

  const ticks = useMemo(() => {
    const list = (lo: number, hi: number) => {
      const step = niceStep(hi - lo);
      const out: number[] = [];
      for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(+v.toPrecision(10));
      return out;
    };
    return { x: list(x0, x1), y: list(y0, y1) };
  }, [x0, x1, y0, y1]);

  // each curve becomes one or more runs of points (broken where the function leaves the board or is undefined)
  const curves = useMemo(
    () =>
      (spec.curves ?? []).map((c, i) => {
        let f: (x: number) => number;
        try {
          const code = compile(c.expr);
          f = (x) => Number(code.evaluate({ x }));
        } catch {
          f = () => NaN;
        }
        const a = Math.max(x0, c.from ?? x0);
        const b = Math.min(x1, c.to ?? x1);
        const runs: V3[][] = [];
        let run: V3[] = [];
        const N = 240;
        const pad = (y1 - y0) * 0.02;
        for (let k = 0; k <= N; k++) {
          const x = a + ((b - a) * k) / N;
          let y: number;
          try {
            y = f(x);
          } catch {
            y = NaN;
          }
          if (Number.isFinite(y) && y >= y0 - pad && y <= y1 + pad) run.push(at(x, Math.max(y0, Math.min(y1, y)), 0.1));
          else if (run.length) runs.push(run), (run = []);
        }
        if (run.length) runs.push(run);
        return { ...c, color: c.color ?? PALETTE[i % PALETTE.length], runs: runs.filter((r) => r.length > 1) };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [spec],
  );

  return (
    <group>
      {/* the board */}
      <RoundedBox args={[W + 1.5, H + 1.5, 0.14]} radius={0.07} smoothness={3} position={[0, 0, -0.09]}>
        <meshBasicMaterial color="#fdfcff" toneMapped={false} />
      </RoundedBox>
      <RoundedBox args={[W + 1.7, H + 1.7, 0.1]} radius={0.05} smoothness={3} position={[0, 0, -0.16]}>
        <meshStandardMaterial color="#cdbdf2" roughness={0.6} />
      </RoundedBox>

      {showAxes && (
        <>
          {ticks.x.map((v) => (
            <Line key={`gx${v}`} points={[at(v, y0, 0.001), at(v, y1, 0.001)]} color="#e4dcf7" lineWidth={1} />
          ))}
          {ticks.y.map((v) => (
            <Line key={`gy${v}`} points={[at(x0, v, 0.001), at(x1, v, 0.001)]} color="#e4dcf7" lineWidth={1} />
          ))}
          <Arrow from={at(x0, axisY, 0.03)} to={at(x1, axisY, 0.03)} color={INK} width={2.4} extend={0.3} />
          <Arrow from={at(axisX, y0, 0.03)} to={at(axisX, y1, 0.03)} color={INK} width={2.4} extend={0.3} />
          {spec.ticks !== false && ticks.x.filter((v) => Math.abs(v - axisX) > 1e-9).map((v) => <Label key={`tx${v}`} text={fmt(v)} position={at(v, axisY, 0.05).map((q, k) => (k === 1 ? q - 0.26 : q)) as V3} height={0.3} bare color="#5b5670" />)}
          {spec.ticks !== false && ticks.y.filter((v) => Math.abs(v - axisY) > 1e-9).map((v) => <Label key={`ty${v}`} text={fmt(v)} position={at(axisX, v, 0.05).map((q, k) => (k === 0 ? q - 0.3 : q)) as V3} height={0.3} bare color="#5b5670" />)}
          {spec.xLabel && <Label text={spec.xLabel} position={[at(x1, axisY)[0] - spec.xLabel.length * 0.07 - 0.1, at(x1, axisY)[1] - (spec.ticks === false ? 0.36 : 0.62), 0.05]} height={0.34} bare color={INK} />}
          {spec.yLabel && <Label text={spec.yLabel} position={[at(axisX, y1)[0] + spec.yLabel.length * 0.075 + 0.25, at(axisX, y1)[1] + 0.12, 0.05]} height={0.34} bare color={INK} />}
        </>
      )}

      {(spec.areas ?? []).map((a, i) => (
        <Area key={i} points={a.points.map(([x, y]) => at(x, y))} color={a.color ?? PALETTE[i % PALETTE.length]} label={a.label} />
      ))}

      {(spec.bars ?? []).map((b, i) => {
        const w = (b.width ?? 1) * sx * 0.86;
        const h = Math.max(0.02, Math.abs(b.height) * sy);
        const base = at(b.x, axisY);
        const color = b.color ?? PALETTE[0];
        return (
          <group key={i}>
            <mesh position={[base[0], base[1] + (Math.sign(b.height) || 1) * (h / 2), 0.2]}>
              <boxGeometry args={[w, h, 0.4]} />
              <meshPhysicalMaterial color={color} roughness={0.35} clearcoat={0.4} />
            </mesh>
            {b.label && <Label text={b.label} position={[base[0], base[1] + (b.height >= 0 ? h + 0.26 : -h - 0.26), 0.3]} height={0.27} />}
          </group>
        );
      })}

      {curves.map((c, i) => (
        <group key={i}>
          {c.runs.map((run, k) => (c.dashed ? <Line key={k} points={run} color={c.color} lineWidth={3.5} dashed dashSize={0.2} gapSize={0.14} /> : <Tube key={k} points={run} color={c.color} />))}
          {c.label && c.runs.length > 0 && <Label text={c.label} position={(([x, y]) => [Math.min(x, W / 2 - 0.6), Math.min(y + 0.36, H / 2 + 0.3), 0.25] as V3)(c.runs[c.runs.length - 1][c.runs[c.runs.length - 1].length - 1])} height={0.3} />}
        </group>
      ))}

      {(spec.segments ?? []).map((s, i) => {
        const a = at(s.from[0], s.from[1], 0.12);
        const b = at(s.to[0], s.to[1], 0.12);
        const color = s.color ?? INK;
        const mid: V3 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 0.25];
        // nudge the label off the line, to the side it leans away from
        const dx = b[0] - a[0];
        const dy = b[1] - a[1];
        const len = Math.hypot(dx, dy) || 1;
        return (
          <group key={i}>
            {s.arrow ? <Arrow from={a} to={b} color={color} width={3.2} dashed={s.dashed} /> : <Line points={[a, b]} color={color} lineWidth={3.2} dashed={!!s.dashed} dashSize={0.18} gapSize={0.12} />}
            {s.label && <Label text={s.label} position={[mid[0] - (dy / len) * 0.3, mid[1] + Math.abs(dx / len) * 0.3 + (Math.abs(dx) < 0.01 ? 0 : 0), mid[2]]} height={0.28} />}
          </group>
        );
      })}

      {(spec.points ?? []).map((p, i) => {
        const q = at(p.x, p.y, 0.16);
        return (
          <group key={i}>
            <mesh position={q}>
              <sphereGeometry args={[0.13, 24, 16]} />
              <meshPhysicalMaterial color={p.color ?? PALETTE[1]} roughness={0.25} clearcoat={0.6} />
            </mesh>
            {p.label && <Label text={p.label} position={[q[0], q[1] + 0.38, 0.3]} height={0.28} />}
          </group>
        );
      })}

      {(spec.labels ?? []).map((l, i) => (
        <Label key={i} text={l.text} position={at(l.x, l.y, 0.3)} height={0.3} />
      ))}
    </group>
  );
}

/** A curve as a solid tube, so it reads as an object from any angle. */
function Tube({ points, color }: { points: V3[]; color: string }) {
  const geo = useMemo(() => {
    const path = new THREE.CurvePath<THREE.Vector3>();
    const v = points.map((p) => new THREE.Vector3(...p));
    for (let i = 1; i < v.length; i++) path.add(new THREE.LineCurve3(v[i - 1], v[i]));
    return new THREE.TubeGeometry(path, Math.min(600, points.length * 2), 0.05, 8, false);
  }, [points]);
  useEffect(() => () => geo.dispose(), [geo]);
  return (
    <mesh geometry={geo}>
      <meshPhysicalMaterial color={color} roughness={0.3} clearcoat={0.5} />
    </mesh>
  );
}

/** A line with a cone arrowhead at its end (axes, vectors, "this goes there"). */
function Arrow({ from, to, color, width, dashed = false, extend = 0 }: { from: V3; to: V3; color: string; width: number; dashed?: boolean; extend?: number }) {
  const a = new THREE.Vector3(...from);
  const b = new THREE.Vector3(...to);
  const dir = b.clone().sub(a).normalize();
  const tip = b.clone().addScaledVector(dir, extend);
  const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  return (
    <group>
      <Line points={[from, tip.clone().addScaledVector(dir, -0.2).toArray() as V3]} color={color} lineWidth={width} dashed={dashed} dashSize={0.18} gapSize={0.12} />
      <mesh position={tip.clone().addScaledVector(dir, -0.12)} quaternion={quat}>
        <coneGeometry args={[0.1, 0.26, 16]} />
        <meshStandardMaterial color={color} roughness={0.5} />
      </mesh>
    </group>
  );
}

/** A filled polygon with a crisp outline: a triangle, a shaded region under a curve. */
function Area({ points, color, label }: { points: V3[]; color: string; label?: string }) {
  const geo = useMemo(() => {
    const shape = new THREE.Shape(points.map((p) => new THREE.Vector2(p[0], p[1])));
    return new THREE.ExtrudeGeometry(shape, { depth: 0.05, bevelEnabled: false });
  }, [points]);
  useEffect(() => () => geo.dispose(), [geo]);
  const c = points.reduce((s, p) => [s[0] + p[0] / points.length, s[1] + p[1] / points.length], [0, 0]);
  return (
    <group>
      <mesh geometry={geo} position={[0, 0, 0.01]}>
        <meshStandardMaterial color={color} transparent opacity={0.32} roughness={0.6} depthWrite={false} />
      </mesh>
      <Line points={[...points, points[0]].map((p) => [p[0], p[1], 0.08] as V3)} color={color} lineWidth={3} />
      {label && <Label text={label} position={[c[0], c[1], 0.3]} height={0.28} />}
    </group>
  );
}
