// All movement tuning lives here. Units: pixels and pixels/tick at TICK_RATE.
// Original values tuned for feel; no third-party game data used.

export const TICK_RATE = 60;
export const TILE = 16;
export const SCREEN_W = 256;
export const SCREEN_H = 224;

export interface MovementConfig {
  halfWidth: number;
  height: number;
  crouchHeight: number; // hitbox height while crouching
  crouchMax: number; // ground speed cap while crouching (slow slide under 1-tile gaps)
  dropTicks: number; // ticks one-way platforms are ignored after a drop-through

  walkMax: number;
  runMax: number;
  accel: number; // ground acceleration toward max speed
  skid: number; // ground deceleration when reversing direction
  friction: number; // ground deceleration with no input
  overspeedDecel: number; // ground decel when faster than the current max
  airAccel: number;

  jumpVel: number; // initial upward speed (positive number)
  runBonus: number; // extra jump speed per px/tick of horizontal speed
  gravityHeld: number; // while rising with jump held
  gravityFall: number; // falling, or rising with jump released
  maxFall: number;
  coyoteTicks: number; // 0 disables
  bufferTicks: number; // 0 disables

  padVel: number;
  padHeldVel: number;
  stompVel: number;
  stompHeldVel: number;
  stompPushDown: number;
  stompWindow: number; // max px the stomper's feet may be below the victim's head
  stompTolerance: number; // px of slack for "was above the head last tick"
  pushMax: number; // max px per tick two overlapping players are separated

  slopeSnap: number; // px the feet may be above a slope and still snap down to it
  slopeInset: number; // px ignored at the feet for wall checks while grounded
}

export const MOVEMENT: MovementConfig = {
  halfWidth: 7,
  height: 28, // humanoid 24x32 sprite: ~28px body, a few px of transparent headroom
  crouchHeight: 16, // fits a 1-tile gap
  crouchMax: 0.9,
  dropTicks: 8,

  walkMax: 1.4,
  runMax: 2.6,
  accel: 0.07,
  skid: 0.22,
  friction: 0.1,
  overspeedDecel: 0.04,
  airAccel: 0.06,

  jumpVel: 5.2,
  runBonus: 0.1,
  gravityHeld: 0.22,
  gravityFall: 0.42,
  maxFall: 5.5,
  coyoteTicks: 5,
  bufferTicks: 6,

  padVel: 6.6,
  padHeldVel: 8.2,
  stompVel: 4.6,
  stompHeldVel: 6.2,
  stompPushDown: 1.5,
  stompWindow: 12,
  stompTolerance: 4,
  pushMax: 1.5,

  slopeSnap: 4,
  slopeInset: 10, // > halfWidth + top speed, so the leading edge doesn't clip the next 45° step
};

/** Rules constants (gameplay, not movement feel). Shared client/server; change = protocol-visible. */
export const RULES = {
  invulnTicks: 90, // flicker after a respawn (hurt or pit)
  actionReachX: 20, // px: horizontal reach of the ACTION button
  actionReachY: 24, // px: vertical reach (body center to lever center)
  enemyRespawnTicks: 600, // a stomped enemy returns after 10 s
  walkerSpeed: 0.5,
  flyerSpeed: 0.6,
  enemyHalfWidth: 8, // 16 px body: matches the 18 px sprite minus its transparent margin
  enemyHeight: 16,
  enemyGravity: 0.3,
  enemyMaxFall: 4,
  stompWindow: 12, // px the feet may be below an enemy's top and still stomp it
  stompSlack: 6, // px the previous feet may be below the enemy top
  // ---- ground pound (DOWN pressed in the air): hang, dive straight down, slam on landing ----
  poundWindup: 6, // ticks hanging in place before the dive (a visible tell, and a little time to line up)
  poundVel: 8, // px/tick dive speed
  slamTicks: 14, // ticks of recovery after landing; the slam itself is felt on the first
  /** Big buttons: a slam lights one for this long, so partners may be this far apart in time (generous on purpose). */
  buttonTicks: 180,
  buttonReach: 3, // px a slam may land beyond a big button's edge and still press it
  /** Default per-room rules; levels override via meta.room. */
  defaultRoom: { minPlayers: 1, soloResetTicks: 600, emptyResetTicks: 600 },
} as const;
