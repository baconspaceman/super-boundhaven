# Blender -> 2D pixel art pipeline ("Golden Hour Meadows")

Everything under `tools/blender/` is 100% original and procedural: geometry is generated from code with fixed seeds,
shading is flat/toon math on surface normals, colors come from hand-picked palettes in `palettes.py` / `sprite_defs.py`.
**No downloaded models, textures, HDRIs, brushes or reference images are used.** Design principles were studied from the
16-bit era and modern pixel platformers; nothing is copied. Judged against `docs/ART_NORTH_STAR.md`: flat 2-3 tone blocks,
cheerful palettes, dithering only in sky/halo/haze bands, dark hue-matched outlines on props, compressed contrast.

## Run it

```powershell
npm run build:blender -w @sbh/art          # full rebuild (~100 s on the dev box)
pwsh tools/blender/build.ps1 -Tods sunset  # one scene; add -SkipSprites to skip props
bash tools/blender/run_tod.sh sunset       # dev loop: render + pixelize + preview for one scene
python tools/blender/check.py              # pixel sanity checks (also run by build.ps1)
npx vitest run packages/art/src/blender    # TS manifest/file checks
```
Needs Blender 5.1 (headless, EEVEE) and system Python 3.11 with Pillow + numpy. Raw 4x renders go to
`tools/blender/_work/` (gitignored); shipped output is `packages/art/assets/blender/` (committed).

## Stages

1. `scenes/golden_hour.py` (bpy) - one orthographic camera (1 world unit = 1 native px, 4x supersampled), one render
   per layer, transparent film, emission-only toon materials (view transform Standard => renders contain the palette
   colors exactly). Tileable layers are periodic in X (noise/bumps wrap; edge objects duplicated at +-768).
2. `pixelize.py` - palette snap + per-pixel **majority vote** (not area averaging), orphan/notch cleanup (wraps in X),
   sky/halo via ramp-projection + 4x4 Bayer dither with a narrow zone, flat 25/50% haze fade, inner sel-out on the
   hills layer, hard alpha, empty-row crop (y recorded in the manifest).
3. `scenes/sprites.py` + `pack_sprites.py` - props rendered per frame, snapped to <=15 colors, full hue-matched
   outline (each palette role has its own dark `line` color), shared crop per animation, shelf-packed atlas.
4. `gen_manifest.py` writes `packages/art/src/blender/manifest.ts`; `preview.py` writes previews; `check.py` validates.

## Output (`packages/art/assets/blender/`)

- `bg_<tod>_<layer>.png` for tod in dawn/day/sunset/night and layers far->near: `sky`(fixed, 256x224), `sun`(256x224,
  sun/moon + flat rays + dither halo), `clouds_a`, `clouds_b`, `mountains`(+volcano smoke/castle), `lake`(glitter column,
  sail boats), `ridges`(3 ridge bands + pines), `hills`(round/pine/palm trees, bushes, village, windmill, fireflies),
  `fore`(grass tufts, fronds, flowers). Tileable layers are 768 wide, cropped vertically; draw at `y` with `parallax`.
- `bg_manifest.json` / `manifest.ts` (`BLENDER_BACKGROUNDS`, `BLENDER_SPRITES`). Paths are relative to `assets/blender/`.
- `sprites.png` + `sprites.json`: 20 props / 46 frames - 3 trees, bush, 2 flowers, rock, crystal, windmill (8-frame blade
  loop), torch and lantern flicker (4), waterfall (4, seamless scroll), spring compress/release (5), sun, moon,
  3 clouds, butterfly (4), bird flock (4). Each sprite has `anchor` (ground pivot) and `fps`.
- `preview_<tod>.png` (256x224 window at 3x + mock meadow ground/platform), `preview_timeofday.png`, `preview_sprites.png`.

## Adding things

- **New time of day / palette tweak:** edit `TOD[...]` in `palettes.py` (sky ramp+stops, cloud ramp, rock/snow, ...). Add
  the name to `TODS` and the TS `BlenderTod` generator list. Keep per-layer <=32 and per-scene ~<=64 colors (check.py).
- **New layer:** add a `layer_x(T, tod)` in `golden_hour.py`, register in `BUILD`, `LAYERS`, `PARALLAX`, `LAYER_W`, and a
  branch in `layer_palette`. Use `C.toon` (banded lighting), `C.solid`, `C.height_bands`, `C.sky_gradient`, `C.radial_alpha`.
- **New sprite:** add roles/entry to `sprite_defs.py` and a `b_<name>(sp, frame, n)` builder in `scenes/sprites.py`.
- Seeds live next to each builder (`C.rng(<int>)`); output is deterministic.

## Known limits (for a human pixel artist)

- Lake parallax (0.22) differs from the sun's (0.02), so the glitter column drifts away from the sun when scrolling.
- Mountains are one or two dominant cones; the volcano crater is not modelled, only the highest peak. Needs hand variety.
- Sprites are 3D tells-reduced but still smooth-shaded geometry; palm fronds, torch flame and lantern are the weakest.
- Halo is a dithered disc (visible circular edge); sun rays are chunky wedges - placeholder-grade "sunburst".
- Near hills' outline pass is mechanical; trees would benefit from hand-placed highlight clusters.
- Sky is not tileable (sun glow baked in) - it is a fixed 256x224 frame.
