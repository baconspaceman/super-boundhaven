import { MOVEMENT, RULES, TILE, type MovementConfig } from './config';
import { isSemiSolid, isSolid, tileAt, type EnemyDef, type Level } from './level';
import { bodyHeight, placeAtCheckpoint, respawn, stepPlayer } from './player';
import type { EnemyState, PlayerState, World } from './types';

type Dyn = Record<number, boolean>;

// ---- player vs player (stomps and pushes) ----

function tryStomp(a: PlayerState, b: PlayerState, cfg: MovementConfig): boolean {
  if (Math.abs(a.x - b.x) >= 2 * cfg.halfWidth - 1) return false;
  if (a.y <= a.prevY) return false; // must be moving down this tick
  const hb = bodyHeight(b, cfg);
  const bTop = b.y - hb;
  if (a.y < bTop || a.y - bTop > cfg.stompWindow) return false;
  if (a.prevY > b.prevY - hb + cfg.stompTolerance) return false;
  a.vy = -(a.jumpHeld ? cfg.stompHeldVel : cfg.stompVel);
  a.pound = 0;
  a.y = bTop;
  a.onGround = false;
  a.coyote = 0;
  b.vy = Math.max(b.vy, cfg.stompPushDown);
  return true;
}

function moveXOnly(level: Level, p: PlayerState, dx: number, cfg: MovementConfig, dyn: Dyn | undefined): void {
  p.x += dx;
  const hw = cfg.halfWidth;
  const rowA = Math.floor((p.y - bodyHeight(p, cfg)) / TILE);
  const rowB = Math.floor((p.y - 0.001) / TILE);
  const col = dx > 0 ? Math.floor((p.x + hw - 0.001) / TILE) : Math.floor((p.x - hw) / TILE);
  for (let r = rowA; r <= rowB; r++) {
    if (isSolid(tileAt(level, col, r, dyn))) {
      p.x = dx > 0 ? col * TILE - hw : (col + 1) * TILE + hw;
      p.vx = 0;
      return;
    }
  }
}

function tryPush(level: Level, a: PlayerState, b: PlayerState, cfg: MovementConfig, dyn: Dyn | undefined): void {
  const dx = b.x - a.x;
  const overlap = 2 * cfg.halfWidth - Math.abs(dx);
  if (overlap <= 0) return;
  if (Math.abs(a.y - b.y) >= Math.min(bodyHeight(a, cfg), bodyHeight(b, cfg)) - 2) return;
  const dir = dx > 0 ? -1 : dx < 0 ? 1 : a.id < b.id ? -1 : 1; // direction a moves
  const shift = Math.min(overlap / 2, cfg.pushMax);
  moveXOnly(level, a, dir * shift, cfg, dyn);
  moveXOnly(level, b, -dir * shift, cfg, dyn);
}

/** Player-vs-player interactions. players must be sorted by id. Away (disconnected) players are inert. */
export function resolvePlayers(level: Level, players: PlayerState[], cfg: MovementConfig = MOVEMENT, dynamic?: Dyn): void {
  for (let i = 0; i < players.length; i++) {
    const a = players[i];
    if (a.away) continue;
    for (let j = i + 1; j < players.length; j++) {
      const b = players[j];
      if (b.away) continue;
      if (tryStomp(a, b, cfg) || tryStomp(b, a, cfg)) continue;
      tryPush(level, a, b, cfg, dynamic);
    }
  }
}

// ---- enemies ----

/** Quantized sine, amplitude 12 px, period 96 ticks. A literal table so every JS engine agrees bit for bit. */
const SINE = [0, 2, 5, 7, 8, 10, 11, 12, 12, 12, 11, 10, 8, 7, 5, 2, 0, -2, -5, -7, -8, -10, -11, -12, -12, -12, -11, -10, -8, -7, -5, -2];

export function flyerOffset(t: number): number {
  const i = Math.floor(t / 3) & 31;
  return SINE[i] + (SINE[(i + 1) & 31] - SINE[i]) * ((t % 3) / 3);
}

