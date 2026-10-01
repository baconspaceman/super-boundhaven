import { TILE } from './config';

/**
 * Tile legend:
 *  '.' empty   '#' solid   'B' bounce pad (solid, launches)
 *  '/' slope rising to the right (45°)   '\' slope rising to the left (45°)
 *  'S' spawn marker (parsed out, becomes '.')
 */
export interface Level {
  name: string;
  width: number; // tiles
  height: number; // tiles
  tiles: string[]; // one string per row
  spawn: { x: number; y: number }; // px; y = feet
}

export function parseLevel(name: string, rows: string[]): Level {
  const width = Math.max(...rows.map((r) => r.length));
  let spawn = { x: TILE / 2, y: TILE };
  const tiles = rows.map((row, r) => {
    const padded = row.padEnd(width, '.');
    const s = padded.indexOf('S');
    if (s >= 0) {
      spawn = { x: s * TILE + TILE / 2, y: (r + 1) * TILE };
      return padded.replace('S', '.');
    }
    return padded;
  });
  return { name, width, height: rows.length, tiles, spawn };
}

/** Level edges left/right are walls; above is open; below is a pit. */
export function tileAt(level: Level, col: number, row: number): string {
  if (col < 0 || col >= level.width) return '#';
  if (row < 0 || row >= level.height) return '.';
  return level.tiles[row][col];
}

export function isSolid(ch: string): boolean {
  return ch === '#' || ch === 'B';
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
