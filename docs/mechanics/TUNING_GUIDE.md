# Super BoundHaven: Tuning Guide

<!-- core:start -->
**Core summary.** Every movement number lives in `packages/sim/src/config.ts` (`MOVEMENT` and `RULES`) and is shared by client, server and tests, so one edit changes feel, every level, the skill-gate tests and the netcode at once. Most numbers are safe to nudge; a handful are not. `jumpVel` (<!--num:jumpVel-->5.2<!--/num-->) and `gravityHeld` (<!--num:gravityHeld-->0.22<!--/num-->) are locked to roughly plus or minus 1 percent because the 4-tile playground wall clears by 1 px and the 5-tile pit is missed by a walker by 1.4 px; `runBonus`, `walkMax`, `runMax` and `padHeldVel` are next. Safe workflow: change one number, run `npx tsx tools/mechanics/gen-numbers.mjs` and read the diff of `generated/NUMBERS.md` (apex, max pit, max wall, timing windows), run `--sensitivity` if a gate looks close, run `npx vitest run packages/sim` (the skill-gate tests in `sim.test.ts` and `coop.test.ts` are the contract), then `npm test` and `npm run typecheck`, then update the docs that quote the number (the `<!--num:...-->` tags make `mechanics-doc.test.ts` fail until you do) and the client constants that copy it (`motion.ts` WALK_MAX/RUN_MAX, `rumble.ts` thresholds). Danger list: never read time or randomness in the sim, never give client and server different `cfg`, never let `stepPlayer` read other players or enemies (prediction breaks), keep per-tick travel under one tile, keep `slopeInset` above `halfWidth + runMax`, keep `slopeSnap` above `runMax`, keep `stompWindow` above `maxFall`, keep `dropTicks` at 8 or lower, keep `padVel` above `stompHeldVel`. If you change the tick rate, tile size or hitbox you are rewriting every level and the art, not tuning. Test commands and the playtest feel checklist are in sections 5 and 7.
<!-- core:end -->

Read [MECHANICS.md](MECHANICS.md) first for what each number does in the step order. Numbers quoted here use tags checked by `packages/sim/test/mechanics-doc.test.ts`. Values measured by simulation live in [`generated/NUMBERS.md`](generated/NUMBERS.md). Level-side consequences are in [LEVEL_DESIGN_GUIDE.md](LEVEL_DESIGN_GUIDE.md). Team workflow for who may change what: `docs/ai-team/PROTOCOL.md`.

## 1. What "tuning" can and cannot touch

| You are changing | It is | Consequence |
|---|---|---|
| a `MOVEMENT` / `RULES` value, same units | tuning | re-verify gates and tests (sections 4 and 5) |
| `TICK_RATE` (<!--num:TICK_RATE-->60<!--/num-->) | a rewrite | every per-tick number and every tick-valued timer (coyote, linger, lever ticks, respawn) changes real-world meaning; the client fixed step and server loop also assume it. Do not |
| `TILE` (<!--num:TILE-->16<!--/num-->) | a rewrite | every level, the art, atlases, spike/flag/plate literals |
| `halfWidth`, `height`, `crouchHeight` | a rewrite of art alignment and level geometry rules | see section 6 |
| the order of operations in `stepPlayer` / `stepWorld` | a rewrite | all gates and replays change |
| adding a field to `PlayerState` | an API change | `createPlayer`, `clonePlayer`, snapshots, reconcile, `types.ts` |

## 2. Parameter reference: `MOVEMENT`

"Safe range" cells start with **M** (measured: the range found by `--sensitivity` in section 6, in coarse steps of 1, 2, 3, 5, 7.5, 10, 15, 20, 30, 50 percent, or whole numbers for integer params, keeping every shipped skill gate true) or **J** (judgment from the code and the invariants in section 8, not measured). Both are necessary, not sufficient: always run the full tests.

