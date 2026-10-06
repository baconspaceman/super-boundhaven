import { describe, expect, it } from 'vitest';
import {
  BTN,
  COOP_ROOM,
  LEVELS,
  MOVEMENT,
  PLAYGROUND,
  RULES,
  TILE,
  bodyHeight,
  clonePlayer,
  createPlayer,
  createWorld,
  getLevel,
  hasShard,
  parseLevel,
  stepPlayer,
  stepWorld,
  tileAt,
  type Level,
  type LevelMeta,
  type PlayerState,
  type World,
} from '../src/index';

const R = BTN.RIGHT;
const FLOOR = 160; // scene floor top (feet y)

/** 40x12 test scene: floor rows 10-11 (top y=160), spawn at col 2. `draw` places markers/tiles into the grid g[row][col]. */
function scene(draw: (g: string[][]) => void, meta?: LevelMeta, w = 40): Level {
  const g = Array.from({ length: 12 }, () => Array<string>(w).fill('.'));
  for (let r = 10; r < 12; r++) g[r].fill('#');
  g[9][2] = 'S';
  draw(g);
  return parseLevel('scene', g.map((r) => r.join('')), meta);
}

function at(lv: Level, x: number, y = FLOOR, id = 1): PlayerState {
  const p = createPlayer(id, lv);
  p.x = x;
  p.y = y;
  p.prevY = y;
  return p;
}

function world(lv: Level, ...ps: PlayerState[]): World {
  const w = createWorld(lv);
  w.players.push(...ps);
  w.players.sort((a, b) => a.id - b.id);
  return w;
}

const run = (lv: Level, w: World, n: number, inputs: Record<number, number> = {}) => {
  for (let i = 0; i < n; i++) stepWorld(lv, w, inputs);
};

const pulse = (lv: Level, w: World, id: number, extra = 0) => {
  stepWorld(lv, w, { [id]: extra }); // make sure ACTION is up so the next press is a rising edge
  stepWorld(lv, w, { [id]: BTN.ACTION | extra });
  stepWorld(lv, w, { [id]: extra });
};

describe('inputs', () => {
  it('has six button bits and BTN_MASK covers them', () => {
    expect(BTN.CROUCH).toBe(16);
    expect(BTN.ACTION).toBe(32);
    expect(BTN.LEFT | BTN.RIGHT | BTN.JUMP | BTN.RUN | BTN.CROUCH | BTN.ACTION).toBe(63);
  });
});

