# Asset Pipelines

<!-- core:start -->
**Rule zero.** Generated art is never hand-edited. Change the generator source, rebuild, review the previews, commit source plus outputs together. Everything is deterministic (fixed seeds) and original (no downloaded models, textures, brushes or reference images).

**Pipelines.**
1. **Hand-authored ASCII-row pixel art** in `packages/art/src` (characters, enemies, mounts, effects, font, tiles, props, objects, backgrounds). Rebuild: `npm run build:art -w @sbh/art` (everything) or `npx tsx packages/art/scripts/run-world.ts` / `run-characters.ts` (one half). Output: PNG sheets plus atlas JSON in `packages/art/assets/`, committed.
2. **Blender headless pipeline** (`tools/blender`): procedural time-of-day backgrounds (dawn/day/sunset/night, 9 layers) and 20 animated props, snapped to palettes and pixelized. Rebuild: `npm run build:blender -w @sbh/art` (about 100 s; needs Blender 5.1 + Python 3.11 with Pillow and numpy). Output: `packages/art/assets/blender/`, committed. Validate: `python tools/blender/check.py` and `npx vitest run packages/art/src/blender`.
3. **Previews** (`*_preview*.png`, `world_preview_scene_*`, `world_objects_scene_*`) are produced by the same builds; they feed the docs gallery and site region viewer.

**Atlas convention.** Sheet `<name>.png` plus `<name>.json` with `frames: { "<group>/<name>_<i>": {x,y,w,h} }`; tilesets add `tileSize: 16` and `tiles`; sprite defs carry `anchor` and `fps`; world backgrounds listed in `world_bg_manifest.json`; Blender backgrounds in `bg_manifest.json` and `manifest.ts`.

**Consumers.** The client imports art directly from `packages/art/assets` through `import.meta.glob`. The site uses a **separate copy** in `apps/site/src/assets` and **there is no re-copy script** (known gap; see below). Always re-sync and verify the site after an art change.

**Verify visually, every time.** Open the regenerated previews at 1x and 3x, check against `docs/ART_NORTH_STAR.md` and `IMAGE_GUIDE.md`, run `npm test`, then load the client with `?region=` / `?tod=`.
<!-- core:end -->

Related: [`IMAGE_GUIDE.md`](IMAGE_GUIDE.md) (style rules), [`ENGINEERING_RUNBOOK.md`](ENGINEERING_RUNBOOK.md), [`REVIEW_CHECKLISTS.md`](REVIEW_CHECKLISTS.md), [`CHARTER`](CHARTER.md), [`PROTOCOL`](PROTOCOL.md), [`WORKSTREAMS`](WORKSTREAMS.md); source docs: [`docs/ART_WORLD.md`](../ART_WORLD.md), [`docs/ART_OBJECTS.md`](../ART_OBJECTS.md), [`docs/ART_DIRECTION.md`](../ART_DIRECTION.md), [`docs/ART_BLENDER_PIPELINE.md`](../ART_BLENDER_PIPELINE.md), [`docs/CHARACTER_CREATOR.md`](../CHARACTER_CREATOR.md), [`docs/research/CHARACTER_BLENDER_TO_2D.md`](../research/CHARACTER_BLENDER_TO_2D.md).

Paths below are relative to the repo root and were verified to exist on 2026-10-04. Commands marked **(not run)** were read, not executed, to avoid modifying outputs.

---

## 1. Overview of what makes what

