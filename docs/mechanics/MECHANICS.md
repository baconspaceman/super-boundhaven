# Super BoundHaven: Mechanics Reference

<!-- core:start -->
**Core summary.** The whole game plays inside one deterministic, shared sim (`packages/sim`): <!--num:TICK_RATE-->60<!--/num--> Hz fixed ticks, <!--num:TILE-->16<!--/num--> px tiles, positions in px (x = body center, y = feet), speeds in px/tick, IEEE doubles, no randomness or clocks. Client and server run the same `stepPlayer`, so any change to `packages/sim/src/config.ts` changes feel, every skill gate and the netcode at once. Input is a 6-bit mask (LEFT 1, RIGHT 2, JUMP 4, RUN 8, CROUCH 16, ACTION 32). The body is <!--num:halfWidth-->7<!--/num-->x2 = 14 px wide and <!--num:height-->28<!--/num--> px tall (<!--num:crouchHeight-->16<!--/num--> crouched). One `stepPlayer` tick runs in a fixed order: edge-detect inputs, crouch and drop-through, horizontal accel/skid/friction, coyote and buffer jump, gravity (held <!--num:gravityHeld-->0.22<!--/num--> vs fall <!--num:gravityFall-->0.42<!--/num-->), move X then Y with tile collision, slope snap, pit check, spikes/flags/shards. `stepWorld` then adds player stomps and pushes, enemies, levers, plates, doors and room reset rules. Jump apex is <!--num:d.apex.standHeld-->58.9<!--/num--> px standing and <!--num:d.apex.runHeld-->65.0<!--/num--> px running; a run-jump crosses at most <!--num:d.maxGap.run-->8<!--/num--> tiles of pit and <!--num:d.maxWall.run-->4<!--/num--> tiles of wall, which is exactly why the playground gates (5-tile pit, 4-tile wall, 6-tile co-op wall) work and why they are fragile: the 4-tile wall clears by only 1 px. The server is authoritative; the client predicts only its own body against static tiles and door state. Every number here is verified against code and tagged so `npm test` fails when docs drift; regenerate `generated/NUMBERS.md` with `npm run docs:mechanics`. Companion docs: `TUNING_GUIDE.md` (how to change a number safely), `LEVEL_DESIGN_GUIDE.md` (how to size gaps, walls, gates). Mounts, abilities, skill tree, gear budget, rulesets and raids are PLANNED, not implemented (section 12).
<!-- core:end -->

Status tags used in this document: **[IMPLEMENTED]** in the sim and tested; **[PROTOTYPE]** exists but is partial or untested at scale; **[PLANNED-ACCEPTED]** Anthony confirmed it or delegated and accepted it (see `DECISIONS.md`), not built yet; **[PROPOSAL]** a design suggestion nobody has accepted. The code always wins over any other document; where docs disagree with code, see appendix A.

Source of truth for numbers: `packages/sim/src/config.ts`. Computed and measured values: [`generated/NUMBERS.md`](generated/NUMBERS.md) (GENERATED, do not edit). Quoted values in this file look like `<!--num:jumpVel-->5.2<!--/num-->` in the source markdown; a test (`packages/sim/test/mechanics-doc.test.ts`) fails when one of them no longer matches the code.

Related: [TUNING_GUIDE.md](TUNING_GUIDE.md), [LEVEL_DESIGN_GUIDE.md](LEVEL_DESIGN_GUIDE.md), [`docs/NETCODE.md`](../NETCODE.md), [`docs/CONTROLS.md`](../CONTROLS.md), [`docs/design/GAME_DESIGN_DOCUMENT.md`](../design/GAME_DESIGN_DOCUMENT.md), [`docs/design/COOP_ROOM_M3.md`](../design/COOP_ROOM_M3.md), [`docs/design/DIFFICULTY_PHILOSOPHY.md`](../design/DIFFICULTY_PHILOSOPHY.md), design bible `docs/bible/DESIGN_BIBLE.md`, roadmap `docs/roadmap/`, team protocol `docs/ai-team/PROTOCOL.md`.

## 1. Units, time and determinism **[IMPLEMENTED]**

| Quantity | Value |
|---|---|
| Tick rate | <!--num:TICK_RATE-->60<!--/num--> Hz, one tick = <!--num:d.tickMs-->16.667<!--/num--> ms. The sim has no notion of wall-clock time. |
| Tile | <!--num:TILE-->16<!--/num--> px square. Level coordinates are (col, row), row 0 at the top. |
| Native screen | <!--num:SCREEN_W-->256<!--/num--> x <!--num:SCREEN_H-->224<!--/num--> px (16 x 14 tiles), integer scaled by the client. |
| Position | `x` = horizontal center of the body, `y` = feet (bottom of the body), px, `y` grows downward. |
| Velocity | px per tick. `vy < 0` is up. Per-tick speeds must stay below one tile (16 px) or tiles can be skipped (there is no sub-stepping). |
| Accelerations | px per tick per tick. |
| Time | ticks. 60 ticks = 1 s. Convert with `d.tickMs`. |

Speeds in familiar units: walk <!--num:d.walkPxPerSec-->84<!--/num--> px/s (<!--num:d.walkTilesPerSec-->5.25<!--/num--> tiles/s), run <!--num:d.runPxPerSec-->156<!--/num--> px/s (<!--num:d.runTilesPerSec-->9.75<!--/num--> tiles/s), crouch slide cap <!--num:d.crouchTilesPerSec-->3.38<!--/num--> tiles/s.

### Determinism rules

The server, every client and every test must produce bit-identical state from identical inputs. This is what makes client prediction, reconciliation and (future) replay proofs possible.

Do:
- Run one code path for client and server: `stepPlayer(level, p, buttons, cfg, dynamic)` and `stepWorld(level, world, inputs, cfg)`. Same arguments, same order.
- Use only `+ - * /`, comparisons and `Math.floor/min/max/abs`. These are exact IEEE-754 operations on every JS engine.
- Keep `world.players` sorted by id ascending (the server relies on monotonic ids). Keep entity lists (enemies, levers, plates, doors, links) indexed by id.
- Use literal tables for anything periodic (the flyer sine is a 32-entry literal table, `SINE` in `entities.ts`).

Do not (each of these desyncs client and server, or makes two runs differ):
- `Math.random`, `Date.now`, `performance.now`, anything time-based inside the sim.
- `Math.sin/cos/pow/exp/hypot/sqrt` in sim code: results may differ by engine and version. Use tables or integer-friendly math.
- Reorder or "simplify" floating-point expressions (`(a + b) + c` is not `a + (b + c)`). Associativity changes bits. Edit the formula in the sim and both sides change together; never copy the math into the client.
- Per-client or per-player config that the other side does not know (a different `cfg` for the same player on client and server).
- Iteration over `Map`/`Set`/object keys that are not integer-like in an order-dependent way; `world.dynamic` is keyed by integer door ids and is read in id order.

The sim uses plain doubles (not fixed-point). `DECISIONS.md` notes this must be revisited if a non-JS runtime ever has to share the sim.

## 2. Inputs **[IMPLEMENTED]**

