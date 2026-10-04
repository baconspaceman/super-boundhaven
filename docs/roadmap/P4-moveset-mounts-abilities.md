<!-- core:start -->
**P4 Moveset, mounts and abilities (M4 residual, M5, M6).** Goal: deepen movement without breaking the base feel. The six-input base moveset (crouch/drop-through and action) is already in the sim; what remains is per-player `MovementProfile` (stepPlayer already accepts a `cfg`), the Movement Budget and fair-play rulesets (Open/Standard/Classic, Classic normalised), the frog mount prototype (proposal-labelled), a general mount framework (summon, mount physics, gates G1 to G8, loaner so required-path gates never hard-lock), the remaining mounts (dinosaur, flying dinosaur, cheetah; no wolf), a friendly free mount questline, 3 to 4 powerups, and an entity layer for level objects beyond tiles (updrafts, breakables, conveyors, crumbling). Entry: P1 exit; P2 learnings on sync. Exit: frog gate is fun and cannot hard-lock; determinism tests for mount state; fairness tests; Classic board works. Dependencies: P3 persistence for unlock storage (can prototype with session state). Risks: power creep, mount hard-locks, determinism in new state. Lead: Claude; Codex reviews determinism, leaderboards and server rules; Grokbot supplies balance simulations. Size: XL. Mechanics docs by other agents live under `docs/mechanics/` (path not owned by this roadmap).
<!-- core:end -->

# P4 Moveset, mounts, abilities

| ID | Item | Status | Owner | Size | Acceptance |
|---|---|---|---|---|---|
| RM-070 | Per-player `MovementProfile` plumbed through sim, protocol (hash), server resolution | Next | Claude + Codex | M | Two players with different profiles stay deterministic client/server; hash mismatch rejected |
| RM-071 | Frog mount prototype, proposal-labelled in UI and docs | Later | Claude | L | Summon, ride, one frog gate, loaner; determinism and no-hard-lock tests |
| RM-072 | Mount framework: state on `PlayerState`, per-mount configs, summon rules, gate types G1 to G8 per `docs/design/MOUNTS_AND_EXPLORATION.md` | Later | Claude | L | Framework supports 2nd mount without sim rewrite; gate checklist in playtest doc |
| RM-073 | Dinosaur, flying dinosaur, cheetah gameplay (art sheets already exist) | Later | Claude | XL | One gate per mount, alternate path or loaner for each |
| RM-074 | Mount questlines: short, friendly, free, never sold, never behind raids | Later | Claude | L | Quest content + test that each mount is obtainable solo |
| RM-075 | Powerups (3 to 4 originals from GDD 3.3) | Later | Claude | L | Server-spawned only; timed state deterministic; fairness tests |
| RM-076 | Movement Budget + rulesets Open/Standard/Classic | Later | Claude + Codex | L | Budget caps enforced server-side; Classic normalises loadouts |
| RM-077 | Level object layer: updrafts, breakables, crumbling, conveyors, semi-solid variants, anchors | Later | Claude | L | Each object has sim step, art, net state, tests |
| RM-078 | Classic leaderboard (normalised ruleset, replay-backed) | Later | Codex | M | Board rejects non-Classic runs; uses RM-040 |
| RM-079 | Mount animation and effect completion (sprites exist; mounted-rider composition) | Later | Claude | M | Rider layers composite on all four mounts; art test |
