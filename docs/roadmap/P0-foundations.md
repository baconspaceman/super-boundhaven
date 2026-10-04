<!-- core:start -->
**P0 Foundations: DONE.** Everything the project stands on today, verified against the repo at commit `cff9c4c` (241 tests in 17 files pass, `npx vitest run`, 2026-10-04): deterministic shared sim (`packages/sim`), protocol v3 and authoritative WebSocket server (`apps/server`, 60 Hz sim, 20 Hz snapshots, 1 KB frame cap, 16-player process cap), PixiJS client with prediction/reconciliation/interpolation, layered character creator with look sync, hand-authored art pipeline plus Blender helper, three art regions, gamepad support, Milestone 3 rules layer (crouch/action, checkpoints, shards, enemies, spikes, levers, plates, doors, one-way platforms), the 2-4 player "Twin Plates" co-op room, marketing site, docs portal, CI, Pages deploy, open-source licensing and the pre-publish audit.
Exit evidence already exists: green tests, live two-client browser verification (per `docs/NEXT_ACTION.md`), published Pages site. Nothing in P0 needs new work except the polish carried into P1.
Lead owners going forward: Claude (sim, client, art), Codex (server, CI, Pages, audit).
Size: complete. Back to [ROADMAP](../ROADMAP.md).
<!-- core:end -->

# P0 Foundations (Done)

| ID | Item | Status | Owner | Size | Acceptance (met) |
|---|---|---|---|---|---|
| RM-001 | Deterministic shared movement sim: slopes, bounce pads, stomp, player push (`packages/sim`) | Done | Claude | L | Same code runs client, server and site reel; sim unit tests green |
| RM-002 | Protocol v3 + authoritative WS server: 60 Hz tick, snapshots every 3 ticks, full-state frame every 20 snapshots, 6-bit input mask (`BTN_MASK` 63), name sanitising, look-change rate limit, 16-player process cap, `/healthz`, waitlist endpoint with origin allowlist and rate limit | Done | Codex (ongoing), Claude (built) | L | `apps/server/test/*.test.ts` pass |
| RM-003 | Client prediction, reconciliation, interpolation, lag/loss simulation flags (`?lag=&loss=`) | Done | Claude | L | Two live clients verified; motion tests pass |
| RM-004 | Character creator, `CharacterLook` codes, look sync over the wire | Done | Claude | L | `look.test.ts`; creator works offline on Pages |
| RM-005 | Art pipeline: hand-authored layered pixel art, Blender helper (time-of-day backdrops, 20 props), 3 regions (meadow, meadow sunset, caverns), enemies, effects, 4 mount sprite sheets, pixel font | Done | Claude | XL | Art gallery on docs portal; art tests pass |
| RM-006 | Marketing site (gameplay reel replays the real sim), docs portal, GitHub Pages deploy, CI (`typecheck`, `test`, `build:pages`, `linkcheck`) | Done | Codex | M | Pages live; workflows in `.github/workflows/` |
| RM-007 | Open-source licensing (MIT code, CC BY-NC-SA 4.0 art/content/docs), pre-publish audit (`tools/audit/prepublish.mjs`) | Done | Codex | S | Audit shows 0 FAIL before each push |
| RM-008 | Gamepad support: XInput/standard pads, remap UI, glyphs, rumble, menu nav, `?pad=debug` overlay (`docs/CONTROLS.md`) | Done (real-pad test pending, RM-016) | Claude | M | Code + tests; Anthony hardware check outstanding |
| RM-009 | M3 rules layer + Twin Plates room + client integration (HUD, prompts, enemy sprites), `SBH_LEVEL=coopRoom` | Done (polish in P1) | Claude | XL | `packages/sim/test/{m3,coop}.test.ts` prove 2/3/4-player solvability |

Risks carried forward: single-room-per-process server; stomp kills not predicted; no persistence; no hosted server (see P1, P3).
