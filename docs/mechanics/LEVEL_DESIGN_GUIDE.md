# Super BoundHaven: Level Design Guide

<!-- core:start -->
**Core summary.** Size every obstacle from the sim's measured numbers, not from feel. A body is <!--num:halfWidth-->7<!--/num-->x2 px wide and <!--num:height-->28<!--/num--> px tall; a held jump rises <!--num:d.apex.walkHeld-->62.2<!--/num--> px walking (3 tiles of ledge, 3 tiles of pit) and <!--num:d.apex.runHeld-->65.0<!--/num--> px running (4 tiles of ledge or wall, at most <!--num:d.maxGap.run-->8<!--/num--> tiles of pit, though that is frame-perfect). Think in timing windows: the number of ticks of jump-press timing that still succeeds. A 5-tile pit has a run window of <!--num:d.gapWin.run.5-->21<!--/num--> ticks (0.35 s) and cannot be walked; a 4-tile wall is cleared with a <!--num:d.wallWin.run.4-->27<!--/num--> tick window but only 1 px of apex margin. Difficulty tiers T0 to T5 map to window floors (proposal: 20, 15, 15, 8, 5, 2 ticks), and `generated/NUMBERS.md` computes the largest pit, wall and spike patch for each. Give runs at least 6 tiles of runway, landings 3 tiles of stopping room, put checkpoints before every distinct challenge and right behind every gate, and never place a required ledge over an enemy (a held stomp lifts <!--num:d.enemyStompApex.held-->98.3<!--/num--> px above its feet). To make a gate need N players use `need` plates at least 2 tiles apart, a ledge between the solo apex (<!--num:coop.soloBestPx-->65.0<!--/num--> px) and the held-stomp apex (<!--num:coop.stompBestPx-->112.3<!--/num--> px), or a timed lever whose best-case run (<!--num:coop.corridorRunTicks-->384<!--/num--> ticks) exceeds its timer (<!--num:coop.corridorTimerTicks-->300<!--/num-->). Set door `linger` to at least 1.3 times the slowest holder's run to the door, make doors full height, give every gate a far-side latch or reset lever. Then prove it: a "cannot" test that sweeps every jump timing and position with fewer players, and a "can" test with scripted bots (`packages/sim/test/bots.ts`), exactly as `coop.test.ts` does. A template level and test skeleton are at the end.
<!-- core:end -->

Prerequisite reading: [MECHANICS.md](MECHANICS.md) (what the numbers mean) and [TUNING_GUIDE.md](TUNING_GUIDE.md) (what moves them). All sizes below are measured by the generator on the real sim at the current config; if tuning changes, `npm run docs:mechanics` regenerates [`generated/NUMBERS.md`](generated/NUMBERS.md) and `mechanics-doc.test.ts` tells you which quoted value here is stale. Difficulty targets come from `docs/design/DIFFICULTY_PHILOSOPHY.md`; world and tone from `docs/bible/DESIGN_BIBLE.md`; the build plan from `docs/roadmap/`. Tier floors in this guide are a **[PROPOSAL]** until Anthony or the lead accepts them; the sim numbers are **[IMPLEMENTED]** facts.

## 1. The numbers a level designer needs