| Param | Value | Unit | What it does | Safe range | Depends on / also change |
|---|---|---|---|---|---|
| `halfWidth` | <!--num:halfWidth-->7<!--/num--> | px | half the hitbox width | M: 1 to 7 | `sim.test.ts` "body is 14x28" asserts it. Raising it past 7 lets a walker cross the 5-tile pit. Also raise `slopeInset` (must exceed `halfWidth + runMax`), `render.ts` stomp x-tolerance literal 13, art alignment (24 px frame), plate trigger (14 px derives from it) |
| `height` | <!--num:height-->28<!--/num--> | px | standing hitbox height | M: 20 to 36 (J: and 17 to 32 for the ceiling tests) | must stay > `crouchHeight` and <= 32 (2-tile ceiling test "a standing player fits under a 2-tile ceiling"); asserted by "body is 14x28" and the head-bump tests (156 = 128 + 28); a held stomp apex is `rise + height` so the 6-tile gates need it; art 32 px frame |
| `crouchHeight` | <!--num:crouchHeight-->16<!--/num--> | px | crouched height | J: keep 16 | must be <= 16 to fit a 1-tile gap (tests "slides under a 1-tile gap", "crouch hitbox is used for head bumps": 144 = 128 + 16); `canStand` uses it |
| `crouchMax` | <!--num:crouchMax-->0.9<!--/num--> | px/tick | ground speed cap while crouching (and crouch-slide target) | J: 0.5 to 1.4 | the 1-tile-gap test needs about 0.45 px/tick to finish in 700 ticks; keep <= `walkMax` |
| `dropTicks` | <!--num:dropTicks-->8<!--/num--> | ticks | one-way platforms ignored after a drop | J: 2 to 8 | 8 ticks of free fall is 15.1 px; 9 or more falls 18.9 px and would pass through a second platform exactly one tile (16 px) below the first. Test "crouch drops through" |
| `walkMax` | <!--num:walkMax-->1.4<!--/num--> | px/tick | walk cap | M: 0.7 to 1.442 | upper limit is the 5-tile pit (1.4 px margin, `pg` gate); `motion.ts` WALK_MAX copy; `RUN_SPEED` 1.55 animation threshold must stay between `walkMax` and `runMax`; walking-window rows in every level tier table |
| `runMax` | <!--num:runMax-->2.6<!--/num--> | px/tick | run cap | M: 2.21 to 3.38 | `motion.ts` RUN_MAX copy; `d.maxGap.run` (<!--num:d.maxGap.run-->8<!--/num-->) grows with it so every level's pit sizes change; corridor gate stops needing a partner above about 3.9; `slopeInset` and `slopeSnap` invariants; coop timings (gate 0 linger) |
| `accel` | <!--num:accel-->0.07<!--/num--> | px/tick^2 | ground acceleration | M: 0.035 to 0.105 | run-up length: the run needs <!--num:d.runAccelDist-->51.8<!--/num--> px to reach full speed; bots and tests use 120 px run-ups |
| `skid` | <!--num:skid-->0.22<!--/num--> | px/tick^2 | reversing on the ground | J: feel only | test "skids when reversing direction" asserts the exact value as the delta; keep `skid > friction > accel` for the "hard to reverse" feel |
| `friction` | <!--num:friction-->0.1<!--/num--> | px/tick^2 | stopping with no input | J: feel only | stopping distance <!--num:d.coastDist-->32.5<!--/num--> px from run speed (level hazards after a long run) |
| `overspeedDecel` | <!--num:overspeedDecel-->0.04<!--/num--> | px/tick^2 | slow bleed above the cap | J: feel only | crouch-slide length (<!--num:d.slideDist-->74.0<!--/num--> px) and the held-direction run-release behavior |
| `airAccel` | <!--num:airAccel-->0.06<!--/num--> | px/tick^2 | air steering and braking | M: 0.03 to 0.09 | not in the gate set; coop bots steer in the air |
| `jumpVel` | <!--num:jumpVel-->5.2<!--/num--> | px/tick | takeoff speed | M: about 5.2 to 5.25 | LOCKED. -1 percent breaks "4-tile wall: a run-jump clears it"; +2 percent lets a walker clear the 4-tile wall. `sim.test.ts` asserts a standing held apex between 58 and 64 px. Rumble thresholds in `rumble.ts` assume a run-jump lands at <= 5.46 |
| `runBonus` | <!--num:runBonus-->0.1<!--/num--> | per px/tick | extra takeoff speed per unit of abs(vx) | M: 0.085 to 0.15 | below 0.08 the 4-tile wall is lost |
| `gravityHeld` | <!--num:gravityHeld-->0.22<!--/num--> | px/tick^2 | gravity rising with JUMP held | M: 0.2156 to 0.2222 | LOCKED within about 1.5 percent: it directly sets apex (`v^2 / 2g`) |
| `gravityFall` | <!--num:gravityFall-->0.42<!--/num--> | px/tick^2 | falling or JUMP released | M: 0.336 to 0.63 | below about 0.3 a walker crosses the 5-tile pit (more air time); sets the tap-jump apex (<!--num:d.apex.standTap-->32.0<!--/num--> px) and the drop-through math |
| `maxFall` | <!--num:maxFall-->5.5<!--/num--> | px/tick | terminal fall speed | J: 4 to about 8 | must stay < 16; `rumble.ts` HARD_LAND_VY (5.49) sits between the run-jump landing speed (5.46) and `maxFall`; `stompWindow` must stay >= `maxFall` |
| `coyoteTicks` | <!--num:coyoteTicks-->5<!--/num--> | ticks | grace after leaving ground | M: 1 to 8 | effective late-press window is <!--num:d.coyoteLate-->4<!--/num--> ticks after the leaving tick. The width formula in MECHANICS section 7 was validated at 5 |
| `bufferTicks` | <!--num:bufferTicks-->6<!--/num--> | ticks | remembered jump press | J: 2 to 10 | effective early window is <!--num:d.bufferEarly-->4<!--/num--> ticks before landing (`bufferTicks - 2`); test "buffers a jump pressed just before landing" |
| `padVel` | <!--num:padVel-->6.6<!--/num--> | px/tick | pad launch, JUMP not held | M: 3.3 to 9.9 (J: and keep the ordering in section 8) | keep > `stompHeldVel` and > 6.5 (`rumble.ts` BOUNCE_VY): the client tells a pad bounce from a stomp by speed |
| `padHeldVel` | <!--num:padHeldVel-->8.2<!--/num--> | px/tick | pad launch, JUMP held | M: 7.4 to 12.3 | below about 7 the held pad no longer reaches the playground's high platform (112 px above the pad, test "launches the player, higher when jump is held" needs > 7 tiles) |
| `stompVel` | <!--num:stompVel-->4.6<!--/num--> | px/tick | stomp, JUMP not held | M: 2.3 to 6.9 (J: and below `stompHeldVel`) | `rumble.ts` STOMP_MIN_VY (-4.4); keep < `stompHeldVel` |
| `stompHeldVel` | <!--num:stompHeldVel-->6.2<!--/num--> | px/tick | stomp, JUMP held | M: 5.7 to 9.3 (J: and below 6.5) | LOCKED below: under about 5.6 the 6-tile wall and the co-op ledge are no longer reachable. Must stay < 6.5 (rumble tells a stomp from a pad by speed) unless `rumble.ts` is retuned. The stomp apex plus `height` must exceed the tallest co-op ledge and stay below the next intended tier |
| `stompPushDown` | <!--num:stompPushDown-->1.5<!--/num--> | px/tick | minimum downward speed forced on a stomped player | J: feel only | keep < `maxFall` |
| `stompWindow` | <!--num:stompWindow-->12<!--/num--> | px | stomp catch depth below the victim's head | J: 6 to 14 | must be >= `maxFall` or fast falls tunnel through a head; also `RULES.stompWindow` for enemies (independent copy) |
| `stompTolerance` | <!--num:stompTolerance-->4<!--/num--> | px | slack on "was above the head last tick" | J: 2 to 8 | too large makes a side bump count as a stomp |
| `pushMax` | <!--num:pushMax-->1.5<!--/num--> | px/tick | player separation per tick | J: 0.5 to 3 | test "overlapping players are pushed apart" |
| `slopeSnap` | <!--num:slopeSnap-->4<!--/num--> | px | grounded snap-down onto slopes and lips | J: >= `runMax` | a run down a 45 degree ramp descends abs(vx) px per tick; below that you launch off every ramp. Slope tests in `sim.test.ts` |
| `slopeInset` | <!--num:slopeInset-->10<!--/num--> | px | bottom px ignored by wall checks while grounded | J: > `halfWidth + runMax` (9.6 now) | tiny margin: raising `halfWidth` or `runMax` requires raising this. Larger values let you clip 1-tile steps |

