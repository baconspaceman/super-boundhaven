import { describe, expect, it } from 'vitest';
import { COOP_IDS, COOP_ROOM, PLAYGROUND, TILE, createPlayer, getLevel, LEVELS, stepPlayer, BTN, type PlayerState } from '@sbh/sim';
import { createWorldView, applyNetWorld } from '@sbh/protocol';
import {
  DOOR_ANIM_MS,
  DoorTracker,
  LEVER_TIMER_FRAMES,
  LocalWatch,
  deathsIncreased,
  doorOpenness,
  doorPhase,
  enemyAnimKey,
  flagActive,
  flickerDim,
  hudLines,
  leverInReach,
  leverTimerFrame,
  leverVisual,
  roomStatus,
  smoothToward,
} from '../src/scene-logic';
import { Game } from '../src/game';
import { BIT } from '../src/bindings';
import { parseFrames } from '../src/atlas-json';

const lvl = COOP_ROOM;
const me0 = (): PlayerState => createPlayer(1, lvl);
const setGot = (p: PlayerState, id: number): void => {
  p.got[id >> 5] = (p.got[id >> 5] ?? 0) | (1 << (id & 31));
  p.shards++;
};

describe('LocalWatch: deaths / shards / checkpoint transitions', () => {
  it('adopts the first state silently', () => {
    const w = new LocalWatch();
    const p = me0();
    p.deaths = 3;
    setGot(p, 2);
    const e = w.observe(p, lvl);
    expect(e).toEqual({ respawned: false, shards: [], checkpoint: false });
  });

  it('fires respawned once per deaths increment, never when it rewinds and returns', () => {
    const w = new LocalWatch();
    const p = me0();
    w.observe(p, lvl);
    p.deaths = 1;
    expect(w.observe(p, lvl).respawned).toBe(true);
    expect(w.observe(p, lvl).respawned).toBe(false);
    // reconcile momentarily restores older server state, then the replay brings deaths back
    p.deaths = 0;
    expect(w.observe(p, lvl).respawned).toBe(false);
    p.deaths = 1;
    expect(w.observe(p, lvl).respawned).toBe(false);
    p.deaths = 2;
    expect(w.observe(p, lvl).respawned).toBe(true);
  });

  it('reports each newly collected shard exactly once', () => {
    const w = new LocalWatch();
    const p = me0();
    setGot(p, 0);
    w.observe(p, lvl);
    setGot(p, 3);
    setGot(p, 4);
    expect(w.observe(p, lvl).shards).toEqual([3, 4]);
    expect(w.observe(p, lvl).shards).toEqual([]);
    p.got = [0]; // prediction rewound by a reconcile
    expect(w.observe(p, lvl).shards).toEqual([]);
    p.got = [(1 << 0) | (1 << 3) | (1 << 4)];
    expect(w.observe(p, lvl).shards).toEqual([]);
  });

  it('flags a new checkpoint and resets cleanly', () => {
    const w = new LocalWatch();
    const p = me0();
    w.observe(p, lvl);
    p.checkpoint = 0;
    expect(w.observe(p, lvl).checkpoint).toBe(true);
    expect(w.observe(p, lvl).checkpoint).toBe(false);
    p.checkpoint = 1;
    expect(w.observe(p, lvl).checkpoint).toBe(true);
    w.reset();
    p.deaths = 9;
    expect(w.observe(p, lvl).respawned).toBe(false); // re-primed
  });

  it('per-player deaths detector', () => {
    expect(deathsIncreased(undefined, 4)).toBe(false);
    expect(deathsIncreased(1, 1)).toBe(false);
    expect(deathsIncreased(1, 2)).toBe(true);
  });
});

describe('invulnerability flicker', () => {
  it('only dims while invuln > 0 and strobes with time', () => {
    expect(flickerDim(0, 0)).toBe(false);
    const states = new Set<boolean>();
    for (let t = 0; t < 400; t += 10) states.add(flickerDim(30, t));
    expect(states).toEqual(new Set([true, false]));
    for (let t = 0; t < 400; t += 10) expect(flickerDim(0, t)).toBe(false);
  });
});

