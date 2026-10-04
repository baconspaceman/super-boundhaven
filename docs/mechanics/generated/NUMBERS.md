<!-- GENERATED - do not edit; run npm run docs:mechanics -->
<!-- source: packages/sim/src/config.ts, levels, protocol constants, apps/server/src/server.ts, apps/client/src/game.ts -->

# Mechanics numbers (generated)

Every value below is read from the live code or measured by running the real `stepPlayer` / `stepWorld` on small synthetic levels. Measured rows say "sim" and are authoritative over any closed-form estimate. Hand-written docs quote these with `<!--num:key-->value<!--/num-->` tags; `packages/sim/test/mechanics-doc.test.ts` fails if a quoted value drifts.

## Units and global constants

| tag | value | unit | meaning |
|---|---|---|---|
| `TICK_RATE` | 60 | Hz | fixed sim rate (one tick = 1/60 s = 16.667 ms) |
| `TILE` | 16 | px | tile edge |
| `SCREEN_W` | 256 | px | native screen width (16 tiles) |
| `SCREEN_H` | 224 | px | native screen height (14 tiles) |
| `BTN_MASK` | 63 | bits | all six input bits; the server masks every input with it |

### Input bits (`BTN`)

| tag | value | meaning |
|---|---|---|
| `BTN.LEFT` | 1 | move left |
| `BTN.RIGHT` | 2 | move right |
| `BTN.JUMP` | 4 | jump (variable height while held) |
| `BTN.RUN` | 8 | run speed |
| `BTN.CROUCH` | 16 | hitbox 16, slow slide, drop through one-way platforms |
| `BTN.ACTION` | 32 | rising edge only: lever reach test |

## MOVEMENT (`packages/sim/src/config.ts`)

| tag | value | unit | meaning |
|---|---|---|---|
| `halfWidth` | 7 | px | half of the hitbox width (x is the body center): the body is 2 x halfWidth wide |
| `height` | 28 | px | standing hitbox height (feet to head) |
| `crouchHeight` | 16 | px | hitbox height while crouching (fits a 1-tile gap) |
| `crouchMax` | 0.9 | px/tick | ground speed cap while crouching |
| `dropTicks` | 8 | ticks | one-way platforms are ignored this long after a drop-through |
| `walkMax` | 1.4 | px/tick | top ground speed without RUN |
| `runMax` | 2.6 | px/tick | top ground speed with RUN |
| `accel` | 0.07 | px/tick^2 | ground acceleration toward the max speed |
| `skid` | 0.22 | px/tick^2 | ground deceleration while the input opposes the motion |
| `friction` | 0.1 | px/tick^2 | ground deceleration with no horizontal input |
| `overspeedDecel` | 0.04 | px/tick^2 | ground deceleration while faster than the current max with input held (crouch slide, run released) |
| `airAccel` | 0.06 | px/tick^2 | air acceleration toward the max speed AND air braking against the motion; there is no air drag |
| `jumpVel` | 5.2 | px/tick | initial upward speed (stored as a positive number) |
| `runBonus` | 0.1 | (px/tick) per (px/tick) | extra jump speed per unit of |vx| at takeoff |
| `gravityHeld` | 0.22 | px/tick^2 | gravity while rising with JUMP held |
| `gravityFall` | 0.42 | px/tick^2 | gravity while falling, or rising with JUMP released (the variable-jump cut) |
| `maxFall` | 5.5 | px/tick | terminal fall speed |
| `coyoteTicks` | 5 | ticks | grace after leaving ground in which a jump still works (0 disables) |
| `bufferTicks` | 6 | ticks | a JUMP press this recent is remembered until landing (0 disables) |
| `padVel` | 6.6 | px/tick | bounce pad launch speed (JUMP not held at touchdown) |
| `padHeldVel` | 8.2 | px/tick | bounce pad launch speed with JUMP held at touchdown |
| `stompVel` | 4.6 | px/tick | stomp bounce speed (player or enemy), JUMP not held |
| `stompHeldVel` | 6.2 | px/tick | stomp bounce speed with JUMP held |
| `stompPushDown` | 1.5 | px/tick | minimum downward speed forced on a stomped player |
| `stompWindow` | 12 | px | player-vs-player stomp: max px the stomper feet may be below the victim head |
| `stompTolerance` | 4 | px | player-vs-player stomp: px of slack for "was above the head last tick" |
| `pushMax` | 1.5 | px/tick | max separation applied to two overlapping players per tick (shared between both) |
| `slopeSnap` | 4 | px | a grounded body this far above a slope surface still snaps down to it |
| `slopeInset` | 10 | px | bottom px of the body ignored by horizontal wall checks while grounded (lets 45 degree steps pass) |

