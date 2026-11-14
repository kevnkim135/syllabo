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

export function VisualStage({ spec }: { spec: VisualSpec }) {
  return (
    <div className="stage">
      <Canvas camera={{ position: [6, 5, 6], fov: 50 }}>
        <color attach="background" args={['#0b1020']} />
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 10, 5]} intensity={1.2} />
        {spec.kind === 'molecule' && <Molecule spec={spec} />}
        {spec.kind === 'surface' && <Surface spec={spec} />}
        {spec.kind === 'diagram' && <Diagram spec={spec} />}
        <CameraRig />
      </Canvas>
      <div className="stage-title">{spec.title}</div>
    </div>
  );
}

/** Mouse via OrbitControls; gesture/voice commands move the same camera. */
function CameraRig() {
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const camera = useThree((s) => s.camera);

  useEffect(
    () =>
      commands.on((cmd) => {
        const c = controls.current;
        if (!c) return;
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
