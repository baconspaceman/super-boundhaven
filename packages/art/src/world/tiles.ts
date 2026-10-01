// Tile generators for the 16x16 gameplay layer (shared layout, per-region style).
// Ground pieces are rendered from an exposure mask (which sides touch air) so every edge, corner,
// cap and underside is built from the same rules -> seams are impossible by construction:
// all profiles are pinned to the same value at the tile boundary (see EDGE_*/BOT/capB arrays).
import { Canvas } from './paint';
import type { RegionStyle, Stamp } from './styles';

export const T = 16;

/** Left-edge inset per row (px). Pinned to 0 at rows 0 and 15 so vertical neighbours line up. */
const EDGE_W_DEFAULT = [
  [0, 0, 1, 1, 0, 0, 0, 1, 1, 0, 0, 1, 0, 0, 0, 0],
  [0, 1, 1, 0, 0, 1, 1, 1, 0, 0, 0, 0, 1, 1, 0, 0],
];
const EDGE_E_DEFAULT = [
  [0, 1, 1, 0, 0, 0, 1, 1, 0, 0, 0, 1, 1, 0, 0, 0],
  [0, 0, 0, 1, 1, 0, 0, 0, 1, 1, 1, 0, 0, 1, 0, 0],
];

export interface GroundMask {
  /** sides that touch air (cell edge exposed) */
  n: boolean;
  s: boolean;
  e: boolean;
  w: boolean;
  /** concave foot: wall face meets a floor that is level with the bottom of this tile */
  footW?: boolean;
  footE?: boolean;
  /** variant index (texture / tufts / edge pattern) */
  v: number;
  /** fill texture variant (0..3) */
  tv: number;
  /** 'trans' = wavy hand-off from loam to deep earth, 'deep' = darker earth */
  depth?: 'trans' | 'deep';
  /** tile is the first row under a slope: adds the slope-cap continuation */
  underSlope?: 'up' | 'dn';
}

const TRANS_WAVE = [7, 7, 8, 8, 7, 6, 6, 7, 8, 9, 8, 7, 6, 6, 7, 7];

export function dirtTexture(st: RegionStyle, variant: number, mode: 'shallow' | 'deep' | 'trans'): Canvas {
  const make = (deep: boolean): Canvas => {
    const c = new Canvas(T, T, st.pal);
    c.rect(0, 0, T, T, 'b');
    const list: Stamp[] = deep ? st.deepFills[variant % st.deepFills.length] : st.fills[variant % st.fills.length];
    for (const [x, y, rows] of list) c.stamp(x, y, rows);
    return deep ? c.remap({ b: 'c', a: 'b', c: 'd', x: 'y', y: 'z', z: 'c' }) : c;
  };
  if (mode === 'shallow') return make(false);
  if (mode === 'deep') return make(true);
  // trans: loam above a wavy boundary, deep earth below (flat bands, no dithering)
  const top = make(false);
  const bot = make(true);
  const c = new Canvas(T, T, st.pal);
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) c.px(x, y, y < TRANS_WAVE[x] ? top.get(x, y) : bot.get(x, y));
  return c;
}

function grid<Tv>(v: Tv): Tv[][] {
  return Array.from({ length: T }, () => Array<Tv>(T).fill(v));
}

