import { parseLevel, type LevelMeta } from '../level';

/**
 * "Twin Plates": 2-4 player co-op room (design: docs/design/COOP_ROOM_M3.md). Left to right:
 *  1. entrance: two plates 25 tiles apart, both held -> gate 0 (needs 2)
 *  2. 60-tile corridor: a 5 s timed lever far from gate 1 -> a partner sprints through, latches it from the far side
 *  3. a high ledge only a held stomp-bounce off a partner reaches; its lever opens gate 2
 *  4. three of four plates held (one on a one-way platform) -> final gate 3 (needs 3, tuned for up to 4)
 * Floor top is row 13 (y=208); everything stands on row 12. Doors are full height (rows 0..12).
 */
const W = 190;
const H = 16;
const FLOOR = 13;
const ROW = 12;

type Pos = [col: number, row: number];
type Named = Record<string, Pos>;

const PLATES: Named = { A: [11, ROW], B: [36, ROW], Pa: [140, ROW], Pb: [147, 9], Pc: [161, ROW], Pd: [165, ROW] };
const LEVERS: Named = {
  reset0: [4, ROW],
  timed: [45, ROW],
  latch: [108, ROW],
  reset1: [111, ROW],
  ledge: [121, 6],
  reset2: [136, ROW],
};
const DOOR_COLS = { gate0: 40, corridor: 105, ledge: 132, final: 170 };

/** Ids follow the parser's reading order (row by row, left to right). */
function idsOf(n: Named): Record<string, number> {
  const out: Record<string, number> = {};
  Object.entries(n)
    .sort((a, b) => a[1][1] - b[1][1] || a[1][0] - b[1][0])
    .forEach(([name], i) => (out[name] = i));
  return out;
}

const plateId = idsOf(PLATES);
const leverId = idsOf(LEVERS);
const doorId = {
  gate0: 0,
  corridor: 1,
  ledge: 2,
  final: 3,
};
// door ids are by column order of their top tile; assert the layout keeps that order
const orderedCols = Object.values(DOOR_COLS);
if (orderedCols.some((c, i) => i > 0 && c <= orderedCols[i - 1])) throw new Error('coopRoom: door columns out of order');

/** Ids of the named parts, for tests, tools and the client (door/plate/lever/checkpoint/enemy ids are reading order). */
export const COOP_IDS = {
  plate: plateId,
  lever: leverId,
  door: doorId,
  checkpoint: { a: 0, b: 1, c: 2, goal: 3 },
};

function build(): string[] {
  const g: string[][] = Array.from({ length: H }, () => Array<string>(W).fill('.'));
  const put = (c: number, r: number, ch: string) => (g[r][c] = ch);
  const fill = (r1: number, r2: number, c1: number, c2: number, ch: string) => {
    for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) g[r][c] = ch;
  };

  fill(FLOOR, H - 1, 0, W - 1, '#');
  put(2, ROW, 'S');

  for (const [c, r] of Object.values(PLATES)) put(c, r, 'p');
  for (const [c, r] of Object.values(LEVERS)) put(c, r, 'l');
  for (const c of Object.values(DOOR_COLS)) fill(0, ROW, c, c, 'D');

  // 1. entrance: one-way staircase up to a patrol shelf, spikes, two far plates
  fill(11, 11, 12, 13, '-');
  fill(10, 10, 16, 17, '-');
  fill(9, 9, 20, 28, '-');
  put(22, 8, 'e');
  put(13, 10, 'o');
  put(17, 9, 'o');
  put(27, 8, 'o');
  fill(ROW, ROW, 31, 32, '^');

  // 2. corridor: spikes to hop, a one-way ledge with a shard, a flyer high above the path
  put(42, ROW, 'C');
  for (const c of [52, 70, 88]) fill(ROW, ROW, c, c + 1, '^');
  fill(10, 10, 58, 62, '-');
  put(60, 9, 'o');
  put(64, 7, 'z');
  put(80, ROW, 'o');
  put(100, ROW, 'o');

  // 3. stomp ledge: a floating slab 6 tiles above the floor (feet 96 px up)
  put(110, ROW, 'C');
  fill(7, 7, 118, 124, '#');
  put(119, 6, 'o');
  put(127, ROW, 'o');

  // 4. final: shelf with a spiky patroller, spikes, a plate on a one-way platform
  put(134, ROW, 'C');
  put(141, ROW, 'o');
  fill(10, 10, 146, 149, '-');
  put(149, 8, 'o');
  fill(9, 9, 153, 158, '#');
  put(155, 8, 'k');
  fill(ROW, ROW, 143, 144, '^');
  put(152, ROW, 'o');
  put(168, ROW, 'o');

  // goal alcove behind the final gate
  put(172, ROW, 'C');
  for (const c of [175, 177, 179, 181, 183, 185]) put(c, ROW, 'o');

  return g.map((row) => row.join(''));
}

const meta: LevelMeta = {
  links: [
    { door: doorId.gate0, plates: [plateId.A, plateId.B], linger: 300 },
    { door: doorId.corridor, levers: [leverId.timed, leverId.latch] },
    { door: doorId.ledge, levers: [leverId.ledge] },
    { door: doorId.final, plates: [plateId.Pa, plateId.Pb, plateId.Pc, plateId.Pd], need: 3, linger: 360 },
  ],
  levers: {
    [leverId.timed]: { ticks: 300 },
    [leverId.reset0]: { reset: true },
    [leverId.reset1]: { reset: true },
    [leverId.reset2]: { reset: true },
  },
  room: { minPlayers: 2, maxPlayers: 4, soloResetTicks: 600, emptyResetTicks: 600 },
};

export const COOP_ROOM = parseLevel('coopRoom', build(), meta);
