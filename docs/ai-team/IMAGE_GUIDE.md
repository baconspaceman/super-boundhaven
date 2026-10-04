# Image Maintenance Guide

<!-- core:start -->
**What "image" means.** Super BoundHaven's image is its visual identity, voice and quality bar, plus everything the public sees: art, site, README, docs portal, screenshots, social posts. Your job is to keep all of it consistent with Anthony's vision. If in doubt, do less and ask.

**Authority order.** `docs/ART_NORTH_STAR.md` (wins every art dispute) > `docs/ART_DIRECTION.md` / `ART_WORLD.md` / `ART_OBJECTS.md` > `DECISIONS.md` (what is confirmed) > this guide.

**Identity rules.** Name is "Super BoundHaven" (SBH); keep "Super". The name is a working title with legal clearance pending, so never claim it is final or trademarked. No "Bacon" or "Spaceman" branding anywhere public. Motifs: spring coil / bounce pad, cyan Bound Shard, "haven shard" gem. Look: Super Mario World *essence* (bold, chunky, cheerful, readable), 100% original designs.

**Hard pixel rules.** 256x224 native, integer scaling only; 16x16 tiles; 24x32 stout humanoids (2-3 heads tall, no cubes); <=15 colors + transparent per sprite layer; dark hue-matched outline (never pure black, deepest ink `#2b2350`); flat 3-tone shading lit from top-left, highlights warm, shadows cool; no anti-aliasing, gradients or stray pixels; dithering only in sky/haze bands, never on characters; playfield is higher contrast than background; interaction colors gold = needs action, cyan = done/powered, coral = lever/hazard.

**Voice.** Plain, warm, honest, sharp. Say what exists today. No dates, prices, reward amounts, raid-size promises or monetization terms, ever. Status labels only: Playable prototype / Planned / Later / Concept (plus the direction chips already on the site).

**Never** copy Nintendo or others (no red-capped plumber, green saddled dinosaur, eyes-on-hills, question-block lookalikes). Art is CC BY-NC-SA 4.0, code MIT.

**Stop and ask Anthony** for anything about money, accounts, public posts, legal/trademark, licenses, final title or anything irreversible (see `REVIEW_CHECKLISTS.md`).
<!-- core:end -->

Related: [`CHARTER`](CHARTER.md), [`PROTOCOL`](PROTOCOL.md), [`WORKSTREAMS`](WORKSTREAMS.md), [`README`](README.md) in this folder; [`REVIEW_CHECKLISTS.md`](REVIEW_CHECKLISTS.md), [`ENGINEERING_RUNBOOK.md`](ENGINEERING_RUNBOOK.md), [`ASSET_PIPELINES.md`](ASSET_PIPELINES.md); [`docs/bible/`](../bible/), [`docs/mechanics/`](../mechanics/), [`docs/ROADMAP.md`](../ROADMAP.md).

Everything below is checked against the repo as of 2026-10-04 (241 tests passing, commit `cff9c4c` plus uncommitted doc work). Where something is unverified or a known gap, it is flagged.

---

## (a) Identity summary

### Name rules

| Rule | Detail | Source |
|---|---|---|
| Keep "Super" | The owner wants "Super BoundHaven". Short form "SBH". Written `BoundHaven` (one word, capital H) in running text. | `DECISIONS.md` "Confirmed direction" |
| No Bacon / Spaceman branding | Those belong to Anthony's other projects. Never in site copy, art, README, repo metadata, release notes or socials. (The GitHub user is `baconspaceman`; that is an account name, not game branding. Do not add it to art or logos.) | `DECISIONS.md`, `docs/NEXT_ACTION.md` standing rules |
| Working title | "Super BoundHaven" is provisional. Final title and legal clearance are in the "Still needing Anthony" list. README already says "working title"; keep that sentence. | `DECISIONS.md`, `README.md` |
| Not affiliated | Nintendo and others appear only as inspiration references; keep the "unaffiliated" language from `NOTICE.md`. | `NOTICE.md` |
| Name/logo license | Name and logo are not licensed for derivative products (`LICENSE-ASSETS.md` section 3). | `LICENSE-ASSETS.md` |
| Currency / character names | Undecided. Do not invent final names in public copy. Placeholders must be labelled as placeholders. | `DECISIONS.md` |

