import { parseLevel, type LevelMeta } from '../level';

/**
 * "Eight Gates": 8-player raid prototype room (design: docs/design/RAID_ROOM.md, PROPOSAL until Bacon Spaceman accepts it).
 * Same parts as Twin Plates, scaled to a full party, in four segments with a checkpoint flag after each gate:
 *  1. hall: eight plates 4 tiles apart -> gate 0 (needs 6 held at once, so 2 can be missing or busy)
 *  2. 60-tile corridor: a 5 s timed lever far from gate 1 -> a sprinter slips through and latches it from the far side
 *  3. a high ledge only a held stomp-bounce off a partner reaches; its lever opens gate 2
 *  4. eight plates (two on one-way platforms) -> final gate 3 (needs 6)
 * Floor top is row 13 (y=208); everything stands on row 12. Doors are full height (rows 0..12).
 * Segments 2 and 3 are Twin Plates' proven corridor and ledge geometry shifted right by SHIFT tiles.
 */
const W = 205;
const H = 16;
const FLOOR = 13;
const ROW = 12;
const SHIFT = 7;

type Pos = [col: number, row: number];
type Named = Record<string, Pos>;

const PLATES: Named = {
  H1: [12, ROW],
  H2: [16, ROW],
  H3: [20, ROW],
  H4: [24, ROW],
  H5: [28, ROW],
  H6: [32, ROW],
  H7: [36, ROW],
  H8: [40, ROW],
  F1: [150, ROW],
  F2: [154, ROW],
  F3: [158, ROW],
  F4: [162, ROW],
  F5: [166, ROW],
  F6: [170, ROW],
  Fp1: [153, 9], // on a one-way platform
  Fp2: [165, 9],
};
const LEVERS: Named = {
  reset0: [4, ROW],
  timed: [45 + SHIFT, ROW],
  latch: [108 + SHIFT, ROW],
  reset1: [111 + SHIFT, ROW],
  ledge: [121 + SHIFT, 6],
  reset2: [136 + SHIFT, ROW],
  reset3: [174, ROW],
};
const DOOR_COLS = { gate0: 46, corridor: 105 + SHIFT, ledge: 132 + SHIFT, final: 176 };

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
const doorId = { gate0: 0, corridor: 1, ledge: 2, final: 3 };
const orderedCols = Object.values(DOOR_COLS);
if (orderedCols.some((c, i) => i > 0 && c <= orderedCols[i - 1])) throw new Error('raidRoom: door columns out of order');

/** Ids of the named parts, for tests, tools and the client (door/plate/lever/checkpoint/enemy ids are reading order). */
export const RAID_IDS = {
  plate: plateId,
  lever: leverId,
  door: doorId,
  checkpoint: { a: 0, b: 1, c: 2, d: 3, goal: 4 },
};

function build(): string[] {
  const g: string[][] = Array.from({ length: H }, () => Array<string>(W).fill('.'));
  const put = (c: number, r: number, ch: string) => (g[r][c] = ch);
  const fill = (r1: number, r2: number, c1: number, c2: number, ch: string) => {
    for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) g[r][c] = ch;
  };
  const s = SHIFT;

  fill(FLOOR, H - 1, 0, W - 1, '#');
  put(2, ROW, 'S');

  for (const [c, r] of Object.values(PLATES)) put(c, r, 'p');
  for (const [c, r] of Object.values(LEVERS)) put(c, r, 'l');
  for (const c of Object.values(DOOR_COLS)) fill(0, ROW, c, c, 'D');

  // 1. hall: shards to run for along the plate row, a gap of floor before the gate
  for (const c of [14, 18, 22, 26, 30, 34, 38]) put(c, ROW - 2, 'o');
  put(49, ROW, 'C');

  // 2. corridor (Twin Plates' geometry, shifted): spikes to hop, a one-way ledge with a shard, a flyer overhead
  put(42 + s + 7, ROW, 'C'); // after the timed lever, before the first spikes
  for (const c of [52, 70, 88]) fill(ROW, ROW, c + s, c + s + 1, '^');
  fill(10, 10, 58 + s, 62 + s, '-');
  put(60 + s, 9, 'o');
  put(64 + s, 7, 'z');
  put(80 + s, ROW, 'o');
  put(100 + s, ROW, 'o');

  // 3. stomp ledge: a floating slab 6 tiles above the floor (feet 96 px up)
  put(110 + s, ROW, 'C');
  fill(7, 7, 118 + s, 124 + s, '#');
  put(119 + s, 6, 'o');
  put(127 + s, ROW, 'o');

  // 4. final: eight plates, two on one-way platforms, spikes between them
  put(134 + s, ROW, 'C');
  fill(10, 10, 152, 155, '-');
  fill(10, 10, 164, 167, '-');
  for (const c of [148, 160, 168]) fill(ROW, ROW, c, c, '^');
  put(157, 8, 'o');
  put(163, 8, 'o');
  put(172, ROW, 'o');

  // goal alcove behind the final gate
  put(179, ROW, 'C');
  for (const c of [182, 184, 186, 188, 190, 192, 194, 196]) put(c, ROW, 'o');

  return g.map((row) => row.join(''));
}

const meta: LevelMeta = {
  links: [
    { door: doorId.gate0, plates: [plateId.H1, plateId.H2, plateId.H3, plateId.H4, plateId.H5, plateId.H6, plateId.H7, plateId.H8], need: 6, linger: 360 },
    { door: doorId.corridor, levers: [leverId.timed, leverId.latch] },
    { door: doorId.ledge, levers: [leverId.ledge] },
    {
      door: doorId.final,
      plates: [plateId.F1, plateId.F2, plateId.F3, plateId.F4, plateId.F5, plateId.F6, plateId.Fp1, plateId.Fp2],
      need: 6,
      linger: 420,
    },
  ],
  levers: {
    [leverId.timed]: { ticks: 300 },
    [leverId.reset0]: { reset: true },
    [leverId.reset1]: { reset: true },
    [leverId.reset2]: { reset: true },
    [leverId.reset3]: { reset: true },
  },
  room: { minPlayers: 6, maxPlayers: 8, soloResetTicks: 900, emptyResetTicks: 600 },
};

export const RAID_ROOM = parseLevel('raidRoom', build(), meta);