| Asset | Source of truth | Build command | Committed output |
|---|---|---|---|
| Hero paper-doll layers, sample hero sheets, creator data | `packages/art/src/characters/{parts_body,parts_head,layers,paperdoll,compose,look,palettes,pal,anims,kit,shape,layersheet}.ts` | `npx tsx packages/art/scripts/run-characters.ts` (or `build:art`) | `characters_hero_<0..11>.png/json`, `characters_layers.png/json`, `characters_data.json`, `characters_preview*.png` |
| Enemies | `characters/enemies.ts` | same | `characters_enemies.png/json` |
| Effects (juice) | `characters/fx.ts` | same | `characters_fx.png/json` |
| Mounts (frog, dino, drake, cheetah) | `characters/mounts.ts` | same | `characters_mount_<frog\|dino\|drake\|cheetah>.png/json` |
| Pixel font (5x7) | `characters/font.ts` | same | `characters_font.png/json`, `characters_preview_font.png` |
| Tilesets (3 regions) and autotile | `world/{tiles,tileset,styles,autotile,paint}.ts` | `npx tsx packages/art/scripts/run-world.ts` | `world_tiles_<region>.png/json` |
| Props and decoration | `world/{props,decor}.ts` | same | `world_props_<region>.png/json` |
| Gameplay objects | `world/objects.ts` | same | `world_objects_<region>.png/json`, previews and 6 scenes per region |
| Parallax backgrounds (hand-authored) | `world/backgrounds.ts` | same | `world_bg_<region>_<layer>.png`, `world_bg_manifest.json` |
| Time-of-day backdrops and animated props (Blender) | `tools/blender/**` | `npm run build:blender -w @sbh/art` | `packages/art/assets/blender/{bg_<tod>_<layer>.png, bg_manifest.json, sprites.png/json, preview_*.png}`, `packages/art/src/blender/manifest.ts` |
| Blender-to-2D character experiment (spike only) | `tools/blender-character/**` | `pwsh tools/blender-character/run.ps1` | `packages/art/assets/blender-characters/poc_*.png` (research; not the shipping look) |

`build-art.ts` runs `buildCharacters` then `buildWorld`; `run-world.ts` and `run-characters.ts` are standalone halves. **Dev-only helpers** (write scratch files into `packages/art/assets/`; do not commit their output): `gallery-run.ts` (`_gallery.png`), `zoom.ts` (`_zoom.png`), `quick.ts` (`_quick.png`).

Toolkit: `packages/art/src/core.ts` (bitmap, `fromRows`, `blit`, `recolor`, `packSheet`, palettes), `png.ts` (encoder). No image library dependency.

---

## 2. ASCII-row hand-authored sprites (`packages/art`)

### How a sprite is authored

A sprite is an array of strings (rows). Each character is a palette key; `.` or a null-mapped key is transparent. `fromRows(rows, pal)` produces a bitmap. Hero layers use slot-ramp letters (skin `ABC`, hair `DEF`, top `JKL`/`MNO`, ... `P` = ink, `W` = white) and digit masks `0/1/2` (skin/primary/secondary) that are shaded to the slot ramp at compose time, so one authored shape serves every color choice (see `docs/ART_DIRECTION.md` "System overview").

Rules while authoring:
- 24x32 hero frame, ground row 31, anchor bottom-center; tiles 16x16; keep <=15 colors per layer plus transparent.
- Outline in a hue-matched dark; deepest ink `#2b2350`; flat 3 tones; light top-left.
- No stray pixels (tests flag disconnected pieces), no anti-aliasing, no dithering on characters.

### Rebuild and outputs

```powershell
npm run build:art -w @sbh/art                       # characters + world
npx tsx packages/art/scripts/run-characters.ts      # characters only
npx tsx packages/art/scripts/run-world.ts           # world only (tiles, props, objects, backgrounds, scenes)
```

Expected: `characters built -> ...packages\art\assets`, `world art built -> ...`, `art built -> ...` (for `build-art`). Files change only if the source or the PRNG seed changed; if `git diff --stat packages/art/assets` shows unexpected churn, find out why before committing (non-determinism is a bug).

### Atlas JSON conventions

| Kind | Shape | Notes |
|---|---|---|
| Frame atlas (`characters_*`, `world_props_*`, `world_objects_*`, Blender `sprites.json`) | `{ image, size|w,h, frames: { "<group>/<name>_<i>": { x, y, w, h } }, anims? }` | frame names: `hero/idle_0`, `enemy/sprout_walk_0`, `fx/shard_0`, `obj/spike_1`, `mount_<m>/<anim>_<i>`, `mountr_<m>/...` (saddled). Frames are packed 1 px apart |
| Tileset (`world_tiles_<region>.json`) | `{ id, name, image, atlasFile, tileSize: 16, width, height, colors: 16, tiles: { id: {x,y,w,h} }, anims }` | 16 tiles per row; **ids identical across all regions** |
| Props defs | `props[]` with `anchor`, `fps`, `layer` (`back`/`front`), `solid:false`; `placement:'water'` is decor | see `docs/ART_WORLD.md` |
| Characters data | `characters_data.json` has typed anim tables (`HERO_ANIMS`, ticks at 60 Hz), anchors, options, sample looks | consumed by the client and site |
| Layer sheet | `characters_layers.json` lists every authored layer with local-space offsets (for Pixelorama) | |
| Mounts | `MOUNT_ANIMS`, `MOUNT_ANCHORS` (seat anchor); rider hip pixel `RIDER_HIP` = (12,22) in hero frame space | |
| Object atlas | `OBJECTS[region] = { file, atlas, frames, anims }`, `OBJECT_ANIMS` | accent colors identical across regions |

