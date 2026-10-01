// Public surface of the world art (tiles, autotiler, props, parallax backgrounds, reference compositor).
// Browser-safe (no Node imports); PNG export lives in scripts/build-world.ts.
export { autotile, TILE_ANIMS, type TileRef } from './autotile';
export { BACKGROUNDS, buildBackground, type BackgroundLayer, type BgSet } from './backgrounds';
export { decorate, type PropPlacement } from './decor';
export { buildCavernProps, buildMeadowProps, buildSunsetProps, type PropDef, type PropSet } from './props';
export { loadRegionAssets, renderScene, scaleBitmap, type RegionAssets, type SceneOpts } from './scene';
export { ATLAS_COLS, TILE_IDS, TILESETS, buildTilesetBitmap, tileAtlas, type RegionId, type TileAnim, type TilesetInfo } from './tileset';
export { OBJECTS, OBJECT_ANIMS, OBJECT_FRAME_NAMES, buildObjectFrames, buildObjectSheet, type ObjectAnim, type ObjectRegion, type ObjectSet } from './objects';
