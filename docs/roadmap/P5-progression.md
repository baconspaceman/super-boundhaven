<!-- core:start -->
**P5 Progression: skill tree, mastery, gear (M8).** Goal: long-term growth that rewards skill and never replaces it. Decided by Anthony: both a skill-point tree and mastery-by-use, with free respecs. Delegated defaults: mastery first then the tree overlay, trait slots, 3 presets, gear capped by Movement Budget, launch equipment counts (about 8 headwear, 8 tops, 6 bottoms, 6 footwear, 4 back, 4 accessories carry gear stats). Scope: mastery-by-use tracking, points tree overlay, instant free respec, gear slots/rarity/affixes with stacking limits, persisted loadouts, equipment art, balance tooling, first-hour/day/month progression tuning. Entry: P3 persistence (RM-055) and P4 profile/budget (RM-070, RM-076). Exit: perks capped, no double-dipping between tree and mastery, respec verified free and instant, balance simulations show no build breaks the Classic ceiling. Risks: power creep, trait combinatorics. Leads: Claude (design, art, sim hooks), Codex (persistence, validation), Grokbot (balance sweeps with bots). Size: XL. See `docs/design/SKILL_TREE_AND_ABILITIES.md`.
<!-- core:end -->

# P5 Progression

| ID | Item | Status | Owner | Size | Acceptance |
|---|---|---|---|---|---|
| RM-080 | Mastery-by-use tracking (server-authoritative counters per move) | Later | Claude + Codex | L | Counters persist; no client-set values; tier thresholds in a data file |
| RM-081 | Skill-point tree overlay | Later | Claude | L | Prereq validation server-side; tree data versioned |
| RM-082 | Free instant respec and 3 presets | Later | Claude | M | Respec costs nothing, verified by test; preset save/restore |
| RM-083 | Gear system: slots, rarity, affixes, stacking limits, Movement Budget cap | Later | Claude | L | Over-budget loadout rejected; stat list in data |
| RM-084 | Loadouts/builds persisted per account/guest | Later | Codex | M | Round-trip tests |
| RM-085 | Launch equipment art set (counts per delegated default) | Later | Claude | L | Layered into creator/compose; art test; originals only |
| RM-086 | Balance tooling: budget calculator, bot sweeps across builds on fixed courses | Later | Grokbot | M | Report ranks builds by clear time; flags outliers |
| RM-087 | Progression flow tuning: first hour / day / month | Later | Claude | M | Playtest notes per slice |
