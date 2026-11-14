import { useEffect, useRef } from 'react';

interface Stream {
  off: number; // home offset from the centre line, px
  amp: number; // drift amplitude
  phase: number;
  alpha: number;
  color: string;
  dash: number;
  speed: number;
  side: number; // eased -1..1: which side of the cursor this line passes on
}

const PER_SIDE = 9;
const STEP = 14; // px between sample points along a line
const RADIUS = 78; // how far the lines part around the cursor
const TAU = Math.PI * 2;

/**
 * Faint streamlines flowing down either side of the timeline. They part around the cursor like air
 * around an obstacle and close again behind it. The canvas is sticky (one viewport tall), so the
 * lines are drawn procedurally and offset by the scroll position to feel attached to the page.
 */
export function AirflowField() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext('2d')!;
    const scroller = (canvas.closest('.content') as HTMLElement | null) ?? document.documentElement;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const css = getComputedStyle(canvas);
    const token = (name: string) => css.getPropertyValue(name).trim();
    const palette = [token('--lilac-200'), token('--violet'), token('--lilac-200'), token('--forest')];

    const streams: Stream[] = [];
    for (const dir of [-1, 1]) {
      for (let k = 0; k < PER_SIDE; k++) {
        const color = palette[(k + (dir > 0 ? 1 : 0)) % palette.length];
        const fade = (1 - k / PER_SIDE) ** 1.3;
        streams.push({
          off: dir * (18 + k * 24 + k * k * 2.4),
          amp: 3 + k * 1.7,
          phase: Math.random() * TAU,
          alpha: (color === palette[0] ? 0.75 : 0.26) * fade + 0.05,
          color,
          dash: 70 + Math.random() * 60,
          speed: 26 + Math.random() * 22,
          side: dir,
        });
      }
    }

    const target = { x: 0, y: 0, on: false };
    const mouse = { x: 0, y: 0, power: 0 };
    let w = 0;
    let h = 0;
    let raf = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = scroller.clientHeight;
      canvas.style.height = `${h}px`;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    };

    const tick = (now: number) => {
      const t = still ? 0 : now / 1000;
      const scroll = scroller.scrollTop;
      const cx = w / 2;
      mouse.x += (target.x - mouse.x) * 0.16;
      mouse.y += (target.y - mouse.y) * 0.16;
      mouse.power += ((target.on ? 1 : 0) - mouse.power) * 0.07;
      ctx.clearRect(0, 0, w, h);

      for (const s of streams) {
        const home = cx + s.off;
        s.side += ((home >= mouse.x ? 1 : -1) - s.side) * 0.12;
        ctx.beginPath();
        let px = 0;
        let py = 0;
        for (let y = -STEP * 2, i = 0; y <= h + STEP * 2; y += STEP, i++) {
          const page = y + scroll;
          let x = home + Math.sin(page * 0.0058 + s.phase + t * 0.45) * s.amp + Math.sin(page * 0.0019 - t * 0.22 + s.phase * 1.7) * s.amp * 0.8;
          if (mouse.power > 0.01) {
            const dy = y - mouse.y;
            const spread = dy > 0 ? 150 : 80; // longer wake downstream
            const g = mouse.power * Math.exp(-(dy * dy) / (2 * spread * spread));
            const d = x - mouse.x;
            x += s.side * (Math.sqrt(d * d + RADIUS * RADIUS * g) - Math.abs(d));
          }
          if (i === 0) ctx.moveTo(x, y);
          else ctx.quadraticCurveTo(px, py, (px + x) / 2, (py + y) / 2);
          px = x;
          py = y;
        }
        ctx.strokeStyle = s.color;
        ctx.lineWidth = 1.25;
        // A continuous hairline plus brighter dashes that travel downward: the "flow".
        ctx.setLineDash([]);
        ctx.globalAlpha = s.alpha * 0.45;
        ctx.stroke();
        ctx.setLineDash([s.dash, s.dash * 1.6]);
        ctx.lineDashOffset = -(t * s.speed + scroll + s.phase * 40);
        ctx.globalAlpha = s.alpha;
        ctx.stroke();
      }
      raf = requestAnimationFrame(tick);
    };

    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      target.x = e.clientX - r.left;
      target.y = e.clientY - r.top;
      const inside = target.x >= 0 && target.x <= r.width && target.y >= 0 && target.y <= r.height;
      if (inside && !target.on) {
        mouse.x = target.x; // arrive in place instead of sweeping in from the last position
        mouse.y = target.y;
      }
      target.on = inside;
    };
    const onLeave = () => {
      target.on = false;
    };

    resize();
    raf = requestAnimationFrame(tick);
    const observer = new ResizeObserver(resize);
    observer.observe(scroller);
    observer.observe(canvas.parentElement!);
    window.addEventListener('pointermove', onMove);
    document.addEventListener('pointerleave', onLeave);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerleave', onLeave);
    };
  }, []);

  return (
    <div className="h-air" aria-hidden>
      <canvas ref={ref} />
    </div>
  );
}
