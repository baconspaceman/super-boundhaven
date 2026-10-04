import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BTN_MASK, MOVEMENT, RULES, TICK_RATE, TILE } from '../src/index';
import { BOUNCE_VY, HARD_LAND_VY, STOMP_MIN_VY } from '../../../apps/client/src/rumble';
import { HEADER, OUT_REL, buildNumbers, outPath, read } from '../../../tools/mechanics/gen-numbers.mjs';

// The mechanics docs quote tunables as <!--num:TAG-->value<!--/num-->. These tests fail when the code moves and the
// docs did not. Fix: run `npm run docs:mechanics` (regenerates NUMBERS.md) and update the quoted values by hand.

const DOCS = [
  'docs/mechanics/MECHANICS.md',
  'docs/mechanics/TUNING_GUIDE.md',
  'docs/mechanics/LEVEL_DESIGN_GUIDE.md',
];
const TAG = /<!--num:([A-Za-z0-9_.]+)-->(.*?)<!--\/num-->/g;

const built = buildNumbers();
const exists = (rel: string) => {
  try {
    read(rel);
    return true;
  } catch {
    return false;
  }
};

describe('mechanics docs: generated numbers', () => {
  it('NUMBERS.md exists, carries the GENERATED header and matches the live sim', () => {
    expect(existsSync(outPath()), `${OUT_REL} missing: run npm run docs:mechanics`).toBe(true);
    const have = read(OUT_REL);
    expect(have.startsWith(`<!-- ${HEADER} -->`)).toBe(true);
    expect(have === built.markdown, `${OUT_REL} is stale: run npm run docs:mechanics`).toBe(true);
  });

  it('registers every MOVEMENT and RULES key as a tag with the live value', () => {
    for (const [k, v] of Object.entries(MOVEMENT)) expect(built.tags.get(k), `MOVEMENT.${k}`).toBe(String(v));
    for (const [k, v] of Object.entries(RULES)) {
      if (k === 'defaultRoom') continue;
      expect(built.tags.get(`rules.${k}`), `RULES.${k}`).toBe(String(v));
    }
    for (const [k, v] of Object.entries(RULES.defaultRoom)) expect(built.tags.get(`room.${k}`), `RULES.defaultRoom.${k}`).toBe(String(v));
    expect(built.tags.get('TILE')).toBe(String(TILE));
    expect(built.tags.get('TICK_RATE')).toBe(String(TICK_RATE));
    expect(built.tags.get('BTN_MASK')).toBe(String(BTN_MASK));
  });
});