describe('crouch', () => {
  it('shrinks the hitbox to 16 while held and slows the ground speed', () => {
    const lv = scene(() => {});
    const p = at(lv, 100);
    stepPlayer(lv, p, BTN.CROUCH);
    expect(p.crouching).toBe(true);
    expect(bodyHeight(p)).toBe(16);
    for (let i = 0; i < 60; i++) stepPlayer(lv, p, BTN.CROUCH | R | BTN.RUN);
    expect(p.vx).toBeLessThanOrEqual(MOVEMENT.crouchMax + 1e-9);
    expect(p.vx).toBeGreaterThan(0.5);
    stepPlayer(lv, p, 0);
    expect(p.crouching).toBe(false);
    expect(bodyHeight(p)).toBe(28);
  });

  const lowCeiling = scene((g) => {
    for (let c = 10; c <= 20; c++) g[8][c] = '#'; // underside y=144: a 1-tile (16 px) gap above the floor
  });

  it('slides under a 1-tile gap; standing is blocked', () => {
    const stand = at(lowCeiling, 3 * TILE);
    for (let i = 0; i < 300; i++) stepPlayer(lowCeiling, stand, R);
    expect(stand.x).toBeLessThan(10 * TILE - MOVEMENT.halfWidth + 0.01);

    const duck = at(lowCeiling, 3 * TILE);
    let maxV = 0;
    for (let i = 0; i < 700; i++) {
      stepPlayer(lowCeiling, duck, R | BTN.CROUCH);
      maxV = Math.max(maxV, duck.vx);
    }
    expect(duck.x).toBeGreaterThan(22 * TILE);
    expect(maxV).toBeLessThanOrEqual(MOVEMENT.crouchMax + 1e-9); // slow slide
  });

  it('cannot stand up under a low ceiling, and stands once clear', () => {
    const p = at(lowCeiling, 12 * TILE);
    for (let i = 0; i < 4; i++) stepPlayer(lowCeiling, p, BTN.CROUCH);
    for (let i = 0; i < 10; i++) stepPlayer(lowCeiling, p, 0); // released under the ceiling
    expect(p.crouching).toBe(true);
    for (let i = 0; i < 400 && p.x < 21 * TILE + 8; i++) stepPlayer(lowCeiling, p, R); // keeps sliding out
    expect(p.x).toBeGreaterThan(20 * TILE + 8);
    stepPlayer(lowCeiling, p, R);
    expect(p.crouching).toBe(false);
  });

  it('crouch hitbox is used for head bumps while jumping crouched', () => {
    const lv = scene((g) => {
      for (let c = 0; c < 40; c++) g[7][c] = '#'; // underside y=128
    });
    const jumpApex = (crouch: boolean) => {
      const p = at(lv, 100);
      stepPlayer(lv, p, 0); // land first: a DOWN press while airborne would start a ground pound
      let minY = Infinity;
      for (let t = 0; t < 40; t++) {
        stepPlayer(lv, p, BTN.JUMP | (crouch ? BTN.CROUCH : 0));
        minY = Math.min(minY, p.y);
      }
      return minY;
    };
    // standing head stops at 128 + 28 = 156; crouched head stops at 128 + 16 = 144
    expect(jumpApex(false)).toBeCloseTo(156, 3);
    expect(jumpApex(true)).toBeCloseTo(144, 3);
  });
});

describe('one-way platforms', () => {
  const lv = scene((g) => {
    for (let c = 5; c <= 9; c++) g[7][c] = '-'; // top y=112
  });

  it('are landed on from above, passed through from below and from the side', () => {
    const p = at(lv, 7 * TILE + 8);
    for (let t = 0; t < 90; t++) stepPlayer(lv, p, t < 30 ? BTN.JUMP : 0);
    expect(p.y).toBe(112);
    expect(p.onGround).toBe(true);

    const side = at(lv, 3 * TILE, 7 * TILE + 16 - 0); // feet at y=128: body overlaps the platform tile
    side.prevY = side.y;
    // walking sideways at floor level through a platform at body height is not blocked
    const lv2 = scene((g) => {
      for (let c = 10; c <= 14; c++) g[9][c] = '-';
    });
    const w = at(lv2, 3 * TILE);
    for (let t = 0; t < 200; t++) stepPlayer(lv2, w, R | BTN.RUN);
    expect(w.x).toBeGreaterThan(16 * TILE);
    expect(w.y).toBe(FLOOR);
    expect(side.id).toBe(1);
  });

  it('crouch drops through; crouch+jump drops instead of jumping', () => {
    const stay = at(lv, 7 * TILE + 8, 112);
    for (let t = 0; t < 30; t++) stepPlayer(lv, stay, 0);
    expect(stay.y).toBe(112);

    const down = at(lv, 7 * TILE + 8, 112);
    for (let t = 0; t < 4; t++) stepPlayer(lv, down, 0);
    for (let t = 0; t < 40; t++) stepPlayer(lv, down, BTN.CROUCH);
    expect(down.y).toBe(FLOOR);

    const both = at(lv, 7 * TILE + 8, 112);
    for (let t = 0; t < 4; t++) stepPlayer(lv, both, 0);
    let minY = Infinity;
    for (let t = 0; t < 40; t++) {
      stepPlayer(lv, both, BTN.CROUCH | BTN.JUMP);
      minY = Math.min(minY, both.y);
    }
    expect(minY).toBeGreaterThanOrEqual(112); // never rose: no jump
    expect(both.y).toBe(FLOOR);
  });

  it('does not drop when a solid tile is under any part of the feet', () => {
    const mixed = scene((g) => {
      for (let c = 5; c <= 9; c++) g[7][c] = '-';
      g[7][10] = '#';
    });
    const p = at(mixed, 10 * TILE - 2, 112); // straddles the platform and the solid tile
    for (let t = 0; t < 4; t++) stepPlayer(mixed, p, 0);
    for (let t = 0; t < 20; t++) stepPlayer(mixed, p, BTN.CROUCH);
    expect(p.y).toBe(112);
  });
});

