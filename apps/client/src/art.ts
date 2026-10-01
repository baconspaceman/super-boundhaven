// Browser-safe character art. @sbh/art's package `exports` map only exposes the root (world art), so the
// character modules are imported by relative path, same as world-art.ts does for the world modules.
export * from '../../../packages/art/src/characters/index';
export { hslToHex, ramp3 } from '../../../packages/art/src/characters/pal';
export { packSheet, type Bitmap, type AtlasEntry } from '../../../packages/art/src/core';
