<!-- core:start -->
# Characters and creatures bible

**Players.** The hero is a stout, expressive humanoid (about two to three heads tall, big readable head, hands and feet, 24x32 sprite, hitbox 14x28) built from independent layers so every combination animates identically. The creator offers 14 skin tones; 16 hair styles with 16 colors, four tint modes (none, dip-dye, streak, underlayer) and 16 tint colors; 8 eye styles with 10 colors; 6 brows; 6 mouths; 12 tops; 8 bottoms; 8 footwear; 15 headwear (including none); 7 back items (including none); 10 accessories (including none); items carry primary and secondary colors from a 24-color table. A look is a compact 20-character code, validated by the server and synced to all players. No cubes, ever; hand-authored layered pixel art is the shipping method, Blender only a helper [ACCEPTED-DELEGATED, reversible].

**Enemies (three original species, all art-only designs wired to three sim enemy kinds).** Sproutling (plum turnip-imp with a leaf sprout, ground patroller, stompable), Zipwing (teal striped buzz-bug with gauzy wings, sine flyer, stompable), Shardback (slate pillbug with magenta crystal spikes, spiky patroller, never stompable). Cute but mischievous: angled brows, small fangs, big feet.

**Mounts (roster confirmed: frog, dinosaur, flying dinosaur, cheetah; no wolf).** Frog green, dinosaur terracotta, flying dinosaur sky-blue (internal id `drake`), cheetah gold with spots. Sprite sheets exist (bare and saddled, summon puffs, rider seat anchors, rider poses). Mount gameplay is not built. Abilities are proposals: frog charged super-hop and anchor tether, dinosaur ground-pound, flying dinosaur flap-glide, cheetah sprint dash.

**Identity rules.** Every creature has a unique silhouette and color identity; dark hue-matched outline (never pure black; deepest ink `#2b2350`); flat three-tone shading, top-left light; no noise, no gradients, no dither on characters; 15 colors plus transparent per layer; walks are six frames, runs eight, never two-frame walks. Signature motifs: the spring coil and the cyan Bound Shard.

**Extending.** Add art, add a name in `OPTION_NAMES`, mind the look-code bit width and version, add anims to `HERO_ANIMS`. See section 8.
<!-- core:end -->

# 1. Design philosophy

Characters are the most personal part of the game. Players should see themselves, find their friends at a glance, and read every pose at 256x224. Creature design follows the same rules as the world: bold, chunky, cheerful, original (`../ART_NORTH_STAR.md`, `../ART_DIRECTION.md`).

# 2. The layered humanoid creator [CONFIRMED direction; counts from code]

Source of truth: `packages/art/src/characters/look.ts` (`CHARACTER_OPTIONS`, `OPTION_NAMES`), palettes in `palettes.ts`.

## 2.1 Option catalog (current build)

| Category | Count | Names / notes |
|---|---|---|
| Skin tones | 14 | Porcelain, Ivory, Peach, Sand, Honey, Tan, Caramel, Bronze, Cocoa, Espresso, Rosewood, Moss, Periwinkle, Orchid |
| Hair styles | 16 | Bald, Crop, Side Part, Spiky, Long, Ponytail, Top Bun, Braids, Mohawk, Afro, Bob, Curly, Pigtails, Pompadour, Messy, Twin Buns |
| Hair colors | 16 | Jet, Espresso, Chestnut, Auburn, Ginger, Honey, Platinum, Silver, Slate, Cobalt, Teal, Mint, Violet, Bubblegum, Crimson, Lavender |
| Hair tint modes | 4 | None, Dip-Dye, Streak, Underlayer; tint color uses the same 16 hair colors |
| Eye styles | 8 | Dot, Round, Bright, Sleepy, Happy, Anime, Cat, Lashes |
| Eye colors | 10 | Brown, Hazel, Amber, Green, Teal, Sky, Blue, Violet, Rose, Storm |
| Eyebrows | 6 | Flat, Thin, Angled, Arched, Bushy, Dots |
| Mouths | 6 | Smile, Tiny, Flat, Grin, Cat, Smirk |
| Tops | 12 | Tee, Striped Tee, Tank, Hoodie, Jacket, Overalls, Tunic, Sweater, Sailor, Armor, Wrap, Star Tee |
| Bottoms | 8 | Jeans, Shorts, Capris, Cargo, Track Pants, Skirt, Kilt, Stockings |
| Footwear | 8 | Sneakers, Boots, Sandals, Slippers, Hi-Tops, Barefoot, Clogs, Pogo Shoes |
| Headwear | 15 | None, Cap, Beanie, Bucket Hat, Wizard Hat, Crown, Headband, Bandana, Cat Ears, Bunny Ears, Goggles, Helmet, Straw Hat, Flower Crown, Coil Antenna |
| Back items | 7 | None, Short Cape, Long Cape, Backpack, Wings, Tail, Coil Pack |
| Accessories | 10 | None, Round Glasses, Shades, Eyepatch, Freckles, Face Mask, Scarf, Bow Tie, Necklace, Earring |
| Item colors | 24 | Primary and secondary color slots for top, bottom, footwear, headwear, back item, accessory |

