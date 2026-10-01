# SBH art direction (characters, creatures, mounts, effects, font)

**Top authority: [`ART_NORTH_STAR.md`](ART_NORTH_STAR.md)** (the Super Mario World essence, made original). Everything below serves it; if they ever disagree, the north star wins. World/tiles: see `ART_WORLD.md`.

## Pillars (applied to every sprite)

1. **Bold, chunky, readable first.** Stout humanoids (~2-3 heads), big head/hands/feet, clear 2-3 px eyes. Silhouette must read at 256x224.
2. **Dark, hue-matched, even outline** around every character/creature/prop (sel-out: the darkest tone of the neighbouring ramp on shade edges, the ramp's mid tone on lit top/left edges). Never pure black; the deepest ink is `#2b2350`.
3. **Flat hand-placed 3-tone shading** per material (light / mid / dark), light from top-left. Highlights drift warm (yellow), shadows drift cool (blue-violet); skin shadows stay desaturated so they never turn rash-red.
4. **No noise.** No anti-aliasing, no gradients, no dithering on characters, no stray pixels (tests flag disconnected pieces). One pixel scale everywhere.
5. **Per-layer limit: 15 colors + transparent** (SNES rule). Composited paper-doll frames may exceed this because layers are independent palette-indexed sheets; every authored *layer* and every creature/mount sprite obeys it.
6. **Few frames, strong poses.** Anticipation (crouch), overshoot, squash/stretch on jump/land, lean on run, skid, expressive idle (breathing + blink). Hold timings are in `HERO_ANIMS.ticks` (60 Hz).
7. **Original only.** Signature motif = the **spring coil** (Coil Antenna headwear, Coil Pack, Pogo Shoes, frog/drake crest, bounce star-burst) plus the cyan **Bound Shard** crystal collectible. No resemblance to any existing character, enemy, mount or logo.

## Reference study (principles only; nothing copied)

| Game | KEEP | AVOID |
|---|---|---|
| Super Mario World | Stout readable heroes, confident outline, flat cheerful palette, few frames with strong poses, spin-jump squash illusion | Nothing to copy; all designs stay original |
| Yoshi's Island | Soft friendly creature shapes, expressive faces, chunky feet | Its designs/palette; crayon texture noise |
| Donkey Kong Country | Material variety, hero/ally color contrast, weight in animation | Glossy pre-rendered look, muddy low-contrast sprites |
| Kirby Super Star | Personality in idle, simple round silhouettes, clear expressions | Generic mascot cliches; tiny readable area |
| Mega Man X | Smooth many-frame run, crisp readable hit/hurt states, consistent outlines | Over-busy armor detail |
| Super Metroid | Distinct enemy silhouettes, mood through value | Dark muddy palettes that vanish into backgrounds |
| Earthworm Jim | Extreme squash/stretch, anticipation/overshoot | Inconsistent pixel scale, noisy detail |
| Sonic 1-3 & Knuckles | Instant hero read, run lean, bounce/spring juice | Mixed resolutions, flicker/sprite limits |
| Vectorman | Clear motion arcs | Over-rendered shading |
| Ristar | Characterful reach/stretch poses | Stiff 2-frame walks |
| Rocket Knight | Strong pose clarity, bold color | Dull palettes |
| Celeste | Expressive small faces, readable at tiny size, hair as a motion/readability cue | Dithered characters |
| Shovel Knight | Limited palette discipline, silhouette-first design, tight collision-vs-art relation | Palette cheating across sprites |
| Sonic Mania | Polished many-frame cycles, hit-pause juice | Busy backgrounds behind heroes |
| Owlboy | Rich but clean hand-pixel shading | Too-small readable area |
| Blasphemous | Silhouette clarity, strong value grouping | Grim low-contrast mood (off-brand) |
| Dead Cells | Anticipation/overshoot timing, readable states | Noise from 3D-baked look |
| Cuphead-era animation | Squash/stretch and smear principles, anticipation | Rubber-hose/cartoon copying |

### Rules we actually apply

- Hero stays high-contrast against every world theme: dark outline + saturated outfits; hair/outfit choices avoid near-background colors via the color tables.
- Every creature gets a unique silhouette *and* color identity (Sproutling = plum + leaf, Zipwing = teal + gold stripes, Shardback = slate + magenta crystals; Frog green, Dino terracotta, Drake sky-blue, Cheetah gold + spots).
- Enemies are cute-but-mischievous: angled brows, small fangs, big feet; stompable ones have a flattened defeat frame, the spiked one does not (curl / upside-down frames instead).
- Walk = 6 frames, run = 8 (lean + flight frames), never 2-frame walks.
- Juice kit: dust puff (4), landing ring (3), bounce star-burst (4), sparkle (4), stomp star (3), respawn poof (5), summon poof in/out, spinning shard (6).
- Face: bold 2x3 eyes with a dark lid row / highlight, 1-row mouth, brow row; expressions are states (blink, shut, wince, wide, grit, open, wail, o) applied to any eye/mouth style so every look animates the same.

## System overview

- **Data model (renderer-agnostic):** `look.ts` — `CharacterLook` (option ids + color ids), `CHARACTER_OPTIONS`, `randomLook`, `validateLook`, `sanitizeLook`, `encodeLook/decodeLook` (20-char base64url). Nothing in it depends on how frames are drawn, so a future 3D->2D or other renderer can consume the same looks, `HERO_ANIMS` tables and atlas names.
- **Slots:** palette chars per slot ramp (skin `ABC`, hair `DEF`, hair tint `GHI`, top `JKL`/`MNO`, bottom `QRS`/`TUV`, shoes `XYZ`/`abc`, hat `def`/`ghi`, back `jkl`/`mno`, accessory `pqr`/`stu`, eye `vw`; `P` ink, `W` white). Masks use digits 0/1/2 (skin/primary/secondary) which are shaded to the slot ramp.
- **Compositor:** `paperdoll.ts` — layers: back item, hair-back, far arm, far leg, near leg, torso (bottoms + top + accessories), near arm, head (hat-back, skull, brows, eyes, mouth, hair-front, face accessory, hat). Limbs are painted per pose along a skeleton (sleeves/pants/shoes colored by the look); head-space and torso-space layers are authored once. Joint table per frame via `composeFrameInfo().joints` (head, torso, hands, feet) for future held items.
- **Catalog:** 14 skin tones, 16 hair styles x 16 colors x 4 tint modes (none/dip-dye/streak/underlayer) x 16 tint colors, 8 eye styles x 10 colors, 6 brows, 6 mouths, 12 tops, 8 bottoms, 8 footwear, 14 headwear, 6 back items, 9 accessories, each with primary/secondary colors from a 24-color table.
- **Exports:** `characters_hero_<n>.png/json` (sample looks), `characters_layers.png/json` (every authored layer with local-space offsets for Pixelorama), `characters_enemies`, `characters_fx`, `characters_mount_<frog|dino|drake|cheetah>`, `characters_font`, `characters_data.json` (all typed anim tables, anchors, options, sample looks).
- **Mounts:** `MOUNT_ANIMS` / `MOUNT_ANCHORS`. Bare frames are `mount_<m>/<anim>_<i>`, saddled `mountr_<m>/…`. The rider's hip pixel (`RIDER_HIP` = 12,22 in hero frame space) lands on `anchors[frame].seat`; `rider` hints which hero ride pose to use (`hero/ride_sit`, `ride_lean` for cheetah dash/gallop, `ride_grip` for the drake). There is no wolf mount; the owner confirmed the roster is frog, dinosaur, flying dinosaur and cheetah.

## Previews

`packages/art/assets/characters_preview*.png` — `_looks` (diverse looks), `_options` (every option), `_creatures`, `_mounts`, `_riders`, `_font`, plus `characters_preview.png` (all hero frames x 4 looks, light + dark panels).

## Known weak spots / polish list for a human pixel artist

See the final report section in the task hand-off; short version: hero faces at 1x are still small; hands are simple 3x3 blocks; hero legs are mostly hidden when riding; stomp spin is a horizontal-squash illusion; cheetah and dino legs are procedural limbs and need hand cleanup; eyes on the big mounts are tiny; summon frames are a cheap shrink + puff overlay.
