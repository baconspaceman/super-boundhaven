export const BTN = {
  LEFT: 1,
  RIGHT: 2,
  JUMP: 4,
  RUN: 8,
} as const;

export const BTN_MASK = BTN.LEFT | BTN.RIGHT | BTN.JUMP | BTN.RUN;

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
}

export interface World {
  tick: number;
  players: PlayerState[]; // always sorted by id ascending (determinism)
}