| Quantity | Value |
|---|---|
| Tile | <!--num:TILE-->16<!--/num--> px |
| Body (standing / crouched) | 14 x <!--num:height-->28<!--/num--> px / 14 x <!--num:crouchHeight-->16<!--/num--> px |
| Feet apex, held jump: standing / walking / running | <!--num:d.apex.standHeld-->58.9<!--/num--> / <!--num:d.apex.walkHeld-->62.2<!--/num--> / <!--num:d.apex.runHeld-->65.0<!--/num--> px (<!--num:d.apexTiles.standHeld-->3.68<!--/num--> / <!--num:d.apexTiles.walkHeld-->3.88<!--/num--> / <!--num:d.apexTiles.runHeld-->4.07<!--/num--> tiles) |
| Feet apex, tap jump | <!--num:d.apex.standTap-->32.0<!--/num--> px standing, <!--num:d.apex.runTap-->35.4<!--/num--> running |
| Air time (held) / air distance walking, running | <!--num:d.air.walkHeld-->42<!--/num--> and <!--num:d.air.runHeld-->43<!--/num--> ticks / <!--num:d.dist.walkHeld-->59<!--/num--> and <!--num:d.dist.runHeld-->112<!--/num--> px |
| Widest pit with perfect timing: walk / run | <!--num:d.maxGap.walk-->4<!--/num--> / <!--num:d.maxGap.run-->8<!--/num--> tiles |
| Tallest thin wall or wide ledge: walk / run | <!--num:d.maxWall.walk-->3<!--/num--> / <!--num:d.maxWall.run-->4<!--/num--> tiles |
| Widest floor spike patch: walk / run | <!--num:d.maxSpike.walk-->2<!--/num--> / <!--num:d.maxSpike.run-->6<!--/num--> tiles |
| Bounce pad apex: tap / held | <!--num:d.padApex.tap-->48.6<!--/num--> px (3 tiles) / <!--num:d.padApex.held-->148.7<!--/num--> px (<!--num:d.padApexTiles.held-->9.30<!--/num--> tiles) |
| Stomp apex above a standing partner's feet: tap / held | <!--num:d.stompApexFloor.tap-->50.9<!--/num--> / <!--num:d.stompApexFloor.held-->112.3<!--/num--> px; off a crouching partner held: <!--num:d.stompApexFloorCrouch.held-->100.3<!--/num--> px |
| Speed: walk / run / crouch | <!--num:d.walkTilesPerSec-->5.25<!--/num--> / <!--num:d.runTilesPerSec-->9.75<!--/num--> / <!--num:d.crouchTilesPerSec-->3.38<!--/num--> tiles/s |
| Time to full speed: walk / run | <!--num:d.walkAccelTicks-->20<!--/num--> ticks, <!--num:d.walkAccelDist-->14.7<!--/num--> px / <!--num:d.runAccelTicks-->38<!--/num--> ticks, <!--num:d.runAccelDist-->51.8<!--/num--> px |
| Stopping: skid / coast from run | <!--num:d.skidDist-->14.0<!--/num--> px / <!--num:d.coastDist-->32.5<!--/num--> px |

### Timing windows

The window is how many consecutive-ish ticks of jump-press timing succeed on a straight approach at steady speed (60 ticks = 1 s). It is the honest measure of how hard an obstacle is: it shrinks with size and it is what a player feels as "tight". Rows with window 0 are impossible.

| Size (tiles) | Pit walk | Pit run | Wall walk | Wall run | Floor spikes walk | Floor spikes run |
|---|---|---|---|---|---|---|
| 1 | <!--num:d.gapWin.walk.1-->45<!--/num--> | <!--num:d.gapWin.run.1-->54<!--/num--> | <!--num:d.wallWin.walk.1-->35<!--/num--> | <!--num:d.wallWin.run.1-->116<!--/num--> | <!--num:d.spikeWin.walk.1-->23<!--/num--> | <!--num:d.spikeWin.run.1-->32<!--/num--> |
| 2 | <!--num:d.gapWin.walk.2-->33<!--/num--> | <!--num:d.gapWin.run.2-->40<!--/num--> | <!--num:d.wallWin.walk.2-->32<!--/num--> | <!--num:d.wallWin.run.2-->113<!--/num--> | <!--num:d.spikeWin.walk.2-->11<!--/num--> | <!--num:d.spikeWin.run.2-->26<!--/num--> |
| 3 | <!--num:d.gapWin.walk.3-->22<!--/num--> | <!--num:d.gapWin.run.3-->34<!--/num--> | <!--num:d.wallWin.walk.3-->28<!--/num--> | <!--num:d.wallWin.run.3-->110<!--/num--> | <!--num:d.spikeWin.walk.3-->0<!--/num--> | <!--num:d.spikeWin.run.3-->20<!--/num--> |
| 4 | <!--num:d.gapWin.walk.4-->10<!--/num--> | <!--num:d.gapWin.run.4-->28<!--/num--> | <!--num:d.wallWin.walk.4-->0<!--/num--> | <!--num:d.wallWin.run.4-->27<!--/num--> | <!--num:d.spikeWin.walk.4-->0<!--/num--> | <!--num:d.spikeWin.run.4-->13<!--/num--> |
| 5 | <!--num:d.gapWin.walk.5-->0<!--/num--> | <!--num:d.gapWin.run.5-->21<!--/num--> | <!--num:d.wallWin.walk.5-->0<!--/num--> | <!--num:d.wallWin.run.5-->0<!--/num--> | <!--num:d.spikeWin.walk.5-->0<!--/num--> | <!--num:d.spikeWin.run.5-->7<!--/num--> |
| 6 | <!--num:d.gapWin.walk.6-->0<!--/num--> | <!--num:d.gapWin.run.6-->15<!--/num--> | | | <!--num:d.spikeWin.walk.6-->0<!--/num--> | <!--num:d.spikeWin.run.6-->1<!--/num--> |
| 7 | <!--num:d.gapWin.walk.7-->0<!--/num--> | <!--num:d.gapWin.run.7-->9<!--/num--> | | | | |
| 8 | <!--num:d.gapWin.walk.8-->0<!--/num--> | <!--num:d.gapWin.run.8-->3<!--/num--> | | | | |

