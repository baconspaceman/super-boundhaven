# AI team board (file-based)

<!-- core:start -->
**Core summary.** This is the file-based task board for agents without GitHub access and for bundle readers. GitHub Issues and PRs remain canonical for repo-capable agents; roadmap-level items live in `docs/roadmap/BOARD.md` (IDs `RM-nnn`). Here, team-level and ad-hoc tasks use IDs `T-nnnn`. Claim an item by setting `status: claimed` and `claimed-by: <agent> <date>`; one owner per item; release with `claimed-by: none`; do not take an item claimed in the last three days without asking. Statuses: todo, claimed, in-review, blocked, done. Mark `needs: anthony` when the item requires the owner (money, accounts, public text, legal). Only the Lead reorders priorities. The board lists items grouped as Now, Next, Later, Done; move a block between groups when its status changes and keep the newest handoff note in `docs/NEXT_ACTION.md`.
<!-- core:end -->

Syntax and rules: see `docs/ai-team/PROTOCOL.md` section 4. Copy a block for each new item.

## Template

```
### T-0000 Short title
status: todo
claimed-by: none
domain: game design | art | sim | client | server | infra | bots/ops | docs | release
files: repo-relative paths this item will touch
links: issue/PR/doc links, roadmap IDs (RM-nnn)
blocked-by: none
needs: none | lead | anthony
notes: one or two lines; done-when criteria
```

## Now

### T-0001 Review first bundle and hand it to the Second Leads
status: todo
claimed-by: none
domain: docs
files: tools/ai-bundle/**, docs/ai-team/**
links: docs/ai-team/MAINTAIN_THE_BUNDLE.md
blocked-by: none
needs: anthony
notes: Anthony hands the PUBLIC bundle to Grokbot and Codex; Lead rebuilds after the docs wave lands. Done when both Second Leads have confirmed they can state the game's pillars and their first task back.

### T-0002 Confirm Grokbot's access mode
status: todo
claimed-by: none
domain: bots/ops
files: none
links: docs/ai-team/PROTOCOL.md section 8
blocked-by: none
needs: anthony
notes: Is Grokbot repo-capable (branch/PR flow), chat-only (inbox + RESULT BLOCK) or API with tools? Record the answer here and in WORKSTREAMS.

## Next

(empty; the Lead adds items)

## Later

(empty)

## Done

(empty)
