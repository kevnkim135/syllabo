import { useEffect, useRef, type ComponentRef, type RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { commands } from '../../core/commands';
import { clamp } from '../../utils/gestureMath';

const HOME = { radius: 9.5, phi: Math.PI / 3, theta: Math.PI / 4 };
const MIN_R = 1.5;
const MAX_R = 60;
const MIN_PHI = 0.05;
const STIFFNESS = 7; // 1/s: higher = snappier easing

/** Shortest signed angular distance from a to b. */
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/**
 * One camera for every input. Commands (buttons, keys, gestures, voice) and the scroll wheel only move a
 * *goal*; each frame the camera eases toward it with a frame-rate independent damped lerp. Mouse drags
 * go through OrbitControls (which has its own damping) and cancel any easing in progress.
 *
 * `rotateAxis` turns the model group (`orient`) about an axis given in view space, so the model follows
 * the axis the finger circles whatever angle the camera is at. Views and reset straighten it again.
 */
export function CameraRig({ resetKey, active, orient, homeRadius = HOME.radius, homePhi = HOME.phi, homeTheta = HOME.theta }: { resetKey: unknown; active: boolean; orient: RefObject<THREE.Group | null>; homeRadius?: number; homePhi?: number; homeTheta?: number }) {
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const camera = useThree((s) => s.camera);
  const dom = useThree((s) => s.gl.domElement);

  const activeRef = useRef(active);
  activeRef.current = active;

  const rig = useRef({
    moving: false,
    mounted: false,
    cur: new THREE.Spherical(),
    goal: new THREE.Spherical(),
    target: new THREE.Vector3(), // goal for the orbit target
    orient: new THREE.Quaternion(), // goal for the model group
  }).current;

  /** Start easing from wherever the camera is now (the mouse may have moved it). */
  const begin = () => {
    const c = controls.current;
    if (!c) return false;
    if (!rig.moving) {
      rig.cur.setFromVector3(camera.position.clone().sub(c.target));
      rig.goal.copy(rig.cur);
      rig.target.copy(c.target);
      rig.moving = true;
    }
    return true;
  };

  const aim = (radius: number, phi: number, theta: number) => {
    rig.goal.radius = radius;
    rig.goal.phi = phi;
    rig.goal.theta = rig.cur.theta + wrap(theta - rig.cur.theta); // turn the short way round
    rig.orient.identity();
  };

  const homeRef = useRef<[number, number, number]>([homeRadius, homePhi, homeTheta]);
  homeRef.current = [homeRadius, homePhi, homeTheta];

  // New model: glide back to the default angle (snap only on the very first frame).
  useEffect(() => {
    if (!begin()) return;
    rig.target.set(0, 0, 0);
    aim(homeRadius, homePhi, homeTheta);
    if (!rig.mounted) {
      rig.mounted = true;
      rig.cur.copy(rig.goal);
      controls.current!.target.set(0, 0, 0);
      camera.position.setFromSpherical(rig.cur);
      controls.current!.update();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey, camera]);

  useEffect(
    () =>
      commands.on((cmd) => {
        if (!activeRef.current) return; // hidden stage ignores gestures/voice/keys
        switch (cmd.type) {
          case 'rotate':
            if (!begin()) return;
            rig.goal.theta -= cmd.dx;
            rig.goal.phi = clamp(rig.goal.phi - cmd.dy, MIN_PHI, Math.PI - MIN_PHI);
            break;
          case 'rotateAxis': {
            const axis = new THREE.Vector3(...cmd.axis);
            if (!Number.isFinite(cmd.angle) || !Number.isFinite(axis.lengthSq()) || axis.lengthSq() < 1e-8) return;
            axis.normalize().applyQuaternion(camera.quaternion); // view space -> world space
            rig.orient.premultiply(new THREE.Quaternion().setFromAxisAngle(axis, cmd.angle)).normalize();
            break;
          }
          case 'zoom':
            if (!begin() || !Number.isFinite(cmd.factor) || cmd.factor <= 0) return;
            rig.goal.radius = clamp(rig.goal.radius * cmd.factor, MIN_R, MAX_R);
            break;
          case 'view':
            if (!begin()) return;
            if (cmd.view === 'top') aim(rig.goal.radius, MIN_PHI, 0);
            if (cmd.view === 'front') aim(rig.goal.radius, Math.PI / 2, 0);
            if (cmd.view === 'side') aim(rig.goal.radius, Math.PI / 2, Math.PI / 2);
            break;
          case 'reset':
            if (!begin()) return;
            rig.target.set(0, 0, 0);
            aim(...homeRef.current); // the current model's home, not the one from when this listener was made
            break;
        }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [camera],
  );

  // Scroll / trackpad pinch zoom goes through the same eased goal instead of OrbitControls' stepped zoom.
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (!activeRef.current || !begin()) return;
      const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      rig.goal.radius = clamp(rig.goal.radius * Math.exp(clamp(delta, -120, 120) * (e.ctrlKey ? 0.01 : 0.0022)), MIN_R, MAX_R);
    };
    dom.addEventListener('wheel', onWheel, { passive: false });
    return () => dom.removeEventListener('wheel', onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dom]);

  useFrame((_, delta) => {
    const k = 1 - Math.exp(-STIFFNESS * Math.min(delta, 0.05));

    const g = orient.current;
    if (g && !g.quaternion.equals(rig.orient)) {
      if (g.quaternion.angleTo(rig.orient) < 1e-3) g.quaternion.copy(rig.orient);
      else g.quaternion.slerp(rig.orient, k);
    }

    const c = controls.current;
    if (!rig.moving || !c) return;
    const { cur, goal } = rig;
    cur.radius += (goal.radius - cur.radius) * k;
    cur.phi += (goal.phi - cur.phi) * k;
    cur.theta += (goal.theta - cur.theta) * k;
    c.target.lerp(rig.target, k);
    const settled =
      Math.abs(goal.radius - cur.radius) < 1e-3 &&
      Math.abs(goal.phi - cur.phi) < 1e-4 &&
      Math.abs(goal.theta - cur.theta) < 1e-4 &&
      c.target.distanceToSquared(rig.target) < 1e-6;
    if (settled) {
      cur.copy(goal);
      c.target.copy(rig.target);
      rig.moving = false;
    }
    camera.position.setFromSpherical(cur).add(c.target);
    c.update();
  });

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      enableZoom={false}
      minDistance={MIN_R}
      maxDistance={MAX_R}
      onStart={() => {
        rig.moving = false; // the hand on the mouse wins
      }}
    />
  );
}

