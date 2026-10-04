<!-- core:start -->
**P6 World, regions and Metroidvania exploration (M9 and content).** Goal: a world worth exploring. Delegated first content slice: Grassland, Caves, Factory, with the City as a later hub. Real art exists for meadow, meadow sunset and caverns; the site lists 12 concept regions (grassland, factory, jungle, underwater/pirate, caves, sky, lava, stormy, haunted, space, bayou, candy, desert) plus a city idea. Scope: zone graph and map/discovery UI, secrets and Easter-egg framework, no-hard-lock gate guarantee, the first content slice authored as real levels, each further region (art, mechanics, enemies), mirror and pursuing-threat variants (safety open), audio and original music, enemy and boss roster, and the cat construction site to casino region (fictional; no real-money gambling, non-cashable tokens, no loot boxes; mechanics blocked on Anthony). Entry: P4 mount framework for gates; P1 level authoring conventions. Exit: map works, gates fair, no hard-lock found in playtests, slice playable end to end. Risks: art throughput, scope. Leads: Claude (design, art), Codex (level validation tooling, audio runtime perf), Kimi (research for region motifs, original-only). Size: XL, open-ended.
<!-- core:end -->

# P6 World and regions

| ID | Item | Status | Owner | Size | Acceptance |
|---|---|---|---|---|---|
| RM-090 | Zone graph, map/discovery UI | Later | Claude | L | Map shows visited zones; data-driven; no spoilers on undiscovered |
| RM-091 | First content slice authored: Grassland, Caves, Factory levels | Later | Claude | XL | Each level registered, solvable by ghost-run test, art-complete |
| RM-092 | Clockwork Factory region (conveyors, gears, steam hazards) | Later | Claude | L | Tileset, backdrop, 2 mechanics, enemies |
| RM-093 | Canopy Jungle | Later | Claude | L | Same bar as RM-092 |
| RM-094 | Sunken Pirate Cove (underwater/pirate; swim physics decision) | Later | Claude | XL | Water physics spec accepted, then region |
| RM-095 | Cloudtop Isles (sky) | Later | Claude | L | Same bar |
| RM-096 | Ember Depths (lava) | Later | Claude | L | Same bar |
| RM-097 | Stormbreak Island (storm) | Later | Claude | L | Same bar |
| RM-098 | Hollow Manor (haunted) | Later | Claude | L | Same bar; pursuing-threat tie-in RM-105 |
| RM-099 | Orbit Gardens (space; low-gravity config) | Later | Claude | L | Per-region `cfg` via RM-070 |
| RM-100 | Mossy Bayou | Later | Claude | L | Same bar |
| RM-101 | Sugar Summit (candy) | Later | Claude | L | Same bar |
| RM-102 | Sunbaked Sands (desert) | Later | Claude | L | Same bar |
| RM-103 | City hub (trading, meeting up) | Later | Claude | XL | Needs persistence and channels (RM-055, RM-065) |
| RM-104 | Secrets and Easter-egg framework | Later | Claude | L | Authoring format, discovery persistence, tests |
| RM-105 | Mirror and pursuing-threat variants (safety review for motion/flash) | Later | Claude | M | Accessibility review passes (RM-140) |
| RM-106 | Audio runtime and original SFX set | Later | Claude | L | Mixer, categories, mute/volume UI; all assets original, provenance logged |
| RM-107 | Original music (composed in-house; no third-party tracks) | Later | Claude (Kimi research) | XL | Per-region loops with provenance entries |
| RM-108 | Enemy and boss roster expansion | Later | Claude | XL | Each enemy: sim rules, art, tests, stomp fairness |
| RM-109 | Cat construction site to casino region (fictional lore, tokens non-cashable) | Blocked (mechanics: Anthony) | Claude | L | Art and lore may proceed; no gambling mechanics until decision |
