/** Pre-rendered glow sprites, created once and drawn with drawImage. */

const SPRITE = 128;

function makeCanvas(
  width: number,
  height: number,
): {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
} {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D non disponible');
  return { canvas, ctx };
}

const rgba = (c: readonly number[], a: number): string => `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${a})`;

/**
 * Impact flash: radial glow plus a thin horizontal streak.
 * The sprite is twice as wide as tall; draw it at (x - 2s, y - s, 4s, 2s).
 */
export function makeImpactSprite(color: readonly number[]): HTMLCanvasElement {
  const w = SPRITE * 2;
  const h = SPRITE;
  const { canvas, ctx } = makeCanvas(w, h);
  ctx.globalCompositeOperation = 'lighter';

  const r = h / 2;
  const glow = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, r);
  glow.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
  glow.addColorStop(0.12, rgba(color, 0.7));
  glow.addColorStop(0.45, rgba(color, 0.16));
  glow.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);

  const squash = 0.05;
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.scale(1, squash);
  const streak = ctx.createRadialGradient(0, 0, 0, 0, 0, w / 2);
  streak.addColorStop(0, 'rgba(255, 255, 255, 0.75)');
  streak.addColorStop(0.35, rgba(color, 0.22));
  streak.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = streak;
  ctx.fillRect(-w / 2, -h / 2 / squash, w, h / squash);
  ctx.restore();
  return canvas;
}

/** Soft round glow; draw it at (x - s, y - s, 2s, 2s). */
export function makeGlowSprite(color: readonly number[]): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(SPRITE, SPRITE);
  const r = SPRITE / 2;
  const g = ctx.createRadialGradient(r, r, 0, r, r, r);
  g.addColorStop(0, rgba(color, 0.55));
  g.addColorStop(0.35, rgba(color, 0.2));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, SPRITE, SPRITE);
  return canvas;
}