## RULES (`packages/sim/src/config.ts`)

| tag | value | unit | meaning |
|---|---|---|---|
| `rules.invulnTicks` | 90 | ticks | respawn invulnerability (hurt or pit) |
| `rules.actionReachX` | 20 | px | ACTION horizontal reach to a lever center |
| `rules.actionReachY` | 24 | px | ACTION vertical reach (body center to lever center) |
| `rules.enemyRespawnTicks` | 600 | ticks | a stomped enemy returns after this long |
| `rules.walkerSpeed` | 0.5 | px/tick | ground patroller speed (kinds 0 and 2) |
| `rules.flyerSpeed` | 0.6 | px/tick | sine flyer horizontal speed (kind 1) |
| `rules.enemyHalfWidth` | 6 | px | enemy half width (hitbox 12 wide) |
| `rules.enemyHeight` | 14 | px | enemy hitbox height |
| `rules.enemyGravity` | 0.3 | px/tick^2 | walker gravity |
| `rules.enemyMaxFall` | 4 | px/tick | walker terminal fall speed |
| `rules.stompWindow` | 12 | px | enemy stomp: max px the feet may be below the enemy top |
| `rules.stompSlack` | 6 | px | enemy stomp: max px the previous feet may be below the enemy top |
| `room.minPlayers` | 1 | players | default room: connected players needed to hold progress |
| `room.soloResetTicks` | 600 | ticks | default room: progress + fewer than minPlayers for this long => hard reset |
| `room.emptyResetTicks` | 600 | ticks | default room: progress + nobody for this long => hard reset |

## Derived: speeds, time, ground handling (sim)

| tag | value | unit | how |
|---|---|---|---|
| `d.tickMs` | 16.667 | ms | 1000 / TICK_RATE |
| `d.walkPxPerSec` | 84 | px/s | walkMax x 60 |
| `d.walkTilesPerSec` | 5.25 | tiles/s | walkMax x 60 / 16 |
| `d.runPxPerSec` | 156 | px/s | runMax x 60 |
| `d.runTilesPerSec` | 9.75 | tiles/s | runMax x 60 / 16 |
| `d.crouchTilesPerSec` | 3.38 | tiles/s | crouchMax x 60 / 16 |
| `d.walkAccelTicks` | 20 | ticks | sim: standing start to walkMax holding RIGHT |
| `d.walkAccelDist` | 14.7 | px | sim: distance covered during that |
| `d.runAccelTicks` | 38 | ticks | sim: standing start to runMax holding RIGHT+RUN |
| `d.runAccelDist` | 51.8 | px | sim: distance covered during that |
| `d.skidTicks` | 12 | ticks | sim: from runMax, hold the opposite direction until vx <= 0 |
| `d.skidDist` | 14.0 | px | sim: distance covered while skidding to a stop |
| `d.coastTicks` | 26 | ticks | sim: from runMax, release everything until vx = 0 |
| `d.coastDist` | 32.5 | px | sim: distance covered while coasting to a stop |
| `d.slideTicks` | 43 | ticks | sim: from runMax, hold CROUCH+RIGHT until vx <= crouchMax (overspeedDecel bleeds the speed) |
| `d.slideDist` | 74.0 | px | sim: distance covered during that slide |
| `d.terminalTicks` | 14 | ticks | free fall from rest with gravityFall until maxFall |
| `d.terminalDist` | 43.7 | px | distance fallen by then |
| `d.coyoteLate` | 4 | ticks | sim: last tick after leaving a ledge (0 = the leaving tick) on which a fresh JUMP press still jumps |
| `d.bufferEarly` | 4 | ticks | sim: earliest JUMP press before the landing tick that still produces a jump on touchdown |

## Derived: jumps (sim, flat ground, feet apex above takeoff)

