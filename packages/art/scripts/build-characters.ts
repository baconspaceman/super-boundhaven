// Builds every character-side asset: hero sheets (sample looks), paper-doll layer sheet, enemies, FX/pickups,
// four mounts (+ rider composites for preview), pixel font, atlases, typed-data JSON and contact sheets.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { blit, createBitmap, packSheet, type Bitmap } from '../src/core';
import { encodePNG } from '../src/png';
import { HERO_ANIMS, HERO_FRAME_NAMES, RIDER_HIP } from '../src/characters/anims';
import { composeFrame, composeNamedFrame, composeSheet } from '../src/characters/paperdoll';
import { CHARACTER_OPTIONS, DEFAULT_LOOK, encodeLook, randomLook, type CharacterLook } from '../src/characters/look';
import { buildEnemyFrames, ENEMY_ANIMS } from '../src/characters/enemies';
import { buildFxFrames, FX_ANIMS } from '../src/characters/fx';
import { buildAllMountFrames, MOUNT_ANCHORS, MOUNT_ANIMS, MOUNT_NAMES } from '../src/characters/mounts';
import { buildLayerSheet } from '../src/characters/layersheet';
import { drawText, FONT_5X7 } from '../src/characters/font';
import { fillRect } from '../src/characters/compose';
import { contactSheet, type PreviewGroup } from './preview';
import { optionGroups } from './gallery';

/** Hand-picked diverse looks for previews/exports (index 0 is the default). */
export const SAMPLE_LOOKS: { name: string; look: CharacterLook }[] = [
  { name: 'default', look: DEFAULT_LOOK },
  { name: 'wizard', look: { ...DEFAULT_LOOK, skin: 9, hair: 4, hairColor: 7, hairTint: 1, hairTintColor: 12, hat: 4, hatC1: 11, hatC2: 3, top: 6, topC1: 12, topC2: 3, bottom: 5, botC1: 11, botC2: 3, shoes: 1, shoeC1: 17, shoeC2: 18, back: 2, backC1: 11, backC2: 3, eyes: 5, eyeColor: 0 } },
  { name: 'adventurer', look: { ...DEFAULT_LOOK, skin: 6, hair: 5, hairColor: 1, hat: 3, hatC1: 18, hatC2: 17, top: 4, topC1: 5, topC2: 19, bottom: 3, botC1: 17, botC2: 18, shoes: 1, shoeC1: 17, shoeC2: 18, back: 3, backC1: 16, backC2: 18, acc: 6, accC1: 0, accC2: 3, eyes: 2, eyeColor: 1, mouth: 3 } },
  { name: 'punk', look: { ...DEFAULT_LOOK, skin: 1, hair: 8, hairColor: 13, hairTint: 2, hairTintColor: 9, top: 2, topC1: 22, topC2: 0, bottom: 4, botC1: 23, botC2: 0, shoes: 4, shoeC1: 0, shoeC2: 20, acc: 2, accC1: 23, accC2: 0, brows: 2, mouth: 5 } },
  { name: 'sprite', look: { ...DEFAULT_LOOK, skin: 11, hair: 15, hairColor: 11, hairTint: 3, hairTintColor: 4, hat: 13, hatC1: 5, hatC2: 14, top: 10, topC1: 7, topC2: 14, bottom: 6, botC1: 5, botC2: 7, shoes: 5, back: 4, backC1: 20, backC2: 7, eyes: 4, eyeColor: 3 } },
  { name: 'knight', look: { ...DEFAULT_LOOK, skin: 4, hair: 1, hairColor: 8, hat: 11, hatC1: 21, hatC2: 3, top: 9, topC1: 21, topC2: 3, bottom: 0, botC1: 22, botC2: 21, shoes: 1, shoeC1: 22, shoeC2: 21, back: 1, backC1: 0, backC2: 3, eyes: 6, eyeColor: 9 } },
  { name: 'pilot', look: { ...DEFAULT_LOOK, skin: 7, hair: 10, hairColor: 2, hat: 10, hatC1: 18, hatC2: 9, top: 5, topC1: 10, topC2: 19, bottom: 3, botC1: 18, botC2: 17, shoes: 7, shoeC1: 0, shoeC2: 3, acc: 4, back: 6, backC1: 3, backC2: 18 } },
  { name: 'chef', look: { ...DEFAULT_LOOK, skin: 3, hair: 12, hairColor: 6, top: 8, topC1: 20, topC2: 10, bottom: 7, botC1: 10, botC2: 20, shoes: 2, acc: 7, accC1: 0, accC2: 3, eyes: 7, eyeColor: 4, brows: 3, mouth: 4 } },
  ...[5, 17, 33, 71].map((s) => ({ name: `rand${s}`, look: randomLook(s) })),
];

