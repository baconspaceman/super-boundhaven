# SBH world art (tiles, props, parallax)

**Top authority: `docs/ART_NORTH_STAR.md`** (Super Mario World essence, made original). Where anything here conflicts with it, the north star wins. Everything is procedurally/ASCII authored in code, deterministic, 100% original.

Code: `packages/art/src/world/**`. Build: `npx tsx packages/art/scripts/run-world.ts` (also run by `build-art.ts`). Output: `packages/art/assets/world_*`. Preview: `assets/world_preview.png` (+ `world_preview_scene_<region>_<n>.png`).

## Regions
| id | mood | tileset | backgrounds |
|----|------|---------|-------------|
| `meadow` | Sunny Haven Meadows, cheerful day | `world_tiles_meadow.png` | 8 layers |
| `meadow_sunset` | same world, warm time-of-day | `world_tiles_meadow_sunset.png` (palette-graded) | 8 layers |
| `caverns` | Crystal Caverns, glowing violet/cyan | `world_tiles_caverns.png` | 4 layers |

## Client integration
```ts
import { autotile, TILESETS, BACKGROUNDS, TILE_ANIMS, decorate } from '@sbh/art/src/world'; // see note
```
(Note: `packages/art/src/index.ts` only re-exports `./core`; add `export * from './world'` there, or import the path directly.)

1. **Tiles.** Load `TILESETS[region].image` (PNG) – atlas is a fixed grid, 16 tiles per row, 16x16, `TILESETS[region].tiles[id] = {x,y,w,h}` (also in `world_tiles_<region>.json`). `autotile(level)` returns `(TileRef|null)[][]` indexed `[row][col]`; `null` = empty cell. Draw `atlas[ref.id]` at `col*16,row*16`. All three tilesets share identical ids, so switching region = swapping the image.
2. **Animated tile.** `ref.anim === 'bounce'` → `TILE_ANIMS.bounce`: rests on `bounce0`; when a player launches, play `frames` with `holdTicks` (60 Hz: compress 3t, release 5t, settle 3t).
3. **Props.** `decorate(level, region)` → `PropPlacement[] {prop,x,y,layer,phase}` (x,y = world px of the sprite anchor). Sprite frames + defs in `world_props_<region>.png/.json` (`frames` atlas, `props[]` with `anchor`, `fps`, `layer`, `solid:false`). Draw `layer:'back'` before the player, `'front'` after. Animated: frame = `(floor(t*fps)+phase) % frames.length`. Water (`placement:'water'`) is decor only and is drawn over the pit; it is NOT a hazard/collision.
4. **Parallax (authored on a 224 px tall frame; the live view is now 480x270, see `apps/client/src/viewport.ts`: layers move down by `BG_SHIFT` = view height - 224, sky extends upward, the foreground is cut at its transparent gap).** For each layer in `BACKGROUNDS[region]` (already far→near): `offsetX = floor(cameraX * parallax + drift * seconds)`; if `tileX`, draw the PNG repeatedly starting at `-(offsetX mod w)` until 256 px are covered; otherwise draw once at `-offsetX` (only `sun`). Layers with `z:'front'` (foreground leaves/grass, cave fringe) are drawn after the player/tiles. `parallax` runs 0..1 (sky 0 … hills_near 0.55, foreground 1). `drift` is self-scroll in px/s for clouds. A reference compositor lives in `src/world/scene.ts` (`renderScene`).
5. **Picking a set.** `meadow` for overworld/day, `meadow_sunset` for evening variants or time-of-day cycling (same tile ids, swap atlas + bg set), `caverns` for underground. `BgSet`/`RegionId` are the same three strings.

### Manifest shape
`BACKGROUNDS[region] = { name, file, parallax, y, tileX, w, h, drift, z }[]`; `TILESETS[region] = { id, name, image, atlasFile, tileSize, width, height, colors, tiles, anims }`.