(The hair-color, eye-color and item-color name lists above follow `palettes.ts`; item color names include Crimson, Coral, Orange, Gold, Lime, Leaf, Forest, Mint, Teal, Sky, Cobalt, Indigo, Violet, Magenta, Rose, Plum, Rust, Brown and neutrals.)

`ART_DIRECTION.md` counts options excluding "None" (14 headwear, 6 back items, 9 accessories). The bible uses code counts including None.

## 2.2 How a look works

* `CharacterLook` is renderer-agnostic: option ids plus color ids, version `v: 1`.
* `encodeLook` packs it into a base64url code (about 20 characters, leading `1` is the version); `decodeLook` and `validateLook` reject bad codes; `sanitizeLook` repairs untrusted ones. `randomLook(seed)` is deterministic and avoids same-color primary/secondary pairs.
* Server validates every look (`parseLookCode`), rate limits `setLook` (burst 3, one refill per second), and relays looks to peers (`../NETCODE.md`).
* Layered compositor (`paperdoll.ts`): back item, hair-back, far arm, far leg, near leg, torso (bottoms, top, accessories), near arm, head (hat-back, skull, brows, eyes, mouth, hair-front, face accessory, hat). Joint table per frame for future held items.
* Expression states: eyes (open, blink, shut, wince, wide), mouth (style, open, grit, wail, o, smile), brows (style, angry, worry, up). They apply to any eye or mouth style so every look animates the same.

## 2.3 Cosmetic versus gear-bearing

Today every creator option is cosmetic. [ACCEPTED-DELEGATED] launch plan: a subset of about 36 items (about 8 headwear, 8 tops, 6 bottoms, 6 footwear, 4 back items, 4 accessories) will later carry gear stats; hair, faces, skin, eyes, recolors, emotes and trails stay cosmetic-only. [PROPOSAL] "transmog": any functional item's look can be overridden so power never forces ugliness. Brief-level pop-culture-flavored cosmetics must be original shape-language nods (no names, logos or exact costumes; rights review first).

## 2.4 Front and three-quarter faces [CONFIRMED direction, verdict OPEN]

Anthony asked to add front and three-quarter face views to the creator preview (possibly a front-facing idle/portrait) and judge visually ("we'll see how that looks"). Side-view faces stay for gameplay. Not built yet.

## 2.5 Player archetype looks (suggested sample looks) [PROPOSAL]

These are example recipes for onboarding and marketing; they are not classes (SBH has no classes; builds come from the skill system).

| Archetype | Mood | Example recipe |
|---|---|---|
| The Sprinter | Fast, focused | Headband, track pants, hi-tops, run-lean readable colors |
| The Wayfinder | Curious explorer | Bucket hat or straw hat, backpack, scarf, boots |
| The Bouncer | Co-op specialist, friendly | Coil Antenna, Pogo Shoes, Coil Pack |
| The Builder | Creator | Goggles, overalls, cargo bottoms |
| The Cat Fan | Whimsical | Cat Ears, Tail, Cat eyes and mouth |
| The Regal | Showy | Crown, long cape, wrap top |

Hero contrast rule: hair and outfit choices must avoid colors that vanish into backgrounds; every hero has a dark outline and saturated outfits.

# 3. Hero animation vocabulary (`anims.ts`)

| Animation | Frames | Notes |
|---|---|---|
| idle | 4 (hold 52, 12, 10, 14 ticks) | breathing and blink |
| walk | 6 (6 ticks each) | never 2-frame walks |
| run | 8 (4 ticks each) | lean and flight frames, grit mouth |
| skid | 1 | reversal; eyes shut, grit |
| jump_start (anticipation) / jump_rise / jump_apex / fall | 1 each | arms up, wide eyes, wail on fall |
| land | 2 | squash |
| stomp | 4 | tuck pose spin (horizontal-squash illusion) |
| hurt | 2 | wince |
| respawn | 2 flash | uses idle and land silhouettes |
| ride_sit / ride_lean / ride_grip | 1 each | rider poses on mounts; hip pixel (12,22) lands on the mount seat anchor |

