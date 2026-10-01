// Standalone runner so the character pipeline can be built without the world artist's script.
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCharacters } from './build-characters';

const out = resolve(dirname(fileURLToPath(import.meta.url)), '../assets');
mkdirSync(out, { recursive: true });
await buildCharacters(out);
console.log('characters built ->', out);
