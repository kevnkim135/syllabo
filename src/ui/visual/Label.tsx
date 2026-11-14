import { useEffect, useMemo } from 'react';
import * as THREE from 'three';

/**
 * Text label as a camera-facing sprite drawn to a canvas texture. It stays inside the WebGL scene
 * (no DOM overlay), so it unmounts cleanly and is never clipped by other UI.
 */
export function Label({ text, position = [0, 0, 0], height = 0.32 }: { text: string; position?: [number, number, number]; height?: number }) {
  const { texture, aspect } = useMemo(() => {
    const px = 48;
    const pad = 16;
    const c = document.createElement('canvas');
    const ctx = c.getContext('2d')!;
    const font = `600 ${px}px Inter, system-ui, sans-serif`;
    ctx.font = font;
    c.width = Math.ceil(ctx.measureText(text).width) + pad * 2;
    c.height = px + pad * 1.5;
    ctx.font = font; // resizing resets context state
    ctx.fillStyle = 'rgba(11, 13, 18, 0.82)';
    ctx.beginPath();
    ctx.roundRect(0, 0, c.width, c.height, 12);
    ctx.fill();
    ctx.fillStyle = '#e7e9ee';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, pad, c.height / 2 + 2);
    const texture = new THREE.CanvasTexture(c);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    return { texture, aspect: c.width / c.height };
  }, [text]);

  useEffect(() => () => texture.dispose(), [texture]);

  return (
    <sprite position={position} scale={[height * aspect, height, 1]} renderOrder={10}>
      <spriteMaterial map={texture} transparent depthTest={false} depthWrite={false} />
    </sprite>
  );
}
