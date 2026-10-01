# Blender-to-2D characters for SBH: research, spike, decision

Status: draft for owner decision. Author: research agent. Date: 2026-09-30. Judged first against `docs/ART_NORTH_STAR.md` (SMW essence, original designs).

## 1. Executive summary and recommendation

**Recommendation: method E (hand-authored layered pixel art) stays the shipping look and the character-creator basis. Blender is adopted only as a *motion and fit tool* (hybrid E+), not as the renderer of final sprites.**

Why, in one paragraph. A side-on orthographic 3D model genuinely hides its 3D-ness, and the technique works (Dead Cells, Donkey Kong Country, Diablo II). But every shipped example I could verify gets its benefit from *volume of animation* (many weapons, many revisions, big sprites) and pays for it in pixel-level touch-up. SBH wants the opposite: few frames, strongly posed, on a tiny 24x32 canvas, flat 2-3 tones, dark outlines, expressive faces. I built the spike and measured it: Blender output is palette-lockable, layer-alignable and recolorable, but at 24x32 it reads as "busy and thin" next to the hand-authored hero (see section 9), has profile-only faces, and needs manual cleanup on every frame, which defeats the main reason to use 3D (regeneration).

What Blender *is* worth using for (cheap, low risk):
1. **Pose/motion reference**: key a run, skid, stomp-bounce once, render 24x32 silhouettes + pose ghosts, and have pixel authors (human or ASCII-row scripts) pose to them. Retiming is free.
2. **Per-frame fit guides**: for each animation frame, render a body-part occupancy mask (head, torso, near/far limbs, hand anchor) so every equipment layer is authored against the same silhouettes. This removes the main cost of method E (alignment of N equipment pieces x M frames).
3. **Optional later**: if SBH adds many weapon-attack animations (Dead Cells territory), promote the spike pipeline to a base-motion generator with hand cleanup, and re-evaluate.

If the owner wants fully automatic rendered characters anyway, the best variant is **D-lite**: layered renders + depth/slot passes, baked to one sheet per look at look-change time (section 5, 8). It is buildable (the spike is 2/3 of it), but expect a visible quality and style gap versus the hand hero.

## 2. What the technique is, and why the side-only camera helps

Model a low-poly character, rig it, animate, render with an orthographic camera at a tiny resolution without anti-aliasing, flat/toon shade, quantize to a palette, outline, export a sprite sheet. Because SBH only ever shows left/right (mirror for facing), there is exactly one camera angle, so: no 8-direction cost, perfect frame alignment between layers, trivial foot anchoring, and "3D" is never visible as parallax. Caveat discovered in the spike: a strict 90-degree side view gives a *profile* face (one eye, one pixel of expression), whereas the hand hero shows a front/three-quarter face, which is much of its charm. A yawed camera (about 20-30 degrees) is a known trade-off to test; it reintroduces the "3D look" risk.

## 3. Survey of real-world practice (sources in section 12)

| Practice | What was verified | Lesson for SBH |
|---|---|---|
| Dead Cells (Motion Twin) | Artist wrote in his own words: simple 3ds Max model + FBX skeleton, in-house renderer at tiny size with no smoothing, cel shading, keyframes first then in-betweens, attacks as poses plus VFX. Biggest win: timing changes in minutes instead of redrawing. Unsolved: flickering pixels, fixed by hand; he admits "poor quality of the parts" was accepted because movement mattered most. | Match: stepped keys, few frames. Mismatch: SBH values a clean final look more than revision speed. Pixel flicker is real and needs manual cleanup. |
| Donkey Kong Country / Killer Instinct | Rare used SGI workstations with Alias to render 3D to sprites; DKC used a compression scheme (ACM) to fit many rendered frames. Killer Instinct characters were pre-rendered CG. | The glossy pre-rendered look is exactly what the north star forbids. Take the workflow idea (model once, render many frames), not the shading. |
| Vectorman | Polygon models turned into sprites; built from 23 separate sprites moved in unison. | Segmenting a character into sprite pieces is an old, viable runtime technique. |
| Diablo II | Only weak sources (forum snippets; page returned 403): pre-rendered 3D sprites split into layers (body parts, armour, weapon) composited at run time, with limited movesets/armour classes and palette swaps. | Layered pre-rendered paper-doll at scale is precedented, and relies on *restricting* the combination space. Treat as plausible, not proven. |
| Terraria | Weak sources: player parts on separate layers with ordered draw (e.g. ear back/front around hair). | The hair-back/hair-front split is the standard answer to occlusion between layers. |
| Pixel-art community practice | Sources agree: downscale + quantize is a *first draft*; hand-clean silhouette, stray pixels, outline and shading; rotoscopers trace every 3rd frame for a low frame rate. | Expect a cleanup stage. Budget for it. |

