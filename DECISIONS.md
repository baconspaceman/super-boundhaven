# Confirmed direction versus proposals

“Confirmed” means present in Bacon Spaceman's supplied brief, not technically validated or guaranteed for launch.

## Confirmed direction

- Provisional Super BoundHaven name; “Super” desired; no Bacon/Spaceman public branding.
- Independent platforming MMO; browser first, Steam later, cross-play intended.
- Polished 16-bit side-scrolling open world and real-time players.
- Precise movement, strong skill gap, replayability, fair but difficult platforming.
- Original mounts/creatures and many original powerups.
- Timing/precision, selective enemies, puzzle bosses; genuinely coordinated coop.
- Very hard raids requiring six or eight players as the intended range of minimum (resolved 2026-09-30: 8 players, see Owner answers below).
- Player-uploaded levels, weekly featured selection, familiar-level race/time-attack/speedrun events.
- Mirror and pursuing-threat variants, with combination safety unresolved.
- World themes and later cat construction-site/casino lore in the brief; launch scope unfixed.
- Tradeable useful items, functional gear/builds; difficult content possible with base movement at exceptional skill.
- Secrets, sharp visuals, subtle reference-inspired cosmetics with original identity.

## Ideas or tentative directions, not finalized policies

- Skill tree (resolved 2026-09-30: skill points plus mastery-by-use, free respecs).
- Microtransactions, optional monthly support, community funding goals and supporter names.
- Approximate Steam-fee funding target; no purchase permission or current-price verification.
- 1,000-download gift and million-player early-player reward; no amounts, terms, or eligibility finalized.
- Multi-model coding workflow, without a fixed stack.

## Recommendations prepared for Claude

- Start with a movement playground, a small shared region, then one coordinated challenge.
- Test latency and player collisions before world expansion.
- Original/licensed assets only; provenance records and rights review.
- Consider cosmetics-only monetization.
- Consider normalized/unequipped leaderboards and separate cosmetic/equipment slots.

## Still undecided

Engine, architecture, networking authority, account/security design, MVP, moderation/editor/validation, market model, currency/stats/sinks/crafting, paid power, launch regions, persistence, funding terms, reward eligibility, character/currency names.

No recommendation above becomes a confirmed decision until Bacon Spaceman accepts it. Record later decisions with date, rationale, and acceptance status.

## Accepted decisions log

Format: date — decision — rationale — status.

- 2026-10-06 — Camera: smooth follow with ground framing, look-ahead and zoom-out-only for nearby teammates (floor 0.7), described in `docs/CAMERA.md`; levels unchanged (open sky above, plain ground drawn below) — Bacon Spaceman's playtest request — accepted.
- 2026-10-06 — Developer-only items (Dev Crown, Comet Cape, Bacon Badge) and account-saved looks — Bacon Spaceman's request — accepted.
- 2026-10-06 — View is 16:9 widescreen, 480x270 native (30 x 16.9 tiles), integer-scaled where it fits (1080p = 4x); the hero sprite stays 24x32 so characters look ~17% smaller and the world bigger — Bacon Spaceman's playtest request; `?view=WxH` (e.g. 576x324) lets him compare sizes — accepted.
- 2026-10-06 — Interim names/accounts: a name can be taken; a guest keeps it 7 days and must renew; registering with an email (and password) keeps it for good; `baconspaceman` is a reserved developer account with in-game developer commands — Bacon Spaceman asked for it because there is no login provider yet; email verification and a real login provider stay open (see OPEN_QUESTIONS) — accepted as interim.
- 2026-09-30 — First proof is a shared (multiplayer) playground from day one, not local-only — Bacon Spaceman chose it over the recommended local-first path — accepted.
- 2026-09-30 — TypeScript end to end: Vite + PixiJS client, Node + `ws` authoritative server, shared deterministic `@sbh/sim` — browser-first delivery, fast iteration, one movement implementation for client and server — accepted.
- 2026-09-30 — Client prediction + server authority + reconciliation; remote players interpolated — precision platforming needs zero local input lag while staying cheat-resistant — accepted.
- 2026-09-30 — Players physically collide (stomp/bounce/push) in the shared playground — proves the hardest co-op netcode problem early — accepted.
- 2026-09-30 — Placeholder original art at 256x224 native with integer scaling — keep focus on feel — accepted.
- 2026-09-30 — Project is long-term and open-ended: no feature is "too big", no addition "too small"; architecture should stay extensible — Bacon Spaceman's stated intent — accepted.
- 2026-09-30 — Engineering workflow: Claude acts as head of development and delegates to parallel sub-agents with disjoint file ownership — Bacon Spaceman's request — accepted.