describe('door render state', () => {
  it('derives phase from open state and time since the flip', () => {
    expect(doorPhase(false, -Infinity, 1000)).toBe('closed');
    expect(doorPhase(true, -Infinity, 1000)).toBe('open');
    expect(doorPhase(true, 1000, 1000 + DOOR_ANIM_MS - 1)).toBe('opening');
    expect(doorPhase(true, 1000, 1000 + DOOR_ANIM_MS)).toBe('open');
    expect(doorPhase(false, 1000, 1100)).toBe('closing');
    expect(doorPhase(false, 1000, 1000 + DOOR_ANIM_MS)).toBe('closed');
  });

  it('openness ramps 0->1 opening and 1->0 closing', () => {
    expect(doorOpenness('closed', 0, 99999)).toBe(0);
    expect(doorOpenness('open', 0, 99999)).toBe(1);
    expect(doorOpenness('opening', 0, DOOR_ANIM_MS / 2)).toBeCloseTo(0.5);
    expect(doorOpenness('closing', 0, DOOR_ANIM_MS / 4)).toBeCloseTo(0.75);
  });

  it('tracker adopts first sight silently and reports flips once', () => {
    const t = new DoorTracker();
    expect(t.observe(0, true, 100)).toBeNull(); // already open when we joined: no anim, no pulse
    expect(doorPhase(true, t.sinceOf(0), 100)).toBe('open');
    expect(t.observe(0, true, 116)).toBeNull();
    expect(t.observe(0, false, 200)).toBe('closed');
    expect(t.observe(0, false, 216)).toBeNull();
    expect(t.observe(0, true, 5000)).toBe('opened');
    expect(doorPhase(true, t.sinceOf(0), 5100)).toBe('opening');
    t.reset();
    expect(t.observe(0, false, 6000)).toBeNull();
  });

  it('follows the real snapshot state: gate 0 opens when the world frame lists it', () => {
    const view = createWorldView();
    const t = new DoorTracker();
    t.observe(COOP_IDS.door.gate0, view.dynamic[COOP_IDS.door.gate0] === true, 0);
    applyNetWorld(view, { epoch: 0, doors: [COOP_IDS.door.gate0] });
    expect(t.observe(COOP_IDS.door.gate0, view.dynamic[COOP_IDS.door.gate0] === true, 50)).toBe('opened');
    applyNetWorld(view, { epoch: 0, doors: [] });
    expect(t.observe(COOP_IDS.door.gate0, view.dynamic[COOP_IDS.door.gate0] === true, 9000)).toBe('closed');
  });
});

describe('levers, plates, flags', () => {
  it('timer ring frame follows the remaining ticks', () => {
    expect(leverTimerFrame(300, 300)).toBe(0);
    expect(leverTimerFrame(0, 300)).toBe(LEVER_TIMER_FRAMES - 1);
    expect(leverTimerFrame(150, 300)).toBe(3);
    const seq = [300, 250, 200, 150, 100, 50, 1].map((t) => leverTimerFrame(t, 300));
    expect([...seq].sort((a, b) => a - b)).toEqual(seq); // monotonic as it runs out
    expect(leverTimerFrame(5, 0)).toBe(0);
  });

  it('lever visual: reset variant, timer only while counting, otherwise on/off', () => {
    const timed = lvl.levers[COOP_IDS.lever.timed];
    const toggle = lvl.levers[COOP_IDS.lever.ledge];
    const reset = lvl.levers[COOP_IDS.lever.reset0];
    expect(leverVisual(reset, true, 0)).toBe('reset');
    expect(leverVisual(timed, true, 120)).toBe('timer');
    expect(leverVisual(timed, true, 0)).toBe('on');
    expect(leverVisual(timed, false, 0)).toBe('off');
    expect(leverVisual(toggle, true, 0)).toBe('on');
    expect(leverVisual(toggle, false, 0)).toBe('off');
  });

  it('flag is active once reached or passed', () => {
    expect(flagActive(0, -1)).toBe(false);
    expect(flagActive(0, 0)).toBe(true);
    expect(flagActive(1, 0)).toBe(false);
    expect(flagActive(1, 2)).toBe(true);
  });

  it('enemy anim keys and smoothing', () => {
    expect(enemyAnimKey(0, true)).toBe('sprout_walk');
    expect(enemyAnimKey(0, false)).toBe('sprout_squash');
    expect(enemyAnimKey(1, true)).toBe('zip_fly');
    expect(enemyAnimKey(1, false)).toBe('zip_down');
    expect(enemyAnimKey(2, true)).toBe('shard_walk');
    expect(enemyAnimKey(2, false)).toBe('shard_defeat');
    let x = 0;
    for (let i = 0; i < 60; i++) x = smoothToward(x, 10, 16);
    expect(x).toBe(10);
    expect(smoothToward(0, 10, 16)).toBeGreaterThan(0);
    expect(smoothToward(0, 10, 16)).toBeLessThan(10);
  });
});

describe('ACTION prompt reach (mirrors the sim)', () => {
  const lever = lvl.levers[COOP_IDS.lever.timed];
  const lx = lever.col * TILE + TILE / 2;
  const feet = (lever.row + 1) * TILE;

  it('shows for a standing player next to the lever, not far away', () => {
    const p = me0();
    p.x = lx + 10;
    p.y = feet;
    expect(leverInReach(lvl, p)?.id).toBe(lever.id);
    p.x = lx + 21;
    expect(leverInReach(lvl, p)).toBeNull();
  });

  it('uses the crouched body center vertically', () => {
    const p = me0();
    p.x = lx;
    p.y = feet + 40; // too low
    expect(leverInReach(lvl, p)).toBeNull();
    p.y = feet;
    p.crouching = true;
    expect(leverInReach(lvl, p)).not.toBeNull();
  });

  it('hides for away players and with no player', () => {
    const p = me0();
    p.x = lx;
    p.y = feet;
    p.away = true;
    expect(leverInReach(lvl, p)).toBeNull();
    expect(leverInReach(lvl, null)).toBeNull();
  });

  it('agrees with the sim: pulling in reach with ACTION toggles, so the prompt is truthful', () => {
    // sim exposes `act` on the stepped player; the reach test above is the same arithmetic as stepWorld
    const p = me0();
    p.x = lx;
    p.y = feet;
    p.onGround = true;
    stepPlayer(lvl, p, BTN.ACTION);
    expect(p.act).toBe(true);
    expect(leverInReach(lvl, p)).not.toBeNull();
  });
});