`PlayerState` is driven by one integer per tick. Server masks every received input with `BTN_MASK` (<!--num:BTN_MASK-->63<!--/num-->).

| Bit | Button | Value | Behaviour |
|---|---|---|---|
| 0 | `BTN.LEFT` | <!--num:BTN.LEFT-->1<!--/num--> | move left (LEFT and RIGHT together cancel: `dir = right - left`) |
| 1 | `BTN.RIGHT` | <!--num:BTN.RIGHT-->2<!--/num--> | move right |
| 2 | `BTN.JUMP` | <!--num:BTN.JUMP-->4<!--/num--> | jump on the rising edge; while held and rising, gravity is lower (variable height) |
| 3 | `BTN.RUN` | <!--num:BTN.RUN-->8<!--/num--> | selects `runMax` as the ground speed cap (the client can make this a toggle) |
| 4 | `BTN.CROUCH` | <!--num:BTN.CROUCH-->16<!--/num--> | hitbox shrinks to 16 px, slow ground speed, drop through one-way platforms |
| 5 | `BTN.ACTION` | <!--num:BTN.ACTION-->32<!--/num--> | rising edge only: pulls the nearest lever within reach (later: mounts, powerups) |

Edge detection is stored in the player: `prevJump`, `prevAction`; `act` is true for exactly the tick of an ACTION rising edge and is consumed by `stepWorld` (`pressLevers`) the same tick. Keyboard, pad and remapping live in the client (`docs/CONTROLS.md`); the sim only sees the mask.

## 3. Player state

`PlayerState` (`types.ts`) is plain data and travels whole in every snapshot.

| Field | Meaning |
|---|---|
| `id` | player id (sort key) |
| `x`, `y` | center x, feet y (px) |
| `vx`, `vy` | velocity (px/tick, `vy < 0` is up) |
| `onGround` | grounded as of the end of the last step |
| `facing` | 1 or -1 (last direction pressed) |
| `coyote`, `buffer` | jump grace counters |
| `prevJump`, `jumpHeld`, `prevAction`, `act` | input edge state |
| `prevY` | feet y at the start of the last step (used by landing and stomp tests) |
| `crouching` | hitbox is `crouchHeight` tall (held, or forced by a low ceiling) |
| `drop` | ticks left ignoring one-way platforms |
| `checkpoint` | index into `level.checkpoints`, -1 = level spawn |
| `shards`, `got` | collected count (kept across deaths) and a per-player bitset (32 ids per word) |
| `invuln` | ticks of respawn invulnerability left |
| `deaths` | respawn counter (the client uses a change to fire effects) |
| `away` | disconnected-but-held: inert (no plates, hazards, pushes, stomps, input) |

## 4. The movement model, step by step (`stepPlayer`) **[IMPLEMENTED]**

`stepPlayer(level, p, buttons, cfg = MOVEMENT, dynamic?)` mutates `p` for one tick against the static level only (no other players or enemies). `dynamic` is door open state (door id to open); without it all doors read closed. It runs these steps in exactly this order. Changing the order changes behavior everywhere; do not.

**Step 1: decode.** `buttons &= BTN_MASK`. `dir = right - left`. `jumpPressed = jump && !prevJump`. Store `prevJump`, `jumpHeld = jump`, `act = action && !prevAction`, `prevAction`. `prevY = y`. Decrement `invuln` and `drop` if above 0.

**Step 2: crouch.** If CROUCH is held, `crouching = true`. Otherwise, if currently crouching and `canStand` (no solid tile in the band between crouch height and standing height above the feet), `crouching = false`. So you cannot stand up under a low ceiling. Height while crouching is `crouchHeight` = <!--num:crouchHeight-->16<!--/num--> px, standing `height` = <!--num:height-->28<!--/num--> px. The change is instant and keeps the feet fixed.

**Step 3: drop-through.** `wasGround = onGround`. If grounded, CROUCH held and the feet stand on one-way platforms only (every tile under the body columns is empty or semi-solid, none solid, none slope, at least one semi-solid): `drop = dropTicks` (<!--num:dropTicks-->8<!--/num--> ticks), `onGround = false`, `wasGround = false`, and later this tick `coyote = buffer = 0`, so CROUCH+JUMP drops instead of jumping. While `drop > 0`, landing on one-way platforms is skipped. 8 ticks of free fall is 15.1 px, which is why a stack of platforms exactly one tile (16 px) apart still catches you on the next one.

**Step 4: speed cap.** `maxSpeed = crouchMax` (<!--num:crouchMax-->0.9<!--/num--> px/tick) if `crouching && onGround`; else `runMax` (<!--num:runMax-->2.6<!--/num-->) if RUN; else `walkMax` (<!--num:walkMax-->1.4<!--/num-->). Note `onGround` is last tick's grounded state (false after a drop-through).

**Step 5: horizontal control.**

```
if dir != 0:
  facing = dir
  if vx*dir < 0:            vx += dir * (onGround ? skid : airAccel)         # reversing
  elif vx*dir < maxSpeed:   vx += dir * (onGround ? accel : airAccel); clamp to dir*maxSpeed
  elif onGround:            vx = approach(vx, dir*maxSpeed, overspeedDecel)  # faster than the cap
elif onGround:              vx = approach(vx, 0, friction)
```

| Param | Value | Effect |
|---|---|---|
| `accel` | <!--num:accel-->0.07<!--/num--> | ground acceleration: walk speed in <!--num:d.walkAccelTicks-->20<!--/num--> ticks (<!--num:d.walkAccelDist-->14.7<!--/num--> px), run speed in <!--num:d.runAccelTicks-->38<!--/num--> ticks (<!--num:d.runAccelDist-->51.8<!--/num--> px) |
| `skid` | <!--num:skid-->0.22<!--/num--> | reversing on the ground: from run speed to a stop in <!--num:d.skidTicks-->12<!--/num--> ticks, <!--num:d.skidDist-->14.0<!--/num--> px |
| `friction` | <!--num:friction-->0.1<!--/num--> | no input on the ground: run speed to a stop in <!--num:d.coastTicks-->26<!--/num--> ticks, <!--num:d.coastDist-->32.5<!--/num--> px |
| `overspeedDecel` | <!--num:overspeedDecel-->0.04<!--/num--> | holding a direction while faster than the cap on the ground (released RUN, or crouching): a slow bleed. Crouch + direction from run speed slides <!--num:d.slideTicks-->43<!--/num--> ticks and <!--num:d.slideDist-->74.0<!--/num--> px before settling to `crouchMax` |
| `airAccel` | <!--num:airAccel-->0.06<!--/num--> | air steering up to the cap AND braking against motion. There is no air drag: with no input, `vx` is unchanged in the air. Above the cap in the air nothing happens, so releasing RUN mid-air keeps run speed |

**Step 6: jump.**

```
coyote = onGround ? coyoteTicks : max(0, coyote - 1)
buffer = jumpPressed ? bufferTicks : max(0, buffer - 1)
if dropping: coyote = buffer = 0
if buffer > 0 && (onGround || coyote > 0):
    vy = -(jumpVel + |vx| * runBonus); onGround = false; coyote = 0; buffer = 0
```

