// Regenerates every PNG sheet + atlas JSON under packages/art/assets/. Run: npm run build:art -w @sbh/art
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCharacters } from './build-characters';
import { buildWorld } from './build-world';

const out = resolve(dirname(fileURLToPath(import.meta.url)), '../assets');
mkdirSync(out, { recursive: true });
await buildCharacters(out);
await buildWorld(out);
console.log('art built ->', out);
