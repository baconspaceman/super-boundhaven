# SBH Milestone 1: shared movement playground — design

Status: approved by Bacon Spaceman 2026-09-30 (conversation). Scope: Milestone 1+2 hybrid from `CLAUDE_HANDOFF.md` — movement playground that is shared/real-time from day one.

## Accepted decisions

| Decision | Choice |
|---|---|
| First proof | Shared playground immediately (movement + real-time peers) |
| Stack | TypeScript end to end: Vite + PixiJS client, Node + `ws` authoritative server |
| Netcode | Client prediction + server authority + reconciliation; remote players interpolated |
| Player collision | Yes: players can stomp/bounce off each other and push apart |
| Art / resolution | Simple original placeholders, 256x224 native, integer scaling |

## Architecture

npm-workspaces monorepo:

- `packages/sim` — pure deterministic simulation (no DOM/Node). Movement, tile collision (solid, 45° slopes, bounce pads), player-vs-player stomp and push. Shared by client and server.
- `packages/protocol` — message types (JSON for now).
- `apps/server` — fixed 60 Hz tick, consumes one queued input per player per tick, snapshots at 20 Hz, token-based reconnect (10 s grace).
- `apps/client` — Vite + PixiJS; fixed-step prediction, server reconciliation with error smoothing, 100 ms snapshot interpolation, debug HUD, `?lag=&loss=` simulator.

Units: pixels and pixels/tick at 60 Hz. Tile = 16 px. Player hitbox 14x28 (halfWidth 7, height 28; matches the 24x32 humanoid sprite, feet at bottom-center) (x = center, y = feet). All tuning lives in `packages/sim/src/config.ts`.

Determinism: plain JS doubles (+,-,*,/ are IEEE-exact across V8), not fixed-point. Revisit if a non-JS runtime ever needs to share the sim.

## Movement (original tuning)

Acceleration/deceleration, skid on reversal, walk vs run top speed, momentum preserved in air, variable jump height (low gravity while held and rising), small speed bonus on jump, coyote time (5 ticks) and jump buffer (6 ticks) as config values to A/B, 45° slopes with snap-down, bounce pads (higher when jump held), stomp bounces off other players (higher when jump held), soft side push between players, respawn on falling out of the level.

Skill gates built into the test level: a 5-tile pit needs a run-jump; a 4-tile wall needs a run-jump; a 6-tile wall cannot be cleared solo but can with a friend-stomp.

## Out of scope for this milestone

Accounts, persistence, items, economy, level editor/upload, co-op challenge room (Milestone 3), Steam, touch/mobile, real art.

## Known limitations

- Client predicts only the local player against static level geometry; bounces off other players appear after server correction (smoothed).
- JSON messages, no delta compression.
- Input queue overflow drops inputs (corrected by reconciliation).

## Provenance

All movement numbers and level layouts are original. No Nintendo code, assets, ROMs or extracted data were used. Any future SMW reference study must be logged here with source and use.