`jumpVel` = <!--num:jumpVel-->5.2<!--/num--> px/tick, `runBonus` = <!--num:runBonus-->0.1<!--/num--> per px/tick of `|vx|` at takeoff: standing <!--num:d.takeoff.standHeld-->5.20<!--/num-->, walking <!--num:d.takeoff.walkHeld-->5.34<!--/num-->, running <!--num:d.takeoff.runHeld-->5.46<!--/num-->. Coyote: `coyoteTicks` = <!--num:coyoteTicks-->5<!--/num--> means a fresh press still jumps up to <!--num:d.coyoteLate-->4<!--/num--> ticks after the tick you left the ledge (5 ticks counting the leaving tick, about 83 ms). Buffer: `bufferTicks` = <!--num:bufferTicks-->6<!--/num--> remembers a press made up to <!--num:d.bufferEarly-->4<!--/num--> ticks before the landing tick (`bufferTicks - 2` early ticks, 5 counting the landing tick, because the jump executes the tick after touchdown). Both are shared feel settings for every player ("not a purchasable stat", `DECISIONS.md`).

**Step 7: gravity.** `g = (vy < 0 && jump) ? gravityHeld : gravityFall`; `vy = min(vy + g, maxFall)`. `gravityHeld` = <!--num:gravityHeld-->0.22<!--/num--> while rising with JUMP held, `gravityFall` = <!--num:gravityFall-->0.42<!--/num--> falling or rising with JUMP released (releasing early does not zero `vy`, it just swaps to the heavier gravity: the variable-jump cut). `maxFall` = <!--num:maxFall-->5.5<!--/num--> px/tick, reached after <!--num:d.terminalTicks-->14<!--/num--> ticks and <!--num:d.terminalDist-->43.7<!--/num--> px of free fall. Gravity applies on the jump tick too, so the first airborne velocity is `-(takeoff - 0.22)`.

**Step 8: move.** `onGround = false`, then:

