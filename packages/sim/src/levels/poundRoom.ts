import { parseLevel, type LevelMeta } from '../level';

/**
 * "Slam Dunk": 2-4 player room built around the ground pound and big buttons (PROPOSAL, see docs/design/GROUND_POUND.md).
 * A big button lights for 3 s after a slam, and a gate opens while ALL its buttons are lit at once, so partners only
 * have to slam within 3 s of each other (not on the same frame). Left to right:
 *  1. one big button, no partner needed: teaches DOWN in the air
 *  2. two buttons 30 tiles apart: running between them takes longer than the window, so it takes two players
 *  3. three buttons 13 tiles apart behind spikes: two players can still do it by slamming ends, then the middle
 * Floor top is row 13 (y=208); everything stands on row 12. Doors are full height (rows 0..12).
 */
const W = 125;
const H = 16;
const FLOOR = 13;
const ROW = 12;

type Pos = [col: number, row: number];
type Named = Record<string, Pos>;

/** Left tile of each 2-wide button. */
const BUTTONS: Named = { A: [14, ROW], B1: [30, ROW], B2: [60, ROW], C1: [75, ROW], C2: [88, ROW], C3: [101, ROW] };
const LEVERS: Named = { reset0: [4, ROW], reset1: [25, ROW], reset2: [70, ROW] };
const DOOR_COLS = { gate0: 20, gate1: 66, gate2: 108 };

function idsOf(n: Named): Record<string, number> {
  const out: Record<string, number> = {};
  Object.entries(n)
    .sort((a, b) => a[1][1] - b[1][1] || a[1][0] - b[1][0])
    .forEach(([name], i) => (out[name] = i));
  return out;
}

const buttonId = idsOf(BUTTONS);
const leverId = idsOf(LEVERS);
const doorId = { gate0: 0, gate1: 1, gate2: 2 };
const orderedCols = Object.values(DOOR_COLS);
if (orderedCols.some((c, i) => i > 0 && c <= orderedCols[i - 1])) throw new Error('poundRoom: door columns out of order');

/** Ids of the named parts, for tests, tools and the client. */
export const POUND_IDS = {
  button: buttonId,
  lever: leverId,
  door: doorId,
  checkpoint: { a: 0, b: 1, goal: 2 },
};

function build(): string[] {
  const g: string[][] = Array.from({ length: H }, () => Array<string>(W).fill('.'));
  const put = (c: number, r: number, ch: string) => (g[r][c] = ch);
  const fill = (r1: number, r2: number, c1: number, c2: number, ch: string) => {
    for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) g[r][c] = ch;
  };

  fill(FLOOR, H - 1, 0, W - 1, '#');
  put(2, ROW, 'S');
  for (const [c, r] of Object.values(BUTTONS)) fill(r, r, c, c + 1, 'M');
  for (const [c, r] of Object.values(LEVERS)) put(c, r, 'l');
  for (const c of Object.values(DOOR_COLS)) fill(0, ROW, c, c, 'D');

  // 1. tutorial hall
  for (const c of [8, 10, 12, 16, 18]) put(c, ROW - 2, 'o');
  put(23, ROW, 'C');

  // 2. long hall: spikes to hop on the way between the two buttons
  for (const c of [40, 48, 54]) fill(ROW, ROW, c, c + 1, '^');
  for (const c of [36, 44, 51, 58]) put(c, ROW - 2, 'o');
  put(69, ROW, 'C');

  // 3. three buttons with spikes between them
  for (const c of [81, 94]) fill(ROW, ROW, c, c + 1, '^');
  for (const c of [78, 84, 91, 97, 104]) put(c, ROW - 2, 'o');
  put(111, ROW, 'C');
  for (const c of [114, 116, 118, 120]) put(c, ROW, 'o');

  return g.map((row) => row.join(''));
}

const meta: LevelMeta = {
  links: [
    { door: doorId.gate0, buttons: [buttonId.A], linger: 600 },
    { door: doorId.gate1, buttons: [buttonId.B1, buttonId.B2], linger: 600 },
    { door: doorId.gate2, buttons: [buttonId.C1, buttonId.C2, buttonId.C3], linger: 600 },
  ],
  levers: { [leverId.reset0]: { reset: true }, [leverId.reset1]: { reset: true }, [leverId.reset2]: { reset: true } },
  room: { minPlayers: 2, maxPlayers: 4, soloResetTicks: 600, emptyResetTicks: 600 },
};

export const POUND_ROOM = parseLevel('poundRoom', build(), meta);