describe('levers and the action button', () => {
  const lv = scene(
    (g) => {
      g[9][10] = 'l';
      for (let r = 0; r <= 9; r++) g[r][20] = 'D';
    },
    { links: [{ door: 0, levers: [0] }] },
  );

  it('toggles on the rising edge only, within reach', () => {
    const p = at(lv, 10 * TILE + 8);
    const w = world(lv, p);
    run(lv, w, 3);
    expect(w.levers[0].on).toBe(false);
    run(lv, w, 30, { 1: BTN.ACTION }); // held: one toggle, not thirty
    expect(w.levers[0].on).toBe(true);
    expect(w.dynamic[0]).toBe(true);
    pulse(lv, w, 1);
    expect(w.levers[0].on).toBe(false);
    expect(w.dynamic[0]).toBe(false);
  });

  it('ignores presses out of reach (horizontal and vertical)', () => {
    const far = at(lv, 10 * TILE + 8 + RULES.actionReachX + 4);
    const w = world(lv, far);
    run(lv, w, 3);
    pulse(lv, w, 1);
    expect(w.levers[0].on).toBe(false);
    const near = at(lv, 10 * TILE + 8 + RULES.actionReachX - 2);
    const w2 = world(lv, near);
    run(lv, w2, 3);
    pulse(lv, w2, 1);
    expect(w2.levers[0].on).toBe(true);
    const high = at(lv, 10 * TILE + 8, FLOOR - 4 * TILE);
    const w3 = world(lv, high);
    pulse(lv, w3, 1);
    expect(w3.levers[0].on).toBe(false);
  });

  it('a closed door blocks, an open one lets you through, and prediction stays in sync', () => {
    const w = world(lv, at(lv, 10 * TILE + 8));
    const me = w.players[0];
    const mirror = clonePlayer(me);
    run(lv, w, 3);
    for (let i = 0; i < 3; i++) stepPlayer(lv, mirror, 0, MOVEMENT, {});
    // walk into the closed door
    for (let i = 0; i < 200; i++) {
      const dyn = { ...w.dynamic };
      stepWorld(lv, w, { 1: R | BTN.RUN });
      stepPlayer(lv, mirror, R | BTN.RUN, MOVEMENT, dyn);
    }
    expect(me.x).toBeLessThanOrEqual(20 * TILE - MOVEMENT.halfWidth + 0.01);
    expect(JSON.stringify(mirror)).toBe(JSON.stringify(me));
    // open it (walk back to the lever, pull, walk through), mirroring with the server's door state each tick
    const both = (buttons: number) => {
      const dyn = { ...w.dynamic };
      stepWorld(lv, w, { 1: buttons });
      stepPlayer(lv, mirror, buttons, MOVEMENT, dyn);
    };
    for (let t = 0; t < 300 && me.x > 10 * TILE + 8 + 6; t++) both(BTN.LEFT);
    for (let t = 0; t < 30; t++) both(0);
    both(BTN.ACTION);
    both(0);
    expect(w.dynamic[0]).toBe(true);
    for (let t = 0; t < 300; t++) both(R | BTN.RUN);
    expect(me.x).toBeGreaterThan(22 * TILE);
    expect(JSON.stringify(mirror)).toBe(JSON.stringify(me));
  });

  it('tileAt reads doors from the dynamic state', () => {
    expect(tileAt(lv, 20, 3)).toBe('D');
    expect(tileAt(lv, 20, 3, { 0: false })).toBe('D');
    expect(tileAt(lv, 20, 3, { 0: true })).toBe('d');
  });

  it('timed levers stay on for their duration and restart on a repeat pull', () => {
    const t = scene(
      (g) => {
        g[9][10] = 'l';
        for (let r = 0; r <= 9; r++) g[r][20] = 'D';
      },
      { links: [{ door: 0, levers: [0] }], levers: { 0: { ticks: 100 } } },
    );
    const w = world(t, at(t, 10 * TILE + 8));
    run(t, w, 3);
    pulse(t, w, 1);
    expect(w.dynamic[0]).toBe(true);
    run(t, w, 90);
    expect(w.dynamic[0]).toBe(true);
    pulse(t, w, 1); // restart
    run(t, w, 90);
    expect(w.dynamic[0]).toBe(true);
    run(t, w, 20);
    expect(w.dynamic[0]).toBe(false);
    expect(w.levers[0].on).toBe(false);
  });
});

