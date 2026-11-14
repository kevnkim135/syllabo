import * as THREE from 'three';

// The WebGL scene reads the same design tokens as the CSS (src/ui/styles/tokens.css),
// so the stage never carries a raw color of its own.
const TOKENS = { white: '--white', lilac50: '--lilac-50', lilac200: '--lilac-200', violet: '--violet', forest: '--forest' } as const;
export type Palette = Record<keyof typeof TOKENS, string>;

let cached: Palette | null = null;

export function palette(): Palette {
  if (cached) return cached;
  const css = getComputedStyle(document.documentElement);
  const read = (name: string) => css.getPropertyValue(name).trim() || 'gray';
  const p = Object.fromEntries(Object.entries(TOKENS).map(([k, v]) => [k, read(v)])) as Palette;
  if (Object.values(p).every((v) => v !== 'gray')) cached = p; // only cache once the stylesheet is in
  return p;
}

/** A palette color mixed toward another, e.g. mix('forest', 'white', 0.6). */
export const mix = (a: keyof Palette, b: keyof Palette, t: number) => new THREE.Color(palette()[a]).lerp(new THREE.Color(palette()[b]), t);
