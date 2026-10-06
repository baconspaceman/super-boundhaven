import { MOVEMENT, RULES, TILE, type MovementConfig } from './config';
import { isSemiSolid, isSlope, isSolid, slopeFloor, tileAt, type Level } from './level';
import { BTN, BTN_MASK, type PlayerState } from './types';

type Dyn = Record<number, boolean> | undefined;

export function createPlayer(id: number, level: Level): PlayerState {
  return {
    id,
    x: level.spawn.x,
    y: level.spawn.y,
    vx: 0,
    vy: 0,
    onGround: false,
    facing: 1,
    coyote: 0,
    buffer: 0,
    prevJump: false,
    jumpHeld: false,
    prevY: level.spawn.y,
    crouching: false,
    drop: 0,
    prevAction: false,
    act: false,
    checkpoint: -1,
    shards: 0,
    got: [],
    invuln: 0,
    deaths: 0,
    away: false,
    prevCrouch: false,
    pound: 0,
    slam: 0,
  };
}

export function clonePlayer(p: PlayerState): PlayerState {
  return { ...p, got: p.got.slice() };
}

/** Current hitbox height (feet to head). */
export function bodyHeight(p: PlayerState, cfg: MovementConfig = MOVEMENT): number {
  return p.crouching ? cfg.crouchHeight : cfg.height;
}

/** Put the player at its checkpoint (or the level spawn) with a clean motion state. */
export function placeAtCheckpoint(level: Level, p: PlayerState): void {
  const at = p.checkpoint >= 0 && level.checkpoints[p.checkpoint] ? level.checkpoints[p.checkpoint] : level.spawn;
  p.x = at.x;
  p.y = at.y;
  p.prevY = p.y;
  p.vx = 0;
  p.vy = 0;
  p.onGround = false;
  p.coyote = 0;
  p.buffer = 0;
  p.crouching = false;
  p.drop = 0;
  p.pound = 0;
  p.slam = 0;
}

/** Hurt / pit: back to the last checkpoint with brief invulnerability. No other penalty (shards are kept). */
export function respawn(level: Level, p: PlayerState): void {
  placeAtCheckpoint(level, p);
  p.invuln = RULES.invulnTicks;
  p.deaths++;
}

export function hasShard(p: PlayerState, id: number): boolean {
  return ((p.got[id >> 5] ?? 0) & (1 << (id & 31))) !== 0;
}

function approach(v: number, target: number, amount: number): number {
  return v < target ? Math.min(v + amount, target) : Math.max(v - amount, target);
}

function moveX(level: Level, p: PlayerState, dx: number, inset: number, cfg: MovementConfig, dyn: Dyn): void {
  if (dx === 0) return;
  p.x += dx;
  const hw = cfg.halfWidth;
  const rowA = Math.floor((p.y - bodyHeight(p, cfg)) / TILE);
  const rowB = Math.floor((p.y - inset - 0.001) / TILE);
  const col = dx > 0 ? Math.floor((p.x + hw - 0.001) / TILE) : Math.floor((p.x - hw) / TILE);
  for (let r = rowA; r <= rowB; r++) {
    if (isSolid(tileAt(level, col, r, dyn))) {
      p.x = dx > 0 ? col * TILE - hw : (col + 1) * TILE + hw;
      p.vx = 0;
      return;
    }
  }
}

/** slack: px the feet may already sit below a tile top and still land on it (slope -> flat lip); only for the tile under x. */
function moveY(level: Level, p: PlayerState, dy: number, slack: number, cfg: MovementConfig, dyn: Dyn): void {
  if (dy === 0) return;
  const prevY = p.y;
  p.y += dy;
  const hw = cfg.halfWidth;
  const colA = Math.floor((p.x - hw) / TILE);
  const colB = Math.floor((p.x + hw - 0.001) / TILE);

  if (dy > 0) {
    const row = Math.floor(p.y / TILE);
    const mid = Math.floor(p.x / TILE);
    for (let c = colA; c <= colB; c++) {
      const ch = tileAt(level, c, row, dyn);
      const solid = isSolid(ch);
      if (
        (solid && prevY <= row * TILE + 0.001 + (c === mid ? slack : 0)) ||
        (!solid && p.drop === 0 && isSemiSolid(ch) && prevY <= row * TILE + 0.001)
      ) {
        p.y = row * TILE;
        if (ch === 'B') {
          p.vy = -(p.jumpHeld ? cfg.padHeldVel : cfg.padVel);
          p.onGround = false;
        } else {
          p.vy = 0;
          p.onGround = true;
        }
        return;
      }
    }
  } else {
    const row = Math.floor((p.y - bodyHeight(p, cfg)) / TILE);
    for (let c = colA; c <= colB; c++) {
      if (isSolid(tileAt(level, c, row, dyn))) {
        p.y = (row + 1) * TILE + bodyHeight(p, cfg);
        p.vy = 0;
        return;
      }
    }
  }
}

