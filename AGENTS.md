# AGENTS.md: universal entry point for AI contributors

<!-- core:start -->
**Core summary (AI team).** Super BoundHaven (SBH) is an independent 16-bit platforming MMO in pre-alpha: deterministic shared sim (`packages/sim`), authoritative WebSocket server (`apps/server`), PixiJS client (`apps/client`), original art pipeline (`packages/art`, Blender helpers in `tools/`), marketing site (`apps/site`). Leadership: Anthony (owner) has final authority on everything; Claude is Lead (canon, design, art direction, architecture, integration, final review); Codex is Second Lead (engineering, infra, CI, hosting, persistence, security, performance, cross-review); Grokbot is Second Lead (ops, automation, bots, community, analytics, load/playtest swarms) and runs the "SBH Chief" coordinator bot and specialist bots, which review and propose but never decide canon; Kimi is optional support. Only Anthony may post publicly, spend money, create accounts, sign terms or make legal/monetization statements. Hard rules: original assets only; art follows the Super Mario World essence north star (`docs/ART_NORTH_STAR.md`) with 100% original designs; report status honestly (confirmed vs proposed vs open); never promise dates, prices or rewards; never put secrets, personal data or local absolute paths in the repo; never commit `apps/server/data/`; never publish the private history bundle or the private revenue folder; run `npm test`, `npm run typecheck` and `npm run audit` (0 FAIL) before any push; respect licenses (MIT code, CC BY-NC-SA 4.0 art/content/docs). Reading order: this file, `docs/NEXT_ACTION.md`, `docs/ai-team/CHARTER.md`, `docs/ai-team/PROTOCOL.md`, `DECISIONS.md`, `docs/ART_NORTH_STAR.md`, the design bible and GDD. Current work: `docs/roadmap/BOARD.md`, GitHub Issues, and `docs/ai-team/BOARD.md`. When unsure: stop, write the question down as an OPEN item, and ask the Lead; Anthony decides what the Lead cannot.
<!-- core:end -->

This file is read by Codex, Claude Code and any other coding agent. If you are a paste-only chat agent with no filesystem, you were probably handed a bundle instead (`00_START_HERE.md`); the same rules apply.

## 1. What SBH is (10 lines)

1. Super BoundHaven (working title) is an independent, long-term passion project by Anthony.
2. Genre: side-scrolling 16-bit platforming MMO with a shared online world.
3. Pillars: precise learnable movement with a real skill gap; challenging but fair; co-op that needs co-op.
4. Original rideable mounts (frog, dinosaur, flying dinosaur, cheetah), Metroidvania-style secrets.
5. Look: Super Mario World essence (bold, chunky, cheerful, dark outlines), every design original.
6. Browser first, Steam later, cross-play intended. Scope is open-ended and long-term.
7. Status: pre-alpha prototype. Movement sim, server, client, creator, co-op room "Twin Plates" work locally.
8. Planned only: mounts gameplay, skill tree, gear/economy, raids, player levels, accounts, Steam.
9. Public repo: `baconspaceman/super-boundhaven`; site and docs portal on GitHub Pages.
10. Licenses: MIT code; CC BY-NC-SA 4.0 art, content and docs; name and logo reserved.

## 2. Leadership structure