### Public look (the marketing site)

Defined in `apps/site/src/styles.css` `:root`. Do not add colors outside these tokens without a review.

| Token | Hex | Use |
|---|---|---|
| `--bg` | `#0b0b14` | page background (also `theme-color`) |
| `--bg-alt` / `--surface` / `--surface-2` | `#10102a` / `#1a1a38` / `#232350` | section and card layers |
| `--line` / `--line-soft` | `#3a3a86` / `#2a2a5c` | borders |
| `--text` / `--muted` | `#f1f2ff` / `#b4b7d8` | body copy |
| `--gold` | `#ffd84a` | primary accent, "Super" in the lockup, favicon square |
| `--pink` / `--cyan` / `--green` / `--purple` | `#ff4f7b` / `#3be0ff` / `#5ef29a` / `#9a7bff` | secondary accents, chips |

- **Typography.** No external fonts, ever (privacy rule: "the sites make no third-party requests"). Headings and labels use the monospace stack `ui-monospace, 'Cascadia Mono', 'SF Mono', Consolas, ...` (`--font-pixel`); body uses the system sans stack. In-game text uses the repo's own 5x7 pixel font (`packages/art/src/characters/font.ts`, sheet `characters_font.png`).
- **Logo lockup.** Hero `<h1 class="logo">`: small "Super" (`logo__top`) over large "BoundHaven" (`logo__main`). Tagline: "Bounce together. Master every jump." Eyebrow: "In development / Browser first / Steam later".
- **Favicon.** Inline SVG data URI in `apps/site/index.html`: 8x8 grid, dark ground, gold square. Keep it a data URI (no extra request).
- **Key art.** `apps/site/public/og.png`, 1200x630: pixel-art characters with different looks running across a sunset meadow with layered mountains and clouds (alt text in `index.html`). README embeds it at width 720.
- **Sharp 4 px radius, hard 4px offset pixel shadow** (`--radius`, `--shadow-px`): the UI echoes the pixel look. Avoid soft blurred drop shadows and large rounded corners.

### Motifs

- **Spring coil / bounce pad**: the signature. Coil Antenna headwear, Coil Pack, Pogo Shoes, frog/drake crest, bounce star-burst, the red-coral bounce pad tile (`B`).
- **Bound Shard**: cyan crystal collectible (`shard_spin` 6 frames, `obj/shard_pickup_*`, `fx/shard_*`). The gem inlay in stone pillars is the "haven shard".
- Distant floating shard islet in the meadow sky; magenta/cyan crystals in the caverns.
- Do not add a new "signature motif" without Anthony. New props may reuse the coil/shard language.

### Mascot and humanoid style

There is **no single mascot character** and none should be invented. The face of the game is the *player-made hero*: a layered humanoid paper-doll (Terraria-style customizer, not blocks).

- 24x32 px sprite, ground row is row 31, anchor bottom-center. Stout: roughly 2-3 heads tall, big head/hands/feet.
- Eyes are bold 2x3 px with a dark lid row and highlight; one-row mouth; brow row. Expressions are states (blink, shut, wince, wide, grit, open, wail, o).
- Walk = 6 frames, run = 8, never 2-frame walks. Anticipation, squash/stretch, lean on run, skid, expressive idle (breathing + blink).
- Roster of mounts is fixed: **frog, dinosaur, flying dinosaur (drake), cheetah.** No wolf (explicitly rejected by Anthony). Mount gameplay is *Planned*; mount art exists.
- Enemies are cute-but-mischievous: angled brows, small fangs, big feet. Sproutling = plum + leaf, Zipwing = teal + gold stripes, Shardback = slate + magenta crystals. Stompable ones have a flattened defeat frame; the spiked one does not.

---

## (b) Visual style rules (distilled from the north star)

### Do