export function genGround(st: RegionStyle, m: GroundMask): Canvas {
  const c = new Canvas(T, T, st.pal);
  const sil = grid(true);
  const ev = m.v % 2;
  const EDGE_W = st.edgeW ?? EDGE_W_DEFAULT;
  const EDGE_E = st.edgeE ?? EDGE_E_DEFAULT;
  // ---- silhouette ----
  if (m.n) for (let x = 0; x < T; x++) sil[0][x] = false;
  if (m.w) for (let y = 0; y < T; y++) for (let x = 0; x < EDGE_W[ev][y]; x++) sil[y][x] = false;
  if (m.e) for (let y = 0; y < T; y++) for (let x = 0; x < EDGE_E[ev][y]; x++) sil[y][T - 1 - x] = false;
  if (m.s) {
    const prof = st.botProfiles[m.v % st.botProfiles.length];
    for (let x = 0; x < T; x++) for (let k = 0; k < prof[x]; k++) sil[T - 1 - k][x] = false;
  }
  // rounded outer corners
  if (m.n && m.w) {
    for (let x = 0; x < 2; x++) sil[1][x] = false;
    sil[2][0] = false;
  }
  if (m.n && m.e) {
    for (let x = 0; x < 2; x++) sil[1][T - 1 - x] = false;
    sil[2][T - 1] = false;
  }
  if (m.s && m.w) {
    for (let x = 0; x < 2; x++) sil[T - 1][x] = false;
    sil[T - 2][0] = false;
  }
  if (m.s && m.e) {
    for (let x = 0; x < 2; x++) sil[T - 1][T - 1 - x] = false;
    sil[T - 2][T - 1] = false;
  }
  const air = (x: number, y: number): boolean => {
    if (x < 0 && y >= 0 && y < T) return m.w;
    if (x >= T && y >= 0 && y < T) return m.e;
    if (y < 0) return m.n;
    if (y >= T) return m.s;
    if (x < 0 || x >= T) return false;
    return !sil[y][x];
  };
  // ---- dirt fill ----
  const tex = dirtTexture(st, m.tv, m.depth ?? 'shallow');
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) if (sil[y][x]) c.px(x, y, tex.get(x, y));
  // ---- cover (grass / moss) ----
  const cover = grid(false);
  if (m.n) {
    const B = st.capB[m.v % st.capB.length];
    for (let x = 0; x < T; x++) for (let y = 1; y <= B[x]; y++) if (sil[y][x]) cover[y][x] = true;
  }
  const wrap = (y: number) => (y <= 3 ? 3 : y <= 6 ? 2 : y <= 8 ? 1 : y <= 10 ? 0 : -1);
  if (m.n && m.w) for (let y = 1; y < T; y++) for (let x = 0; x <= wrap(y); x++) if (sil[y][x]) cover[y][x] = true;
  if (m.n && m.e) for (let y = 1; y < T; y++) for (let x = 0; x <= wrap(y); x++) if (sil[y][T - 1 - x]) cover[y][T - 1 - x] = true;
  // concave feet: cover fillet climbing the wall face where it meets a floor
  const foot = (y: number) => (y >= 15 ? 4 : y === 14 ? 3 : y === 13 ? 2 : y === 12 ? 1 : -1);
  if (m.footW) for (let y = 12; y < T; y++) for (let x = 0; x <= foot(y); x++) if (sil[y][x]) cover[y][x] = true;
  if (m.footE) for (let y = 12; y < T; y++) for (let x = 0; x <= foot(y); x++) if (sil[y][T - 1 - x]) cover[y][T - 1 - x] = true;

  const dtAt = (x: number, y: number): number => {
    let best = 9;
    for (let j = -4; j <= 4; j++)
      for (let i = -4; i <= 4; i++) {
        const d = Math.abs(i) + Math.abs(j);
        if (d >= best) continue;
        if (air(x + i, y + j)) best = d;
      }
    return best - 1;
  };
  for (let y = 0; y < T; y++)
    for (let x = 0; x < T; x++) {
      if (!sil[y][x]) continue;
      const dt = dtAt(x, y);
      if (cover[y][x]) {
        if (dt <= 0) c.px(x, y, '4');
        else if (dt === 1) c.px(x, y, air(x, y - 1) || air(x - 1, y) ? '1' : '2');
        else if (dt === 2) c.px(x, y, '2');
        else c.px(x, y, '3');
      }
    }
  // bottom of cover: darker fringe + shadow on the dirt below
  for (let y = 0; y < T - 1; y++)
    for (let x = 0; x < T; x++) {
      if (cover[y][x] && sil[y + 1][x] && !cover[y + 1][x]) {
        if (c.get(x, y) !== '4') c.px(x, y, '3');
        if (dtAt(x, y + 1) > 0) c.px(x, y + 1, 'c');
        if (x % 2 === 0 && y + 2 < T && sil[y + 2][x] && !cover[y + 2][x] && dtAt(x, y + 2) > 0) c.px(x, y + 2, c.get(x, y + 2) === 'b' ? 'c' : c.get(x, y + 2));
      }
    }
  // dirt edge shading (light from the top-left)
  for (let y = 0; y < T; y++)
    for (let x = 0; x < T; x++) {
      if (!sil[y][x] || cover[y][x]) continue;
      const dt = dtAt(x, y);
      if (dt === 0) c.px(x, y, 'd');
      else if (dt === 1) {
        if (air(x - 2, y) || air(x - 1, y)) c.px(x, y, 'a');
        else if (air(x + 2, y) || air(x + 1, y) || air(x, y + 2) || air(x, y + 1)) c.px(x, y, 'c');
      }
    }
  if (m.n) decoTop(st, c, m.v);
  if (m.underSlope) applyUnderSlope(st, c, m.underSlope);
  return c;
}

