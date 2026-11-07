import {
  COLOR_HEX,
  SPECTRUM,
  type ColorTarget,
  type Crystal,
  type Diffuser,
  type Emitter,
  type Filter,
  type Medium,
  type Mirror,
  type Prism,
  type Target,
  type Wall,
} from '../engine';
import { DEG_TO_RAD } from '../engine';
import {
  AMBER,
  CRYSTAL_DIM,
  CRYSTAL_LIT,
  CYAN,
  DIFFUSER_EDGE,
  DIFFUSER_FILL,
  DIFFUSER_WIDTH,
  EMITTER_BODY,
  EMITTER_LINE,
  MEDIUM_STYLE,
  MIRROR_BACK,
  MIRROR_BODY,
  MIRROR_SHINE,
  MIRROR_WIDTH,
  PRISM_EDGE,
  PRISM_FILL,
  WALL_FILL,
  WALL_LINE,
  WALL_THICKNESS,
} from './theme';

/** Piece drawing in logical units. No allocation: canvas state only. */

export function drawWall(ctx: CanvasRenderingContext2D, wall: Wall): void {
  const half = wall.length / 2;
  const t = WALL_THICKNESS;
  ctx.save();
  ctx.translate(wall.x, wall.y);
  ctx.rotate(wall.angle * DEG_TO_RAD);
  ctx.beginPath();
  ctx.rect(-half, -t / 2, wall.length, t);
  ctx.fillStyle = WALL_FILL;
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.beginPath();
  for (let x = -half - t; x < half + t; x += 6) {
    ctx.moveTo(x, t / 2);
    ctx.lineTo(x + t, -t / 2);
  }
  ctx.strokeStyle = WALL_LINE;
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = WALL_LINE;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(-half, -t / 2, wall.length, t);
  ctx.restore();
}

/**
 * @param scale Drop bounce (1 = rest).
 * @param selected Draws a cyan underlay.
 */
