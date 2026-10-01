import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { optionGroups, writeGallery } from './gallery';
const out = resolve(dirname(fileURLToPath(import.meta.url)), '../assets');
const only = process.argv[2] ? process.argv[2].split(',') : undefined;
const frame = process.argv[3] ?? 'hero/idle_0';
writeGallery(out, '_gallery.png', optionGroups(frame, only), 16, 3);