describe('plates and doors', () => {
  const meta = (linger = 0): LevelMeta => ({ links: [{ door: 0, plates: [0], linger }] });
  const draw = (g: string[][]) => {
    g[9][5] = 'p';
    for (let r = 0; r <= 9; r++) g[r][20] = 'D';
  };

  it('are held only while someone stands on them', () => {
    const lv = scene(draw, meta());
    const p = at(lv, 5 * TILE + 8);
    const w = world(lv, p);
    run(lv, w, 5);
    expect(w.plates[0]).toBe(true);
    expect(w.dynamic[0]).toBe(true);
    run(lv, w, 10, { 1: R });
    run(lv, w, 30, { 1: R | BTN.RUN });
    expect(w.plates[0]).toBe(false);
    expect(w.dynamic[0]).toBe(false);
  });

  it('are not pressed from the air or by an away (disconnected) player', () => {
    const lv = scene(draw, meta());
    const air = at(lv, 5 * TILE + 8, FLOOR - 30);
    air.vy = -1;
    const w = world(lv, air);
    stepWorld(lv, w, { 1: BTN.JUMP });
    expect(w.plates[0]).toBe(false);
    const ghost = at(lv, 5 * TILE + 8);
    const w2 = world(lv, ghost);
    run(lv, w2, 5);
    expect(w2.plates[0]).toBe(true);
    ghost.away = true;
    run(lv, w2, 1);
    expect(w2.plates[0]).toBe(false);
    expect(w2.dynamic[0]).toBe(false);
  });

  it('linger keeps the door open to run through, then it closes', () => {
    const lv = scene(draw, meta(40));
    const w = world(lv, at(lv, 5 * TILE + 8));
    run(lv, w, 5);
    for (let t = 0; t < 60 && w.plates[0]; t++) stepWorld(lv, w, { 1: R | BTN.RUN });
    expect(w.plates[0]).toBe(false);
    expect(w.dynamic[0]).toBe(true);
    run(lv, w, 30);
    expect(w.dynamic[0]).toBe(true);
    run(lv, w, 15);
    expect(w.dynamic[0]).toBe(false);
  });

  it('never close on a player standing in the doorway', () => {
    const lv = scene(draw, meta());
    const holder = at(lv, 5 * TILE + 8, FLOOR, 2);
    const walker = at(lv, 20 * TILE + 8, FLOOR, 1);
    const w = world(lv, walker, holder);
    run(lv, w, 5);
    expect(w.dynamic[0]).toBe(true);
    holder.x = 3 * TILE; // releases the plate
    run(lv, w, 20);
    expect(w.plates[0]).toBe(false);
    expect(w.dynamic[0]).toBe(true); // walker is in the doorway
    walker.x = 25 * TILE;
    run(lv, w, 3);
    expect(w.dynamic[0]).toBe(false);
  });
});

