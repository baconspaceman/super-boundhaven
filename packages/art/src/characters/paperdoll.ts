// Paper-doll compositor: look + pose -> 24x32 bitmap. Head-space layers (hair/face/hat) are authored
// once; arms/legs are painted per pose along the skeleton so every combination animates correctly.
import { createBitmap, fromRows, packSheet, type AtlasEntry, type Bitmap, type Palette } from '../core';
import {
  canvasRows,
  linePoints,
  makeCanvas,
  outlineRows,
  stamp,
  type Canvas,
} from './compose';
import { HERO_ANIMS, HERO_FRAME_NAMES, HERO_H, HERO_POSES, HERO_W, TUCK_POSE, poseKeyForFrame, type Pose } from './anims';
import {
  allTo2,
  darkenRows,
  leanRows,
  OUTLINE_MAP,
  shadeMask,
  tintStreak,
  tintTips,
  type MaskLayer,
  type SlotMap,
} from './layers';
import { buildPalette, SLOT_CHARS, type LookColors } from './palettes';
import { CHARACTER_OPTIONS, encodeLook, type CharacterLook } from './look';
import { ACC_HEAD, BROWS, CELL_H, CELL_W, EYES, HAIR, HATS, MOUTHS, MOUTH_STATES, SKULL, SKULL_X, SKULL_Y } from './parts_head';
import { ACC_TORSO, BACKS, BOTTOMS, SHOES, TOPS } from './parts_body';

// big working canvas with margins so clipping is detectable
const MX = 12;
const MY = 12;
const BW = HERO_W + MX * 2;
const BH = HERO_H + MY * 2;

class Local {
  c: Canvas;
  constructor(
    public w: number,
    public h: number,
    public ox: number,
    public oy: number,
  ) {
    this.c = makeCanvas(w, h);
  }
  put(rows: string[], x: number, y: number) {
    stamp(this.c, rows, x + this.ox, y + this.oy);
  }
}

interface Group {
  rows: string[];
  x: number; // frame position of rows[0][0] (before outline), frame coords w/o margin
  y: number;
}

