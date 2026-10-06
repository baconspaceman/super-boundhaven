# Open questions

> **Update 2026-09-30 (second pass):** Bacon Spaceman answered the queue. Answered items are in the Answered section below with a pointer to `DECISIONS.md`. Items he delegated to Claude are marked ACCEPTED-DELEGATED (revisable by him any time). Only items involving money, legal exposure, real-world risk or public promises remain open. Full queue: `docs/design/GAME_DESIGN_DOCUMENT.md` section 14.

Claude can research options and present tradeoffs; do not silently convert defaults into accepted requirements.

## Still open (needs Bacon Spaceman)

- Monetization model, prices, optional monthly support terms, community goals, supporter names/consent, Steam-fee target. (Principle accepted: no paid power; cosmetics-only.)
- Early-player/download rewards (amounts, terms, eligibility, how counted); any launch date or dated promise.
- Casino/cat-lore mechanics beyond the standing guardrail (no real-money gambling, non-cashable tokens, no loot boxes).
- Account identity: login provider (Google, email, guest-then-link), privacy, age band, chat posture. Interim development default: quick-chat only, no free text.
- Moderation, terms of service and takedown handling for uploaded levels; weekly featured rewards specifics.
- Final title, legal/name clearance, character and currency names.
- Whether the BY-NC-SA 4.0 content license should change once monetization is approved.
- Visual verdict on front/three-quarter faces after the creator preview is built (Bacon Spaceman: "we'll see how that looks").
- Pure engineering unknowns (measured later, not Bacon Spaceman's call): channel cap per region, sync windows at 8 players, exact numbers in Movement Budget and mastery tiers.
- Mounts and exploration still unresolved in detail: summon cooldown/stamina, mount health, passengers, mounts in races, map/discovery UI scope, Easter-egg framework scope (working proposals in `docs/design/MOUNTS_AND_EXPLORATION.md`).

## Answered

### Answered by Bacon Spaceman (2026-09-30, CONFIRMED)

- Wolf mount? **No.** Roster is frog, dinosaur, flying dinosaur, cheetah; more animals later but no wolf planned.
- Difficulty? **Challenging but not too difficult; mounts must not be hard to get.** See `docs/design/DIFFICULTY_PHILOSOPHY.md`.
- Crouch and action buttons? **Yes, both** (six inputs).
- Skill model? **Both** points tree and mastery-by-use, **free respecs**.
- Raid size? **8 players**; smaller co-op rooms for 2 to 4.
- Character creator faces? Add front/three-quarter preview views, evaluate; side-view faces stay in gameplay. Launch equipment counts delegated to Claude.
- Third-party assets/mocap? **None; strictly original.**
- Open-source license? **Yes**: MIT for code; CC BY-NC-SA 4.0 for art, music, content, docs; name and logo reserved.

### Delegated to Claude (ACCEPTED-DELEGATED, 2026-09-30)

- Fair-play rulesets (Open/Standard/Classic, Classic normalized); coyote/buffer in base; failure and checkpoints (instant retry, checkpoints, raids by segment); mount acquisition (friendly questline, free, never sold); required mount gates always have an alternate or loaner; no paid power; trading (atomic direct trade first); persistence first (look, unlocks, loadouts; guest then link); overworld (channels plus instances); gear power cap (Movement Budget); editor v1 tile-only with hybrid weekly pick; first content slice (Grassland, Caves, Factory); input devices (keyboard, then gamepad; no touch at launch); equipment launch counts.

### Earlier answers (see `DECISIONS.md`)

- First proof: shared multiplayer movement playground. Stack: TypeScript end to end. Netcode: prediction + server authority + reconciliation, physical player collision.
- Art pipeline: hand-authored layered pixel art; Blender as helper only.
- Model division of labor: Claude as head of development with disjoint-ownership sub-agents.
