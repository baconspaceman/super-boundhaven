# Mounts and Metroidvania exploration

Status legend: **Confirmed** = Anthony's words (2026-09-30). **Proposal** = Claude's suggestion, not accepted until Anthony says so.

## Confirmed

- Rideable mounts are not one creature. They are many different animals, each doing different things.
- Roster: **frog**, **dinosaur**, **flying dinosaur**, **cheetah**. More animals may come later, but **no wolf is planned** (Anthony, 2026-09-30: the "wolves" in the voice note was not an intended mount).
- **Difficulty (2026-09-30, [CONFIRMED]):** getting mounts must not be too difficult. See `DIFFICULTY_PHILOSOPHY.md`. Mounts are obtainable with moderate effort by an average player: no brutal gates, never behind raids.
- The **Action/Activate button** (confirmed 2026-09-30) summons and dismounts mounts and triggers the mount's signature ability.
- Players can **summon** a mount in the open world **anytime** they want.
- Some levels and some open-world areas **require** a specific mount (example given: a frog is needed to pass a certain part of the open world).
- The open world has **Metroidvania-style exploration**: secrets, other hidden content, and Easter eggs to find, gated by abilities/mounts.
- Mounts must be original designs (Yoshi-like only in gameplay role), per the design brief.

## Proposals (not accepted)

| Mount | Identity | Possible signature ability | Possible gate use |
|---|---|---|---|
| Frog | Bouncy, amphibious | Charged super-jump, swim/lily-pad hopping, tongue-style tether to anchor points (an anchor swing, not a Yoshi-like enemy grab) | Wide water/pit gaps, underwater passages, tongue-anchor ledges |
| Dinosaur | Sturdy ground bruiser | Ground-pound / horn charge that breaks cracked blocks and stuns; survives one hit | Breakable walls, heavy switches, thorny hazards |
| Flying dinosaur | Airborne | Limited flap-glide/flight (stamina meter), updraft riding | Sky islands, tall shafts, cloud-region access |
| Cheetah | Speed | Sprint dash with a higher top speed, run up steep slopes, long leaps | Speed gates/timed doors, crumbling bridges, steep slopes |

Design guardrails worth keeping:
- Mounts add abilities on top of the base moveset; base movement must still make hard content possible (brief). Mount-gated areas are optional secrets or named alternative routes, so the main path never hard-locks a player who lacks a mount without a way to obtain it.
- Every mount gate should be visually telegraphed (shape of the obstacle hints at the mount).
- Summon cost/cooldown, stamina, mount health and where mounts are allowed (raids? races? events?) are open questions. (Acquisition is decided: friendly quests, see below.)
- Co-op: mounts can carry a passenger? Mount stomp-bounce rules? Undecided.
- Fairness: mounts in competitive events/leaderboards need separate rules (see normalized leaderboards proposal).

Further decisions (see `GAME_DESIGN_DOCUMENT.md` section 5):

**Acquisition [ACCEPTED-DELEGATED 2026-09-30, implements the confirmed "not too difficult" rule]:**
- Each mount is earned through a **short, friendly, non-punishing questline** in its home region (about 3 stages, about 15 to 45 minutes total), solo-doable by an average player with the base moveset.
- Free, permanent, never sold, never in the skill tree, **never behind raid or brutal content**, no grind, no trade or consumable required.
- Checkpoints before every stage, instant retry, hints and stuck-nudges, optional assists (see `DIFFICULTY_PHILOSOPHY.md`).
- Each mount may offer **optional hard cosmetic/bonus challenges** (alternate coats, titles, a bonus time trial). These grant recognition only, never power.
- Release gate: no mount ships until at least 9 of 10 average-skill playtesters finish its questline unassisted within the target time.
- The frog questline is early (starter region), so the confirmed frog gate is not a long wait.

**Gates:** every required-path mount gate has a loaner mount or alternate route (G1); the mount is obtainable before it is required (G2); added **G9**: mount acquisition itself is never gated behind content harder than the T2 tier.

Per-level mount policy `none | loaner | free`; frog "tongue" reframed as an anchor tether (avoid Yoshi-like enemy eating) remain proposals (not yet accepted).

Still open: summon cooldown/stamina, mount health, passengers, mounts in races (GDD section 5.3).

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