/** Crop a local canvas to its content and map to frame coordinates given the local origin's frame position. */
function finish(l: Local, originX: number, originY: number): Group | null {
  let minX = 1e9, minY = 1e9, maxX = -1, maxY = -1;
  l.c.forEach((row, y) => row.forEach((ch, x) => {
    if (ch !== '.') {
      minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
  }));
  if (maxX < 0) return null;
  const rows = l.c.slice(minY, maxY + 1).map((r) => r.slice(minX, maxX + 1).join(''));
  return { rows, x: originX + minX - l.ox, y: originY + minY - l.oy };
}

function emit(dst: Canvas, g: Group | null, opts: { dark?: boolean; lean?: number } = {}) {
  if (!g) return;
  let { rows, x } = g;
  if (opts.lean) {
    const l = leanRows(rows, opts.lean);
    rows = l.rows;
    x += l.ox;
  }
  if (opts.dark) rows = darkenRows(rows);
  stamp(dst, outlineRows(rows, OUTLINE_MAP), x - 1 + MX, g.y - 1 + MY);
}

// ---------------------------------------------------------------------------------------------
export interface Joints {
  head: [number, number];
  torso: [number, number];
  handNear: [number, number];
  handFar: [number, number];
  footNear: [number, number];
  footFar: [number, number];
}

export interface Rendered {
  canvas: Canvas; // BW x BH
  pal: Palette;
  joints: Joints;
}

function colorsFromLook(look: CharacterLook): LookColors {
  return {
    skin: look.skin,
    hair: look.hairColor,
    hair2: look.hairTint === 0 ? look.hairColor : look.hairTintColor,
    eye: look.eyeColor,
    top1: look.topC1, top2: look.topC2,
    bot1: look.botC1, bot2: look.botC2,
    shoe1: look.shoeC1, shoe2: look.shoeC2,
    hat1: look.hatC1, hat2: look.hatC2,
    back1: look.backC1, back2: look.backC2,
    acc1: look.accC1, acc2: look.accC2,
  };
}

const SLOTS = {
  hair: { '0': 'skin', '1': 'hair', '2': 'hair2' } as SlotMap,
  hat: { '0': 'skin', '1': 'hat1', '2': 'hat2' } as SlotMap,
  top: { '0': 'skin', '1': 'top1', '2': 'top2' } as SlotMap,
  bot: { '0': 'skin', '1': 'bot1', '2': 'bot2' } as SlotMap,
  shoe: { '0': 'skin', '1': 'shoe1', '2': 'shoe2' } as SlotMap,
  back: { '0': 'skin', '1': 'back1', '2': 'back2' } as SlotMap,
  acc: { '0': 'skin', '1': 'acc1', '2': 'acc2' } as SlotMap,
};

function shadeLayer(l: MaskLayer, map: SlotMap, tx?: (rows: string[]) => string[]): MaskLayer {
  const rows = tx ? tx(l.rows) : l.rows;
  return { x: l.x, y: l.y, rows: shadeMask(rows, map) };
}

function shearBottom(rows: string[], amt: number, pow = 1.4): { rows: string[]; ox: number } {
  const n = rows.length;
  const shifts = rows.map((_, i) => Math.round(amt * Math.pow(i / Math.max(1, n - 1), pow)));
  const minS = Math.min(0, ...shifts);
  const maxS = Math.max(0, ...shifts);
  const w = Math.max(...rows.map((r) => r.length)) + maxS - minS;
  return { ox: minS, rows: rows.map((r, i) => '.'.repeat(shifts[i] - minS) + r.padEnd(w - (shifts[i] - minS), '.')) };
}

// ---------------------------------------------------------------------------------------------
// limb painting
function paintLimb(
  w: number,
  h: number,
  pts: [number, number][],
  thick: number,
  pick: (i: number, leftEdge: boolean) => string, // returns a tone triple string like 'ABC'
  hand?: { at: [number, number]; w: number; h: number; tri: string },
): string[] {
  const mask: number[][] = Array.from({ length: h }, () => Array<number>(w).fill(-2)); // -2 empty
  pts.forEach(([px, py], i) => {
    for (let dy = 0; dy < thick; dy++)
      for (let dx = 0; dx < thick; dx++) {
        const x = px + dx, y = py + dy;
        if (x >= 0 && y >= 0 && x < w && y < h) mask[y][x] = i;
      }
  });
  if (hand)
    for (let dy = 0; dy < hand.h; dy++)
      for (let dx = 0; dx < hand.w; dx++) {
        const x = hand.at[0] + dx, y = hand.at[1] + dy;
        if (x >= 0 && y >= 0 && x < w && y < h) mask[y][x] = -1;
      }
  const occ = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && mask[y][x] !== -2;
  return mask.map((row, y) => {
    let out = '';
    for (let x = 0; x < w; x++) {
      const v = row[x];
      if (v === -2) { out += '.'; continue; }
      const left = !occ(x - 1, y), top = !occ(x, y - 1), bot = !occ(x, y + 1), right = !occ(x + 1, y);
      const tri = v === -1 && hand ? hand.tri : pick(v, left);
      let idx = 1;
      if (top && !bot) idx = 0;
      else if (bot && !top) idx = 2;
      else if (!top && !bot) idx = left && !right ? 1 : right && !left ? 2 : 1;
      out += tri[Math.min(idx, tri.length - 1)];
    }
    return out;
  });
}

// ---------------------------------------------------------------------------------------------
export function renderCharacter(look: CharacterLook, pose: Pose): Rendered {
  const c = makeCanvas(BW, BH);
  const pal = buildPalette(colorsFromLook(look));
  const top = TOPS[look.top];
  const bottom = BOTTOMS[look.bottom];
  const shoe = SHOES[look.shoes];
  const hair = HAIR[look.hair];
  const hat = HATS[look.hat];
  const back = BACKS[look.back];
  const accName = CHARACTER_OPTIONS.categories.find((k) => k.key === 'acc')!.names[look.acc];

  const extra = pose.torsoExtra ?? 0;
  const shoeRows = shoe.rows.length;
  // `fit` poses (crouch) lower the body only as far as the shoes still end on the ground line (30)
  const dy = pose.fit ? Math.min(pose.dy ?? 0, 17 - (9 + extra) - shoeRows) : (pose.dy ?? 0);
  const tdx = pose.torsoDx ?? 0;
  const torsoX = 8 + tdx;
  const torsoY = 14 + dy;
  const th = 9 + extra;
  const headX = 4 + tdx + (pose.headDx ?? 0);
  const headY = torsoY - 13 + (pose.headDy ?? 0);
  const hipY = torsoY + th - 1;
  const SHOE_BOTTOM = 30;
  const shoeH = shoe.rows.length;

  // ---- back group (cape / wings / backpack / tail / scarf tail) ----
  {
    const l = new Local(40, 40, 16, 12); // origin = torso (0,0)
    const bp = pose.back ?? 0;
    const place = (layer: MaskLayer, shear?: number, lift = 0) => {
      const sh = shadeLayer(layer, SLOTS.back);
      let rows = sh.rows;
      let ox = 0;
      if (shear) { const r = shearBottom(rows, shear); rows = r.rows; ox = r.ox; }
      l.put(rows, sh.x + ox, sh.y + lift);
    };
    if (back.kind === 'cape' && back.layer) {
      
      place(back.layer, [0, -2, -3, -4][bp], bp >= 2 ? -1 : 0);
    } else if (back.kind === 'tail' && back.layer) place(back.layer, [0, -2, -3, -5][bp]);
    else if (back.kind === 'rigid' && back.layer) place(back.layer);
    else if (back.kind === 'wings' && back.wings) place(back.wings[[0, 1, 2, 2][bp]]);
    if (accName === 'Scarf' && ACC_TORSO.Scarf.tail) {
      const t = ACC_TORSO.Scarf.tail;
      const sh = shadeLayer(t, SLOTS.acc);
      const r = shearBottom(sh.rows, [0, -2, -3, -5][bp]);
      l.put(r.rows, sh.x + r.ox, sh.y);
    }
    emit(c, finish(l, torsoX, torsoY));
  }

  // ---- hair back (behind everything but back items) ----
  const headPlacement = { x: headX, y: headY };
  const tilt = pose.tilt ?? 0;
  const hairTx = (kind: 'front' | 'back') => (rows: string[]): string[] => {
    const m = look.hairTint;
    if (m === 1) return tintTips(rows, 3);
    if (m === 2 && kind === 'front') return tintStreak(rows);
    if (m === 3) return kind === 'back' ? allTo2(rows) : tintTips(rows, 1);
    return rows;
  };
  if (hair.back) {
    const l = new Local(CELL_W + 8, CELL_H + 8, 4, 4);
    const sh = shadeLayer(hair.back, SLOTS.hair, hairTx('back'));
    l.put(sh.rows, sh.x, sh.y);
    emit(c, finish(l, headPlacement.x, headPlacement.y), { lean: tilt });
  }

  // ---- arms & legs (skeleton) ----
  const joints: Joints = { head: [headX, headY], torso: [torsoX, torsoY], handNear: [0, 0], handFar: [0, 0], footNear: [0, 0], footFar: [0, 0] };
  const skinTri = SLOT_CHARS.skin;

  const drawArm = (near: boolean) => {
    const hand = near ? pose.armNear : pose.armFar;
    const sx = near ? torsoX + 7 : torsoX - 1;
    const sy = torsoY + 2;
    const l = new Local(24, 24, 10, 10);
    const pts = linePoints(10, 10, 10 + hand[0], 10 + hand[1]);
    const n = pts.length;
    const sleeveTri = SLOT_CHARS.top1;
    const sl = top.sleeve;
    const rows = paintLimb(
      24, 24, pts, 2,
      (i) => (sl === 2 ? (i < n - 2 ? sleeveTri : skinTri) : sl === 1 ? (i < 2 ? sleeveTri : skinTri) : skinTri),
      { at: [pts[n - 1][0] + (near ? 0 : -1), pts[n - 1][1]], w: 3, h: 3, tri: skinTri },
    );
    l.put(rows, -10, -10);
    const g = finish(l, sx, sy);
    emit(c, g, { dark: !near });
    const hx = pts[n - 1][0] - 10 + sx + (near ? 1 : 0);
    const hy = pts[n - 1][1] - 10 + sy + 1;
    if (near) joints.handNear = [hx, hy]; else joints.handFar = [hx, hy];
  };

  const drawLeg = (near: boolean) => {
    const leg = near ? pose.near : pose.far;
    const hipX = torsoX + (near ? 4 : 0);
    const footTop = SHOE_BOTTOM - (shoeH - 1) - leg.lift;
    const len = Math.max(1, footTop - hipY);
    const l = new Local(28, 28, 10, 2);
    const pts = linePoints(10, 2, 10 + leg.dx, 2 + len - 1);
    const n = pts.length;
    const pantTri = SLOT_CHARS.bot1;
    const pant2 = SLOT_CHARS.bot2;
    const shoeTri = SLOT_CHARS.shoe1;
    const rows = paintLimb(28, 28, pts, 2, (i, leftEdge) => {
      if (i >= n - shoe.shaft && shoe.shaft > 0) return shoeTri;
      if (i < bottom.legLen) {
        if (bottom.pattern === 'cuff' && i === Math.min(n, bottom.legLen) - 1) return pant2;
        if (bottom.pattern === 'stockings') return i % 2 === 1 ? pant2 : pantTri;
        if (bottom.pattern === 'pocket' && i === 1) return pant2;
        if (bottom.pattern === 'stripe' && leftEdge) return pant2;
        return pantTri;
      }
      return skinTri;
    });
    l.put(rows, -10, -2);
    // shoe
    const shoeRows = shadeMask(shoe.rows, SLOTS.shoe);
    l.put(shoeRows, leg.dx - 1, len);
    emit(c, finish(l, hipX, hipY), { dark: !near });
    const fx = hipX + leg.dx + 1;
    const fy = SHOE_BOTTOM - leg.lift;
    if (near) joints.footNear = [fx, fy]; else joints.footFar = [fx, fy];
  };

  drawArm(false);
  drawLeg(false);
  drawLeg(true);

  // ---- torso group ----
  {
    const l = new Local(24, 24, 8, 4); // origin = torso (0,0)
    // bottoms' over layer (skirts), then hips, then top
    const rowsAll: string[] = [];
    const topRows = top.rows;
    // chest rows 0..6 (+ extras) ; squash/stretch adjusts chest rows, hips stay last
    const chest = topRows.slice(0, 7);
    let ch = [...chest];
    if (extra > 0) for (let i = 0; i < extra; i++) ch.splice(3, 0, chest[3]);
    if (extra < 0) ch = ch.filter((_, i) => !(i === 3 && extra <= -1) && !(i === 2 && extra <= -2));
    const hipShaded = shadeMask(bottom.hip, SLOTS.bot);
    const hipY0 = ch.length;
    if (bottom.over) {
      const sh = shadeLayer(bottom.over, SLOTS.bot);
      l.put(sh.rows, sh.x, sh.y + extra);
    }
    l.put(hipShaded, 0, hipY0);
    const chestShaded = shadeMask(ch, SLOTS.top);
    // tall tops (tunic) provide extra rows 7+ drawn over the hips
    if (topRows.length > 7) {
      const tall = shadeMask(topRows.slice(7), SLOTS.top);
      l.put(tall, 0, hipY0);
    }
    l.put(chestShaded, 0, 0);
    if (top.over) {
      const sh = shadeLayer(top.over, SLOTS.top);
      l.put(sh.rows, sh.x, sh.y + extra);
    }
    // torso accessories
    const acc = ACC_TORSO[accName];
    if (acc) for (const layer of acc.layers) { const sh = shadeLayer(layer, SLOTS.acc); l.put(sh.rows, sh.x, sh.y); }
    rowsAll.length = 0;
    emit(c, finish(l, torsoX, torsoY));
  }

  // ---- near arm (over torso) ----
  drawArm(true);

  // ---- head group ----
  {
    const l = new Local(CELL_W + 8, CELL_H + 8, 4, 4); // origin = cell (0,0)
    if (hat.back) { const sh = shadeLayer(hat.back, SLOTS.hat); l.put(sh.rows, sh.x, sh.y); }
    l.put(SKULL, SKULL_X, SKULL_Y);
    // face
    const lookDy = pose.look ?? 0;
    const fy = SKULL_Y + lookDy;
    const eyeState = pose.eyes ?? 'open';
    const eye = EYES[look.eyes];
    const nearX = SKULL_X + 4;
    const farX = SKULL_X + 8;
    if (eyeState === 'wince') {
      l.put(['P.', '.P', 'P.'], nearX, fy + 4);
      l.put(['.P', 'P.', '.P'], farX, fy + 4);
    } else if (eyeState === 'blink' || eyeState === 'shut') {
      const w = eye.glyph[0].length;
      const row = 'P'.repeat(Math.min(w, 2));
      l.put([row], nearX, fy + eye.dy + eye.glyph.length - 1);
      l.put([row], farX, fy + eye.dy + eye.glyph.length - 1);
    } else {
      l.put(eye.glyph, nearX, fy + eye.dy);
      l.put(eye.glyph, farX, fy + eye.dy);
    }
    const bs = pose.brows ?? 'style';
    const brow = BROWS[look.brows];
    if (bs === 'angry') {
      l.put(['FF.', '..F'], nearX, fy + 3);
      l.put(['.FF', 'F..'], farX + 1, fy + 3);
    } else {
      const bdy = bs === 'up' || bs === 'worry' ? 2 : 3;
      l.put(brow.near, nearX, fy + bdy);
      l.put(brow.far, farX, fy + bdy);
      if (look.brows === 4) { l.put(brow.near, nearX, fy + bdy - 1); l.put(brow.far, farX, fy + bdy - 1); }
      if (look.brows === 2 && bs === 'style') { l.put(['F'], nearX + 2, fy + 4); l.put(['F'], farX, fy + 4); }
    }
    const ms = pose.mouth ?? 'style';
    const mouth = ms === 'style' ? MOUTHS[look.mouth] : MOUTH_STATES[ms];
    l.put(mouth.glyph, SKULL_X + mouth.x, fy + mouth.y);
    // hair front, face accessories, hat
    if (hair.front) { const sh = shadeLayer(hair.front, SLOTS.hair, hairTx('front')); l.put(sh.rows, sh.x, sh.y); }
    const ah = ACC_HEAD[accName];
    if (ah) { const sh = shadeLayer(ah, SLOTS.acc); l.put(sh.rows, sh.x, sh.y); }
    if (hat.layer) { const sh = shadeLayer(hat.layer, SLOTS.hat); l.put(sh.rows, sh.x, sh.y); }
    emit(c, finish(l, headX, headY), { lean: tilt });
  }

  return { canvas: c, pal, joints };
}

// ---------------------------------------------------------------------------------------------
export interface FrameInfo {
  bitmap: Bitmap;
  /** true if any pixel fell outside the 24x32 frame */
  clipped: boolean;
  joints: Joints;
}

function canvasToFrame(r: Rendered): { rows: string[]; clipped: boolean } {
  const rows: string[] = [];
  let clipped = false;
  r.canvas.forEach((row, y) => {
    row.forEach((ch, x) => {
      if (ch !== '.' && (x < MX || x >= MX + HERO_W || y < MY || y >= MY + HERO_H)) clipped = true;
    });
    if (y >= MY && y < MY + HERO_H) rows.push(row.slice(MX, MX + HERO_W).join(''));
  });
  return { rows, clipped };
}

function _unusedRotateCrop(rows: string[], turns: number): string[] {
  let g = rows.map((r) => r.split(''));
  let minX = 99, minY = 99, maxX = -1, maxY = -1;
  g.forEach((row, y) => row.forEach((ch, x) => { if (ch !== '.') { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); } }));
  g = g.slice(minY, maxY + 1).map((r) => r.slice(minX, maxX + 1));
  for (let t = 0; t < turns; t++) {
    const h = g.length, w = g[0].length;
    const n: string[][] = Array.from({ length: w }, () => Array<string>(h).fill('.'));
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) n[x][h - 1 - y] = g[y][x];
    g = n;
  }
  return g.map((r) => r.join(''));
}