### Verify visually

1. Open `packages/art/assets/characters_preview.png` (all hero frames x 4 looks on light and dark panels), `characters_preview_looks.png`, `_options.png`, `_creatures.png`, `_mounts.png`, `_riders.png`, `_font.png`.
2. Open `world_preview.png` and `world_preview_scene_<region>_<0..2>.png` (768x672 scenes at 3x).
3. Open `world_objects_preview.png` and `world_objects_scene_<region>_<0..5>.png`.
4. `npm test` (art tests: palette limits, connected pieces, atlas bounds, manifest sanity).
5. Run the client: `npm run dev`, open `http://localhost:5173/?name=Tester&region=meadow&raf=timer`.
6. Judge against `IMAGE_GUIDE.md` section (b).

---

## 3. Tilesets and autotile

- Atlas: fixed grid, 16 tiles per row, 16x16 per tile; 16 colors exactly (4 cover, 4 earth, 3 stone, 2 timber, 3 accent).
- Regions: `meadow` (Sunny Haven Meadows), `meadow_sunset` (same world, palette-graded automatically), `caverns` (Crystal Caverns). **All three share tile ids**, so switching region = swapping the image and background set.
- `autotile(level)` returns `(TileRef|null)[][]` indexed `[row][col]`; rules in `world/autotile.ts` (summary in `docs/ART_WORLD.md`): grass `top0-5`, `top_l/r`, `wall_l/r(+_foot)`, `fill0-6`, `trans`/`deep`, `bot*`, `under_up/dn`, thin floating cells -> timber `plat_*`, 1-wide pillars -> `brick*` with the haven-shard gem, `/` and `\` true 45 degree slopes (cap outline row `16-x` / `1+x`), `B` -> `bounce0`.
- **Important:** `autotile()` treats every non-`.` glyph as ground, so strip `-`, `^`, `D` from the level before autotiling (see `objectsScene` in `packages/art/scripts/build-world.ts`).
- Animated tile: `bounce` (compress 3t, release 5t, settle 3t at 60 Hz).
- Add a tile: add the drawing in `tiles.ts`, make sure it exists with the same id in every region, extend autotile if needed, rebuild, check `world_preview.png` for seams (profiles are pinned at tile borders so variants never seam), run `packages/art/test/world.test.ts`.
- Sunset is an automatic palette grade, not hand-tuned (known weakness). If hand-tuning, do it in `styles.ts`, never in the PNG.

Code integration note (docs/ART_WORLD.md): `packages/art/src/index.ts` re-exports only `./core`; world art is reached through the `@sbh/art/world` subpath export.

---

## 4. Blender headless pipeline

Full detail: [`docs/ART_BLENDER_PIPELINE.md`](../ART_BLENDER_PIPELINE.md). Short form:

```powershell
npm run build:blender -w @sbh/art                  # full rebuild (about 100 s)   (not run)
pwsh tools/blender/build.ps1 -Tods sunset          # one scene; add -SkipSprites to skip props   (not run)
bash tools/blender/run_tod.sh sunset               # dev loop: render + pixelize + preview for one scene   (not run)
python tools/blender/check.py                      # pixel sanity checks
npx vitest run packages/art/src/blender            # TS manifest/file checks
```

Requirements: Blender 5.1 at `C:\Program Files\Blender Foundation\Blender 5.1\blender.exe`, system Python 3.11 with Pillow and numpy at `C:\Program Files\Python311\python.exe`. Override with `-Blender` and `-Python`.

Stages: (1) `scenes/golden_hour.py` renders each layer orthographically at 4x supersampling with emission-only toon materials; (2) `pixelize.py` palette-snaps with per-pixel majority vote, cleans orphans, applies 4x4 Bayer dither only in sky/halo/haze bands, flat haze fade, inner sel-out on hills, hard alpha, crops empty rows; (3) `scenes/sprites.py` + `pack_sprites.py` render props, snap to <=15 colors, add a full hue-matched outline per palette role, share crops, shelf-pack the atlas; (4) `gen_manifest.py` writes `packages/art/src/blender/manifest.ts`; `preview.py` writes previews; `check.py` validates.

Raw 4x renders go to `tools/blender/_work/` (gitignored, along with `__pycache__`). Shipped output: `packages/art/assets/blender/`:
- `bg_<tod>_<layer>.png` for tod in `dawn day sunset night`; layers far to near: `sky` (fixed 256x224), `sun` (256x224), `clouds_a`, `clouds_b`, `mountains`, `lake`, `ridges`, `hills`, `fore`; tileable layers 768 px wide.
- `bg_manifest.json`, `manifest.ts` (`BLENDER_BACKGROUNDS`, `BLENDER_SPRITES`).
- `sprites.png` + `sprites.json`: 20 props, 46 frames (trees, bush, flowers, rock, crystal, windmill 8-frame loop, torch/lantern flicker, waterfall 4, spring 5, sun, moon, clouds, butterfly, birds), each with `anchor` (ground pivot) and `fps`.
- `preview_<tod>.png`, `preview_timeofday.png`, `preview_sprites.png`.

Adding a time of day, layer or sprite: edit the places listed in `docs/ART_BLENDER_PIPELINE.md` ("Adding things"): `TOD` in `palettes.py` plus `TODS` and the TS `BlenderTod` list; `layer_x` + registrations in `golden_hour.py`; `sprite_defs.py` + `b_<name>` in `scenes/sprites.py`. Keep per-layer <=32 colors, per-scene about <=64 (`check.py` fails at 80).

Verify visually: open `preview_day.png`, `preview_sunset.png`, `preview_night.png`, `preview_dawn.png`, `preview_timeofday.png`, `preview_sprites.png`; check seams when scrolling (tileable layers wrap in X), hue-matched outlines on props, no glossy gradients (3D tells), halo/rays acceptable, then `?tod=<tod>` in the client.

Known weaknesses (human artist backlog): lake parallax drifts away from the sun's glitter column; mountains are one or two cones; palm fronds/torch/lantern look 3D; halo has a visible circular edge; sky is not tileable; near hills outline pass is mechanical.

`tools/blender-character/` is a research spike for Blender-to-2D characters. The shipping character look stays **hand-authored layered pixel art** (recommendation E+, adopted as working plan, not yet confirmed by Anthony; see `DECISIONS.md` and `docs/research/CHARACTER_BLENDER_TO_2D.md`). Do not ship Blender-rendered characters without Anthony.

---

## 5. Preview generation

Previews are written by the same builds; never hand-made.

| Preview | Produced by | Used by |
|---|---|---|
| `characters_preview*.png` | `build-characters.ts` via `scripts/preview.ts` `contactSheet` (4x nearest, labelled, light + dark panels) | docs art gallery |
| `world_preview.png`, `world_preview_scene_<region>_<n>.png` | `build-world.ts` (`renderScene` reference compositor, `world/scene.ts`) | docs gallery, **site region viewer** (`world_preview_scene_*` loaded by `apps/site/src/content.ts` `REAL_REGIONS`) |
| `world_objects_preview.png`, `world_objects_scene_<region>_<0..5>.png` | `build-world.ts` (`objectsScene`) | docs gallery, objects review |
| `blender/preview_*.png` | `tools/blender/preview.py` | docs gallery, review |

The docs portal builds an **art gallery** (`apps/site/dist/docs/art.html`) from images found in the repo (`tools/docs-site/build.mjs`); new previews appear automatically after `npm run build:pages` if they are referenced or discovered by its image rules (check the built page).

---

## 6. Site asset sync (KNOWN GAP)

**Facts (verified 2026-10-04):**
- The marketing site loads art through `apps/site/src/assets.ts`, which globs `./assets/*.png` and `./assets/*.json` under `apps/site/src/assets/` (105 files today; comment: "copied from packages/art/assets so the site builds standalone").
- The directory is a **manual, partial copy**: `bg_<tod>_<layer>.png` and `bg_manifest.json` from `packages/art/assets/blender/`; `characters_hero_<0..11>.png` (only `characters_hero_0.json`), `characters_enemies`, `characters_fx`, `characters_mount_*`, `characters_data.json`; `world_bg_*`, `world_bg_manifest.json`, `world_props_*`, `world_tiles_*` and `world_preview_scene_*`.
- It currently matches the sources byte for byte (checked with `cmp`), but **nothing enforces that**: no script, no CI check, no docs. After an art rebuild the site silently keeps old art, so the public face can drift from the game. `apps/site/public/shots/*` and `og.png` are likewise hand-made.
- The client has no such problem: it imports directly from `packages/art/assets/` via `import.meta.glob`.

**Interim manual procedure** (use until a script exists):

```powershell
# from repo root, PowerShell 7. Refresh exactly the files the site already has.
$src = 'packages/art/assets'; $dst = 'apps/site/src/assets'
Get-ChildItem $dst -File | ForEach-Object {
  $a = Join-Path $src $_.Name
  if (-not (Test-Path $a)) { $a = Join-Path "$src/blender" $_.Name }
  if (Test-Path $a) { Copy-Item $a $_.FullName -Force } else { Write-Warning "no source for $($_.Name)" }
}
git status --short apps/site/src/assets
```

Then: `npm run build:pages`, `npm run linkcheck`, open the site (`npm run dev -w @sbh/site`, port 5174), check hero, creator showcase, region viewer, reel, art page; refresh screenshots if the look changed (see `IMAGE_GUIDE.md` (f)). If a new file is needed by the site, add it explicitly (and mention why in the PR).

**Proposed fix (not implemented; owner of `tools/` should do it):** add `tools/sync-site-assets.mjs` and an npm script `sync:site-assets`:
1. Read an explicit allowlist (array of glob patterns) of files the site needs, derived from `apps/site/src/*.ts` usage (`characters_hero_*.png`, `characters_{enemies,fx,data}.*`, `characters_mount_*`, `world_{tiles,props,bg}_*`, `world_bg_manifest.json`, `world_preview_scene_*`, `blender/bg_*.png`, `blender/bg_manifest.json`).
2. Copy from `packages/art/assets/**` to `apps/site/src/assets/`, flattening `blender/`.
3. `--check` mode exits 1 on any byte difference or missing file; wire it into `ci.yml` (`npm run sync:site-assets -- --check`) so drift fails PRs.
4. Better long term: have `apps/site` import from `../../packages/art/assets` via the glob like the client does, deleting the copy (Vite allows files inside the workspace root), then the gap disappears. Trade-off: the site would then bundle files by glob; keep the glob narrow to avoid shipping every preview.

Flag in any PR that touches art: "site assets re-synced: yes/no".

---

## 7. How to verify any asset change end to end

1. Rebuild (section 2 or 4), `git status` shows only expected files.
2. `npm test` and `npm run typecheck`.
3. Open previews (section 2 "Verify visually").
4. Client: `npm run dev`, load `?region=meadow`, `meadow_sunset`, `caverns` and `?tod=dawn|day|sunset|night`; play the co-op room (`SBH_LEVEL=coopRoom`) if objects changed.
5. Sync the site copy (section 6), `npm run build:pages`, `npm run linkcheck`.
6. Public-face check: refresh screenshots/og per `IMAGE_GUIDE.md` if the on-screen look changed.
7. Originality and provenance record per `IMAGE_GUIDE.md` (e).
8. Request review with `REVIEW_CHECKLISTS.md` "Art / asset PR".

## 8. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Rebuild changes many unrelated files | non-deterministic code or changed seed | find the source; fix; do not commit churn |
| Site shows old art | no re-copy | section 6 |
| `missing art asset <name>` thrown in the site | file not in `apps/site/src/assets` | copy it, rebuild |
| `build:blender` fails at Blender step | wrong Blender path or version | pass `-Blender`, install 5.1 (needs Anthony's OK for downloads) |
| `check.py` fails on color counts | palette change exceeds layer/scene limits | reduce colors in `palettes.py`/`pixelize.py` |
| Tiles misalign in a region | tile id mismatch across tilesets | ids must be identical in all three |
| Slope joins look broken | autotile glyph handling (`-`, `^`, `D` not stripped) | strip before `autotile()` |
| Blender run left `tools/blender/_work` huge | expected, gitignored | leave or delete locally |
| Git Bash mangles env path vars | MSYS path conversion | use PowerShell or `MSYS_NO_PATHCONV=1` |
