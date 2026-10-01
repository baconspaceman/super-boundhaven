// Standalone runner for the world art (doesn't depend on the characters build). Run: npx tsx packages/art/scripts/run-world.ts
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildWorld } from './build-world';

const out = resolve(dirname(fileURLToPath(import.meta.url)), '../assets');
await buildWorld(out);
console.log('world art built ->', out);
