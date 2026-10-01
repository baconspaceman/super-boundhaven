# Character creator and in-game players

## Flow
- Page load: the creator (`apps/client/src/creator.ts`, `creator.css`) opens full-screen. Name and look are stored in `localStorage` (`sbh.name`, `sbh.look`, all access in try/catch). First visit gets a random look.
- `?name=Bob` joins immediately; `?look=<code>` overrides the stored look (ignored if invalid). `?name` + `?look` = test auto-join. Note a live `sessionStorage` token re-attaches the old session and keeps its old name/look.
- Play sends `join {name, look}`. In game press **C** to reopen the creator (game keeps running, `Input.captured` blocks keys from the sim). Apply sends `setLook`; Esc/Cancel closes. Name is read-only in this mode (no rename message).

## Creator UI
Tabs for every entry of `CHARACTER_OPTIONS.categories`; each has a stepper (name + i/n, wraps) and swatch groups built from the real color tables (`colorKeys` / `colorTable`; skin tone swatches for Skin). Also: live preview (Idle/Walk/Run/Jump/Stomp/Hurt chips, prev/next, Flip), Randomize, Reset, look-code field (paste to load, Copy button), name, Play/Apply/Cancel. Accessible: dialog role, tablist with arrow/Home/End, spinbutton stepper (arrow keys), radiogroup swatches (arrow keys, `aria-label` = "Primary color: Crimson").

Preview and game share `getLookSheet(code)` (`look-sheet.ts`): `composeSheet(look)` -> canvas + atlas, LRU 64. The preview blits frames with `drawImage` and smoothing off.

## In-game sprites
- `player-view.ts`: `SpritePlayerView` behind the `PlayerView` interface; `render.ts` `makePlayerView` builds it. Sprite 24x32, anchor bottom-center on the sim feet point (opaque row 31 is the ground row; verified). Flip by `facing`. Pixel-font name tag (`drawText` -> nearest texture), yellow for local plus a down-arrow; alpha 0.4 when `connected` is false; blob shadow cast down to the first floor/slope.
- `motion.ts`: pure state machine, unit-tested (`apps/client/test/motion.test.ts`). idle / walk / run by |vx| (walk->run at 1.55), stride rate scales with speed, skid on reversal, jump_start (4 ticks) / rise / apex / fall by vy (+-1.2), land squash (hard impact >= 3 px/tick -> land_0+land_1, else land_1), stomp spin, hurt for the stomped player, respawn flash (teleport detection).
- `sprites.ts`: `LookLibrary` (ref-counted texture sets per look code, idle sets LRU-evicted past 64, evicted textures destroyed), `FxLayer` (pooled `FX_ANIMS` sprites), label/shadow/arrow textures.
- Effects: dust on land/skid/run start/jump, land ring on hard land, bounce burst on pad launch, stomp star on stomp. Stomp = a launch (vy <= -4.3) whose feet are within 6 px of another player's head (feet y - 16).

## Adding options later
1. Add art in `packages/art` (`parts_*.ts`) and a name in `OPTION_NAMES` (look.ts). Counts flow from there.
2. If the bit width changes (count crosses a power of two), `encodeLook` codes change; bump `CharacterLook.v` per look.ts rules and keep old decode.
3. A new category: add to `CHARACTER_OPTIONS.categories` and `LOOK_FIELDS`; the creator and validation pick it up automatically (no UI change). The server validates via `decodeLook`/`validateLook`, so it needs no change either.
4. New animations: add to `HERO_ANIMS` (they are packed into every sheet), then map state to it in `motion.ts`.