## Autotile rules (`autotile.ts`)
'#' cells choose by which sides touch air: grass `top0-5` (flat, variants by col/row hash, never repeating the neighbour), `top_l/r` (rounded grass overhang corners), `wall_l/r` (+`_foot` where a wall meets a floor), `fill0-6` (3 clod layouts dominate, stones/roots/strata sparse), `trans` → `deep` (wavy hand-off to darker earth 3+ rows below the surface), `bot*` (ragged undersides; stalactite teeth in caverns), `under_up/dn` (first row under a slope, carries the cap continuation), thin 1-tall floating cells → timber `plat_l/m/r/s`, 1-wide pillars → `brick*`/`brick_cap` with the "haven shard" gem. '/' `slope_up`, '\' `slope_dn` (true 1px/column 45°, cap outline row is `16-x`/`1+x`, joins flat tops at row 1). 'B' → `bounce0`; the grass cap still shows beneath a pad. Level bottom edge counts as solid ground; left/right edges as walls (per `tileAt`).

## Palettes / direction summary
Tilesets use exactly 16 colors (slots: 4 cover, 4 earth, 3 stone, 2 timber, 3 accent). Hue-shifted ramps: lights warm yellow, shadows teal/purple; dark hue-matched outline on all terrain and props; top-left light. Terrain = flat 2–3 tone blocks with a bright grass lip. Dithering is used only for sky-band seams (and cave-deep band seams); everything else is hard-banded. Signature motifs (original): spring/coil bounce pad, "haven shard" gem inlay in stone pillars, floating shard islet landmark in the distant sky, magenta/cyan crystals in the caverns.

## Reference study (principles only — nothing copied)
| Game(s) | KEEP | AVOID |
|---|---|---|
| Super Mario World | bold saturated flat 16x16 tiles, bright grass lip, clean slope joins, one mood per world, friendly low-contrast hills/clouds | copying its tiles/hills-with-eyes/blocks/pipes |
| Yoshi's Island, Kirby Super Star | soft chunky shapes, cheerful pastel skies, layered clouds | crayon texture that muddies readability |
| Donkey Kong Country, Chrono-style | atmospheric depth layers, lighting/glow accents, distant landmarks | glossy pre-render look, muddy gradients |
| Super Metroid, Mega Man X | strong zone identity, readable silhouettes of hazards | dull/grim palettes |
| Sonic 1-3/&K, Vectorman, Ristar, Rocket Knight | zone identity per region, animated/palette-cycled water, strong colour keys | busy checker backgrounds competing with play |
| Celeste, Shovel Knight, Sonic Mania | restrained palettes, handcrafted variety, non-repeating ground | inconsistent pixel scale |
| Owlboy, Blasphemous, Dead Cells, Hyper Light Drifter | silhouette framing, glow accents, 5–7 parallax layers | over-detailed noise, too-high background contrast |

Rules applied: (1) gameplay layer has darkest outlines + brightest saturated lips; backgrounds keep a compressed value range and sit cooler/hazier. (2) props use hue-matched dark outlines and are `solid:false`; nothing decorative imitates a collidable tile (thin vines, soft foliage). (3) flat hard bands, no noise; dither only in sky. (4) every profile is pinned at tile borders so variants never seam; ground uses 7 fill layouts + 6 top variants with neighbour-repeat avoidance. (5) one pixel scale everywhere. (6) animated water (4-frame scrolling crest, loops seamlessly), swaying flowers/grass/vines, drifting clouds, pulsing cave lamps/crystals, drips.

## Known weaknesses (for a human artist)
- Dirt/rock fill is clean but generic; no hand-drawn strata story. Mid-hill fields (diagonal crop patches) and mountain facets are still quite flat.
- Props are mostly procedural shapes; tiny flowers/tufts lack character. Waterfall/mossy log/bridge pieces aren't placed by `decorate()` in the playground.
- Sunset tileset/props are an automatic palette grade, not hand-tuned; caverns backgrounds are fairly dark/uniform.
- Slope caps are thinner than flat caps; no slope-specific decoration. Pit water is decor only.
- Foreground silhouettes are sparse by design; may want per-level tuning.
