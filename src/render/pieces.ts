import type { Emitter, Mirror, Target, Wall } from '../engine';
import { DEG_TO_RAD } from '../engine';
import {
  AMBER,
  EMITTER_BODY,
  EMITTER_LINE,
  MIRROR_BACK,
  MIRROR_BODY,
  MIRROR_SHINE,
  MIRROR_WIDTH,
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

export function drawMirror(ctx: CanvasRenderingContext2D, mirror: Mirror): void {
  const half = mirror.length / 2;
  ctx.save();
  ctx.translate(mirror.x, mirror.y);
  ctx.rotate(mirror.angle * DEG_TO_RAD);
  ctx.lineCap = 'round';
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
