// CONCEPT sketches only (procedural): used for regions that have no real art yet, always labelled "Concept".
// Procedural pixel art. Everything here is generated in code at low native resolution and
// scaled up with image-rendering: pixelated. No external images, no third-party designs.
export type Ctx = CanvasRenderingContext2D;
type Rng = () => number;

export const REGION_W = 192;
export const REGION_H = 108;

export function mulberry(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ------------------------------------------------------------------ toolkit
const px = (c: Ctx, x: number, y: number, w: number, h: number, col: string) => {
  c.fillStyle = col;
  c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
};

function hex(col: string): [number, number, number] {
  const n = parseInt(col.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hex(a);
  const [r2, g2, b2] = hex(b);
  const m = (u: number, v: number) => Math.round(u + (v - u) * t);
  return `rgb(${m(r1, r2)},${m(g1, g2)},${m(b1, b2)})`;
}

/** Vertical banded gradient with a 2-row checker dither at each band edge (16-bit look). */
function sky(c: Ctx, w: number, y0: number, y1: number, stops: string[], bands = 9): void {
  const n = bands;
  const color = (i: number) => {
    const t = (i / (n - 1)) * (stops.length - 1);
    const k = Math.min(stops.length - 2, Math.floor(t));
    return mix(stops[k], stops[k + 1], t - k);
  };
  for (let i = 0; i < n; i++) {
    const a = Math.round(y0 + ((y1 - y0) * i) / n);
    const b = Math.round(y0 + ((y1 - y0) * (i + 1)) / n);
    px(c, 0, a, w, b - a, color(i));
    if (i < n - 1) {
      c.fillStyle = color(i + 1);
      for (let x = 0; x < w; x += 2) c.fillRect(x, b - 2, 1, 1);
      for (let x = 1; x < w; x += 2) c.fillRect(x, b - 1, 1, 1);
    }
  }
}

function disc(c: Ctx, cx: number, cy: number, r: number, col: string): void {
  c.fillStyle = col;
  for (let y = -r; y <= r; y++) {
    const half = Math.floor(Math.sqrt(r * r - y * y) + 0.3);
    c.fillRect(Math.round(cx - half), Math.round(cy + y), half * 2 + 1, 1);
  }
}

function ellipse(c: Ctx, cx: number, cy: number, rx: number, ry: number, col: string): void {
  c.fillStyle = col;
  for (let y = -ry; y <= ry; y++) {
    const half = Math.floor(rx * Math.sqrt(1 - (y * y) / (ry * ry + 0.001)) + 0.3);
    c.fillRect(Math.round(cx - half), Math.round(cy + y), half * 2 + 1, 1);
  }
}

/** Filled triangle via scanlines (apex up). */
function tri(c: Ctx, cx: number, top: number, baseW: number, h: number, col: string): void {
  c.fillStyle = col;
  for (let y = 0; y < h; y++) {
    const half = Math.floor((baseW / 2) * ((y + 1) / h));
    c.fillRect(Math.round(cx - half), Math.round(top + y), half * 2 + 1, 1);
  }
}
function triDown(c: Ctx, cx: number, top: number, baseW: number, h: number, col: string): void {
  c.fillStyle = col;
  for (let y = 0; y < h; y++) {
    const half = Math.floor((baseW / 2) * (1 - y / h));
    c.fillRect(Math.round(cx - half), Math.round(top + y), half * 2 + 1, 1);
  }
}

/** Periodic rolling ridge filled to the bottom edge. */
function ridge(c: Ctx, w: number, h: number, base: number, amp: number, k: number, ph: number, col: string, hi?: string): void {
  for (let x = 0; x < w; x++) {
    const a = (2 * Math.PI * k * x) / w + ph;
    const top = Math.round(base - amp * (0.6 * Math.sin(a) + 0.4 * Math.sin(2.3 * a + 1)));
    px(c, x, top, 1, h - top, col);
    if (hi) px(c, x, top, 1, 2, hi);
  }
}

function cloud(c: Ctx, x: number, y: number, s: number, col = '#ffffff', shade = '#cfe0ff'): void {
  px(c, x, y, 30 * s, 7 * s, col);
  px(c, x + 5 * s, y - 5 * s, 18 * s, 6 * s, col);
  px(c, x + 14 * s, y - 8 * s, 10 * s, 5 * s, col);
  px(c, x, y + 5 * s, 30 * s, 2 * s, shade);
}

function stars(c: Ctx, w: number, h: number, r: Rng, n: number, cols = ['#ffffff', '#cfe0ff', '#ffe6a0']): void {
  for (let i = 0; i < n; i++) {
    const x = Math.floor(r() * w);
    const y = Math.floor(r() * h);
    px(c, x, y, 1, 1, cols[Math.floor(r() * cols.length)]);
    if (r() < 0.12) {
      px(c, x - 1, y, 3, 1, '#ffffff');
      px(c, x, y - 1, 1, 3, '#ffffff');
    }
  }
}

function dots(c: Ctx, r: Rng, n: number, x0: number, y0: number, x1: number, y1: number, cols: string[]): void {
  for (let i = 0; i < n; i++) px(c, x0 + r() * (x1 - x0), y0 + r() * (y1 - y0), 1, 1, cols[Math.floor(r() * cols.length)]);
}

function tree(c: Ctx, x: number, baseY: number, h: number, trunk: string, leaf: string, leafHi: string): void {
  px(c, x - 1, baseY - h * 0.5, 3, h * 0.5, trunk);
  disc(c, x, baseY - h * 0.6, Math.round(h * 0.38), leaf);
  disc(c, x - 2, baseY - h * 0.68, Math.round(h * 0.22), leafHi);
}

function groundStrip(c: Ctx, w: number, h: number, y: number, top: string, topHi: string, body: string, speck: string, r: Rng): void {
  px(c, 0, y, w, h - y, body);
  px(c, 0, y, w, 4, top);
  px(c, 0, y, w, 1, topHi);
  for (let x = 0; x < w; x += 3) px(c, x, y + 4, 2, 1 + (x % 2), top);
  dots(c, r, 60, 0, y + 8, w, h, [speck, speck, mix(body, '#000000', 0.25)]);
}

// ------------------------------------------------------------------ regions
type Painter = (c: Ctx, w: number, h: number, r: Rng) => void;

const grassland: Painter = (c, w, h, r) => {
  sky(c, w, 0, h, ['#4f8fff', '#8fd0ff', '#d6f2ff']);
  disc(c, 150, 26, 11, '#fff3a8');
  disc(c, 150, 26, 8, '#ffe066');
  cloud(c, 14, 22, 1);
  cloud(c, 88, 12, 1, '#ffffff');
  cloud(c, 120, 44, 1);
  ridge(c, w, h, 66, 12, 2, 0.5, '#5b8fd9', '#7aa8ea');
  ridge(c, w, h, 78, 10, 3, 2, '#3f9a6c', '#5bbb86');
  for (const x of [22, 58, 101, 170]) tree(c, x, 82, 24, '#6a3d20', '#2f9a4a', '#58c463');
  groundStrip(c, w, h, 86, '#4caf50', '#7fd36a', '#7a4a2a', '#5a3519', r);
  for (let i = 0; i < 14; i++) {
    const x = 6 + i * 13 + (i % 3) * 2;
    px(c, x, 84, 1, 2, '#2f7d32');
    px(c, x - 1, 82, 3, 2, i % 2 ? '#ff7aa8' : '#ffe066');
  }
  // bounce pad + bricks
  px(c, 130, 80, 16, 6, '#e8485a');
  px(c, 132, 81, 12, 2, '#ff9aa6');
  px(c, 60, 58, 32, 8, '#9b5d36');
  for (let i = 0; i < 4; i++) px(c, 60 + i * 8, 58, 1, 8, '#6a3d20');
  px(c, 60, 58, 32, 2, '#c98552');
};

const factory: Painter = (c, w, h, r) => {
  sky(c, w, 0, h, ['#1d1a30', '#3b2f45', '#5c3b3b']);
  // back wall windows
  for (let x = 6; x < w; x += 24)
    for (let y = 8; y < 52; y += 18) {
      px(c, x, y, 16, 10, '#0e0c1a');
      px(c, x + 1, y + 1, 14, 8, r() < 0.65 ? '#ff9a3c' : '#6b3a1a');
      px(c, x + 7, y, 2, 10, '#0e0c1a');
    }
  // smokestacks + smoke
  px(c, 150, 28, 10, 50, '#57506b');
  px(c, 150, 28, 10, 4, '#e0584a');
  px(c, 170, 40, 8, 40, '#4a445d');
  for (let i = 0; i < 5; i++) disc(c, 154 + i * 4, 22 - i * 5, 5 + i, `rgba(190,190,210,${0.55 - i * 0.08})`);
  // pipes
  px(c, 0, 60, w, 6, '#7a8aa3');
  px(c, 0, 60, w, 2, '#b8c6dd');
  px(c, 0, 64, w, 2, '#4d5a70');
  for (const x of [30, 90, 140]) {
    px(c, x, 60, 4, 6, '#3c465a');
  }
  // gears
  const gear = (cx: number, cy: number, rad: number, col: string, dark: string) => {
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      px(c, cx + Math.cos(a) * (rad + 3) - 2, cy + Math.sin(a) * (rad + 3) - 2, 4, 4, col);
    }
    disc(c, cx, cy, rad, col);
    disc(c, cx, cy, Math.round(rad * 0.55), dark);
    disc(c, cx, cy, Math.round(rad * 0.25), col);
  };
  gear(40, 40, 13, '#c58b2b', '#6b4a14');
  gear(68, 52, 8, '#d9a441', '#6b4a14');
  gear(112, 36, 10, '#8a97b3', '#3c465a');
  // floor + conveyor
  px(c, 0, 84, w, h - 84, '#2a2838');
  px(c, 0, 84, w, 4, '#4a4a66');
  px(c, 10, 76, 120, 8, '#23212f');
  for (let x = 10; x < 130; x += 6) px(c, x, 78, 3, 2, '#ffd84a');
  px(c, 10, 74, 120, 2, '#6a6a88');
  dots(c, r, 26, 100, 40, 190, 84, ['#ffd84a', '#ff9a3c', '#ffffff']);
  for (let x = 0; x < w; x += 16) px(c, x, 92, 14, 1, '#3c3a52');
};

const jungle: Painter = (c, w, h, r) => {
  sky(c, w, 0, h, ['#0b2e22', '#1f6a3c', '#3fa14f']);
  // light rays
  for (let i = 0; i < 4; i++) {
    c.fillStyle = 'rgba(255,240,150,0.10)';
    for (let y = 0; y < 90; y++) c.fillRect(30 + i * 42 + Math.floor(y * 0.35), y, 10, 1);
  }
  for (const [x, hgt] of [[14, 96], [72, 88], [128, 96], [176, 90]] as const) {
    px(c, x - 4, h - hgt, 9, hgt, '#4a2e18');
    px(c, x - 4, h - hgt, 2, hgt, '#6a4426');
    px(c, x + 3, h - hgt, 2, hgt, '#2e1a0c');
  }
  for (let i = 0; i < 26; i++) disc(c, r() * w, r() * 38, 6 + r() * 9, i % 3 ? '#1f8a3c' : '#2db84e');
  for (let i = 0; i < 10; i++) disc(c, r() * w, r() * 30, 4 + r() * 5, '#6ee27a');
  // vines
  for (let i = 0; i < 9; i++) {
    const x = 8 + i * 22 + Math.floor(r() * 8);
    const len = 26 + r() * 40;
    for (let y = 0; y < len; y++) px(c, x + Math.round(Math.sin(y / 6 + i) * 1.5), y + 10, 1, 1, '#16722e');
    disc(c, x, 10 + len, 2, '#3bd45c');
  }
  // leaf platforms
  for (const [x, y, rx] of [[50, 62, 18], [118, 54, 16], [158, 72, 14]] as const) {
    ellipse(c, x, y, rx, 4, '#3bd45c');
    ellipse(c, x, y - 1, rx - 3, 2, '#7cf09a');
  }
  px(c, 0, 90, w, 18, '#1b3f22');
  px(c, 0, 90, w, 3, '#2f7a3a');
  for (let x = 0; x < w; x += 9) triDown(c, x + 4, 90, 8, 7, '#0f2a16');
  dots(c, r, 28, 0, 20, w, 90, ['#fff59a', '#c8ff8a']);
  px(c, 100, 84, 12, 6, '#ff5c7a');
  px(c, 102, 82, 8, 3, '#ffb3c4');
};

const underwater: Painter = (c, w, h, r) => {
  sky(c, w, 0, h, ['#0a2a66', '#1466a8', '#2aa6c8'], 10);
  for (let i = 0; i < 5; i++) {
    c.fillStyle = 'rgba(180,240,255,0.10)';
    for (let y = 0; y < 80; y++) c.fillRect(20 + i * 38 + Math.floor(y * 0.3), y, 8, 1);
  }
  // sunken ship
  const sx = 60;
  px(c, sx, 62, 64, 10, '#5a3a22');
  px(c, sx + 4, 72, 56, 6, '#4a2e1a');
  px(c, sx + 10, 78, 44, 4, '#3a2412');
  for (let i = 0; i < 8; i++) px(c, sx + 4 + i * 8, 64, 3, 3, '#0e2233');
  px(c, sx + 28, 30, 4, 34, '#6a4426');
  px(c, sx + 12, 40, 4, 24, '#6a4426');
  tri(c, sx + 40, 30, 24, 24, '#d9d2b8');
  px(c, sx + 34, 40, 4, 4, '#6a4a2a');
  px(c, sx + 28, 28, 4, 2, '#ff4f4f');
  px(c, sx + 32, 26, 10, 4, '#1a1a1a');
  px(c, sx + 36, 27, 2, 2, '#ffffff');
  // seaweed
  for (let i = 0; i < 12; i++) {
    const x = 6 + i * 16 + Math.floor(r() * 6);
    const len = 14 + Math.floor(r() * 18);
    for (let y = 0; y < len; y++) px(c, x + Math.round(Math.sin(y / 4 + i) * 2), 96 - y, 2, 1, i % 2 ? '#2fd07a' : '#1fae62');
  }
  px(c, 0, 94, w, 14, '#e6d29a');
  px(c, 0, 94, w, 2, '#f5e7b8');
  dots(c, r, 40, 0, 96, w, 108, ['#c0a868', '#fff3c6']);
  // fish
  for (const [x, y, col] of [[20, 30, '#ffb347'], [150, 44, '#ff6f91'], [130, 20, '#ffd84a']] as const) {
    px(c, x, y, 7, 4, col);
    px(c, x + 7, y - 1, 3, 6, col);
    px(c, x + 1, y + 1, 1, 1, '#000000');
  }
  // bubbles
  for (let i = 0; i < 16; i++) {
    const x = Math.floor(r() * w);
    const y = Math.floor(r() * 90);
    px(c, x, y, 3, 3, 'rgba(220,250,255,0.75)');
    px(c, x + 1, y + 1, 1, 1, 'rgba(255,255,255,0.3)');
  }
};

const caves: Painter = (c, w, h, r) => {
  sky(c, w, 0, h, ['#0d0a18', '#241b3b', '#382a52']);
  for (let x = 0; x < w; x += 10) {
    const len = 10 + Math.floor(r() * 28);
    triDown(c, x + 5, 0, 10, len, x % 20 ? '#46375f' : '#382b4e');
  }
  for (let x = 4; x < w; x += 16) {
    const len = 8 + Math.floor(r() * 18);
    tri(c, x + 6, h - 24 - len, 12, len, '#2a2040');
  }
  // glowing crystals
  const crystal = (x: number, y: number, hh: number, col: string, hi: string) => {
    for (let i = 0; i < 3; i++) {
      const cx = x + (i - 1) * 5;
      const ch = hh - Math.abs(i - 1) * 6;
      tri(c, cx, y - ch, 6, ch, col);
      px(c, cx - 1, y - ch + 3, 1, Math.max(2, ch - 6), hi);
    }
    c.fillStyle = col.replace(')', ',0.12)').replace('rgb', 'rgba');
  };
  c.globalAlpha = 0.18;
  disc(c, 50, 78, 22, '#35e0ff');
  disc(c, 140, 70, 18, '#ff5fd2');
  c.globalAlpha = 1;
  crystal(50, 88, 22, '#35e0ff', '#c8faff');
  crystal(140, 84, 18, '#ff5fd2', '#ffd0f2');
  px(c, 0, 88, w, 20, '#3a3048');
  px(c, 0, 88, w, 3, '#6a5a82');
  for (let x = 0; x < w; x += 12) px(c, x + (x % 5), 93 + (x % 7), 8, 3, '#2a2236');
  px(c, 80, 62, 40, 6, '#5a4a72');
  px(c, 80, 62, 40, 2, '#8a78a8');
  dots(c, r, 18, 0, 20, w, 88, ['#8af0ff', '#ffd0f2']);
  px(c, 96, 28, 1, 3, '#7ad7ff'); // drip
  px(c, 96, 40, 1, 2, '#7ad7ff');
};

const skyRegion: Painter = (c, w, h, r) => {
  sky(c, w, 0, h, ['#2458d8', '#6aa8ff', '#bfe6ff', '#ffe3b5'], 10);
  disc(c, 40, 30, 12, '#fff7c2');
  disc(c, 40, 30, 8, '#ffe978');
  cloud(c, 100, 16, 1);
  cloud(c, 140, 52, 1, '#ffffff', '#d9e6ff');
  cloud(c, 4, 70, 1, '#ffffff', '#d9e6ff');
  const island = (x: number, y: number, rw: number, treeH: number) => {
    triDown(c, x, y + 4, rw * 2, 24, '#8a6a4a');
    triDown(c, x, y + 4, rw * 2 - 10, 18, '#6f533a');
    ellipse(c, x, y + 3, rw, 4, '#4caf50');
    px(c, x - rw, y + 1, rw * 2, 2, '#7fd36a');
    if (treeH) tree(c, x + 6, y, treeH, '#6a3d20', '#2f9a4a', '#58c463');
  };
  island(62, 62, 26, 18);
  island(142, 82, 18, 0);
  island(28, 34, 14, 0);
  px(c, 140, 80, 4, 6, '#d6b48a');
  px(c, 138, 77, 8, 3, '#e0584a');
  // waterfall
  for (let y = 0; y < 20; y++) px(c, 59 + Math.round(Math.sin(y) * 0.6), 66 + y, 2, 1, '#bfe6ff');
  // birds
  for (const [x, y] of [[90, 38], [102, 44], [116, 34]] as const) {
    px(c, x, y, 2, 1, '#1d2a48');
    px(c, x + 2, y + 1, 2, 1, '#1d2a48');
    px(c, x + 4, y, 2, 1, '#1d2a48');
  }
  void r;
};

const lava: Painter = (c, w, h, r) => {
  sky(c, w, 0, h, ['#1a0606', '#4a0f0a', '#b13a12'], 9);
  disc(c, 96, 70, 40, 'rgba(255,120,30,0.18)');
  // volcano
  px(c, 0, 0, 0, 0, '#000');
  for (let y = 0; y < 50; y++) {
    const half = 20 + Math.round(y * 1.1);
    px(c, 96 - half, 38 + y, half * 2, 1, y % 2 ? '#2a1410' : '#331a14');
  }
  px(c, 82, 38, 28, 3, '#ff8a2a');
  for (let i = 0; i < 6; i++) {
    const a = -0.25 + i * 0.1;
    for (let t = 0; t < 26; t++) px(c, 96 + Math.sin(a * 6) * 6 + t * (i - 2.5) * 0.35, 38 - t * 1.2 + t * t * 0.02, 2, 2, t % 2 ? '#ffd84a' : '#ff6a1a');
  }
  disc(c, 96, 22, 7, 'rgba(60,40,40,0.8)');
  disc(c, 106, 12, 9, 'rgba(70,50,50,0.6)');
  // lava lake
  px(c, 0, 82, w, 26, '#e8420e');
  for (let y = 0; y < 26; y += 4) px(c, 0, 82 + y, w, 2, y % 8 ? '#ff7a1a' : '#ffb347');
  for (let x = 0; x < w; x += 14) px(c, x + ((x * 7) % 9), 86 + ((x * 3) % 12), 8, 2, '#ffe28a');
  // obsidian platforms
  for (const [x, y, ww] of [[14, 70, 28], [130, 64, 34], [80, 76, 20]] as const) {
    px(c, x, y, ww, 7, '#241a22');
    px(c, x, y, ww, 2, '#4d3a4a');
    tri(c, x + ww / 2, y + 7, ww - 6, 8, '#1a1219');
  }
  dots(c, r, 50, 0, 0, w, 84, ['#ffb347', '#ff6a1a', '#ffe28a']);
};

const stormy: Painter = (c, w, h, r) => {
  sky(c, w, 0, h, ['#141b28', '#2b3a52', '#58708c'], 9);
  for (let i = 0; i < 22; i++) disc(c, r() * w, r() * 28, 8 + r() * 12, i % 2 ? '#1f2a3c' : '#2e3d55');
  // lightning
  let lx = 120;
  let ly = 18;
  c.fillStyle = '#fff9b0';
  for (let i = 0; i < 12; i++) {
    const nx = lx + (i % 2 ? -5 : 6);
    px(c, Math.min(lx, nx), ly, Math.abs(nx - lx) + 2, 2, '#fff9b0');
    px(c, nx, ly, 2, 6, '#fff9b0');
    lx = nx;
    ly += 6;
  }
  c.globalAlpha = 0.15;
  disc(c, 120, 50, 30, '#fff9b0');
  c.globalAlpha = 1;
  // sea
  px(c, 0, 76, w, 32, '#16304a');
  for (let y = 0; y < 32; y += 4) for (let x = (y % 8) * 2; x < w; x += 16) px(c, x, 78 + y, 9, 1, y % 8 ? '#2f5f88' : '#d6ecff');
  // island + lighthouse
  ellipse(c, 50, 84, 40, 12, '#3d3a30');
  px(c, 14, 76, 72, 8, '#3d3a30');
  ellipse(c, 50, 74, 30, 6, '#3c7a46');
  px(c, 46, 40, 10, 34, '#e9e4d6');
  for (let y = 44; y < 72; y += 10) px(c, 46, y, 10, 4, '#c0392b');
  px(c, 44, 34, 14, 6, '#1f2a3c');
  px(c, 47, 35, 8, 4, '#ffe066');
  tri(c, 51, 24, 14, 10, '#c0392b');
  c.globalAlpha = 0.25;
  for (let i = 0; i < 40; i++) px(c, 55 + i, 36 + (i >> 4), 1, 6 + (i >> 2), '#ffe066');
  c.globalAlpha = 1;
  // palm
  for (let i = 0; i < 14; i++) px(c, 80 + Math.round(i * 0.4), 72 - i * 1.6, 2, 2, '#6a4a2a');
  for (const [dx, dy] of [[-8, 2], [-6, -3], [4, -4], [9, 1], [0, -7]] as const) px(c, 86 + dx, 50 + dy, 7, 2, '#2f9a4a');
  // rain
  c.fillStyle = 'rgba(190,215,240,0.55)';
  for (let i = 0; i < 120; i++) {
    const x = Math.floor(r() * w);
    const y = Math.floor(r() * h);
    c.fillRect(x, y, 1, 3);
    c.fillRect(x - 1, y + 3, 1, 2);
  }
};

const haunted: Painter = (c, w, h, r) => {
  sky(c, w, 0, h, ['#0a0620', '#2a1450', '#5a2a78'], 9);
  stars(c, w, 50, r, 40);
  disc(c, 150, 26, 14, '#fff3c4');
  disc(c, 146, 22, 3, '#e6d6a0');
  disc(c, 156, 32, 2, '#e6d6a0');
  // mansion
  const mx = 60;
  px(c, mx, 50, 70, 38, '#0f0a1e');
  px(c, mx + 4, 38, 14, 14, '#0f0a1e');
  tri(c, mx + 11, 26, 18, 14, '#0f0a1e');
  px(c, mx + 52, 34, 14, 18, '#0f0a1e');
  tri(c, mx + 59, 20, 18, 16, '#0f0a1e');
  tri(c, mx + 35, 36, 50, 16, '#0f0a1e');
  for (const [x, y] of [[mx + 8, 44], [mx + 22, 58], [mx + 40, 58], [mx + 56, 42], [mx + 56, 62], [mx + 10, 70]] as const) {
    px(c, x, y, 5, 7, '#ffd84a');
    px(c, x + 2, y, 1, 7, '#b8860b');
  }
  px(c, mx + 30, 72, 10, 16, '#6a2a78');
  // ground
  px(c, 0, 88, w, 20, '#140d24');
  px(c, 0, 88, w, 2, '#3a2a5a');
  // fence
  for (let x = 4; x < w; x += 8) {
    px(c, x, 80, 2, 10, '#0a0614');
    px(c, x - 1, 79, 4, 2, '#0a0614');
  }
  px(c, 0, 84, w, 2, '#0a0614');
  // dead trees
  for (const x of [14, 172]) {
    px(c, x, 52, 4, 38, '#0a0614');
    for (const [dx, dy, l] of [[-10, 56, 12], [4, 62, 12], [-7, 70, 8], [4, 52, 10]] as const) px(c, x + dx, dy, l, 2, '#0a0614');
  }
  // tombstones
  for (const x of [30, 44, 140, 156]) {
    px(c, x, 90, 7, 10, '#6a6a88');
    px(c, x + 1, 88, 5, 2, '#6a6a88');
    px(c, x + 3, 92, 1, 4, '#3a3a52');
    px(c, x + 2, 93, 3, 1, '#3a3a52');
  }
  // ghosts
  for (const [x, y] of [[100, 60], [28, 40], [166, 56]] as const) {
    c.globalAlpha = 0.8;
    px(c, x, y, 10, 10, '#e8f0ff');
    px(c, x + 1, y - 1, 8, 1, '#e8f0ff');
    for (let i = 0; i < 4; i++) px(c, x + i * 3, y + 10, 2, 2, '#e8f0ff');
    c.globalAlpha = 1;
    px(c, x + 2, y + 3, 2, 3, '#0a0620');
    px(c, x + 6, y + 3, 2, 3, '#0a0620');
  }
  // bats
  for (const [x, y] of [[20, 14], [110, 18], [132, 40]] as const) {
    px(c, x, y, 2, 2, '#0a0614');
    px(c, x - 4, y - 1, 4, 2, '#0a0614');
    px(c, x + 2, y - 1, 4, 2, '#0a0614');
  }
  c.globalAlpha = 0.25;
  px(c, 0, 94, w, 10, '#b8a8ff');
  c.globalAlpha = 1;
};

const space: Painter = (c, w, h, r) => {
  sky(c, w, 0, h, ['#020209', '#0a0724', '#1a0a3a'], 8);
  c.globalAlpha = 0.2;
  for (let i = 0; i < 8; i++) disc(c, 30 + r() * 140, 20 + r() * 60, 10 + r() * 18, i % 2 ? '#7a3cff' : '#ff3c9a');
  c.globalAlpha = 1;
  stars(c, w, h, r, 90);
  // ringed planet
  disc(c, 50, 40, 18, '#e8823a');
  for (let y = -16; y < 16; y += 5) {
    const half = Math.floor(Math.sqrt(18 * 18 - y * y));
    px(c, 50 - half, 40 + y, half * 2, 2, y % 10 ? '#c4622a' : '#f5a65e');
  }
  ellipse(c, 50, 42, 32, 5, 'rgba(255,230,170,0.85)');
  disc(c, 50, 38, 12, '#e8823a');
  // small moon
  disc(c, 150, 24, 7, '#cfd6e6');
  disc(c, 148, 22, 2, '#9aa4bf');
  // asteroid platforms
  const rock = (x: number, y: number, ww: number) => {
    ellipse(c, x, y + 4, ww / 2, 6, '#6b7088');
    px(c, x - ww / 2 + 2, y, ww - 4, 3, '#8a90aa');
    px(c, x - 4, y + 5, 3, 2, '#4a4e66');
    px(c, x + 6, y + 7, 4, 2, '#4a4e66');
    px(c, x + 4, y - 4, 2, 4, '#ff5c7a');
    px(c, x + 4, y - 4, 2, 1, '#ffb3c4');
  };
  rock(108, 84, 34);
  rock(40, 92, 26);
  rock(160, 66, 22);
  // station
  px(c, 98, 44, 18, 6, '#9aa4bf');
  px(c, 104, 40, 6, 14, '#cfd6e6');
  px(c, 92, 45, 6, 4, '#3a6af0');
  px(c, 116, 45, 6, 4, '#3a6af0');
  px(c, 106, 43, 2, 2, '#ffe066');
};

const bayou: Painter = (c, w, h, r) => {
  sky(c, w, 0, h, ['#283a1a', '#56702e', '#a4a64a'], 9);
  c.globalAlpha = 0.25;
  px(c, 0, 50, w, 14, '#d8e0a0');
  c.globalAlpha = 1;
  // water
  px(c, 0, 72, w, 36, '#2d4a2a');
  for (let y = 0; y < 36; y += 4) px(c, 0, 72 + y, w, 2, y % 8 ? '#3a5e34' : '#486f3c');
  // cypress trees
  for (const [x, hh] of [[20, 70], [84, 76], [150, 72]] as const) {
    px(c, x - 3, 76 - hh, 7, hh, '#4a3a22');
    px(c, x - 8, 70, 17, 6, '#4a3a22');
    px(c, x - 3, 76 - hh, 2, hh, '#6a5232');
    for (let i = 0; i < 6; i++) disc(c, x - 14 + i * 6, 76 - hh + 2 + (i % 2) * 4, 6, '#3b7a36');
    for (let i = 0; i < 9; i++) {
      const mx = x - 16 + i * 4;
      for (let y = 0; y < 10 + (i % 3) * 5; y++) px(c, mx, 76 - hh + 8 + y, 1, 1, '#9ab47a');
    }
  }
  // stilt shack
  px(c, 104, 50, 26, 16, '#6a4a2a');
  tri(c, 117, 40, 34, 11, '#8a5a30');
  px(c, 112, 55, 5, 7, '#ffd84a');
  for (const x of [106, 124]) px(c, x, 66, 3, 14, '#4a3a22');
  px(c, 100, 66, 34, 3, '#8a6a42');
  // lily pads
  for (let i = 0; i < 9; i++) {
    const x = 6 + i * 21 + Math.floor(r() * 8);
    const y = 84 + Math.floor(r() * 18);
    ellipse(c, x, y, 7, 2, '#58b84a');
    px(c, x + 1, y, 6, 1, '#2d4a2a');
    if (i % 3 === 0) px(c, x - 1, y - 2, 3, 2, '#ff9ac8');
  }
  // log
  px(c, 40, 78, 30, 5, '#5a3e22');
  px(c, 40, 78, 30, 1, '#8a6a42');
  dots(c, r, 30, 0, 30, w, 80, ['#eaff8a', '#fff59a']);
};

const candy: Painter = (c, w, h, r) => {
  sky(c, w, 0, h, ['#ff8fd0', '#ffc0e4', '#fff0f8'], 9);
  cloud(c, 18, 24, 1, '#ffffff', '#ffd6ee');
  cloud(c, 120, 14, 1, '#fff0fa', '#ffd6ee');
  ridge(c, w, h, 66, 10, 2, 1, '#a8f0d8', '#d4fff0');
  ridge(c, w, h, 78, 9, 3, 0, '#ffb6d9', '#ffe0f0');
  // lollipops
  for (const [x, col1, col2] of [[24, '#ff4f8b', '#ffffff'], [92, '#3bd4ff', '#ffffff'], [166, '#ffb300', '#ffffff']] as const) {
    px(c, x, 52, 3, 40, '#f5f0f0');
    disc(c, x + 1, 44, 12, col1);
    for (let a = 0; a < 36; a++) px(c, x + 1 + Math.cos(a / 3) * (a / 3.2), 44 + Math.sin(a / 3) * (a / 3.2), 2, 2, col2);
  }
  // cake tower
  const cx = 130;
  px(c, cx, 66, 34, 20, '#8a5a3a');
  px(c, cx, 66, 34, 4, '#ffe0f0');
  px(c, cx + 4, 50, 26, 16, '#fff0c8');
  px(c, cx + 4, 50, 26, 4, '#ff9ac8');
  px(c, cx + 9, 36, 16, 14, '#ffb6d9');
  for (let i = 0; i < 6; i++) px(c, cx + i * 6, 70, 3, 4 + (i % 3) * 2, '#ffe0f0');
  disc(c, cx + 17, 32, 4, '#e8213f');
  px(c, cx + 17, 26, 1, 4, '#3b8a3e');
  // candy canes
  for (const x of [60, 108]) {
    for (let y = 0; y < 26; y++) px(c, x, 62 + y, 4, 1, y % 6 < 3 ? '#ff4f4f' : '#ffffff');
    for (let a = 0; a < 10; a++) px(c, x + 2 + Math.round(Math.sin((a / 9) * Math.PI) * 5), 58 + Math.round((1 - Math.cos((a / 9) * Math.PI)) * 2) - 4, 3, 3, a % 4 < 2 ? '#ff4f4f' : '#ffffff');
  }
  // chocolate ground
  px(c, 0, 88, w, 20, '#6a3a24');
  px(c, 0, 88, w, 5, '#8a4a30');
  for (let x = 0; x < w; x += 10) px(c, x, 93, 5, 2 + (x % 3) * 2, '#8a4a30');
  dots(c, r, 60, 0, 90, w, 108, ['#ff9ac8', '#ffe066', '#7ae8c8', '#ffffff']);
  for (let i = 0; i < 8; i++) disc(c, 8 + i * 25, 86, 3, ['#ff4f8b', '#3bd4ff', '#ffb300', '#7ae84a'][i % 4]);
};

const desert: Painter = (c, w, h, r) => {
  sky(c, w, 0, h, ['#ff8a2a', '#ffb35a', '#ffe2a0'], 9);
  disc(c, 44, 40, 16, '#fff3c4');
  disc(c, 44, 40, 12, '#ffe066');
  ridge(c, w, h, 72, 8, 2, 0.7, '#e89a4a', '#f7c27a');
  // pyramids
  for (const [x, s] of [[120, 1], [156, 0.7]] as const) {
    tri(c, x, 72 - 34 * s, 56 * s, 34 * s, '#d9923e');
    for (let y = 0; y < 34 * s; y += 5) px(c, x - (28 * s * (y + 1)) / (34 * s), 72 - 34 * s + y, (56 * s * (y + 1)) / (34 * s), 1, '#b87430');
    for (let y = 0; y < 34 * s; y++) px(c, x, 72 - 34 * s + y, (28 * s * (y + 1)) / (34 * s), 1, y % 5 === 4 ? '#b87430' : '#ffc070');
  }
  ridge(c, w, h, 84, 7, 3, 2.2, '#f2b35e', '#ffd894');
  ridge(c, w, h, 96, 4, 4, 0.3, '#e6a04a', '#ffc678');
  // cacti
  for (const [x, hh] of [[18, 28], [76, 20], [176, 24]] as const) {
    px(c, x, 90 - hh, 5, hh, '#2f9a4a');
    px(c, x + 1, 90 - hh, 1, hh, '#58c463');
    px(c, x - 6, 90 - hh + 8, 6, 3, '#2f9a4a');
    px(c, x - 6, 90 - hh + 2, 3, 9, '#2f9a4a');
    px(c, x + 5, 90 - hh + 12, 6, 3, '#2f9a4a');
    px(c, x + 8, 90 - hh + 5, 3, 10, '#2f9a4a');
    px(c, x + 1, 90 - hh - 2, 3, 2, '#ff7aa8');
  }
  // oasis + ruin
  ellipse(c, 100, 98, 16, 3, '#2fb8d6');
  for (let i = 0; i < 8; i++) px(c, 96 + Math.round(i * 0.4), 92 - i * 2, 2, 2, '#7a5a2a');
  for (const [dx, dy] of [[-7, -1], [-5, -5], [5, -5], [8, 0]] as const) px(c, 99 + dx, 76 + dy, 8, 2, '#2f9a4a');
  px(c, 40, 70, 4, 18, '#d9b47a');
  px(c, 56, 70, 4, 18, '#d9b47a');
  px(c, 38, 66, 24, 5, '#e6c58c');
  dots(c, r, 60, 0, 70, w, 108, ['#fff0c0', '#d48a3a']);
};

const city: Painter = (c, w, h, r) => {
  sky(c, w, 0, h, ['#231a5e', '#7a3a9a', '#ff6f8a', '#ffc08a'], 10);
  stars(c, w, 30, r, 24);
  disc(c, 160, 52, 12, '#ffe8b0');
  const skyline = (minH: number, maxH: number, col: string, win: string, density: number, seedOff: number) => {
    const rr = mulberry(seedOff);
    let x = 0;
    while (x < w) {
      const bw = 10 + Math.floor(rr() * 14);
      const bh = minH + Math.floor(rr() * (maxH - minH));
      px(c, x, 92 - bh, bw, bh, col);
      for (let wy = 92 - bh + 4; wy < 88; wy += 5)
        for (let wx = x + 2; wx < x + bw - 2; wx += 4) if (rr() < density) px(c, wx, wy, 2, 3, win);
      if (rr() < 0.3) px(c, x + bw / 2, 92 - bh - 5, 1, 5, col);
      x += bw;
    }
  };
  skyline(26, 52, '#3a2468', '#ffb3c8', 0.25, 11);
  skyline(18, 44, '#1d1440', '#ffe066', 0.4, 23);
  // clock tower
  px(c, 88, 28, 14, 64, '#140d2e');
  tri(c, 95, 16, 18, 14, '#140d2e');
  disc(c, 95, 40, 5, '#ffe8b0');
  px(c, 95, 37, 1, 4, '#140d2e');
  px(c, 95, 40, 3, 1, '#140d2e');
  // neon signs
  px(c, 18, 52, 16, 6, '#ff4fa0');
  px(c, 20, 54, 12, 2, '#ffd0ea');
  px(c, 148, 60, 18, 6, '#3be0ff');
  px(c, 150, 62, 14, 2, '#d0faff');
  // street
  px(c, 0, 92, w, 16, '#2a2440');
  px(c, 0, 92, w, 3, '#514a72');
  for (let x = 4; x < w; x += 20) px(c, x, 100, 10, 2, '#ffd84a');
  // stalls with awnings
  for (const [x, a, b] of [[30, '#ff4f4f', '#ffffff'], [70, '#3bd4ff', '#ffffff'], [128, '#ffb300', '#ffffff']] as const) {
    px(c, x, 80, 24, 12, '#3a2a52');
    for (let i = 0; i < 6; i++) px(c, x + i * 4, 76, 4, 6, i % 2 ? a : b);
    px(c, x + 4, 84, 6, 6, '#ffe8b0');
  }
  // lamp posts
  for (const x of [58, 112, 176]) {
    px(c, x, 70, 2, 22, '#1a1430');
    disc(c, x + 1, 69, 3, '#ffe8b0');
  }
};

export interface RegionArt {
  id: string;
  paint: Painter;
  seed: number;
}

export const REGION_ART: Record<string, RegionArt> = {
  grassland: { id: 'grassland', paint: grassland, seed: 1 },
  factory: { id: 'factory', paint: factory, seed: 2 },
  jungle: { id: 'jungle', paint: jungle, seed: 3 },
  underwater: { id: 'underwater', paint: underwater, seed: 4 },
  caves: { id: 'caves', paint: caves, seed: 5 },
  sky: { id: 'sky', paint: skyRegion, seed: 6 },
  lava: { id: 'lava', paint: lava, seed: 7 },
  stormy: { id: 'stormy', paint: stormy, seed: 8 },
  haunted: { id: 'haunted', paint: haunted, seed: 9 },
  space: { id: 'space', paint: space, seed: 10 },
  bayou: { id: 'bayou', paint: bayou, seed: 11 },
  candy: { id: 'candy', paint: candy, seed: 12 },
  desert: { id: 'desert', paint: desert, seed: 13 },
  city: { id: 'city', paint: city, seed: 14 },
};

export function paintRegion(canvas: HTMLCanvasElement, id: string): void {
  const art = REGION_ART[id];
  const c = canvas.getContext('2d');
  if (!art || !c) return;
  canvas.width = REGION_W;
  canvas.height = REGION_H;
  c.imageSmoothingEnabled = false;
  art.paint(c, REGION_W, REGION_H, mulberry(art.seed * 7919));
}

