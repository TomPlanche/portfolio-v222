// Small math and colour helpers shared by the planes simulation and its renderer.
export type Rgb = [number, number, number];

export const TAU = Math.PI * 2;

export const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

export const rand = (lo: number, hi: number) => lo + Math.random() * (hi - lo);

export const smoothstep = (e0: number, e1: number, x: number) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);

  return t * t * (3 - 2 * t);
};

/** Deterministic integer hash to [0, 1), so textures stay pinned to the body. */
export const hash3 = (x: number, y: number, z: number) => {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;

  return (h >>> 0) / 4294967296;
};

export const packRgb = (c: Rgb) => (c[0] << 16) | (c[1] << 8) | c[2];

export const mix = (a: Rgb, b: Rgb, k: number): Rgb => [
  (a[0] + (b[0] - a[0]) * k) | 0,
  (a[1] + (b[1] - a[1]) * k) | 0,
  (a[2] + (b[2] - a[2]) * k) | 0
];

export const shade = (c: Rgb, k: number): Rgb => [
  Math.min(255, c[0] * k) | 0,
  Math.min(255, c[1] * k) | 0,
  Math.min(255, c[2] * k) | 0
];

/** A line glyph that follows a direction in screen space, for wing edges, contrails and rings. */
export const lineGlyph = (dx: number, dy: number) => {
  const d = Math.hypot(dx, dy) || 1;

  if (Math.abs(dy) < 0.38 * d) {
    return '-';
  }

  if (Math.abs(dx) < 0.38 * d) {
    return '|';
  }

  return dx * dy > 0 ? '\\' : '/';
};