## 3. Parameter reference: `RULES`

| Param | Value | Unit | What it does | Depends on / also change |
|---|---|---|---|---|
| `invulnTicks` | <!--num:rules.invulnTicks-->90<!--/num--> | ticks | respawn invulnerability | client flicker is driven by `invuln` itself; "invulnerability ticks down and protects against spikes" |
| `actionReachX` | <!--num:rules.actionReachX-->20<!--/num--> | px | lever reach, horizontal | the client prompt (`scene-logic.ts leverInReach`) imports it, so it follows automatically |
| `actionReachY` | <!--num:rules.actionReachY-->24<!--/num--> | px | lever reach, vertical (body center to lever center) | same; levers high on a wall (the co-op ledge lever) must stay reachable from the slab |
| `enemyRespawnTicks` | <!--num:rules.enemyRespawnTicks-->600<!--/num--> | ticks | stomped enemy returns | test "a stomped enemy comes back after its respawn time" |
| `walkerSpeed` | <!--num:rules.walkerSpeed-->0.5<!--/num--> | px/tick | patroller speed | enemy art walk-cycle rate; level timing windows around patrols |
| `flyerSpeed` | <!--num:rules.flyerSpeed-->0.6<!--/num--> | px/tick | flyer horizontal speed | the flyer path test "flyers follow a deterministic bounded sine path" |
| `enemyHalfWidth` | <!--num:rules.enemyHalfWidth-->6<!--/num--> | px | enemy half width | art (the sprite is larger than the hitbox: a known polish item) |
| `enemyHeight` | <!--num:rules.enemyHeight-->14<!--/num--> | px | enemy height | stomp apex off an enemy is `rise + enemyHeight` (<!--num:d.enemyStompApex.held-->98.3<!--/num--> px held) |
| `enemyGravity` | <!--num:rules.enemyGravity-->0.3<!--/num--> | px/tick^2 | walker gravity | keep walker max fall < 16 |
| `enemyMaxFall` | <!--num:rules.enemyMaxFall-->4<!--/num--> | px/tick | walker terminal speed | keep < 16 |
| `stompWindow` | <!--num:rules.stompWindow-->12<!--/num--> | px | enemy stomp depth | >= `maxFall`; independent of `MOVEMENT.stompWindow` |
| `stompSlack` | <!--num:rules.stompSlack-->6<!--/num--> | px | previous feet may be this far below the enemy top | smaller than `stompWindow` |
| `defaultRoom.minPlayers` | <!--num:room.minPlayers-->1<!--/num--> | players | default room minimum | levels override via `meta.room` |
| `defaultRoom.soloResetTicks` | <!--num:room.soloResetTicks-->600<!--/num--> | ticks | solo reset timer | raid design wants 30 s (1800 ticks) |
| `defaultRoom.emptyResetTicks` | <!--num:room.emptyResetTicks-->600<!--/num--> | ticks | empty reset timer | |