Not yet drawn: dedicated crouch frame (uses land squash), front-facing portrait, attack animations, emotes, held-item poses. Hero faces at 1x are small; hands are simple 3x3 blocks (human polish pass wanted).

Juice kit (`fx.ts`, art docs): dust puff (4), landing ring (3), bounce star-burst (4), sparkle (4), stomp star (3), respawn poof (5), summon poof in/out, spinning shard (6).

# 4. Enemies (three original species)

Implemented in `packages/art/src/characters/enemies.ts` (art) and the sim entity layer (`packages/sim/src/entities.ts`, level legend `e`, `z`, `k`); client view `apps/client/src/enemy-view.ts`.

| Species | Level glyph | Sim kind | Look | Behavior | Stompable | Personality |
|---|---|---|---|---|---|---|
| **Sproutling** | `e` | 0 walker | Plum turnip-imp, leaf sprout on top, big feet, 18x18 sprite | Ground patroller, 0.5 px/tick, turns at walls and ledges | Yes (squash frame) | Grumpy-cute, trundles along |
| **Zipwing** | `z` | 1 flyer | Teal buzz-bug, gold stripes, gauzy wings, 22x20 sprite | Sine flyer, horizontal range plus or minus 32 px, 12 px bob, 96-tick period | Yes (upside-down frame) | Jittery and cheeky |
| **Shardback** | `k` | 2 spiky walker | Slate pillbug, magenta crystal spikes, curls up | Same AI as walker | **No** (curl and defeat frames) | Armored, stubborn |

Rules: stompable enemies respawn at their post after 600 ticks; hurt = respawn at last checkpoint with 90 ticks of invulnerability, no lives, no lost shards (`../design/COOP_ROOM_M3.md`). Enemy hurt and stomp are server-authoritative.

Palettes: Sproutling plum and leaf green, Zipwing teal and gold stripes, Shardback slate and magenta. Enemies are cute but mischievous: angled brows, small fangs, big feet. Stompable ones have a flattened defeat frame; the spiky one never does.

Known polish gaps (`../NEXT_ACTION.md`): enemy hitbox versus sprite size mismatch in the client, spikes read white-heavy.

Behavior beyond patrol and flying (chasing, throwing, boss attacks) is not designed; "selective enemies" is the confirmed direction (challenge mostly from the level, not from enemy density).

# 5. Mounts

Source: `packages/art/src/characters/mounts.ts`; docs `../design/MOUNTS_AND_EXPLORATION.md`; GDD section 5.

## 5.1 Roster and roles [CONFIRMED roster; abilities PROPOSAL]

| Mount | Internal id | Color identity | Role | Proposed signature ability (ACTION) | Gate uses |
|---|---|---|---|---|---|
| **Frog** | `frog` | Green | Bouncy amphibian | Charged super-hop, lily-pad hopping, anchor **tether** (not an enemy-eating tongue) | Wide gaps, underwater passages, anchor ledges |
| **Dinosaur** | `dino` | Terracotta | Sturdy ground bruiser | Horn or ground-pound; breaks cracked blocks, trips heavy switches | Breakable walls, heavy plates, thorns |
| **Flying dinosaur** | `drake` (id only) | Sky blue | Airborne | Stamina-limited flap-glide, updraft riding | Sky islands, tall shafts |
| **Cheetah** | `cheetah` | Gold with spots | Speed | Sprint dash, steep-slope climb, long leap | Speed gates, crumbling bridges |

**There is no wolf. No fifth mount is committed.** More animals may come later, each with its own role and original design.

## 5.2 Personality and silhouette [PROPOSAL]

* Frog: bouncy and eager; puffs its throat; a wide, readable round silhouette.
* Dinosaur: calm and dependable; blocky shoulders, horn; steady trot.
* Flying dinosaur: aloof but gentle; large wing silhouette; glides.
* Cheetah: excited and sleek; low long body; gallop and dash.
Each must be unmistakable in silhouette at 256x224 and avoid resemblance to any existing creature (no green saddle dinosaur; the public hero art that showed a round mint-green mount was flagged for redesign in the GDD audit).