// ---------- top-of-ground decoration (tufts, flowers ...) ----------
function tuft(c: Canvas, x: number, hi = false): void {
  c.px(x, 0, hi ? '2' : '3');
  c.px(x, 1, '2');
}
function decoTop(st: RegionStyle, c: Canvas, v: number): void {
  const cave = st.id === 'caverns';
  switch (v % 6) {
    case 0:
      tuft(c, 4, true);
      tuft(c, 5);
      tuft(c, 10, true);
      tuft(c, 13);
      break;
    case 1:
      tuft(c, 3);
      tuft(c, 7, true);
      tuft(c, 8);
      tuft(c, 12, true);
      break;
    case 2:
      tuft(c, 3);
      if (cave) {
        c.px(6, 0, 'r');
        c.px(6, 1, 'r');
        c.px(7, 1, 't');
        c.px(11, 0, 'r');
      } else {
        c.px(7, 0, 'r');
        c.px(8, 0, 'r');
        c.px(7, 1, 's');
        c.px(8, 1, 'r');
        c.px(12, 0, 's');
        c.px(12, 1, 's');
      }
      break;
    case 3:
      tuft(c, 12);
      if (cave) {
        c.px(5, 0, 's');
        c.px(5, 1, 's');
        c.px(4, 1, 't');
        c.px(9, 0, 's');
      } else {
        c.px(4, 0, 't');
        c.px(5, 0, 't');
        c.px(4, 1, 's');
        c.px(5, 1, 't');
        c.px(9, 0, 'r');
        c.px(9, 1, 'r');
      }
      break;
    case 4:
      tuft(c, 3, true);
      c.stamp(7, 0, ['.xx.', 'xyyz'].map((r) => r));
      c.px(11, 1, 'z');
      break;
    default:
      tuft(c, 8, true);
      if (cave) c.px(4, 0, 't');
      break;
  }
}

// ---------- slopes ----------
const SLOPE_T = [4, 4, 5, 5, 4, 4, 5, 6, 5, 4, 4, 5, 5, 4, 4, 4]; // cover thickness per column (periodic, ends equal)

/** Render a 16x32 virtual '/' slope (top tile = slope, bottom tile = fill below it). */
function genSlopeUpVirtual(st: RegionStyle, v: number): Canvas {
  const V = new Canvas(T, T * 2, st.pal);
  const tex0 = dirtTexture(st, 0, 'shallow');
  const tex1 = dirtTexture(st, 1 + (v % 2), 'shallow');
  const top = (x: number) => T - x; // outline row of the surface at column x
  for (let x = 0; x < T; x++) {
    for (let y = top(x); y < T * 2; y++) {
      const tex = y < T ? tex0 : tex1;
      V.px(x, y, tex.get(x, y % T));
      const d = y - top(x);
      const th = SLOPE_T[x];
      if (d <= th) {
        if (d === 0) V.px(x, y, '4');
        else if (d === 1) V.px(x, y, '1');
        else if (d <= 3) V.px(x, y, '2');
        else V.px(x, y, '3');
      } else if (d === th + 1) V.px(x, y, 'c');
      else if (d === th + 2 && x % 2 === 0) V.px(x, y, V.get(x, y) === 'b' ? 'c' : V.get(x, y));
    }
  }
  return V;
}

export function genSlope(st: RegionStyle, dir: 'up' | 'dn', v = 0): { slope: Canvas; under: Canvas } {
  let V = genSlopeUpVirtual(st, v);
  if (dir === 'dn') V = V.flipH();
  const slope = V.crop(0, 0, T, T);
  const under = V.crop(0, T, T, T);
  // slope tile: cover tufts on the diagonal (tiny highlights) for life
  return { slope, under };
}

/** Fill tile under a slope: reuse the virtual slope's lower half (contains the cap continuation). */
function applyUnderSlope(st: RegionStyle, c: Canvas, dir: 'up' | 'dn'): void {
  const { under } = genSlope(st, dir, 0);
  for (let y = 0; y < T; y++)
    for (let x = 0; x < T; x++) {
      const p = under.get(x, y);
      const isCap = p === '1' || p === '2' || p === '3' || p === '4';
      const dirtShadow = y < 8 && p === 'c';
      if (isCap || dirtShadow) c.px(x, y, p);
    }
}

