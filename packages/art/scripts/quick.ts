import { writeFileSync } from 'node:fs';
import { encodePNG } from '../src/png';
import { contactSheet } from './preview';
import { buildMountFrames, MOUNT_NAMES } from '../src/characters/mounts';
const only = process.argv[2];
const groups = MOUNT_NAMES.filter((m) => !only || only === m).map((m) => ({ title: m, frames: Object.entries(buildMountFrames(m)).filter(([k]) => k.startsWith('mount_') || k.includes('idle_0') ) as any }));
writeFileSync(new URL('../assets/_quick.png', import.meta.url), encodePNG(contactSheet(groups, 3, 10)));