describe('spikes, checkpoints, pits and shards', () => {
  it('spikes respawn the player at the spawn with invulnerability, keeping nothing else changed', () => {
    const lv = scene((g) => (g[9][12] = '^'));
    const p = at(lv, 6 * TILE);
    for (let i = 0; i < 200 && p.deaths === 0; i++) stepPlayer(lv, p, R);
    expect(p.deaths).toBe(1);
    expect(p.x).toBe(lv.spawn.x);
    expect(p.y).toBe(lv.spawn.y);
    expect(p.invuln).toBeGreaterThan(RULES.invulnTicks - 3);
    // jumping over spikes is safe
    const q = at(lv, 6 * TILE);
    for (let i = 0; i < 120; i++) stepPlayer(lv, q, R | BTN.RUN | (i > 45 && i < 80 ? BTN.JUMP : 0));
    expect(q.deaths).toBe(0);
    expect(q.x).toBeGreaterThan(14 * TILE);
  });

  it('invulnerability ticks down and protects against spikes', () => {
    const lv = scene((g) => {
      g[9][12] = '^';
      g[9][13] = '^';
    });
    const p = at(lv, 10 * TILE);
    p.invuln = RULES.invulnTicks;
    for (let i = 0; i < 60; i++) stepPlayer(lv, p, R | BTN.RUN);
    expect(p.deaths).toBe(0);
    expect(p.x).toBeGreaterThan(14 * TILE);
    for (let i = 0; i < RULES.invulnTicks; i++) stepPlayer(lv, p, 0);
    expect(p.invuln).toBe(0);
  });

  it('checkpoints activate on touch, are per player, and are used by pits and spikes', () => {
    const lv = scene(
      (g) => {
        g[9][5] = 'C';
        for (let c = 20; c <= 24; c++) g[10][c] = g[11][c] = '.'; // pit
        g[9][30] = '^';
      },
      {},
    );
    const a = at(lv, 3 * TILE, FLOOR, 1);
    const b = at(lv, 3 * TILE, FLOOR, 2);
    const w = world(lv, a, b);
    expect(a.checkpoint).toBe(-1);
    run(lv, w, 80, { 1: R }); // a walks over the flag
    expect(a.checkpoint).toBe(0);
    expect(b.checkpoint).toBe(-1);
    // a falls into the pit: respawns at the flag
    a.x = 22 * TILE;
    run(lv, w, 200);
    expect(a.deaths).toBe(1);
    expect(a.x).toBe(5 * TILE + 8);
    expect(a.y).toBe(FLOOR);
    // b has no checkpoint: pit sends it to the level spawn
    b.x = 22 * TILE;
    run(lv, w, 200);
    expect(b.x).toBe(lv.spawn.x);
    // a spike also uses the checkpoint
    a.x = 28 * TILE;
    a.invuln = 0;
    for (let t = 0; t < 120 && a.deaths < 2; t++) stepWorld(lv, w, { 1: R });
    expect(a.deaths).toBe(2);
    expect(a.x).toBe(5 * TILE + 8);
  });

  it('shards are collected once per player and kept through deaths', () => {
    const lv = scene((g) => {
      g[9][8] = 'o';
      g[6][10] = 'o'; // up in the air: needs a jump
      g[9][30] = '^';
    });
    const a = at(lv, 6 * TILE, FLOOR, 1);
    const b = at(lv, 6 * TILE, FLOOR, 2);
    const w = world(lv, a, b);
    run(lv, w, 60, { 1: R });
    expect(a.shards).toBe(1);
    expect(b.shards).toBe(0);
    run(lv, w, 90, { 1: BTN.LEFT });
    run(lv, w, 90, { 1: R });
    expect(a.shards).toBe(1); // already taken
    expect(hasShard(a, 1)).toBe(true); // ids are reading order: the airborne one is 0
    expect(hasShard(a, 0)).toBe(false);
    run(lv, w, 60, { 2: R });
    expect(b.shards).toBe(1); // b gets its own copy
    a.x = 29 * TILE;
    a.invuln = 0;
    run(lv, w, 100, { 1: R });
    expect(a.deaths).toBeGreaterThanOrEqual(1);
    expect(a.shards).toBe(1);
  });
});

