// Hand-authored 12x12 pixel icons rendered as crisp inline SVG (one <rect> per run).
const PAL: Record<string, string> = {
  k: '#0b0b14',
  w: '#ffffff',
  y: '#ffd84a',
  o: '#ff9a3c',
  r: '#ff4f7b',
  p: '#9a7bff',
  b: '#3b82ff',
  c: '#3be0ff',
  g: '#5ef29a',
  d: '#2a9d5c',
  n: '#8a5a36',
  s: '#b8c0e0',
};

const ICONS: Record<string, string[]> = {
  // speed boot with motion lines
  movement: [
    '............',
    '......kkkk..',
    '.....kssssk.',
    '.....kssssk.',
    '.c...kssssk.',
    '.cc..kssssk.',
    '..c.kkssssk.',
    '.cc.ksssssk.',
    '....kyyyyyyk',
    '....kkkkkkkk',
    '...kooooooo.',
    '............',
  ],
  // two players side by side
  players: [
    '............',
    '.kkkk..kkkk.',
    '.kggk..kppk.',
    '.kwkk..kwkk.',
    '.kggk..kppk.',
    '.kggk..kppk.',
    '.kkkk..kkkk.',
    '.kddk..kbbk.',
    '.kddk..kbbk.',
    '.kkkk..kkkk.',
    '............',
    '............',
  ],
  // one player stacked on another (co-op bounce)
  coop: [
    '............',
    '....kkkk....',
    '....kyyk....',
    '....kwky....',
    '....kyyk....',
    '..o.kkkk.o..',
    '...o.rr.o...',
    '....kkkk....',
    '....kccck...',
    '....kccck...',
    '....kkkkk...',
    '............',
  ],
  // level flag / builder
  levels: [
    '............',
    '.kkkkkkkk...',
    '.krrrrrrkk..',
    '.krrrrrrrkk.',
    '.krrrrrrkk..',
    '.kkkkkkkk...',
    '.kn.........',
    '.kn.........',
    '.kn.........',
    '.kn.........',
    'kkkkkk......',
    'knnnnk......',
  ],
  // original powerup gem with sparkle
  powerup: [
    '.....y......',
    '....yyy.....',
    '.....y..y...',
    '..kkkkkyyy..',
    '.kcccccck.y.',
    'kcwwccccck..',
    'kcwcccbbbk..',
    '.kcccbbbk...',
    '..kcbbbk....',
    '...kbbk.....',
    '....kk......',
    '............',
  ],
  // shield / loadout
  gear: [
    '............',
    '..kkkkkkkk..',
    '.kbbbbbbbbk.',
    '.kbwwbbbbbk.',
    '.kbwbbyybbk.',
    '.kbbbbyybbk.',
    '.kbbbyyyybk.',
    '..kbbbyybk..',
    '...kbbbbk...',
    '....kbbk....',
    '.....kk.....',
    '............',
  ],
  // key for secrets
  secrets: [
    '............',
    '..kkkk......',
    '.kyyyyk.....',
    'kyykkyyk....',
    'kyyk.kyk....',
    'kyyk.kyk....',
    'kyyyyyyk....',
    '.kyyyyyykkk.',
    '..kkkkkkyyk.',
    '........kyk.',
    '........kyyk',
    '.........kk.',
  ],
  community: [
    '............',
    '..kk....kk..',
    '.kppk..kccck',
    '.kppk..kccck',
    '..kk....kk..',
    '.kppk..kccck',
    'kppppk.kccck',
    'kppppkkkcccck',
    '.kkkk...kkk.',
    '............',
    '............',
    '............',
  ],
  calendar: [
    '............',
    '.kkkkkkkkkk.',
    '.krrrrrrrrk.',
    '.kwwwwwwwwk.',
    '.kwkkwkkwwk.',
    '.kwwwwwwwwk.',
    '.kwkkwkkkwk.',
    '.kwwwwwwwwk.',
    '.kwkwwwkkwk.',
    '.kwwwwwwwwk.',
    '.kkkkkkkkkk.',
    '............',
  ],
  trophy: [
    '............',
    '.kkkkkkkkk..',
    'kkyyyyyyykk.',
    'kykyyyyykyk.',
    '.kkyyyyykk..',
    '..kyyyyyk...',
    '...kyyyk....',
    '....kyk.....',
    '....kyk.....',
    '...kyyyk....',
    '..kkkkkkk...',
    '............',
  ],
  heart: [
    '............',
    '..kkk.kkk...',
    '.krrrkrrrk..',
    'krwrrrrrrrk.',
    'krrrrrrrrrk.',
    'krrrrrrrrrk.',
    '.krrrrrrrk..',
    '..krrrrrk...',
    '...krrrk....',
    '....krk.....',
    '.....k......',
    '............',
  ],
};

export function pixelIcon(name: string, size = 48): string {
  const rows = ICONS[name];
  if (!rows) return '';
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  let rects = '';
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      if (ch === '.' || !PAL[ch]) {
        x++;
        continue;
      }
      let e = x;
      while (e < row.length && row[e] === ch) e++;
      rects += `<rect x="${x}" y="${y}" width="${e - x}" height="1" fill="${PAL[ch]}"/>`;
      x = e;
    }
  });
  return `<svg class="pxicon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${size}" height="${Math.round((size * h) / w)}" shape-rendering="crispEdges" aria-hidden="true" focusable="false">${rects}</svg>`;
}
