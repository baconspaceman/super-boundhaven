# SBH netcode (protocol v2)

Authoritative server at 60 Hz sim, snapshots at 20 Hz (`SNAPSHOT_EVERY = 3`). JSON over WebSocket, max frame 1 KB (`ws` `maxPayload`; larger frames close the socket). Types live in `packages/protocol/src/index.ts`.

## Messages

Client -> server
- `join {name, token?, look?}` first message. `token` re-attaches a dropped session; `look` is an `encodeLook` code.
- `setLook {look}` change appearance live.
- `input {seq, buttons}` per 60 Hz tick. `ping {ts}` once a second.

Server -> client
- `welcome {id, token, tick, level, look, v}` `look` is the server-accepted (canonical) code, `v` = `PROTOCOL_VERSION` (2).
- `look {id, look}` appearance of one player.
- `snap {tick, players: NetPlayer[]}`; `NetPlayer.look?` is present only on fallback frames (below).
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