// Invariants the code relies on (TUNING_GUIDE.md section 8, group C and D). A tuning change that breaks one of
// these is not wrong by itself, but it must come with the matching change named in the message.
describe('config invariants and client copies', () => {
  const M = MOVEMENT;
  it('slope handling: slopeInset > halfWidth + runMax, slopeSnap >= runMax', () => {
    expect(M.slopeInset, 'raise slopeInset when halfWidth or runMax grows').toBeGreaterThan(M.halfWidth + M.runMax);
    expect(M.slopeSnap, 'a run down a 45 degree ramp drops runMax px per tick').toBeGreaterThanOrEqual(M.runMax);
  });
  it('stomp windows catch a full-speed fall', () => {
    expect(M.stompWindow).toBeGreaterThanOrEqual(M.maxFall);
    expect(RULES.stompWindow).toBeGreaterThanOrEqual(M.maxFall);
    expect(M.stompTolerance).toBeLessThan(M.stompWindow);
    expect(RULES.stompSlack).toBeLessThan(RULES.stompWindow);
  });
  it('hitbox geometry: crouch fits a 1-tile gap, standing fits a 2-tile gap', () => {
    expect(M.crouchHeight).toBeLessThanOrEqual(TILE);
    expect(M.crouchHeight).toBeLessThan(M.height);
    expect(M.height).toBeLessThanOrEqual(2 * TILE);
  });
  it('a drop-through falls less than one tile before landing is allowed again', () => {
    const fall = (M.dropTicks * (M.dropTicks + 1)) / 2 * M.gravityFall;
    expect(fall).toBeLessThan(TILE);
  });
  it('no per-tick speed can skip a tile', () => {
    for (const v of [M.maxFall, M.padHeldVel, M.padVel, M.stompHeldVel, M.runMax, RULES.walkerSpeed, RULES.flyerSpeed, RULES.enemyMaxFall]) {
      expect(v).toBeLessThan(TILE);
    }
  });
  it('speed ordering: crouchMax <= walkMax < runMax, accel < skid, friction < skid', () => {
    expect(M.crouchMax).toBeLessThanOrEqual(M.walkMax);
    expect(M.walkMax).toBeLessThan(M.runMax);
    expect(M.accel).toBeLessThan(M.skid);
    expect(M.friction).toBeLessThan(M.skid);
  });
  it('launch speeds are ordered and match the client rumble classifier', () => {
    expect(M.padHeldVel).toBeGreaterThan(M.padVel);
    expect(M.padVel).toBeGreaterThan(M.stompHeldVel);
    expect(M.stompHeldVel).toBeGreaterThan(M.stompVel);
    expect(M.padVel, 'rumble.ts BOUNCE_VY must stay below the pad launch').toBeGreaterThan(-BOUNCE_VY);
    expect(M.stompHeldVel, 'rumble.ts BOUNCE_VY must stay above a held stomp').toBeLessThan(-BOUNCE_VY);
    expect(M.stompVel, 'rumble.ts STOMP_MIN_VY must stay below a tap stomp').toBeGreaterThan(-STOMP_MIN_VY);
    const runJump = M.jumpVel + M.runMax * M.runBonus;
    expect(runJump, 'rumble.ts HARD_LAND_VY must stay above a run-jump landing').toBeLessThan(HARD_LAND_VY);
    expect(HARD_LAND_VY, 'rumble.ts HARD_LAND_VY must stay below maxFall').toBeLessThan(M.maxFall);
  });
  it('motion.ts copies walkMax and runMax', () => {
    const src = read('apps/client/src/motion.ts');
    const walk = Number(/const WALK_MAX = ([0-9.]+)/.exec(src)?.[1]);
    const run = Number(/const RUN_MAX = ([0-9.]+)/.exec(src)?.[1]);
    expect(walk, 'apps/client/src/motion.ts WALK_MAX').toBe(M.walkMax);
    expect(run, 'apps/client/src/motion.ts RUN_MAX').toBe(M.runMax);
  });
});

describe('mechanics docs: quoted numbers', () => {
  for (const rel of DOCS) {
    describe(rel, () => {
      it('exists, starts with a core summary and every num tag matches the code', () => {
        expect(exists(rel), `${rel} missing`).toBe(true);
        const text = read(rel);
        expect(text.includes('<!-- core:start -->') && text.includes('<!-- core:end -->'), 'core:start/core:end markers').toBe(true);
        expect(text.indexOf('<!-- core:start -->')).toBeLessThan(text.indexOf('<!-- core:end -->'));
        const words = text.slice(text.indexOf('<!-- core:start -->'), text.indexOf('<!-- core:end -->')).split(/\s+/).length;
        expect(words, 'core summary length (150-400 words)').toBeGreaterThanOrEqual(150);
        expect(words).toBeLessThanOrEqual(420);
        const bad: string[] = [];
        let n = 0;
        for (const m of text.matchAll(TAG)) {
          n++;
          const want = built.tags.get(m[1]);
          if (want === undefined) bad.push(`unknown tag "${m[1]}"`);
          else if (want !== m[2]) bad.push(`${m[1]}: doc says ${m[2]}, code says ${want}`);
        }
        expect(bad, bad.join('\n')).toEqual([]);
        // every doc must actually use the tags (an untagged doc cannot drift-check anything)
        expect(n, 'number of <!--num:--> tags').toBeGreaterThan(0);
      });
    });
  }

  it('MECHANICS.md tags every MOVEMENT tunable at least once', () => {
    const text = read('docs/mechanics/MECHANICS.md') + read('docs/mechanics/TUNING_GUIDE.md');
    const used = new Set([...text.matchAll(TAG)].map((m) => m[1]));
    const missing = Object.keys(MOVEMENT).filter((k) => !used.has(k));
    expect(missing, `MOVEMENT keys never quoted with a num tag: ${missing.join(', ')}`).toEqual([]);
    const missingRules = Object.keys(RULES)
      .filter((k) => k !== 'defaultRoom')
      .filter((k) => !used.has(`rules.${k}`));
    expect(missingRules, `RULES keys never quoted: ${missingRules.join(', ')}`).toEqual([]);
  });
});