function atlasJson(image: string, sheet: Bitmap, atlas: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  return JSON.stringify({ image, size: { w: sheet.w, h: sheet.h }, frames: atlas, ...extra }, null, 1);
}

function saveSheet(outDir: string, base: string, frames: Record<string, Bitmap>, maxW: number, extra: Record<string, unknown> = {}) {
  const { sheet, atlas } = packSheet(frames, maxW, 1);
  writeFileSync(join(outDir, `${base}.png`), encodePNG(sheet));
  writeFileSync(join(outDir, `${base}.json`), atlasJson(`${base}.png`, sheet, atlas, extra));
  return { sheet, atlas };
}

/** hero frame composited riding a mount frame (hero hip on the seat anchor). */
function rideComposite(look: CharacterLook, mountName: string, mountFrame: string, heroFrame: string): Bitmap {
  const mb = frameCache.get(mountFrame)!;
  const anchor = MOUNT_ANCHORS[mountFrame];
  const hero = composeNamedFrame(look, heroFrame).bitmap;
  const ox = anchor.seat[0] - RIDER_HIP[0];
  const oy = anchor.seat[1] - RIDER_HIP[1];
  const minX = Math.min(0, ox);
  const minY = Math.min(0, oy);
  const w = Math.max(mb.w, ox + hero.w) - minX;
  const h = Math.max(mb.h, oy + hero.h) - minY;
  const out = createBitmap(w, h);
  void mountName;
  // mount body first, hero over the saddle; front legs of mount are not re-drawn (acceptable for preview)
  blit(out, mb, -minX, -minY);
  blit(out, hero, ox - minX, oy - minY);
  return out;
}
const frameCache = new Map<string, Bitmap>();