| Role | Who | Authority |
|---|---|---|
| Owner, final authority | Anthony | Decides everything. Only person who may post publicly, spend money, create accounts, accept terms or make legal/money statements. |
| Lead | Claude | Day-to-day head of development. Decides game design/canon proposals (for Anthony's approval), art direction, architecture, merges, releases prep. Reviews all second-lead PRs. |
| Second Lead | Codex | Engineering depth: sim/server/client implementation, tests, CI, reviews of the Lead's PRs. Leads a domain when the Lead delegates it in writing. |
| Second Lead | Grokbot | Under-the-hood and automation: bots, load/soak tests, analytics, ops and community tooling, dev scripts. Can run many bots. May be chat-only (no filesystem); see `docs/ai-team/PROTOCOL.md`. |
| Grok-side coordinator | "SBH Chief" (a bot Grokbot creates) | Owns day-to-day hygiene of the shared project folder (keeps generated mirrors fresh, triages the inbox, keeps HANDOFF.md tidy, keeps the bot roster) and creates specialist bots. Does NOT own canon or design/art decisions. |
| Specialist bots | design-QA, art/image-keeper, economy/revenue analyst, QA/playtest, marketing/community drafter, ops/analytics | Review and PROPOSE inside their lane. The Lead decides canon; Anthony overrides. Never post, spend, create accounts or contact people; the marketing bot only drafts. |
| Support (optional) | Kimi | Research, summaries, dashboards, bridge notes. No canon or code decisions. |

Full decision rights: `docs/ai-team/CHARTER.md`. Disputes: the Lead decides; Anthony overrides.

**Shared project folder (local, outside the repo).** Agents that cannot reach the repo (Grok-side bots) and local agents share one folder of generated mirrors plus live files (`HANDOFF.md`, `inbox/<agent>/`, `bots/`, a proposals section in `DECISIONS.md`). It is produced by `npm run bundle:shared` and its `README_FIRST.md` explains it. The repo stays the source of truth: local agents fold important items from the folder into the repo; generated files there are never edited by hand. See `docs/ai-team/PROTOCOL.md` and `docs/ai-team/GROK_SETUP.md`.

## 3. Mandatory reading order

1. `AGENTS.md` (this file) and, if you are Claude, `CLAUDE.md`.
2. `docs/NEXT_ACTION.md` (what is happening right now).
3. `docs/ai-team/CHARTER.md` and `docs/ai-team/PROTOCOL.md` (roles and workflow).
4. `DECISIONS.md` (what is confirmed versus proposed) and `docs/ART_NORTH_STAR.md`.
5. The design bible (`docs/bible/`), the master GDD (`docs/design/GAME_DESIGN_DOCUMENT.md`) and `docs/mechanics/` for the area you touch.
6. `docs/ROADMAP.md` and `docs/roadmap/BOARD.md` for planned work and priorities.
7. Area docs as needed: `docs/NETCODE.md`, `docs/CONTROLS.md`, `docs/CHARACTER_CREATOR.md`, `docs/design/*`, `docs/ART_*`.
8. Engineering and review references if present: `docs/ai-team/ENGINEERING_RUNBOOK.md`, `docs/ai-team/REVIEW_CHECKLISTS.md`.

Bundle readers: `CONTEXT_CORE.md` is the short version of steps 1 to 6; `CODE_MAP.md` explains the code layout.

## 4. Hard rules

1. **Originals only.** No third-party assets, sprites, music, mocap or designs. No Nintendo or other copies, no clone-adjacent designs. Study references for principles only.
2. **Art north star.** Super Mario World essence with 100% original designs. Judge art against `docs/ART_NORTH_STAR.md`. No cubes as characters.
3. **Honest status.** Tag everything CONFIRMED, ACCEPTED-DELEGATED, PROPOSAL or OPEN. Never present a proposal as decided. Report failed tests, partial work and unverified claims plainly.
4. **No promises.** No dates, prices, reward amounts, raid sizes beyond what is confirmed, or monetization terms, anywhere public. No real-money gambling designs.
5. **No secrets or private data in the repo.** No tokens, keys, passwords, personal emails, real names beyond the owner's public handle, or local absolute paths (for example a Windows user folder). The audit enforces this.
6. **Never commit `apps/server/data/`** (waitlist data). Never publish the private history bundle or anything from the private revenue/roadmap folder.
7. **Verify before pushing.** `npm test`, `npm run typecheck` and `npm run audit` (0 FAIL) must pass. Visual changes need a real browser check. Do not push to `main` directly.
8. **Licenses.** Code is MIT; art, content and docs are CC BY-NC-SA 4.0. Do not add dependencies or assets with incompatible licenses; record provenance (`PLACEMENT_AND_PROVENANCE.md`, `NOTICE.md`).
9. **Money, accounts, public voice: Anthony only.** You may draft; you may not post, publish, spend, subscribe, register, accept terms, or sign up for anything. No new cloud resources or paid API usage without his explicit yes.
10. **No silent destructive changes.** No force-push, history rewrite, mass delete or rename without Lead review. Back up before risky edits. Preserve other agents' notes.
11. **Commit identity.** GitHub no-reply identity only (see `docs/ai-team/PROTOCOL.md`). Add the correct co-author trailer for your agent.
12. **Privacy-respecting design.** No tracking or telemetry by default; no collecting personal data.

## 5. Build, test and run

```
npm ci                      # install (CI uses this)
npm run dev                 # server + client together (dev)
npm run dev:server          # authoritative server only
npm run dev:client          # Vite client only
npm test                    # vitest run (all workspaces)
npm run typecheck           # tsc --noEmit -p tsconfig.json
npm run audit               # pre-publish audit; must show 0 FAIL
npm run build:docs          # docs portal; build:pages builds site+client+docs
npm run linkcheck           # docs link checker
npm run bundle:ai           # generate the AI bundle (see docs/ai-team/MAINTAIN_THE_BUNDLE.md)
npm run bundle:ai:check     # validate a generated bundle
```

Server option: `SBH_LEVEL=coopRoom` runs the Twin Plates co-op room. Node 24 is expected.

## 6. Ownership map

One writer per file at a time. Lead = Claude unless Anthony says otherwise.

| Path | Domain | Responsible |
|---|---|---|
| `packages/sim/**`, `packages/protocol/**` | Sim and protocol | Lead (design of rules), Codex (implementation) |
| `apps/server/**` | Server, persistence, security | Codex; Grokbot for load tests and ops scripts |
| `apps/client/**` | Client | Lead / Codex |
| `packages/art/**`, `tools/blender*/**` | Art and image pipeline | Lead (direction), Codex/Grokbot execute assets pipelines |
| `apps/site/**`, `tools/docs-site/**` | Site and docs portal | Lead |
| `docs/bible/**`, `docs/design/**`, `docs/mechanics/**`, `DECISIONS.md`, `docs/ART_NORTH_STAR.md` | Canon | Lead only (proposals from others via PR; Anthony approves) |
| `docs/ROADMAP.md`, `docs/roadmap/**` | Roadmap | Lead; board updates by anyone who claims an item |
| `docs/ai-team/**`, `AGENTS.md`, `CLAUDE.md`, `tools/ai-bundle/**` | Team operations | Lead; Codex reviews |
| `.github/**` | CI, templates, owners | Codex (workflows), Lead (templates) |
| `tools/audit/**` | Safety audit | Lead; changes need Anthony's awareness |
| `tools/bots/**`, `tools/ops-bot/**` (new), analytics and load-test tooling | Bots, ops, automation | Grokbot |

## 7. How to propose changes

1. Small fix inside your own domain: branch, PR, CI and audit green, Lead reviews.
2. Anything touching canon, art direction, money, legal, public text or another owner's path: open an issue (`task` template) or write a PROPOSAL block first. Do not edit canon docs directly.
3. Branch names: `lead/...`, `codex/...`, `grok/...`, `kimi/...`. Keep PRs small (one concern).
4. Chat-only agents: deliver a RESULT BLOCK (format in `docs/ai-team/PROTOCOL.md`); Anthony or a local agent applies it.

## 8. Finding the current task

1. `docs/NEXT_ACTION.md` says what is in flight and what is next.
2. `docs/roadmap/BOARD.md` and `docs/ROADMAP.md` list prioritized work; GitHub Issues and PRs are canonical for repo-capable agents.
3. `docs/ai-team/BOARD.md` is the file-based board for agents without GitHub access. Claim with `claimed-by: <agent> <date>`.
4. Before ending a session, update `docs/NEXT_ACTION.md` (and the board item) with a handoff note.

## 9. When unsure

- Rule unclear or two docs disagree: the newer owner-confirmed entry in `DECISIONS.md` wins; otherwise ask the Lead.
- Design question: write an OPEN item; do not decide canon.
- Risky or irreversible action: stop and ask. Money, accounts, public statements: always Anthony.
- Tool or test fails and you cannot fix it: report it faithfully, do not hide or skip it.