RULES values are protocol-visible: a change affects server snapshots and must ship client and server together.

## 4. Literals that look like config but are not

These live in code, not in `config.ts`. They are part of the feel and part of the skill gates.

| Where | Literal | Meaning |
|---|---|---|
| `player.ts touchStatics` | spike body x 2..14, y 6..16 in its tile; hurtbox shrunk 1 px each side, 0.5 px at the feet | spike forgiveness |
| `player.ts touchStatics` | flag trigger `12 + halfWidth` wide, 80 px tall | a normal jump over a flag counts |
| `player.ts touchStatics` | shard reach `8 + halfWidth`, vertical slack 6 px | pickup radius |
| `player.ts applySlope` | rows `r0-1..r0+1`, accept `y <= f + TILE` | slope catch depth |
| `entities.ts tryStomp` | `2 * halfWidth - 1` (13 px) x tolerance | stomp alignment |
| `entities.ts tryPush` | vertical overlap `min(h) - 2` | push alignment |
| `entities.ts updatePlates` | `TILE/2 + halfWidth - 1` (14 px), feet within 1 px | plate press |
| `entities.ts SINE` | amplitude 12 px, 32 entries, 3 ticks per entry = period 96 ticks | flyer bob |
| `render.ts` (stomp star fx) | `13`, `6`, launch `-4.3` | decides visually that a launch was a stomp: x within 13 px, feet within 6 px of another player's head, launch faster than -4.3 |
| `motion.ts` | WALK_MAX 1.4, RUN_MAX 2.6, RUN_SPEED 1.55, HARD_IMPACT 3, launch detection 3.5, takeoff squash -5.6 | animation rates and event thresholds (jump speeds 5.2 to 5.46 must stay inside them) |
| `rumble.ts` | HARD_LAND_VY 5.49, BOUNCE_VY -6.5, STOMP_MIN_VY -4.4 | haptic event classification |
| `apps/site/src/clips.ts`, `hero.ts` | scripted input clips replay the REAL sim; hero hops use `-5.2` | the marketing reel can change when tuning changes |

