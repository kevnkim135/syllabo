import { useEffect, useRef } from 'react';

interface Delta {
  hx: number; hy: number; // home position
  x: number; y: number;
  vx: number; vy: number;
  rot: number; spin: number;
  size: number; color: string; alpha: number;
}

const COLORS = ['#D5C2FF', '#D5C2FF', '#D5C2FF', '#B9A0F0', '#8B6BD6']; // purples only, weighted toward the light lilac
const GAP = 58; // px between deltas
const REACH = 140; // cursor repel radius
const TAU = Math.PI * 2;

/** A field of small triangles that scatter away from the cursor and drift back home. */
interface Props {
  clearCenter?: boolean; // keep the middle empty (home page wordmark and input)
  gap?: number; // px between deltas
  faint?: number; // opacity multiplier, for use behind content
  className?: string;
}

export function DeltaField({ clearCenter = true, gap = GAP, faint = 1, className = 'delta-field' }: Props = {}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext('2d')!;
    const mouse = { x: -1e4, y: -1e4 };
    let deltas: Delta[] = [];
    let w = 0;
    let h = 0;
    let raf = 0;

    const build = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      deltas = [];
      for (let gy = gap / 2; gy < h; gy += gap) {
        for (let gx = gap / 2; gx < w; gx += gap) {
          const hx = gx + (Math.random() - 0.5) * gap * 0.8;
          const hy = gy + (Math.random() - 0.5) * gap * 0.8;
          // Keep the middle clear so the wordmark and input stay readable.
          const cx = (hx - w / 2) / 400;
          const cy = (hy - h * 0.44) / 190;
          const clear = clearCenter ? Math.min(1, Math.max(0, (Math.hypot(cx, cy) - 0.85) * 2.5)) : 1;
          if (clear === 0) continue;
          deltas.push({
            hx, hy, x: hx, y: hy, vx: 0, vy: 0,
            rot: Math.random() * TAU, spin: 0,
            size: 3.5 + Math.random() * 4.5,
            color: COLORS[Math.floor(Math.random() * COLORS.length)],
            alpha: (0.35 + Math.random() * 0.5) * clear * faint,
          });
        }
      }
    };

    const tick = () => {
      ctx.clearRect(0, 0, w, h);
      for (const d of deltas) {
        const dx = d.x - mouse.x;
        const dy = d.y - mouse.y;
        const dist = Math.hypot(dx, dy) || 1;
        if (dist < REACH) {
          const push = (1 - dist / REACH) ** 2 * 2.4;
          d.vx += (dx / dist) * push;
          d.vy += (dy / dist) * push;
          d.spin += (dx > 0 ? 1 : -1) * push * 0.03;
        }
        d.vx = (d.vx + (d.hx - d.x) * 0.018) * 0.9; // spring home, damped
        d.vy = (d.vy + (d.hy - d.y) * 0.018) * 0.9;
        d.spin *= 0.95;
        d.x += d.vx;
        d.y += d.vy;
        d.rot += d.spin + 0.0015;

        ctx.save();
        ctx.translate(d.x, d.y);
        ctx.rotate(d.rot);
        ctx.globalAlpha = d.alpha;
        ctx.fillStyle = d.color;
        ctx.beginPath();
        ctx.moveTo(0, -d.size);
        ctx.lineTo(d.size * 0.87, d.size * 0.5);
        ctx.lineTo(-d.size * 0.87, d.size * 0.5);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      raf = requestAnimationFrame(tick);
    };

    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      mouse.x = e.clientX - r.left;
      mouse.y = e.clientY - r.top;
    };
    const onLeave = () => {
      mouse.x = mouse.y = -1e4;
    };

    build();
    tick();
    window.addEventListener('pointermove', onMove);
    document.addEventListener('pointerleave', onLeave);
    const ro = new ResizeObserver(() => build());
    ro.observe(canvas);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerleave', onLeave);
      ro.disconnect();
    };
  }, [clearCenter, gap, faint]);

  return <canvas ref={ref} className={className} aria-hidden />;
}