No additional *shipped* games are asserted here beyond those with sources above.

## 4. Blender technique findings

Verified by sources plus the spike (Blender 5.1.1 headless):

- **Camera**: orthographic, locked, fixed framing so frames share pixel anchors. Spike: 24x32 frame, 0.05 units/px, ground on row 30, no root motion (in-place cycles).
- **Resolution**: two options. (a) render natively at 24x32 with pixel-centre sampling ("center"); (b) render 4x and downsample by majority slot/mean normal ("mode"). Spike: "mode" gave fewer edge artefacts; "center" drops thin limbs (2px arms flicker). Use (b), or (a) with a jitter-free camera snapped to the pixel grid.
- **Anti-aliasing off**: EEVEE `filter_size=0`, 1 TAA sample, `Raw` view transform so data passes are exact (worked).
- **Pixelate methods**: compositor Scale-down + Pixelate + Scale-up (artisticrender tutorial) or script downscale. Scripted is better because the same data must drive palette indexing.
- **Toon shading**: Shader-to-RGB + constant colour ramp gives hard bands in Blender (multiple sources). Alternative used in the spike (and preferred): render *flat data passes* (world normal, depth, slot ID) and band in numpy against one shared light vector. Benefit: banding thresholds and light direction are tunable without re-rendering; palette indices come straight from slot+band.
- **Lighting consistency for a side-scroller**: one fixed light (upper-left-front) baked into the band function; never per-scene lights. Ambient occlusion/cast shadows between layers are NOT computed in the layered method (see 6).
- **Outlines**: Freestyle (contours, slow, awkward with transparent pass), inverted hull (silhouette only, doubles mesh), compositor edge detect on depth/normal/ID. Spike used *post-process on the 24x32 indexed image*: outer 1px silhouette plus an inner line on the far pixel where a near limb layer is closer by a depth gap. Reason: pixel-perfect 1px lines at this scale are simpler to draw in index space than to render.
- **Palette/indexing**: slot + band -> global index (15 colours used, index 0 transparent). Recolor is a 16-entry LUT swap.
- **Cleanup**: orphan pixel removal, 1px hole fill, band-noise majority filter (implemented). Cluster smoothing beyond this is hand work.
- **Pixel crawl/shimmer**: between frames, thin parts (arms, tuft) flip pixels. Mitigate with thicker limbs (2-3px), snapping camera to pixel grid, `mode` downscale, per-frame hand fix. Not fully solved (Dead Cells' own report agrees).
- **Anchoring**: fixed camera + in-place animation = feet locked by construction; vertical bob is deliberate hips motion.
- **Game feel**: stepped (constant) interpolation keys; exaggerated poses (lean 14 degrees in run); squash/stretch is easier to *overlay in the sprite renderer* (scale tween) than to rig. Shape keys/stretchy rigs are possible but not needed at 24x32.
- **Avoiding "3D look"**: flat bands, thick limbs, outlines, hand touch-up; do not let specular/AO in.

## 5. Rigging and animation sourcing

- **Custom tiny rig** (spike): 18 bones, rigid parts weighted 100% to one bone via vertex groups + Armature modifier (robust headless). Run = 6 frames, idle = 4 frames, keys set CONSTANT interpolation.
- **Rigify**: heavy for a 3-head chibi; not needed. Reconsider if humanoid variety (tall/short) must share animation.
- **Mixamo**: Adobe FAQ (last updated 2021-09-14) states characters and animations are royalty free for personal, commercial and non-profit projects including video games; Adobe community answers add that raw files may not be redistributed/sold as assets. Rendering to sprites does not redistribute raw files, so it is likely permitted, but the FAQ is old and I found no full Terms text; realistic mocap also fights the stout, few-frame SMW posing. **Recommendation: do not use Mixamo for shipped cycles**; hand-key everything (also keeps the originality story clean).
- **Frame-count conventions** for this feel (proposal, matches hand hero and Dead Cells' "few keys"): idle 4 (slow), walk 6, run 8 (hero has 8), jump anticipation 1, rise 1, apex 1, fall 1, land 2, skid 1, stomp-bounce 4, hurt 2. Timings at 60 Hz sim: 6-8 render ticks per frame for walk/run, variable for run speed.
- **Headless export**: `blender --background --factory-startup --python ...` produced 220 renders in 27 s (see 9). Image sequences as PNG data passes.

## 6. Character creator strategies (the core question)

Definitions: **A** render every combination; **B** render each slot as a separate layer from the same camera/animation, composite at runtime; **C** render ID/mask passes and recolor by palette index or shader; **D** hybrid B+C (layers *and* indexed recolor); **E** hand-authored layered pixel art (current ASCII-row paper-doll); **E+** = E with Blender producing motion/fit guides.

How real projects handle layered rendered sprites (weakly sourced, see section 3): split into head/torso/arms/legs/weapon layers, restrict movesets and armour classes, palette-swap for variety. Shading coherence is handled by (a) one shared light, (b) baking inter-layer occlusion only where it matters, (c) front/back splits of hair and capes, (d) limb near/far splits.

Spike findings that bear on B/C/D:

- **Alignment**: layers render from the same camera so pixel alignment is exact by construction. Composite-by-depth vs a single all-in-one render differed by only 4-9 of ~264 pixels per frame, caused by 8-bit depth ties (fix: 16-bit/float depth).
- **Fixed draw order is NOT enough**: even after splitting near/far limbs into their own layers (10 layers total), a plain draw-order composite differed from the depth truth by 30-37 px per frame (about 13%). Arms crossing the torso, hands, capes need either per-pixel depth in each layer (extra channel and shader/CPU cost) or more, finer layers with frame-specific order tables.
- **Inter-layer shading**: each layer is lit alone, so there are no cast shadows of outfit on body; hair-front on face; cape on back. Acceptable in flat 2-3 tone art (SMW has none), but mismatches show at layer edges.
- **Outlines**: per-layer outlines gave messy internal black fragments at 7px-wide torsos; outlining once on the composite looked far better. That forces the **bake-per-look** design (composite + recolor + outline at look-change time), not live layer stacking.
- **Recolor**: 15-colour index palette; swapping skin/hair/primary/secondary/accent produced clean, distinct looks (poc_composited_4x.png rows B and C). Worked well. Risk: recoloring to low-contrast combinations; limit hue ramps with the existing `ramp3` helpers.
- **Per-layer colour budget**: max 5 colours/layer; 14 colours total on the default look.

Scoring (1 bad - 5 good). "SMW essence" is the new top criterion.

| Criterion | A all combos | B layers (RGBA) | C ID masks | D layers+index | E hand layers | E+ hand + Blender guides |
|---|---|---|---|---|---|---|
| SMW-essence readability (faces, chunk, clean clusters) | 2 | 2 | 2 | 2 | **5** | **5** |
| Pixel alignment of layers | 5 | 5 | 4 | 5 | 3 (by hand) | 4 (guides) |
| Recolorability | 1 | 2 | 4 | 4 | 4 (already indexed) | 4 |
| Production cost (per new item) | 1 | 3 | 3 | 3 | 2 (per item x frames) | 3 |
| Runtime memory/perf in PixiJS, many players | 1 (explosion) | 3 | 4 | 4 | 4 | 4 |
| Iteration speed on animation changes | 3 | 4 | 4 | 4 | 2 | **4** (retime in Blender, repose) |
| Originality/licensing clarity | 4 | 4 | 4 | 4 | 5 | 5 |
| **Pick?** | no | no | partial | fallback | **yes** | **yes** |

Memory at MMO scale (estimates, not measured in a browser): one look = 34 hero frames x 24x32 = 26k px = about 104 KB RGBA (about 26 KB as 8-bit index). 200 distinct visible players = about 20 MB RGBA, well inside budget; dedupe by look hash and LRU-cap at 256 looks. Option A is impossible: slots (body x hair x outfit x headwear x back x accessory) multiply, each x 34 frames.

## 7. Proposed SBH pipeline (E+ primary, D-lite documented fallback)

### 7.1 Frame, scale and proportions
- Native frame 24x32, 1px margin below feet (feet on row 30), matching `HERO_W/HERO_H` in `packages/art/src/characters/hero.ts`.
- Sim hitbox 12x16 px: centered horizontally, bottom-aligned on the ground row; sprite extends above (hair/tuft) and to the sides (arms/legs in pose). The hitbox is the truth; art never changes it.
- 2-3 heads tall; head about 12-13 px; limbs 2-3 px thick; hands/feet exaggerated (north star).

### 7.2 Camera and Blender role (E+)
- Orthographic, side-on, fixed; 4x supersample; `Raw` colour; no AA. Used to output pose silhouettes + slot occupancy masks per frame, not final colours.
- Optional three-quarter yaw test (20-30 degrees) for face readability.

### 7.3 Palette and ramp design
- Extend the existing slots (hair/skin/primary/secondary/accent + constant eye white) with `ramp3/ramp2` in `pal.ts`: highlights drift warm, shadows cool. Global index table (spike): 1-3 skin, 4 warm line, 5-6 hair, 7-9 primary, 10 cool line, 11-12 secondary, 13-14 accent, 15 eye. Keep hue-matched dark outlines, never pure black. Default look uses 14-15 colours.

### 7.4 Outline and shading rules
- Outer outline 1px; inner line only between near limb and torso/outfit. Outline once on the composited result (bake step). Flat bands: light 2 px max, base, shade; dither never on characters.

### 7.5 Animation list (frames)
idle 4, walk 6, run 8, skid 1, jump anticipation/rise/apex/fall 4, land 2, stomp-bounce 4, hurt 2, flash 2 (already in hero); add: crouch 1, swim 4, climb 4, emote 4. Stepped timing; squash/stretch via transform tween.

### 7.6 Layers/passes for the creator
Draw order (back to front): cape/back item, hair back, far-body (arm, leg), far-outfit, body (head, torso, pelvis), outfit torso, face, headwear, hair front, near-body, near-outfit, hand/held-item anchor (per frame (x,y,angle) in metadata, item drawn last), accessories. Hair-back/front split and near/far limb splits are mandatory (spike evidence).

### 7.7 Export, atlas, naming
- Per layer a PNG strip of index values: `layers/<slot>_<itemId>.png` with frames in fixed order, plus `anims.json` (name, frame indices, per-frame ticks, hand anchor). Index in R, alpha for coverage (8-bit). Frames packed with existing `packSheet` (`core.ts`); names `<slot>.<item>.<anim>_<n>` mirroring hero frame names.
- Palette file: 16x RGB LUT per look.

### 7.8 Recolor, loading, caching, network
- Recolor: reuse `recolor()` / a LUT swap at bake time (CPU).
- Per player: on look change, composite layers in draw order, recolor, outline once, upload ONE sheet (RenderTexture/Texture from canvas); cache keyed by look hash, LRU 256 (about 6 MB index / 26 MB RGBA worst case).
- Network: `CharacterLook` = catalog IDs (body, face, hair, outfit, headwear, back, accessory) + palette choices (5 small ints) about 12-16 bytes; server validates IDs against the catalog; clients derive the hash. Sprite art never crosses the network.
- Mirroring for facing: flip the baked sheet (existing `flipH`/left frames pattern).

## 8. Proposed repo layout

```
tools/blender-character/
  build_render.py     # (spike) procedural model + rig + stepped anims + data-pass renders
  pixelize.py         # (spike) downscale, toon band, palette, cleanup, composite, sheets
  run.ps1             # regenerate everything (absolute paths; Blender resolves relative --out oddly)
  (future) poses/     # keyed poses exported as JSON
  (future) guides/    # generated silhouette + occupancy masks for pixel authors
packages/art/assets/blender-characters/   # spike outputs + guides only; shipped art stays in packages/art/src/characters
```
Plugs into `packages/art`: guides feed the ASCII-row authoring helpers (`stamp`, `outlineRows` in `characters/compose.ts`) and the bake step uses `blit`, `recolor`, `packSheet`, `encodePNG`. Client loads the baked sheet as a PixiJS texture.

## 9. Spike results (measured)

Built `tools/blender-character/`: procedural chibi (primitives only), 18-bone rig, run (6) and idle (4) stepped keys, 5 collections (body/face/hair/outfit/cape), 10 render layers, one outfit, one hair, shared light, slot+depth+normal passes, 24x32 pixelize with palette indexing, cleanup, bake-time outline, 3 looks.

Outputs (repo-relative):
- `packages/art/assets/blender-characters/poc_run_layers.png` per-layer frames + composite
- `packages/art/assets/blender-characters/poc_composited_4x.png` (drawn at 6x) looks A/B/C recolor, run + idle, single-render reference
- `packages/art/assets/blender-characters/poc_method_compare.png` center vs mode, clean, outline
- `packages/art/assets/blender-characters/poc_vs_handmade.png` spike vs hand-authored hero

Numbers:
- Blender: 220 renders (11 render sets x 2 passes x 10 frames) in 27 s, about 2.7 s per animation frame for all layers (EEVEE headless, includes per-render overhead; a full set of about 34 frames x 10 layers is under 2 minutes).
- pixelize: about 0.035 s per frame for all layers (Python/numpy).
- Layer alignment: exact by construction; composite-by-depth vs single render differed 4-9 px/frame of about 264 (8-bit depth ties; use 16-bit).
- Fixed draw order vs depth truth: 30-37 px/frame difference even with near/far limb layers.
- Colours: 14 on the default look; at most 5 per layer.
- Recolor: slot LUT swap worked cleanly (looks B, C).

Honest evaluation against the north star:
- Passes: flat 2-3 tone bands, hue-shifted palette locked to 15 colours, dark outline, small canvas, stepped timing, clean recolor, exact layer alignment.
- **Fails / weak**: (1) faces: profile only, one dark eye, no expression; the hand hero's face is its strongest SMW trait. (2) Torso/limbs are thin and busy at 7px wide; hand hero reads chunkier and cleaner. (3) Thin limbs still shimmer between frames. (4) Per-layer outlines create noise; only works with bake-per-look. (5) Needs manual cleanup to match hand quality, so regeneration-compatibility is lost. (6) Looks a bit generic/rubbery next to the hand hero (`poc_vs_handmade.png`).
- Verdict: the spike is a credible *base-motion generator*, not a replacement for hand-pixeled final sprites. Not SMW-essence on its own.

## 10. Relation to the current hand-authored paper-doll work

What to reuse: `CharacterLook`/`LookSpec` ideas and slot chars (`HERO_SLOT_CHARS`), `ramp3/ramp2` palettes, `outlineRows` sel-out, `heroPalette`, option lists, pose table `HERO_POSES`, frame order, atlas/packing (`packSheet`), `recolor`.
What E+ adds: Blender-generated per-frame guides/occupancy masks so new equipment layers align to existing poses; pose reference for new animations; look-baking cache.
What it replaces: nothing shipped. The spike does not replace hand art.
Migration plan: (1) keep E as is; (2) export current hero poses as occupancy masks (validates the guide tool against known-good art); (3) author 1 new equipment set using guides and compare effort; (4) add look-bake cache in the client; (5) only if step 3 shows big savings, extend guides to all slots.

## 11. Risks, licensing/IP, effort, open questions

Risks and mitigations:
- Style drift from 3D-generated frames -> keep hand art final; 3D only as guides.
- Combinatorial art cost (E) -> occupancy-mask guides, restrict movesets per armour class (Diablo II lesson).
- Memory with many players -> bake per look, dedupe by hash, LRU.
- Pixel shimmer -> thick limbs, manual fixes, 16-bit depth.
- Tooling rot (Blender updates) -> pin Blender 5.1; keep scripts small.
- Add-ons: `Pixelize` and similar exist (README lists resolution, quantize, pixel lighting) but I could not verify licence or maintenance -> do not depend on any; own scripts only.
Licensing/IP hygiene:
- Blender: renders and .blend are the creator's property (blender.org licence page); Blender itself is GPL, scripts you write are yours.
- Mixamo: royalty free for games per Adobe FAQ (2021), raw-file redistribution restricted; avoid it anyway (originality, terms drift).
- Asset stores/AI-generated models: avoid for shipped characters (provenance unclear); keep all models procedural or hand-made and log provenance.
- Fonts: use only own/OFL fonts; existing `font.ts` is hand-authored.
- Reference rule: DKC/KI/Dead Cells/SMW are craft references only; no copied designs.
Effort (one person-equivalent):
| Phase | Work | Estimate |
|---|---|---|
| 0 | Decide (this doc) | 0.5 d |
| 1 | Occupancy/silhouette guide exporter from spike + hero pose match | 3-4 d |
| 2 | Look-bake cache + palette LUT in client | 2-3 d |
| 3 | Author first new outfit/hair with guides; measure | 3-5 d |
| 4 | (Optional) D-lite full pipeline: 16-bit depth, hand-cleanup diff tooling | 8-12 d |
Open questions for the owner:
1. Accept E+ (hand final, Blender guides)? Or pursue D-lite despite the quality gap?
2. Do faces need front/three-quarter view? (Profile-only is a significant look change; yawed camera has a 3D-look risk.)
3. How many equipment slots/items at launch; per-armour-class restricted movesets acceptable?
4. Will weapon-attack animations be large in number (would tip the balance toward Blender base motion)?
5. Is any third-party mocap/asset use allowed at all, or strictly original?

## 12. Annotated bibliography (all accessed 2026-09-30)

1. Vasseur, Dead Cells 3D pipeline (Gamasutra repost, via sudonull.com) - https://sudonull.com/post/14066-Dead-Cells-Using-3D-Pipeline-for-2D-Animation : primary account; tools, cel shading, flicker, timing benefits. Index page: https://www.gameanim.com/2018/01/31/dead-cells-3d-pipeline-2d-animation/
2. Wikipedia, Donkey Kong Country - https://en.wikipedia.org/wiki/Donkey_Kong_Country : SGI/Alias pre-rendering, ACM compression. Corroborated by Medium "New Player Ready" and GameGrin search results (not opened).
3. Wikipedia, Killer Instinct (1994) - https://en.wikipedia.org/wiki/Killer_Instinct_(1994_video_game) and Vectorman - https://en.wikipedia.org/wiki/Vectorman : pre-rendered CG; Vectorman piece animation (via search summary).
4. Adobe, Mixamo FAQ - https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html (last updated 2021-09-14); Adobe community thread - https://community.adobe.com/t5/mixamo-discussions/the-license-to-use-mixamo/m-p/13228937 : redistribution caveat.
5. Blender Foundation, licence - https://www.blender.org/about/license/ : output ownership.
6. Blender Manual, ID Mask / Cryptomatte - https://docs.blender.org/manual/en/latest/compositing/types/mask/id_mask.html ; Shader to RGB - https://docs.blender.org/manual/en/latest/render/shader_nodes/color/shader_to_rgb.html : pass and toon-ramp facts.
7. Artisticrender, compositor pixelate - https://artisticrender.com/how-to-pixelate-an-image-using-the-compositor-in-blender/ ; Saved Pixel palette workflow - https://savedpixel.com/blog/blender-pixel-art : pixelate and palette-texture methods.
8. LeonardoDocs/Pixelize - https://github.com/LeonardoDocs/Pixelize : README only; maintenance/licence unverified.
9. GameDev.net, Diablo II sprites - https://gamedev.net/forums/topic/487300-question-about-diablo-2s-sprites/ : layered components (WEAK: forum, fetch returned 403; used via search snippet).
10. Terraria custom player sprite discussions (nterraria.fandom.com/f/p/2617778733318178418) : layer draw-order (WEAK).
11. Relish Games, pixel-art pipelines - https://relishgames.com/journal/pixel-art-pipelines-best-tools-for-2026/ : hand-clean after conversion, rotoscope every 3rd frame (secondary).
12. Blender Artists, outline methods - https://blenderartists.org/t/whats-the-best-outline-for-toon-anime-freestyle-vs-inverted-hull-method-vs-another-method-in-2-9/1278907 : Freestyle vs inverted hull trade-offs.

Gaps: no GDC/primary source for Diablo II; the Terraria layering claim is unverified; Mixamo full Terms text not read; browser (PixiJS) memory figures are estimates; 3/4-yaw variant untested.
