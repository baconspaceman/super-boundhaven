# Camera

The view is 480x270 native pixels (16:9). The camera (`apps/client/src/camera.ts`, pure maths, fully tested) follows the local player.

## Behaviour
- **Horizontal:** nothing moves while the player stays inside a small dead zone (24 px while moving, 4 px once they stop, when the camera quietly re-centres). Beyond it, the camera glides after them with two smooth stages (an eased target, then a critically damped spring), so there is no overshoot and no sudden acceleration. A small **look-ahead** (up to 28 px) shows where you are heading; it comes from a slowly smoothed velocity, so turning around does not swing the view.
- **Vertical:** it frames the **ground**, not the player. Ordinary jumps never move the camera. Landing on a different height re-frames smoothly; falling or a very high bounce makes it follow. The ground sits 80% of the way down the screen, so there is lots of sky above.
- **Zoom:** only ever **out** (never in, so characters never get bigger than the base view), between 1.0 and 0.7. It zooms out only to keep nearby teammates (within about 260 px across / 150 px up-down) in frame around the local player, with hysteresis (a new target must persist about 0.3 s going out, 0.9 s coming back), 0.05 steps and a slow ease. It returns to exactly 1.0 when the group spreads out or leaves.
- **Safety:** the local player is always inside the view (a hard rule that runs last). Teleports, respawns and developer `/tp` snap instead of gliding across the level.
- **Bounds:** the view stays inside the level sideways; the world below the level is plain ground (client-drawn), above it open sky.

## Tuning and switches
All numbers are in the `CAMERA` object at the top of `camera.ts`. URL options for comparing while playtesting: `?cam=fixed` (old fixed camera), `?zoom=off`, `?view=576x324` (bigger view, see DECISIONS).

## Tests
`apps/client/test/camera.test.ts`: standing still, no overshoot, bounded acceleration when turning, jumps do not move the camera, re-framing on a higher platform, falling, zoom out/in with hysteresis and no flip-flop, bounds in wide and narrow levels, teleports, frame-rate independence, and a property test that the player is inside the view on random walks, jumps, falls and teleports at 30, 60 and 144 fps.