`mechanics-doc.test.ts` parses `motion.ts` for WALK_MAX and RUN_MAX and imports the `rumble.ts` constants, and fails with a message if they stop matching the config.

## 5. The step-by-step tuning workflow

All commands run from the repo root (`super-boundhaven/`), PowerShell 7 or Git Bash.

1. **Baseline.** `npx vitest run packages/sim` and `npm run docs:mechanics:check` must be green before you start. Note `generated/NUMBERS.md` as the "before".
2. **One change at a time.** Edit one number in `packages/sim/src/config.ts`. Never tune two coupled numbers in one step (for example `jumpVel` and `gravityHeld`) without reading section 6 first.
3. **Look at the derived numbers.** `npx tsx tools/mechanics/gen-numbers.mjs` rewrites `docs/mechanics/generated/NUMBERS.md`; `git diff docs/mechanics/generated/NUMBERS.md` shows apexes, air times, max pit, max wall, timing windows, stomp and pad apexes, corridor timing and the gate table. Read these first; they are what level designers rely on. If the generator throws "playground layout drifted" or "has no entry", a level or config key changed shape: fix the cause, do not silence it.
4. **Find the cliffs (optional, about 15 s).** `npx tsx tools/mechanics/gen-numbers.mjs --sensitivity` prints, for each tunable, how far it can move before a shipped gate flips and which gate breaks first. Use it when a derived number gets within a few px of a gate.
5. **Run the contract tests.** `npx vitest run packages/sim` (skill gates, co-op solvability, determinism, crouch, one-way, enemies). Then `npm test` (client, server, protocol, art) and `npm run typecheck`.
6. **Fix what broke on purpose.** Tests that assert literals (`sim.test.ts` apex 58 to 64, "body is 14x28", head-bump 156 and 144) are the places a deliberate change must update the expectation in the same commit, with a note in the commit body.
7. **Update the coupled client constants** (section 4): `motion.ts`, `rumble.ts`.
8. **Update the docs.** Edit the quoted values in `MECHANICS.md`, this file and `LEVEL_DESIGN_GUIDE.md`; `npx vitest run packages/sim/test/mechanics-doc.test.ts` names every tag that drifted. Update stale docs listed in MECHANICS appendix A. Run `npm run docs:mechanics` and commit the regenerated file. Re-paste the sensitivity table if you ran it.
9. **Re-prove the levels.** Every level's gates were sized against the old numbers (`LEVEL_DESIGN_GUIDE.md` tier table). Re-run the co-op bot tests; if you add or move a gate, add or update its solo-cannot / team-can test.
10. **Playtest** with the feel checklist (section 7), on keyboard and on a pad, locally and with simulated lag (`?lag=120&loss=5`).
11. **Gate checks.** `npm run docs:mechanics:check`, `npm run audit` (0 FAIL), `npm test`.
12. **Record it.** Add an entry to `DECISIONS.md` (date, what, why, status) for any change a player can feel; update `docs/NEXT_ACTION.md` at session end. Restart the dev server on 8080 after sim changes: a running server keeps the old numbers.

