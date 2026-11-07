/** Colours and sizes from the visual brief, in logical units. */
export const BACKGROUND = '#02030A';
export const CYAN = '#8FEFFF';
export const AMBER = '#FFB84D';
export const TEXT = '#EAF6FF';
export const TEXT_MUTED = '#8A93A6';
export const FONT_FAMILY = '"Space Grotesk", system-ui, sans-serif';

/** Width of the white beam core. Never changed by any setting. */
export const BEAM_CORE_WIDTH = 3;
export const BEAM_CORE_COLOR = '#FFFFFF';
/** Halo tint of white light in air (r, g, b 0-255). */
export const HALO_AIR: readonly [number, number, number] = [150, 205, 255];

export const MIRROR_BODY = '#7D90AA';
export const MIRROR_SHINE = '#F2FBFF';
export const MIRROR_BACK = '#2A3445';
export const MIRROR_WIDTH = 6;

export const WALL_FILL = '#121826';
export const WALL_LINE = '#3E4C63';
export const WALL_THICKNESS = 10;

export const EMITTER_BODY = '#121826';
export const EMITTER_LINE = '#C8D6E5';

/** Transparent blocks: fill, edge and halo tint (r, g, b 0-255) per material. */
export const MEDIUM_STYLE = {
  water: {
    fill: 'rgba(90, 200, 255, 0.10)',
    edge: 'rgba(143, 239, 255, 0.55)',
    halo: [110, 225, 255],
  },
  glass: {
    fill: 'rgba(181, 160, 255, 0.10)',
    edge: 'rgba(200, 185, 255, 0.6)',
    halo: [190, 170, 255],
  },
  diamond: {
    fill: 'rgba(255, 140, 200, 0.10)',
    edge: 'rgba(255, 175, 220, 0.65)',
    halo: [255, 150, 210],
  },
} as const;

/** Thin solid normals at interfaces. */
export const NORMAL_COLOR = 'rgba(234, 246, 255, 0.4)';
