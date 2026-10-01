// Pure atlas-json helpers (no Pixi) so they can be unit-tested.
export interface AtlasFrame {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Pull the frame table out of whichever shape the atlas json uses ({frames}, {tiles}, {objects} or a bare map). */
export function parseFrames(j: unknown): Record<string, AtlasFrame> {
  if (!j || typeof j !== 'object') return {};
  const o = j as Record<string, unknown>;
  const cand = (o.frames ?? o.objects ?? o.tiles ?? o) as Record<string, unknown>;
  const out: Record<string, AtlasFrame> = {};
  for (const k in cand) {
    const f = cand[k] as Partial<AtlasFrame> | null;
    if (f && typeof f === 'object' && typeof f.x === 'number' && typeof f.y === 'number' && typeof f.w === 'number' && typeof f.h === 'number') {
      out[k] = { x: f.x, y: f.y, w: f.w, h: f.h };
    }
  }
  return out;
}

