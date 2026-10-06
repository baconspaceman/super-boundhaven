import { RULES, TILE } from './config';

/**
 * Tile legend (static tiles stay in `tiles`; markers are parsed out into entity lists and become '.'):
 *  '.' empty   '#' solid   'B' bounce pad (solid, launches)
 *  '/' slope rising to the right (45°)   '\' slope rising to the left (45°)
 *  '-' one-way platform: solid from above only, droppable (crouch)
 *  '^' spike (hurts, not solid)
 *  'D' door/gate: solid when closed; connected D tiles form one door (ids in reading order)
 * Markers (become '.'):
 *  'S' spawn   'C' checkpoint flag   'o' shard   'l' lever   'p' pressure plate
 *  'e' ground patroller   'z' sine flyer   'k' spiky patroller (cannot be stomped)
 *  'M' big button (ground-pound it; neighbouring M tiles in a row form one wider button)
 * Ids of every marker kind are assigned in reading order (row by row, left to right).
 */
export interface Point {
  x: number;
  y: number;
}

export interface EnemyDef {
  id: number;
  kind: number; // 0 walker, 1 flyer, 2 spiky walker
  x: number; // px center
  y: number; // px feet (bottom of the marker tile)
  range: number; // flyer horizontal half-range px
}

export interface PlateDef {
  id: number;
  col: number;
  row: number;
}

export interface ButtonDef {
  id: number;
  col: number; // leftmost tile
  row: number; // the tile row it sits in (it stands on the floor below)
  w: number; // width in tiles
  ticks: number; // how long a slam keeps it lit
}

export interface LeverDef {
  id: number;
  col: number;
  row: number;
  ticks: number; // >0: timed lever (on for `ticks` after each pull); 0: toggle
  reset: boolean; // pulling it resets the room (stuck-state escape hatch)
}

export interface DoorDef {
  id: number;
  tiles: [number, number][]; // [col, row]
}

export interface DoorLink {
  door: number;
  plates?: number[];
  levers?: number[];
  buttons?: number[]; // opens while ALL of these are lit at once (slams within `ticks` of each other)
  need?: number; // plates that must be held at once (default: all listed)
  linger?: number; // ticks the door stays open after its condition lapses (time to run through)
}

export interface RoomMeta {
  minPlayers: number; // room needs this many connected players to hold progress
  maxPlayers?: number;
  soloResetTicks: number; // progress + fewer than minPlayers for this long => reset
  emptyResetTicks: number; // progress + nobody for this long => reset
}

/** Optional level metadata, passed to parseLevel as an object or a JSON string. */
export interface LevelMeta {
  links?: DoorLink[];
  levers?: Record<number, { ticks?: number; reset?: boolean }>;
  buttons?: Record<number, { ticks?: number }>;
  enemies?: Record<number, { range?: number }>;
  room?: RoomMeta;
}

export interface Level {
  name: string;
  width: number; // tiles
  height: number; // tiles
  tiles: string[]; // one string per row
  spawn: { x: number; y: number }; // px; y = feet
  checkpoints: Point[]; // px; y = feet
  shards: Point[]; // px center
  enemies: EnemyDef[];
  plates: PlateDef[];
  levers: LeverDef[];
  buttons: ButtonDef[];
  doors: DoorDef[];
  doorAt: Int16Array; // width*height, door id or -1
  links: DoorLink[];
  meta: LevelMeta;
  room: RoomMeta;
}

const MARKERS = 'SClpoezkM';

