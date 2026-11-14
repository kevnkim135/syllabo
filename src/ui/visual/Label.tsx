import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { palette } from './palette';

/**
 * Text label as a camera-facing sprite drawn to a canvas texture. It stays inside the WebGL scene
 * (no DOM overlay), so it unmounts cleanly and is never clipped by other UI.
 */
export function Label({ text, position = [0, 0, 0], height = 0.32 }: { text: string; position?: [number, number, number]; height?: number }) {
  const { texture, aspect } = useMemo(() => {
    const px = 48;
    const pad = 22;
    const c = document.createElement('canvas');
    const ctx = c.getContext('2d')!;
    const font = `600 ${px}px Inter, system-ui, sans-serif`;
    ctx.font = font;
    c.width = Math.ceil(ctx.measureText(text).width) + pad * 2;
    c.height = px + pad * 1.5;
    ctx.font = font; // resizing resets context state
    const p = palette();
    // A soft white pill with a hairline, like the DOM chips around the stage.
    ctx.globalAlpha = 0.88;
    ctx.fillStyle = p.white;
    ctx.beginPath();
    ctx.roundRect(1.5, 1.5, c.width - 3, c.height - 3, (c.height - 3) / 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.lineWidth = 2;
    ctx.strokeStyle = p.lilac200;
    ctx.stroke();
    ctx.fillStyle = p.forest;
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
