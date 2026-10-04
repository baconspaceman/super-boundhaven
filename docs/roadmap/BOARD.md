<!-- core:start -->
**Now / Next / Later board.** The top 26 actionable items an agent can pick up today, each with scope, files likely touched, tests required and definition of done (DoD). Claim an item by writing your role and the ID at the top of `docs/NEXT_ACTION.md` (or the shared mailbox protocol described under `docs/ai-team/`) before starting; disjoint file ownership applies. Every item must: pass `npx vitest run` and `npx tsc --noEmit -p tsconfig.json`; do a real browser check if visual; run `node tools/audit/prepublish.mjs` (0 FAIL) before any push; never commit secrets or `apps/server/data/`; no git commit/push or dependency installs without the lead's go-ahead; no spending, accounts, public posts or signatures (Anthony only). NOW = in the order listed below, safe to start immediately. NEXT = start after a NOW item lands. LATER = see phase files. Lead tags: C = Claude, X = Codex, G = Grokbot, K = Kimi (support via mailbox), A = Anthony.
<!-- core:end -->

# Board

## NOW (take these first)

**RM-010 Hero crouch frame (C).** Scope: dedicated crouch sprite for the layered humanoid. Files: `packages/art/src/characters/*`, `apps/client/src/player-view.ts`, `packages/art/test/*`. Tests: art compose test for the new frame on all body options. DoD: crouching shows a distinct pose, browser screenshot attached to the handoff.

**RM-011 Legibility pass (C).** Scope: lever contrast, idle flag, spikes, open gate. Files: `packages/art/src/world/*` (gameplay objects), `apps/client/src/world-objects.ts`, `object-atlas.ts`. Tests: art tests still pass; screenshots before/after. DoD: each object readable against meadow and caverns backgrounds per `docs/ART_NORTH_STAR.md`.

**RM-012 ACTION prompt vs name tag (C).** Files: `apps/client/src/action-prompt.ts`, `scene-logic.ts`. Tests: layout unit test. DoD: no overlap at normal and near-edge positions.

**RM-013 Enemy hitbox vs sprite (C).** Files: `packages/sim/src/entities.ts`, `level.ts` enemy defs, `apps/client/src/enemy-view.ts`. Tests: update `packages/sim/test/m3.test.ts`; stomp tests. DoD: decision recorded in `DECISIONS.md`-style note; hitbox and sprite agree.

**RM-019 Truth sync (C).** Scope: README status table, site roadmap chips (`apps/site/index.html` M3 chip says Planned; M1 chip), `DESIGN_BRIEF.md` stale "no implementation" paragraph, `docs/NEXT_ACTION.md` date and stale sections. Tests: `npm run linkcheck`, `npm run audit`. DoD: every status claim matches `ROADMAP.md` section 2.

**RM-018 Vitest crash triage (X).** Files: `vitest.config.*` if needed. Tests: 10 consecutive full runs. DoD: either reproduced and mitigated or closed with notes.

**RM-058 Authority hardening (X).** Files: `apps/server/src/server.ts`, `apps/server/test/server.test.ts`. Scope: per-connection input rate limit, join-flood and per-IP connection cap, strict schema checks, unknown-type handling. Tests: malformed, flood and oversize traffic cases; normal play unaffected. DoD: server stays up and measurable counters exist.

**RM-051 Dockerfile and `/metrics` (X).** Files: `apps/server/src/server.ts` or new `metrics.ts`, `apps/server/Dockerfile` (new), test. DoD: `/metrics` text endpoint with tick time, players, snapshot bytes, rejected inputs; Docker build verified if Docker runs locally.

**RM-060 Security hygiene (X).** Scope: secrets scan step and dependency audit policy in CI. Files: `.github/workflows/ci.yml`, `tools/audit/prepublish.mjs`. DoD: CI fails on a seeded fake secret in a test branch; policy note.

**RM-063 Waitlist data review (X).** Files: `apps/server/src/waitlist.ts` (read; propose), findings doc. DoD: retention/deletion questions copied into `DECISIONS_NEEDED.md` through the lead.

**RM-050 Hosting options research (X).** Doc only, no accounts, no spend. DoD: options, tradeoffs (qualitative), recommendation, what Anthony must approve.

**RM-052 Bot client library (G).** Files: new `tools/bots/` (Grokbot-owned). Scope: headless client on `@sbh/protocol` and `ws`. Tests: joins a local test server (`createGameServer`), RTT measured, clean disconnect. DoD: README with usage; spec: `docs/ai-team/WORKSTREAMS.md` section "Bot swarm".

**RM-030 Twin Plates bot solvers over WebSocket (G).** Files: `tools/bots/*`. Tests: 2/3/4-bot runs clear the room. DoD: JSON report with clear time, deaths, resets.

**RM-120 Community/ops bot, draft-only (G).** Files: `tools/ops-bot/` (new). DoD: generates drafts into an outbox for Anthony; no network posting code path enabled.

**RM-016 Real-controller test (A).** DoD: Anthony runs `?pad=debug` with his pad; results reported.

## NEXT

**RM-014 Predict stomp kills (X, review C).** Files: `apps/client/src/game.ts`, `motion.ts`, `packages/sim/src/entities.ts`. Tests: mispredict-then-reconcile case in client motion tests. DoD: no visible hitch at 50 ms; veto from server handled.

**RM-015 Front-facing hero face in creator (C).** Files: `apps/client/src/creator.ts`, `look-ui.ts`, `packages/art/src/characters/*`. DoD: preview shows front face; gameplay side view unchanged; Anthony verdict.

**RM-017 M2 test envelope (X + G).** Files: `tools/bots/*`, `apps/server/test/`. DoD: RTT/loss grid report committed; reconnect-with-token test.

**RM-031 Sync-window fairness test (X + G).** DoD: pass/fail table at 0/80/150/250 ms; recommendation in `docs/NETCODE.md`.

**RM-020 Feel tuning doc (C).** Files: new doc under `docs/`; reads `packages/sim/src/config.ts`. DoD: every constant explained; Anthony sign-off requested through the lead.

**RM-021 First authored small-region level (C).** Files: `packages/sim/src/levels/*`, `registry.ts`, tests. DoD: solvable by scripted run, art-complete.

**RM-070 Per-player MovementProfile (C + X).** Files: `packages/sim/src/player.ts`, `config.ts`, `packages/protocol/src/*`, `apps/server/src/server.ts`. DoD: determinism test with two profiles; hash mismatch rejected.

**RM-110 Level schema v1 + validator (C + X).** Files: `packages/sim/src/level.ts`, new validator and tests. DoD: all registry levels pass; malformed fixtures rejected.

**RM-146 Dev experience (C + K).** Scope: onboarding steps, ADR template; link to `docs/ai-team/` and `docs/maintenance/`. DoD: documented path from clone to local join verified by a fresh run.

**RM-147 CI hardening (X).** Scope: audit step, coverage report, browser smoke test (ask Anthony before adding dev dependencies). DoD: CI green and fails on audit FAIL.

**RM-150 Audit tool upkeep (X).** Files: `tools/audit/prepublish.mjs`. DoD: new asset classes (audio, fonts) covered.

## LATER

Everything else: see `docs/roadmap/P2-*.md` to `P10-*.md`. Highlights: multi-room server (RM-033), persistence (RM-055), frog mount (RM-071), editor (RM-111), economy (RM-131).