Window rule of thumb (validated against the pit rows at the default `coyoteTicks`): `window = (airDistance + 2 * halfWidth + 4 * speed - gapPx) / speed`. Running: `(112 + 14 + 10.4 - gap) / 2.6`. Use it to size a gap that is not a whole number of tiles' worth of difficulty (for example a gap with a one-way platform halfway).

Why walls look so easy (window 100+ for 1 to 3 tiles when running): a thin wall can be landed on and walked over, so the window is just "jump anywhere in a long stretch". The wall rows are the ledge limit: 3 tiles walking, 4 running. Walls and ledges that need the apex are the fragile ones (see the 4-tile warning below).

## 2. Difficulty tiers T0 to T5 **[PROPOSAL]**

Tiers are from `DIFFICULTY_PHILOSOPHY.md` (T0 onboarding, T1 required path, T2 mount questlines, T3 optional bonus, T4 hard optional and co-op dungeons, T5 raids and Kaizo). The window floor is the smallest timing window a single obstacle may have in that tier; stacking several obstacles with no checkpoint between them multiplies the real difficulty, so cap that too. The sizes are computed by the generator for the current config:

| Tier | Window floor (ticks) | Pit walk | Pit run | Wall / ledge walk | Wall / ledge run | Floor spikes walk | Floor spikes run |
|---|---|---|---|---|---|---|---|
| T0 | <!--num:d.tier.T0.floor-->20<!--/num--> | <!--num:d.tier.T0.pitWalk-->3<!--/num--> | <!--num:d.tier.T0.pitRun-->5<!--/num--> | <!--num:d.tier.T0.wallWalk-->3<!--/num--> | <!--num:d.tier.T0.wallRun-->4<!--/num--> | <!--num:d.tier.T0.spikeWalk-->1<!--/num--> | <!--num:d.tier.T0.spikeRun-->3<!--/num--> |
| T1 | <!--num:d.tier.T1.floor-->15<!--/num--> | <!--num:d.tier.T1.pitWalk-->3<!--/num--> | <!--num:d.tier.T1.pitRun-->6<!--/num--> | <!--num:d.tier.T1.wallWalk-->3<!--/num--> | <!--num:d.tier.T1.wallRun-->4<!--/num--> | <!--num:d.tier.T1.spikeWalk-->1<!--/num--> | <!--num:d.tier.T1.spikeRun-->3<!--/num--> |
| T2 | <!--num:d.tier.T2.floor-->15<!--/num--> | <!--num:d.tier.T2.pitWalk-->3<!--/num--> | <!--num:d.tier.T2.pitRun-->6<!--/num--> | <!--num:d.tier.T2.wallWalk-->3<!--/num--> | <!--num:d.tier.T2.wallRun-->4<!--/num--> | <!--num:d.tier.T2.spikeWalk-->1<!--/num--> | <!--num:d.tier.T2.spikeRun-->3<!--/num--> |
| T3 | <!--num:d.tier.T3.floor-->8<!--/num--> | <!--num:d.tier.T3.pitWalk-->4<!--/num--> | <!--num:d.tier.T3.pitRun-->7<!--/num--> | <!--num:d.tier.T3.wallWalk-->3<!--/num--> | <!--num:d.tier.T3.wallRun-->4<!--/num--> | <!--num:d.tier.T3.spikeWalk-->2<!--/num--> | <!--num:d.tier.T3.spikeRun-->4<!--/num--> |
| T4 | <!--num:d.tier.T4.floor-->5<!--/num--> | <!--num:d.tier.T4.pitWalk-->4<!--/num--> | <!--num:d.tier.T4.pitRun-->7<!--/num--> | <!--num:d.tier.T4.wallWalk-->3<!--/num--> | <!--num:d.tier.T4.wallRun-->4<!--/num--> | <!--num:d.tier.T4.spikeWalk-->2<!--/num--> | <!--num:d.tier.T4.spikeRun-->5<!--/num--> |
| T5 | <!--num:d.tier.T5.floor-->2<!--/num--> | <!--num:d.tier.T5.pitWalk-->4<!--/num--> | <!--num:d.tier.T5.pitRun-->8<!--/num--> | <!--num:d.tier.T5.wallWalk-->3<!--/num--> | <!--num:d.tier.T5.wallRun-->4<!--/num--> | <!--num:d.tier.T5.spikeWalk-->2<!--/num--> | <!--num:d.tier.T5.spikeRun-->5<!--/num--> |

