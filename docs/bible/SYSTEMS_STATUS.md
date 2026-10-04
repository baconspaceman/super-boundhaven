<!-- core:start -->
# Systems status table

Every design system, with an honest implementation status verified against the repository and docs when this bible was written (bible v1.0).

Status key: **Implemented** (works end to end, tested), **Prototype** (works but small, rough or partial), **Art only** (assets exist, no gameplay), **Planned** (design accepted or confirmed direction, no code), **Proposal** (design suggested, awaiting Anthony).

**Implemented or prototype today.** Deterministic movement simulation shared by client, server and website (walk, run, skid, variable jump, run-jump bonus, coyote time, jump buffer, 45 degree slopes, bounce pads, stomp-bounce, player push, crouch, one-way platforms, spikes). Six-bit input mask. Milestone 3 rules layer: checkpoints, shards, three enemy kinds, levers, plates, doors, the "Twin Plates" co-op room (2 to 4 players) with disconnect and reset rules, proven by scripted-bot tests. Authoritative Node and ws server at 60 Hz with 20 Hz snapshots, protocol v3, prediction, reconciliation and interpolation, token re-attach with a 10-second grace. Layered character creator with look codes and server validation. World art for Sunny Grassland and Crystal Caves (three tilesets, parallax, props, gameplay objects) and Blender dawn/day/sunset/night backdrops. Keyboard and gamepad controls with remapping, glyphs and rumble. Marketing site with a gameplay reel that replays the real simulation, and a docs portal.

**Art only.** Mounts (four sprite sheets with summon frames and rider anchors), three enemy species (also behave in the sim), effects kit, pixel font.

**Not started.** Mount gameplay, per-player MovementProfile and rulesets, powerups, skill tree, mastery, gear, economy and trading, map and secrets, persistence and accounts, level editor and validation, events, raids, audio, chat, hosted server, Steam.

For exact numeric mechanics, see `../mechanics/`.
<!-- core:end -->

# 1. Master table

Paths are relative to the repository root.

