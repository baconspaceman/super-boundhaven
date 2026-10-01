# Mounts and Metroidvania exploration

Status legend: **Confirmed** = Anthony's words (2026-09-30). **Proposal** = Claude's suggestion, not accepted until Anthony says so.

## Confirmed

- Rideable mounts are not one creature. They are many different animals, each doing different things.
- Starting roster: **frog**, **dinosaur**, **flying dinosaur**, **cheetah**. (Voice note said "First, wolves"; read as "first, [the following]". A wolf may be a later or extra mount. Unconfirmed.)
- Players can **summon** a mount in the open world **anytime** they want.
- Some levels and some open-world areas **require** a specific mount (example given: a frog is needed to pass a certain part of the open world).
- The open world has **Metroidvania-style exploration**: secrets, other hidden content, and Easter eggs to find, gated by abilities/mounts.
- Mounts must be original designs (Yoshi-like only in gameplay role), per the design brief.

## Proposals (not accepted)

| Mount | Identity | Possible signature ability | Possible gate use |
|---|---|---|---|
| Frog | Bouncy, amphibious | Charged super-jump, swim/lily-pad hopping, sticky-tongue grab on anchor points | Wide water/pit gaps, underwater passages, tongue-anchor ledges |
| Dinosaur | Sturdy ground bruiser | Ground-pound / horn charge that breaks cracked blocks and stuns; survives one hit | Breakable walls, heavy switches, thorny hazards |
| Flying dinosaur | Airborne | Limited flap-glide/flight (stamina meter), updraft riding | Sky islands, tall shafts, cloud-region access |
| Cheetah | Speed | Sprint dash with a higher top speed, run up steep slopes, long leaps | Speed gates/timed doors, crumbling bridges, steep slopes |

Design guardrails worth keeping:
- Mounts add abilities on top of the base moveset; base movement must still make hard content possible (brief). Mount-gated areas are optional secrets or named alternative routes, so the main path never hard-locks a player who lacks a mount without a way to obtain it.
- Every mount gate should be visually telegraphed (shape of the obstacle hints at the mount).
- Summon cost/cooldown, stamina, mount health, where mounts are allowed (raids? races? events?) and whether mounts are unlocked via quests, secrets or shop are open questions.
- Co-op: mounts can carry a passenger? Mount stomp-bounce rules? Undecided.
- Fairness: mounts in competitive events/leaderboards need separate rules (see normalized leaderboards proposal).

Further proposals (see `GAME_DESIGN_DOCUMENT.md` section 5; not accepted): acquisition through exploration quests, free and never sold or in the skill tree; per-level mount policy `none | loaner | free`; gate fairness rules G1-G8; frog "tongue" reframed as an anchor tether (avoid Yoshi-like enemy eating).

## Engineering implications (for later milestones)

- The sim needs a `mount` state on `PlayerState` and per-mount movement configs (new deterministic logic; keep in `packages/sim`).
- Level format needs "gate" tiles/objects (mount-required barriers, anchors, updrafts, breakable blocks) and a region/zone graph for Metroidvania progression and map discovery.
- Persistence is needed for unlocks, discovered secrets and mount roster; this needs the account/persistence decisions first (OPEN_QUESTIONS).
- Art: 4 mounts × (idle, move, jump/fall, ability, summon poof, rider-seat anchors), plus rider pose set. Mount art follows `docs/ART_NORTH_STAR.md` (bold, chunky, cheerful, original).

## Suggested order

1. Finish core movement + shared playground (in progress).
2. Mount system prototype with one mount (frog), proving summon, mount physics in the shared sim, and one gated area.
3. Add cheetah, dinosaur, flying dinosaur once the gate/level-object format is proven.
4. Zone graph, map/discovery UI, secrets/Easter egg framework.