/** Horizontal squash (spin/flip illusion): keep a fraction of columns, re-centred on x=12. */
function squashX(rows: string[], keep: number): string[] {
  if (keep >= 1) return rows;
  const w = HERO_W;
  let minX = w, maxX = -1;
  rows.forEach((r) => { for (let x = 0; x < w; x++) if (r[x] !== '.') { minX = Math.min(minX, x); maxX = Math.max(maxX, x); } });
  const cw = maxX - minX + 1;
  const nw = Math.max(3, Math.round(cw * keep));
  const cols: number[] = [];
  for (let i = 0; i < nw; i++) cols.push(minX + Math.min(cw - 1, Math.floor(((i + 0.5) * cw) / nw)));
  const off = Math.round(12 - nw / 2);
  return rows.map((r) => {
    const out = Array<string>(w).fill('.');
    cols.forEach((sx, i) => { if (off + i >= 0 && off + i < w) out[off + i] = r[sx]; });
    return out.join('');
  });
}

const FLASH: [Palette, Palette] = [{}, {}];
for (const k of 'ABCDEFGHIJKLMNOQRSTUVXYZabcdefghijklmnopqrstuvwWP') {
  const dark = 'CFILOSVZcfilosu'.includes(k) || k === 'w' || k === 'P';
  FLASH[0][k] = dark ? '#b9a8f2' : '#fffaf0';
  FLASH[1][k] = dark ? '#7c6fd0' : '#d9d0ff';
}