// ---------- timber platform ----------
export function genPlat(st: RegionStyle, kind: 'l' | 'm0' | 'm1' | 'r' | 's'): Canvas {
  const c = new Canvas(T, T, st.pal);
  const L = kind === 'l' || kind === 's';
  const R = kind === 'r' || kind === 's';
  // silhouette: rounded ends
  const x0 = L ? 0 : 0;
  c.rect(x0, 1, T, 14, 'q');
  c.hline(0, 0, T, 'd');
  c.hline(0, 15, T, 'd');
  // deck (top face)
  c.hline(0, 1, T, 'p');
  c.hline(0, 2, T, 'p');
  c.hline(0, 3, T, 'p');
  c.hline(0, 4, T, 'q');
  // plank seams
  const seam = kind === 'm1' ? 4 : 10;
  for (let y = 1; y <= 3; y++) c.px(seam, y, 'q');
  c.px(seam, 4, 'c');
  if (kind === 'm0') c.px(3, 2, 't');
  // beam body with grain
  for (let y = 5; y <= 11; y++) c.hline(0, y, T, 'q');
  c.hline(0, 5, T, 'p');
  for (let x = 1; x < T - 1; x++) {
    if ((x + (kind === 'm1' ? 3 : 0)) % 5 === 1) c.px(x, 7, 'c');
    if ((x + (kind === 'm1' ? 0 : 2)) % 6 === 0) c.px(x, 9, 'c');
  }
  c.hline(0, 12, T, 'c');
  c.hline(0, 13, T, 'c');
  for (let x = 0; x < T; x++) if (x % 3 === 0) c.px(x, 14, 'd');
  // nail heads
  c.px(kind === 'm1' ? 12 : 3, 7, st.nail);
  // end caps: iron-ish straps
  if (L) {
    c.vline(0, 0, T, 'd');
    c.vline(1, 1, 14, 'y');
    c.vline(2, 1, 14, 'z');
    c.px(1, 1, 'x');
    c.px(1, 2, 'x');
    c.px(1, 7, st.nail);
    c.px(0, 0, '.');
    c.px(0, 15, '.');
    c.px(1, 14, 'z');
  }
  if (R) {
    c.vline(15, 0, T, 'd');
    c.vline(14, 1, 14, 'y');
    c.vline(13, 1, 14, 'z');
    c.px(14, 1, 'x');
    c.px(14, 2, 'x');
    c.px(14, 7, st.nail);
    c.px(15, 0, '.');
    c.px(15, 15, '.');
    c.px(14, 14, 'z');
  }
  return c;
}

// ---------- stone brick pillar ----------
export function genBrick(st: RegionStyle, kind: 'body0' | 'body1' | 'cap'): Canvas {
  const c = new Canvas(T, T, st.pal);
  c.rect(0, 0, T, T, 'y');
  // bricks: 4-px courses, mortar on the last row of each course
  for (let course = 0; course < 4; course++) {
    const y = course * 4;
    c.hline(0, y + 3, T, 'z');
    const cuts = course % 2 === 0 ? [0, 7, 15] : [3, 11];
    for (const cx of cuts) c.vline(cx, y, 3, 'z');
    // highlight top-left of each brick
    let prev = -1;
    const edges = [...cuts, 16].sort((a, b) => a - b);
    for (const e of edges) {
      const bx = prev + 1;
      if (prev >= -1 && bx < e) {
        c.hline(bx, y, Math.max(0, e - bx - 1), 'x');
        if (e - bx > 2) c.px(bx, y + 1, 'x');
        c.px(Math.min(e - 1, 15), y + 2, 'z');
      }
      prev = e;
    }
  }
  // outline / bevel for a free-standing pillar
  c.vline(0, 0, T, 'd');
  c.vline(T - 1, 0, T, 'd');
  c.vline(1, 0, T, 'x');
  c.vline(T - 2, 0, T, 'z');
  for (let y = 0; y < T; y += 4) {
    c.px(1, y + 3, 'y');
    c.px(T - 2, y + 3, 'z');
  }
  if (kind === 'body1') {
    // signature "haven shard" inlay: a faceted gem set into the stone, with a dark socket
    c.stamp(4, 3, ['...dd...', '..dttd..', '.dtssrd.', 'dtsssrrd', '.dssrrd.', '..dsrd..', '...dd...']);
    c.px(4, 12, 'y');
    c.px(11, 12, 'y');
  }
  if (kind === 'cap') {
    // slab top with cover overhang
    c.rect(0, 0, T, 7, 'y');
    for (let x = 0; x < T; x++) {
      const b = [4, 4, 5, 6, 5, 4, 4, 5, 6, 6, 5, 4, 5, 6, 4, 4][x];
      for (let y = 0; y <= b; y++) {
        const d = y;
        c.px(x, y, d === 0 ? '4' : d === 1 ? '1' : d <= 3 ? '2' : '3');
      }
      c.px(x, b, x % 2 ? '3' : '4');
      c.px(x, b + 1, 'z');
    }
    c.vline(0, 0, T, 'd');
    c.vline(T - 1, 0, T, 'd');
    c.px(0, 0, '.');
    c.px(T - 1, 0, '.');
    // the lower half continues as brick
    c.rect(2, 8, 12, 0, 'y');
    for (let x = 2; x < T - 2; x++) c.px(x, 7, x % 7 === 3 ? 'z' : 'y');
    // restore course pattern below row 8 (rows 8..15)
    for (let y = 8; y < T; y++)
      for (let x = 1; x < T - 1; x++) {
        if (y % 4 === 3) c.px(x, y, 'z');
        else c.px(x, y, 'y');
      }
    for (const cx of [3, 11]) {
      c.vline(cx, 8, 3, 'z');
      c.vline(cx + 4 > 14 ? 7 : cx + 4, 12, 3, 'z');
    }
    c.vline(1, 8, 8, 'x');
    c.vline(T - 2, 8, 8, 'z');
    tuft(c, 3, true);
    tuft(c, 8);
    tuft(c, 12, true);
  }
  return c;
}

