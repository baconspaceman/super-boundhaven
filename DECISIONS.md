# Confirmed direction versus proposals

“Confirmed” means present in Anthony's supplied brief, not technically validated or guaranteed for launch.

## Confirmed direction

- Provisional Super BoundHaven name; “Super” desired; no Bacon/Spaceman public branding.
- Independent platforming MMO; browser first, Steam later, cross-play intended.
- Polished 16-bit side-scrolling open world and real-time players.
- Precise movement, strong skill gap, replayability, fair but difficult platforming.
- Original mounts/creatures and many original powerups.
- Timing/precision, selective enemies, puzzle bosses; genuinely coordinated coop.
- Very hard raids requiring six or eight players as the intended range of minimum; exact minimum/cap unresolved.
- Player-uploaded levels, weekly featured selection, familiar-level race/time-attack/speedrun events.
- Mirror and pursuing-threat variants, with combination safety unresolved.
- World themes and later cat construction-site/casino lore in the brief; launch scope unfixed.
- Tradeable useful items, functional gear/builds; difficult content possible with base movement at exceptional skill.
- Secrets, sharp visuals, subtle reference-inspired cosmetics with original identity.

## Ideas or tentative directions, not finalized policies

- Skill tree.
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

Engine, architecture, networking authority, account/security design, MVP, platform/input targets, exact raid sizes, moderation/editor/validation, market model, currency/stats/sinks/crafting, paid power, launch regions, persistence, funding terms, reward eligibility, character/currency names.

No recommendation above becomes a confirmed decision until Anthony accepts it. Record later decisions with date, rationale, and acceptance status.

## Accepted decisions log

Format: date — decision — rationale — status.

- 2026-09-30 — First proof is a shared (multiplayer) playground from day one, not local-only — Anthony chose it over the recommended local-first path — accepted.
- 2026-09-30 — TypeScript end to end: Vite + PixiJS client, Node + `ws` authoritative server, shared deterministic `@sbh/sim` — browser-first delivery, fast iteration, one movement implementation for client and server — accepted.
- 2026-09-30 — Client prediction + server authority + reconciliation; remote players interpolated — precision platforming needs zero local input lag while staying cheat-resistant — accepted.
- 2026-09-30 — Players physically collide (stomp/bounce/push) in the shared playground — proves the hardest co-op netcode problem early — accepted.
- 2026-09-30 — Placeholder original art at 256x224 native with integer scaling — keep focus on feel — accepted.
- 2026-09-30 — Project is long-term and open-ended: no feature is "too big", no addition "too small"; architecture should stay extensible — Anthony's stated intent — accepted.
- 2026-09-30 — Engineering workflow: Claude acts as head of development and delegates to parallel sub-agents with disjoint file ownership — Anthony's request — accepted.

Technical notes: sim uses plain JS doubles (not fixed-point); revisit if a non-JS runtime must share the sim.

- 2026-09-30 — Mount roster is many animals with different abilities; first four: frog, dinosaur, flying dinosaur, cheetah; summonable in the open world anytime; some levels/areas require a specific mount (e.g. frog); open world has Metroidvania-style exploration with secrets and Easter eggs — Anthony's words — confirmed direction. Ability/gate details are proposals in `docs/design/MOUNTS_AND_EXPLORATION.md` — not accepted.

- 2026-09-30 — Character creator is a Terraria-style layered humanoid customizer (not blocks/cubes); art keeps the Super Mario World essence with original designs (`docs/ART_NORTH_STAR.md`); Blender 3D→2D is an allowed tool if it meets that look — Anthony's words — confirmed direction. Method (hand-authored vs Blender-rendered layers) pending research doc.
- 2026-09-30 — Master design doc written: `docs/design/GAME_DESIGN_DOCUMENT.md` (skill tree, abilities, powerups, mounts, gear, economy, co-op, progression, consistency audit, 15-question decision queue). Everything in it marked PROPOSAL/OPEN is not accepted until Anthony says so.

- 2026-09-30 — Character production method: hand-authored layered pixel art is the shipping look; Blender is a helper (pose reference, retiming, per-frame fit masks) — recommended by `docs/research/CHARACTER_BLENDER_TO_2D.md` (E+) and adopted by Claude as the working plan so work can continue — NOT yet confirmed by Anthony; reversible. Open questions for him: front/three-quarter faces, equipment slot/item counts at launch, many weapon attack animations, any third-party mocap/asset use (recommend none).