function renderFrameRows(look: CharacterLook, frame: string): { rows: string[]; clipped: boolean; pal: Palette; joints: Joints } {
  const name = frame.replace('hero/', '');
  if (name.startsWith('stomp_')) {
    const r = renderCharacter(look, TUCK_POSE);
    const fr = canvasToFrame(r);
    const n = Number(name.slice(6));
    const keep = [1, 0.62, 0.34, 0.62][n];
    let rows = squashX(fr.rows, keep);
    if (n === 3) rows = rows.map((row) => row.split('').reverse().join(''));
    return { rows, clipped: fr.clipped, pal: r.pal, joints: r.joints };
  }
  const pose = HERO_POSES[poseKeyForFrame(frame)];
  if (!pose) throw new Error(`unknown hero frame ${frame}`);
  const r = renderCharacter(look, pose);
  const fr = canvasToFrame(r);
  return { rows: fr.rows, clipped: fr.clipped, pal: r.pal, joints: r.joints };
}

const cache = new Map<string, FrameInfo>();

/** Compose one frame of one animation for a look. Cached per (look, frame). */
export function composeFrameInfo(look: CharacterLook, animName: string, frameIndex: number): FrameInfo {
  const anim = HERO_ANIMS[animName];
  if (!anim) throw new Error(`unknown animation ${animName}`);
  const frame = anim.frames[((frameIndex % anim.frames.length) + anim.frames.length) % anim.frames.length];
  return composeNamedFrame(look, frame);
}