export function drawMirror(
  ctx: CanvasRenderingContext2D,
  mirror: Mirror,
  scale = 1,
  selected = false,
): void {
  const half = mirror.length / 2;
  ctx.save();
  ctx.translate(mirror.x, mirror.y);
  ctx.rotate(mirror.angle * DEG_TO_RAD);
  if (scale !== 1) ctx.scale(scale, scale);
  ctx.lineCap = 'round';
  if (selected) {
    ctx.beginPath();
    ctx.moveTo(-half, 0);
    ctx.lineTo(half, 0);
    ctx.strokeStyle = CYAN;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = MIRROR_WIDTH + 6;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  // Local frame: the mirror lies on the x axis, its front faces +y.
  if (mirror.doubleSided === false) {
    ctx.beginPath();
    ctx.moveTo(-half, -2.5);
    ctx.lineTo(half, -2.5);
    ctx.strokeStyle = MIRROR_BACK;
    ctx.lineWidth = 4;
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(-half, 0);
  ctx.lineTo(half, 0);
  ctx.strokeStyle = MIRROR_BODY;
  ctx.lineWidth = MIRROR_WIDTH;
  ctx.stroke();
  // Shine: a thin bright line, slightly towards the reflecting face.
  const shineOffset = mirror.doubleSided === false ? 1 : 0;
  ctx.beginPath();
  ctx.moveTo(-half + 2, shineOffset);
  ctx.lineTo(half - 2, shineOffset);
  ctx.strokeStyle = MIRROR_SHINE;
  ctx.lineWidth = 1.6;
  ctx.stroke();
  // Movable mirrors carry a small grip ring at their centre.
  if (mirror.movable === true) {
    ctx.beginPath();
    ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = EMITTER_BODY;
    ctx.fill();
    ctx.strokeStyle = CYAN;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  ctx.restore();
}

export function drawEmitter(ctx: CanvasRenderingContext2D, emitter: Emitter): void {
  ctx.save();
  ctx.translate(emitter.x, emitter.y);
  ctx.rotate(emitter.angle * DEG_TO_RAD);
  ctx.beginPath();
  ctx.roundRect(-16, -9, 22, 18, 5);
  ctx.fillStyle = EMITTER_BODY;
  ctx.fill();
  ctx.strokeStyle = EMITTER_LINE;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // Aperture.
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(4, -3.5, 3, 7);
  ctx.restore();
}

/** Target body (ring and core); its glow belongs to the light layer. */
export function drawTarget(ctx: CanvasRenderingContext2D, target: Target, lit: boolean): void {
  ctx.beginPath();
  ctx.arc(target.x, target.y, target.radius, 0, Math.PI * 2);
  ctx.fillStyle = '#140E05';
  ctx.fill();
  ctx.strokeStyle = AMBER;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(target.x, target.y, target.radius * (lit ? 0.55 : 0.32), 0, Math.PI * 2);
  ctx.globalAlpha = lit ? 1 : 0.4;
  ctx.fillStyle = AMBER;
  ctx.fill();
  ctx.globalAlpha = 1;
}

/** Transparent block: tinted fill, light edge, subtle inner sheen. */
export function drawMedium(
  ctx: CanvasRenderingContext2D,
  medium: Medium,
  scale = 1,
  selected = false,
): void {
  if (medium.stored === true) return;
  const style = MEDIUM_STYLE[medium.material];
  const w = medium.width;
  const h = medium.height;
  ctx.save();
  ctx.translate(medium.x, medium.y);
  ctx.rotate(medium.angle * DEG_TO_RAD);
  if (scale !== 1) ctx.scale(scale, scale);
  ctx.beginPath();
  ctx.rect(-w / 2, -h / 2, w, h);
  ctx.fillStyle = style.fill;
  ctx.fill();
  ctx.lineWidth = selected ? 2.5 : 1.5;
  ctx.strokeStyle = selected ? CYAN : style.edge;
  ctx.stroke();
  // Sheen along one edge, to read as glass rather than a flat area.
  ctx.beginPath();
  ctx.moveTo(-w / 2 + 4, -h / 2 + 4);
  ctx.lineTo(w / 2 - 4, -h / 2 + 4);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
  ctx.lineWidth = 1;
  ctx.stroke();
  if (medium.movable === true || medium.trayable === true) {
    ctx.beginPath();
    ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
    ctx.strokeStyle = CYAN;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  ctx.restore();
}

/** Frosted glass plate: pale translucent bar with a speckled surface. */
export function drawDiffuser(
  ctx: CanvasRenderingContext2D,
  d: Diffuser,
  scale = 1,
  selected = false,
): void {
  const half = d.length / 2;
  const w = DIFFUSER_WIDTH;
  ctx.save();
  ctx.translate(d.x, d.y);
  ctx.rotate(d.angle * DEG_TO_RAD);
  if (scale !== 1) ctx.scale(scale, scale);
  ctx.beginPath();
  ctx.roundRect(-half, -w / 2, d.length, w, 2);
  ctx.fillStyle = DIFFUSER_FILL;
  ctx.fill();
  ctx.lineWidth = selected ? 2 : 1;
  ctx.strokeStyle = selected ? CYAN : DIFFUSER_EDGE;
  ctx.stroke();
  // Speckles: a fixed, deterministic pattern of tiny dots.
  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
  for (let i = 0; i < 9; i++) {
    const x = -half + 3 + (((i * 37) % 97) / 97) * (d.length - 6);
    const y = (((i * 53) % 29) / 29 - 0.5) * (w - 3);
    ctx.fillRect(x, y, 1.2, 1.2);
  }
  if (d.movable === true) {
    ctx.beginPath();
    ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = EMITTER_BODY;
    ctx.fill();
    ctx.strokeStyle = CYAN;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  ctx.restore();
}

/** Crystal: a diamond-shaped gem whose fill grows with the light it gathers. */
export function drawCrystal(ctx: CanvasRenderingContext2D, c: Crystal, progress: number): void {
  const rx = c.radius * 0.85;
  const ry = c.radius * 1.25;
  ctx.beginPath();
  ctx.moveTo(c.x, c.y - ry);
  ctx.lineTo(c.x + rx, c.y);
  ctx.lineTo(c.x, c.y + ry);
  ctx.lineTo(c.x - rx, c.y);
  ctx.closePath();
  ctx.fillStyle = '#0B1220';
  ctx.fill();
  if (progress > 0) {
    const [r, g, b] = CRYSTAL_LIT;
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${(0.15 + 0.85 * progress).toFixed(2)})`;
    ctx.fill();
  }
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = progress >= 1 ? '#FFFFFF' : CRYSTAL_DIM;
  ctx.stroke();
  // Facet line.
  ctx.beginPath();
  ctx.moveTo(c.x - rx, c.y);
  ctx.lineTo(c.x + rx, c.y);
  ctx.lineWidth = 1;
  ctx.strokeStyle = progress >= 1 ? 'rgba(2, 3, 10, 0.35)' : 'rgba(94, 108, 133, 0.6)';
  ctx.stroke();
}

/** Prism: a discreet glass triangle with a light rim. */
export function drawPrism(
  ctx: CanvasRenderingContext2D,
  p: Prism,
  scale = 1,
  selected = false,
): void {
  const r = p.size / Math.sqrt(3);
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle * DEG_TO_RAD);
  if (scale !== 1) ctx.scale(scale, scale);
  ctx.beginPath();
  for (let i = 0; i < 3; i++) {
    const a = ((-90 + i * 120) * Math.PI) / 180;
    if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fillStyle = PRISM_FILL;
  ctx.fill();
  ctx.lineJoin = 'round';
  ctx.lineWidth = selected ? 2.5 : 1.5;
  ctx.strokeStyle = selected ? CYAN : PRISM_EDGE;
  ctx.stroke();
  if (p.movable === true) {
    ctx.beginPath();
    ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
    ctx.strokeStyle = CYAN;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  ctx.restore();
}

/** Colour filter: a thin plate striped with the colours it lets through. */
export function drawFilter(
  ctx: CanvasRenderingContext2D,
  f: Filter,
  scale = 1,
  selected = false,
): void {
  const half = f.length / 2;
  const w = MIRROR_WIDTH;
  ctx.save();
  ctx.translate(f.x, f.y);
  ctx.rotate(f.angle * DEG_TO_RAD);
  if (scale !== 1) ctx.scale(scale, scale);
  const step = f.length / Math.max(1, f.bands.length);
  ctx.globalAlpha = 0.85;
  for (let i = 0; i < f.bands.length; i++) {
    ctx.fillStyle = SPECTRUM[f.bands[i]!]?.hex ?? '#FFFFFF';
    ctx.fillRect(-half + i * step, -w / 2, step, w);
  }
  ctx.globalAlpha = 1;
  ctx.lineWidth = selected ? 2 : 1;
  ctx.strokeStyle = selected ? CYAN : 'rgba(255, 255, 255, 0.6)';
  ctx.strokeRect(-half, -w / 2, f.length, w);
  ctx.restore();
}

/**
 * Colour target: a ring in the colour it needs, and a core showing the colour
 * it currently receives (full when lit).
 */
export function drawColorTarget(
  ctx: CanvasRenderingContext2D,
  t: ColorTarget,
  lit: boolean,
  receivedCss: string | null,
): void {
  const hex = COLOR_HEX[t.color];
  ctx.beginPath();
  ctx.arc(t.x, t.y, t.radius, 0, Math.PI * 2);
  ctx.fillStyle = '#0B0F1A';
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = hex;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(t.x, t.y, t.radius * (lit ? 0.6 : 0.38), 0, Math.PI * 2);
  ctx.fillStyle = lit ? hex : (receivedCss ?? 'rgba(138, 147, 166, 0.35)');
  ctx.fill();
}
