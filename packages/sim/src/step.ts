import { MOVEMENT, TILE, type MovementConfig } from './config';
import { isSlope, isSolid, slopeFloor, tileAt, type Level } from './level';
import { BTN, type PlayerState, type World } from './types';

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
  };
}

export function clonePlayer(p: PlayerState): PlayerState {
  return { ...p };
}

export function respawn(level: Level, p: PlayerState): void {
  p.x = level.spawn.x;
  p.y = level.spawn.y;
  p.prevY = p.y;
  p.vx = 0;
  p.vy = 0;
  p.onGround = false;
  p.coyote = 0;
  p.buffer = 0;
}

function approach(v: number, target: number, amount: number): number {
  return v < target ? Math.min(v + amount, target) : Math.max(v - amount, target);
}

function moveX(level: Level, p: PlayerState, dx: number, inset: number, cfg: MovementConfig): void {
  if (dx === 0) return;
  p.x += dx;
  const hw = cfg.halfWidth;
  const rowA = Math.floor((p.y - cfg.height) / TILE);
  const rowB = Math.floor((p.y - inset - 0.001) / TILE);
  const col = dx > 0 ? Math.floor((p.x + hw - 0.001) / TILE) : Math.floor((p.x - hw) / TILE);
  for (let r = rowA; r <= rowB; r++) {
    if (isSolid(tileAt(level, col, r))) {
      p.x = dx > 0 ? col * TILE - hw : (col + 1) * TILE + hw;
      p.vx = 0;
      return;
    }
  }
}

/** slack: px the feet may already sit below a tile top and still land on it (slope -> flat lip); only for the tile under x. */
function moveY(level: Level, p: PlayerState, dy: number, slack: number, cfg: MovementConfig): void {
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
      const ch = tileAt(level, c, row);
      if (isSolid(ch) && prevY <= row * TILE + 0.001 + (c === mid ? slack : 0)) {
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
    const row = Math.floor((p.y - cfg.height) / TILE);
    for (let c = colA; c <= colB; c++) {
      if (isSolid(tileAt(level, c, row))) {
        p.y = (row + 1) * TILE + cfg.height;
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

/** Advance one player by one tick against the level only (no other players). Mutates p. */
export function stepPlayer(level: Level, p: PlayerState, buttons: number, cfg: MovementConfig = MOVEMENT): void {
  const left = (buttons & BTN.LEFT) !== 0;
  const right = (buttons & BTN.RIGHT) !== 0;
  const jump = (buttons & BTN.JUMP) !== 0;
  const run = (buttons & BTN.RUN) !== 0;
  const dir = (right ? 1 : 0) - (left ? 1 : 0);
  const jumpPressed = jump && !p.prevJump;
  p.prevJump = jump;
  p.jumpHeld = jump;
  p.prevY = p.y;
  const wasGround = p.onGround;
  const maxSpeed = run ? cfg.runMax : cfg.walkMax;

  // horizontal control
  if (dir !== 0) {
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

  // jump with coyote time and input buffering
  p.coyote = p.onGround ? cfg.coyoteTicks : Math.max(0, p.coyote - 1);
  p.buffer = jumpPressed ? cfg.bufferTicks : Math.max(0, p.buffer - 1);
  if (p.buffer > 0 && (p.onGround || p.coyote > 0)) {
    p.vy = -(cfg.jumpVel + Math.abs(p.vx) * cfg.runBonus);
    p.onGround = false;
    p.coyote = 0;
    p.buffer = 0;
  }

  // gravity
  const g = p.vy < 0 && jump ? cfg.gravityHeld : cfg.gravityFall;
  p.vy = Math.min(p.vy + g, cfg.maxFall);

  // move
  p.onGround = false;
  moveX(level, p, p.vx, wasGround ? cfg.slopeInset : 0, cfg);
  // a grounded walker leaves a slope's top edge up to slopeSnap below the flat tile top it reaches
  moveY(level, p, p.vy, wasGround ? cfg.slopeSnap : 0, cfg);
  applySlope(level, p, wasGround, cfg);

  if (p.y > (level.height + 3) * TILE) respawn(level, p);
}

function tryStomp(a: PlayerState, b: PlayerState, cfg: MovementConfig): boolean {
  if (Math.abs(a.x - b.x) >= 2 * cfg.halfWidth - 1) return false;
  if (a.y <= a.prevY) return false; // must be moving down this tick
  const bTop = b.y - cfg.height;
  if (a.y < bTop || a.y - bTop > cfg.stompWindow) return false;
  if (a.prevY > b.prevY - cfg.height + cfg.stompTolerance) return false;
  a.vy = -(a.jumpHeld ? cfg.stompHeldVel : cfg.stompVel);
  a.y = bTop;
  a.onGround = false;
  a.coyote = 0;
  b.vy = Math.max(b.vy, cfg.stompPushDown);
  return true;
}

function tryPush(level: Level, a: PlayerState, b: PlayerState, cfg: MovementConfig): void {
  const dx = b.x - a.x;
  const overlap = 2 * cfg.halfWidth - Math.abs(dx);
  if (overlap <= 0) return;
  if (Math.abs(a.y - b.y) >= cfg.height - 2) return;
  const dir = dx > 0 ? -1 : dx < 0 ? 1 : a.id < b.id ? -1 : 1; // direction a moves
  const shift = Math.min(overlap / 2, cfg.pushMax);
  moveX(level, a, dir * shift, 0, cfg);
  moveX(level, b, -dir * shift, 0, cfg);
}

/** Player-vs-player interactions. players must be sorted by id. */
export function resolvePlayers(level: Level, players: PlayerState[], cfg: MovementConfig = MOVEMENT): void {
  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      const a = players[i];
      const b = players[j];
      if (tryStomp(a, b, cfg) || tryStomp(b, a, cfg)) continue;
      tryPush(level, a, b, cfg);
    }
  }
}

export function createWorld(): World {
  return { tick: 0, players: [] };
}

/** Full authoritative tick: step every player, then resolve player interactions. */
export function stepWorld(
  level: Level,
  world: World,
  inputs: Record<number, number>,
  cfg: MovementConfig = MOVEMENT,
): void {
  for (const p of world.players) stepPlayer(level, p, inputs[p.id] ?? 0, cfg);
  resolvePlayers(level, world.players, cfg);
  world.tick++;
}