1. `moveX(vx)`: `x += vx`; test the leading column (`x + halfWidth - 0.001` going right, `x - halfWidth` going left) for rows from the head down to `feet - inset`, where `inset = slopeInset` (<!--num:slopeInset-->10<!--/num--> px) when grounded last tick and 0 in the air. The first solid tile (`#`, `B`, closed `D`) snaps `x` flush to its edge and zeroes `vx`. The inset lets a grounded body ride 45 degree steps without clipping the next step; it must stay larger than `halfWidth` plus top speed.
2. `moveY(vy)`: `y += vy`. Falling: for every tile column the body overlaps, check the row under the new feet. A solid tile (or a one-way tile when `drop == 0`) catches you only if `prevY <= row*16 + 0.001`: you can only land from above, never by clipping a side. Grounded bodies get `slopeSnap` (<!--num:slopeSnap-->4<!--/num--> px) of slack in their center column, so walking off the top edge of a slope onto a flat lip still lands. Landing on `B` launches instead: `vy = -(jumpHeld ? padHeldVel : padVel)` (<!--num:padHeldVel-->8.2<!--/num--> held, <!--num:padVel-->6.6<!--/num--> tap) and stays airborne; any other landing sets `vy = 0`, `onGround = true`, `y = tile top`. Rising: the row at the head (`y - bodyHeight`, crouch aware) is tested; a solid tile snaps the head under it and zeroes `vy` (head bump).
3. `applySlope`: skipped while rising. Looks only at the tile column under the body center, rows `r0-1..r0+1` with `r0 = floor((y-1)/16)`. Slope floor height `f`: `/` rises to the right, `f = rowTop + 16 - (x - colLeft)`; `\` rises to the left, `f = rowTop + (x - colLeft)`. If `y >= f - snap` and `y <= f + 16` (snap is `slopeSnap` if grounded last tick, else 0), the feet are set to the highest such `f`, `vy = 0`, `onGround = true`. Slopes are not solid; the level author must put solid tiles under every slope tile (see the playground ramps).

**Step 9: pit.** If `y > (level.height + 3) * 16`, `respawn()` and return (steps 10 skipped). Level left/right edges are solid walls; above row 0 is open air; below the last row is a pit.

**Step 10: statics** (skipped when `away`): spikes (only when `invuln == 0`), checkpoint flags, shards. See section 6.

### One-way platforms **[IMPLEMENTED]**

`-` is solid from above only: you pass up through it and sideways, you land on it falling, you can drop through it with CROUCH (step 3). Platforms never block `moveX`. They do not give slope or pad behavior. Enemies walk on them.

### Crouch hitbox **[IMPLEMENTED]**

Crouched body: 14 x <!--num:crouchHeight-->16<!--/num--> px. It fits a 1-tile gap, its head bump height is 16 px, and its speed cap on the ground is `crouchMax`. It also makes you easier to stomp onto a lower head (a held stomp off a crouched partner reaches <!--num:d.stompApexFloorCrouch.held-->100.3<!--/num--> px instead of <!--num:d.stompApexFloor.held-->112.3<!--/num-->).

## 5. The world tick (`stepWorld`) **[IMPLEMENTED]**

`stepWorld(level, world, inputs, cfg = MOVEMENT)` is the full authoritative tick. If `world.levelName` differs from `level.name` the room is reset first. Then, in order:

1. `stepPlayer` for every player (an `away` player gets input 0; it still falls and collides).
2. `resolvePlayers`: stomps and pushes between every non-away pair `i < j`.
3. `stepEnemies`: walkers and flyers move; dead enemies count down to respawn.
4. `enemyContacts`: players vs enemies (stomp or hurt).
5. `pressLevers`: timed lever countdowns, then ACTION presses.
6. `updatePlates`: pressure plates from who is standing where.
7. `updateDoors`: door open state from plates, levers and linger.
8. `roomRules`: solo/empty reset timers.
9. `tick++`.

### Player vs player: stomp and push

**Stomp** `tryStomp(a, b)` (attacker `a`, victim `b`): all must hold: `|a.x - b.x| < 2*halfWidth - 1` (13 px), `a.y > a.prevY` (descending), `bTop = b.y - bodyHeight(b)`, `a.y >= bTop` and `a.y - bTop <= stompWindow` (<!--num:stompWindow-->12<!--/num--> px), and `a.prevY <= b.prevY - bodyHeight(b) + stompTolerance` (<!--num:stompTolerance-->4<!--/num--> px slack for "was above the head"). Effect: `a.vy = -(a.jumpHeld ? stompHeldVel : stompVel)` (<!--num:stompHeldVel-->6.2<!--/num--> held, <!--num:stompVel-->4.6<!--/num--> tap), `a.y = bTop`, `a.onGround = false`, `a.coyote = 0`; victim `b.vy = max(b.vy, stompPushDown)` (<!--num:stompPushDown-->1.5<!--/num-->). Nobody is hurt. A stomped pair skips the push that tick. Both directions are tried (`a` on `b`, then `b` on `a`).

**Push** `tryPush`: players overlap when `2*halfWidth - |dx| > 0` and `|a.y - b.y| < min(heightA, heightB) - 2`. Each is moved apart horizontally by `min(overlap/2, pushMax)` (<!--num:pushMax-->1.5<!--/num--> px/tick), stopped by walls (`vx = 0` on a hit). Exactly equal `x` resolves by id (lower id goes left). Away players are inert here.

### Enemies **[IMPLEMENTED]**

Three kinds, markers `e`, `z`, `k` in the level. Hitbox 2 x <!--num:rules.enemyHalfWidth-->6<!--/num--> wide, <!--num:rules.enemyHeight-->14<!--/num--> tall (smaller than their art; a known polish item).

| Kind | Marker | Behavior | Stompable |
|---|---|---|---|
| 0 walker | `e` | gravity <!--num:rules.enemyGravity-->0.3<!--/num-->, max fall <!--num:rules.enemyMaxFall-->4<!--/num-->; walks <!--num:rules.walkerSpeed-->0.5<!--/num--> px/tick (30 px/s); starts moving right; turns at a wall (solid tile in front across its body height) and at a ledge (no solid or one-way tile under the leading edge); lands on solid and one-way tiles; if it falls out of the world it returns to its post | yes |
| 1 flyer | `z` | ignores terrain; moves <!--num:rules.flyerSpeed-->0.6<!--/num--> px/tick between `post.x +/- range` (`range` defaults to 32 px, set per enemy by `meta.enemies[id].range`) and bobs on a quantized sine: amplitude 12 px, period 96 ticks | yes |
| 2 spiky walker | `k` | the same AI as the walker | no: always hurts |

**Contact** (`enemyContacts`, per non-away player, per alive enemy): boxes overlap in x and y. It is a stomp if kind is not 2 and `p.y > p.prevY` and `p.y - enemyTop <= rules.stompWindow` (<!--num:rules.stompWindow-->12<!--/num--> px) and `p.prevY - enemyTop <= rules.stompSlack` (<!--num:rules.stompSlack-->6<!--/num--> px). Stomp: the enemy dies and a respawn countdown of `enemyRespawnTicks` (<!--num:rules.enemyRespawnTicks-->600<!--/num--> ticks = 10 s) starts; the player bounces with the same `stompVel` / `stompHeldVel` as a player stomp, `y = enemyTop`, and `room.progress = true`. Otherwise, if `invuln == 0`, the player respawns (hurt). With `invuln > 0` an overlap does nothing. After a stomp, a held jump off an enemy on the floor lifts the player to <!--num:d.enemyStompApex.held-->98.3<!--/num--> px above the enemy's feet: a solo player can use an enemy as a stepping stone, so never place a high required ledge directly above a walker.

### Levers, plates, doors **[IMPLEMENTED]**

**Levers** (`l`): defined by position, `ticks` (0 = toggle, >0 = timed) and `reset`. Each tick, timed levers that are on count down and turn off at 0. Then for every non-away player whose `act` is true: the first lever (id order) within `actionReachX` = <!--num:rules.actionReachX-->20<!--/num--> px horizontally and `actionReachY` = <!--num:rules.actionReachY-->24<!--/num--> px vertically (player center to lever center; `y - bodyHeight/2`) is used, one lever per press. A reset lever calls `resetRoom` (levers off, doors closed, enemies back, timers cleared; nobody moves; `room.resets++`). A toggle lever flips; a timed lever turns on and its timer restarts on every pull (`on = true; t = ticks`). Any non-reset pull sets `room.progress`. Two players pulling a toggle on the same tick flip it twice.

**Plates** (`p`): a plate is a floor marker (the tile it occupies is empty). It is pressed when any non-away player is grounded with `|y - plateFloorY| <= 1` and `|x - plateCenterX| < 8 + halfWidth - 1` (14 px). Standing on a one-way platform under the plate counts if the feet are at the plate's floor y. Not pressed from the air or by an away player.

**Doors** (`D`): 4-connected `D` tiles form one door; ids by reading order of the first tile. Solid when closed, passable when `world.dynamic[id]` is true. Doors are opened only through `meta.links`. `updateDoors` each tick: every linked door starts closed; for each link, `cond` = (plates held >= `need`, default all listed) OR (any listed lever on). While `cond` holds, `linger[i] = link.linger ?? 0`; when it lapses the door stays open while `linger[i]` counts down. A door never closes while any non-away player overlaps one of its tiles (no crushing or embedding). Several links to one door are OR-ed. An unlinked `D` is a permanent wall. Any open door sets `room.progress`.

### Rooms: progress and reset **[IMPLEMENTED]**

`room.progress` becomes true when a door opens, a non-reset lever is pulled, an enemy is stomped, or any player has `checkpoint >= 0`. It guards the timers, so a lone visitor idling at a fresh entrance is never reset. With progress set, `roomRules` counts non-away players: zero for `emptyResetTicks`, or fewer than `room.minPlayers` for `soloResetTicks`, triggers `hardResetRoom`: `resetRoom` plus every player's `checkpoint = -1` and placed at the entrance (even away players); shards, `invuln` and `deaths` are kept. Defaults (`RULES.defaultRoom`): `minPlayers` <!--num:room.minPlayers-->1<!--/num-->, `soloResetTicks` <!--num:room.soloResetTicks-->600<!--/num-->, `emptyResetTicks` <!--num:room.emptyResetTicks-->600<!--/num-->. A level overrides them with `meta.room`.

### Disconnects (`away`) **[IMPLEMENTED]**

When a socket closes, the server keeps the session for the grace period (`graceMs`, <!--num:net.graceMs-->10000<!--/num--> ms) and sets `away = true`. An away body: gets input 0, still falls and collides with the world, can fall in a pit, but presses no plate, pulls no lever, blocks no door, takes no spike/flag/shard, is not hurt by enemies, and cannot be stomped or pushed. Re-attach with the token clears `away` and sends a full world frame. After the grace period the player is removed.

## 6. Hurt, respawn, checkpoints, invulnerability, shards **[IMPLEMENTED]**

- **Hurt** = touching a non-stomped enemy, a spike, or falling in a pit (`y > (height+3)*16`). The response is always `respawn(level, p)`: place at the last checkpoint (or the level spawn), `vx = vy = 0`, grounded/coyote/buffer/crouch/drop cleared, `invuln = rules.invulnTicks` (<!--num:rules.invulnTicks-->90<!--/num--> ticks = 1.5 s), `deaths++`. Nothing else is lost: shards are kept, there are no lives.
- **Spikes** (`^`, not solid): the spike body is x 2..14, y 6..16 inside its tile. The player test uses the body shrunk by 1 px at each side and 0.5 px at the feet. Ignored while `invuln > 0`. Spikes stand about 10 px above their floor, so any hop clears them.
- **Checkpoints** (`C`): trigger when `|x - flagX| < 12 + halfWidth` (38 px wide), `y > flagFeetY - 80`, `head < flagFeetY` (80 px tall: a normal jump over it counts). Checkpoints are per player; the most recently touched index wins (backtracking moves you back). The entrance is the level spawn, shared by everyone.
- **Shards** (`o`): collected when `|x - sx| < 8 + halfWidth` and the shard center is between `head - 6` and `feet + 6`. Per player (`got` bitset, 32 ids per word); other players still see the shard. Kept through deaths and resets.

## 7. Derived quantities and worked examples

Measured by the generator on the real sim (`generated/NUMBERS.md` has every row). Feet apex above takeoff, flat ground, JUMP held for the whole rise.

| Case | Takeoff vy | Apex px | Apex tiles | Air ticks | Air distance px |
|---|---|---|---|---|---|
| standing held | <!--num:d.takeoff.standHeld-->5.20<!--/num--> | <!--num:d.apex.standHeld-->58.9<!--/num--> | <!--num:d.apexTiles.standHeld-->3.68<!--/num--> | <!--num:d.air.standHeld-->41<!--/num--> | <!--num:d.dist.standHeld-->0<!--/num--> |
| walking held | <!--num:d.takeoff.walkHeld-->5.34<!--/num--> | <!--num:d.apex.walkHeld-->62.2<!--/num--> | <!--num:d.apexTiles.walkHeld-->3.88<!--/num--> | <!--num:d.air.walkHeld-->42<!--/num--> | <!--num:d.dist.walkHeld-->59<!--/num--> |
| running held | <!--num:d.takeoff.runHeld-->5.46<!--/num--> | <!--num:d.apex.runHeld-->65.0<!--/num--> | <!--num:d.apexTiles.runHeld-->4.07<!--/num--> | <!--num:d.air.runHeld-->43<!--/num--> | <!--num:d.dist.runHeld-->112<!--/num--> |
| standing tap | <!--num:d.takeoff.standTap-->5.20<!--/num--> | <!--num:d.apex.standTap-->32.0<!--/num--> | <!--num:d.apexTiles.standTap-->2.00<!--/num--> | <!--num:d.air.standTap-->25<!--/num--> | <!--num:d.dist.standTap-->0<!--/num--> |
| walking tap | <!--num:d.takeoff.walkTap-->5.34<!--/num--> | <!--num:d.apex.walkTap-->33.8<!--/num--> | <!--num:d.apexTiles.walkTap-->2.11<!--/num--> | <!--num:d.air.walkTap-->26<!--/num--> | <!--num:d.dist.walkTap-->36<!--/num--> |
| running tap | <!--num:d.takeoff.runTap-->5.46<!--/num--> | <!--num:d.apex.runTap-->35.4<!--/num--> | <!--num:d.apexTiles.runTap-->2.21<!--/num--> | <!--num:d.air.runTap-->26<!--/num--> | <!--num:d.dist.runTap-->68<!--/num--> |

"Tap" = JUMP down for one tick. The variable jump therefore ranges from about 2 tiles (tap) to about 4 tiles (held, running).

**Worked example: held standing jump.** Takeoff `v = jumpVel = 5.2`. Rising ticks are those with `v - g*n > 0`: `N = floor(v / gravityHeld) = floor(5.2 / 0.22) = 23`. Rise `H = N*v - g*N*(N+1)/2 = 23*5.2 - 0.22*276 = 119.6 - 60.72 = 58.88 px`. That matches the sim (<!--num:d.apex.standHeld-->58.9<!--/num--> px). The continuous estimate `v^2 / 2g = 61.5` is 2.6 px too high; do not use it for margins.

**Worked example: running takeoff.** `v = 5.2 + 2.6 * 0.1 = 5.46`, `N = floor(5.46 / 0.22) = 24`, `H = 24*5.46 - 0.22*300 = 131.04 - 66 = 65.04 px`. Air time <!--num:d.air.runHeld-->43<!--/num--> ticks at <!--num:runMax-->2.6<!--/num--> px/tick covers about `43 * 2.6 = 111.8` px (<!--num:d.dist.runHeld-->112<!--/num--> measured).

**Worked example: the widest crossable pit.** A pit of `g` px is crossed when `airDistance + 2*halfWidth + coyoteLate*speed >= g` (the body stays supported until its trailing edge leaves, lands once its leading edge touches, and a late coyote press adds travel). Running: `112 + 14 + 4*2.6 = 136.4` px, so 8 tiles (128 px) works with `(136.4 - 128)/2.6 = 3.2` ticks of timing window (measured <!--num:d.gapWin.run.8-->3<!--/num-->) and 9 tiles (144 px) is impossible (measured <!--num:d.maxGap.run-->8<!--/num--> tiles max). Walking: `59 + 14 + 4*1.4 = 78.6` px, so 4 tiles (64 px) works with window <!--num:d.gapWin.walk.4-->10<!--/num--> and a 5-tile pit (80 px) is missed by only 1.4 px (measured window <!--num:d.gapWin.walk.5-->0<!--/num-->). The "5-tile pit needs a run-jump" gate is a 1.4 px effect: any change that adds more than ~1.4 px of walking distance (more walkMax, more jump air time, more coyote) silently breaks that gate.

**Reach table (feet apex above the floor, the tallest ledge landed on, thin wall cleared):**

| Source | Value | Tallest ledge (tiles) | Tallest wall (tiles) |
|---|---|---|---|
| walking held jump | <!--num:d.apex.walkHeld-->62.2<!--/num--> px | <!--num:d.maxLedge.walk-->3<!--/num--> | <!--num:d.maxWall.walk-->3<!--/num--> |
| running held jump | <!--num:d.apex.runHeld-->65.0<!--/num--> px | <!--num:d.maxLedge.run-->4<!--/num--> | <!--num:d.maxWall.run-->4<!--/num--> |
| bounce pad, tap | <!--num:d.padApex.tap-->48.6<!--/num--> px above the pad | n/a | n/a |
| bounce pad, held | <!--num:d.padApex.held-->148.7<!--/num--> px (<!--num:d.padApexTiles.held-->9.30<!--/num--> tiles) above the pad | n/a | n/a |
| stomp, tap | <!--num:d.stompRise.tap-->22.9<!--/num--> px above the victim's head | n/a | n/a |
| stomp, held | <!--num:d.stompRise.held-->84.3<!--/num--> px above the victim's head | n/a | n/a |
| held stomp off a grounded standing partner | <!--num:d.stompApexFloor.held-->112.3<!--/num--> px above their feet (head 28 + rise) | 7 | n/a |

A 4-tile (64 px) wall against a run apex of <!--num:d.apex.runHeld-->65.0<!--/num--> px is cleared by a whisker (the timing window is still <!--num:d.wallWin.run.4-->27<!--/num--> ticks, because you can land on its top). One percent less `jumpVel` and it becomes impossible. See the sensitivity table in `TUNING_GUIDE.md`.

## 8. Skill gates and why each is solvable (or not) solo **[IMPLEMENTED]**

A "gate" is a level obstacle whose difficulty is defined by these numbers. Each row names the test that proves it.

### Playground (`playground`, 100 x 14 tiles, spawn at col 3)

| Gate | Layout | Solo walk | Solo run | With a partner | Proven by |
|---|---|---|---|---|---|
| 5-tile pit | cols 40-44 of the ground (<!--num:pg.pitPx-->80<!--/num--> px) | impossible | possible (window <!--num:d.gapWin.run.5-->21<!--/num--> ticks) | n/a | `sim.test.ts` "5-tile pit needs a run-jump" |
| 4-tile wall | col 74, rows 8-11 (<!--num:pg.wall4Px-->64<!--/num--> px) | impossible | possible (window <!--num:d.wallWin.run.4-->27<!--/num--> ticks) | n/a | `sim.test.ts` "4-tile wall: no walk-jump clears it, a run-jump does" |
| 6-tile wall | col 84, rows 6-11 (<!--num:pg.wall6Px-->96<!--/num--> px), landing shelf cols 85-88 | impossible | impossible (run apex <!--num:d.apex.runHeld-->65.0<!--/num--> < 96) | possible: a held stomp off a grounded friend peaks <!--num:d.stompApexFloor.held-->112.3<!--/num--> px above the floor | `sim.test.ts` "6-tile wall cannot be cleared solo" and "a held stomp off a grounded friend lifts you over the 6-tile wall" |
| High platform | row 4, cols 52-55, top 64 px; bounce pad `B` at col 50 | tap pad peaks <!--num:d.padApex.tap-->48.6<!--/num--> px: too low | held pad peaks <!--num:d.padApex.held-->148.7<!--/num--> px: enough (needs <!--num:pg.padNeedPx-->112<!--/num-->) | n/a | `sim.test.ts` "bounce pad launches the player, higher when jump is held" |
| Pit death | falling out of the level | respawns at spawn | respawns at spawn | n/a | `sim.test.ts` "falling into the pit respawns the player" |

Also in the playground: a 4-step 45 degree ramp up to a plateau (cols 20-31) and back down, stair platforms (cols 58-67), proven by the slope tests.

### Co-op room "Twin Plates" (`coopRoom`, 190 x 16 tiles, 2-4 players)

All door tiles are full height (13 tiles, rows 0-12) so nothing flies over a gate. Floor top is row 13 (y = 208).

| Section | Gate | Why a solo player cannot | Why a team can | Proven by (`coop.test.ts`) |
|---|---|---|---|---|
| 1. Entrance, gate 0 (door col 40) | plate A col 11 and plate B col 36, `need` all (2); linger <!--num:coop.gate0Linger-->300<!--/num--> ticks | the plates are <!--num:coop.gate0DistTiles-->25<!--/num--> tiles apart: one body holds at most one plate | two players hold both; the A holder needs <!--num:coop.gate0RunTicks-->197<!--/num--> ticks to reach the gate (x1.3 margin fits in the linger) | "open gate 0: plates are too far apart for one body" (sweeps every x) |
| 2. Corridor, gate 1 (door col 105) | timed lever (col 45, <!--num:coop.corridorTimerTicks-->300<!--/num--> ticks = 5 s) or latch lever (col 108, toggle, far side) | the door is <!--num:coop.corridorDistPx-->951<!--/num--> px away; best-case run is <!--num:coop.corridorRunTicks-->384<!--/num--> ticks, <!--num:coop.corridorShortTicks-->84<!--/num--> ticks (1.4 s) too slow even with no spikes | the partner waits at the door, sprints through, pulls the latch which holds the door open | "beat the timed corridor: pulling then sprinting never reaches the door in time" |
| 3. Stomp ledge, gate 2 (door col 132) | lever on a slab 6 tiles (<!--num:coop.ledgeAbovePx-->96<!--/num--> px) above the floor, cols 118-124 | best solo apex <!--num:coop.soloBestPx-->65.0<!--/num--> px: <!--num:coop.ledgeSoloMargin-->31.0<!--/num--> px short | a held stomp off a grounded partner reaches <!--num:coop.stompBestPx-->112.3<!--/num--> px: clears the ledge by <!--num:coop.ledgeStompMargin-->16.3<!--/num--> px | "reach the ledge without a partner (no timing of any run-jump works)" and the team tests |
| 4. Final gate (door col 170) | four plates (cols 140, 147 on a one-way platform, 161, 165), `need` <!--num:coop.finalNeed-->3<!--/num--> of <!--num:coop.finalPlates-->4<!--/num-->, linger <!--num:coop.finalLinger-->360<!--/num--> | two bodies can hold at most two plates | three or four players | "pass the final gate with two players (any two plates)" asserts it stays closed; "3 / 4 players clear the whole room" |

Room meta: `minPlayers` <!--num:coop.minPlayers-->2<!--/num-->, `maxPlayers` <!--num:coop.maxPlayers-->4<!--/num-->, reset timers 600 ticks each. Four checkpoints (a, b, c, goal), six levers (three reset levers beside the entrance and checkpoints b and c, the timed lever, the latch and the ledge lever), six plates, four doors, one of each enemy kind, 18 shards. Reset levers recover any stuck state.

Failure model: retry costs only time; checkpoints sit right after each gate; gates linger so plate holders are never the ones locked out; a stranded player is always freed (far-side latch, toggle ledge lever, reset levers). Disconnect and reset rules are tested in the "disconnects and resets" suite.

## 9. Netcode model **[IMPLEMENTED]** (protocol v<!--num:net.PROTOCOL_VERSION-->3<!--/num-->)

Authoritative server, predicting client. Full spec: `docs/NETCODE.md`. This is the summary an engineer needs before touching the sim.

**Server (`apps/server/src/server.ts`).** A `setInterval` of <!--num:net.LOOP_MS-->4<!--/num--> ms accumulates real time (capped at <!--num:net.MAX_CATCHUP-->5<!--/num--> ticks per wake-up) and runs fixed 1/60 s ticks. Each tick, per session: take at most one queued input (`seq`, `buttons`), set `ack = seq`; if the queue is empty and the socket is connected, reuse the last buttons (without advancing `ack`); if disconnected, buttons are 0. Queue overflow (more than <!--num:net.QUEUE_MAX-->10<!--/num--> inputs) trims to the newest <!--num:net.QUEUE_TRIM-->3<!--/num-->. Then `stepWorld`. Every <!--num:net.SNAPSHOT_EVERY-->3<!--/num-->rd tick (<!--num:net.snapshotHz-->20<!--/num--> Hz, <!--num:net.snapshotMs-->50<!--/num--> ms) it broadcasts a `snap`.

**Client (`apps/client/src/game.ts`, `main.ts`).** A fixed 60 Hz accumulator reads input, calls `Game.tick(buttons)`: `seq++`, remember the input (`MAX_PENDING` = <!--num:net.MAX_PENDING-->120<!--/num--> unacked inputs), `stepPlayer` locally with `view.dynamic` as the door state, send `{t:'input', seq, buttons}` every tick. On a snapshot: take the server's state for the local player, drop inputs up to `ack`, replay the rest through `stepPlayer`, and measure the difference to what is drawn. A difference above `SNAP_ERR_PX` = <!--num:net.SNAP_ERR_PX-->64<!--/num--> px snaps; otherwise the error offset `errX/errY` decays by 0.9 per tick. Remote players are rendered `INTERP_DELAY_MS` = <!--num:net.INTERP_DELAY_MS-->100<!--/num--> ms in the past, linearly interpolated between buffered snapshots (jumps over 64 px are not interpolated).

**Messages (v3).** Client to server: `join {name, token?, look?}`, `setLook {look}`, `input {seq, buttons}` (6-bit mask), `ping {ts}`. Server to client: `welcome {id, token, tick, level, look, v}`, `snap {tick, players: NetPlayer[], world?: NetWorld}` (`NetPlayer = {id, name, ack, connected, state: PlayerState, look?}`), `look {id, look}`, `pong {ts}`, `error {message}`. `NetWorld` = `{full?, epoch, doors?, plates?, levers?, enemies?}`: doors and plates are complete lists sent only when changed; levers and enemies are deltas (enemy x/y quantized to 1/8 px, flags bit0 alive, bit1 facing right) and complete on full frames. A full frame is sent to a new or re-attached client, every <!--num:net.SNAPSHOT_FULL_EVERY-->20<!--/num-->th snapshot (1 Hz), and when `room.resets` changes. Inbound (client to server) frames above <!--num:net.MAX_PAYLOAD-->1024<!--/num--> bytes close the socket; snapshots are not capped by it. Hard player cap <!--num:net.MAX_PLAYERS-->16<!--/num-->, lowered by a level's `room.maxPlayers` (4 for `coopRoom`).

**What is predicted vs server-only**

| Predicted on the client (pure function of the level and own state) | Server-only (arrives in snapshots; corrected by reconciliation) |
|---|---|
| walking, running, jumping, coyote, buffer, gravity | stomping or pushing other players (the bounce appears after the correction) |
| crouch, drop-through, one-way platforms, slopes, bounce pads | enemies (movement, stomp kills, hurt contact) |
| closed doors as solid, using the last known `view.dynamic` | lever pulls, plates, door state changes (the door state lags by about one round trip; a mispredicted door shows up as a small correction) |
| spikes, pit respawn, checkpoints, shard pickup | room resets, away state, player-vs-player anything |

Because of this split, a sim change must keep every predicted function a pure function of `(level, own PlayerState, buttons, view.dynamic)`. The moment `stepPlayer` reads another player, an enemy or a plate, client prediction breaks (see danger list in `TUNING_GUIDE.md`).

## 10. Hitboxes and sprite alignment **[IMPLEMENTED]**

- Player hitbox: <!--num:halfWidth-->7<!--/num--> x 2 = 14 px wide, <!--num:height-->28<!--/num--> px tall (<!--num:crouchHeight-->16<!--/num--> crouched); `x` is the center, `y` the feet.
- The humanoid sprite frame is 24 x 32 px, anchored bottom-center on `(x, y)` (frame row 31 is the ground row; the first opaque row is 1, so about 3 px of head sit above the 28 px hitbox). That leaves 5 px of transparent margin at each side. There is no dedicated crouch frame yet (the deep land squash is reused).
- Enemy hitbox 12 x 14 px, smaller than its art.
- Level tiles are 16 x 16. Spike body inside its tile: x 2..14, y 6..16. Flag trigger 38 x 80 px. Plate trigger half width 14 px. These are literals in `player.ts` and `entities.ts`, not config; changing the hitbox without changing them changes how forgiving they feel.

Changing `height` or `halfWidth` requires changing the art alignment (`apps/client/src/player-view.ts`), the creator preview and the 1-tile/2-tile geometry assumptions (see `TUNING_GUIDE.md`).

## 11. Level format and how to author a level **[IMPLEMENTED]**

A level is `parseLevel(name, rows, meta?)` (`packages/sim/src/level.ts`). `rows` is an array of equal-or-shorter strings (short rows pad with `.`); width = longest row.

| Char | Meaning | Solid? |
|---|---|---|
| `.` | empty | no |
| `#` | solid | yes |
| `B` | bounce pad (solid; launches only when landed on from above) | yes |
| `/` | 45 degree slope rising to the right | no (surface via `slopeFloor`) |
| `\` | 45 degree slope rising to the left | no |
| `-` | one-way platform (solid from above only, droppable) | semi |
| `^` | spike (hurts) | no |
| `D` | door/gate (solid when closed) | when closed |
| `S` | spawn (first one wins; default `(8, 16)` if none) | marker |
| `C` | checkpoint flag | marker |
| `o` | shard | marker |
| `l` | lever | marker |
| `p` | pressure plate (a floor marker; stand on the tile below) | marker |
| `e` / `z` / `k` | walker / flyer / spiky walker | marker |

Markers become `.` in `level.tiles` and are collected into lists. Ids of every marker kind are assigned in reading order (row by row, left to right). Spawn, flags and enemies get `y = bottom of the marker's tile` (feet); shards are at the tile center. Doors are the 4-connected components of `D`, ids by the reading order of the first tile.

