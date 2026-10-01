# Controls

Super Boundhaven plays with keyboard or any common gamepad (Xbox / XInput, PlayStation DualShock 4 and DualSense, Switch Pro, most generic pads). The browser's Gamepad API is used, so there is nothing to install. Keyboard and gamepad can be used at the same time; both feed the same 6-bit input mask (`LEFT 1, RIGHT 2, JUMP 4, RUN 8, CROUCH 16, ACTION 32`).

## Default bindings

Gamepad names use the **standard layout position** (A = bottom face button). PlayStation shows the glyph shape, Switch shows its own letters, which are positionally swapped (the bottom button is labelled B).

| Action | Keyboard | Gamepad (Xbox / PlayStation / Switch) |
|---|---|---|
| Move | Arrows, A / D | Left stick, D-pad |
| Jump | Space, Z, K, Up, W | A / Cross / B (bottom), also B / Circle / A (right) |
| Run (hold) | Shift, X, J | X / Square / Y (left), or RT / R2 / ZR |
| Crouch / drop | S, Down | D-pad Down, stick Down, or LT / L2 / ZL |
| Action / activate | E, F, Enter | Y / Triangle / X (top), or RB / R1 / R |
| Character creator | C | View / Share / - (Back) |
| Pause menu | Esc | Menu / Options / + (Start) |
| Debug: cycle region | `[` `]` | - (pause menu) |
| Debug: cycle time of day | `,` `.` | - (pause menu) |
| Show/hide debug HUD | F1 | - |

Run can be changed to **toggle** (press to start/stop) in Controls.

## Menus and overlays with a gamepad

While the pause menu, Controls screen or character creator is open, game input is suppressed and the pad drives the UI:

| Input | Does |
|---|---|
| D-pad / left stick | Move focus (spatial, so it follows the layout) |
| A / Cross | Activate the focused control |
| B / Circle | Back / close |
| Start | Close the pause menu |
| LB / RB | Previous / next tab (creator categories) |
| LT / RT | Step the focused option left / right (creator style, menu steppers) |
| Right stick | Scroll the screen |

Typing the hero name still needs a keyboard (browsers have no on-screen keyboard). On Steam Deck / Steam Input the Steam keyboard works. Arrow keys also move focus in the pause menu and Controls screens.

## Remapping

Pause menu -> **Controls**. Each action shows its keyboard and gamepad bindings as keycaps / glyphs.

- Activate a binding to rebind it, `+` to add another (max 3 per action and device).
- Keyboard: press the key. `Esc` cancels, `Delete` removes the slot.
- Gamepad: press a button or push a stick. Cancels by itself after 8 seconds or with `Esc`.
- **Conflicts:** if the input is already used by another action you are told which one. Press the same input again to swap (it is taken from the other action) or press something else.
- The pause menu always keeps at least one binding per device.
- Settings: stick deadzone (10-50%, default 25%), run mode (hold/toggle), rumble (on/off).
- **Reset keyboard / Reset gamepad / Reset all** restore defaults.
- Stored in `localStorage` key `sbh.controls` (schema version 1). If storage is blocked everything still works for the session.

## Supported controllers

| Controller | Browser mapping | Notes |
|---|---|---|
| Xbox 360 / One / Series (wired, wireless adapter, Bluetooth) | `standard` in Chrome, Edge, Firefox (Windows) | Works out of the box. Rumble in Chromium. |
| DualShock 4 / DualSense | `standard` in Chrome / Edge / Firefox / Safari | Glyphs become Cross / Circle / Square / Triangle. Rumble works in Chromium (USB is most reliable). |
| Switch Pro | `standard` in Chrome / Edge | Face buttons are labelled by position (Nintendo letters). Bluetooth pairing needed. |
| 8BitDo, Logitech, generic XInput-style pads | usually `standard` | Put 8BitDo pads in XInput (X) mode. |
| Anything non-standard (mapping `""`) | best-effort tables | See below. |

**Non-standard mappings.** When a browser reports `mapping === ""` the game uses a per-vendor table (`gamepad.ts`, `normalizeLegacy`) for DualShock/DualSense (raw order square, cross, circle, triangle...; hat-switch D-pad on axis 9), Xbox 360 (triggers as axes, D-pad as buttons 11-14 or axes 6/7) and Switch Pro; unknown vendors are assumed to be "close to standard" (face = 0..3, shoulders 4..7, sticks = axes 0..3). These tables are written from documented browser behaviour and **have not been verified against real hardware**; if a pad misbehaves, use the debug overlay below and report the raw values.

## Testing your controller: `?pad=debug`

Open the game with `?pad=debug` (e.g. `http://localhost:5173/?pad=debug`). A live overlay lists every connected pad: id, `mapping`, which normalization profile is in use, haptics support, every raw button (`index*:value`, `*` = pressed) and axis, the standard-layout buttons the game sees, stick directions, the processed move vector, and the exact input mask sent to the server (`LEFT|JUMP|...`). Press buttons and confirm the right numbers light up. `window.__sbh.pads` exposes the same data from the console.

## Known limits and tips

- **Browsers hide a pad until you press a button.** Connect it, then press any button while the game tab is focused. A toast ("Controller connected: Xbox Controller") confirms it. Refreshing the page needs another press in Chrome.
- The tab must be focused; Chrome stops reporting pad input to background tabs.
- Chrome vs Firefox: both are fine for XInput and PlayStation pads. Firefox exposes fewer pads as `standard` on Linux and has less complete rumble support; Safari supports pads but not rumble reliably.
- Multiple pads: the one that **last had input** is active. Unplugging a pad releases every held input and the run-toggle latch.
- Bluetooth: pair the pad in the OS first. If it connects but the browser sees nothing, turn the pad off and on while the tab is open, or use USB. Windows may expose some Bluetooth Xbox pads twice (disconnect the extra "XInput" device).
- Rumble uses `vibrationActuator.playEffect('dual-rumble')` (Chromium) or the legacy `hapticActuators[0].pulse`. It fires on hard landings, bounce pads, stomps and respawns, derived from the local player's state transitions, and can be turned off in Controls. Other game code can trigger it with `window.__sbh.events.emit('hurt' | 'stomp' | 'bounce' | 'land' | 'respawn')`.
- **Steam version (later):** Steam Input presents any pad as an Xbox pad via the same layout, so these defaults carry over; players can also rebind in Steam's overlay. The in-game remapper stays available.

## What has and has not been verified

Verified with a scripted fake standard-mapping pad (Xbox and DualSense ids) in the browser, plus unit tests for mapping, deadzone/hysteresis, bindings, conflicts, persistence, glyph choice and navigation: movement, jump, run, crouch, action, hot-plug and disconnect, menu / controls / creator navigation, rebinding, run toggle, and rumble dispatch.

**Not verified without hardware:** a physical Xbox pad's real axis noise and drift feel (deadzone value), real haptics, Bluetooth behaviour, and the non-standard-mapping fallback tables. Test these with `?pad=debug`.
