# SBH gameplay-object art
Code `packages/art/src/world/objects.ts`; build `npx tsx packages/art/scripts/run-world.ts`; output `assets/world_objects_<region>.png/.json` (regions `meadow`, `meadow_sunset`, `caverns`). Preview: `assets/world_objects_preview.png` (4x contact sheets + 6 COOP_ROOM scenes per region at 2x), `world_objects_scene_<region>_<0..5>.png` at 3x. Note the scenes are 256x256 (the room is 16 tiles tall).

Colour language: gold = needs action (lock, waiting plate, timer ring), cyan = powered/done (pressed plate, open gate, lit emblem), coral = lever knob / spike hazard stripes, pale slatted lip = one-way. Structure (stone/timber) is tinted per region; accents are identical hexes everywhere.

API: `OBJECTS[region] = { file, atlas, frames: {name:{x,y,w,h}}, anims }`, `OBJECT_ANIMS`. All 16x16 unless noted; draw at the tile top-left.
- `obj/oneway_l|m|r`: choose by neighbouring `-` tiles. Standing surface is row 1.
- `obj/spike`, `obj/spike_1` (glint; anim `spike_glint`). Draw on the `^` tile.
- Door (tiles sorted top to bottom): first = `door_cap`, last = `door_base`, rest `door_mid` (1-tile door: cap). Open: draw `door_open_cap` (or anim `door_open`, 4f, 6fps) on the first tile only; the rest are empty.
- `obj/plate_up`/`plate_down` (bottom 8 px of the `p` tile); overlay anim `plate_glow` while pressed.
- `obj/lever_off|on`, `lever_reset` (circular arrow, cyan). Timed: draw `lever_on` + `lever_timer_k`, k = min(5, floor(elapsed/total*6)); ring drains from full (gold) to red.
- Flags 16x32: anchor bottom-center (x-8, feetY-32). Pole is at x 4-5, base stone centred. Anims `flag_idle` (6fps) / `flag_active` (8fps, sparkle).
- `obj/shard_pickup_0..5` (anim `shard_spin`, pixel-identical to `fx/shard_*`, same in all regions, drawn centred on the shard point), `shard_get_0..3` one-shot burst.
- `obj/link_dot_0..1` 4x4 (anim `link_dot`).
IMPORTANT: `autotile()` treats every non-`.` glyph as ground, so strip `-`, `^`, `D` from the level before autotiling (see `objectsScene` in `scripts/build-world.ts`).

Weaknesses: spike tips are 1px and read white-heavy; open-gate frame is small and abstract; lever reset arrow is crude at 16px; shard has dark outline that is weak on the caverns floor; sunset is a palette grade only; no door "opening" transition frames.