Technical notes: sim uses plain JS doubles (not fixed-point); revisit if a non-JS runtime must share the sim.

- 2026-09-30 — Mount roster is many animals with different abilities; first four: frog, dinosaur, flying dinosaur, cheetah; summonable in the open world anytime; some levels/areas require a specific mount (e.g. frog); open world has Metroidvania-style exploration with secrets and Easter eggs — Bacon Spaceman's words — confirmed direction. Ability/gate details are proposals in `docs/design/MOUNTS_AND_EXPLORATION.md` — not accepted.

- 2026-09-30 — Character creator is a Terraria-style layered humanoid customizer (not blocks/cubes); art keeps the Super Mario World essence with original designs (`docs/ART_NORTH_STAR.md`); Blender 3D→2D is an allowed tool if it meets that look — Bacon Spaceman's words — confirmed direction. Method (hand-authored vs Blender-rendered layers) pending research doc.
- 2026-09-30 — Master design doc written: `docs/design/GAME_DESIGN_DOCUMENT.md` (skill tree, abilities, powerups, mounts, gear, economy, co-op, progression, consistency audit, 15-question decision queue). Everything in it marked PROPOSAL/OPEN is not accepted until Bacon Spaceman says so.

## Owner answers and delegated decisions (2026-09-30)

Bacon Spaceman answered the open-question queue the same day. Tags: **CONFIRMED** = Bacon Spaceman's own answer; **ACCEPTED-DELEGATED** = Bacon Spaceman said "I'll let you decide" and Claude adopted its documented recommendation (revisable by Bacon Spaceman any time); **PROPOSAL, needs Bacon Spaceman** = money, legal exposure, real-world risk or irreversible public promises, never decided by delegation. Full queue and rationale: `docs/design/GAME_DESIGN_DOCUMENT.md` section 14.

### Bacon Spaceman's own answers (CONFIRMED)