## 6. Sensitivity table (measured 2026-10-04, current config)

Generated by `npx tsx tools/mechanics/gen-numbers.mjs --sensitivity`; it perturbs one parameter at a time and re-evaluates 12 gate conditions (pit 5 walk fails / run clears, wall 4 walk fails / run clears, wall 6 solo run fails, held stomp clears wall 6, pad held reaches the platform / tap does not, co-op ledge solo fails / stomp clears, corridor needs a partner, gate 0 holder makes it with a 1.3x margin). This table is static text, not tag-checked: re-run the command after any change and re-paste it.

| param | default | lowest value that keeps every gate | highest value that keeps every gate | first break going down | first break going up |
|---|---|---|---|---|---|
| `jumpVel` | 5.2 | 5.2 | 5.252 | 5.148: wall4 run clears | 5.304: wall4 walk fails |
| `runBonus` | 0.1 | 0.085 | 0.15 | 0.08: wall4 run clears | none in range |
| `gravityHeld` | 0.22 | 0.2156 | 0.2222 | 0.2134: wall4 walk fails | 0.2244: wall4 run clears |
| `gravityFall` | 0.42 | 0.336 | 0.63 | 0.294: pit5 walk fails | none in range |
| `walkMax` | 1.4 | 0.7 | 1.442 | none in range | 1.47: pit5 walk fails |
| `runMax` | 2.6 | 2.21 | 3.38 | 2.08: wall4 run clears, gate0 holder makes it (1.3x margin) | 3.9: corridor needs a partner |
| `accel` | 0.07 | 0.035 | 0.105 | none in range | none in range |
| `airAccel` | 0.06 | 0.03 | 0.09 | none in range | none in range |
| `padVel` | 6.6 | 3.3 | 9.9 | none in range | none in range |
| `padHeldVel` | 8.2 | 7.38 | 12.3 | 6.97: pad held reaches platform | none in range |
| `stompVel` | 4.6 | 2.3 | 6.9 | none in range | none in range |
| `stompHeldVel` | 6.2 | 5.735 | 9.3 | 5.58: wall6 held stomp clears, coop ledge stomp clears | none in range |
| `coyoteTicks` | 5 | 1 | 8 | none in range | 9: pit5 walk fails |
| `halfWidth` | 7 | 1 | 7 | none in range | 8: pit5 walk fails |
| `height` | 28 | 20 | 36 | none in range | none in range |

Reading it: "lowest value that keeps every gate" equal to the default means the very first step down (usually 1 percent) already breaks something. `jumpVel`, `gravityHeld`, `walkMax` (upward) and `halfWidth` (upward) have effectively zero slack. Free-feel parameters (`accel`, `airAccel`, `padVel`, `stompVel`) have none in range because no gate covers them: judge them by playtest and by the invariants in section 8, not by this table.

## 7. Feel checklist (playtest)

Do each on keyboard and pad. Write the measured numbers next to the target.

