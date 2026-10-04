<!-- core:start -->
**Decisions needed from Anthony.** Only Anthony may decide money, accounts, legal exposure, public promises, or sign anything. Anthony has said he will provide these once everything is complete, so agents must not nag; this file is the single parking list. For each item: what is blocked, what proceeds meanwhile with placeholders, and which roadmap IDs are affected. Items: monetization model and terms; early-player and download rewards and any launch date; casino/cat-lore mechanics beyond the no-real-money-gambling guardrail; login provider, privacy posture, age band and chat posture (interim default: quick-chat only, guest play); moderation policy, terms of service and takedown handling for uploaded levels; final title and legal clearance; character and currency names; whether the CC BY-NC-SA 4.0 licence on art/content should change once monetization is approved; hosting spend and accounts; Steamworks account. The roadmap carries no calendar dates, prices, reward amounts or launch promises; a private revenue roadmap exists outside this repository, held by Anthony and the lead, and is intentionally not reproduced here. Sources: `OPEN_QUESTIONS.md`, `DECISIONS.md`, GDD sections 9.5, 9.6, 14.
<!-- core:end -->

# Decisions needed

| # | Decision | Blocks | Proceeds meanwhile (placeholder) | IDs |
|---|---|---|---|---|
| D1 | Monetization model, supporter terms, community-goal promises | Any shop, supporter perks, community goals content | Principle stands: no paid power; cosmetics-only. Build item/cosmetic data with no price fields; scaffold community goals page with placeholder text | RM-119, RM-137 |
| D2 | Early-player/download rewards, launch dates | Any dated or reward promise on site/docs | Site keeps "no launch date"; waitlist keeps working | RM-063, RM-119 |
| D3 | Casino/cat-lore mechanics | Any token game mechanics | Fictional lore and art only; tokens non-cashable by rule; no loot boxes | RM-109, RM-136 |
| D4 | Login provider, privacy posture, age band, chat posture | Real accounts, free-text chat, data export/deletion policy | Guest tokens, quick-chat only, local persistence, interface-first accounts | RM-056, RM-057, RM-066, RM-167 |
| D5 | Moderation policy, ToS, takedown handling, weekly reward specifics | Public uploads | Build validator, replay proof, queue tooling against placeholder policy; uploads stay disabled | RM-113, RM-114, RM-115 |
| D6 | Final title and legal/name clearance | Store pages, trademark, public rebrand | Working title "Super BoundHaven"; name and logo reserved; names in data files for one-place rename | RM-148 |
| D7 | Character and currency names | Final UI strings and item data | Placeholder names in data files | RM-130 |
| D8 | License revisit (CC BY-NC-SA 4.0 art/content) after monetization is approved | Commercial use of art/content | Current licence stays | RM-148 |
| D9 | Hosting spend, domain, accounts | Public hosted server, staging deployment | Research doc, Dockerfile, drafted but disabled workflows, localhost testing | RM-050, RM-054 |
| D10 | Steamworks account and any Steam fees | Steam build upload | Wrapper research; local packaged build | RM-142 |
| D11 | Telemetry posture (what, if anything, may be collected) | Any collection | Schema design only; no collector, no third-party trackers | RM-066 |
| D12 | Waitlist retention/deletion policy | Long-term waitlist storage | Data stays git-ignored and local | RM-063 |
| D13 | Mount/exploration open details (cooldowns, passengers, map scope, Easter-egg scope) | Final mount rules | Working proposals in `docs/design/MOUNTS_AND_EXPLORATION.md`, labelled proposal | RM-071, RM-072, RM-090 |
