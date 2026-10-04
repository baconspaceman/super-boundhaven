<!-- core:start -->
**SBH AI workstream map.** Three leads plus one assistant, one human authority. Claude: game design, architecture, art direction, integration (owns `packages/sim`, `packages/art`, `apps/client`, `apps/site`, design docs). Codex: engineering, infrastructure, CI, hosting/deploy, persistence, security, performance, code review (owns `apps/server`, `.github/`, `tools/audit`, `tools/docs-site`, Dockerfiles, DB layer). Grokbot: operations, automation, bots, community, analytics, content/research pipelines, load and playtest swarms (owns new `tools/bots/`, `tools/ops-bot/`, report/dashboard tooling). Grokbot runs through an "SBH Chief" coordinator bot that keeps the shared folder `shared-ai-space\super-bound-haven\` (HANDOFF.md, DECISIONS.md, inbox per agent) tidy and manages specialist bots (playtest/QA, ops/analytics, community drafts, design-QA, art-keeper, economy analyst) that only propose; bots act only when pinged, so continuity lives in those files (section 7). Kimi: research, dashboards and automation support through the existing mailbox (`shared-ai-space/mailbox/`). Anthony: final authority, and the only one who may spend money, create accounts, post publicly, or sign anything. Shared packages (`packages/protocol`) are co-owned: Claude designs messages, Codex reviews and implements server side, Grokbot consumes. This file holds standing responsibilities, handoffs, a RACI over roadmap items, the first 10 safe tasks per lead, a bot-swarm spec and a community/ops-bot spec. Charter, protocol and prompts for the team are written elsewhere under `docs/ai-team/` by other agents; where they conflict with this file for process, they win; for ownership of roadmap items, [../ROADMAP.md](../ROADMAP.md) wins. Hard limits for all agents: no git commit/push or installs without lead go-ahead; no secrets or `apps/server/data/` in repo; no posting, accounts or spend.
<!-- core:end -->

# Workstream map

See [../ROADMAP.md](../ROADMAP.md) and [../roadmap/BOARD.md](../roadmap/BOARD.md). Roadmap items use IDs `RM-nnn`.

## 1. Standing responsibilities

### Claude (lead: design, architecture, art, integration)
- Game design and the bible/GDD labelling discipline ([CONFIRMED]/[PROPOSAL]); decision log hygiene (`DECISIONS.md`).
- Sim (`packages/sim`) correctness and determinism; level and room design; mounts, abilities, progression design.
- Art direction against `docs/ART_NORTH_STAR.md`; all art generators and Blender helper; originality and provenance.
- Client (`apps/client`) and creator; integration across server/client/art; acceptance playtests.
- Protocol message design (with Codex review); site and public-doc truthfulness.

### Codex (second lead: engineering and infrastructure)
- Server (`apps/server`): authority, hardening, multi-room, metrics, config; persistence and accounts behind interfaces.
- CI/CD, Pages workflow, Docker/deploy research and (after Anthony approval) deployment; release engineering.
- Security, secrets hygiene, dependency policy, anti-cheat, replay re-simulation.
- Performance budgets; code review of every Claude sim/protocol change; flaky-test triage.

### Grokbot (second lead: operations, automation, bots, community)
- Bot swarms: load tests, co-op playtests, balance sweeps, regression reports (spec in section 5).
- Community/ops bot (draft-only, spec in section 6), changelog/devlog and digest generation.
- Analytics and dashboards from bot reports and server metrics; telemetry schema design (collection only with Anthony's approval).
- Content/research pipelines: collect references, summarise research for Claude's design decisions (original designs only; no asset ingestion).

### Kimi (support)
- Research briefs, static dashboards, documentation passes and small automations requested via mailbox. Outbox path for Claude: `shared-ai-space/mailbox/outbox/claude/`. No ownership of source directories.

## 2. Interfaces and handoffs

| From | To | What | Where / contract |
|---|---|---|---|
| Claude | Codex | New sim state that crosses the wire (profile, mount, powerup, room entities) | Design note + proposed types in `packages/protocol`; Codex reviews size/abuse/rate; server validates |
| Claude | Codex | Level schema and room formats | `docs/design/` note + validator tests; Codex builds upload/validation pipeline |
| Claude | Codex | Persistence needs (what must be stored per player/level) | Short data-model list per feature; Codex owns schema and migrations |
| Claude | Grokbot | Desired playtest scenarios and pass/fail criteria | Scenario file (level name, player count, success condition, latency grid) |
| Codex | Claude | Server capabilities, limits, error codes | `docs/NETCODE.md` kept current by Codex; breaking changes bump `PROTOCOL_VERSION` |
| Codex | Grokbot | Headless-friendly hooks: `/metrics` (RM-051), `/healthz` (exists), server start script with `SBH_LEVEL`/`PORT`, a documented way to run N servers on N ports until multi-room (RM-033) | Contract below |
| Grokbot | Claude | Playtest results, balance sweeps, desync reports | JSON reports + short summary; recommendations only, design decisions stay with Claude |
| Grokbot | Codex | Load-test findings, bottlenecks, crash repros | Report with seed, config and server logs |
| Anyone | Anthony | Owner-only decisions, spending, public posts | Add to [../roadmap/DECISIONS_NEEDED.md](../roadmap/DECISIONS_NEEDED.md) via lead; never act |

**What Grokbot needs from the sim/server (contract):**
1. Headless bot client: use `@sbh/protocol` types (`ClientMsg`/`ServerMsg`, `PROTOCOL_VERSION` = 3) and `ws`; no browser, no rendering.
2. Run the same step function: import `@sbh/sim` (`stepPlayer`, `stepWorld`, `getLevel`, `BTN`) to predict state and detect desyncs.
3. Metrics endpoint (`GET /metrics`, RM-051): tick duration histogram, connected players, snapshot bytes/s, input rejects, per-room counts. `/healthz` exists today.
4. Deterministic seeds: bot behaviour takes a seed so failures replay.
5. Test-only server options already available: `createGameServer({ levelName, maxPlayers, allowedOrigins, waitlistFile })` (see `docs/NETCODE.md`); the bot harness should start servers programmatically on ephemeral ports.
6. Known limits to design around: one level per server process, process cap 16 players, 1 KB max frame (larger closes the socket), look changes rate limited. Load beyond 16 needs several processes until RM-033.

## 3. RACI across roadmap items (R responsible, A accountable, C consulted, I informed)

Anthony is A for every item tagged Blocked and for anything involving money, accounts, public statements, legal or signatures. Otherwise the lead below is A.

| Roadmap area (IDs) | Claude | Codex | Grokbot | Kimi | Anthony |
|---|---|---|---|---|---|
| Polish M1/M2: art, UX, hitbox (RM-010..013, 015, 019, 020, 021) | A/R | C | I | I | C (sign-off) |
| Stomp prediction, flaky tests (RM-014, 018) | C | A/R | I | I | I |
| Real controller test (RM-016) | C | I | I | I | A/R |
| M2 envelope, sync fairness (RM-017, 031) | C | A/R | R | I | I |
| Co-op rooms and raid design (RM-032, 034..036, 038) | A/R | C | C | I | C |
| Bot solvers, stress (RM-030, 037) | C | C | A/R | I | I |
| Multi-room, party, replay (RM-033, 039, 040) | C | A/R | I | I | I |
| Hosting research (RM-050) | C | A/R | I | R (research) | C |
| Deploy/staging (RM-053, 054) | I | R | I | I | A (spend) |
| Metrics, hardening, security (RM-051, 058, 060, 063) | I | A/R | C | I | I |
| Bot library (RM-052) | C | C | A/R | I | I |
| Persistence/accounts (RM-055, 056) | C | R | I | I | A (provider, privacy) |
| Quick chat (RM-057, 117) | A/R (design, UI) | R (server) | I | I | A (posture) |
| Anti-cheat, versioning (RM-059, 064) | C | A/R | C | I | I |
| Observability, telemetry (RM-061, 066) | C | R | A/R | R (dashboards) | A (collection policy) |
| Moveset, mounts, powerups (RM-070..079) | A/R | C (determinism, server rules) | C (balance sims) | I | C |
| Progression and gear (RM-080..087) | A/R | R (persistence) | R (RM-086) | I | C |
| World and regions, audio (RM-090..108) | A/R | C (perf) | I | R (research) | C |
| Casino lore (RM-109, 136) | R (lore, art) | I | I | I | A |
| Level schema, editor (RM-110, 111) | A/R | R (validator) | I | I | C |
| Upload, replay proof, moderation (RM-112..115) | C | A/R | R (shortlist, queue tooling) | I | A (policy) |
| Events (RM-116) | A/R (design) | R | R (ops) | I | C |
| Social (RM-118) | C | A/R | I | I | A (safety posture) |
| Community goals page, ops bot, changelog (RM-119..121) | C (copy truthfulness) | I | A/R | R | A (publishes) |
| Economy (RM-130..135) | A/R (design) | A/R (ledger, trade) | R (storm tests) | I | C |
| Monetization (RM-137) | I | I | I | I | A/R |
| Platform, accessibility, release (RM-140..150) | R (140, 141, 146) | A/R (142..145, 147, 150) | I | R (146 docs) | A (148, Steam account) |
| Scale and live ops (RM-160..167) | C (content) | A/R (infra) | A/R (swarms, ops) | I | A (spend, privacy) |

## 4. First 10 tasks for each lead (safe, bounded, verifiable; start today)

### Claude
1. RM-010 hero crouch frame. Verify: art test plus browser screenshot.
2. RM-011 lever contrast, idle flag, spikes, open-gate. Verify: before/after screenshots.
3. RM-012 ACTION prompt vs name tag. Verify: layout unit test.
4. RM-013 enemy hitbox vs sprite; record the choice. Verify: updated sim tests green.
5. RM-019 truth sync of README table, site roadmap chips, DESIGN_BRIEF, NEXT_ACTION. Verify: `npm run linkcheck`, `npm run audit`.
6. RM-020 feel-tuning doc listing every constant in `packages/sim/src/config.ts`. Verify: each constant has intent and units.
7. RM-015 front-facing face in the creator preview. Verify: screenshot set; gameplay side view unchanged.
8. RM-110 Level schema v1 draft doc (fields, caps, entity limits) handed to Codex for the validator. Verify: all registry levels fit the draft.
9. Write the raid room format spec (RM-035): `need` counts, multi-gate, 8-player spare-player rule. Verify: worked example expressed in the Twin Plates object vocabulary.
10. Frog mount design-to-sim spec (RM-072/071) labelled proposal, listing the `PlayerState` additions and protocol fields for Codex review. Verify: reviewer checklist in the doc.

### Codex
1. RM-018 triage the vitest worker crash: 10 full consecutive runs, record result.
2. RM-058 input rate limit and per-IP connection cap with tests (flood, malformed, oversize).
3. RM-051 `/metrics` endpoint with test; Dockerfile (build verified locally if Docker runs).
4. RM-060 secrets scan and dependency-audit policy in CI (fake-secret branch must fail).
5. RM-063 waitlist retention/deletion review: findings only.
6. RM-050 hosting options research doc: no accounts, no spend, qualitative cost only.
7. RM-147 add `npm run audit` to CI; list candidate dev tools needing Anthony's OK (no installs).
8. RM-014 stomp-kill prediction design review, then implement behind a client flag with mispredict test.
9. RM-064 protocol compatibility policy doc plus a `v` mismatch test; size benchmark of snapshots at 8 players.
10. RM-055 persistence interface draft (types only, in-memory implementation, round-trip tests); check whether `node:sqlite` is usable on Node 24 before proposing it (unverified).

### Grokbot
1. RM-052 scaffold `tools/bots/` with a bot that joins a locally started server and sends no-op inputs. Verify: unit test against `createGameServer` on an ephemeral port.
2. Add ping/pong RTT measurement and snapshot-rate counters to the bot. Verify: report shows plausible numbers on localhost.
3. Define the report JSON schema (section 5) and a validator. Verify: schema test.
4. RM-030 scripted Twin Plates solver reusing the input scripts in `packages/sim/test/coop.test.ts`, run over WebSocket for 2/3/4 bots. Verify: all clear.
5. Add a latency/loss injecting TCP proxy in front of the server for bots only. Verify: measured RTT matches setting.
6. Smoke swarm: 16 idle-walking bots on the playground level (process cap). Verify: no crash, report written.
7. RM-120 community/ops bot skeleton with draft-only outbox and a hard-coded "no network send" guard. Verify: test that send path throws.
8. RM-121 changelog generator reading `git log` and BOARD. Verify: sample output committed under the outbox, not published.
9. Static HTML dashboard generated from report JSON (Kimi may assist). Verify: opens offline, no external requests.
10. Weekly "state of SBH" digest draft to `shared-ai-space/mailbox/outbox/` for Anthony (facts from ROADMAP only; no dates, prices or promises).

### Kimi (support, optional)
Research brief on original-only region motif references (RM-092..102); docs onboarding pass (RM-146); dashboard styling for RM-061; summarise open GitHub issues for Anthony.

## 5. Bot swarm spec (Grokbot)

**Purpose:** load-test the server, play-test the co-op room, report metrics, and gate regressions. Never points at anything except servers Anthony has approved (localhost by default).

**Architecture**
- Package: `tools/bots/` (TypeScript, runs with `tsx`, imports `@sbh/protocol` and `@sbh/sim`, uses `ws`).
- `BotClient`: opens a WebSocket, sends `{t:'join', name, token?, look?}` using a valid look code from `@sbh/protocol` (`encodeLook` / presets), reads `welcome` (checks `v === PROTOCOL_VERSION`), then every 1/60 s sends `{t:'input', seq, buttons}` (6-bit mask; frames under 1 KB), pings once per second (`{t:'ping', ts}`), and applies snapshots (`snap`, with `world` on full frames).
- Local prediction: bot steps its own player with `@sbh/sim` and compares against `snap` after `ack` to count desyncs and reconciliation distance.
- Behaviours (pluggable, seeded): `idle`, `wander` (random run/jump), `ghost-run` (replay of recorded inputs), `coop-solver` (scripted per-role inputs for Twin Plates), later `raid-solver`, `griefer-lite` (rate-limit probing within limits).
- Conditions: injected latency/jitter/loss via a local TCP proxy; reconnect-with-token scenario; mid-run kill of one bot to test dropout rules.
- Scenario file: `{ level, players, behaviour, rttMs, jitterMs, lossPct, durationS, seed, passCriteria }`.

**Report (JSON, one per run)**: `{ scenario, seed, startedAt, serverVersion, protocolVersion, bots:[{id, role, rttP50, rttP95, snapshotsPerS, bytesInPerS, bytesOutPerS, desyncCount, maxCorrectionPx, disconnects, cleared, clearTimeTicks, deaths}], server:{tickMsP50, tickMsP99, rssMB, rejects}, verdict, notes }`. Plus a one-line Markdown summary.

**Test matrix (initial)**
| Scenario | Level | Bots | Pass criteria |
|---|---|---|---|
| Smoke | playground | 2 | join, 60 s, 0 disconnects, desync 0 |
| Capacity of one process | playground | 16 (cap) | tick p99 under the 16.7 ms budget, no memory runaway |
| Twin Plates | coopRoom | 2, 3, 4 | all clear; spare-player rule holds when one is killed |
| Envelope | coopRoom | 4 | clear at RTT 0/80/150/250 ms and 0/2/5% loss, or documented failure point |
| Reconnect | coopRoom | 3 | token reconnect restores identity within grace |
| Raid prototype (later) | raid room | 8 | clear; any-one-dropout does not deadlock |
| Swarm (later) | many rooms | 100 / 1000+ | needs RM-033; capacity numbers recorded |

**Rules:** localhost or Anthony-approved targets only; no real accounts; fixed seeds for repro; reports stored outside source dirs (for example `tools/bots/reports/` git-ignored) except curated baselines; cap concurrency to protect the dev machine.

## 6. Community and ops bot spec (Grokbot, Discord-ready, draft-only)

- **Mode:** produces drafts, never publishes. Output goes to an outbox (`tools/ops-bot/outbox/` and a copy to the shared mailbox) as Markdown for Anthony to review. The send path is compiled out or hard-guarded until Anthony explicitly enables a specific channel.
- **Never:** post anywhere public without Anthony's explicit approval for that specific post; create accounts or tokens; collect or store personal data; read or use `apps/server/data/` (waitlist emails); state dates, prices, rewards, launch promises or monetization.
- **Discord-readiness:** message templates (patch notes, devlog, "what's playable now", event announcements as text drafts), channel map file, slash-command spec (`/status`, `/roadmap`, `/report-bug` linking to GitHub Issues), rate-limit aware design. No bot token handling in repo; Anthony supplies and stores any token himself.
- **Quick-chat-safe:** in-game chat is quick-chat presets only (RM-057). The bot never injects free text into the game, and any future in-game bot voice uses presets only. Community-side moderation helpers (spam/link/slur flag lists) only produce flagged-queue drafts for human review.
- **Content sources:** `docs/ROADMAP.md` statuses, git log, BOARD; the truthfulness rule: every claim must be checkable in the repo; labels Prototype/Planned must match README.
- **Analytics (privacy-respecting):** aggregate counts only (for example Pages visits if Anthony enables, issue counts); no per-person tracking; nothing collected from the game until D11 in DECISIONS_NEEDED is answered.
- **Outputs:** weekly digest draft, changelog draft, FAQ upkeep proposals, issue triage summaries.

## 7. Grokbot roster: SBH Chief and specialist bots

**Shared folder (Grokbot's proposal, pending Anthony's okay to create it):** `shared-ai-space\super-bound-haven\` containing a generated one-file-per-topic mirror of the repo docs, a live `HANDOFF.md`, `DECISIONS.md`, and `inbox/<agent>/` (one inbox per agent or bot). The repo stays the source of truth; the folder is a generated mirror plus a message layer. Nothing secret, no `apps/server/data/`, no private revenue material in the mirror of public docs.

**Wake-up constraint:** bots act only when pinged (a person, a scheduled task, or another agent). No bot has memory between pings. Continuity lives in files: read `HANDOFF.md`, `DECISIONS.md` and your `inbox/` first; before stopping, append what you did, what you did not do, and the next step to `HANDOFF.md`, and file questions to the right inbox. Never assume a prior conversation.

**SBH Chief (Grok-side coordinator, sits under Grokbot, the Second Lead).**
- Owns: day-to-day hygiene of the shared folder (regenerating the mirror, pruning inboxes, keeping `HANDOFF.md` and `DECISIONS.md` current), triaging inbox items to the right lane, creating and retiring specialist bots in lanes, keeping this roster accurate.
- Does NOT own: canon, design, art or architecture decisions (Claude, the Lead, owns these; Anthony overrides anyone). The Chief records decisions, never makes them.
- Never: post publicly, spend, create accounts, sign, or change repo source outside the lane files below. New specialists are proposed to Grokbot and logged in `DECISIONS.md`; they are not created for tasks outside the roadmap.

**Specialists** (all propose only; any output that would publish, spend or open an account becomes a draft to Anthony via the Chief). "May pick up" lists items from [../roadmap/BOARD.md](../roadmap/BOARD.md) and the phase files; anything else needs Chief or lead assignment.

| Specialist | Lane | Spec it implements | May pick up |
|---|---|---|---|
| Playtest/QA bot | Bot swarms, co-op and raid playtests, regression and load reports, desync reports | Section 5 (bot swarm spec) | RM-052, RM-030, RM-017 (with Codex), RM-031 (with Codex), RM-037, RM-086, RM-160 |
| Ops/analytics bot | Metrics, dashboards, observability, telemetry schema design (no collection without Anthony), incident digests | Section 5 reports plus RM-051 metrics | RM-061, RM-066 (schema only), RM-163, RM-166 (drafts); dashboard from BOARD item "static HTML dashboard" with Kimi |
| Community/marketing drafts bot | Draft-only patch notes, devlog, FAQ, event text, weekly digest, community goals scaffold copy | Section 6 (community/ops bot spec) | RM-120, RM-121, RM-119 (scaffold with placeholder text only), RM-115 (shortlist report; Anthony picks) |
| Design-QA bot | Checks that docs, site and UI copy match the GDD labels and the code (Prototype/Planned honesty), flags contradictions to Claude | New; read-only on source | RM-019 (finds, Claude fixes), RM-146 review pass, recurring contradiction scan of README/site/ROADMAP |
| Art/image-keeper bot | Keeps the art inventory, preview/gallery indexes, provenance log and naming consistent; flags non-original or off-palette assets; no generation of final art, no image-service accounts | New; read-only on `packages/art` | RM-150 (with Codex), provenance checks for RM-085 and RM-092..102 outputs; reports to Claude |
| Economy analyst bot | Models item sinks and sources, trade-storm test design, dupe/anomaly reports; works on mechanics only. Any revenue or pricing analysis belongs to the private revenue roadmap held by Anthony and the lead and is never written into this repository or the public mirror | New | RM-086 (balance), RM-133 (sink/source reports), RM-135 (with Codex); never RM-137 or D1 |

**Rules for the roster**
1. Specialists cannot touch `packages/sim`, `packages/art`, `apps/client`, `apps/server`, `.github/` (owned by Claude and Codex). Their write lanes: `tools/bots/`, `tools/ops-bot/`, report/dashboard tooling, the shared folder, and files named in a board item.
2. Each specialist reads its inbox and `HANDOFF.md` first, claims one board item by writing it in `HANDOFF.md`, and finishes with tests or a verifiable report.
3. Conflicts about design or art go to Claude; infrastructure, security or deploy go to Codex; money, accounts, public posts, legal, ToS, privacy go to Anthony via [../roadmap/DECISIONS_NEEDED.md](../roadmap/DECISIONS_NEEDED.md).
4. The Chief reviews the roster at the start of each phase and retires idle bots rather than letting them accumulate.

## 8. Working agreement

- Claim work on the board; keep disjoint file ownership; ask the file's owner before touching it.
- Every PR-sized change: tests green, typecheck green, audit 0 FAIL, browser check for visuals, honest failure reports.
- Update `docs/NEXT_ACTION.md` and the shared handoff files before ending a session; escalate owner-only items to DECISIONS_NEEDED rather than acting.