| Check | How to measure | Target (current build) |
|---|---|---|
| Jump heights | jump beside a 1-tile grid (the playground ground), count tiles: tap, hold, walking hold, running hold | tap about 2 tiles, hold 3.7 to 4.1 tiles (<!--num:d.apexTiles.standHeld-->3.68<!--/num--> standing to <!--num:d.apexTiles.runHeld-->4.07<!--/num--> running) |
| Variable jump control | release at different moments; the cut should be smooth (heavier gravity, not a stop) | apexes between 2 and 4 tiles with no dead zone |
| Air time | count the fall | about 0.7 s for a held jump (<!--num:d.air.standHeld-->41<!--/num--> to <!--num:d.air.runHeld-->43<!--/num--> ticks) |
| Air control | change direction mid-jump | steer slowly (`airAccel` <!--num:airAccel-->0.06<!--/num-->), momentum kept, no air drag |
| Ground accel | tap and hold RIGHT | walk speed in <!--num:d.walkAccelTicks-->20<!--/num--> ticks, run in <!--num:d.runAccelTicks-->38<!--/num--> ticks (0.6 s) |
| Skid | run then reverse | stop in <!--num:d.skidTicks-->12<!--/num--> ticks, <!--num:d.skidDist-->14.0<!--/num--> px; reads as a deliberate brake |
| Coast | run then release | <!--num:d.coastTicks-->26<!--/num--> ticks, <!--num:d.coastDist-->32.5<!--/num--> px |
| Coyote | walk off a ledge, press JUMP late | works up to 4 ticks (67 ms) after leaving, not 6 |
| Buffer | press JUMP shortly before landing | works up to 4 ticks before touchdown |
| Run-jump gap | cross the playground's 5-tile pit 20 times at run speed | a clear majority (window <!--num:d.gapWin.run.5-->21<!--/num--> ticks of 0.35 s); walking never crosses |
| 4-tile wall | run-jump the wall 20 times | works (window <!--num:d.wallWin.run.4-->27<!--/num--> ticks) but must feel tight; walking never clears it |
| 6-tile wall | with a friend, held stomp over it | repeatable by a coordinated pair; not solo |
| Stomp | tap vs held stomp on a partner and on an enemy | held reaches <!--num:d.stompApexFloor.held-->112.3<!--/num--> px above the partner's feet; tap <!--num:d.stompApexFloor.tap-->50.9<!--/num--> |
| Pad | tap vs held on the playground pad | tap <!--num:d.padApex.tap-->48.6<!--/num--> px, held <!--num:d.padApex.held-->148.7<!--/num--> px |
| Crouch | slide under a 1-tile gap; crouch-slide from a run | speed cap <!--num:crouchMax-->0.9<!--/num-->; slide bleeds over <!--num:d.slideTicks-->43<!--/num--> ticks |
| Drop-through | CROUCH on a one-way platform; CROUCH+JUMP | drops, never jumps |
| Slopes | run up and down the playground ramps | no launching off the top, no sticking |
| Push | two players walk into each other | soft separation, no jitter |
| Respawn | spike, enemy, pit | back at the last flag, 1.5 s flicker, nothing lost |
| Latency | `?lag=120&loss=5` | corrections small, no rubber-banding on plain movement; snaps only after a server-only event (door, stomp) |
| Display rate | 60, 120 and 144 Hz monitors | identical jump heights (the fixed step decouples the sim from rendering) |
| Difficulty targets | first-session attempts at the pit and the 4-tile wall | T0: 95 percent clear in the first session, median 3 or fewer attempts per obstacle (`DIFFICULTY_PHILOSOPHY.md`). If the playground wall misses this, the cause is the 1 px margin: widen it deliberately, do not "just play better" |

## 8. Danger list

Changes in the first group desync client and server or break determinism: they will pass a single-player test and fail in a room.

