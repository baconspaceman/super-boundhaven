# AI team folder: index

<!-- core:start -->
**Core summary.** `docs/ai-team/` is the operating manual for the AI team that builds Super BoundHaven under Anthony (owner, final authority): Claude (Lead), Codex and Grokbot (Second Leads), Kimi (optional support). Start with `AGENTS.md` at the repo root, then this folder. CHARTER defines roles and decision rights; PROTOCOL defines branches, PRs, boards, handoffs, the local mailbox and how chat-only agents participate; ONBOARDING says how to bring a new AI up to speed; BOARD is the file-based task board; `prompts/` holds ready-to-paste role prompts; MAINTAIN_THE_BUNDLE explains how to generate and hand out the AI bundle (PUBLIC bundle for any AI, LEAD bundle with private material for trusted local leads only). Other docs here (WORKSTREAMS, IMAGE_GUIDE, ENGINEERING_RUNBOOK, REVIEW_CHECKLISTS, ASSET_PIPELINES) are maintained by the roadmap and engineering owners. `inbox/<agent>/` holds task cards and result blocks for agents that cannot write to the repo.
<!-- core:end -->

| File | What it is |
|---|---|
| [`../../AGENTS.md`](../../AGENTS.md) | Universal entry point: rules, reading order, commands, ownership |
| [`../../CLAUDE.md`](../../CLAUDE.md) | Claude-specific Lead duties |
| [`CHARTER.md`](CHARTER.md) | Roles, decision-rights matrix, autonomy, escalation, succession |
| [`PROTOCOL.md`](PROTOCOL.md) | Branches, PR flow, boards, handoffs, mailbox, Grokbot participation |
| [`ONBOARDING.md`](ONBOARDING.md) | Step-by-step onboarding for each kind of AI |
| [`BOARD.md`](BOARD.md) | File-based task board (claims, handoffs) |
| [`MAINTAIN_THE_BUNDLE.md`](MAINTAIN_THE_BUNDLE.md) | Regenerate and hand out the AI bundle |
| [`GROK_SETUP.md`](GROK_SETUP.md) | Step-by-step for Anthony: shared folder, SBH Chief, specialists, group chat, wake-up ping |
| [`prompts/`](prompts/) | `claude-lead.md`, `codex-second-lead.md`, `grok-second-lead.md`, `grok-chief.md`, `grok-specialists.md`, `kimi-support.md`, `generic-contributor.md` |
| [`inbox/README.md`](inbox/README.md) | Inbox convention for chat-only agents |
| `WORKSTREAMS.md`, `IMAGE_GUIDE.md`, `ENGINEERING_RUNBOOK.md`, `REVIEW_CHECKLISTS.md`, `ASSET_PIPELINES.md` | Written by other owners; see the folder listing for what exists |

Related: the roadmap lives in `docs/ROADMAP.md` and `docs/roadmap/`; the design bible in `docs/bible/`; the current task in `docs/NEXT_ACTION.md`.
