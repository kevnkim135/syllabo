import { useMemo } from 'react';
import { Stars } from '@react-three/drei';
import * as THREE from 'three';

/** A soft round spot that fades to nothing at its edge, so floors have no hard horizon. */
function useRadialFade() {
  return useMemo(() => {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d')!;
    const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.55, '#ffffff');
    grad.addColorStop(1, '#000000');
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(c);
  }, []);
}
import type { SceneKind } from '../../../shared/types';

/**
 * The world around a model: a sky and ground outdoors, stars in space, a lab bench floor for chemistry,
 * a water surface. `plain` keeps the stage's own soft gradient (the canvas stays transparent).
 * `ground` is the y the floor sits at.
 */
export function Environment({ scene = 'plain', ground = -2.2, size = 26 }: { scene?: SceneKind; ground?: number; size?: number }) {
  const fade = useRadialFade();
  switch (scene) {
    case 'space':
      return (
        <>
          <color attach="background" args={['#0a0718']} />
          <fog attach="fog" args={['#0a0718', 30, 90]} />
          <Stars radius={60} depth={40} count={3500} factor={3.2} saturation={0.4} fade speed={0.6} />
        </>
      );
    case 'ground':
      return (
        <>
          <color attach="background" args={['#cfe6f7']} />
          <fog attach="fog" args={['#cfe6f7', 18, 60]} />
          <hemisphereLight args={['#eaf6ff', '#6f8f4e', 0.6]} />
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, ground - 0.02, 0]}>
            <circleGeometry args={[60, 64]} />
            <meshStandardMaterial color="#8fb56a" roughness={1} />
          </mesh>
          <gridHelper args={[40, 40, '#7ca356', '#86ad60']} position={[0, ground, 0]} />
        </>
      );
    case 'water':
      return (
        <>
          <color attach="background" args={['#d6ecf7']} />
          <fog attach="fog" args={['#d6ecf7', 18, 60]} />
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, ground, 0]}>
            <circleGeometry args={[60, 64]} />
            <meshStandardMaterial color="#3d8ec9" roughness={0.15} metalness={0.2} transparent opacity={0.85} />
          </mesh>
        </>
      );
    case 'lab':
      return (
        <>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, ground - 0.02, 0]}>
            <planeGeometry args={[size, size]} />
            <meshStandardMaterial color="#ffffff" roughness={0.9} transparent opacity={0.8} alphaMap={fade} depthWrite={false} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, ground, 0]}>
            <planeGeometry args={[size, size, Math.round(size), Math.round(size)]} />
            <meshBasicMaterial color="#b9a0f0" wireframe transparent opacity={0.35} alphaMap={fade} depthWrite={false} />
          </mesh>
        </>
      );
    default:
      return null;
  }
}
