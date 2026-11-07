/** Fixed logical board size, shared by every device. Levels use these coordinates. */
export const LOGICAL_WIDTH = 390;
export const LOGICAL_HEIGHT = 560;

/** Device pixel ratio cap: beyond 2 the extra pixels cost fill rate for little gain. */
export const MAX_DPR = 2;

export interface SafeArea {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** Mapping between CSS pixels, backing-store pixels and logical units. */
export interface Viewport {
  /** Canvas size in CSS pixels. */
  cssWidth: number;
  cssHeight: number;
  /** Effective device pixel ratio (capped). */
  dpr: number;
  /** Canvas backing-store size in device pixels. */
  pixelWidth: number;
  pixelHeight: number;
  /** CSS pixels per logical unit. */
  scale: number;
  /** Top-left corner of the logical board, in CSS pixels from the canvas origin. */
  offsetX: number;
  offsetY: number;
}

export function createViewport(): Viewport {
  return {
    cssWidth: 0,
    cssHeight: 0,
    dpr: 1,
    pixelWidth: 0,
    pixelHeight: 0,
    scale: 1,
    offsetX: 0,
    offsetY: 0,
  };
}

/**
 * Fits the logical board inside the safe area of the canvas, keeping its aspect ratio
 * (letterboxing), and writes the result into `out`.
 */
export function computeViewport(
  out: Viewport,
  cssWidth: number,
  cssHeight: number,
  devicePixelRatio: number,
  safe: SafeArea,
  logicalWidth = LOGICAL_WIDTH,
  logicalHeight = LOGICAL_HEIGHT,
): Viewport {
  const dpr = Math.min(Math.max(devicePixelRatio || 1, 1), MAX_DPR);
  const availWidth = Math.max(cssWidth - safe.left - safe.right, 1);
  const availHeight = Math.max(cssHeight - safe.top - safe.bottom, 1);
  const scale = Math.min(availWidth / logicalWidth, availHeight / logicalHeight);

  out.cssWidth = cssWidth;
  out.cssHeight = cssHeight;
  out.dpr = dpr;
  out.pixelWidth = Math.max(Math.round(cssWidth * dpr), 1);
  out.pixelHeight = Math.max(Math.round(cssHeight * dpr), 1);
  out.scale = scale;
  out.offsetX = safe.left + (availWidth - logicalWidth * scale) / 2;
  out.offsetY = safe.top + (availHeight - logicalHeight * scale) / 2;
  return out;
}

/** Converts a point in CSS pixels (relative to the canvas) to logical units. */
export function cssToLogicalX(v: Viewport, cssX: number): number {
  return (cssX - v.offsetX) / v.scale;
}

export function cssToLogicalY(v: Viewport, cssY: number): number {
  return (cssY - v.offsetY) / v.scale;
}

/** True when a logical point lies on the board. */
export function isOnBoard(x: number, y: number): boolean {
  return x >= 0 && x <= LOGICAL_WIDTH && y >= 0 && y <= LOGICAL_HEIGHT;
}