Meta (object or JSON string):

```ts
{ links: [{ door, plates?, levers?, need?, linger? }],
  levers: { [leverId]: { ticks?, reset? } },
  enemies: { [enemyId]: { range? } },          // flyers only
  room: { minPlayers, maxPlayers?, soloResetTicks, emptyResetTicks } }
```

`parseLevel` throws when a link names a missing door, plate or lever. Level edges: left and right are solid walls, above row 0 is open, below the last row is a pit (respawn at `(height + 3) * 16`).

**To add a level:** create `packages/sim/src/levels/<name>.ts` that exports `parseLevel(<name>, rows, meta)`; add it to `LEVELS` in `levels/registry.ts` (the key is `Level.name`); run the server with `SBH_LEVEL=<name>` (or `createGameServer({ levelName })`); the client loads whatever `welcome.level` names. Write a test with the bot harness (`packages/sim/test/bots.ts`) that proves every gate is solvable by the intended number of players and not by fewer. Terrain art is drawn from `# B / \` only; `- ^ D` and all markers are drawn by the client's object layer. See `LEVEL_DESIGN_GUIDE.md` for sizing and the template.

## 12. Planned mechanics (NOT implemented unless a tag says so)

Nothing in this section may be assumed to exist in the sim. Source of each decision: `DECISIONS.md`, `docs/design/GAME_DESIGN_DOCUMENT.md`, `docs/design/SKILL_TREE_AND_ABILITIES.md`, `docs/design/MOUNTS_AND_EXPLORATION.md`, `docs/design/DIFFICULTY_PHILOSOPHY.md`.

| Mechanic | Status | What is decided | Where it would land in the sim |
|---|---|---|---|
| Crouch / drop-through, ACTION lever pull | **[IMPLEMENTED]** | six inputs, one-way platforms, levers, plates, doors, checkpoints, enemies (this document) | `player.ts`, `entities.ts` |
| 2 to 4 player co-op rooms | **[IMPLEMENTED]** | `coopRoom` Twin Plates, `need` counts, linger, solo/empty reset, away bodies | `levels/coopRoom.ts`, `entities.ts` |
| Bot solvability harness | **[PROTOTYPE]** | `packages/sim/test/bots.ts` and `coop.test.ts` prove solo-cannot / team-can with scripted bots | a future validator tool for the editor |
| Raid-size rooms (8 players) | **[PLANNED-ACCEPTED]** | raid size 8, cap 8, smaller rooms 2 to 4 (Anthony, 2026-09-30). `need` counts and `room.minPlayers` already scale; per-level `maxPlayers` can be raised (server cap 16) | segment checkpoints shared by the group (new `RoomState` fields), pause/resume on disconnect (`stepWorld` freezing timers) instead of the inert `away` body, longer reset timers (30 s) |
| Mounts (frog, dinosaur, flying dinosaur, cheetah) | **[PLANNED-ACCEPTED]** roster; abilities are **[PROPOSAL]** | four mounts, summonable anytime, ACTION summons/dismounts, some areas require one, acquisition is a friendly questline (never raid-gated), required gates have a loaner or alternate route. Art exists (`packages/art/assets/characters_mount_*`); no sim state | `PlayerState.mount`, a per-mount `MovementConfig` profile swapped into `cfg`, ACTION handling in `stepPlayer`/`stepWorld`, gate tiles and a zone graph in the level format |
| Abilities and powerups (L1 trait, L3 powerup layers) | **[PROPOSAL]** | taxonomy and 12 concept powerups; coyote/buffer stay a shared base for everyone (accepted) | new `PlayerState` fields and timers, level pickup markers, a resolved per-player `MovementProfile` passed as `cfg` |
| Skill tree (points) plus mastery-by-use, free respecs | model **[PLANNED-ACCEPTED]**; costs, caps, nodes **[PROPOSAL]** | both systems coexist under one Movement Budget; respec is free | server-side persistence outside the sim; it produces a per-player `MovementProfile`. Needs `stepWorld` to accept a per-player cfg (today one cfg for all) |
| Gear and the Movement Budget | principle **[PLANNED-ACCEPTED]** (gear power capped by the budget); the percentages **[PROPOSAL]** | jump +10%, run +8%, air accel +15%, bounce +8%, grip +20% as starting proposals; coyote/buffer excluded | a profile resolver that clamps each stat before it reaches `cfg`; the sim itself stays unaware of gear |
| Rulesets Open / Standard / Classic | **[PLANNED-ACCEPTED]** (accepted-delegated, revisable); the layer mask table **[PROPOSAL]** | Classic = base moveset only, normalized leaderboard | a ruleset id selecting which profile layers are allowed; the sim only sees the resolved `cfg` |
| Fair-play: base-clearable proof, assists | **[PLANNED-ACCEPTED]** assists and no paid power; replay proof **[PROPOSAL]** | required routes are base-clearable (with the team, for co-op); assisted runs are labelled and excluded from ranked boards | a deterministic replay validator reusing `stepWorld`; the sim is already server-authoritative, so speed or teleport hacks cannot change `stepWorld` results (inputs are masked to 6 bits) |
| Swim, zones (low gravity, ice, wind), crumbling or conveyor tiles | **[PROPOSAL]** | listed in the GDD as environment layers | new tile chars and a per-zone `cfg` modifier in `moveX/moveY` |
| Puzzle bosses, more enemy kinds | **[PROPOSAL]** | concept only | new `EnemyState.kind` values in `entities.ts` |

Rules that already bind every future mechanic: no pay-to-win (nothing bought with real money grants movement power), required routes are base-clearable, hard content is optional, retry is cheap (`DIFFICULTY_PHILOSOPHY.md`).

## Appendix A: other docs that disagree with the code (code wins)

| Doc | Says | Code says |
|---|---|---|
| `GAME_DESIGN_DOCUMENT.md` section 2.1 | inputs = 4 bits today, crouch and action "Not yet (M4)" | six bits and both are implemented (this document, section 2) |
| `GAME_DESIGN_DOCUMENT.md` 2.1 | held standing apex about 61 px (3.8 tiles), run about 68 px (4.2 tiles) | <!--num:d.apex.standHeld-->58.9<!--/num--> px (<!--num:d.apexTiles.standHeld-->3.68<!--/num--> tiles) and <!--num:d.apex.runHeld-->65.0<!--/num--> px (<!--num:d.apexTiles.runHeld-->4.07<!--/num--> tiles); the 4-tile wall margin is 1 px, not 4 |
| `GAME_DESIGN_DOCUMENT.md` 2.1 | stomp bounce about 1.6 / 5.4 tiles; friend's head plus about 87 px | <!--num:d.stompRise.tap-->22.9<!--/num--> px (1.4 tiles) / <!--num:d.stompRise.held-->84.3<!--/num--> px (5.3 tiles) |
| `GAME_DESIGN_DOCUMENT.md` 2.1 | pad held about 9.5 tiles | <!--num:d.padApexTiles.held-->9.30<!--/num--> tiles |
| `GAME_DESIGN_DOCUMENT.md` 2.1 | "fall off level = respawn at spawn (no checkpoints yet)" | respawn at the last checkpoint |
| `SKILL_TREE_AND_ABILITIES.md` header | hitbox 12x16 | 14 x 28 |
| `SKILL_TREE_AND_ABILITIES.md` section 3 | crouch and ACTION "to be added to sim (M4)" | implemented |
| `COOP_ROOM_M3.md` section 4 | solo apex about 68 px; held stomp about 115 px; corridor about 1 s short | <!--num:coop.soloBestPx-->65.0<!--/num--> px; <!--num:coop.stompBestPx-->112.3<!--/num--> px; <!--num:coop.corridorShortTicks-->84<!--/num--> ticks (1.4 s) |
| `COOP_ROOM_M3.md` section 6 | gate 0 "31 tiles to run" | plate A to the gate column is 29 tiles, <!--num:coop.gate0RunTicks-->197<!--/num--> ticks best case |
| `NETCODE.md` | the client reconciles with `Object.assign(me, state)` | it clones the server state and replays pending inputs (`Game.reconcile`) |
| `docs/superpowers/specs/2026-09-30-sbh-m1-shared-playground-design.md` | the client predicts static geometry only; coyote 5 / buffer 6 "to A/B" | it also predicts doors, crouch, one-way, spikes, checkpoints, shards; effective coyote is 5 ticks counting the leaving tick, effective buffer 5 counting the landing tick |

## Appendix B: latent sim risks (reported, not fixed)

These are behaviors or smells to know about before changing the sim. None breaks a current test.

1. **`cfg` is only partly threaded.** `stepWorld(level, world, inputs, cfg)` passes `cfg` to `stepPlayer`, `resolvePlayers` and `enemyContacts`, but `updatePlates`, `doorOccupied` and `pressLevers` read the global `MOVEMENT` (`halfWidth`, `bodyHeight(p)` default). A per-player `MovementProfile` (planned) will silently mis-handle plates, doors and lever reach until that is fixed. One `cfg` is also applied to every player.
2. **Two stomp windows with the same name.** `MOVEMENT.stompWindow` (player vs player) and `RULES.stompWindow` (player vs enemy) both equal <!--num:stompWindow-->12<!--/num--> today but are independent; tuning one leaves the other behind.
3. **Server input starvation.** When a connected client's queue is empty the server repeats the last buttons without advancing `ack`; the client later sends that tick's input for real, so that input can be applied once by the server as a repeat and again when the real packet arrives, while the client applied it once. Reconciliation hides it, but under jitter it produces small corrections; a queue overflow (`>10`) drops older inputs entirely.
4. **Checkpoint order.** Touching a lower-index flag after a higher one moves the checkpoint back (documented intent: backtracking is allowed). Level designers must not place an early flag where players pass on the way forward after a later flag.
5. **Unlinked doors are permanent walls.** A `D` without a `meta.links` entry is never opened and never gets the "do not close on an occupant" protection.