export function composeNamedFrame(look: CharacterLook, frame: string): FrameInfo {
  const key = `${encodeLook(look)}|${frame}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const r = renderFrameRows(look, frame);
  let pal = r.pal;
  if (frame.startsWith('hero/flash_')) pal = FLASH[Number(frame.slice(-1))];
  const info: FrameInfo = { bitmap: fromRows(r.rows, pal), clipped: r.clipped, joints: r.joints };
  if (cache.size > 6000) cache.clear();
  cache.set(key, info);
  return info;
}

export function composeFrame(look: CharacterLook, animName: string, frameIndex: number): Bitmap {
  return composeFrameInfo(look, animName, frameIndex).bitmap;
}

/** Per-frame char rows (palette-indexed) for a look; used by tests to count layer colors etc. */
export function composeFrameRows(look: CharacterLook, frame: string): string[] {
  return renderFrameRows(look, frame).rows;
}

/** Every hero frame for a look packed into one sheet + atlas (left-facing is flipH at runtime). */
export function composeSheet(look: CharacterLook, maxWidth = 240): { sheet: Bitmap; atlas: Record<string, AtlasEntry> } {
  const frames: Record<string, Bitmap> = {};
  for (const f of HERO_FRAME_NAMES) frames[f] = composeNamedFrame(look, f).bitmap;
  return packSheet(frames, maxWidth, 1);
}

export function clearFrameCache(): void {
  cache.clear();
}

export { createBitmap };