describe('HUD text', () => {
  it('co-op room: needs 2 players until a partner connects', () => {
    expect(roomStatus(lvl, 1).text).toBe('NEEDS 2 PLAYERS');
    expect(roomStatus(lvl, 2).text).toBe('');
    expect(roomStatus(PLAYGROUND, 1).text).toBe('');
  });

  it('lines: shards, flag, deaths, players, warning marker', () => {
    const p = me0();
    p.shards = 2;
    p.deaths = 1;
    p.checkpoint = 0;
    const solo = hudLines(lvl, p, 1);
    expect(solo[0]).toBe(`SHARDS 2/${lvl.shards.length}`);
    expect(solo).toContain(`FLAG 1/${lvl.checkpoints.length}`);
    expect(solo).toContain('DEATHS 1');
    expect(solo.at(-1)).toBe('!NEEDS 2 PLAYERS');
    expect(hudLines(lvl, p, 2).at(-1)).toBe('PLAYERS 2');
    expect(hudLines(lvl, me0(), 2)).toEqual([`SHARDS 0/${lvl.shards.length}`, 'PLAYERS 2']);
    expect(hudLines(lvl, p, 2).some((l) => l.startsWith('!'))).toBe(false);
  });
});

describe('atlas json parsing', () => {
  it('accepts {frames}, {objects} and bare maps, ignores junk', () => {
    const f = { a: { x: 0, y: 1, w: 2, h: 3 }, b: { nope: 1 } };
    expect(Object.keys(parseFrames({ frames: f }))).toEqual(['a']);
    expect(Object.keys(parseFrames({ objects: f }))).toEqual(['a']);
    expect(Object.keys(parseFrames(f))).toEqual(['a']);
    expect(parseFrames(null)).toEqual({});
  });
});

describe('Game: levels, world view, prediction against doors / crouch', () => {
  it('uses the level named by welcome and reports a change', () => {
    const g = new Game();
    expect(g.levelName).toBe('playground');
    expect(g.welcome(1, 'coopRoom')).toBe(true);
    expect(g.level).toBe(LEVELS.coopRoom);
    expect(g.welcome(1, 'coopRoom')).toBe(false);
    expect(g.welcome(1, 'nonsense')).toBe(false); // unknown names keep the current level
    expect(g.level).toBe(getLevel('coopRoom'));
  });

  it('applies snap.world and predicts through an open door but not a closed one', () => {
    const g = new Game();
    g.welcome(1, 'coopRoom');
    const gate = COOP_ROOM.doors[COOP_IDS.door.gate0];
    const [gc, gr] = gate.tiles[gate.tiles.length - 1];
    const start = { x: gc * TILE - 12, y: (gr + 1) * TILE };
    const spawn = (): PlayerState => {
      const p = createPlayer(1, COOP_ROOM);
      p.x = start.x;
      p.y = start.y;
      p.onGround = true;
      return p;
    };
    const run = (g2: Game): number => {
      g2.me = spawn();
      for (let i = 0; i < 60; i++) g2.tick(BIT.RIGHT | BIT.RUN);
      return g2.me.x;
    };
    const closed = run(g);
    expect(closed).toBeLessThanOrEqual(gc * TILE - 7 + 0.01);

    const g2 = new Game();
    g2.welcome(1, 'coopRoom');
    g2.onSnapshot(1, [], 0, { epoch: 0, full: 1, doors: [COOP_IDS.door.gate0] });
    expect(g2.view.dynamic[COOP_IDS.door.gate0]).toBe(true);
    expect(run(g2)).toBeGreaterThan(gc * TILE + 8);
  });

  it('predicts crouch with the short hitbox and counts reconcile snaps', () => {
    const g = new Game();
    g.welcome(1, 'playground');
    const p = createPlayer(1, g.level);
    p.onGround = true;
    g.me = p;
    g.tick(BIT.CROUCH);
    expect(g.me.crouching).toBe(true);
    expect(g.drawables(0)[0].crouching).toBe(true);
  });

  it('level change clears world state', () => {
    const g = new Game();
    g.welcome(1, 'coopRoom');
    g.onSnapshot(1, [], 0, { epoch: 3, full: 1, doors: [0], plates: [1], levers: [[0, 1, 5]], enemies: [[0, 1, 2, 1]] });
    expect(g.view.enemies.size).toBe(1);
    g.welcome(1, 'playground');
    expect(g.view.enemies.size).toBe(0);
    expect(g.view.dynamic[0]).toBeUndefined();
    expect(g.view.epoch).toBe(0);
  });
});