| System | Design status | Implementation | Where it lives (or will live) | Notes |
|---|---|---|---|---|
| Deterministic movement sim (walk, run, skid, variable jump) | CONFIRMED direction | **Implemented** | `packages/sim/src/{step,player,config,types}.ts`; tests in `packages/sim/test/` | Plain JS doubles; original tuning; revisit fixed-point only if a non-JS runtime must share it |
| Coyote time (5 ticks) and jump buffer (6 ticks) | ACCEPTED-DELEGATED (base for all) | **Implemented** | `packages/sim/src/config.ts` | Shared feel, not a stat |
| Slopes (45 degrees), bounce pads | CONFIRMED | **Implemented** | `packages/sim/src/step.ts`; level glyphs `/`, `\`, `B` | Pad: tap about 3 tiles, held about 9.5 (continuous approximation) |
| Stomp-bounce on players, soft push | CONFIRMED | **Implemented** | `packages/sim/src/step.ts` | The co-op primitive |
| Six inputs incl. crouch and action | CONFIRMED | **Implemented** | `packages/sim/src/types.ts` (`BTN`, `BTN_MASK = 63`) | Action currently pulls levers; mount and powerup uses planned |
| Crouch hitbox (28 to 16), drop-through one-way platforms | CONFIRMED | **Implemented** | `packages/sim/src/{player,step}.ts` | No dedicated crouch art frame (uses land squash) |
| Checkpoints (per player), shards, spikes, hurt and respawn | ACCEPTED-DELEGATED failure model | **Implemented** in the sim for any level that places the glyphs (exercised by the co-op room) | `packages/sim/src/{entities,player,level}.ts` | No lives, no loss; 90 ticks invulnerability |
| Enemies (walker, flyer, spiky walker) | CONFIRMED (selective enemies) | **Implemented** (3 kinds); art done | `packages/sim/src/entities.ts`; `packages/art/src/characters/enemies.ts`; `apps/client/src/enemy-view.ts` | No chasers, shooters or bosses |
| Levers, plates, doors, timers, reset lever | CONFIRMED (co-op needs coordination) | **Implemented** | `packages/sim/src/{entities,level}.ts`; `levels/coopRoom.ts` | Doors never close on a player |
| Twin Plates co-op room (2 to 4 players) | CONFIRMED size | **Implemented** | `packages/sim/src/levels/coopRoom.ts`; `packages/sim/test/{coop,m3}.test.ts`; `docs/design/COOP_ROOM_M3.md` | Solvability proven by bot tests; run with server `levelName: 'coopRoom'` or `SBH_LEVEL=coopRoom` |
| Playground level | Built as proof | **Implemented** | `packages/sim/src/levels/playground.ts` | 5-tile pit, 4-tile wall, 6-tile co-op wall |
| Level registry | Part of editor path | **Implemented** | `packages/sim/src/levels/registry.ts` | `LEVELS`, `getLevel` |
| Protocol v3 | CONFIRMED stack | **Implemented** | `packages/protocol/src/{index,look,world}.ts`; `docs/NETCODE.md` | JSON over ws; max 1 KB frames |
| Authoritative server (60 Hz, 20 Hz snapshots) | CONFIRMED | **Implemented** (prototype scale) | `apps/server/src/{server,index}.ts`; tests in `apps/server/test/` | `MAX_PLAYERS` 16; 10 s reconnect grace; no persistence |
| Client prediction, reconciliation, interpolation | CONFIRMED | **Implemented** | `apps/client/src/{game,net,main}.ts` | Predicts only the local player against static geometry plus door state; stomp kills not predicted |
| Player collision (stomp, bounce, push) | CONFIRMED | **Implemented** | `packages/sim` | Prediction gap on player bounces (corrected by snapshots) |
| Hosted online server | No decision | **Not available** | none | Run locally; public Pages build has no game server |
| Layered character creator | CONFIRMED | **Implemented** | `apps/client/src/{creator.ts,creator.css,look-ui.ts,look-sheet.ts}`; `packages/art/src/characters/{look,paperdoll,parts_*}.ts` | 20-char look codes; sync via `look` messages |
| Front and three-quarter creator faces | CONFIRMED direction, verdict OPEN | **Planned** | `packages/art/src/characters` (future) | Side-view faces stay |
| Hero animation set | CONFIRMED | **Implemented** | `packages/art/src/characters/anims.ts`; `apps/client/src/motion.ts` | Missing crouch, emotes, attacks |
| Enemy, effects and font art | CONFIRMED | **Implemented** | `packages/art/src/characters/{enemies,fx,font}.ts` | |
| World art: Sunny Grassland, Crystal Caves | CONFIRMED regions | **Implemented** (art) | `packages/art/src/world/`; `apps/client/src/{world-art,world-objects,tod-art}.ts` | Three tilesets (meadow, meadow_sunset, caverns) |
| Time of day (dawn, day, sunset, night) | CONFIRMED visual direction; gameplay role OPEN | **Prototype** | `packages/art/src/blender/`; `tools/blender/`; `?tod=` flag | Cosmetic only |
| Other twelve regions | CONFIRMED themes | **Planned** (concept sketches only) | `apps/site/` concept art | Name only |
| Gameplay-object art (gates, plates, levers, spikes, flags, shards) | CONFIRMED | **Implemented** | `packages/art/src/world/objects.ts`; `docs/ART_OBJECTS.md` | Gold/cyan/coral language |
| Keyboard and gamepad controls, remapping, glyphs, rumble | CONFIRMED (controller support required) | **Implemented** | `apps/client/src/{input,bindings,gamepad,glyphs,controls-ui,rumble}.ts`; `docs/CONTROLS.md` | Non-standard pads unverified on hardware |
| Pause menu and controls screen | Built | **Implemented** | `apps/client/src/controls-ui.ts` | |
| Reconnect and disconnect handling | ACCEPTED-DELEGATED | **Implemented** (small scale) | `apps/server/src/server.ts` | `away` state; 30 s raid pause is Planned |
| Public marketing site and gameplay reel | n/a | **Implemented** | `apps/site/`; `tools/docs-site/` | Reel replays real sim output |
| Docs portal and link checker, pre-publish audit | n/a | **Implemented** | `tools/docs-site/`, `tools/audit/` | CI in `.github/workflows/` |
| Blender pipeline (procedural backdrops and props) | CONFIRMED allowed as helper | **Implemented** | `tools/blender/`; `docs/ART_BLENDER_PIPELINE.md` | Rendered PNGs are committed |
| Mounts: art | CONFIRMED roster | **Art only** | `packages/art/src/characters/mounts.ts` | Bare and saddled, summon frames, seat anchors |
| Mount gameplay (summon, gates, abilities) | CONFIRMED direction; abilities PROPOSAL | **Planned** | `packages/sim` (future `mount` state); `docs/design/MOUNTS_AND_EXPLORATION.md` | Needs gate objects and level format extension |
| Mount questlines | ACCEPTED-DELEGATED | **Planned** | future | 9-of-10 playtest gate |
| Gates (mount, ability, switch, co-op, skill, knowledge) | PROPOSAL (G1 to G9 ACCEPTED-DELEGATED) | **Planned** (switch and co-op gates exist as doors) | `packages/sim/src/entities.ts` (partial) | |
| Zone graph, map and discovery, waypoints | PROPOSAL | **Planned** | future | |
| Secrets and Easter-egg framework | CONFIRMED direction | **Planned** | future (`SecretDef`) | |
| Per-player MovementProfile and Movement Budget | ACCEPTED-DELEGATED (budget) | **Planned** | `packages/sim` (`stepPlayer` already takes `cfg`) | Numbers live in `docs/mechanics/` |
| Rulesets Open / Standard / Classic | ACCEPTED-DELEGATED | **Planned** | future | |
| Powerups (16 concepts) | PROPOSAL | **Proposal** | `docs/design/GAME_DESIGN_DOCUMENT.md` section 3.3 | |
| Skill tree (points) | CONFIRMED model | **Planned** | `docs/design/SKILL_TREE_AND_ABILITIES.md` | Mastery layer first |
| Mastery-by-use | CONFIRMED model | **Planned** | same | |
| Free respec and presets | CONFIRMED / ACCEPTED-DELEGATED | **Planned** | same | |
| Gear and loadouts | CONFIRMED | **Planned** | future | About 36 launch items |
| Economy, crafting, direct trade, market | ACCEPTED-DELEGATED (trade first) | **Planned** | future | Atomic trades, ledger |
| Persistence | ACCEPTED-DELEGATED | **Prototype** (look and name in `localStorage` only; server keeps sessions in memory for 10 s) | `apps/client/src/creator.ts` | No DB |
| Accounts and login | OPEN | **Not started** | none | Provider undecided |
| Chat and safety tools | OPEN (interim quick-chat) | **Not started** | none | No chat message exists in the protocol |
| Level editor, validator, base-route proof | CONFIRMED uploads; ACCEPTED-DELEGATED v1 tile-only | **Planned** | future | ASCII `Level` format exists |
| Weekly featured, races, time attacks, leaderboards | CONFIRMED | **Planned** | future | |
| Mirror and pursuer variants | CONFIRMED desired | **Planned** | future | Safety matrix is a proposal |
| Raids (8 players) | CONFIRMED | **Planned** | `docs/design/COOP_ROOM_M3.md` section 6 | Needs 8-client netcode stress test |
| Puzzle bosses | CONFIRMED direction | **Planned** | future | Five concepts proposed |
| Audio (music and SFX) | PROPOSAL | **Not started** | none (no audio code) | `AUDIO_DIRECTION.md` |
| Accessibility assists, reduced motion, colorblind palette | ACCEPTED-DELEGATED (assists) | **Planned** | future | No reduced-motion handling today |
| Localization | none | **Not started** | none | |
| Steam build and cross-play | CONFIRMED direction | **Planned** | future | |
| Cat construction site and casino | CONFIRMED lore | **Planned (lore only)** | `LORE_BIBLE.md` | Far later; no real-money gambling |
| Monetization, supporter tiers, community goals | OPEN | **Proposal / OPEN** | none | Private; not part of the bible |
| Telemetry for playtests | ACCEPTED-DELEGATED (local, consented) | **Not started** | none | No analytics or trackers today |

# 2. What the tests cover (high level)

* `packages/sim/test`: movement sim (`sim.test.ts`), Milestone 3 rules (`m3.test.ts`), co-op room solvability with bots (`coop.test.ts`).
* `apps/server/test`: server behavior, look validation, co-op, waitlist.
* `apps/client/test`: motion state machine, input bindings, gamepad mapping, scene logic.
* `packages/art`: art and manifest tests (disconnected-pixel checks, manifests).
* Verification commands: `npm test`, `npm run typecheck`; before publishing, `npm run audit`.
* Not verified: real-hardware gamepad feel for non-standard pads, large-crowd netcode, 8-player sync.

# 3. Known polish gaps (from the repo's handoff docs)

Dedicated hero crouch frame; lever art low contrast; idle flag too grey; ACTION prompt overlaps name tag; enemy hitbox versus sprite size; spikes read too white; open-gate frame abstract; stomp kills not predicted (about a 50 ms hitch); sunset tileset is an automatic palette grade; hero faces small at 1x; procedural mount legs need hand cleanup. See `../NEXT_ACTION.md` and the art docs' weakness lists.

# 4. Status honesty rules

* Public copy must say Planned or Later for anything not in this table's Implemented or Prototype rows.
* Update this table in the same change that builds, removes or renames a system (`CHANGE_PROTOCOL.md`).
* When code and docs disagree, code is the truth about what is built; record the doc fix in the canon register.