**A. Desync and determinism**
1. Reading `Date`, `performance`, `Math.random`, or any engine-dependent math (`sin`, `pow`, `exp`, `hypot`) inside `packages/sim`.
2. Passing a different `cfg` to `stepPlayer` on the client than the server uses for the same player (including a "local feel" tweak). Today the client calls `stepPlayer(level, me, buttons, undefined, view.dynamic)` with the default, and the server calls `stepWorld(level, world, inputs)` with the default.
3. Making `stepPlayer` depend on anything other than `(level, own state, buttons, dynamic)`: another player, an enemy, a plate. The client predicts only that function. Anything else belongs in `stepWorld`.
4. Changing the evaluation order inside `stepPlayer` (crouch before drop-through before speed cap before horizontal before jump before gravity before move) or `stepWorld` (players, push/stomp, enemies, contacts, levers, plates, doors, room).
5. Mutating `world.players` order. It must stay sorted by id.
6. Adding a `PlayerState` field and forgetting `createPlayer`, `clonePlayer` (arrays and objects need deep copies; `got` is copied) or the reconcile path. A field that differs between client and server after replay causes a permanent correction loop.
7. Shipping a sim change to the server without the client (or vice versa). The `welcome.v` protocol version only describes message shape; bump `PROTOCOL_VERSION` when snapshots change and deploy both together.
8. Per-tick motion of 16 px or more (`maxFall`, pad and stomp speeds, `runMax`, `walkerSpeed`): there is no sub-stepping, so tiles are skipped. All current values are far below.

**B. Invalidating the skill gates**
9. `jumpVel`, `gravityHeld`, `runBonus`, `walkMax`, `gravityFall`, `coyoteTicks`, `halfWidth` or `runMax` moves by more than the sensitivity ranges in section 6.
10. Changing any wall, pit or ledge in `playground` or `coopRoom` without re-running `sim.test.ts` "skill gates" and `coop.test.ts`.
11. Raising a stomp or pad speed so far that a solo player reaches a ledge meant for a team (a held stomp off an enemy already gives <!--num:d.enemyStompApex.held-->98.3<!--/num--> px above the enemy's feet).
12. Shortening the corridor timer or lengthening the corridor: the gate relies on a best-case run (<!--num:coop.corridorRunTicks-->384<!--/num--> ticks) staying above the timer (<!--num:coop.corridorTimerTicks-->300<!--/num--> ticks).
13. Lengthening a plate-to-gate run past `linger / 1.3` (gate 0: <!--num:coop.gate0RunTicks-->197<!--/num--> ticks needed against <!--num:coop.gate0Linger-->300<!--/num--> linger).

**C. Invariants the code assumes (checked by `mechanics-doc.test.ts`)**
14. `slopeInset > halfWidth + runMax`; `slopeSnap >= runMax`.
15. `stompWindow >= maxFall` (both the player and the enemy copy); `stompTolerance` and `stompSlack` below `stompWindow`.
16. `crouchHeight <= TILE`, `crouchHeight < height <= 2 * TILE`.
17. `dropTicks` such that the drop distance stays under one tile.
18. `padHeldVel > padVel > stompHeldVel > stompVel`; `padVel > 6.5 > stompHeldVel` and `stompVel > 4.4` (the client rumble tells events apart by launch speed); `5.46 < 5.49 < maxFall` (hard-land rumble).
19. `crouchMax <= walkMax < runMax`, `accel < skid`, `friction < skid`.

**D. Client copies and art**
20. `motion.ts` WALK_MAX and RUN_MAX must equal `walkMax` and `runMax` (the animation stride follows real speed). `rumble.ts` constants as above.
21. Changing `halfWidth`, `height` or `crouchHeight` changes where the 24 x 32 sprite sits relative to the hitbox, the creator preview, the stomp marker literals and every low-ceiling gap. Treat as an art change.
22. The marketing site replays the real sim (`apps/site/src/clips.ts`): re-watch the reel after tuning; scripted clips can stop making their jumps.

**E. Process**
23. Adding a `MOVEMENT`, `RULES` or `BTN` key without a description in `tools/mechanics/gen-numbers.mjs`: generation fails on purpose. Add the description and a `num` tag in the docs.
24. Editing `generated/NUMBERS.md` by hand: the test compares it byte for byte with the generator output.
25. A hot edit while players are connected: running rooms keep old numbers until the server restarts, and any recorded replay is tied to the config it was recorded under (a future replay validator must version the config).
