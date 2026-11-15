import { useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import type * as THREE from 'three';
import type { VisualSpec } from '../../../shared/types';
import { lesson, useLesson } from '../../core/lesson';
import { GESTURE } from '../../core/input/gestureEngine';
import { AskModel } from './AskModel';
import { CameraRig } from './CameraRig';
import { ControlBar } from './ControlBar';
import { GestureGuide } from './GestureGuide';
import { Environment } from './Environment';
import { ModelGallery } from './ModelGallery';
import { ModelLayers } from './ModelLayers';
import { SandboxPanel } from './SandboxPanel';
import { AnatomyPanel } from './anatomy/AnatomyPanel';
import { SandboxScene } from './SandboxScene';

/** The 3D stage. It stays mounted for the whole lesson; `paused` stops rendering and input while hidden. */
export function VisualStage({ spec, paused = false }: { spec: VisualSpec | null; paused?: boolean }) {
  const { loading, visualRequest, stageMode, sandbox } = useLesson();
  const box = stageMode === 'sandbox';
  const busy = box ? !!sandbox.busy : !!loading.visual;
  const orient = useRef<THREE.Group>(null);
  // In the sandbox, pointing and pinching only select, carry and rotate: no hold-zoom poses, no twirl.
  useEffect(() => {
    GESTURE.directManipulation = box && !paused;
    return () => {
      GESTURE.directManipulation = false;
    };
  }, [box, paused]);
  const scene = box ? 'lab' : (spec?.scene ?? (spec?.kind === 'molecule' ? 'lab' : 'plain'));

  return (
    <div className="stage-layout">
      <div className={`stage${busy && !box ? ' busy' : ''}`} aria-busy={busy}>
        {/* Transparent canvas unless the scene paints its own sky; the stage background is CSS. */}
        <Canvas
          camera={{ position: [6, 5, 6], fov: 50 }}
          frameloop={paused ? 'never' : 'always'}
          dpr={[1, 2]}
          onPointerMissed={() => box && lesson.sandboxSelect([], 'set')}
        >
          <ambientLight intensity={0.85} />
          <directionalLight position={[5, 10, 5]} intensity={1.3} />
          <directionalLight position={[-6, -2, -4]} intensity={0.35} />
          <Environment scene={scene} ground={!box && spec?.kind === 'diagram' ? (spec.ground ?? -2.6) : -2.6} size={box ? 60 : 26} />
          {box ? (
            <SandboxScene />
          ) : (
            <group ref={orient}>{spec && <ModelLayers spec={spec} />}</group>
          )}
          <CameraRig resetKey={box ? 'sandbox' : spec} active={!paused} orient={orient} homeRadius={box ? 15 : undefined} />
        </Canvas>

        <div key={box ? 'sandbox' : spec?.title} className="stage-title">
          {box ? 'Sandbox' : spec?.title}
        </div>
        <div className="stage-mode" role="group" aria-label="Stage">
          <button className={!box ? 'on' : ''} aria-pressed={!box} onClick={() => lesson.setStageMode('models')}>
            Models
          </button>
          <button className={box ? 'on' : ''} aria-pressed={box} onClick={() => lesson.setStageMode('sandbox')}>
            Sandbox
          </button>
        </div>
        {busy && (
          <div className="stage-status" role="status">
            <span className="spinner" />
            {box ? (sandbox.busy === 'react' ? 'Running the reaction…' : 'Building the molecule…') : visualRequest ? `Building ${visualRequest}…` : 'Building a new model…'}
          </div>
        )}
        {!box && <ModelGallery />}
        <ControlBar busy={busy && !box} />
        {!box && <AskModel busy={busy} />}
      </div>
      {box ? (
        <SandboxPanel />
      ) : spec?.kind === 'anatomy' ? (
        <div className="side-stack">
          <AnatomyPanel spec={spec} />
          <GestureGuide />
        </div>
      ) : (
        <GestureGuide />
      )}
    </div>
  );
}
