// Hue-shifted ramps: highlights drift toward warm yellow, shadows toward blue-violet.
export function hslToHex(h: number, s: number, l: number): string {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(1, s));
  l = Math.max(0, Math.min(1, l));
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  const to = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

function towards(h: number, target: number, f: number): number {
  const d = ((target - h + 540) % 360) - 180;
  return (h + d * f + 360) % 360;
}

export type Seed = [h: number, s: number, l: number];

/** Light -> mid -> dark. */
export function ramp3(h: number, s: number, l: number): [string, string, string] {
  return [
    hslToHex(towards(h, 55, 0.14), s * 0.9, l + 0.12),
    hslToHex(h, s, l),
    hslToHex(towards(h, 268, 0.14), Math.min(1, s * 0.96), l - 0.22),
  ];
}

/** Two-tone (iris / accents). */
export function ramp2(h: number, s: number, l: number): [string, string] {
  return [hslToHex(towards(h, 55, 0.06), s, l + 0.04), hslToHex(towards(h, 10, 0.1), Math.min(1, s * 0.98), l - 0.2)];
}

// ---- shared neutral/FX colors (creatures + effects) ----
export const C = {
  white: '#f6f3ff',
  ink: '#2b2350', // deepest "black" replacement (blue-violet)
  ink2: '#3d3270',
};
