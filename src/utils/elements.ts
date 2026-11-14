// CPK colors + display radii (scene units, not real radii).
const TABLE: Record<string, { color: string; radius: number }> = {
  H: { color: '#ffffff', radius: 0.25 },
  C: { color: '#505050', radius: 0.4 },
  N: { color: '#3050f8', radius: 0.38 },
  O: { color: '#ff0d0d', radius: 0.36 },
  F: { color: '#90e050', radius: 0.33 },
  Cl: { color: '#1ff01f', radius: 0.45 },
  Br: { color: '#a62929', radius: 0.48 },
  S: { color: '#ffff30', radius: 0.45 },
  P: { color: '#ff8000', radius: 0.45 },
  Na: { color: '#ab5cf2', radius: 0.5 },
  K: { color: '#8f40d4', radius: 0.55 },
  Mg: { color: '#8aff00', radius: 0.48 },
  Ca: { color: '#3dff00', radius: 0.52 },
  Fe: { color: '#e06633', radius: 0.48 },
};

export const element = (symbol: string) => TABLE[symbol] ?? { color: '#ff69b4', radius: 0.4 };