function applySlope(level: Level, p: PlayerState, wasGround: boolean, cfg: MovementConfig): void {
  if (p.vy < 0) return;
  const col = Math.floor(p.x / TILE);
  const r0 = Math.floor((p.y - 1) / TILE);
  const snap = wasGround ? cfg.slopeSnap : 0;
  let best = Infinity;
  // r0-1: feet can sit a hair inside the fill tile under the next slope tile up
  for (let r = r0 - 1; r <= r0 + 1; r++) {
    const ch = tileAt(level, col, r);
    if (!isSlope(ch)) continue;
    const f = slopeFloor(ch, col, r, p.x);
    if (p.y >= f - snap && p.y <= f + TILE) best = Math.min(best, f);
  }
  if (best < Infinity) {
    p.y = best;
    p.vy = 0;
    p.onGround = true;
  }
}

/** True if the standing-height body would not overlap a solid tile at the current position. */
function canStand(level: Level, p: PlayerState, cfg: MovementConfig, dyn: Dyn): boolean {
  const hw = cfg.halfWidth;
  const colA = Math.floor((p.x - hw) / TILE);
  const colB = Math.floor((p.x + hw - 0.001) / TILE);
  const rowA = Math.floor((p.y - cfg.height) / TILE);
  const rowB = Math.floor((p.y - cfg.crouchHeight - 0.001) / TILE);
  for (let r = rowA; r <= rowB; r++) {
    for (let c = colA; c <= colB; c++) if (isSolid(tileAt(level, c, r, dyn))) return false;
  }
  return true;
}

/** Grounded on one-way platforms only (nothing solid under the feet)? */
function standingOnSemi(level: Level, p: PlayerState, cfg: MovementConfig, dyn: Dyn): boolean {
  const hw = cfg.halfWidth;
  const colA = Math.floor((p.x - hw) / TILE);
  const colB = Math.floor((p.x + hw - 0.001) / TILE);
  const row = Math.floor(p.y / TILE);
  let semi = false;
  for (let c = colA; c <= colB; c++) {
    const ch = tileAt(level, c, row, dyn);
    if (isSolid(ch) || isSlope(ch)) return false;
    if (isSemiSolid(ch)) semi = true;
  }
  return semi;
}

/** Static hazards/pickups: spikes, checkpoints, shards. Only depends on the level, so the client predicts it too. */
function touchStatics(level: Level, p: PlayerState, cfg: MovementConfig, dyn: Dyn): void {
  const hw = cfg.halfWidth;
  const top = p.y - bodyHeight(p, cfg);

  if (p.invuln === 0) {
    const colA = Math.floor((p.x - hw + 1) / TILE);
    const colB = Math.floor((p.x + hw - 1) / TILE);
    const rowA = Math.floor(top / TILE);
    const rowB = Math.floor((p.y - 0.5) / TILE);
    for (let r = rowA; r <= rowB; r++) {
      for (let c = colA; c <= colB; c++) {
        if (tileAt(level, c, r, dyn) !== '^') continue;
        // spike body: x 2..14, y 6..16 inside its tile (forgiving)
        if (p.x + hw - 1 > c * TILE + 2 && p.x - hw + 1 < c * TILE + 14 && p.y - 0.5 > r * TILE + 6 && top < r * TILE + 16) {
          respawn(level, p);
          return;
        }
      }
    }
  }

  const cps = level.checkpoints;
  for (let i = 0; i < cps.length; i++) {
    const cp = cps[i];
    // flag: generous trigger, 38 px wide x 80 px tall (5 tiles) above its feet: a normal jump over it still counts
    if (Math.abs(p.x - cp.x) < 12 + hw && p.y > cp.y - 80 && top < cp.y) p.checkpoint = i;
  }

  const sh = level.shards;
  for (let i = 0; i < sh.length; i++) {
    const s = sh[i];
    if (Math.abs(p.x - s.x) >= 8 + hw || s.y < top - 6 || s.y > p.y + 6) continue;
    const w = i >> 5;
    const bit = 1 << (i & 31);
    while (p.got.length <= w) p.got.push(0);
    if ((p.got[w] & bit) === 0) {
      p.got[w] |= bit;
      p.shards++;
    }
  }
}

/**
 * Advance one player by one tick against the level only (no other players/enemies). Mutates p.
 * `dynamic` = door open state (door id -> open). Includes everything that depends only on static
 * level data, so the client can predict it: crouch, one-way platforms, doors, spikes, pit, checkpoints, shards.
 */