export function parseLevel(name: string, rows: string[], metaIn?: LevelMeta | string): Level {
  const meta: LevelMeta = typeof metaIn === 'string' ? (JSON.parse(metaIn) as LevelMeta) : (metaIn ?? {});
  const width = Math.max(...rows.map((r) => r.length));
  const height = rows.length;
  let spawn: Point | null = null;
  const checkpoints: Point[] = [];
  const shards: Point[] = [];
  const enemies: EnemyDef[] = [];
  const plates: PlateDef[] = [];
  const levers: LeverDef[] = [];
  const buttons: ButtonDef[] = [];

  const tiles = rows.map((row, r) => {
    const padded = row.padEnd(width, '.');
    let out = '';
    for (let c = 0; c < width; c++) {
      const ch = padded[c];
      if (MARKERS.indexOf(ch) < 0) {
        out += ch;
        continue;
      }
      out += '.';
      const cx = c * TILE + TILE / 2;
      const feet = (r + 1) * TILE;
      switch (ch) {
        case 'S':
          if (!spawn) spawn = { x: cx, y: feet };
          break;
        case 'C':
          checkpoints.push({ x: cx, y: feet });
          break;
        case 'o':
          shards.push({ x: cx, y: r * TILE + TILE / 2 });
          break;
        case 'p':
          plates.push({ id: plates.length, col: c, row: r });
          break;
        case 'l': {
          const id = levers.length;
          const m = meta.levers?.[id];
          levers.push({ id, col: c, row: r, ticks: m?.ticks ?? 0, reset: m?.reset ?? false });
          break;
        }
        case 'M': {
          const prev = buttons[buttons.length - 1];
          if (prev && prev.row === r && prev.col + prev.w === c) prev.w++;
          else buttons.push({ id: buttons.length, col: c, row: r, w: 1, ticks: meta.buttons?.[buttons.length]?.ticks ?? RULES.buttonTicks });
          break;
        }
        default: {
          const id = enemies.length;
          const kind = ch === 'e' ? 0 : ch === 'z' ? 1 : 2;
          enemies.push({ id, kind, x: cx, y: feet, range: meta.enemies?.[id]?.range ?? 32 });
        }
      }
    }
    return out;
  });

  // doors: 4-connected components of 'D', ids in reading order of their first tile
  const doorAt = new Int16Array(width * height).fill(-1);
  const doors: DoorDef[] = [];
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      if (tiles[r][c] !== 'D' || doorAt[r * width + c] >= 0) continue;
      const door: DoorDef = { id: doors.length, tiles: [] };
      const stack: [number, number][] = [[c, r]];
      doorAt[r * width + c] = door.id;
      while (stack.length) {
        const [cc, rr] = stack.pop()!;
        door.tiles.push([cc, rr]);
        for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const nc = cc + dc;
          const nr = rr + dr;
          if (nc < 0 || nr < 0 || nc >= width || nr >= height) continue;
          if (tiles[nr][nc] === 'D' && doorAt[nr * width + nc] < 0) {
            doorAt[nr * width + nc] = door.id;
            stack.push([nc, nr]);
          }
        }
      }
      door.tiles.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
      doors.push(door);
    }
  }

  const links = meta.links ?? [];
  for (const l of links) {
    if (!doors[l.door]) throw new Error(`${name}: link to missing door ${l.door}`);
    for (const p of l.plates ?? []) if (!plates[p]) throw new Error(`${name}: link to missing plate ${p}`);
    for (const v of l.levers ?? []) if (!levers[v]) throw new Error(`${name}: link to missing lever ${v}`);
    for (const b of l.buttons ?? []) if (!buttons[b]) throw new Error(`${name}: link to missing button ${b}`);
  }

  return {
    name,
    width,
    height,
    tiles,
    spawn: spawn ?? { x: TILE / 2, y: TILE },
    checkpoints,
    shards,
    enemies,
    plates,
    levers,
    buttons,
    doors,
    doorAt,
    links,
    meta,
    room: meta.room ?? { ...RULES.defaultRoom },
  };
}

/**
 * Level edges left/right are walls; above is open; below is a pit.
 * Doors: 'D' when closed, 'd' (not solid) when open in `dynamic` (door id -> open). Without `dynamic`, doors read closed.
 */
export function tileAt(level: Level, col: number, row: number, dynamic?: Record<number, boolean>): string {
  if (col < 0 || col >= level.width) return '#';
  if (row < 0 || row >= level.height) return '.';
  const ch = level.tiles[row][col];
  if (ch === 'D' && dynamic !== undefined && dynamic[level.doorAt[row * level.width + col]]) return 'd';
  return ch;
}

export function isSolid(ch: string): boolean {
  return ch === '#' || ch === 'B' || ch === 'D';
}

/** One-way platform: solid from above only. */
export function isSemiSolid(ch: string): boolean {
  return ch === '-';
}

export function isSlope(ch: string): boolean {
  return ch === '/' || ch === '\\';
}

/** Absolute floor y of a slope tile at horizontal position x. */
export function slopeFloor(ch: string, col: number, row: number, x: number): number {
  const left = col * TILE;
  const top = row * TILE;
  return ch === '/' ? top + TILE - (x - left) : top + (x - left);
}