export async function buildCharacters(outDir: string): Promise<void> {
  // ---- hero sheets ----
  const heroIndex: Record<string, string> = {};
  SAMPLE_LOOKS.forEach((s, i) => {
    const { sheet, atlas } = composeSheet(s.look);
    writeFileSync(join(outDir, `characters_hero_${i}.png`), encodePNG(sheet));
    writeFileSync(join(outDir, `characters_hero_${i}.json`), atlasJson(`characters_hero_${i}.png`, sheet, atlas, { look: s.look, code: encodeLook(s.look), name: s.name, frameSize: { w: 24, h: 32 }, anchor: 'bottom-center', facing: 'right' }));
    heroIndex[String(i)] = s.name;
  });

  // ---- layers ----
  const ls = buildLayerSheet();
  writeFileSync(join(outDir, 'characters_layers.png'), encodePNG(ls.sheet));
  writeFileSync(join(outDir, 'characters_layers.json'), atlasJson('characters_layers.png', ls.sheet, ls.atlas));

  // ---- enemies / fx ----
  const enemies = buildEnemyFrames();
  saveSheet(outDir, 'characters_enemies', enemies, 160, { anims: ENEMY_ANIMS, facing: 'left' });
  const fx = buildFxFrames();
  saveSheet(outDir, 'characters_fx', fx, 200, { anims: FX_ANIMS });

  // ---- mounts ----
  const mounts = buildAllMountFrames();
  for (const m of MOUNT_NAMES) {
    for (const [k, b] of Object.entries(mounts[m])) frameCache.set(k, b);
    saveSheet(outDir, `characters_mount_${m}`, mounts[m], 280, {
      anims: MOUNT_ANIMS[m],
      anchors: Object.fromEntries(Object.entries(MOUNT_ANCHORS).filter(([k]) => k.includes(`_${m}/`))),
      riderHip: RIDER_HIP,
      facing: 'right',
      note: 'mount_<m>/ = bare, mountr_<m>/ = saddled. Place hero frame so its riderHip lands on anchors[frame].seat.',
    });
  }

  // ---- font sheet ----
  const fontFrames: Record<string, Bitmap> = {};
  for (const ch of Object.keys(FONT_5X7.glyphs)) fontFrames[`glyph/${ch.codePointAt(0)!.toString(16)}`] = drawText(ch, FONT_5X7, { outline: null });
  saveSheet(outDir, 'characters_font', fontFrames, 160, { font: { height: FONT_5X7.height, baseline: FONT_5X7.baseline, spaceW: FONT_5X7.spaceW } });

  // ---- typed data ----
  writeFileSync(
    join(outDir, 'characters_data.json'),
    JSON.stringify({ HERO_ANIMS, ENEMY_ANIMS, FX_ANIMS, MOUNT_ANIMS, MOUNT_ANCHORS, CHARACTER_OPTIONS, sampleLooks: SAMPLE_LOOKS.map((s) => ({ name: s.name, code: encodeLook(s.look), look: s.look })) }, null, 1),
  );

  // ---- previews ----
  const heroGroups: PreviewGroup[] = SAMPLE_LOOKS.slice(0, 4).map((s) => ({ title: `look: ${s.name}`, frames: HERO_FRAME_NAMES.map((f) => [f, composeNamedFrame(s.look, f).bitmap] as [string, Bitmap]) }));
  writeFileSync(join(outDir, 'characters_preview.png'), encodePNG(contactSheet(heroGroups, 4, 14)));

  // diverse looks idle/run/jump side by side
  const crowd: PreviewGroup[] = [
    { title: 'diverse looks (idle_0 / run_1 / jump_apex)', frames: SAMPLE_LOOKS.flatMap((s) => ['hero/idle_0', 'hero/run_1', 'hero/jump_apex'].map((f) => [`${s.name}`, composeNamedFrame(s.look, f).bitmap] as [string, Bitmap])) },
  ];
  writeFileSync(join(outDir, 'characters_preview_looks.png'), encodePNG(contactSheet(crowd, 4, 18)));
  writeFileSync(join(outDir, 'characters_preview_options.png'), encodePNG(contactSheet(optionGroups('hero/idle_0'), 3, 16)));

  const creaturesGroups: PreviewGroup[] = [
    { title: 'enemies (face left)', frames: Object.entries(enemies) },
    { title: 'pickups + effects', frames: Object.entries(fx) },
  ];
  writeFileSync(join(outDir, 'characters_preview_creatures.png'), encodePNG(contactSheet(creaturesGroups, 4, 14)));

  const mountGroups: PreviewGroup[] = MOUNT_NAMES.map((m) => ({ title: `mount ${m}`, frames: Object.entries(mounts[m]).filter(([k]) => k.startsWith('mount_')) }));
  writeFileSync(join(outDir, 'characters_preview_mounts.png'), encodePNG(contactSheet(mountGroups, 3, 12)));

  const riderGroups: PreviewGroup[] = MOUNT_NAMES.map((m, i) => {
    const pick = m === 'cheetah' ? ['mountr_cheetah/idle_0', 'mountr_cheetah/gallop_0', 'mountr_cheetah/gallop_3', 'mountr_cheetah/dash_0'] : m === 'drake' ? ['mountr_drake/idle_0', 'mountr_drake/flap_0', 'mountr_drake/flap_2', 'mountr_drake/glide_0'] : m === 'frog' ? ['mountr_frog/idle_0', 'mountr_frog/hop_1', 'mountr_frog/tongue_1', 'mountr_frog/land_0'] : ['mountr_dino/idle_0', 'mountr_dino/trot_1', 'mountr_dino/charge_1', 'mountr_dino/jump_0'];
    const look = SAMPLE_LOOKS[(i + 1) % 4 + 1].look;
    const rp = m === 'cheetah' ? 'hero/ride_lean' : m === 'drake' ? 'hero/ride_grip' : 'hero/ride_sit';
    return { title: `riders on ${m}`, frames: pick.map((f) => [f, rideComposite(look, m, f, rp)] as [string, Bitmap]) };
  });
  writeFileSync(join(outDir, 'characters_preview_riders.png'), encodePNG(contactSheet(riderGroups, 4, 8)));

  const sample = createBitmap(260, 70);
  fillRect(sample, 0, 0, 260, 70, '#3a3070');
  let y = 4;
  for (const t of ['SUPER BOUNDHAVEN 0123456789', 'The quick brown fox jumps over', 'the lazy dog! (Player_1) 100% #win', 'Shard x25  HP: 3/5  Time: 88']) {
    blit(sample, drawText(t, FONT_5X7), 4, y);
    y += 11;
  }
  writeFileSync(join(outDir, 'characters_preview_font.png'), encodePNG(sample));
  void composeFrame;
  void heroIndex;
}