"held" = JUMP held for the whole rise; "tap" = JUMP down for 1 tick only. Takeoff speed = jumpVel + |vx| x runBonus. "closed form" = v^2 / (2 g), the continuous estimate; the sim row is authoritative (the discrete integrator lands a few px lower).

| case | takeoff vy | apex px | apex tiles | air ticks | air distance px | closed form px |
|---|---|---|---|---|---|---|
| standing held | 5.20 | 58.9 | 3.68 | 41 | 0 | 61.5 |
| walking held | 5.34 | 62.2 | 3.88 | 42 | 59 | 64.8 |
| running held | 5.46 | 65.0 | 4.07 | 43 | 112 | 67.8 |
| standing tap | 5.20 | 32.0 | 2.00 | 25 | 0 | 32.2 |
| walking tap | 5.34 | 33.8 | 2.11 | 26 | 36 | 33.9 |
| running tap | 5.46 | 35.4 | 2.21 | 26 | 68 | 35.5 |

Tags: `d.apex.<case>`, `d.apexTiles.<case>`, `d.air.<case>`, `d.dist.<case>`, `d.takeoff.<case>` with case = `standHeld walkHeld runHeld standTap walkTap runTap`.

## Derived: what a body can clear (sim, best timing over every jump tick)

| tag | value | unit | meaning |
|---|---|---|---|
| `d.maxGap.walk` | 4 | tiles | widest pit crossable walking (landing grounded on the far side) |
| `d.maxGap.run` | 8 | tiles | widest pit crossable running |
| `d.maxWall.walk` | 3 | tiles | tallest 1-tile-thin wall cleared walking |
| `d.maxWall.run` | 4 | tiles | tallest 1-tile-thin wall cleared running |
| `d.maxLedge.walk` | 3 | tiles | tallest wide ledge landed on top of, walking |
| `d.maxLedge.run` | 4 | tiles | tallest wide ledge landed on top of, running |

A gap of `d.maxGap.run` tiles is the HARD LIMIT with perfect timing: required content must sit well inside it (see LEVEL_DESIGN_GUIDE.md tier table).

### Timing windows (ticks of jump-press timing that still succeed; 0 = impossible, 1 = frame-perfect)

Each tick of a straight approach at steady speed is one possible press time; the window is how many of them clear the obstacle. 60 ticks = 1 s. Pits are measured grounded-landing on the far side; walls are thin (1 tile) and cleared when the body is fully past. JUMP is held for 60 ticks from the press.

| pit width (tiles) | walk window | run window |
|---|---|---|
| 1 | 45 | 54 |
| 2 | 33 | 40 |
| 3 | 22 | 34 |
| 4 | 10 | 28 |
| 5 | 0 | 21 |
| 6 | 0 | 15 |
| 7 | 0 | 9 |
| 8 | 0 | 3 |
| 9 | 0 | 0 |

| wall height (tiles) | walk window | run window |
|---|---|---|
| 1 | 35 | 116 |
| 2 | 32 | 113 |
| 3 | 28 | 110 |
| 4 | 0 | 27 |
| 5 | 0 | 0 |

| spike patch width (tiles, on the floor) | walk window | run window |
|---|---|---|
| 1 | 23 | 32 |
| 2 | 11 | 26 |
| 3 | 0 | 20 |
| 4 | 0 | 13 |
| 5 | 0 | 7 |
| 6 | 0 | 1 |
| 7 | 0 | 0 |

| tag | value | unit | meaning |
|---|---|---|---|
| `d.maxSpike.walk` | 2 | tiles | widest floor spike patch crossable walking (landing past it unhurt) |
| `d.maxSpike.run` | 6 | tiles | widest floor spike patch crossable running |

Tags: `d.gapWin.<walk|run>.<tiles>`, `d.wallWin.<walk|run>.<tiles>`, `d.spikeWin.<walk|run>.<tiles>`.

### Tier limits (largest obstacle whose timing window is at least the tier floor)

The window floors are a PROPOSAL (design targets in `LEVEL_DESIGN_GUIDE.md`, derived from the completion targets in `docs/design/DIFFICULTY_PHILOSOPHY.md`); the sizes are computed from the windows above.