function newEnemy(d: EnemyDef): EnemyState {
  return { id: d.id, kind: d.kind, x: d.x, y: d.y, dir: 1, vy: 0, alive: true, t: 0 };
}

function stepWalker(level: Level, e: EnemyState, dyn: Dyn): void {
  const hw = RULES.enemyHalfWidth;
  const h = RULES.enemyHeight;
  e.vy = Math.min(e.vy + RULES.enemyGravity, RULES.enemyMaxFall);
  const prevY = e.y;
  e.y += e.vy;
  let grounded = false;
  if (e.vy > 0) {
    const row = Math.floor(e.y / TILE);
    const colA = Math.floor((e.x - hw) / TILE);
    const colB = Math.floor((e.x + hw - 0.001) / TILE);
    for (let c = colA; c <= colB; c++) {
      const ch = tileAt(level, c, row, dyn);
      if ((isSolid(ch) || isSemiSolid(ch)) && prevY <= row * TILE + 0.001) {
        e.y = row * TILE;
        e.vy = 0;
        grounded = true;
        break;
      }
    }
  }
  if (e.y > (level.height + 3) * TILE) {
    // fell out of the world: back to its post
    const d = level.enemies[e.id];
    e.x = d.x;
    e.y = d.y;
    e.vy = 0;
    return;
  }
  const nx = e.x + e.dir * RULES.walkerSpeed;
  const edge = nx + e.dir * hw;
  const col = Math.floor((e.dir > 0 ? edge - 0.001 : edge) / TILE);
  let blocked = false;
  const rowA = Math.floor((e.y - h) / TILE);
  const rowB = Math.floor((e.y - 0.5) / TILE);
  for (let r = rowA; r <= rowB && !blocked; r++) if (isSolid(tileAt(level, col, r, dyn))) blocked = true;
  if (!blocked && grounded) {
    const ch = tileAt(level, col, Math.floor(e.y / TILE), dyn);
    if (!isSolid(ch) && !isSemiSolid(ch)) blocked = true; // ledge: turn instead of walking off
  }
  if (blocked) e.dir = -e.dir;
  else e.x = nx;
}

function stepFlyer(level: Level, e: EnemyState): void {
  const d = level.enemies[e.id];
  e.t++;
  e.x += e.dir * RULES.flyerSpeed;
  if (e.x > d.x + d.range) {
    e.x = d.x + d.range;
    e.dir = -1;
  } else if (e.x < d.x - d.range) {
    e.x = d.x - d.range;
    e.dir = 1;
  }
  e.y = d.y + flyerOffset(e.t);
}

function stepEnemies(level: Level, world: World): void {
  for (const e of world.enemies) {
    if (!e.alive) {
      if (--e.t <= 0) Object.assign(e, newEnemy(level.enemies[e.id]));
      continue;
    }
    if (e.kind === 1) stepFlyer(level, e);
    else stepWalker(level, e, world.dynamic);
  }
}

/**
 * Does player `p` (already stepped this tick) land on top of enemy `e`? Shared by the server sim and the client's
 * stomp prediction so both agree on the rule. Spiky walkers (kind 2) are never stompable.
 */
export function stompsEnemy(p: PlayerState, e: { x: number; y: number; kind: number }, cfg: MovementConfig = MOVEMENT): boolean {
  const ehw = RULES.enemyHalfWidth;
  const top = e.y - RULES.enemyHeight;
  if (e.kind === 2) return false;
  if (p.x + cfg.halfWidth <= e.x - ehw || p.x - cfg.halfWidth >= e.x + ehw) return false;
  if (p.y <= top || p.y - bodyHeight(p, cfg) >= e.y) return false;
  return p.y > p.prevY && p.y - top <= RULES.stompWindow && p.prevY - top <= RULES.stompSlack;
}

/** The bounce a stomp gives the player. */
export function applyEnemyStomp(p: PlayerState, e: { y: number }, cfg: MovementConfig = MOVEMENT): void {
  p.vy = -(p.jumpHeld ? cfg.stompHeldVel : cfg.stompVel);
  p.pound = 0;
  p.y = e.y - RULES.enemyHeight;
  p.onGround = false;
  p.coyote = 0;
}