- 2026-09-30 — No wolf mount. Roster stays exactly frog, dinosaur, flying dinosaur, cheetah; more animals may come later but a wolf is explicitly not planned now — Bacon Spaceman: wolf was not intended — **confirmed**.
- 2026-09-30 — Difficulty philosophy: challenging, but not too difficult when it gets too challenging; in particular **getting mounts must not be too difficult** — Bacon Spaceman: "I want things to be challenging, but when it's too challenging, don't make it too difficult" — **confirmed**; recorded as design pillar P8 and `docs/design/DIFFICULTY_PHILOSOPHY.md` (measurement targets there are ACCEPTED-DELEGATED).
- 2026-09-30 — Base moveset gains a **crouch/down button** (also drop-through for semi-solid platforms) and an **action/activate button** (switches, summon/dismount mount, use powerup). Inputs go from four to six — Bacon Spaceman said yes to both — **confirmed**.
- 2026-09-30 — Skill model is **both**: a skill-point tree and mastery-by-use unlocks, with **free respecs** ("free redos if you don't like your build"). Coexistence rules (no double-dipping, free instant respec, presets) in `docs/design/SKILL_TREE_AND_ABILITIES.md` section 6 — model choice **confirmed**; coexistence details and build order ACCEPTED-DELEGATED.
- 2026-09-30 — Raid size is **8 players** (standard hardest-raid group size; cap 8 unless later decided otherwise). Smaller co-op rooms are designed for 2 to 4. A raid needs 8; disconnect/recovery rules must support that — **confirmed** (supersedes the brief's "six or eight").
- 2026-09-30 — Character creator: add front/three-quarter face views to the creator preview (possibly a front-facing idle/portrait) and evaluate visually ("we'll see how that looks"); side-view faces remain for gameplay — **confirmed** direction, visual verdict pending.
- 2026-09-30 — Strictly original assets: no third-party assets, no third-party mocap — Bacon Spaceman accepted the recommendation — **confirmed**.
- 2026-09-30 — Open-source licensing: **yes**. Code under MIT; art, music, game content and docs under CC BY-NC-SA 4.0; the "Super BoundHaven" name and logo are reserved. The lead applies the LICENSE files; this log records the decision only — **confirmed**. (Note: BY-NC-SA 4.0 is non-commercial, so assets licensed this way cannot be reused commercially by others; Bacon Spaceman as copyright holder keeps full rights to his own work. Revisit before any monetization.)

### Delegated to Claude (ACCEPTED-DELEGATED; revisable by Bacon Spaceman any time)

- 2026-09-30 — Equipment/customization launch counts: about 8 headwear, 8 tops, 6 bottoms, 6 footwear, 4 back items and 4 accessories as gear-bearing items (about 36 total); everything else (hair, faces, skin, eyes, recolors, emotes, trails) cosmetic-only — modest launch scope, expandable ("no addition too small") — accepted-by-delegation.
- 2026-09-30 — Rulesets: Open / Standard / Classic, with Classic = normalized (unequipped) leaderboard — fair competition without banning builds from casual play — accepted-by-delegation.
- 2026-09-30 — Coyote time and jump buffer stay in the base moveset for everyone (shared feel settings, not stats) — fairness and forgiveness (matches P8) — accepted-by-delegation.
- 2026-09-30 — Failure model: instant retry, checkpoints on long levels, no punitive loss, raids by segment; no lives — matches Bacon Spaceman's difficulty answer — accepted-by-delegation.
- 2026-09-30 — Mount acquisition: a short, friendly, non-punishing questline per mount in its home region; free, permanent, never sold, never in the skill tree, never behind raids or brutal content; optional hard cosmetic/bonus challenges per mount — directly implements Bacon Spaceman's "mounts not too difficult" — accepted-by-delegation (the principle is confirmed).
- 2026-09-30 — Required mount gates always have a loaner or alternate route (G1) — never hard-lock a player — accepted-by-delegation.
- 2026-09-30 — No paid power: nothing purchasable with real money grants movement or ability power — protects the skill-first pillar and matches the no-pay-to-win rule — accepted-by-delegation. Monetization model, prices and supporter terms are still a proposal needing Bacon Spaceman.
- 2026-09-30 — Trading starts with atomic direct trade; market later — smaller attack surface for dupes/scams — accepted-by-delegation.
- 2026-09-30 — Persistence first: character look, unlocks, loadouts; guest play with later account linking — accepted-by-delegation. The login provider and privacy/age posture remain needing Bacon Spaceman.
- 2026-09-30 — Overworld: capped channels per region plus instances for dungeons/raids/races/levels; channel cap from M2 tests — accepted-by-delegation.
- 2026-09-30 — Gear power capped by the Movement Budget — protects the skill ceiling — accepted-by-delegation.
- 2026-09-30 — Level editor v1 is tile-only; weekly featured level is a hybrid (analytics shortlist, human pick), rewards cosmetic/recognition only with nothing promised — accepted-by-delegation. Moderation policy, terms of service and takedown handling still need Bacon Spaceman.
- 2026-09-30 — First content slice: Sunny Grassland, Crystal Caves, Clockwork Factory; Neon Bazaar City hub later — accepted-by-delegation.
- 2026-09-30 — Input devices: keyboard first, then gamepad; touch/mobile not a launch target — accepted-by-delegation.

### Still needing Bacon Spaceman (PROPOSAL, not decided)

- Monetization model, prices, supporter-tier terms, community-goal promises, Steam-fee funding target.
- 1,000-download gift and million-player early reward (amounts, terms, eligibility), any dated promise or launch date.
- Casino/cat-lore mechanics beyond "no real-money gambling, non-cashable tokens, no loot boxes" (the guardrail itself is a standing rule).
- Account login provider, privacy policy, age band and chat posture (interim development default: quick-chat only, no free text).
- Moderation policy, terms of service, DMCA/takedown handling for uploaded levels; weekly-reward specifics.
- Final title and legal clearance; currency and character names.
- Whether to keep the BY-NC-SA terms once any monetization is approved.

- 2026-09-30 — Character production method: hand-authored layered pixel art is the shipping look; Blender is a helper (pose reference, retiming, per-frame fit masks) — recommended by `docs/research/CHARACTER_BLENDER_TO_2D.md` (E+) and adopted by Claude as the working plan so work can continue — NOT yet confirmed by Bacon Spaceman; reversible. Open questions for him: front/three-quarter faces, equipment slot/item counts at launch, many weapon attack animations, any third-party mocap/asset use (recommend none).
