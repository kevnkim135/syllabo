// Draws the tracked hands (21 dots + bone lines each) on a canvas laid over the camera preview.
// Landmarks are in RAW image coords (x right, y down, 0..1). The canvas is mirrored with the same CSS
// transform as the <video>, so we draw unmirrored and the two always line up. Text is drawn flipped back
// so the L / R tags stay readable.
import type { TrackedHand } from './gestureEngine';

export interface OverlayColors {
  left: string; // the user's left hand
  right: string; // the user's right hand
  dot: string;
}

/** Palette colors come from the CSS tokens, never raw values. */
export function readOverlayColors(el: Element): OverlayColors {
  const css = getComputedStyle(el);
  const v = (name: string) => css.getPropertyValue(name).trim();
  return { left: v('--violet'), right: v('--lilac-300'), dot: v('--white') };
}

export function drawHands(canvas: HTMLCanvasElement, hands: TrackedHand[], connections: { start: number; end: number }[], colors: OverlayColors) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const { width: w, height: h } = canvas;
  ctx.clearRect(0, 0, w, h);
  const unit = Math.max(1.5, w / 320); // line weight scales with the canvas
  for (const hand of hands) {
    const color = hand.side === 'left' ? colors.left : colors.right;
    ctx.strokeStyle = color;
    ctx.lineWidth = unit * 1.6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (const c of connections) {
      ctx.moveTo(hand.image[c.start].x * w, hand.image[c.start].y * h);
      ctx.lineTo(hand.image[c.end].x * w, hand.image[c.end].y * h);
    }
    ctx.stroke();
    hand.image.forEach((p, i) => {
      const tip = i === 4 || i === 8 || i === 12 || i === 16 || i === 20;
      ctx.beginPath();
      ctx.arc(p.x * w, p.y * h, unit * (tip ? 2.6 : 1.9), 0, Math.PI * 2);
      ctx.fillStyle = tip ? color : colors.dot;
      ctx.fill();
      ctx.lineWidth = unit * 0.8;
      ctx.stroke();
    });
    // L / R tag under the wrist (un-mirror the text)
    const wrist = hand.image[0];
    ctx.save();
    ctx.translate(wrist.x * w, wrist.y * h + unit * 9);
    ctx.scale(-1, 1);
    ctx.font = `700 ${unit * 8}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.lineWidth = unit * 2;
    ctx.strokeStyle = colors.dot;
    ctx.strokeText(hand.side === 'left' ? 'L' : 'R', 0, 0);
    ctx.fillStyle = color;
    ctx.fillText(hand.side === 'left' ? 'L' : 'R', 0, 0);
    ctx.restore();
  }
}
