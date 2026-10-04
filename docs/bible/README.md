<!-- core:start -->
# Super BoundHaven Design Bible: table of contents (bible v1.0)

The Design Bible is the canonical, all-inclusive description of what Super BoundHaven (SBH) is. It exists so that any AI (Claude is lead; Codex and Grokbot are second leads) or any human can pick the project up cold and make decisions consistent with the owner's vision. It consolidates the scattered design, art, netcode and decision documents. It does not replace them and never contradicts them: `DECISIONS.md` (the dated accepted-decisions log; later entries win) remains the authority for what Anthony decided.

SBH is an independent, long-term, open-ended 16-bit side-scrolling platforming MMO: precise movement with a real skill gap, a shared open world where players physically collide and bounce, original rideable mounts, Metroidvania-style exploration, genuinely cooperative dungeons and eight-player raids, and community levels. Browser first, Steam later. Art keeps the Super Mario World essence with 100 percent original designs. Everything is original; no third-party assets.

Every claim carries a status tag: **[CONFIRMED]** (Anthony's own words), **[ACCEPTED-DELEGATED]** (Anthony said "you decide" and the lead adopted a documented recommendation; revisable any time), **[PROPOSAL]** (suggestion awaiting Anthony; never treat as decided), **[OPEN]** (unresolved). Money, legal exposure, real-world risk and public promises are never decided by delegation.

Reading order for a cold start: this file, then `DESIGN_BIBLE.md`, then `CANON_REGISTER.md` (especially its "Never contradict these" list), then whichever topic file your task touches. Small-context AIs can use the concatenated `core` blocks (the first block of every file) instead.

Status today: pre-alpha prototype. Implemented: shared deterministic movement simulation, authoritative server, prediction netcode, layered character creator, three art regions with four times of day, gamepad and keyboard controls, and a two-to-four player co-op room. Everything else is design only. See `SYSTEMS_STATUS.md`.
<!-- core:end -->

## Files

| File | What it holds |
|---|---|
| [DESIGN_BIBLE.md](DESIGN_BIBLE.md) | Master overview: vision, pillars, audience, pitches (one paragraph, one page, elevator pitches), what SBH is and is not, long-term ambition |
| [CANON_REGISTER.md](CANON_REGISTER.md) | Every fact tagged CONFIRMED / ACCEPTED-DELEGATED / PROPOSAL / OPEN with source; the "Never contradict these" list; doc inconsistencies found |
| [WORLD_BIBLE.md](WORLD_BIBLE.md) | All 14 regions, zone graph, time of day, per-region implementation status |
| [LORE_BIBLE.md](LORE_BIBLE.md) | The haven, Bound Shards, the cat construction site and casino, factions, in-world glossary, naming rules and candidate names |
| [CHARACTERS_AND_CREATURES.md](CHARACTERS_AND_CREATURES.md) | Layered humanoid creator, enemy species, mounts, silhouette and color rules, animation vocabulary, how to add new ones |
| [TONE_AND_VOICE.md](TONE_AND_VOICE.md) | Voice, words to use and avoid, microcopy examples, plain-language and localization rules |
| [UX_AND_ACCESSIBILITY.md](UX_AND_ACCESSIBILITY.md) | Screens and flows, HUD rules, controller parity, assists, readability, colorblind-safe cues, motion, captions, safety and chat posture |
| [AUDIO_DIRECTION.md](AUDIO_DIRECTION.md) | Music per region, SFX vocabulary, mix rules, licensing and provenance rules (all proposal; no audio exists yet) |
| [PROGRESSION_AND_CONTENT.md](PROGRESSION_AND_CONTENT.md) | Content ladder, first hour/day/month, tutorial, mount questlines, mastery and skill tree, difficulty tiers, co-op, raids, events, creators |
| [SYSTEMS_STATUS.md](SYSTEMS_STATUS.md) | Every design system mapped to Implemented / Prototype / Planned / Proposal and to repo paths |
| [GLOSSARY.md](GLOSSARY.md) | Every term |
| [FAQ.md](FAQ.md) | 40-plus contributor and AI questions with authoritative answers and who decides |
| [CHANGE_PROTOCOL.md](CHANGE_PROTOCOL.md) | How the bible changes, versioning, "is this on-canon?" checklist, changelog |

## Related documents outside the bible

| Topic | Path |
|---|---|
| Accepted decisions (authority) | [../../DECISIONS.md](../../DECISIONS.md) |
| Open questions for Anthony | [../../OPEN_QUESTIONS.md](../../OPEN_QUESTIONS.md) |
| Original brief | [../../DESIGN_BRIEF.md](../../DESIGN_BRIEF.md) |
| Master GDD and detail docs | [../design/GAME_DESIGN_DOCUMENT.md](../design/GAME_DESIGN_DOCUMENT.md), [../design/SKILL_TREE_AND_ABILITIES.md](../design/SKILL_TREE_AND_ABILITIES.md), [../design/MOUNTS_AND_EXPLORATION.md](../design/MOUNTS_AND_EXPLORATION.md), [../design/DIFFICULTY_PHILOSOPHY.md](../design/DIFFICULTY_PHILOSOPHY.md), [../design/COOP_ROOM_M3.md](../design/COOP_ROOM_M3.md) |
| Exact numeric mechanics (written separately) | [../mechanics/](../mechanics/) |
| Roadmap | [../ROADMAP.md](../ROADMAP.md) |
| AI team working agreements | [../ai-team/](../ai-team/) |
| Art authority | [../ART_NORTH_STAR.md](../ART_NORTH_STAR.md), [../ART_DIRECTION.md](../ART_DIRECTION.md), [../ART_WORLD.md](../ART_WORLD.md), [../ART_OBJECTS.md](../ART_OBJECTS.md) |
| Creator, controls, netcode | [../CHARACTER_CREATOR.md](../CHARACTER_CREATOR.md), [../CONTROLS.md](../CONTROLS.md), [../NETCODE.md](../NETCODE.md) |
| Handoff | [../NEXT_ACTION.md](../NEXT_ACTION.md) |

## Precedence when documents disagree

1. `DECISIONS.md` accepted-decisions log (later dated entries win).
2. This bible (it records the resolution of known conflicts in `CANON_REGISTER.md`).
3. Detail docs in `docs/design/`, art docs, `CONTROLS.md`, `NETCODE.md`.
4. Public site copy (`apps/site`), which must follow the above and never promise more.
5. Code is the truth about what is *built*; docs are the truth about what is *intended*.

Licensing: these documents are CC BY-NC-SA 4.0 like the rest of the project docs; the "Super BoundHaven" name and logo are reserved.
