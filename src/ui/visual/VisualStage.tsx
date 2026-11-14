import { useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import type * as THREE from 'three';
import type { VisualSpec } from '../../../shared/types';
import { useLesson } from '../../core/lesson';
import { AskModel } from './AskModel';
import { CameraRig } from './CameraRig';
import { ControlBar } from './ControlBar';
import { GestureGuide } from './GestureGuide';
import { ModelLayers } from './ModelLayers';

/** The 3D stage. It stays mounted for the whole lesson; `paused` stops rendering and input while hidden. */
export function VisualStage({ spec, paused = false }: { spec: VisualSpec; paused?: boolean }) {
  const { loading, visualRequest } = useLesson();
  const busy = !!loading.visual;
  const orient = useRef<THREE.Group>(null);

  return (
    <div className="stage-layout">
      <div className={`stage${busy ? ' busy' : ''}`} aria-busy={busy}>
        {/* Transparent canvas: the stage background is CSS, so it uses the design tokens. */}
        <Canvas camera={{ position: [6, 5, 6], fov: 50 }} frameloop={paused ? 'never' : 'always'} dpr={[1, 2]}>
          <ambientLight intensity={0.85} />
          <directionalLight position={[5, 10, 5]} intensity={1.3} />
          <directionalLight position={[-6, -2, -4]} intensity={0.35} />
          <group ref={orient}>
            <ModelLayers spec={spec} />
          </group>
          <CameraRig resetKey={spec} active={!paused} orient={orient} />
        </Canvas>

        <div key={spec.title} className="stage-title">
          {spec.title}
        </div>
        {busy && (
          <div className="stage-status" role="status">
            <span className="spinner" />
            {visualRequest ? `Building ${visualRequest}…` : 'Building a new model…'}
          </div>
        )}
        <ControlBar busy={busy} />
        <AskModel busy={busy} />
      </div>
      <GestureGuide />
    </div>
  );
}