export function stepPlayer(
  level: Level,
  p: PlayerState,
  buttons: number,
  cfg: MovementConfig = MOVEMENT,
  dynamic?: Record<number, boolean>,
): void {
  buttons &= BTN_MASK;
  const left = (buttons & BTN.LEFT) !== 0;
  const right = (buttons & BTN.RIGHT) !== 0;
  const jump = (buttons & BTN.JUMP) !== 0;
  const run = (buttons & BTN.RUN) !== 0;
  const crouchBtn = (buttons & BTN.CROUCH) !== 0;
  const action = (buttons & BTN.ACTION) !== 0;
  const dir = (right ? 1 : 0) - (left ? 1 : 0);
  const jumpPressed = jump && !p.prevJump;
  p.prevJump = jump;
  p.jumpHeld = jump;
  p.act = action && !p.prevAction;
  p.prevAction = action;
  p.prevY = p.y;
  const crouchPressed = crouchBtn && !p.prevCrouch;
  p.prevCrouch = crouchBtn;
  if (p.slam > 0) p.slam--;
  if (p.invuln > 0) p.invuln--;
  if (p.drop > 0) p.drop--;

  // ground pound: a fresh DOWN press in the air (not holding it from before the jump) starts the hang
  if (crouchPressed && !p.onGround && p.pound === 0 && p.slam === 0 && !p.away) {
    p.pound = 1;
    p.vx = 0;
    p.vy = 0;
  }
  const pounding = p.pound > 0;

  // crouch: held, or kept while a low ceiling blocks standing up
  if (crouchBtn || pounding) p.crouching = true;
  else if (p.crouching && canStand(level, p, cfg, dynamic)) p.crouching = false;

  let wasGround = p.onGround;
  let dropping = false;
  if (wasGround && crouchBtn && standingOnSemi(level, p, cfg, dynamic)) {
    dropping = true;
    p.drop = cfg.dropTicks;
    p.onGround = false;
    wasGround = false;
  }
  const maxSpeed = p.crouching && p.onGround ? cfg.crouchMax : run ? cfg.runMax : cfg.walkMax;

  // horizontal control (none while pounding; a short recovery after the slam)
  if (pounding) {
    p.vx = 0;
  } else if (dir !== 0 && p.slam === 0) {
    p.facing = dir;
    if (p.vx * dir < 0) {
      p.vx += dir * (p.onGround ? cfg.skid : cfg.airAccel);
    } else if (p.vx * dir < maxSpeed) {
      p.vx += dir * (p.onGround ? cfg.accel : cfg.airAccel);
      if (p.vx * dir > maxSpeed) p.vx = dir * maxSpeed;
    } else if (p.onGround) {
      p.vx = approach(p.vx, dir * maxSpeed, cfg.overspeedDecel);
    }
  } else if (p.onGround) {
    p.vx = approach(p.vx, 0, cfg.friction);
  }

  // jump with coyote time and input buffering (crouch+jump on a one-way platform drops instead)
  p.coyote = p.onGround ? cfg.coyoteTicks : Math.max(0, p.coyote - 1);
  p.buffer = jumpPressed ? cfg.bufferTicks : Math.max(0, p.buffer - 1);
  if (dropping) {
    p.coyote = 0;
    p.buffer = 0;
  }
  if (p.buffer > 0 && (p.onGround || p.coyote > 0)) {
    p.vy = -(cfg.jumpVel + Math.abs(p.vx) * cfg.runBonus);
    p.onGround = false;
    p.coyote = 0;
    p.buffer = 0;
  }

  // gravity (a pound hangs, then dives at a fixed speed)
  if (pounding) {
    if (p.pound < RULES.poundWindup) {
      p.vy = 0;
      p.pound++;
    } else {
      p.vy = RULES.poundVel;
    }
  } else {
    const g = p.vy < 0 && jump ? cfg.gravityHeld : cfg.gravityFall;
    p.vy = Math.min(p.vy + g, cfg.maxFall);
  }

  // move
  p.onGround = false;
  moveX(level, p, p.vx, wasGround ? cfg.slopeInset : 0, cfg, dynamic);
  // a grounded walker leaves a slope's top edge up to slopeSnap below the flat tile top it reaches
  moveY(level, p, p.vy, wasGround ? cfg.slopeSnap : 0, cfg, dynamic);
  applySlope(level, p, wasGround, cfg);

  if (pounding) {
    if (p.onGround && p.pound >= RULES.poundWindup) {
      p.slam = RULES.slamTicks; // landed from the dive: stepWorld checks big buttons on this exact tick
      p.pound = 0;
    } else if (p.onGround || p.vy < 0) {
      p.pound = 0; // cancelled (bounce pad, landed in the hang)
    }
  }

  if (p.y > (level.height + 3) * TILE) {
    respawn(level, p);
    return;
  }
  if (!p.away) touchStatics(level, p, cfg, dynamic);
}
