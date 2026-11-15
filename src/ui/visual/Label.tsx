import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { plainMath } from '../math/MathText';

/**
 * Text label as a camera-facing sprite drawn to a canvas texture. It stays inside the WebGL scene
 * (no DOM overlay), so it unmounts cleanly and is never clipped by other UI.
 */
export function Label({ text: raw, position = [0, 0, 0], height = 0.32 }: { text: string; position?: [number, number, number]; height?: number }) {
  const text = plainMath(raw); // LaTeX cannot render on a canvas: show v₀², α, 1/2 instead of $v_0^2$
  const { texture, aspect } = useMemo(() => {
    const px = 72; // drawn large and mipmapped, so labels stay sharp when zoomed in
    const pad = 32;
    const c = document.createElement('canvas');
    const ctx = c.getContext('2d')!;
    const font = `600 ${px}px Inter, system-ui, sans-serif`;
    ctx.font = font;
    c.width = Math.ceil(ctx.measureText(text).width) + pad * 2;
    c.height = px + pad * 1.5;
    ctx.font = font; // resizing resets context state
    // Neutral white pill with dark text: scene labels stay readable on any model color.
    ctx.globalAlpha = 0.88;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(1.5, 1.5, c.width - 3, c.height - 3, (c.height - 3) / 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(30, 30, 40, 0.18)';
    ctx.stroke();
    ctx.fillStyle = '#23232d';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, pad, c.height / 2 + 2);
    const texture = new THREE.CanvasTexture(c);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    texture.generateMipmaps = true;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    return { texture, aspect: c.width / c.height };
  }, [text]);

  useEffect(() => () => texture.dispose(), [texture]);

  return (
    <sprite position={position} scale={[height * aspect, height, 1]} renderOrder={10}>
      <spriteMaterial map={texture} transparent depthTest={false} depthWrite={false} />
    </sprite>
  );
}