function enemyContacts(level: Level, world: World, cfg: MovementConfig): void {
  const ehw = RULES.enemyHalfWidth;
  const eh = RULES.enemyHeight;
  for (const p of world.players) {
    if (p.away) continue;
    const hp = bodyHeight(p, cfg);
    for (const e of world.enemies) {
      if (!e.alive) continue;
      if (p.x + cfg.halfWidth <= e.x - ehw || p.x - cfg.halfWidth >= e.x + ehw) continue;
      if (p.y <= e.y - eh || p.y - hp >= e.y) continue;
      if (stompsEnemy(p, e, cfg)) {
        e.alive = false;
        e.t = RULES.enemyRespawnTicks;
        applyEnemyStomp(p, e, cfg);
        world.room.progress = true;
      } else if (p.invuln === 0) {
        respawn(level, p);
        break;
      }
    }
  }
}

// ---- levers, plates, doors ----

function pressLevers(level: Level, world: World): void {
  const levers = world.levers;
  for (let i = 0; i < levers.length; i++) {
    const l = levers[i];
    if (l.on && level.levers[i].ticks > 0 && --l.t <= 0) {
      l.on = false;
      l.t = 0;
    }
  }
  for (const p of world.players) {
    if (!p.act || p.away) continue;
    const cy = p.y - bodyHeight(p) / 2;
    for (const def of level.levers) {
      const lx = def.col * TILE + TILE / 2;
      const ly = def.row * TILE + TILE / 2;
      if (Math.abs(p.x - lx) > RULES.actionReachX || Math.abs(cy - ly) > RULES.actionReachY) continue;
      if (def.reset) {
        resetRoom(level, world, false);
      } else {
        const l = levers[def.id];
        if (def.ticks > 0) {
          l.on = true;
          l.t = def.ticks;
        } else {
          l.on = !l.on;
        }
        world.room.progress = true;
      }
      break; // one lever per press
    }
  }
}

function updatePlates(level: Level, world: World): void {
  const hw = MOVEMENT.halfWidth;
  for (let i = 0; i < level.plates.length; i++) {
    const pl = level.plates[i];
    const cx = pl.col * TILE + TILE / 2;
    const floorY = (pl.row + 1) * TILE;
    let pressed = false;
    for (const p of world.players) {
      if (p.away || !p.onGround || Math.abs(p.y - floorY) > 1) continue;
      if (Math.abs(p.x - cx) < TILE / 2 + hw - 1) {
        pressed = true;
        break;
      }
    }
    world.plates[i] = pressed;
  }
}

/** Big buttons: count the lit timers down, then light any button a player's slam lands on this very tick. */
function updateButtons(level: Level, world: World, cfg: MovementConfig): void {
  const lit = world.buttons;
  for (let i = 0; i < lit.length; i++) if (lit[i] > 0) lit[i]--;
  for (const p of world.players) {
    if (p.away || p.slam !== RULES.slamTicks || !p.onGround) continue;
    for (const b of level.buttons) {
      const floorY = (b.row + 1) * TILE;
      if (Math.abs(p.y - floorY) > 1) continue;
      const reach = RULES.buttonReach;
      if (p.x + cfg.halfWidth <= b.col * TILE - reach || p.x - cfg.halfWidth >= (b.col + b.w) * TILE + reach) continue;
      lit[b.id] = b.ticks;
      world.room.progress = true;
    }
  }
}

function doorOccupied(level: Level, world: World, id: number): boolean {
  const hw = MOVEMENT.halfWidth;
  for (const [c, r] of level.doors[id].tiles) {
    for (const p of world.players) {
      if (p.away) continue;
      if (p.x + hw > c * TILE && p.x - hw < (c + 1) * TILE && p.y > r * TILE && p.y - bodyHeight(p) < (r + 1) * TILE) return true;
    }
  }
  return false;
}

