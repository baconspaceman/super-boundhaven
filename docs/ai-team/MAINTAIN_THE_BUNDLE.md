# Maintaining the AI bundle and the shared folder

<!-- core:start -->
**Core summary.** `node tools/ai-bundle/build.mjs` (npm `bundle:ai`) generates a PUBLIC bundle (safe for any AI) and a LEAD bundle (adds the owner's private folder; local trusted leads only) outside the repo, with `CONTEXT_CORE.md` (all `core:start`/`core:end` blocks in a fixed order, target about 12k tokens), `CONTEXT_FULL_part*.md` (every public doc in parts of at most 150k characters), `CODE_MAP.md`, role prompts with the core inlined, a source zip of the last commit, `MANIFEST.json` with SHA-256 hashes and `VERIFY.md`. `npm run bundle:shared` refreshes the live shared project folder for Grok-side agents: numbered generated files 01 to 06, CONTEXT_CORE, CODE_MAP, prompts and source, while never overwriting `HANDOFF.md`, `inbox/`, `bots/` or the proposals section of `DECISIONS.md`; `03_REVENUE_MAP.md` appears only when the private folder is supplied. `--check` validates hashes and scans for secrets, personal emails, local absolute paths, server-data paths and private text leaks. Core blocks in the repo docs are the single source for CONTEXT_CORE: edit them, then rebuild. Refresh after every docs milestone and weekly.
<!-- core:end -->

## 1. Commands

```
npm run bundle:ai                      # build PUBLIC + LEAD bundles (default: workspace/ai-team-bundle/)
npm run bundle:ai:check                # verify the newest bundle
npm run bundle:shared                  # refresh the shared project folder
npm run bundle:shared -- --check       # validate the shared folder
node tools/ai-bundle/build.mjs --out <dir> --private <dir> --budget 18000 --no-zip --no-source --no-private --date YYYY-MM-DD
node tools/ai-bundle/build.mjs --check <bundleDir>
```

- `--out` is the parent folder for the bundle; it must be outside the repo. `--private` defaults to the sibling private folder next to the repo when it exists; it must also be outside the repo. `--budget` is the CONTEXT_CORE token target (chars/4); the builder warns, it does not truncate.
- The source zip is `git archive HEAD`: committed files only. Docs in the bundle come from the working tree, so uncommitted docs are included while uncommitted code is not. The builder warns when the tree is dirty; commit first for a faithful bundle.
- Re-running is safe: the bundle folder is regenerated (same name for the same date and commit). Output is deterministic apart from the timestamp.

## 2. What is in each bundle

| File | Purpose |
|---|---|
| `00_START_HERE.md` | What it is, which file to give which AI, 60-second orientation |
| `CONTEXT_CORE.md` | All core blocks, ordered, with source headers (about 18k tokens target) |
| `CONTEXT_FULL_part01.md` ... | Every public doc, table of contents in part 01 |
| `CODE_MAP.md` | Generated layout, exports, protocol messages, levels, tests, scripts, ports |
| `prompts/` | Role prompts with CONTEXT_CORE inlined at the marker `<!-- bundle:inline-core -->` |
| `source/sbh-source.zip` | Last commit of the repo |
| `MANIFEST.json`, `VERIFY.md` | Hashes, token estimates, how to verify |
| LEAD only: `private/`, `PRIVATE_DO_NOT_PASTE_INTO_THIRD_PARTY_CHAT.md` | Owner's private documents; never leaves the machine |

## 3. Keeping CONTEXT_CORE small and correct

1. Core blocks are the single source. Every doc that matters starts with a `<!-- core:start -->` ... `<!-- core:end -->` summary (150 to 400 words). Never edit `CONTEXT_CORE.md` directly.
2. Order is fixed in the builder: AGENTS, README, DECISIONS, art north star, NEXT_ACTION, bible, GDD and design docs, mechanics, roadmap and board, ai-team docs, netcode, controls, creator, then anything else. Roadmap phase files (P0 to P10) are only in CONTEXT_FULL.
3. When over budget the builder prints the largest contributors. Trim those blocks first; prefer a shorter block over dropping a doc.
4. Never put private text, numbers from the private folder, secrets or local paths in a core block. The check fails if they appear.
5. Prompts (`docs/ai-team/prompts/`) and the inbox are not part of CONTEXT_CORE.

## 4. Handing the bundle to each AI

1. **Claude Code (Lead):** nothing to paste. Open the repo; it reads `CLAUDE.md` then `AGENTS.md`. Optional: the LEAD bundle for private context.
2. **Codex CLI:** open the repo; it reads `AGENTS.md`. Give it the prompt `prompts/codex-second-lead.md` as the first message. Optional LEAD bundle (local only).
3. **Grok (chat or API):** if it can read local files, point it at the shared folder (see `docs/ai-team/GROK_SETUP.md`). Otherwise paste `prompts/grok-second-lead.md` (or `grok-chief.md`), then `CODE_MAP.md`, then `CONTEXT_FULL` parts one per message.
4. **Kimi:** paste `prompts/kimi-support.md`; it can also use the local mailbox.
5. **Any other AI:** `prompts/generic-contributor.md` from the PUBLIC bundle. Never the LEAD bundle or `03_REVENUE_MAP.md`.

## 5. Paste limits

A prompt file is about `CONTEXT_CORE` plus 1 to 2k tokens. If a chat tool cannot take it, paste in order: the prompt text above the marker, then `CONTEXT_CORE.md`, then the rest of the prompt. `CONTEXT_FULL` parts are at most 150k characters each (about 37k tokens); if that is still too large for a tool, ask the Chief or a local agent to split further, or rely on `CODE_MAP.md` and `CONTEXT_CORE.md`.

## 6. The shared project folder

`npm run bundle:shared` writes `README_FIRST.md`, `01_DESIGN_BIBLE.md`, `02_MECHANICS_AND_ROADMAP.md`, `03_REVENUE_MAP.md` (private; only when the private folder exists), `04_IMAGE_AND_MAINTENANCE_GUIDES.md`, `05_TEAM_AND_OPERATING_SYSTEM.md`, `06_BUNDLE_BUILDER.md` (this document plus a size table), `CODE_MAP.md`, `CONTEXT_CORE.md`, `prompts/`, `source/sbh-source.zip`, `MANIFEST.json` and the regenerated top of `DECISIONS.md`. It creates, only when missing, `HANDOFF.md`, `inbox/<agent>/README.md` for claude, codex, grok, kimi and anthony, `inbox/README.md` and `bots/README.md`. It writes there only when `--shared` is passed. A generated file that someone edited is overwritten on the next refresh, so propose changes via `HANDOFF.md` or an inbox note instead. `--check --shared` flags edited generated files, missing banners, private leaks and secret-looking text.

## 7. When docs change: what to update

| Change | Do |
|---|---|
| New or edited doc | Update its core block, then `npm run bundle:ai` |
| New doc that should appear in CONTEXT_CORE | Add a core block; add it to the rank list in `tools/ai-bundle/build.mjs` if it needs a specific position; add it to `EXPECTED` if it is mandatory |
| New role or prompt | Add `docs/ai-team/prompts/<name>.md` with the marker; it is picked up automatically |
| Over budget | Trim the largest blocks the builder prints |
| Code layout changed | Nothing: `CODE_MAP.md` is regenerated |
| Private folder changed | Rebuild the LEAD bundle and `npm run bundle:shared` (only local) |

## 8. Recommended rhythm

- After every docs milestone or merged feature PR: rebuild; run the check.
- Weekly: rebuild, refresh the shared folder, send the session-start ping to the Chief, skim `HANDOFF.md`, fold items into the repo.
- Before handing anything to a third-party tool: confirm it is the PUBLIC bundle, run `--check`, and make sure the tree was committed.
- Never commit generated bundles or the shared folder; never publish the private folder or the private history bundle.