How to read it: a T0 level may ask for a walking hop over a 3-tile pit, a run-jump over a 5-tile pit (this is the playground's gate), a 3-tile step, and a single spike tile. T5 content may demand a frame-near-perfect 8-tile run-jump (window 3) but only in optional or endgame content (pillar D3). Do not require a pit above the T1 run limit on the required path. Mount questlines (T2) must not be harsher than the base moveset (no timers tighter than these rows).

Warnings:
- **The 4-tile wall is a skill gate, not a normal obstacle.** Its window is <!--num:d.wallWin.run.4-->27<!--/num--> ticks but the run apex clears it by only 1 px. The playground uses it on purpose; for required content prefer 3 tiles (48 px, margin about 14 px walking) so a future jump retune cannot lock players out.
- **The 5-tile pit is missed by a walker by 1.4 px.** A level that adds anything that lengthens a walker's air time or speed (a slope takeoff, a slightly higher launch, a moving platform) can make it walk-crossable. Re-run the generator when you add a launcher near a gate.
- Window floors assume steady speed. Add runway (section 3) or the window shrinks.

## 3. Run-ups, landings and speed

- **Runway.** A run needs <!--num:d.runAccelDist-->51.8<!--/num--> px (<!--num:d.runAccelTicks-->38<!--/num--> ticks) to reach full speed. Put at least 6 tiles (96 px) of flat floor before any obstacle that requires a run. A walking obstacle needs about 1 tile.
- **Landing room.** After a run landing the player is still moving at <!--num:runMax-->2.6<!--/num--> px/tick; coasting takes <!--num:d.coastDist-->32.5<!--/num--> px (about 2 tiles), skidding <!--num:d.skidDist-->14.0<!--/num--> px. Leave at least 3 tiles of safe floor after a maximum-distance jump before the next hazard.
- **Slopes** are 45 degrees and do not slow the player. A slope takeoff changes the jump (you leave from higher or lower ground); re-measure any gate near one. Put solid tiles under every slope tile (the playground ramps do) and keep the next flat lip within `slopeSnap` (<!--num:slopeSnap-->4<!--/num--> px) of the slope top.
- **Crouch tunnels.** A 1-tile (16 px) gap is crawlable only crouched, at <!--num:crouchMax-->0.9<!--/num--> px/tick (<!--num:d.crouchTilesPerSec-->3.38<!--/num--> tiles/s): keep tunnels to 12 tiles or less (about 3.5 s). A running slide into a tunnel bleeds speed slowly (<!--num:d.slideDist-->74.0<!--/num--> px).
- **Ceilings.** A ceiling `h` tiles above the floor caps the feet apex at `16h - 28` px: 3 tiles gives 20 px, 4 tiles 36 px, 5 tiles 52 px. A running jump (apex <!--num:d.apex.runHeld-->65.0<!--/num--> plus 28 px of body = 93 px) never bumps a ceiling 6 tiles (96 px) or higher. A pad needs <!--num:d.padApex.held-->148.7<!--/num--> + 28 = 176.7 px, so 12 tiles of clearance above a pad that should launch fully. A standing player passes a 2-tile gap (32 px); a 1-tile gap needs a crouch.

## 4. One-way platforms (`-`)

- Solid from above only; players pass up through them and sideways through them; CROUCH (or CROUCH+JUMP) drops through.
- **Heights.** A platform up to 3 tiles above the floor is reachable by a walking jump with a comfortable window (wall/ledge walk windows 35 / 32 / 28 for 1 / 2 / 3 tiles); 4 tiles needs a run and the 1 px margin. Space stairs 2 to 3 tiles apart for T0 to T2.
- **Stacks.** A drop-through falls 15.1 px before it can land again, so a platform exactly one tile below catches you: a stack of one-way platforms 1 tile apart behaves as a ladder you can descend one rung per CROUCH. Do not place one-way platforms closer than 1 tile vertically.
- **Width.** A 1-tile-wide platform is standable (hitbox 14 px). For plates on a platform (the co-op room's `Pb`), make the platform at least 4 tiles wide so the plate holder can stand centered and not be pushed off.
- Enemies walk on one-way platforms and turn at their edges.

## 5. Checkpoints (`C`)

- **Spacing.** Retry cost should stay at about 30 seconds or less on required content (`DIFFICULTY_PHILOSOPHY.md` section 6). Place a flag before every distinct challenge (any obstacle at a tier floor or any combination), and at most about 40 tiles apart on T0 to T2 paths (4 s at run speed, 8 s walking). The co-op room has four flags in 190 tiles: one after each gate.
- **Position.** Flags trigger from 38 px wide and 80 px tall, so a normal jump over one counts: place them on the floor 2 or more tiles before the hazard they protect, never in a spike patch and never where a later flag's side is crossed backwards (touching a lower-index flag after a higher one moves your checkpoint back).
- **Gates.** Put a flag immediately behind every gate (a retry then never costs more than one section) and a reset lever beside it.
- **Respawn.** The player reappears at the flag's feet with 90 ticks (1.5 s) of invulnerability. Keep hazards out of the respawn: a patrol path that crosses a flag, or a spike next to it, loops the player once the invulnerability ends. Keep patrol paths at least 3 tiles away from every flag and the spawn.
- Shards are per player and kept through deaths; they are free to place anywhere reachable.

## 6. Spikes (`^`) and enemies (`e`, `z`, `k`)

- A spike body occupies x 2..14 and y 6..16 of its tile, about 10 px above the floor, and the player's test is forgiving by 1 px at each side. Any hop clears a single spike. Patches: walking can clear up to <!--num:d.maxSpike.walk-->2<!--/num--> tiles (window <!--num:d.spikeWin.walk.2-->11<!--/num-->) and 1 tile comfortably (<!--num:d.spikeWin.walk.1-->23<!--/num-->); running up to <!--num:d.maxSpike.run-->6<!--/num--> (<!--num:d.spikeWin.run.3-->20<!--/num--> at 3 tiles). Use the tier table.
- **Landing next to spikes.** A jump over spikes ends 2 or more tiles past the patch (leave a safe landing; do not put a second patch inside the landing zone of the first).
- **Walker** (`e`): give it at least 3 tiles of surface (on a single tile it just shuffles; it is 12 px wide); it patrols between walls and ledges at 0.5 px/tick; stompable. **Spiky walker** (`k`): same AI, never stompable: use it to make a surface a "do not touch" lane. **Flyer** (`z`): ignores terrain, `range` +/- 32 px by default, bobs 12 px up and down over 96 ticks. Mind its lowest point (its feet y at the bottom of the bob): 28 px or more above the floor is overhead scenery for a standing player; between 16 and 28 px it hits a standing player but a crouching one slides under; below 16 px it hits everyone.
- **Stomps are free height.** A held stomp lifts a player <!--num:d.enemyStompApex.held-->98.3<!--/num--> px above a floor enemy's feet. A walker beneath a 5 or 6 tile ledge turns that ledge into a solo route. Do not put a "team only" ledge within reach of an enemy.
- Enemies that were stomped return after 600 ticks (10 s), so a stomp does not clear a lane permanently.

## 7. Co-op patterns

All four patterns exist in `levels/coopRoom.ts` and are proven in `coop.test.ts`.

| Pattern | How it is built | Design rule |
|---|---|---|
| **Separated plates** (gate 0) | two plates 25 tiles apart, `need` 2, `linger` 300 | a plate is pressed by a body within 14 px of its center, so two plates farther than 28 px apart cannot be held by one body; use at least 2 tiles, more for feel. The linger gives the holders time to run through |
| **Timed lever plus latch** (gate 1) | timed lever (300 ticks), a latch toggle lever on the far side of the door | timer shorter than the best-case run from the lever to the door (<!--num:coop.corridorRunTicks-->384<!--/num--> against <!--num:coop.corridorTimerTicks-->300<!--/num-->, <!--num:coop.corridorShortTicks-->84<!--/num--> ticks short) so a solo player never makes it; the partner waits at the door and latches it |
| **Stomp ledge** (gate 2) | slab 6 tiles up carrying a toggle lever | choose a height `H` with `soloApex + margin < H < stompApex - margin`: 96 px sits between <!--num:coop.soloBestPx-->65.0<!--/num--> (<!--num:coop.ledgeSoloMargin-->31.0<!--/num--> px short) and <!--num:coop.stompBestPx-->112.3<!--/num--> (<!--num:coop.ledgeStompMargin-->16.3<!--/num--> px of clearance). Keep at least 20 px on the solo side and 12 px on the team side |
| **N of M plates** (final gate) | four plates, `need` 3, one on a one-way platform, `linger` 360 | `need` is at most players minus one for rooms that must tolerate a dropout (raid rule, `COOP_ROOM_M3.md` section 6); linger of at least 1.3 times the slowest holder's run to the door |

### Making a gate require N players

1. **Plates.** Place M >= N plates at least 2 tiles apart (more is better), link them with `need: N`, and add `linger`. N bodies are required because each body holds at most one plate. If one plate sits on a one-way platform it needs a jump; mark that in the room's difficulty tier.
2. **Stacked stomps.** The ledge height rule above makes it a 2-player gate. A 3-player stack (a stomp off a stomper) is not implemented or tested, so treat it as a **[PROPOSAL]**; the held-stomp numbers do not stack arithmetically (the bounce speed is fixed, not additive).
3. **Timers.** A timed lever with `ticks` below the best-case solo run makes a 2-player gate; chain it with a latch so the team can reset after.
4. **Combinations.** Gate N+1 behind a gate that needs N: the final gate of the co-op room needs 3 because the earlier ones need 2.

### Door settings

- **`linger`**: how long a door stays open after its condition lapses. Set `linger >= 1.3 * ticksToCover(distance from the farthest holder's plate to the door)`. Gate 0: the A holder needs <!--num:coop.gate0RunTicks-->197<!--/num--> ticks, linger <!--num:coop.gate0Linger-->300<!--/num--> (1.5x). Too much linger lets one player open and escape; too little locks the holders out.
- **Door height.** Make doors reach the top of the level: all coop doors are 13 tiles (rows 0 to 12). A held pad lifts <!--num:d.padApex.held-->148.7<!--/num--> px (9.3 tiles), so a door shorter than about 10 tiles above a pad is vaultable. Above row 0 the level is open air.
- **Several links to one door are OR-ed.** Use it for alternative routes (a plate route and a lever route).
- **An unlinked `D` never opens.** Use it for permanent walls only.
- **Never trap a player.** Every closed door must have a lever or plate reachable from BOTH sides, or a reset lever (`reset: true`) within reach. Doors never close on an occupant, so no embedding.
- **Room meta.** `minPlayers` is the smallest group that can make progress meaningful (the co-op room uses 2); `soloResetTicks` (600) resets the room after that long with fewer connected players once progress exists; `maxPlayers` caps the server for that level. For 8-player raids see `docs/roadmap/P2-coop-raids.md` and MECHANICS section 12.

## 8. Proving solvability with the bot harness

`packages/sim/test/bots.ts` is a tiny scripted-input toolkit; `coop.test.ts` is the worked example. Every gate needs two kinds of tests:

**A. "Fewer players cannot" (a negative proof).** Brute force every input you can imagine, deterministically:
- sweep the player over every x in the gate's area with `stepWorld` and record the maximum plates pressed (gate 0 does this with a step of 2 px);
- sweep jump timings (0 to 90 ticks, 70 ticks of JUMP held, with and without RUN) from several start positions and record the best feet height (`best > ledgeTop + 8` for the ledge);
- for timed gates run the best-case sprint and assert the player is stuck on this side;
- assert margins, not just booleans: the gate is only robust if the best solo result misses by at least 20 px or 20 ticks (see section 7).

**B. "The team can" (a positive proof).** Script `n` bots with `Room`:
- `new Room(n, level)` makes a world with players 1..n at the spawn;
- `r.to(id, x, { run?, targetY?, tol? })` returns the buttons that walk or run player `id` toward `x`, hopping spikes, walls and ledges ahead (it does NOT jump pits: script pit jumps yourself with a timing sweep, as `sim.test.ts` does);
- `r.there(id, x, tol)` is true once the player is close, grounded and nearly stopped;
- `r.until(plan, cond, maxTicks, label)` steps with the planned inputs until `cond()` holds and throws with every player's position on timeout;
- `r.run(n, plan)` and `r.step(inputs)` advance time; `r.w` is the `World`, `r.p(id)` a player, `r.w.dynamic[doorId]` the door state;
- for jumps that depend on timing, search on a `structuredClone` of the world (the sim is deterministic) for a press tick that works, then replay it on the real world (`findLedgeJump` in `coop.test.ts`).

**C. Always add:** a disconnect test (`p.away = true`, plate releases, gate closes after linger), a reset test (`room.resets` increments, nobody is moved by a lever reset), a deterministic multi-player run (`JSON.stringify(world)` equal across two runs), and the 16-player tick budget (`< 0.5 ms` per tick on this machine).

Skeleton (adapt the ids; `LEVEL`, `plateX` and `doorOpen` are your own helpers):

```ts
import { describe, expect, it } from 'vitest';
import { BTN, TILE } from '../src/index';
import { LEVEL } from '../src/levels/myLevel';
import { Room } from './bots';

describe('MyLevel: the gate needs two players', () => {
  it('one player never opens it', () => {
    const r = new Room(1, LEVEL);
    let ever = false;
    r.until(() => ({ 1: r.to(1, plateX(0)) }), () => (ever = ever || doorOpen(r, 0)) || r.there(1, plateX(0), 10), 900, 'solo');
    r.run(120);
    expect(ever).toBe(false);
  });
  it('two players open it and both get through', () => {
    const r = new Room(2, LEVEL);
    r.until(() => ({ 1: r.to(1, plateX(0)), 2: r.to(2, plateX(1)) }), () => doorOpen(r, 0), 900, 'door opens');
    r.until(() => ({ 1: r.to(1, doorRightX), 2: r.to(2, doorRightX + 10) }), () => r.p(1).x > doorRightX && r.p(2).x > doorRightX, 600, 'through');
  });
});
```

## 9. Authoring checklist

1. Sketch the path in tiles; label every obstacle with its tier and look up its window in section 1.
2. Draw the ASCII (template below). Keep the spawn row and the floor row consistent; fill solid tiles under slopes; make doors full height.
3. Add `meta`: links, timed/reset levers, enemy ranges, room rules.
4. Register the level (`levels/registry.ts`) and run it with `SBH_LEVEL=<name>`.
5. Prove each gate (section 8) and check margins.
6. Place checkpoints (section 5) and reset levers; put every enemy at least 3 tiles from a flag.
7. Run `npx vitest run packages/sim`, `npm test`, `npm run typecheck`; playtest with the feel checklist in `TUNING_GUIDE.md` section 7.

## 10. Template level (64 x 16)

Floor top is row 13 (y = 208); everything stands on row 12. Spawn `S`, two shards, a 2-tile spike patch (walk-clearable), plate A, a checkpoint, a walker on a 5-tile block, a one-way shelf with a shard, a 5-tile pit (run-jump, T0), a checkpoint, plate B, a full-height gate (door 0, plates A and B, linger 360), a goal checkpoint and shard. Plate A to the gate is 34 tiles: 227 ticks of running, times 1.3 is 295, inside the 360-tick linger.

```
......................................................D.........
......................................................D.........
......................................................D.........
......................................................D.........
......................................................D.........
......................................................D.........
......................................................D.........
......................................................D.........
......................................................D.........
.................................o....................D.........
................................----..................D.........
............................e.........................D.........
..S.....oo....^^....p..C..#####..............C..p.....D...C.o...
######################################.....#####################
######################################.....#####################
######################################.....#####################
```

`packages/sim/src/levels/template.ts`:

```ts
import { parseLevel } from '../level';

const rows = [
  /* paste the 16 rows above, one string each */
];

export const TEMPLATE = parseLevel('template', rows, {
  links: [{ door: 0, plates: [0, 1], linger: 360 }],
  room: { minPlayers: 2, maxPlayers: 4, soloResetTicks: 600, emptyResetTicks: 600 },
});
```

Parse result for this template (verified): spawn at (40, 208), 3 checkpoints, 4 shards, 2 plates, 1 door, 1 walker at (456, 192). Register it in `levels/registry.ts` (`[TEMPLATE.name]: TEMPLATE`), add a test as in section 8, and delete or rename the level once it has a real purpose.

Level ids are by reading order: plate A (col 20) is plate 0, plate B (col 48) is plate 1; checkpoints 0, 1, 2 are cols 23, 45, 58; the gate column (54) is door 0.
