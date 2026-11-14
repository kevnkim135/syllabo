import { useEffect, useRef, type ComponentRef } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { VisualSpec } from '../../../shared/types';
import { commands } from '../../core/commands';
import { clamp } from '../../utils/gestureMath';
import { Molecule } from './Molecule';
import { Surface } from './Surface';
import { Diagram } from './Diagram';
import { ViewPad } from './ViewPad';

export function VisualStage({ spec, paused = false }: { spec: VisualSpec; paused?: boolean }) {
  return (
    <div className="stage-layout">
    <div className="stage">
      <Canvas camera={{ position: [6, 5, 6], fov: 50 }} frameloop={paused ? 'never' : 'always'}>
        <color attach="background" args={['#0b1020']} />
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 10, 5]} intensity={1.2} />
        {spec.kind === 'molecule' && <Molecule spec={spec} />}
        {spec.kind === 'surface' && <Surface spec={spec} />}
        {spec.kind === 'diagram' && <Diagram spec={spec} />}
        <CameraRig specKey={spec.title} active={!paused} />
      </Canvas>
      <div className="stage-title">{spec.title}</div>
      <ViewPad />
    </div>
      <aside className="card guide">
        <h3>Two-hand steering</h3>
        <ol>
          <li>Click <strong>Start gestures</strong> (bottom right) and allow the camera.</li>
          <li>Pinch thumb and index on <strong>both hands</strong>, like gripping a wheel.</li>
          <li><strong>Turn</strong> the wheel to rotate the view left or right.</li>
          <li><strong>Raise or lower</strong> both hands to tilt up or down.</li>
          <li><strong>Spread or close</strong> your hands to zoom.</li>
        </ol>
        <h3>Other controls</h3>
        <ul className="muted">
          <li>One-hand pinch and drag: rotate</li>
          <li>Open-hand swipe: next / previous tab</li>
          <li>Voice: "rotate left", "zoom in", "top view", "reset", "next"</li>
          <li>Keys: arrows, + / -, T F S, R, 1-4</li>
          <li>Mouse: drag to orbit, scroll to zoom</li>
        </ul>
      </aside>
    </div>
  );
}

/** Mouse via OrbitControls; gesture/voice commands move the same camera. */
function CameraRig({ specKey, active }: { specKey: string; active: boolean }) {
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const camera = useThree((s) => s.camera);

  const activeRef = useRef(active);
  activeRef.current = active;

  // New model: start from the default angle.
  useEffect(() => {
    const c = controls.current;
    c?.target.set(0, 0, 0);
    camera.position.setFromSpherical(new THREE.Spherical(9.5, Math.PI / 3, Math.PI / 4));
    c?.update();
  }, [specKey, camera]);

  useEffect(
    () =>
      commands.on((cmd) => {
        const c = controls.current;
        if (!c || !activeRef.current) return; // hidden stage ignores gestures/voice/keys
        const s = new THREE.Spherical().setFromVector3(camera.position.clone().sub(c.target));
        switch (cmd.type) {
          case 'rotate':
            s.theta -= cmd.dx;
            s.phi = clamp(s.phi - cmd.dy, 0.05, Math.PI - 0.05);
            break;
          case 'zoom':
            s.radius = clamp(s.radius * cmd.factor, 1.5, 60);
            break;
          case 'view':
            if (cmd.view === 'top') s.set(s.radius, 0.05, 0);
            if (cmd.view === 'front') s.set(s.radius, Math.PI / 2, 0);
            if (cmd.view === 'side') s.set(s.radius, Math.PI / 2, Math.PI / 2);
            break;
          case 'reset':
            c.target.set(0, 0, 0);
            s.set(9.5, Math.PI / 3, Math.PI / 4);
            break;
          default:
            return;
        }
        camera.position.copy(c.target).add(new THREE.Vector3().setFromSpherical(s));
        c.update();
      }),
    [camera],
  );

  return <OrbitControls ref={controls} makeDefault enableDamping />;
}
