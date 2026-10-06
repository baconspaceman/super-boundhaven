# Eight Gates: 8-player raid prototype room (PROPOSAL)

Status: prototype, proposal-labelled. Anthony confirmed raids are 8 players (OPEN_QUESTIONS, 2026-09-30); this room's layout and numbers are Claude's proposal and revisable.

Run it: `npx tsx apps/client/scripts/serve-level.ts raidRoom` (or `SBH_LEVEL=raidRoom`), then open the client dev server. Room rules: min 6 / max 8 players.

## Segments (one checkpoint flag after each gate)

| # | Challenge | Coordination needed | Fail-soft |
|---|---|---|---|
| 1 | Hall: 8 plates, 4 tiles apart | 6 plates held at once (gate stays open 6 s after) | 2 players can be missing or busy |
| 2 | 60-tile corridor, 5 s timed lever far from the door | one puller, one sprinter who latches the door from the far side | reset levers; the latch frees anyone stranded |
| 3 | Stomp ledge, 6 tiles up | a partner holds still so a climber can stomp-bounce onto the slab and pull its lever | gate stays open once pulled |
| 4 | 8 plates (2 on one-way platforms) | 6 held at once (gate stays open 7 s after) | 2 can be missing |

Segments 2 and 3 reuse Twin Plates' tested geometry shifted 7 tiles right. Doors are full height.

## Disconnects and resets
A disconnected (away) player releases its plate. Progress resets after 15 s with fewer than 6 players connected, or 10 s empty (shards are never lost). Reset levers sit before each gate.

## Engine limit found
Door links treat levers as OR, so "two levers held at the same time" is not expressible yet; the corridor uses the timed-lever sprint instead. An AND option on door links is a possible later sim change.

## Tests
`packages/sim/test/raid.test.ts`: 8 scripted bots clear all four gates; 5 plates never open the hall; disconnect tolerance; resets; determinism.
`apps/server/test/raid.test.ts`: serves the level, 8 players join, a 9th is rejected.

Not yet done: raid-specific art, real-player feel testing (only scripted bots so far).
