# Ground pound and big buttons (PROPOSAL)

Status: prototype, proposal-labelled. Numbers are Claude's first guesses, all in `packages/sim/src/config.ts` (`RULES`) and revisable after real playtests.

## The move
Press DOWN while airborne (a fresh press: holding DOWN from before the jump does nothing). The player hangs for about 0.1 s (a visible tell and a moment to line up), then dives straight down at 8 px/tick with no sideways drift. Landing is a **slam**: a short recovery (14 ticks, no walking, jumping still works). Stomping an enemy or hitting a bounce pad cancels the pound. Same input on keyboard and pad (the crouch button), so no new binding and no new input bit.

## Big buttons
Marker `M` in the level text; a run of `M` tiles is one button (2 tiles wide in the shipped levels). Only a slam that lands on it presses it: walking on it or an ordinary jump does nothing. A pressed button stays **lit for 3 s** (`RULES.buttonTicks`), shown as a draining bar. A door link with `buttons: [...]` opens while **all** its buttons are lit at once.

## The leniency
Players do not have to slam together. They only need to land all their slams inside the 3 s window, and the gate then stays open (linger) so nobody races a closing door. Over a laggy connection the server counts the slams in the same window, so jitter of a few hundred ms is harmless. Tune per button with `meta.buttons[id].ticks`.

## Room: "Slam Dunk" (`poundRoom`, 2 to 4 players)
1. One button, solo-able: teaches DOWN in the air.
2. Two buttons 30 tiles apart: running between them takes longer than 3 s, so it takes two players.
3. Three buttons 13 tiles apart behind spikes: three players slam together; two can slam the ends and then one runs to the middle inside the window.

Run it: `npx tsx apps/client/scripts/serve-level.ts poundRoom`.

## Engineering notes
Protocol v4 (player state gains `pound`, `slam`, `prevCrouch`; world snapshot gains `buttons` = lit ids). The pound itself is in `stepPlayer`, so the client predicts it; the button press is server-side only. Tests: `packages/sim/test/pound.test.ts`, `packages/protocol/test/world.test.ts`.

Not done yet: raid-room buttons, rumble on slam, a slam sound (no audio yet), real-player feel testing.
