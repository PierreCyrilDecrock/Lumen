import type { ColorName } from '../engine';

/**
 * Colour-blind mode: every colour also gets a shape, so that no information
 * relies on hue alone.
 */
export const COLOR_SYMBOLS: Record<ColorName, string> = {
  red: 'circle',
  orange: 'square',
  yellow: 'triangle',
  green: 'diamond',
  blue: 'plus',
  violet: 'star',
  cyan: 'hexagon',
  magenta: 'cross',
  white: 'ring',
};

/** Text glyphs for the same shapes, for the HUD. */
export const COLOR_GLYPHS: Record<ColorName, string> = {
  red: '●',
  orange: '■',
  yellow: '▲',
  green: '◆',
  blue: '✚',
  violet: '★',
  cyan: '⬢',
  magenta: '✖',
  white: '○',
};

/** Spectrum band index to colour name. */
export const BAND_COLORS: readonly ColorName[] = [
  'red',
  'orange',
  'yellow',
  'green',
  'blue',
  'violet',
];

/** Draws the symbol of `color` centred on (x, y), `r` in radius, filled with `fill`. */
export function drawColorSymbol(
  ctx: CanvasRenderingContext2D,
  color: ColorName,
  x: number,
  y: number,
  r: number,
  fill: string,
): void {
  const shape = COLOR_SYMBOLS[color];
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = fill;
  ctx.strokeStyle = fill;
  ctx.lineWidth = r * 0.45;
  ctx.lineCap = 'round';
  ctx.beginPath();
  switch (shape) {
    case 'circle':
      ctx.arc(0, 0, r * 0.75, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'square':
      ctx.fillRect(-r * 0.68, -r * 0.68, r * 1.36, r * 1.36);
      break;
    case 'triangle':
      ctx.moveTo(0, -r * 0.9);
      ctx.lineTo(r * 0.85, r * 0.65);
      ctx.lineTo(-r * 0.85, r * 0.65);
      ctx.closePath();
      ctx.fill();
      break;
    case 'diamond':
      ctx.moveTo(0, -r);
      ctx.lineTo(r * 0.75, 0);
      ctx.lineTo(0, r);
      ctx.lineTo(-r * 0.75, 0);
      ctx.closePath();
      ctx.fill();
      break;
    case 'plus':
      ctx.moveTo(-r * 0.8, 0);
      ctx.lineTo(r * 0.8, 0);
      ctx.moveTo(0, -r * 0.8);
      ctx.lineTo(0, r * 0.8);
      ctx.stroke();
      break;
    case 'cross':
      ctx.moveTo(-r * 0.6, -r * 0.6);
      ctx.lineTo(r * 0.6, r * 0.6);
      ctx.moveTo(r * 0.6, -r * 0.6);
      ctx.lineTo(-r * 0.6, r * 0.6);
      ctx.stroke();
      break;
    case 'star':
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const rr = i % 2 === 0 ? r : r * 0.45;
        if (i === 0) ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
        else ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.closePath();
      ctx.fill();
      break;
    case 'hexagon':
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3;
        if (i === 0) ctx.moveTo(Math.cos(a) * r * 0.85, Math.sin(a) * r * 0.85);
        else ctx.lineTo(Math.cos(a) * r * 0.85, Math.sin(a) * r * 0.85);
      }
      ctx.closePath();
      ctx.fill();
      break;
    default:
      ctx.lineWidth = r * 0.3;
      ctx.arc(0, 0, r * 0.65, 0, Math.PI * 2);
      ctx.stroke();
  }
  ctx.restore();
}
