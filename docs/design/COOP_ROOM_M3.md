# Co-op room "Twin Plates" and the Milestone 3 rules layer

Status: implemented in `@sbh/sim` (`levels/coopRoom.ts`, `player.ts`, `entities.ts`), tested in `packages/sim/test/{m3,coop}.test.ts`. Everything here is original SBH design. Philosophy: challenging but fair, generous checkpoints, instant retries, never punishing.

## 1. New base-moveset inputs (6 bits)

| Bit | Button | Behaviour |
|-----|--------|-----------|
| 16 | CROUCH (down) | Hitbox height 28 -> 16 while held. Ground speed capped at 0.9 px/tick (slow slide under 1-tile gaps). You cannot stand up under a low ceiling: you stay crouched until clear. Works in the air too (crouched jumps bump the head at 16, not 28). On a one-way platform (nothing solid under the feet) CROUCH drops you through; CROUCH+JUMP also drops (no jump). |
| 32 | ACTION | Rising edge only. Toggles/pulls the nearest lever within 20 px horizontally and 24 px vertically (body center to lever center). Later: summon/dismount mounts, use powerups. |

`BTN_MASK = 63`. The server masks every input with it.

## 2. Tiles and objects (ASCII legend)

Static tiles stay in `Level.tiles`; markers are parsed out into entity lists and become `.`. Ids of each marker kind are assigned in reading order (row by row, left to right); doors are 4-connected groups of `D`.

| Char | Meaning |
|------|---------|
| `-` | one-way platform: solid from above only, droppable (CROUCH) |
| `^` | spike: hurts (box x 2..14, y 6..16 inside its tile, 1 px extra forgiveness on the player) |
| `D` | door/gate: solid when closed. Open/closed is `world.dynamic[doorId]` |
| `C` | checkpoint flag. Trigger is 38 px wide and 80 px tall, so a normal jump over it still counts |
| `o` | shard pickup, collected per player |
| `l` | lever (toggle, or timed via `meta.levers[id].ticks`; `reset: true` makes it a room-reset lever) |
| `p` | pressure plate (held while any non-away player stands on it, feet within 1 px of the plate floor) |
| `e` | ground patroller (0.5 px/tick, turns at walls and ledges, stompable) |
| `z` | sine flyer (horizontal range +-32 px, 12 px sine bob, period 96 ticks, stompable) |
| `k` | spiky patroller (same AI as `e`, never stompable) |
| `S` | spawn |

`parseLevel(name, rows, meta?)` accepts an optional metadata object or JSON string:

```ts
{ links: [{ door, plates?, levers?, need?, linger? }],   // door open if (>= need plates held) OR (any lever on); linger = ticks it stays open after that lapses
  levers: { [leverId]: { ticks?, reset? } },
  enemies: { [enemyId]: { range? } },
  room: { minPlayers, maxPlayers?, soloResetTicks, emptyResetTicks } }
```

Doors never close on a player standing inside them (they stay open until the doorway is clear), so nothing can crush or embed a player.

## 3. Rules

- **Hurt** (touch an enemy, a spike, or fall in a pit): respawn at your last checkpoint (the level spawn if none), `invuln = 90` ticks (1.5 s of flicker; no hurt during it), `deaths++`. No lives, no lost shards. Same behaviour for pits.
- **Stomp** an enemy (descending, feet within 12 px below its top): it dies, you bounce (4.6, or 6.2 with JUMP held, same as stomping a player). It respawns at its post after 600 ticks. Spiky patrollers always hurt.
- **Checkpoints** activate on touch and are per player. Latest touched wins (backtracking is allowed). The room entrance is the level spawn, shared by everyone.
- **Shards**: per-player; `PlayerState.shards` is the count, `PlayerState.got` a bitset (32 shards per word). Other players still see the shard (it is theirs to take).
- **Disconnected players** (`PlayerState.away`) are inert: no plates, no hurt, no push/stomp, inputs ignored.

## 4. The room

Level `coopRoom` (190 x 16 tiles, 2-4 players; `LEVELS.coopRoom`, server option `levelName: 'coopRoom'`). `COOP_IDS` exports the ids of plates, levers, doors and checkpoints for tests and tools.

| # | Section | Mechanic | Needs |
|---|---------|----------|-------|
| 1 | Entrance (cols 2-40) | Plate A (col 11) and plate B (col 36) are 25 tiles apart; both held opens gate 0 and keeps it open 300 ticks (5 s) after release so the plate holders can run through. A one-way staircase leads to a patrol shelf (walker `e`) with a shard; a spike pair to hop. | 2 players |
| 2 | Corridor (cols 41-105) | A 5 s timed lever at col 45; the door is at col 105, 60 tiles (about 6.5 s of running) away. Partner waits at the door, the puller pulls, the partner sprints through and pulls a **latch** lever (col 108) on the far side that holds the door open for the puller. Spikes to hop, a one-way ledge with a shard, a flyer overhead. | 2 players |
| 3 | Stomp ledge (cols 106-131) | A floating slab 6 tiles (96 px) above the floor at cols 118-124 carries a lever. Solo jump apex is about 68 px, a pad-less held stomp-bounce off a grounded partner's head reaches about 115 px. The lever opens gate 2 (toggle, stays). | 2 players |
| 4 | Final (cols 133-186) | Four plates (floor, one on a one-way platform 3 tiles up, two floor); any 3 held opens the final gate (linger 360 ticks). A spiky patroller on a shelf, spikes between plates. Goal alcove with 6 shards and a checkpoint. | 3 players (tuned for up to 4) |