## 5.3 Art assets present

* Bare frames `mount_<m>/<anim>_<i>` and saddled `mountr_<m>/...`; anchors table `MOUNT_ANCHORS` gives per-frame seat pixel and suggested rider pose.
* Frog anims: idle, hop, jump, fall, land, charge, superjump, tongue (to be renamed `tether` in the proposal). Dino: idle, trot, jump, fall, land, charge, pound. Flying dinosaur: idle, flap, glide, jump, fall, land. Cheetah: idle, gallop, jump, fall, land, dash. All have summon_in and summon_out (three frames each).
* Weak spots for human polish: cheetah and dino legs are procedural; eyes on big mounts are tiny; hero legs mostly hidden when riding; summon frames are a cheap shrink plus puff.

## 5.4 Gameplay rules (all [PROPOSAL] except those tagged)

* Summon with ACTION anywhere in the open world [CONFIRMED]; short cooldown (OPEN); blocked in raids and instances unless the content's mount policy allows.
* Mount policy per level: `none | loaner | free`.
* A hit dismounts and starts a cooldown (no mount death); mount health is OPEN.
* Mounts add abilities and never replace the base moveset [CONFIRMED guardrail]. Standard and Classic races allow only level-provided loaners.

# 6. NPCs and future characters [PROPOSAL]

* Cat foremen and the dog boss (late update): see `LORE_BIBLE.md`. They use the same stout, outlined humanoid-or-animal-person look, and must be original.
* Keepers, shopkeepers and echo characters: small, friendly, humanoid or animal, one-line personalities.
* NPC dialogue obeys `TONE_AND_VOICE.md`.

# 7. Silhouette and color identity rules (checklist)

1. Silhouette distinct from every existing character or creature at 1x.
2. Color identity unique (see table: Sproutling plum and leaf, Zipwing teal and gold, Shardback slate and magenta, Frog green, Dino terracotta, Flying dinosaur sky blue, Cheetah gold and spots).
3. Dark hue-matched outline, never pure black; deepest ink `#2b2350`.
4. Flat hand-placed three-tone shading; light from top-left; highlights drift warm, shadows cool.
5. No noise, no anti-aliasing, no gradient, no dither on characters; no stray pixels (tests flag disconnected pieces).
6. One pixel scale everywhere.
7. Layer palette: 15 colors plus transparent per authored layer (SNES rule).
8. Poses: anticipation, overshoot, squash and stretch; run lean; expressive idle.
9. Readable at 256x224 against every region background.
10. Original: passes the "is it clone-adjacent?" check in `CHANGE_PROTOCOL.md`.

# 8. How to add a new one

## 8.1 New creator option

1. Draw the layer in `packages/art/src/characters/parts_*.ts`; add the name to `OPTION_NAMES` in `look.ts`. Counts flow automatically.
2. If the count crosses a power of two, the bit width changes and `encodeLook` codes change: bump `CharacterLook.v` and keep old decoding.
3. A new category: add to `CHARACTER_OPTIONS.categories` and `LOOK_FIELDS`; creator and validation pick it up automatically; the server needs no change.
4. New animation: add to `HERO_ANIMS` and map state in `apps/client/src/motion.ts`.
5. Run `npm run build:art -w @sbh/art`, tests (`npm test`) and view the previews.

## 8.2 New enemy species

1. Silhouette and color identity sheet; three states (move, defeat or curl, hurt) at minimum; stompable or not decided by the design (spiky = never).
2. Art in `enemies.ts` with `ENEMY_ANIMS`; sim behavior kind in `packages/sim/src/entities.ts` plus level glyph in `level.ts`; client view mapping in `enemy-view.ts`.
3. Update level legend docs and tests; keep deterministic.

## 8.3 New mount

1. Proposal first: role, ability, gate use, fairness (loaner/alternate), acquisition questline (friendly, free, never sold), art north star check.
2. Art with idle, move, jump, fall, land, ability, summon in/out; seat anchors; rider pose hints (`MOUNT_ANIMS`, `MOUNT_ANCHORS`).
3. Sim state and per-mount movement config; gate objects; protocol events (`../design/MOUNTS_AND_EXPLORATION.md` engineering implications).
4. Playtest gate: nine of ten average-skill testers finish its questline unassisted within the T2 window before it ships.
5. Anthony approves roster additions.

## 8.4 New NPC or character

Follow section 7, tone rules, and add the name to the naming list in `LORE_BIBLE.md`.
