export const BTN = {
  LEFT: 1,
  RIGHT: 2,
  JUMP: 4,
  RUN: 8,
  CROUCH: 16, // down: shrink hitbox to 16, drop through one-way platforms
  ACTION: 32, // activate levers / interact (later: mounts, powerups)
} as const;

export const BTN_MASK = BTN.LEFT | BTN.RIGHT | BTN.JUMP | BTN.RUN | BTN.CROUCH | BTN.ACTION;

/** Everything needed to step one player. Plain data so it serializes and snapshots trivially. */
export interface PlayerState {
  id: number;
  x: number; // horizontal center
  y: number; // feet
  vx: number;
  vy: number;
  onGround: boolean;
  facing: number; // 1 or -1
  coyote: number;
  buffer: number;
  prevJump: boolean;
  jumpHeld: boolean;
  prevY: number; // feet y at the start of the last step
  // ---- Milestone 3 ----
  crouching: boolean; // hitbox is `crouchHeight` tall (held, or forced by a low ceiling)
  drop: number; // ticks left ignoring one-way platforms (drop-through)
  prevAction: boolean;
  act: boolean; // ACTION rising edge on the last step (consumed by stepWorld)
  checkpoint: number; // index into level.checkpoints, -1 = level spawn
  shards: number; // collected count (kept across deaths)
  got: number[]; // collected-shard bitset, 32 ids per word (this player only)
  invuln: number; // ticks of respawn invulnerability left
  deaths: number; // respawn counter (client fx hook: it changes when a respawn happens)
  away: boolean; // disconnected-but-held: inert (no plates, hazards, pushes, stomps)
  // ---- ground pound ----
  prevCrouch: boolean; // CROUCH held on the previous step (a new press in the air starts a pound)
  pound: number; // 0 = none; 1..poundWindup-1 = hanging; >= poundWindup = diving
  slam: number; // ticks left of landing recovery; == RULES.slamTicks on the tick the slam lands
}

export interface EnemyState {
  id: number; // index into level.enemies
  kind: number; // 0 walker, 1 flyer, 2 spiky walker (never stompable)
  x: number; // center
  y: number; // feet
  dir: number; // 1 or -1
  vy: number;
  alive: boolean;
  t: number; // flyer phase ticks | seconds-to-respawn countdown while dead
}

export interface LeverState {
  id: number;
  on: boolean;
  t: number; // ticks left for timed levers
}

export interface RoomState {
  progress: boolean; // anything has been solved/changed since the last reset (guards solo-reset)
  idle: number; // consecutive ticks with fewer than minPlayers (progress only)
  empty: number; // consecutive ticks with nobody (progress only)
  resets: number; // bumps on every room reset (snapshot epoch)
}

export interface World {
  tick: number;
  players: PlayerState[]; // always sorted by id ascending (determinism)
  levelName: string; // '' until the first stepWorld/createWorld(level) binds a level
  /** door id -> open. Absent/false = closed. Pass to stepPlayer (5th arg) for client prediction. */
  dynamic: Record<number, boolean>;
  plates: boolean[]; // pressed, by plate id
  buttons: number[]; // big buttons, by id: ticks left lit after a slam (0 = unlit)
  levers: LeverState[]; // by lever id
  enemies: EnemyState[]; // by enemy id
  linger: number[]; // per door link: ticks the door stays open after its condition lapses
  room: RoomState;
}