Reset levers sit at the entrance and beside checkpoints b and c.

### Solvability (proved by tests, not by assertion)

`packages/sim/test/coop.test.ts` scripts inputs for 2, 3 and 4 players with simple bots:

- Gate 0: a solo player never has more than one plate pressed (sweeps every x in the entrance), and a solo run never opens it. 2 players do.
- Timed corridor: a solo player who pulls the lever and sprints for 400 ticks never reaches the door (about 1 s of running short, even with no obstacles); with a waiting partner it passes and the latch keeps it open past the 300 tick timer.
- Stomp ledge: solo, no timing of any run-jump over several start points and 90 jump timings gets its feet higher than 8 px below the ledge top (feet y 120 vs top 112); with a partner the stomp-bounce lands on it (about 20 of 90 jump timings succeed when the partner stands 3 tiles left of the ledge, so the window is generous, about 0.3 s).
- Final gate: any two of the three floor plates held by two players keeps it closed (max pressed = 2 < need 3). 3 and 4 players clear the whole room from spawn to the goal checkpoint.

## 5. Failure, retries and fairness

- **Retry cost is time only.** Death returns you to the last checkpoint (checkpoints sit right after every gate, so a retry never costs more than one section). No shard loss, no lives.
- Gates linger after the condition lapses (5 s / 6 s) so the people holding plates are never the ones locked out; doors never close on someone inside.
- The corridor timer only asks the partner who is already waiting at the door to be quick (a few tiles), and the latch removes the need to ever sprint the full corridor.
- If someone is stranded behind a closed door the far side always has a latch (corridor) or the door stays open (ledge lever is a toggle); reset levers recover any odd state.

### Disconnects and resets (defined and tested)

1. A dropped socket makes the body `away` immediately (kept for the 10 s token grace). It stops pressing its plate, so a gate it was holding closes after the linger window; it cannot be hurt or block anyone; re-attach clears `away`.
2. `room.progress` becomes true when any door opens, a lever is pulled, an enemy is stomped, or any player touches a checkpoint. Only then do the timers below run (a lone visitor idling at a fresh entrance is never reset).
3. Fewer than `minPlayers` (2) connected players for `soloResetTicks` (600 = 10 s) after progress: **hard reset**. Doors close, levers/plates/enemies reset, every player returns to the entrance with checkpoint cleared. Shards are kept.
4. Nobody connected for `emptyResetTicks` (600) after progress: hard reset. A player who reconnects inside that window keeps the progress.
5. A **reset lever** (ACTION) does the soft version at any time: levers off, doors closed, enemies back, timers cleared; nobody is moved. This is the "stuck door" escape hatch.
6. The server sends a full world frame on re-attach and whenever the reset epoch changes, so clients never keep stale door state.

## 6. Generalizing to 8-player raids

- Sections declare a **player requirement** (`links[].need`, `room.minPlayers`) instead of hard-coding roles; a raid room is the same objects with larger `need` counts (for example 6 plates of 8) and several simultaneous gates.
- Keep the "spare player" rule: required count is at most players minus 1 for 8-player rooms (here 3 of 4), so one disconnect or one player respawning does not stall the room; hard minimum play count is the only count that triggers resets.
- Reset rules scale: `minPlayers` rises (raid: 6), the solo timer should lengthen (30 s) to match the 30 s disconnect-pause in the GDD, and checkpoints become **segment checkpoints** shared by the group (wipe returns to segment start).
- Timers scale with team size, not distance: choose linger/timer so the slowest required role (farthest plate holder) makes it with a safe margin (1.3x), as in section 1 (31 tiles to run, 300 ticks of linger).
- Add specialist roles by lever type (timed, hold, toggle) and plate counts rather than new mechanics; stomp-bounce ledges extend to stacked stomps (two grounded players) for 10+ tile ledges, which the sim already supports.
- Required changes before 8 players: raise the server `maxPlayers` per level, shared per-segment checkpoints, and a pause/resume state for disconnects instead of the inert-away body (the sim already treats `away` consistently, so a pause only needs `stepWorld` to freeze timers).

## 7. API notes for the client (summary)

See `docs/NETCODE.md` ("World state in snapshots") and the sim exports: `LEVELS`, `getLevel`, `COOP_IDS`, `stepPlayer(level, p, buttons, cfg?, dynamic?)`, `tileAt(level, c, r, dynamic?)` (`D` closed, `d` open door), `isSemiSolid`, `bodyHeight(p)`, `hasShard(p, id)`, `createWorldView/applyNetWorld` from `@sbh/protocol`.
