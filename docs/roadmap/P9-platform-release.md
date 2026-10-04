<!-- core:start -->
**P9 Platform, quality and release (M14 plus cross-cutting tracks).** Goal: ship-quality foundations that are mostly independent of content: accessibility, localization, documentation and developer experience, CI hardening, performance budgets, legal clearance, Steam build and browser/Steam cross-play, and release engineering. Several items start early (CI, docs, performance) and run continuously; Steam and cross-play come after the protocol is stable. Scope: accessibility (remapping exists; add colour-blind-safe cues, reduced motion/flash, hold-vs-toggle, scalable UI, subtitles for audio cues), localization framework, dev onboarding and ADR habit, CI additions (lint, coverage, browser smoke test, audit step), client performance budget (frame time, bundle size, asset loading), provenance and licence audits, Steam wrapper research then build (Steamworks account is Anthony-only), cross-play, release engineering (versioning, changelog, rollback, feature flags, migration runbooks), touch input parked (no touch at launch). Entry: varies; Steam needs P3 accounts. Exit: documented release checklist run end to end on a staging build; accessibility review passes; Steam build boots and plays on a cross-play server. Blocked on Anthony: final title/legal clearance, Steam account, any spend. Leads: Codex (CI, release, Steam, perf), Claude (accessibility, localization, docs), Kimi (docs/dev-experience support). Size: XL.
<!-- core:end -->

# P9 Platform, quality, release

| ID | Item | Status | Owner | Size | Acceptance |
|---|---|---|---|---|---|
| RM-140 | Accessibility: colour-blind-safe cues, reduced motion/flash, hold/toggle options, UI scale, audio-cue visuals | Later | Claude | L | Checklist review; options persisted; no flash above agreed threshold |
| RM-141 | Localization framework (string table, no hard-coded UI text) | Later | Claude | M | Second test locale renders; fallback to English |
| RM-142 | Steam build: wrapper research then build (Steamworks account Anthony-only) | Later; account Blocked | Codex | L | Research doc; packaged build boots with controller; no account created by agents |
| RM-143 | Browser/Steam cross-play | Later | Codex | L | Both clients in one room in test; shared protocol version policy (RM-064) |
| RM-144 | Release engineering: versioning, changelog, rollback, feature flags, migration runbooks | Later | Codex | L | Dry-run release on staging plan; rollback rehearsed |
| RM-145 | Client performance budget: frame-time, bundle size, atlas/asset loading | Later | Codex | M | Budget in CI as a warning, then a gate |
| RM-146 | Docs and developer experience: onboarding path, ADR template, AI-bundle friendliness (see `docs/ai-team/` and `docs/maintenance/`, written by other agents) | Next | Claude + Kimi | M | New contributor reaches green `npm test` and a local join in documented steps |
| RM-147 | CI hardening: lint, coverage report, browser smoke test, `npm run audit` in CI | Next | Codex | M | CI fails on audit FAIL; any new dev dependency cleared with Anthony first |
| RM-148 | Legal: final title and name clearance, third-party licence inventory | Blocked (Anthony) | Anthony + Codex | M | Clearance on record; NOTICE.md updated |
| RM-149 | Touch/mobile input (parked: "no touch at launch") | Later | Claude | L | Only starts after an explicit Anthony go |
| RM-150 | Provenance/asset audit tooling kept current (extends `tools/audit`) | Next | Codex | S | New asset classes covered; no third-party asset detected |
