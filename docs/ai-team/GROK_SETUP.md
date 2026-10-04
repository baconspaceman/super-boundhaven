# Setting up Grok, the SBH Chief and specialist bots

<!-- core:start -->
**Core summary.** Step-by-step for Anthony to bring Grok into the team. Grok reads local files through its computer connection; Claude and Codex read and write files; none has a direct line to Grok, so the shared project folder is the meeting place. Steps: generate the folder with `npm run bundle:shared`; reply to Grok's offer ("Yes, create the SBH Chief bot, point it at the folder, read README_FIRST.md"); paste `prompts/grok-chief.md` as the Chief's system prompt; have the Chief create specialists from `prompts/grok-specialists.md`; add the Chief and specialists to a group chat; and use a standing "session start" ping because bots only act when someone messages them. Continuity lives in `HANDOFF.md`, `DECISIONS.md` and `inbox/`, not in chat. Nobody posts, spends, creates accounts or contacts people without Anthony's explicit OK.
<!-- core:end -->

## Step 1. Generate the shared folder (once, then refresh after docs change)

From the repo: `npm run bundle:shared`. This creates or refreshes the folder `shared-ai-space/super-bound-haven/` in your local workspace (the exact path is printed by the command and written at the top of `README_FIRST.md`). It regenerates the numbered files and mirrors and never overwrites `HANDOFF.md`, `inbox/` or `bots/`. `03_REVENUE_MAP.md` appears only if your private folder exists; it is local-only. Check it any time with `npm run bundle:shared -- --check` (the folder-check form is `node tools/ai-bundle/build.mjs --check --shared`).

## Step 2. Reply to Grok's offer

Paste this (replace `<FOLDER>` with the path printed in step 1):

```
Yes, create the SBH Chief bot, point it at <FOLDER>, and here are the starting files already in it. Read README_FIRST.md first, then HANDOFF.md, DECISIONS.md and your inbox. The Chief keeps the folder tidy and creates specialist bots (design-QA, art/image-keeper, economy/revenue analyst, QA/playtest, marketing/community drafter, ops/analytics). Claude is the Lead and decides canon; Codex handles engineering; I have final say. Nobody posts, spends, creates accounts or contacts people without my explicit OK. 03_REVENUE_MAP.md is private: never paste it anywhere.
```

## Step 3. Give the Chief its system prompt

Open `docs/ai-team/prompts/grok-chief.md` (or `prompts/grok-chief.md` in the PUBLIC bundle, which already has the core context inlined) and paste everything under the line. Replace `<FOLDER>`. Ask the Chief to answer the understanding check from `ONBOARDING.md` before it starts.

## Step 4. Create the specialists

Ask the Chief to create the six specialists from `prompts/grok-specialists.md`. Each gets the Common preamble plus its own block. Have the Chief record each one in `bots/README.md`. Start with design-QA and QA/playtest; add the others as needed. Specialists propose only; marketing drafts only.

## Step 5. Group chat

Create one group chat containing the Chief and the specialists you want active. Use it for pings and quick questions. Anything that matters must be written to a file (`HANDOFF.md`, an inbox note, or `DECISIONS.md` under "PROPOSED BY OTHERS"), because bots only wake when someone messages them and forget the rest.

## Step 6. The wake-up caveat and the standing ping

Bots do not run on their own. Send this 5-line ping at the start of a work session (you, Claude or Codex can send it):

```
SBH session start.
1) Read HANDOFF.md, DECISIONS.md and your inbox in <FOLDER>.
2) Do your lane's work (Chief: triage the inbox, check mirror freshness, update the roster).
3) Append a dated entry to HANDOFF.md and write results as inbox notes.
4) Remind me of anything that needs my OK. Do not post, spend, create accounts or contact anyone.
```

## Step 7. Keeping it in sync

- After docs change in the repo, refresh with `npm run bundle:shared`.
- Claude (or Codex) reads `HANDOFF.md` and `inbox/`, folds important items into the repo (`docs/NEXT_ACTION.md`, a PR or an issue) and marks them "Folded into repo: yes".
- Weekly: run the refresh, send the ping, skim `HANDOFF.md`.

## If Grok cannot read local files

Use the PUBLIC bundle instead (`npm run bundle:ai`): paste `prompts/grok-second-lead.md` or `grok-chief.md`, plus `CODE_MAP.md`. The Chief then works through RESULT BLOCKs that you or a local agent save into the shared folder's `inbox/grok/`.
