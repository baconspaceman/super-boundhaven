<!-- core:start -->
**P2 Co-op rooms to the 8-player raid prototype (M3 hardening, M13 prototype).** Goal: prove that coordination-required play is fun and fair at real latency, then scale from the 2-4 player Twin Plates room to an 8-player raid room (cap 8, decided by Anthony). Scope: automated bot solvers for Twin Plates at 2/3/4 players under latency, sync-window fairness tests (8 to 12 tick windows proposed in GDD 12.1), a second co-op room with a different mechanic, multi-room server architecture (today one level per server process, 16-player cap), party/join-by-code, disconnect/dropout/replacement rules for 8 players (spare-player rule: required count at most players minus 1), raid room format (`need` counts, multi-gate, segment checkpoints), a placeholder 8-player raid room, 8-bot stress test, first puzzle boss, deterministic replay recorder. Entry: P1 exit (RM-017 envelope exists). Exit: raid prototype cleared by a bot team and by Anthony plus friends at tested latency; retry cost acceptable; no deadlock under any single disconnect. Risks: bounce-chain co-op may be latency-fragile (fallback: widen windows, use switches over timing); room manager touches server core. Leads: Claude (design, rooms), Codex (instances, party, replay), Grokbot (bot playtests, stress). Size: XL.
<!-- core:end -->

# P2 Co-op rooms and raid prototype

| ID | Item | Status | Owner | Size | Acceptance |
|---|---|---|---|---|---|
| RM-030 | Bot solvers for Twin Plates over real WebSocket at 2/3/4 players with injected latency | Next | Grokbot | M | Bots clear the room end-to-end in CI-able script; JSON report with clear time, deaths, resets |
| RM-031 | Sync-window fairness test: stomp/plate holds at 0/80/150/250 ms RTT | Next | Codex + Grokbot | M | Table of pass/fail per RTT; recommended window ticks recorded in `docs/NETCODE.md` |
| RM-032 | Second co-op room with a different mechanic (timed levers or bounce chain) | Later | Claude | M | New level in registry; scripted solvability tests for each allowed player count |
| RM-033 | Multi-room server: several levels/instances per process, room registry, per-room caps | Later | Codex | L | Two rooms concurrently on one process; isolation tests; `welcome.level` per room |
| RM-034 | Dropout/replacement rules for 8 players (reconnect token grace, spare player, segment reset) | Later | Claude + Codex | M | Rules in `COOP_ROOM_M3.md` successor; tests kill any one of 8 mid-puzzle without stall |
| RM-035 | Raid room format: `need` counts, multi-gate, segment checkpoints, per-player checkpoints | Later | Claude | L | Level schema extended; format doc; validator test |
| RM-036 | 8-player raid prototype room (placeholder art allowed, labelled) | Later | Claude | L | Cleared by 8 scripted bots (RM-037) and 1 human playtest; spare-player rule holds |
| RM-037 | 8-bot stress/playtest of raid prototype | Later | Grokbot | M | Report: clear rate, desyncs, server tick budget at 8 clients |
| RM-038 | First puzzle boss (original concept from GDD 7.5) | Later | Claude | L | Needs coordination, solvable by bots, checkpoint per phase |
| RM-039 | Party / join-by-code / invite link | Later | Codex | M | Create/join party; room assignment test; no accounts required (guest) |
| RM-040 | Deterministic input-replay recorder and re-sim harness | Later | Codex | L | Record inputs per client; re-sim matches server state hash; reused by RM-059, RM-112 |

Open engineering unknowns (measured, not Anthony's call): channel cap, sync windows at 8 players.