| tier | window floor (ticks) | pit walk | pit run | wall/ledge walk | wall/ledge run | floor spikes walk | floor spikes run |
|---|---|---|---|---|---|---|---|
| T0 | 20 | 3 | 5 | 3 | 4 | 1 | 3 |
| T1 | 15 | 3 | 6 | 3 | 4 | 1 | 3 |
| T2 | 15 | 3 | 6 | 3 | 4 | 1 | 3 |
| T3 | 8 | 4 | 7 | 3 | 4 | 2 | 4 |
| T4 | 5 | 4 | 7 | 3 | 4 | 2 | 5 |
| T5 | 2 | 4 | 8 | 3 | 4 | 2 | 5 |

Tags: `d.tier.<T0..T5>.<floor|pitWalk|pitRun|wallWalk|wallRun|spikeWalk|spikeRun>`.

## Derived: bounce pad and stomp (sim)

| tag | value | unit | meaning |
|---|---|---|---|
| `d.padApex.tap` | 48.6 | px | feet apex above the pad top, JUMP not held at touchdown |
| `d.padApex.held` | 148.7 | px | feet apex above the pad top, JUMP held |
| `d.padApexTiles.held` | 9.30 | tiles | held pad apex in tiles |
| `d.stompRise.tap` | 22.9 | px | feet apex above the victim HEAD after a stomp, JUMP not held |
| `d.stompRise.held` | 84.3 | px | feet apex above the victim head, JUMP held |
| `d.stompApexFloor.held` | 112.3 | px | held stomp off a grounded standing partner: feet apex above THEIR feet (head height + rise) |
| `d.stompApexFloor.tap` | 50.9 | px | tap stomp off a grounded standing partner: feet apex above their feet |
| `d.enemyStompApex.held` | 98.3 | px | held stomp off a walker standing on a floor: feet apex above THE ENEMY FEET (enemy height + rise): a solo player can use an enemy as a stepping stone |
| `d.stompApexFloorCrouch.held` | 100.3 | px | held stomp off a CROUCHING grounded partner (their head is 16, not 28, above their feet) |

Enemy stomps use the same `stompVel` / `stompHeldVel`, so the rise is the same measured from the enemy top.

## Skill gates of the `playground` level

| gate | layout | needs (px) | walk solo | run solo | held stomp off a partner |
|---|---|---|---|---|---|
| pit (cols 40-44) | 5 tiles wide | 80 wide | cannot | clears | n/a |
| 4-tile wall (col 74) | 4 tiles tall | 64 | cannot | clears | n/a |
| 6-tile wall (col 84) | 6 tiles tall | 96 | cannot | cannot | clears (apex 112.3 px) |
| high platform via bounce pad (col 50 to row 4) | platform top 64px, pad top 176px | 112 above the pad | tap 48.6: cannot | held 148.7: clears | n/a |

## Skill gates of the `coopRoom` level (derived from the level data and the sim)

| tag | value | unit | meaning |
|---|---|---|---|
| `coop.corridorTimerTicks` | 300 | ticks | timed lever duration (levers[timed].ticks) |
| `coop.corridorDistPx` | 951 | px | from the puller (standing 6 px left of the lever) to the corridor door face minus the body half width |
| `coop.corridorRunTicks` | 384 | ticks | sim: best case, running from a standing start over flat ground with no obstacles |
| `coop.corridorShortTicks` | 84 | ticks | ticks the puller is TOO SLOW by even with no spikes in the way (must be > 0 for the gate to need a partner) |
| `coop.ledgeAbovePx` | 96 | px | ledge top above the floor (slab at row 7) |
| `coop.soloBestPx` | 65.0 | px | best solo feet apex (running held jump) |
| `coop.stompBestPx` | 112.3 | px | feet apex of a held stomp off a grounded standing partner |
| `coop.ledgeSoloMargin` | 31.0 | px | how far short a solo run-jump falls (must be > 0) |
| `coop.ledgeStompMargin` | 16.3 | px | how far a held stomp clears the ledge top (must be > 0) |
| `coop.gate0DistTiles` | 25 | tiles | plate A to plate B |
| `coop.gate0Linger` | 300 | ticks | gate 0 stays open this long after a plate lapses |
| `coop.gate0RunTicks` | 197 | ticks | sim: plate A holder running to the gate 0 column (flat, no obstacles) |
| `coop.finalNeed` | 3 | plates | plates that must be held at once for the final gate |
| `coop.finalPlates` | 4 | plates | plates linked to the final gate |
| `coop.finalLinger` | 360 | ticks | final gate linger |
| `coop.minPlayers` | 2 | players | coopRoom room.minPlayers |
| `coop.maxPlayers` | 4 | players | coopRoom room.maxPlayers |