| Area | Rule (concrete) |
|---|---|
| Resolution | 256x224 native view, integer scaling only (client uses `floor(min(w/256, h/224))`). One pixel scale in the whole frame; never mix pixel sizes. |
| Tiles | 16x16, atlas rows of 16 tiles. Ground = grass cap with a bright top lip, layered earth, flat hand-placed 2-3 tone blocks. Slopes are true 45 degrees, 1 px per column, and join flat tops cleanly. |
| Tile palette | Exactly **16 colors** per tileset (4 cover, 4 earth, 3 stone, 2 timber, 3 accent). All three tilesets (`meadow`, `meadow_sunset`, `caverns`) share identical tile ids so a region swap is just an atlas swap. |
| Sprite palette | **<= 15 colors + transparent per authored layer** (SNES rule). Composited paper-doll frames may exceed that because layers are independent. Enemy and mount sprites obey 15. |
| Outline | Dark, even, **hue-matched** (the darkest tone of the neighbouring ramp on shade edges, the ramp's mid tone on lit top/left edges). Never pure black. Deepest ink `#2b2350`. |
| Shading | Flat 3 tones (light / mid / dark), light from top-left. Highlights drift **warm yellow**, shadows drift **cool blue-violet**. Skin shadows stay desaturated so they never turn rash-red. |
| Ramps | Hue-shift every ramp. A ramp that only changes brightness looks muddy; that is a reject. |
| Characters | Humanoid, 24x32, no cubes or blocks. Hero stays high-contrast against every world theme. |
| Backgrounds | Gentle layered hills/mountains/clouds, **lower contrast than the playfield** (compressed value range, cooler and hazier), gentle parallax. One world = one mood. |
| Dithering | **Sky bands, halos and cave-deep band seams only** (4x4 Bayer in the Blender sky pipeline). Everything else is hard-banded. Never on characters. |
| Solid vs soft | What you can stand on is solid and high-contrast. Decoration is soft and `solid:false`; nothing decorative imitates a collidable tile. |
| Interaction colors | **Gold** = needs action (lock, waiting plate, timer ring). **Cyan** = powered/done (pressed plate, open gate, lit emblem, shard). **Coral** = lever knob / spike hazard stripes. Pale slatted lip = one-way platform. Accent hexes are identical in every region; only structure (stone/timber) is tinted. |
| Juice | Dust puff (4), landing ring (3), bounce star-burst (4), sparkle (4), stomp star (3), respawn poof (5), spinning shard (6). Keep effects chunky and short. |
| Readability test | A screenshot must read in half a second. Silhouettes must be unmistakable at 256x224. |

### Don't

- No cubes or blocks as characters.
- No anti-aliasing, soft gradients, painterly or photographic rendering, glossy pre-rendered "3D" look (the Donkey Kong Country look is a documented fail), heavy noise, or crayon texture.
- No pure-black fills. No tiny illegible detail. No stray single pixels (art tests flag disconnected pieces).
- No dithering on characters or tiles.
- No palette cheating across sprites (a sprite borrowing colors outside its ramp).
- No grim, muddy or low-contrast mood. Nothing that vanishes into the background.
- No second pixel scale (for example a 2x-scaled sprite next to a 1x one).
- No decorative element that looks like a solid tile (thin vines and soft foliage are fine; blocky stone is not).
- No clone-adjacent designs (see section e).

### "Looks off-brand" gallery (in words)

These are failure modes either seen in the repo's own known-weakness lists or named as hard rejects in the north star. Use them as a visual rejection checklist.

1. **Muddy faces.** Hero faces at 1x are still small (known weak spot). Failure looks like: eyes merging with the lid row, a skin shadow that turns reddish, a mouth that is two stray pixels, a brow lost in hair. Fix by contrast: bold 2x3 eyes, a 1-row mouth, keep skin shadow desaturated.
2. **Noisy dithering.** Checkerboard texture creeping onto characters, tiles or foregrounds; a wide dither zone in the sky that reads as static; visible circular edge on a dithered sun halo (known: the Blender halo is a dithered disc with a visible edge). Dither is allowed only as a *narrow* sky/haze seam.
3. **Glossy 3D look.** Smooth gradients on trees or palm fronds, specular-looking highlights, soft rounded shading on props. Known weak: palm fronds, torch flame, lantern in the Blender prop set. The cure is flat 2-3 tones, hard banding and a full hue-matched outline.
4. **Yoshi / Mario lookalikes.** A red cap with a mustache, a green dinosaur with a saddle and a big round nose, eyes on hills, a coin-block lookalike with a question mark, shell-turtle or mushroom enemies. The frog/dino mounts must keep their own silhouettes (frog green with a crest, dino terracotta, drake sky-blue, cheetah gold with spots) and nothing resembling a licensed character.
5. **Low-contrast hazards and interaction props.** Known: lever art low contrast, idle flag too grey, spikes read white-heavy (1 px tips), open-gate frame small and abstract, shard outline weak on the caverns floor. A hazard must read instantly; gold/cyan/coral must stay saturated.
6. **Background louder than the playfield.** Foreground tiles with the same value range as the hills; cave backgrounds too dark and uniform (known); busy checker backgrounds behind the hero.
7. **Mixed pixel scales or off-grid tiles.** Anything not on the 16 px grid or a sprite scaled by a non-integer factor; blurry upscales (`image-rendering` must stay `pixelated`/nearest).
8. **Mechanical outline passes.** An outline of uniform thickness that ignores sel-out (known for the Blender near hills). Looks "filtered", not drawn.
9. **Over-rendered or tiny detail.** Armor filigree, tiny flowers that lack character, details smaller than 2 px that vanish at 1x.
10. **Off-tone UI.** Soft blurred shadows, large rounded corners, outside fonts, neon gradients, or a color not in the token table above.

---

## (c) Voice and copy rules

### Tone (observed in `apps/site/index.html`, `README.md`, `NOTICE.md`)

- **Plain, warm, honest, sharp.** Short sentences. Verbs first: "Play the prototype", "Watch the gameplay reel", "Join the waitlist". Self-aware about being early: "Early and rough: a shared movement playground and a character creator. No launch date yet."
- **Say what exists today**, then what is intended, always with the status label.
- **Show, do not hype.** No "revolutionary", "next-gen", "AAA", "the ultimate", "best", "game-changing". No claims about being better than other games.
- **No emoji, no ALL CAPS shouting, no exclamation chains.** (None appear in the shipped copy; keep it that way.)
- Sentence case for headings. Pixel-ish monospace is a visual choice, not a license for leetspeak.
- Inclusive, kind, no insider jargon without a gloss. Alt text on every image (see existing alts in `apps/site/src/content.ts`).
- Mention inspirations only as "inspired by the essence" and never as "like Mario". Use the existing wording: "named only as inspiration and craft references".

### Per surface

| Surface | Rules |
|---|---|
| **Site** (`apps/site/index.html`, `src/content.ts`) | Every feature block carries a status chip. Concept regions say "creative direction, not a launch promise" (comment in `content.ts`). Keep "Playable prototype" claims limited to what runs: shared movement playground, character creator, small co-op room. Never imply a hosted server exists: the Pages build has none. |
| **README** | The status table is the source of truth for public claims. Keep "No dates, prices, rewards or monetization terms have been decided or promised." Keep the "Originality and assets" section intact. |
| **Patch notes / release notes** | Past tense, concrete, short. Format: `What changed` (player-facing), `Known issues`, `Status label per feature`. No dates for future work. No "coming soon". Credit "Super BoundHaven" with a link when quoting art. |
| **Social posts** | **Anthony approves every public post** (needs-Anthony trigger). You may *draft* in a file. One idea per post, include a real screenshot taken via the procedure in section (f), always state "early prototype". No giveaways, no reward amounts, no "wishlist now" (no store page exists). No tagging rights holders. |
| **In-game text** | Quick-chat only; no free-text chat (interim default awaiting Anthony). Short, friendly, 5x7 pixel font friendly (limited glyph set). Prompts name the button by glyph (see `docs/CONTROLS.md`). Never put real names in test or demo content. |
| **Issue / PR replies** | Kind and constructive; code PRs "not accepted yet" per `CONTRIBUTING.md`. Never include personal info. |
| **Docs** | Label every design statement **[CONFIRMED]**, **[PROPOSAL]** or **[OPEN]** like the GDD. Do not upgrade a proposal to confirmed. Only Anthony's words or his acceptance make something confirmed. |

### Banned in public copy

Launch dates or seasons; prices or "free forever"; Steam fee targets; "1,000 downloads" or "million players" rewards; raid sizes as a promise (design says 8 but it is design intent only); monetization models; "loot box" or gambling mechanics; anything that sounds like a guarantee ("will", "guaranteed", "always") about unbuilt features; the words "Bacon" or "Spaceman" as branding; any competitor smear.

---

## (d) Public-face consistency

### What must stay in sync

| Public thing | Must match | Where | Check |
|---|---|---|---|
| Site feature chips and copy | `DECISIONS.md` and the GDD tags (confirmed / proposal / open); the repo's real state | `apps/site/index.html`, `apps/site/src/content.ts` | Read each chip next to the README status table |
| README status table | What actually runs today; `docs/ROADMAP.md`; `docs/NEXT_ACTION.md` | `README.md` | Run the game; count tests (`npm test`); verify claims |
| Docs portal | Every `.md` is auto-published; links must resolve; status words honest | `tools/docs-site/build.mjs`, `docs/PUBLIC_DOCS_INDEX.md` | `npm run build:pages` then `npm run linkcheck` |
| Screenshots | The current build's art. Used by README and the site's shots gallery | `apps/site/public/shots/shot-*.png` (day, sunset, night, caves, creator, together) | Compare to a fresh capture; refresh per section (f) |
| `og.png` | Current hero/backdrop look. 1200x630. | `apps/site/public/og.png` | Open it next to the live site hero |
| Version / status chips | `package.json` version (`0.0.1`), README badge line `status: pre-alpha prototype`, protocol version (v3 in `docs/NETCODE.md` and `packages/protocol/src/index.ts`) | README, `docs/NETCODE.md` | grep for `protocol v` |
| Counts in copy | The test count, region counts, option counts. These change. Prefer ranges or avoid numbers in prose; if cited, re-verify. `docs/NEXT_ACTION.md` says 241 tests; `docs/CHARACTER_CREATOR.md` lists catalog counts. | various | `npm test` summary |
| Licensing statements | `LICENSE`, `LICENSE-ASSETS.md`, README footer, `NOTICE.md` | all | Search for "license" before every release |
| Controls docs | `docs/CONTROLS.md` vs actual key bindings (`apps/client/src/bindings.ts`) and the site's play hint | docs, site | Press the keys |
| Repo metadata | GitHub description, topics, social preview image on github.com | **not in the repo; Anthony's account** | Needs-Anthony to change |

### The "no promises" rule

Public text never states, even softly: dates, price, reward amounts, drop rates, monetization terms, raid sizes as promises, platform timelines, or that any *Planned* feature will ship. Use "Planned", "Later", "Concept" (see below). If a doc says "design intent", keep that phrase.

### Honest status labels

Use exactly these (as used by the site's chips: `chip--proto`, `chip--planned`, `chip--later`, `chip--dir`):

| Label | Meaning | Example |
|---|---|---|
| **Playable prototype** | Runs today in the repo or in Pages `/play/` | movement sim, creator, co-op room |
| **Planned** | Designed, accepted or proposed, not built | skill tree, mount gameplay |
| **Later** | Intended after other milestones | player-made levels, accounts |
| **Concept** | Mood art or idea only; no gameplay behind it | the 12 concept regions |
| **Roster & summon: confirmed direction** (`chip--dir`) | Anthony confirmed the direction, mechanics not built | mounts |

A feature may only upgrade a label when it is demonstrably playable. When in doubt, use the lower label. When removing or downgrading a claim, do it silently in the same PR; never leave stale hype.

### Screenshot refresh procedure

See section (f). Trigger refresh after changes listed in section (g).

### Public-face red flags to fix on sight

1. Any copy that says "launching", "coming soon on Steam", or a price.
2. A screenshot that shows placeholder UI, debug HUD (F1 overlay), the `?pad=debug` panel, or a local path in the browser chrome.
3. A claim of an online server (none is hosted).
4. Mismatch between the site's region list and the README status table.

---

## (e) Review procedure for new art, assets and copy

Use `REVIEW_CHECKLISTS.md` "Art / asset PR" and "Copy / public-text PR". Summary of the gates:

### Gate 1: north star fit
Compare against `docs/ART_NORTH_STAR.md` sections "essence" and "must NOT do". Render at native size and at 3x. Check silhouette, contrast against every region background (`meadow`, `meadow_sunset`, `caverns`, plus the four Blender times of day).

### Gate 2: mechanical checks
- `npm test` (art tests enforce palette limits, connected pieces, atlas bounds), `npm run typecheck`.
- Blender outputs: `python tools/blender/check.py` (hard alpha, <=32 colors per layer, <=64 per scene, seam continuity, palette membership, sprites <=15 colors).
- Visually open the regenerated preview PNGs (see `ASSET_PIPELINES.md`).

### Gate 3: originality and IP screening
1. **Silhouette test.** Fill the sprite solid black at 1x. Would anyone name an existing character, enemy or object? If yes, redesign the silhouette.
2. **Signature-element test.** List 3 defining traits (palette, headwear, prop, motion). Do two or more match one existing IP (red cap + mustache, green dino with saddle, hills with eyes, ? block, shell/mushroom enemies, green pipe with a plant)? Reject.
3. **Reverse-check.** Search for the design by description in an image search (a human or an agent with web access; never paste Anthony's private files). Search terms: the creature plus "pixel sprite", the palette, the nickname. A near match to a known sprite is a reject; document the check.
4. **Name test.** New names (creatures, regions, items) are searched for trademark conflicts; avoid names of known games or characters. Final character/currency names are Anthony's.
5. **No third-party inputs.** No downloaded models, textures, HDRIs, brushes, reference images, music or sound (confirmed policy: strictly original assets, no third-party mocap). Procedural generation with fixed seeds is the norm.
6. **AI-generation caution.** Do not paste output from image generators into the repo as final art; the project's provenance claim is "pixel art produced by code in `packages/art` or by the Blender pipeline". Any exception (for example a concept sketch) needs Anthony's approval and a provenance entry.

### Gate 4: provenance record
Every new asset class gets a line in `PLACEMENT_AND_PROVENANCE.md` (or a section in the PR description and `docs/research/sources/notes.md` if it came from research): who or what made it, tool, seed, date, inputs (none third-party), and the originality checks done. Generated art is reproducible from `packages/art` or `tools/blender` plus a seed; record the commit.

### Gate 5: license obligations
- **Art, characters, designs, lore, docs, site assets**: CC BY-NC-SA 4.0 (`LICENSE-ASSETS.md`, full text `LICENSE-ASSETS.txt`). New content paths under `packages/art/assets/**`, `apps/site/public/**`, `apps/site/src/assets/**` and `docs/**` are covered automatically; if you create a **new top-level content folder**, add it to `LICENSE-ASSETS.md`.
- **Code**: MIT. New code folders are covered if under the listed paths; add new ones to `LICENSE-ASSETS.md` section 1.
- Attribution when reusing art elsewhere (for example in a social post): credit "Super BoundHaven" with a link to `https://github.com/baconspaceman/super-boundhaven` and indicate changes.
- Anthony as copyright holder can relicense future versions; **never change a license text yourself** (needs Anthony).

### Gate 6: public-text consistency
Re-read the copy against section (c) and the label table in (d). Check the docs portal build and linkcheck.

---

## (f) Screenshot and capture procedure

### Where screenshots live

| File | Used by | Size |
|---|---|---|
| `apps/site/public/shots/shot-day.png`, `shot-sunset.png`, `shot-night.png`, `shot-caves.png`, `shot-creator.png`, `shot-together.png` | README table, site screenshot gallery (`apps/site/src/main.ts` references `shots/<file>`) | 768x672 (the site writes `width="768" height="672"`) = 3x native |
| `apps/site/public/og.png` | social card, README header | 1200x630 |
| `packages/art/assets/*preview*.png`, `world_preview_scene_*`, `world_objects_scene_*` | docs art gallery, site region viewer (`world_preview_scene_<region>_<0..2>.png`, 768x672) | generated by the art build; never hand-edit |

The shots gallery is shown at `768x672`, which is exactly `3 x 256 x 224`. Capture at the same size so nothing needs resizing.

### Capturing a gameplay frame (browser)

1. Start the stack: `npm run dev` (server :8080 + client :5173).
2. Pick a view with query flags (all verified in `apps/client/src/main.ts`):
   - `region=meadow|meadow_sunset|caverns`, `tod=dawn|day|sunset|night` (`tod` also picks a matching region), `name=<hero>` auto-joins (skips the creator), `look=<code>` picks a look (20-char code, `v1` prefix), `raf=timer` makes the loop run from `setTimeout` (**required in headless or hidden browser panes**, where `requestAnimationFrame` is paused), `lag=`/`loss=` simulate network.
   - Example: `http://localhost:5173/?name=Scout&region=meadow&tod=day&raf=timer`
3. **Viewport exactly 768x672.** The client renders a full-window canvas and scales by `k = floor(min(w/256, h/224))`; at 768x672 the scale is exactly 3 and there is no border. For a larger master use 1024x896 (k=4) and keep it only as a source, not the committed file.
4. Press **F1** to hide the debug HUD. Make sure the pad debug overlay (`?pad=debug`) is not showing, no toast/banner is visible, and the player name is not a real name (use `Scout`, `Pip`, etc.; never Anthony's real name or account).
5. Capture the **canvas area only** (a browser element screenshot of the canvas, or a viewport screenshot with the window at 768x672). Do not capture browser chrome (local URL, tabs).
6. For "together" shots, open a second tab with a different `name` and `look`, both on `raf=timer` if headless.
7. Region/time-of-day can also be cycled in game with `[` `]` and `,` `.` (debug keys).

Verify the output: PNG, correct pixel size, nearest-neighbour crisp (zoom to 400%: edges must be hard).

### Capturing creator screenshots
Open `http://localhost:5173/` (the creator opens full-screen on load). Choose a diverse look (do not use the plain default if it reads dull); pick a pose chip (Idle/Walk/Run/Jump/Stomp/Hurt). Capture 768x672.

### Capturing from the art build (no browser)
The art build writes previews. These are the preferred way to show off art in the docs gallery because they are deterministic. Regenerate with `npm run build:art -w @sbh/art` (see `ASSET_PIPELINES.md`).

### Naming
`shot-<subject>.png` in lowercase with hyphens (`shot-day.png`). New shots need an entry in the site shots list (`apps/site/src/main.ts`, look near line 133) with alt text and a title, and a README table cell. Do not rename existing files without updating both (links break; `npm run linkcheck` will catch it).

### What the shot must show
A clean, readable, on-brand frame: high-contrast hero on a lower-contrast backdrop, no debug text, no placeholder boxes, at least one signature motif (bounce pad, shard or coil item) in view when possible.

### Known gap
There is **no committed script** that produces `apps/site/public/shots/*` or `og.png`. They were captured manually. If you automate it, put the script under `tools/` and document it here. (Do not fabricate a script path in docs before it exists.)

---

## (g) Regression watch schedule

After each kind of change, re-check these. "Look at" means open the thing visually, not just run tests.

| If you changed... | Re-check | How |
|---|---|---|
| **Tileset** (`packages/art/src/world/tiles.ts`, `tileset.ts`, `styles.ts`) | Autotile joins, slopes (45 degree joins, cap row), bounce pad, all 3 regions (ids must stay identical across `meadow`, `meadow_sunset`, `caverns`), previews, the client playground, the site region viewer | `npx tsx packages/art/scripts/run-world.ts`; open `world_preview.png` and `world_preview_scene_*`; `npm test`; load `?region=` for each |
| **Autotile rules** (`autotile.ts`) | Pits, walls, 1-wide pillars, thin floating cells, level edges, slope bases; the coop room scenes | Open `world_objects_scene_*`; `world.test.ts` |
| **Objects** (`world/objects.ts`) | Colour language (gold/cyan/coral), contrast on caverns, door/plate/lever states, one-way lips; client `world-objects.ts` frame names | `world_objects_preview.png`, scenes; `objects.test.ts`; play the co-op room (`SBH_LEVEL=coopRoom`) |
| **Hero / paper-doll / layers** (`characters/*`) | Creator (all options, new category counts, look codes), in-game sprites and motion states, mounts' rider seating (`RIDER_HIP`), `characters_layers.png`, previews, site creator showcase, `characters_data.json` consumers | `npm test` (characters tests); open `characters_preview*.png`; run client; check the site creator panel; keep `encodeLook` codes stable unless bumping `CharacterLook.v` |
| **Animation tables** (`HERO_ANIMS`, `ENEMY_ANIMS`, `FX_ANIMS`) | `motion.ts` state mapping, tick timings (60 Hz), site reel, preview chips | `apps/client/test/motion.test.ts`; watch the reel |
| **Backdrop** (world backgrounds or Blender scenes) | Site hero (uses Blender day backdrop), site copy of art, region viewer, `og.png`, README shots, contrast vs hero sprite, parallax seams | `apps/site/src/assets` re-copy (known gap, see `ASSET_PIPELINES.md`), `npm run build:pages`, refresh shots |
| **Palette** (`palettes.py`, `pal.ts`, `palettes.ts`) | Color counts, contrast, every sprite using the ramp, accent hexes (must remain identical across regions) | `tools/blender/check.py`, art tests |
| **Blender sprites/props** | Outline quality, hue-matched `line` colors, <=15 colors, hard alpha, atlas JSON, `manifest.ts` (via `gen_manifest.py`) | `build.ps1`, `check.py`, `packages/art/src/blender/manifest.test.ts` |
| **Pixel font** (`font.ts`) | Name tags, HUD, creator labels, any text baked into previews | Look at HUD, creator and `characters_preview_font.png` |
| **Protocol** (`packages/protocol`) | Client, server, **site reel** (replays real sim), docs `NETCODE.md`, `PROTOCOL_VERSION` | `npm test`, typecheck, run 2 clients, re-read docs |
| **Sim** (`packages/sim`) | Site reel clips (tuned against the sim; `verifyClip` in `apps/site/src/clips.ts`), client prediction, server tests, controls feel | `npm test`, watch reel and playground |
| **Site CSS/HTML** | Mobile width (16 px gutter, no horizontal scroll), contrast (WCAG AA on `--text` vs surfaces), focus rings, reduced motion, chips, `og` tags, linkcheck | `npm run build:pages`, `npm run linkcheck`, open on a narrow viewport |
| **Docs content** | Docs portal rebuild, status labels, `PUBLIC_DOCS_INDEX.md`, README doc table | `npm run build:docs`, `npm run linkcheck` |
| **README** | Embedded image paths, status table vs reality, license block, links | linkcheck on the portal copy; GitHub preview |
| **Licenses / NOTICE** | Never changed without Anthony | stop and ask |
| **Any release** | Everything above that you touched, plus `npm run audit` (0 FAIL) | `REVIEW_CHECKLISTS.md` release checklist |

Quarterly (or after each milestone): re-read the site end to end against the README table and GDD tags; refresh all shots; re-run the audit; re-check `LICENSE-ASSETS.md` path coverage; check every external link in `README.md` and `NOTICE.md` still resolves.

---

## (h) Escalation: when to stop and ask Anthony

Stop and ask (do not merge, publish or "just decide"). Full list in `REVIEW_CHECKLISTS.md`.

- **Money**: prices, fundraising, monetization, supporter tiers, Steam fees, payments, paid tools or services, anything that spends credits.
- **Accounts and identity**: creating accounts, login providers, GitHub org/repo settings, domains, social accounts, secrets or tokens (never paste or request them).
- **Public posts**: any social post, announcement, release note on a platform, Pages content that is new in kind, replies on behalf of Anthony, public issue templates that change data collection.
- **Legal**: final title and trademark clearance, privacy policy, terms of service, age band, DMCA/takedown policy, moderation policy, any statement about IP of others.
- **Licenses**: changing LICENSE files, adding third-party material, relicensing, accepting external contributions.
- **Design confirmations**: turning a PROPOSAL or OPEN into confirmed, new mechanics scope, character/currency names, new mount, any change to the art north star.
- **Irreversible actions**: force-pushing, history rewrites, deleting branches or releases, deleting repo, rotating published keys, wiping data, publishing the private history bundle (never).
- **Conflicts**: two owner statements disagree, or a rule here contradicts `DECISIONS.md`. Report both, quote both, wait.

Cheap escalation form (post in the handoff or PR): `NEEDS ANTHONY: <one sentence>. Options: A..., B.... Recommendation: .... Blocked work: ....` Keep working on unblocked tasks meanwhile (Anthony asked not to be nagged until everything is done: batch questions).
