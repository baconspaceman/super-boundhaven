// dev helper: npx tsx packages/art/scripts/zoom.ts <look#> <frame...> -> assets/_zoom.png
import { writeFileSync } from 'node:fs';
import { createBitmap, blit } from '../src/core';
import { encodePNG } from '../src/png';
import { fillRect, scaleBitmap } from '../src/characters/compose';
import { composeNamedFrame } from '../src/characters/paperdoll';
import { SAMPLE_LOOKS } from './build-characters';
const [li, ...names] = process.argv.slice(2);
const look = SAMPLE_LOOKS[Number(li)].look;
const frames = names.map((n) => composeNamedFrame(look, n).bitmap);
const k = 14;
const w = frames.reduce((a, b) => a + b.w * k + 8, 8);
const h = Math.max(...frames.map((f) => f.h)) * k + 16;
const out = createBitmap(w, h);
fillRect(out, 0, 0, w, h, '#c9e4ee');
let x = 8;
for (const f of frames) { blit(out, scaleBitmap(f, k), x, 8); x += f.w * k + 8; }
writeFileSync(new URL('../assets/_zoom.png', import.meta.url), encodePNG(out));
