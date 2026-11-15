import type { NetNode } from '../../../../shared/types';
import { hash01, type Net } from './builtins';

export type V3 = [number, number, number];

/** Where every node sits. Explicit positions win; the rest follow the layout. */
export function layoutNetwork(net: Net): Map<string, V3> {
  const out = new Map<string, V3>();
  const free = net.nodes.filter((n) => !n.pos);
  for (const n of net.nodes) if (n.pos) out.set(n.id, n.pos);
  if (!free.length) return out;
  const placed = net.layout === 'tree' ? tree(net, free) : net.layout === 'graph' ? graph(net, free) : layers(net, free);
  for (const [id, p] of placed) out.set(id, p);
  return out;
}

/** Groups left to right, the nodes of each stacked in a column (large layers wrap into depth). */
function layers(net: Net, nodes: NetNode[]): Map<string, V3> {
  const order = [...new Set([...net.groups.map((g) => g.name), ...nodes.map((n) => n.group ?? '')])].filter((g) => nodes.some((n) => (n.group ?? '') === g));
  const gap = order.length > 1 ? Math.min(3, 9.5 / (order.length - 1)) : 0;
  const out = new Map<string, V3>();
  order.forEach((g, gi) => {
    const col = nodes.filter((n) => (n.group ?? '') === g);
    const rows = Math.min(col.length, 8);
    const depth = Math.ceil(col.length / 8);
    const step = rows > 1 ? Math.min(1, 5.6 / (rows - 1)) : 0;
    col.forEach((n, i) => {
      const r = i % 8;
      const d = Math.floor(i / 8);
      out.set(n.id, [(gi - (order.length - 1) / 2) * gap, ((rows - 1) / 2 - r) * step, (d - (depth - 1) / 2) * 0.9]);
    });
  });
  return out;
}

/** Top down along the edges: leaves are spread evenly, parents sit above the middle of their children. */
function tree(net: Net, nodes: NetNode[]): Map<string, V3> {
  const ids = new Set(nodes.map((n) => n.id));
  const kids = new Map<string, string[]>();
  const hasParent = new Set<string>();
  for (const e of net.edges) {
    if (!ids.has(e.a) || !ids.has(e.b) || hasParent.has(e.b) || e.a === e.b) continue;
    (kids.get(e.a) ?? kids.set(e.a, []).get(e.a)!).push(e.b);
    hasParent.add(e.b);
  }
  const roots = nodes.filter((n) => !hasParent.has(n.id)).map((n) => n.id);
  const x = new Map<string, number>();
  const depth = new Map<string, number>();
  let leaf = 0;
  const seen = new Set<string>();
  const place = (id: string, d: number): number => {
    if (seen.has(id)) return x.get(id) ?? 0; // a cycle or a shared child: keep its first place
    seen.add(id);
    depth.set(id, d);
    const c = (kids.get(id) ?? []).filter((k) => !seen.has(k));
    const at = c.length ? c.map((k) => place(k, d + 1)).reduce((a, b) => a + b, 0) / c.length : leaf++;
    x.set(id, at);
    return at;
  };
  for (const r of roots.length ? roots : [nodes[0].id]) place(r, 0);
  for (const n of nodes) if (!seen.has(n.id)) place(n.id, 0);
  const maxD = Math.max(...depth.values(), 1);
  const width = Math.max(leaf - 1, 1);
  const sx = Math.min(2.6, 10 / width);
  const sy = Math.min(2, 5.6 / maxD);
  return new Map(nodes.map((n) => [n.id, [(x.get(n.id)! - (leaf - 1) / 2) * sx, (maxD / 2 - depth.get(n.id)!) * sy, 0] as V3]));
}

/** Spread in space: start on a sphere, then let edges pull and nodes push until it settles. Deterministic. */
function graph(net: Net, nodes: NetNode[]): Map<string, V3> {
  const n = nodes.length;
  const R = Math.min(4.2, 1.6 + n * 0.28);
  const p = nodes.map((node, i) => {
    const y = n > 1 ? 1 - (2 * i) / (n - 1) : 0;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const a = i * 2.39996 + hash01(node.id) * 0.4;
    return [Math.cos(a) * r * R, y * R * 0.75, Math.sin(a) * r * R * 0.7];
  });
  const index = new Map(nodes.map((node, i) => [node.id, i]));
  const links = net.edges.flatMap((e) => (index.has(e.a) && index.has(e.b) && e.a !== e.b ? [[index.get(e.a)!, index.get(e.b)!]] : []));
  const rest = Math.max(1.8, R * 0.75);
  for (let it = 0; it < 120; it++) {
    const f = p.map(() => [0, 0, 0]);
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const d = [p[i][0] - p[j][0], p[i][1] - p[j][1], p[i][2] - p[j][2]];
        const len = Math.max(0.3, Math.hypot(d[0], d[1], d[2]));
        const push = 1.4 / (len * len);
        for (let k = 0; k < 3; k++) (f[i][k] += (d[k] / len) * push), (f[j][k] -= (d[k] / len) * push);
      }
    }
    for (const [i, j] of links) {
      const d = [p[j][0] - p[i][0], p[j][1] - p[i][1], p[j][2] - p[i][2]];
      const len = Math.max(0.01, Math.hypot(d[0], d[1], d[2]));
      const pull = (len - rest) * 0.12;
      for (let k = 0; k < 3; k++) (f[i][k] += (d[k] / len) * pull), (f[j][k] -= (d[k] / len) * pull);
    }
    for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) p[i][k] += Math.max(-0.4, Math.min(0.4, f[i][k])) - p[i][k] * 0.01;
  }
  const c = [0, 1, 2].map((k) => p.reduce((s, q) => s + q[k], 0) / n);
  const far = Math.max(1, ...p.map((q) => Math.hypot(q[0] - c[0], q[1] - c[1], q[2] - c[2])));
  const fit = Math.min(1, 4.6 / far);
  return new Map(nodes.map((node, i) => [node.id, [(p[i][0] - c[0]) * fit, (p[i][1] - c[1]) * fit, (p[i][2] - c[2]) * fit] as V3]));
}