### Door links

| door | col | plates | levers | need | linger (ticks) |
|---|---|---|---|---|---|
| 0 | 40 | 1, 2 | - | all | 300 |
| 1 | 105 | - | 2, 3 | - | 0 |
| 2 | 132 | - | 0 | - | 0 |
| 3 | 170 | 3, 0, 4, 5 | - | 3 | 360 |

## Level registry (`LEVELS`)

| level | size (tiles) | spawn px (x, feet y) | checkpoints | shards | enemies (walker/flyer/spiky) | plates | levers (timed/reset) | doors | links | room (min/max players, solo reset, empty reset) |
|---|---|---|---|---|---|---|---|---|---|---|
| playground | 100 x 14 | 56, 192 | 0 | 0 | 0/0/0 | 0 | 0 (0/0) | 0 | 0 | 1/-, 600, 600 |
| coopRoom | 190 x 16 | 40, 208 | 4 | 18 | 1/1/1 | 6 | 6 (1/3) | 4 | 4 | 2/4, 600, 600 |

## Netcode constants

| tag | value | unit | meaning |
|---|---|---|---|
| `net.PROTOCOL_VERSION` | 3 |  | welcome.v |
| `net.SNAPSHOT_EVERY` | 3 | ticks | a snapshot is broadcast every Nth tick |
| `net.snapshotHz` | 20 | Hz | TICK_RATE / SNAPSHOT_EVERY |
| `net.snapshotMs` | 50 | ms | time between snapshots |
| `net.SNAPSHOT_FULL_EVERY` | 20 | snapshots | every Nth snapshot is a full world frame (1 Hz) |
| `net.SNAPSHOT_LOOK_EVERY` | 20 | snapshots | every Nth snapshot carries every look (1 Hz) |
| `net.MAX_NAME` | 16 | chars | player name length cap |
| `net.INTERP_DELAY_MS` | 100 | ms | client renders remote players this far in the past |
| `net.MAX_PENDING` | 120 | inputs | client keeps this many unacked inputs for replay (2 s) |
| `net.SNAP_ERR_PX` | 64 | px | reconcile error above this is snapped, not smoothed (also remote interpolation teleport) |
| `net.MAX_PLAYERS` | 16 | players | hard server cap (a level room.maxPlayers can lower it) |
| `net.MAX_PAYLOAD` | 1024 | bytes | ws frame cap; larger frames close the socket |
| `net.QUEUE_MAX` | 10 | inputs | per-player input queue length that triggers a trim |
| `net.QUEUE_TRIM` | 3 | inputs | queue is cut down to the newest N inputs on overflow |
| `net.MAX_CATCHUP` | 5 | ticks | max sim ticks the server runs per timer wake-up |
| `net.LOOP_MS` | 4 | ms | server timer period |
| `net.graceMs` | 10000 | ms | default token re-attach grace (the body is `away` meanwhile) |
| `net.LOOK_BURST` | 3 | messages | setLook token bucket capacity |
| `net.LOOK_REFILL_MS` | 1000 | ms | setLook token refill period |

## Tag index

All registered tags, in order. Docs may quote any of them as `<!--num:TAG-->value<!--/num-->`.

