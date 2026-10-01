// Three original enemy species (all face LEFT by default; flipH at runtime).
//  - Sproutling: plum turnip-imp with a leafy sprout (ground patroller, stompable)
//  - Zipwing: teal buzz-bug with gauzy wings (flyer, stompable)
//  - Shardback: slate pillbug with crystal spikes on its back (armored/spiky, NOT stompable)
import type { Bitmap } from '../core';
import { flipVRows, outlineFor, palFrom, Sprite } from './kit';
import { shadedEllipse } from './shape';

const SPROUT_PAL = palFrom({}, { ABC: [300, 0.5, 0.52], GHI: [112, 0.62, 0.46] });
const SPROUT_OUT = outlineFor(['ABC', 'GHI']);

const SPROUT_FACE = [
  'PP.....PP',
  '.PP...PP.',
  'PWW...PWW',
  'PWW...PWW',
  '..PPPPP..',
  '..W.P.W..',
];
const SPROUT_LEAF = ['GG..HH', 'GGGHHH', '.GGHH.', '..GH..', '..H...'];
const SPROUT_FOOT = ['.BBB.', 'CCCCC'];

function sprout(feet: [number, number], dyBody: number, squash: boolean, leafSway: number): Bitmap {
  const s = new Sprite(18, 18);
  const body = shadedEllipse(14, squash ? 9 : 10, ['A', 'B', 'C']);
  s.put(SPROUT_FOOT, 3, 14 + feet[0]);
  s.put(SPROUT_FOOT, 10, 14 + feet[1]);
  s.put(body, 2, 4 + dyBody + (squash ? 1 : 0));
  s.put(SPROUT_FACE, 4, 6 + dyBody + (squash ? 1 : 0));
  s.put(SPROUT_LEAF, 5 + leafSway, dyBody - 1 + 1);
  return s.bitmap(SPROUT_OUT, SPROUT_PAL);
}

function sproutFlat(): Bitmap {
  const s = new Sprite(18, 18);
  s.put(SPROUT_FOOT, 1, 15);
  s.put(SPROUT_FOOT, 11, 15);
  s.put(shadedEllipse(14, 6, ['A', 'B', 'C']), 2, 10);
  s.put(['PBP..PBP', '.PB..BP.'], 4, 11);
  s.put(['.PPPP.'], 6, 14);
  s.put(['GH', '.H'], 7, 8);
  return s.bitmap(SPROUT_OUT, SPROUT_PAL);
}

// ---------------------------------------------------------------------------------------------
const ZIP_PAL = palFrom({ Y: '#f7cf3a', Z: '#c98a1c', U: '#8f98dc', V: '#bccdf6' }, { ABC: [176, 0.62, 0.44] });
ZIP_PAL.W = '#f6f3ff';
const ZIP_OUT = outlineFor(['ABC'], { Y: ['Z', 'Z'], Z: ['Z', 'Z'], W: ['U', 'V'], V: ['U', 'U'], U: ['U', 'U'] });
const WINGS: string[][] = [
  ['..UV....', '.UWWV...', '.UWWWV..', '..UWWV..', '...UU...'],
  ['...VWWV.', '..VWWWWU', '.UVWWWU.', '...UUU..'],
  ['........', '..UUU...', '.VWWWVU.', 'VWWWWWWV', '.UVVVVU.'],
];
const ZIP_EYE = ['PWW', 'PWW', '.PP'];

function zip(wing: number, bob: number, down = false): Bitmap {
  const s = new Sprite(22, 20);
  const body = shadedEllipse(12, 9, ['A', 'B', 'C']);
    s.put(body, 4, 8 + bob);
  // stripes
  for (const x of [9, 12]) for (let y = 9; y < 16; y++) if (s.c[y + bob]?.[x] && s.c[y + bob][x] !== '.') s.c[y + bob][x] = 'Y';
  s.put(['..ZZ'], 15, 12 + bob);
  s.put(['.CC', 'CCC'], 15, 13 + bob);
  s.put(ZIP_EYE, 5, 9 + bob);
  s.put(['.Y', 'Y.', 'YY'].map((r) => r), 6, 5 + bob);
  s.put(['Y'], 6, 4 + bob);
  s.put(WINGS[wing], 8, wing === 2 ? 11 + bob : 2 + bob + (wing === 1 ? 2 : 0));
  void down;
  return s.bitmap(ZIP_OUT, ZIP_PAL);
}

function zipDown(): Bitmap {
  const s = new Sprite(22, 20);
  s.put(flipVRows(shadedEllipse(12, 9, ['A', 'B', 'C'])), 4, 8);
  s.put(['P.P', '.P.', 'P.P'], 5, 10);
  s.put(['UV', 'VW'], 6, 6);
  s.put(['.UV..', 'UVWWV'], 10, 6);
  s.put(['.CC', 'CCC'], 15, 11);
  return s.bitmap(ZIP_OUT, ZIP_PAL);
}