function updateDoors(level: Level, world: World): void {
  const links = level.links;
  for (const l of links) world.dynamic[l.door] = false;
  for (let i = 0; i < links.length; i++) {
    const l = links[i];
    let cond = false;
    if (l.plates && l.plates.length) {
      let n = 0;
      for (const id of l.plates) if (world.plates[id]) n++;
      cond = n >= (l.need ?? l.plates.length);
    }
    if (!cond && l.levers) for (const id of l.levers) if (world.levers[id].on) cond = true;
    if (!cond && l.buttons && l.buttons.length) cond = l.buttons.every((id) => world.buttons[id] > 0);
    let open: boolean;
    if (cond) {
      world.linger[i] = l.linger ?? 0;
      open = true;
    } else if (world.linger[i] > 0) {
      world.linger[i]--;
      open = true;
    } else {
      open = false;
    }
    if (open) world.dynamic[l.door] = true;
  }
  // a door never closes on a player standing in it
  for (const l of links) if (!world.dynamic[l.door] && doorOccupied(level, world, l.door)) world.dynamic[l.door] = true;
  for (const l of links) if (world.dynamic[l.door]) world.room.progress = true;
}

// ---- rooms ----

/** Reset doors, levers, plates, enemies and room timers. Players are untouched. */
export function resetRoom(level: Level, world: World, first: boolean): void {
  world.levelName = level.name;
  for (const k of Object.keys(world.dynamic)) delete world.dynamic[Number(k)];
  for (const d of level.doors) world.dynamic[d.id] = false;
  world.plates.length = 0;
  for (let i = 0; i < level.plates.length; i++) world.plates.push(false);
  world.buttons.length = 0;
  for (let i = 0; i < level.buttons.length; i++) world.buttons.push(0);
  world.levers.length = 0;
  for (const l of level.levers) world.levers.push({ id: l.id, on: false, t: 0 });
  world.enemies.length = 0;
  for (const d of level.enemies) world.enemies.push(newEnemy(d));
  world.linger.length = 0;
  for (let i = 0; i < level.links.length; i++) world.linger.push(0);
  world.room.progress = false;
  world.room.idle = 0;
  world.room.empty = 0;
  if (!first) world.room.resets++;
}

/** Full reset: room state back to initial and every player back at the entrance (shards kept). */
export function hardResetRoom(level: Level, world: World): void {
  resetRoom(level, world, false);
  for (const p of world.players) {
    p.checkpoint = -1;
    placeAtCheckpoint(level, p);
  }
}

function roomRules(level: Level, world: World): void {
  const room = world.room;
  if (!room.progress) {
    for (const p of world.players) if (p.checkpoint >= 0) room.progress = true;
  }
  if (!room.progress) return;
  let active = 0;
  for (const p of world.players) if (!p.away) active++;
  if (active === 0) {
    room.idle = 0;
    if (++room.empty >= level.room.emptyResetTicks) hardResetRoom(level, world);
  } else if (active < level.room.minPlayers) {
    room.empty = 0;
    if (++room.idle >= level.room.soloResetTicks) hardResetRoom(level, world);
  } else {
    room.idle = 0;
    room.empty = 0;
  }
}

// ---- world ----

export function createWorld(level?: Level): World {
  const w: World = {
    tick: 0,
    players: [],
    levelName: '',
    dynamic: {},
    plates: [],
    buttons: [],
    levers: [],
    enemies: [],
    linger: [],
    room: { progress: false, idle: 0, empty: 0, resets: 0 },
  };
  if (level) resetRoom(level, w, true);
  return w;
}

/** Full authoritative tick: step every player, resolve interactions, then advance entities and rooms. */
export function stepWorld(
  level: Level,
  world: World,
  inputs: Record<number, number>,
  cfg: MovementConfig = MOVEMENT,
): void {
  if (world.levelName !== level.name) resetRoom(level, world, true);
  const players = world.players;
  const dyn = world.dynamic;
  for (const p of players) stepPlayer(level, p, p.away ? 0 : (inputs[p.id] ?? 0), cfg, dyn);
  resolvePlayers(level, players, cfg, dyn);
  stepEnemies(level, world);
  enemyContacts(level, world, cfg);
  pressLevers(level, world);
  updatePlates(level, world);
  updateButtons(level, world, cfg);
  updateDoors(level, world);
  roomRules(level, world);
  world.tick++;
}