```
TICK_RATE = 60
TILE = 16
SCREEN_W = 256
SCREEN_H = 224
BTN_MASK = 63
BTN.LEFT = 1
BTN.RIGHT = 2
BTN.JUMP = 4
BTN.RUN = 8
BTN.CROUCH = 16
BTN.ACTION = 32
halfWidth = 7
height = 28
crouchHeight = 16
crouchMax = 0.9
dropTicks = 8
walkMax = 1.4
runMax = 2.6
accel = 0.07
skid = 0.22
friction = 0.1
overspeedDecel = 0.04
airAccel = 0.06
jumpVel = 5.2
runBonus = 0.1
gravityHeld = 0.22
gravityFall = 0.42
maxFall = 5.5
coyoteTicks = 5
bufferTicks = 6
padVel = 6.6
padHeldVel = 8.2
stompVel = 4.6
stompHeldVel = 6.2
stompPushDown = 1.5
stompWindow = 12
stompTolerance = 4
pushMax = 1.5
slopeSnap = 4
slopeInset = 10
rules.invulnTicks = 90
rules.actionReachX = 20
rules.actionReachY = 24
rules.enemyRespawnTicks = 600
rules.walkerSpeed = 0.5
rules.flyerSpeed = 0.6
rules.enemyHalfWidth = 6
rules.enemyHeight = 14
rules.enemyGravity = 0.3
rules.enemyMaxFall = 4
rules.stompWindow = 12
rules.stompSlack = 6
room.minPlayers = 1
room.soloResetTicks = 600
room.emptyResetTicks = 600
d.tickMs = 16.667
d.walkPxPerSec = 84
d.walkTilesPerSec = 5.25
d.runPxPerSec = 156
d.runTilesPerSec = 9.75
d.crouchTilesPerSec = 3.38
d.walkAccelTicks = 20
d.walkAccelDist = 14.7
d.runAccelTicks = 38
d.runAccelDist = 51.8
d.skidTicks = 12
d.skidDist = 14.0
d.coastTicks = 26
d.coastDist = 32.5
d.slideTicks = 43
d.slideDist = 74.0
d.terminalTicks = 14
d.terminalDist = 43.7
d.coyoteLate = 4
d.bufferEarly = 4
d.apex.standHeld = 58.9
d.apexTiles.standHeld = 3.68
d.air.standHeld = 41
d.dist.standHeld = 0
d.takeoff.standHeld = 5.20
d.apex.walkHeld = 62.2
d.apexTiles.walkHeld = 3.88
d.air.walkHeld = 42
d.dist.walkHeld = 59
d.takeoff.walkHeld = 5.34
d.apex.runHeld = 65.0
d.apexTiles.runHeld = 4.07
d.air.runHeld = 43
d.dist.runHeld = 112
d.takeoff.runHeld = 5.46
d.apex.standTap = 32.0
d.apexTiles.standTap = 2.00
d.air.standTap = 25
d.dist.standTap = 0
d.takeoff.standTap = 5.20
d.apex.walkTap = 33.8
d.apexTiles.walkTap = 2.11
d.air.walkTap = 26
d.dist.walkTap = 36
d.takeoff.walkTap = 5.34
d.apex.runTap = 35.4
d.apexTiles.runTap = 2.21
d.air.runTap = 26
d.dist.runTap = 68
d.takeoff.runTap = 5.46
d.maxGap.walk = 4
d.maxGap.run = 8
d.maxWall.walk = 3
d.maxWall.run = 4
d.maxLedge.walk = 3
d.maxLedge.run = 4
d.gapWin.walk.1 = 45
d.gapWin.run.1 = 54
d.gapWin.walk.2 = 33
d.gapWin.run.2 = 40
d.gapWin.walk.3 = 22
d.gapWin.run.3 = 34
d.gapWin.walk.4 = 10
d.gapWin.run.4 = 28
d.gapWin.walk.5 = 0
d.gapWin.run.5 = 21
d.gapWin.walk.6 = 0
d.gapWin.run.6 = 15
d.gapWin.walk.7 = 0
d.gapWin.run.7 = 9
d.gapWin.walk.8 = 0
d.gapWin.run.8 = 3
d.gapWin.walk.9 = 0
d.gapWin.run.9 = 0
d.wallWin.walk.1 = 35
d.wallWin.run.1 = 116
d.wallWin.walk.2 = 32
d.wallWin.run.2 = 113
d.wallWin.walk.3 = 28
d.wallWin.run.3 = 110
d.wallWin.walk.4 = 0
d.wallWin.run.4 = 27
d.wallWin.walk.5 = 0
d.wallWin.run.5 = 0
d.spikeWin.walk.1 = 23
d.spikeWin.run.1 = 32
d.spikeWin.walk.2 = 11
d.spikeWin.run.2 = 26
d.spikeWin.walk.3 = 0
d.spikeWin.run.3 = 20
d.spikeWin.walk.4 = 0
d.spikeWin.run.4 = 13
d.spikeWin.walk.5 = 0
d.spikeWin.run.5 = 7
d.spikeWin.walk.6 = 0
d.spikeWin.run.6 = 1
d.spikeWin.walk.7 = 0
d.spikeWin.run.7 = 0
d.maxSpike.walk = 2
d.maxSpike.run = 6
d.tier.T0.floor = 20
d.tier.T0.pitWalk = 3
d.tier.T0.pitRun = 5
d.tier.T0.wallWalk = 3
d.tier.T0.wallRun = 4
d.tier.T0.spikeWalk = 1
d.tier.T0.spikeRun = 3
d.tier.T1.floor = 15
d.tier.T1.pitWalk = 3
d.tier.T1.pitRun = 6
d.tier.T1.wallWalk = 3
d.tier.T1.wallRun = 4
d.tier.T1.spikeWalk = 1
d.tier.T1.spikeRun = 3
d.tier.T2.floor = 15
d.tier.T2.pitWalk = 3
d.tier.T2.pitRun = 6
d.tier.T2.wallWalk = 3
d.tier.T2.wallRun = 4
d.tier.T2.spikeWalk = 1
d.tier.T2.spikeRun = 3
d.tier.T3.floor = 8
d.tier.T3.pitWalk = 4
d.tier.T3.pitRun = 7
d.tier.T3.wallWalk = 3
d.tier.T3.wallRun = 4
d.tier.T3.spikeWalk = 2
d.tier.T3.spikeRun = 4
d.tier.T4.floor = 5
d.tier.T4.pitWalk = 4
d.tier.T4.pitRun = 7
d.tier.T4.wallWalk = 3
d.tier.T4.wallRun = 4
d.tier.T4.spikeWalk = 2
d.tier.T4.spikeRun = 5
d.tier.T5.floor = 2
d.tier.T5.pitWalk = 4
d.tier.T5.pitRun = 8
d.tier.T5.wallWalk = 3
d.tier.T5.wallRun = 4
d.tier.T5.spikeWalk = 2
d.tier.T5.spikeRun = 5
d.padApex.tap = 48.6
d.padApex.held = 148.7
d.padApexTiles.held = 9.30
d.stompRise.tap = 22.9
d.stompRise.held = 84.3
d.stompApexFloor.held = 112.3
d.stompApexFloor.tap = 50.9
d.enemyStompApex.held = 98.3
d.stompApexFloorCrouch.held = 100.3
pg.pitTiles = 5
pg.wall4Tiles = 4
pg.wall6Tiles = 6
pg.pitPx = 80
pg.wall4Px = 64
pg.wall6Px = 96
pg.padNeedPx = 112
coop.corridorTimerTicks = 300
coop.corridorDistPx = 951
coop.corridorRunTicks = 384
coop.corridorShortTicks = 84
coop.ledgeAbovePx = 96
coop.soloBestPx = 65.0
coop.stompBestPx = 112.3
coop.ledgeSoloMargin = 31.0
coop.ledgeStompMargin = 16.3
coop.gate0DistTiles = 25
coop.gate0Linger = 300
coop.gate0RunTicks = 197
coop.finalNeed = 3
coop.finalPlates = 4
coop.finalLinger = 360
coop.minPlayers = 2
coop.maxPlayers = 4
lv.playground.width = 100
lv.playground.height = 14
lv.playground.shards = 0
lv.coopRoom.width = 190
lv.coopRoom.height = 16
lv.coopRoom.shards = 18
net.PROTOCOL_VERSION = 3
net.SNAPSHOT_EVERY = 3
net.snapshotHz = 20
net.snapshotMs = 50
net.SNAPSHOT_FULL_EVERY = 20
net.SNAPSHOT_LOOK_EVERY = 20
net.MAX_NAME = 16
net.INTERP_DELAY_MS = 100
net.MAX_PENDING = 120
net.SNAP_ERR_PX = 64
net.MAX_PLAYERS = 16
net.MAX_PAYLOAD = 1024
net.QUEUE_MAX = 10
net.QUEUE_TRIM = 3
net.MAX_CATCHUP = 5
net.LOOP_MS = 4
net.graceMs = 10000
net.LOOK_BURST = 3
net.LOOK_REFILL_MS = 1000
```
