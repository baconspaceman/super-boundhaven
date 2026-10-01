// Scripted clips (pure, no DOM): a looping replay of the REAL @sbh/sim simulation driven by
// scripted, deterministic input tracks (run-length encoded [buttons, ticks] pairs).
// The tracks were tuned against the sim (see verifyClip) - nothing here is pre-rendered video.
import {
  BTN,
  PLAYGROUND,
  TICK_RATE,
  createPlayer,
  createWorld,
  stepWorld,
  type Level,
  type PlayerState,
  type World,
} from '@sbh/sim';

type Rle = [buttons: number, ticks: number][];

interface Spawn {
  id: number;
  x: number;
}

export interface ClipDef {
  id: 'solo' | 'coop';
  title: string;
  blurb: string;
  chips: string[];
  spawns: Spawn[] | null; // null = level spawn
  tracks: Record<number, Rle>;
  fadeTicks: number;
  posterTick: number;
  focus: (players: PlayerState[]) => number;
  verify: (world: World, log: TickLog) => boolean;
}

export interface TickLog {
  padBounced: boolean;
  reached: number; // tick at which the clip's goal was first satisfied (-1 = never)
}

const L = BTN.LEFT;
const R = BTN.RIGHT;
const J = BTN.JUMP;
const RUN = BTN.RUN;

// buttons: LEFT=1 RIGHT=2 JUMP=4 RUN=8
const SOLO_TRACK: Rle = [
  [R | RUN, 238], // run: up the 4-step ramp, over the plateau, down the far side
  [R | RUN | J, 40], // run-jump across the 5-tile pit
  [L, 13], // skid to a stop after landing
  [R | J, 1],
  [R | RUN | J, 21],
  [R, 1],
  [R | J, 14],
  [L | J, 9],
  [R | J, 15],
  [J, 27], // hold jump over the bounce pad for the high launch, land on the platform
  [0, 71],
];

const COOP_A: Rle = [
  [R | RUN, 29],
  [R | J, 6], // hop onto the waiting player's head...
  [R, 10],
  [R | J, 12],
  [J | L, 7],
  [J | R, 35], // ...stomp-bounce over the 6-tile wall
  [0, 192],
];
const COOP_B: Rle = [
  [0, 99], // waits until the first climber is across
  [R | RUN, 44],
  [R | J, 6],
  [R, 10],
  [R | J, 12],
  [J | L, 7],
  [J | R, 32],
  [0, 81],
];
const COOP_C: Rle = [
  [R, 41], // walks up to the wall and plants as the living stepping stone
  [0, 250],
];

function expand(r: Rle): number[] {
  const out: number[] = [];
  for (const [b, n] of r) for (let i = 0; i < n; i++) out.push(b);
  return out;
}

export const CLIPS: ClipDef[] = [
  {
    id: 'solo',
    title: 'Precision run',
    blurb: 'Ramp, pit, bounce pad: one run, no mistakes.',
    chips: ['Precision run', 'Run-jump the pit', 'Bounce-pad launch'],
    spawns: null,
    tracks: { 1: SOLO_TRACK },
    fadeTicks: 18,
    posterTick: 330,
    focus: (ps) => ps[0].x,
    verify: (w, log) => {
      const p = w.players[0];
      return log.padBounced && Math.abs(p.y - 64) < 1 && p.x > 832 && p.x < 896;
    },
  },
  {
    id: 'coop',
    title: 'Co-op wall bounce',
    blurb: 'Six tiles is too tall alone. Stomp a friend, clear the wall.',
    chips: ['Co-op wall bounce', 'Stomp-bounce teamwork', '6-tile wall'],
    spawns: [
      { id: 1, x: 1250 },
      { id: 2, x: 1215 },
      { id: 3, x: 1290 },
    ],
    tracks: { 1: COOP_A, 2: COOP_B, 3: COOP_C },
    fadeTicks: 18,
    posterTick: 58,
    focus: (ps) => ps.reduce((s, p) => s + p.x, 0) / ps.length,
    verify: (w) => {
      const [a, b, c] = w.players;
      const over = (p: PlayerState) => p.onGround && p.y < 97 && p.x > 1350;
      return over(a) && over(b) && c.x < 1344; // both climbers across, the base player stayed put
    },
  },
];

const TRACKS = new Map<string, Record<number, number[]>>();
for (const c of CLIPS) {
  const t: Record<number, number[]> = {};
  for (const [id, r] of Object.entries(c.tracks)) t[Number(id)] = expand(r);
  TRACKS.set(c.id, t);
}

export function clipLength(c: ClipDef): number {
  return Math.max(...Object.values(TRACKS.get(c.id)!).map((a) => a.length));
}

export function createClipWorld(level: Level, c: ClipDef): World {
  const w = createWorld();
  if (!c.spawns) {
    w.players.push(createPlayer(1, level));
  } else {
    for (const s of c.spawns) {
      const p = createPlayer(s.id, level);
      p.x = s.x;
      p.y = 192;
      p.prevY = 192;
      w.players.push(p);
    }
  }
  return w;
}

export function stepClip(level: Level, c: ClipDef, w: World, tick: number, log?: TickLog): void {
  const tr = TRACKS.get(c.id)!;
  const inputs: Record<number, number> = {};
  for (const p of w.players) inputs[p.id] = tr[p.id]?.[tick] ?? 0;
  stepWorld(level, w, inputs);
  if (log) {
    if (w.players.some((p) => p.vy < -7.5)) log.padBounced = true;
    if (log.reached < 0 && c.verify(w, log)) log.reached = tick;
  }
}

export interface Verification {
  id: string;
  ok: boolean;
  ticks: number;
  reachedAt: number;
}

/** Headless check that the scripted inputs really achieve the clip's goal in the sim. */
export function verifyClip(c: ClipDef, level: Level = PLAYGROUND): Verification {
  const w = createClipWorld(level, c);
  const len = clipLength(c);
  const log: TickLog = { padBounced: false, reached: -1 };
  for (let t = 0; t < len; t++) stepClip(level, c, w, t, log);
  return { id: c.id, ok: c.verify(w, log), ticks: len, reachedAt: log.reached };
}