describe('enemies', () => {
  const walkerScene = (kind: string, meta?: LevelMeta) =>
    scene((g) => {
      g[9][8] = '#';
      g[9][22] = '#';
      g[9][15] = kind;
      g[9][3] = 'C';
    }, meta);

  it('a patroller turns at walls', () => {
    const lv = walkerScene('e');
    const w = world(lv);
    let minX = Infinity;
    let maxX = -Infinity;
    for (let t = 0; t < 900; t++) {
      stepWorld(lv, w, {});
      minX = Math.min(minX, w.enemies[0].x);
      maxX = Math.max(maxX, w.enemies[0].x);
    }
    expect(minX).toBeGreaterThanOrEqual(9 * TILE + RULES.enemyHalfWidth - 0.6);
    expect(maxX).toBeLessThanOrEqual(22 * TILE - RULES.enemyHalfWidth + 0.6);
    expect(maxX - minX).toBeGreaterThan(150); // actually patrols
  });

  it('a patroller turns at ledges instead of walking off', () => {
    const lv = scene((g) => {
      for (let c = 10; c <= 14; c++) g[9][c] = '#'; // 1-tile block, top y=144
      g[8][12] = 'e';
    });
    const w = world(lv);
    let minX = Infinity;
    let maxX = -Infinity;
    for (let t = 0; t < 600; t++) {
      stepWorld(lv, w, {});
      minX = Math.min(minX, w.enemies[0].x);
      maxX = Math.max(maxX, w.enemies[0].x);
      expect(w.enemies[0].y).toBe(144);
    }
    expect(minX).toBeGreaterThanOrEqual(10 * TILE);
    expect(maxX).toBeLessThanOrEqual(15 * TILE);
    expect(maxX - minX).toBeGreaterThan(40);
  });

  const stompApex = (hold: boolean) => {
    const lv = walkerScene('e');
    const w = world(lv);
    const e = w.enemies[0];
    const p = at(lv, e.x, e.y - RULES.enemyHeight - 1);
    p.vy = 2;
    w.players.push(p);
    let apex = Infinity;
    for (let t = 0; t < 60; t++) {
      stepWorld(lv, w, { 1: hold ? BTN.JUMP : 0 });
      if (t === 0) {
        expect(e.alive).toBe(false);
        expect(p.vy).toBeLessThan(0);
        expect(p.deaths).toBe(0);
      }
      apex = Math.min(apex, p.y);
    }
    return { rise: e.y - RULES.enemyHeight - apex, p, w, lv };
  };

  it('stomping kills a stompable enemy and bounces, higher with jump held', () => {
    const low = stompApex(false);
    const high = stompApex(true);
    expect(low.rise).toBeGreaterThan(15);
    expect(high.rise).toBeGreaterThan(low.rise + 25);
  });

  it('a stomped enemy comes back after its respawn time', () => {
    const { w, lv } = stompApex(false);
    expect(w.enemies[0].alive).toBe(false);
    run(lv, w, RULES.enemyRespawnTicks);
    expect(w.enemies[0].alive).toBe(true);
  });

  it('touching an enemy respawns you at your checkpoint with invulnerability; shards are kept', () => {
    const lv = walkerScene('e');
    const w = world(lv);
    const e = w.enemies[0];
    const p = at(lv, e.x + 30);
    p.checkpoint = 0;
    p.shards = 3;
    w.players.push(p);
    for (let t = 0; t < 120 && p.deaths === 0; t++) stepWorld(lv, w, { 1: BTN.LEFT });
    expect(p.deaths).toBe(1);
    expect(p.x).toBe(3 * TILE + 8);
    expect(p.invuln).toBeGreaterThan(RULES.invulnTicks - 3);
    expect(p.shards).toBe(3);
    expect(e.alive).toBe(true);
    // while invulnerable, walking into it again does nothing
    p.x = e.x + 3;
    p.y = FLOOR;
    p.prevY = FLOOR;
    run(lv, w, 3);
    expect(p.deaths).toBe(1);
  });

  it('a spiky patroller cannot be stomped', () => {
    const lv = walkerScene('k');
    const w = world(lv);
    const e = w.enemies[0];
    const p = at(lv, e.x, e.y - RULES.enemyHeight - 1);
    p.vy = 2;
    w.players.push(p);
    run(lv, w, 3);
    expect(e.alive).toBe(true);
    expect(p.deaths).toBe(1);
  });

  it('flyers follow a deterministic bounded sine path', () => {
    const lv = scene((g) => (g[5][15] = 'z'));
    const def = lv.enemies[0];
    const a = world(lv);
    const b = world(lv);
    let minY = Infinity;
    let maxY = -Infinity;
    let minX = Infinity;
    let maxX = -Infinity;
    for (let t = 0; t < 600; t++) {
      stepWorld(lv, a, {});
      stepWorld(lv, b, {});
      const e = a.enemies[0];
      minY = Math.min(minY, e.y);
      maxY = Math.max(maxY, e.y);
      minX = Math.min(minX, e.x);
      maxX = Math.max(maxX, e.x);
    }
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(maxY - def.y).toBeCloseTo(12, 5);
    expect(minY - def.y).toBeCloseTo(-12, 5);
    expect(maxX).toBeCloseTo(def.x + def.range, 5);
    expect(minX).toBeCloseTo(def.x - def.range, 5);
  });

  it('away players are not hurt by enemies', () => {
    const lv = walkerScene('e');
    const w = world(lv);
    const e = w.enemies[0];
    const p = at(lv, e.x);
    p.away = true;
    w.players.push(p);
    run(lv, w, 10);
    expect(p.deaths).toBe(0);
  });
});

