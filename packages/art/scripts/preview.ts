// Contact-sheet renderer used by build-characters: 4x nearest-neighbour, labelled, on light + dark panels.
import { blit, createBitmap, type Bitmap } from '../src/core';
import { drawText, FONT_5X7 } from '../src/characters/font';
import { fillRect, scaleBitmap } from '../src/characters/compose';

export interface PreviewGroup {
  title: string;
  frames: [string, Bitmap][];
}

const LIGHT = { bg: '#c9e4ee', cell: '#d8eef5', text: '#2b2350', ground: '#8aa9b8' };
const DARK = { bg: '#1c1838', cell: '#262049', text: '#e6dfff', ground: '#4a4178' };

function panel(groups: PreviewGroup[], scale: number, theme: typeof LIGHT, maxCols: number): Bitmap {
  const pad = 4;
  // compute layout
  const rows: { y: number; h: number; group: PreviewGroup; cw: number; ch: number }[] = [];
  let totalH = pad;
  let totalW = 0;
  for (const g of groups) {
    const fw = Math.max(...g.frames.map(([, b]) => b.w));
    const fh = Math.max(...g.frames.map(([, b]) => b.h));
    const cw = fw * scale + pad * 2;
    const ch = fh * scale + pad * 2 + 10;
    const lines = Math.ceil(g.frames.length / maxCols);
    const h = 12 + lines * (ch + pad);
    rows.push({ y: totalH, h, group: g, cw, ch });
    totalH += h + pad;
    totalW = Math.max(totalW, Math.min(g.frames.length, maxCols) * (cw + pad) + pad);
  }
  const out = createBitmap(totalW, totalH);
  fillRect(out, 0, 0, totalW, totalH, theme.bg);
  for (const r of rows) {
    blit(out, drawText(r.group.title.toUpperCase(), FONT_5X7, { color: theme.text, outline: null }), pad, r.y);
    r.group.frames.forEach(([name, b], i) => {
      const cx = pad + (i % maxCols) * (r.cw + pad);
      const cy = r.y + 12 + Math.floor(i / maxCols) * (r.ch + pad);
      fillRect(out, cx, cy, r.cw, r.ch, theme.cell);
      const sb = scaleBitmap(b, scale);
      const fh = r.ch - 10 - pad * 2;
      // bottom-anchored inside cell, horizontally centred; ground line under feet
      const ox = cx + Math.floor((r.cw - sb.w) / 2);
      const oy = cy + pad + (fh - sb.h);
      fillRect(out, cx + 2, cy + pad + fh, r.cw - 4, 1, theme.ground);
      blit(out, sb, ox, oy);
      const label = name.replace(/^[a-z_]+\//, '');
      blit(out, drawText(label, FONT_5X7, { color: theme.text, outline: null }), cx + 2, cy + r.ch - 9);
    });
  }
  return out;
}

export function contactSheet(groups: PreviewGroup[], scale = 4, maxCols = 8): Bitmap {
  const a = panel(groups, scale, LIGHT, maxCols);
  const b = panel(groups, scale, DARK, maxCols);
  const out = createBitmap(Math.max(a.w, b.w), a.h + b.h);
  blit(out, a, 0, 0);
  blit(out, b, 0, a.h);
  return out;
}