// ---------------------------------------------------------------------------------------------
const SHARD_PAL = palFrom({}, { ABC: [218, 0.3, 0.45], STU: [318, 0.66, 0.56] });
const SHARD_OUT = outlineFor(['ABC', 'STU']);
const CRYSTAL = ['.S.', '.SS', 'STT', 'STT', 'STU', 'TUU'];
const CRYSTAL_S = ['.S', 'SS', 'ST', 'TU'];

function shard(step: number): Bitmap {
  const s = new Sprite(26, 20);
  const legs = [
    [0, 1],
    [1, 0],
    [0, 0],
  ][step];
  s.put(['CCC', 'CCC'], 7, 15 + legs[0]);
  s.put(['CCC', 'CCC'], 15, 15 + legs[1]);
  s.put(shadedEllipse(18, 10, ['A', 'B', 'C'], { belly: { ramp: ['B', 'C', 'C'], minNy: 0.45 } }), 7, 6);
  s.put(shadedEllipse(9, 8, ['A', 'B', 'C']), 1, 9);
  s.put(['PWW', 'PWW', 'PP.'], 2, 11);
  s.put(['P..', '.P.'], 2, 9);
  s.put(CRYSTAL, 9, 1);
  s.put(CRYSTAL, 13, 0);
  s.put(CRYSTAL_S, 17, 3);
  s.put(['.CCC'], 20, 14);
  return s.bitmap(SHARD_OUT, SHARD_PAL);
}

function shardDefeat(): Bitmap {
  const s = new Sprite(26, 20);
  s.put(flipVRows(shadedEllipse(18, 10, ['A', 'B', 'C'])), 7, 6);
  s.put(['CCC', 'CCC'], 8, 2);
  s.put(['CCC', 'CCC'], 15, 2);
  s.put(flipVRows(CRYSTAL), 10, 15);
  s.put(flipVRows(CRYSTAL), 14, 15);
  s.put(shadedEllipse(9, 8, ['A', 'B', 'C']), 1, 9);
  s.put(['P.P', '.P.', 'P.P'], 3, 11);
  return s.bitmap(SHARD_OUT, SHARD_PAL);
}

function shardCurl(): Bitmap {
  const s = new Sprite(22, 22);
  s.put(shadedEllipse(14, 14, ['A', 'B', 'C']), 4, 4);
  s.put(['.S.', 'STT', 'TUU'], 9, 1);
  s.put(['S.', 'ST', 'TU'], 1, 7);
  s.put(['.S', 'TS', 'UT'], 17, 7);
  s.put(['STT', 'TUU'], 9, 18);
  s.put(['PWW', 'PP.'], 6, 8);
  return s.bitmap(SHARD_OUT, SHARD_PAL);
}

export const ENEMY_ANIMS: Record<string, { frames: string[]; fps: number; loop: boolean; ticks: number[]; stompable: boolean }> = {
  sprout_walk: { frames: ['enemy/sprout_walk_0', 'enemy/sprout_walk_1', 'enemy/sprout_walk_2', 'enemy/sprout_walk_3'], fps: 7.5, loop: true, ticks: [8, 8, 8, 8], stompable: true },
  sprout_squash: { frames: ['enemy/sprout_squash'], fps: 1, loop: false, ticks: [30], stompable: true },
  zip_fly: { frames: ['enemy/zip_fly_0', 'enemy/zip_fly_1', 'enemy/zip_fly_2', 'enemy/zip_fly_3'], fps: 15, loop: true, ticks: [4, 4, 4, 4], stompable: true },
  zip_down: { frames: ['enemy/zip_down'], fps: 1, loop: false, ticks: [30], stompable: true },
  shard_walk: { frames: ['enemy/shard_walk_0', 'enemy/shard_walk_1', 'enemy/shard_walk_2'], fps: 6, loop: true, ticks: [10, 10, 10], stompable: false },
  shard_curl: { frames: ['enemy/shard_curl'], fps: 1, loop: false, ticks: [30], stompable: false },
  shard_defeat: { frames: ['enemy/shard_defeat'], fps: 1, loop: false, ticks: [30], stompable: false },
};

export function buildEnemyFrames(): Record<string, Bitmap> {
  return {
    'enemy/sprout_walk_0': sprout([0, -1], 0, false, 0),
    'enemy/sprout_walk_1': sprout([0, 0], 1, true, 1),
    'enemy/sprout_walk_2': sprout([-1, 0], 0, false, 0),
    'enemy/sprout_walk_3': sprout([0, 0], 1, true, -1),
    'enemy/sprout_squash': sproutFlat(),
    'enemy/zip_fly_0': zip(0, 0),
    'enemy/zip_fly_1': zip(1, 1),
    'enemy/zip_fly_2': zip(2, 0),
    'enemy/zip_fly_3': zip(1, -1),
    'enemy/zip_down': zipDown(),
    'enemy/shard_walk_0': shard(0),
    'enemy/shard_walk_1': shard(1),
    'enemy/shard_walk_2': shard(2),
    'enemy/shard_curl': shardCurl(),
    'enemy/shard_defeat': shardDefeat(),
  };
}

export const ENEMY_PALETTES = { sprout: SPROUT_PAL, zip: ZIP_PAL, shard: SHARD_PAL };
