# Open questions

> **Update 2026-09-30:** question 1 (first proof) was answered: a shared multiplayer movement playground. Question 2 (stack) was answered: TypeScript end to end (Vite + PixiJS client, Node `ws` authoritative server). Question 3 (netcode) was answered for the prototype: client prediction + server authority + reconciliation, players physically collide. Input/devices (4) and the first co-op room (5) remain open. See `DECISIONS.md`. The full prioritized queue is in `docs/design/GAME_DESIGN_DOCUMENT.md` section 14.

Resolve the first group before committing to a broad implementation. Claude can research options and present tradeoffs; do not silently convert defaults into accepted requirements.

## First decisions

1. What is the smallest first playable proof: local movement only, or an immediately shared browser playground? What demonstrates acceptable movement feel?
2. Which engine/stack supports browser delivery, later Steam cross-play, precise simulation, and maintainable tools? Compare options before choosing.
3. What network authority, reconciliation, collision/bounce model, and target latency make coordinated movement fair? What happens when a player disconnects?
4. Which inputs/devices/browsers are initially supported? Are touch controls and mobile required?
5. What fits the first small region and cooperative challenge, and what are its checkpoint/retry rules?

## Game rules and scope

- Is the hardest raid minimum six or eight players, and what is its cap? Can smaller groups enter easier content? How do synchronization and recovery work?
- Which movement actions are core versus mount/powerup/gear abilities? What measurable reference behaviors are wanted from SMW study?
- How will the base-moveset completion requirement be demonstrated without making every route identical? What is fair gear advantage in competitive events?
- Is there a skill tree? What stats, stacking limits, tradeoffs, and loadout restrictions exist?
- Which region themes are launch priorities? How do shared overworlds connect to instances and races?
- What is persisted initially: position, inventory, unlocks, loadouts, level records, friendships?

## Community and economy

- What editor/upload format is supported? How are impossible, abusive, infringing, or unsafe levels rejected? Who can publish, select, appeal, or remove them?
- Does weekly selection use AI, humans, or a hybrid? What are the eligibility and featured-reward rules?
- Direct trade, offline listings, or both? How will atomic exchange, duplication prevention, scams, and rollback be handled?
- What currencies, sinks, crafting, equipment rarity, and item sources exist?
- Is paid power allowed? What precisely do support tiers and community goals promise?
- How are downloads/players and early-player eligibility defined for hypothetical reward milestones? How are privacy and supporter-name consent handled?
- What casino activities fit the game? No real-money gambling has been specified.

## Production and operations

- Account identity, browser/Steam linking, privacy, chat safety, permissions, anti-cheat, abuse reports, and age/audience expectations?
- Expected initial concurrency, hosting budget, operational responsibilities, and performance targets?
- Art pipeline, native pixel resolution, animation standards, asset licenses, and name/rights review?
- How should Claude and other models divide work and preserve a shared source of truth?

## Mounts and exploration (added 2026-09-30)

- Was "wolves" an extra mount or a voice artifact? What is the full mount wishlist beyond frog, dinosaur, flying dinosaur, cheetah?
- How are mounts obtained (quests, secrets, shop, level-ups)? Summon cooldown/stamina/mount health? Are mounts allowed in raids, races, events, leaderboards?
- Can mounts carry passengers or take part in player bounces?
- How strict are mount gates: optional secrets only, or also required progression with alternate routes?
- Map/discovery UI, zone graph, secret tracking, and Easter-egg framework scope?
