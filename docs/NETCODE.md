# SBH netcode (protocol v3)

Authoritative server at 60 Hz sim, snapshots at 20 Hz (`SNAPSHOT_EVERY = 3`). JSON over WebSocket, max frame 1 KB (`ws` `maxPayload`; larger frames close the socket). Types live in `packages/protocol/src/index.ts`.

## Messages

Client -> server
- `join {name, token?, look?}` first message. `token` re-attaches a dropped session; `look` is an `encodeLook` code.
- `setLook {look}` change appearance live.
- `input {seq, buttons}` per 60 Hz tick; `buttons` is a 6-bit mask (LEFT 1, RIGHT 2, JUMP 4, RUN 8, CROUCH 16, ACTION 32). The server masks with `BTN_MASK` (63), so stray bits are dropped. `ping {ts}` once a second.

Server -> client
- `welcome {id, token, tick, level, look, v}` `look` is the server-accepted (canonical) code, `v` = `PROTOCOL_VERSION` (3).
- `look {id, look}` appearance of one player.
- `snap {tick, players: NetPlayer[], world?: NetWorld}` (`world`: see "World state" below); `NetPlayer.look?` is present only on fallback frames (below).
- `pong {ts}`, `error {message}`.

## Look sync design

A look is 20 chars and changes rarely, so it is not sent in every snapshot.

1. **Primary channel: `look` messages.** On join the server sends `welcome` (with own look), then one `look` message per existing session to the joiner (roster backfill) and one `look` for the joiner to everyone else. On `setLook` it broadcasts one `look` message to all connected clients.
2. **Self-healing fallback: 1 Hz in snapshots.** Every `SNAPSHOT_LOOK_EVERY` (20th) snapshot sets `NetPlayer.look` for all players. WebSocket is ordered/reliable so this is belt-and-braces (e.g. a client that missed a `look` while reconnecting); the client applies `np.look` whenever present. Cost: ~20 bytes/player once a second.
3. The client renders `game.lookOf(id)`; until the first look arrives it uses `defaultLookCode(id)` = `encodeLook(randomLook(id))`, the same fallback the server uses, so a player never flickers.

## Validation (server, never throws)

`parseLookCode` (in `@sbh/protocol`): must be a string of length 2..32, `decodeLook` must succeed, `validateLook` must report no problems; the stored value is the re-encoded canonical code. Otherwise:
- on `join`: fall back to `defaultLookCode(id)`; no error is sent.
- on `setLook`: reply `error 'bad look'`, keep the old look.

Oversized frames (> 1 KB) are dropped by `ws` and close the connection. Join with a token ignores the `look` field: the session keeps its current look across reconnects (and across a live `setLook`). The client remembers the latest look and re-sends it if its session expired (grace period passed) and it gets a fresh id.

## Rate limit

`setLook` is a token bucket per session: burst `LOOK_BURST = 3`, one token refilled per `LOOK_REFILL_MS = 1000`. Over limit => `error 'look changes rate limited'`, look unchanged. An accepted `setLook` equal to the current look consumes a token but is not broadcast.

## Tests

`apps/server/test/look.test.ts`: valid/invalid/oversized/missing look on join, >1 KB frame, relay to other clients (backfill + later change), invalid `setLook`, rate limit + refill, reconnect retention, 1 Hz snapshot look frames.

## World state in snapshots (protocol v3, Milestone 3)

Levels now have dynamic state (doors, plates, levers, enemies). The server owns it (`stepWorld`); players' own fields (`checkpoint`, `shards`, `got`, `invuln`, `crouching`, `away`, ...) ride in `NetPlayer.state` as before.

`snap.world?: NetWorld` (`packages/protocol/src/world.ts`):

| field | meaning |
|-------|---------|
| `full?: 1` | full frame: the receiver clears its levers/enemies first; every list below is complete |
| `epoch` | room reset counter (`world.room.resets`); a change forces a full frame |
| `doors?: number[]` | ids of OPEN doors. Always the complete list; only present when it changed |
| `plates?: number[]` | ids of pressed plates. Complete list; only when changed |
| `levers?: [id, on, ticksLeft][]` | `on` is 0/1. Partial on deltas (changed levers only), complete on full frames |
| `enemies?: [id, x, y, flags][]` | x,y quantized to 1/8 px; `flags` bit0 alive, bit1 facing right. Partial on deltas |

- Delta against the previous snapshot sent to everyone (the server calls `WorldEncoder.delta(world)` once per broadcast). If nothing changed `world` is omitted.
- Full frames: the first snapshot after `welcome` (new or token re-attach, tracked per session), every `SNAPSHOT_FULL_EVERY` (20th, 1 Hz) snapshot for everyone (self-healing, like looks), and on room reset. A full frame is `WorldEncoder.full(world)`.
- Client: keep a `WorldView` (`createWorldView()` / `applyNetWorld(view, nw)`). `view.dynamic` (door id -> open) is the object to pass as the 5th argument of `stepPlayer(level, p, buttons, MOVEMENT, view.dynamic)` for prediction and in reconciliation replays.
- Prediction scope is unchanged: the client predicts only its own player against static tiles + `view.dynamic`. That now includes crouch, one-way platforms, spikes, pit respawn, checkpoints and shards (all pure functions of level + own state). Enemy stomps/hurts, lever pulls, plates and door changes are server-authoritative and arrive in snapshots; the player reconciles via `Object.assign(me, state)` as before.
- Door open/closed state at the time of a prediction step can lag the server by ~RTT. Replays use the latest known state; a mispredicted door shows up as a normal small correction (snap/smooth already handled by `SNAP_ERR_PX`).
- Bandwidth (measured, `coopRoom`, 3 enemies, 4 doors): a quiet room sends no `world` field; a full frame is ~170 bytes; deltas with moving enemies average ~75 bytes. The larger cost is `PlayerState` itself: ~260 bytes of JSON per player per snapshot (was ~150), i.e. ~1 KB per 20 Hz snapshot for 4 players. If that matters, trim fields (`prevAction`, `prevJump`, `drop`, `act`) from the wire later; the client only needs them for prediction replays.

### Disconnects (server)

When a socket closes the session is kept `graceMs` (10 s default) for token re-attach. During that time the player's body gets `state.away = true`: it is inert (does not press plates, cannot be hurt, pushed or stomped, takes no input). Re-attach clears `away` and forces a full world frame. See `docs/design/COOP_ROOM_M3.md` for room reset rules.

### Server options

`createGameServer({ levelName?, maxPlayers? })`: `levelName` is a key of `@sbh/sim` `LEVELS` (`playground` default, `coopRoom`); unknown names throw. `maxPlayers` defaults to the level's `room.maxPlayers` (4 for `coopRoom`) or 16. `welcome.level` carries the name so the client can `getLevel(name)`.

