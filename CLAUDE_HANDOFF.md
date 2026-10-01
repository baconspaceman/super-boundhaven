# Claude handoff and recommended first milestones

> **Update 2026-09-30:** Milestones 1 and 2 were merged into a shared-from-day-one playground and are implemented as a prototype (see `docs/NEXT_ACTION.md`, `DECISIONS.md`, and the spec in `docs/superpowers/specs/`). A SBH codebase now exists in this folder. Milestone 3 (one coordinated co-op challenge) is next after the polish items.

This is a proposed starting sequence, not approved implementation scope. Read `README.md`, `DESIGN_BRIEF.md`, `DECISIONS.md`, and `OPEN_QUESTIONS.md` first. SBH is unrelated to other projects. No existing SBH codebase was located; do not report this folder as one.

## Start here

Confirm the smallest playable goal with Anthony. Present a short engine/networking comparison based on browser delivery, later Steam cross-play, precise movement, tooling, and operational cost. Record accepted decisions and assumptions before making broad architectural commitments. Keep later MMO/world/economy ambitions visible without building all of them into the first proof.

## Milestone 1: movement playground

Recommended proof: original movement with acceleration/deceleration, momentum, variable jump height, air control, slopes, and bounces. Tune with a small set of repeatable jump/landing challenges and recorded parameters. Research desired SMW behavior lawfully; do not import Nintendo code/assets/ROMs into SBH.

Suggested evidence: Anthony playtests responsive control, repeatable trajectories, consistent slope/contact behavior, and recoverable failure. Document simulation timestep, tuning values, inputs, and observed edge cases. Coyote time, jump buffering, and assist settings are options to evaluate, not confirmed requirements.

## Milestone 2: small shared region

Recommended proof: a polished small original region with real-time peers. Choose explicit prototype player-count and performance targets rather than claiming MMO scale. Validate latency, jitter, lost packets, reconnects, authority/reconciliation, and player collisions before expanding.

Suggested evidence: two or more test clients see coherent motion; collision/bounce outcomes remain explainable under the agreed latency envelope; reconnect and failure handling do not corrupt authoritative state. Document limitations honestly. Browser-first and later Steam cross-play must inform architecture; Steam launch is not this milestone.

## Milestone 3: one coordinated challenge

Recommended proof: a short cooperative room with actions that truly require partners, such as coordinated switches and player bounces. Select a small prototype group size explicitly; it does not settle the six/eight-player raid minimum.

Suggested evidence: the intended solution requires coordination, retry cost is acceptable, disconnects have a defined outcome, and timing remains fair under the tested network conditions. Use a puzzle boss only if it strengthens this proof.

## After the proof

Review movement and coop playtest evidence before committing to MMO scope. Prioritize persistence/account/security foundations, economy integrity, level editor/moderation, competitive fairness, and production art based on accepted requirements. Do not declare a launch date, reward terms, monetization policy, raid cap, or complete world list without decisions.

## Working boundaries for this handoff

Preparation authorized documents and placement only. This session did not code, launch/message Claude, publish, buy, or create accounts. Obtain Anthony's implementation instructions in the next session. Preserve unrelated work. Use original/licensed assets and document sources. Never inherit monetization rules from other projects. Keep confirmed versus proposed status explicit as decisions evolve.
