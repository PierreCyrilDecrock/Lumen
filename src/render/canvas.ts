import { computeViewport, createViewport, type SafeArea, type Viewport } from './viewport';

/**
 * Owns the full-screen canvas: keeps its backing store in sync with the CSS size,
 * the device pixel ratio, screen rotation and mobile safe areas.
 */
export class GameCanvas {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly viewport: Viewport = createViewport();

  /** Canvas position in the page, used to convert client coordinates. */
  private rectLeft = 0;
  private rectTop = 0;
  private dirty = true;
  private readonly safeProbe: HTMLElement;
  private readonly safe: SafeArea = { top: 0, right: 0, bottom: 0, left: 0 };
  private dprQuery: MediaQueryList | null = null;
  private readonly markDirty = (): void => {
    this.dirty = true;
  };

  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D non disponible');
    this.canvas = canvas;
    this.ctx = ctx;

    // Hidden element whose padding resolves env(safe-area-inset-*) to pixels.
    this.safeProbe = document.createElement('div');
    this.safeProbe.className = 'safe-area-probe';
    this.safeProbe.setAttribute('aria-hidden', 'true');
    document.body.appendChild(this.safeProbe);

    new ResizeObserver(this.markDirty).observe(canvas);
    window.addEventListener('resize', this.markDirty);
    window.addEventListener('orientationchange', this.markDirty);
    window.visualViewport?.addEventListener('resize', this.markDirty);
    screen.orientation?.addEventListener('change', this.markDirty);
    this.watchDevicePixelRatio();
    this.syncSize();
  }

  /** Applies a pending resize. Call once at the start of each frame. */
  syncSize(): boolean {
    if (!this.dirty) return false;
    this.dirty = false;

    const rect = this.canvas.getBoundingClientRect();
    this.rectLeft = rect.left;
    this.rectTop = rect.top;
    this.readSafeArea(rect);
    const v = computeViewport(
      this.viewport,
      rect.width,
      rect.height,
      window.devicePixelRatio,
      this.safe,
    );
    if (this.canvas.width !== v.pixelWidth) this.canvas.width = v.pixelWidth;
    if (this.canvas.height !== v.pixelHeight) this.canvas.height = v.pixelHeight;
    return true;
  }

  /** Converts client (page) coordinates to CSS pixels relative to the canvas. */
  clientToCssX(clientX: number): number {
    return clientX - this.rectLeft;
  }

  clientToCssY(clientY: number): number {
    return clientY - this.rectTop;
  }

  /** Resets the transform to device pixels (for full-screen clears). */
  useDeviceSpace(): void {
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  /** Sets the transform so that drawing uses logical board units. */
  useLogicalSpace(): void {
    const v = this.viewport;
    const k = v.dpr * v.scale;
    this.ctx.setTransform(k, 0, 0, k, v.dpr * v.offsetX, v.dpr * v.offsetY);
  }

  /** Safe-area insets that actually overlap the canvas (it may not fill the screen). */
  private readSafeArea(rect: DOMRect): void {
    const style = getComputedStyle(this.safeProbe);
    const top = parseFloat(style.paddingTop) || 0;
    const right = parseFloat(style.paddingRight) || 0;
    const bottom = parseFloat(style.paddingBottom) || 0;
    const left = parseFloat(style.paddingLeft) || 0;
    const root = document.documentElement;
    this.safe.top = Math.max(0, top - rect.top);
    this.safe.left = Math.max(0, left - rect.left);
    this.safe.bottom = Math.max(0, bottom - (root.clientHeight - rect.bottom));
    this.safe.right = Math.max(0, right - (root.clientWidth - rect.right));
  }

  /** Re-arms a media query on each DPR change (zoom, moving to another screen). */
  private watchDevicePixelRatio(): void {
    this.dprQuery?.removeEventListener('change', this.onDprChange);
    this.dprQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    this.dprQuery.addEventListener('change', this.onDprChange);
  }

  private readonly onDprChange = (): void => {
    this.dirty = true;
    this.watchDevicePixelRatio();
  };
}
