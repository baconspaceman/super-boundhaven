<!-- core:start -->
**P8 Economy and items (M11).** Goal: a trustworthy item economy with no paid power and no real-money gambling. Accepted principles: no pay-to-win (cosmetics-only for anything sold, if monetization is ever approved), atomic direct trade first and a market later, transactional ledger with idempotency, casino/cat lore is fictional with non-cashable tokens and no loot boxes. Scope: placeholder currency design (names pending from Anthony), ledger and transactional store, atomic two-party trade, crafting and sinks, market/auction, dupe and scam detection with audit tooling, casino-lore tokens (mechanics blocked), and a monetization surface that stays blocked until Anthony decides. This roadmap deliberately contains no prices, reward amounts or revenue plans; a private revenue roadmap exists, held by Anthony and the lead. Entry: P3 persistence and accounts (RM-055, RM-056); P5 gear for tradeable items. Exit: dupe tests pass, ledger reconciles under bot-driven trade storms, scam-resistance review done. Risks: dupes, scams, legal exposure. Leads: Codex (ledger, trade, audit), Claude (item design, crafting, sinks), Grokbot (trade-storm bots, anomaly reports). Size: XL.
<!-- core:end -->

# P8 Economy

| ID | Item | Status | Owner | Size | Acceptance |
|---|---|---|---|---|---|
| RM-130 | Currency/item model with placeholder names (final names pending) | Later | Claude | S | Data-driven names so renames are one-file; no values promised |
| RM-131 | Ledger and transactional store, idempotent operations | Later | Codex | L | Every mutation is a ledger entry; replayed request is a no-op; tests |
| RM-132 | Atomic direct trade (both sides commit or neither) | Later | Codex + Claude | L | Fault-injection tests: crash mid-trade leaves no dupes/loss |
| RM-133 | Crafting and sinks | Later | Claude | L | Recipes in data; sink/source report from bots |
| RM-134 | Market/auction (after trade proves stable) | Later | Codex | XL | Listing/fee logic behind flags; abuse limits |
| RM-135 | Dupe/scam detection and ledger audit tooling | Later | Codex + Grokbot | L | Bot trade storm shows zero imbalance; anomaly report |
| RM-136 | Casino-lore tokens and games (fictional, non-cashable, no loot boxes) | Blocked (Anthony: mechanics) | Claude | L | Cannot start mechanics until decision recorded |
| RM-137 | Monetization surface (cosmetics-only principle) | Blocked (Anthony) | Codex + Claude | L | Nothing built until model, terms and legal posture are approved |
