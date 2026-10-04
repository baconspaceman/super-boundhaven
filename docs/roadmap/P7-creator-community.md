<!-- core:start -->
**P7 Creator tools and community (M10, M12).** Goal: players make and share levels safely, and the community has things to do together. Delegated defaults: editor v1 is tile-only; weekly featured is a hybrid (automated shortlist plus human pick); rewards are recognition/cosmetic only and nothing is promised; quick-chat only for chat until Anthony decides. Scope: versioned `Level` format and validator, tile-only editor, uploader-must-clear replay proof, upload API and storage, moderation tooling (report, queue, takedown), weekly featured pipeline, race and time-attack events, social basics (friends, parties, block/report), community goals page, the community/ops bot, changelog/devlog generation. Entry: P3 persistence and accounts decisions; P2 replay recorder. Exit: safe submission pipeline with measured proof pass rate; moderation workflow exercised with test content; events run on Classic rules. Blocked on Anthony: moderation policy, ToS, takedown handling, reward specifics, what goes on the community goals page. Risks: abuse via user content (legal exposure), child safety. Leads: Claude (editor, level format, events design), Codex (upload/validation/moderation backend), Grokbot (community/ops bots, featured shortlist automation, analytics). Size: XL.
<!-- core:end -->

# P7 Creator and community

| ID | Item | Status | Owner | Size | Acceptance |
|---|---|---|---|---|---|
| RM-110 | Versioned Level schema v1 + validator (size caps, entity limits, tile whitelist) | Next | Claude + Codex | M | Existing levels pass; malformed fixtures rejected; schema doc |
| RM-111 | Level editor v1, tile-only | Later | Claude | XL | Place/erase/test-play; export validated JSON; works with gamepad+keyboard |
| RM-112 | Replay-proof of solvability (uploader must clear) | Later | Codex | L | Re-sim confirms clear; tampered replay rejected |
| RM-113 | Upload API and storage | Blocked (needs accounts, RM-056) | Codex | L | Auth, size caps, rate limits, per-user quotas |
| RM-114 | Moderation tooling: report, review queue, takedown, audit log | Blocked (policy: Anthony); tooling may be built against placeholder policy | Codex + Grokbot | L | Queue works end to end on test data; Anthony approves policy before enabling |
| RM-115 | Weekly featured pipeline: automated shortlist, human pick | Later | Grokbot (shortlist), Anthony (pick) | M | Shortlist report; nothing publishes without Anthony |
| RM-116 | Events: races and time attacks | Later | Claude + Codex | L | Event boards use Classic ruleset; deterministic ghosts |
| RM-117 | Quick-chat and emote system (UI side of RM-057) | Later | Claude | M | Wheel/menu, gamepad navigable |
| RM-118 | Social: friends, parties, block, report | Later | Codex | L | Block hides player and chat; report feeds RM-114 queue |
| RM-119 | Community goals page (static scaffold now; content, numbers and promises from Anthony) | Blocked (content: Anthony) | Grokbot | M | Scaffold with placeholder text; no figures or promises |
| RM-120 | Community/ops bot, Discord-ready, draft-only (spec in `docs/ai-team/WORKSTREAMS.md`) | Next | Grokbot | M | Generates drafts to an outbox; never posts without Anthony |
| RM-121 | Changelog/devlog generator from git history and board | Later | Grokbot | S | Markdown output, reviewed by Anthony before publishing |