// ---------- bounce pad ----------
/** Spring pad: flared base, coil, red top plate with highlight. frame: 0 rest, 1 compressed, 2 released (stretched). */
export function genBounce(st: RegionStyle, frame: 0 | 1 | 2): Canvas {
  const c = new Canvas(T, T, st.pal);
  const plateY = frame === 0 ? 1 : frame === 1 ? 6 : 0;
  const coilW = frame === 0 ? 8 : frame === 1 ? 10 : 6;
  // base (feet) rows 13..15
  c.hline(1, 13, 14, 'd');
  c.hline(1, 14, 14, 'd');
  c.hline(2, 15, 12, 'd');
  c.hline(2, 13, 12, 'x');
  c.hline(2, 14, 12, 'y');
  c.hline(2, 15, 12, 'z');
  c.hline(1, 13, 1, 'd');
  c.px(3, 13, 'x');
  c.px(4, 13, 't');
  c.px(3, 14, st.nail === 'r' ? 'r' : 's');
  c.px(12, 14, st.nail === 'r' ? 'r' : 's');
  // coil
  const cx0 = Math.round(8 - coilW / 2);
  const top = plateY + 4;
  const bottom = 12;
  for (let y = top; y <= bottom; y++) {
    const k = y - top;
    const ring = k % 3; // 3-row pitch: light, mid, shadow
    const inset = frame === 1 && ring === 1 ? 0 : frame === 2 && ring === 1 ? 1 : ring === 1 ? 0 : 1;
    const x0 = cx0 + inset;
    const w = coilW - inset * 2;
    c.hline(x0, y, w, ring === 0 ? 'y' : ring === 1 ? 'y' : 'z');
    if (ring === 0) c.hline(x0 + 1 + ((Math.floor(k / 3) * 2) % 4), y, 3, 'x'); // helical highlight drifts each turn
    c.px(x0 - 1, y, 'd');
    c.px(x0 + w, y, 'd');
    if (ring === 2) c.hline(x0, y, w, 'z');
  }
  // plate: 4 rows
  c.hline(1, plateY, 14, 'd');
  c.hline(1, plateY + 3, 14, 'd');
  c.rect(1, plateY + 1, 14, 2, 'r');
  c.hline(2, plateY + 1, 11, 's');
  c.hline(2, plateY + 1, 3, 't');
  c.hline(3, plateY + 2, 10, 'r');
  c.px(13, plateY + 2, 'c');
  c.px(14, plateY + 2, 'c');
  c.px(1, plateY + 1, 'd');
  c.px(14, plateY + 1, 'd');
  c.px(1, plateY, '.');
  c.px(14, plateY, '.');
  c.px(1, plateY + 3, '.');
  c.px(14, plateY + 3, '.');
  c.px(0, plateY + 1, '.');
  c.px(15, plateY + 1, '.');
  if (frame === 2) {
    // release sparkles
    c.px(0, 2, 't');
    c.px(15, 2, 't');
    c.px(2, 0, 's');
    c.px(13, 0, 's');
    c.px(0, 6, 's');
    c.px(15, 6, 's');
  }
  return c;
}