describe('level registry and metadata', () => {
  it('parseLevel keeps the playground intact and accepts JSON metadata', () => {
    expect(PLAYGROUND.doors).toHaveLength(0);
    expect(PLAYGROUND.enemies).toHaveLength(0);
    expect(getLevel('playground')).toBe(PLAYGROUND);
    expect(getLevel('coopRoom')).toBe(COOP_ROOM);
    expect(getLevel('nope')).toBeUndefined();
    expect(getLevel('__proto__')).toBeUndefined();
    expect(Object.keys(LEVELS)).toEqual(['playground', 'coopRoom', 'raidRoom', 'poundRoom']);
    const lv = parseLevel('j', ['S.p.l.D', '#######'], JSON.stringify({ links: [{ door: 0, plates: [0], levers: [0] }] }));
    expect(lv.links).toHaveLength(1);
    expect(lv.plates).toHaveLength(1);
    expect(lv.levers).toHaveLength(1);
    expect(lv.doors[0].tiles).toEqual([[6, 0]]);
    expect(() => parseLevel('bad', ['S.D', '###'], { links: [{ door: 3 }] })).toThrow();
  });

  it('assigns ids in reading order and groups door tiles', () => {
    const lv = parseLevel('ids', ['.D..D', '.D.lD', 'pD.lD', '#####']);
    expect(lv.doors.map((d) => d.tiles.length)).toEqual([3, 3]);
    expect(lv.levers.map((l) => [l.col, l.row])).toEqual([
      [3, 1],
      [3, 2],
    ]);
  });
});
