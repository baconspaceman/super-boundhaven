export interface Region {
  id: string;
  name: string;
  blurb: string;
  tags: string[];
  alt: string;
}

// Regions are creative direction, not a launch promise. Order is a loose "journey", not a map.
export const REGIONS: Region[] = [
  {
    id: 'grassland',
    name: 'Sunny Grassland',
    blurb: 'The friendly starting meadow: rolling hills, bounce pads and your first gap to clear.',
    tags: ['Starter area', 'Gentle slopes'],
    alt: 'Pixel-art meadow with rolling green hills, round trees, flowers, a red bounce pad and a floating brick ledge under a bright sky.',
  },
  {
    id: 'factory',
    name: 'Clockwork Factory',
    blurb: 'Gears, conveyors and steam vents that punish sloppy timing and reward a clean rhythm.',
    tags: ['Timing', 'Moving hazards'],
    alt: 'Pixel-art factory interior with glowing windows, turning gears, steel pipes, smokestacks and a conveyor belt.',
  },
  {
    id: 'jungle',
    name: 'Canopy Jungle',
    blurb: 'Vines, leaf platforms and a dense green ceiling that hides shortcuts and secrets.',
    tags: ['Vertical', 'Secrets'],
    alt: 'Pixel-art jungle with tall trunks, hanging vines, broad leaf platforms, fireflies and shafts of light.',
  },
  {
    id: 'underwater',
    name: 'Sunken Pirate Cove',
    blurb: 'Dive past seaweed and schools of fish to a wrecked ship with stories still aboard.',
    tags: ['Underwater', 'Pirates'],
    alt: 'Pixel-art seabed with a sunken pirate ship, flag, seaweed, bubbles, fish and sandy floor.',
  },
  {
    id: 'caves',
    name: 'Crystal Caves',
    blurb: 'Stalactites overhead and glowing crystal clusters lighting narrow ledges.',
    tags: ['Dark', 'Precision'],
    alt: 'Pixel-art cave with stalactites, stalagmites and glowing cyan and pink crystal clusters.',
  },
  {
    id: 'sky',
    name: 'Cloudtop Isles',
    blurb: 'Floating islands, waterfalls that fall into nothing, and a very long way down.',
    tags: ['Open air', 'Big jumps'],
    alt: 'Pixel-art floating islands with grass and a tree, a thin waterfall, puffy clouds, a small hut and distant birds.',
  },
  {
    id: 'lava',
    name: 'Ember Depths',
    blurb: 'A volcano that means it: obsidian stepping stones over a slow-rolling lava lake.',
    tags: ['Hazard-heavy', 'High stakes'],
    alt: 'Pixel-art volcano erupting over a glowing lava lake with dark obsidian platforms and drifting embers.',
  },
  {
    id: 'stormy',
    name: 'Stormbreak Island',
    blurb: 'Lightning, rain and a lighthouse that may or may not still be guiding anyone home.',
    tags: ['Weather', 'Atmosphere'],
    alt: 'Pixel-art stormy island with a striped lighthouse, palm tree, rough sea, slanting rain and a lightning bolt.',
  },
  {
    id: 'haunted',
    name: 'Hollow Manor',
    blurb: 'A crooked mansion, a graveyard fence and friendly-looking ghosts that may not be.',
    tags: ['Spooky', 'Puzzles'],
    alt: 'Pixel-art haunted manor with lit windows under a full moon, bare trees, tombstones, bats and floating ghosts.',
  },
  {
    id: 'space',
    name: 'Orbit Gardens',
    blurb: 'Asteroid platforms and low-grip drifts around a ringed planet and a humming station.',
    tags: ['Low gravity idea', 'Sci-fi'],
    alt: 'Pixel-art outer space with a ringed orange planet, a small moon, asteroid platforms, nebula clouds and a space station.',
  },
  {
    id: 'bayou',
    name: 'Mossy Bayou',
    blurb: 'Cypress roots, drifting fog, lily pads and a stilt shack with one lit window.',
    tags: ['Swamp', 'Mood'],
    alt: 'Pixel-art swamp with moss-draped cypress trees, fog, lily pads, a floating log and a stilt shack.',
  },
  {
    id: 'candy',
    name: 'Sugar Summit',
    blurb: 'Lollipop forests, cake towers and chocolate ground. Dessert land, but make it a platformer.',
    tags: ['Sweet', 'Whimsical'],
    alt: 'Pixel-art candy land with giant lollipops, a layered cake tower with a cherry, candy canes and chocolate ground.',
  },
  {
    id: 'desert',
    name: 'Sunbaked Sands',
    blurb: 'Dunes, sandstone ruins and a hard-earned oasis under a very large sun.',
    tags: ['Sandy desert', 'Open vistas'],
    alt: 'Pixel-art desert with layered dunes, stepped pyramids, cacti, a small oasis with a palm and a huge sun.',
  },
  {
    id: 'city',
    name: 'Neon Bazaar City',
    blurb: 'A bustling evening city of market stalls, neon signs and a clock tower. Built for trading and meeting up.',
    tags: ['Hub idea', 'Shopping'],
    alt: 'Pixel-art city at dusk with layered skyline, lit windows, a clock tower, neon signs, market stalls and street lamps.',
  },
];

export interface RealRegion {
  id: 'meadow' | 'meadow_sunset' | 'caverns';
  name: string;
  blurb: string;
  scenes: string[]; // asset file names (768x672 scene renders, 3x native)
  alts: string[];
}

/** Regions with real art that also run in the prototype's region switcher. */
export const REAL_REGIONS: RealRegion[] = [
  {
    id: 'meadow',
    name: 'Sunny Grassland',
    blurb: 'The friendly starting meadow: grass-capped hills, a tall tree, a fence, bounce pads and your first gap to clear.',
    scenes: ['world_preview_scene_meadow_0.png', 'world_preview_scene_meadow_1.png', 'world_preview_scene_meadow_2.png'],
    alts: [
      'Pixel-art meadow by day: a brown dirt mound with a grass cap, rolling green hills, white clouds and a pale sun.',
      'Pixel-art meadow by day with a small pond in the ground, rolling hills and layered mountains behind.',
      'Pixel-art meadow by day with a tall stone pillar on the left and a taller one at the edge, under big white clouds.',
    ],
  },
  {
    id: 'meadow_sunset',
    name: 'Grassland at sunset',
    blurb: 'The same meadow at golden hour: coral clouds over purple mountains, with a warmer ground tileset.',
    scenes: [
      'world_preview_scene_meadow_sunset_0.png',
      'world_preview_scene_meadow_sunset_1.png',
      'world_preview_scene_meadow_sunset_2.png',
    ],
    alts: [
      'Pixel-art meadow at sunset: a grassy dirt mound, a windmill on the hills, coral clouds in a purple and pink sky.',
      'Pixel-art sunset meadow with a pond, layered purple hills and glowing clouds.',
      'Pixel-art sunset meadow with a stone pillar, rolling hills and a huge coral cloud.',
    ],
  },
  {
    id: 'caverns',
    name: 'Crystal Caves',
    blurb: 'Stalactites overhead, cyan and magenta crystals underfoot, and shafts of light from far above.',
    scenes: ['world_preview_scene_caverns_0.png', 'world_preview_scene_caverns_1.png', 'world_preview_scene_caverns_2.png'],
    alts: [
      'Pixel-art cave: purple stalactites, light shafts, and a mound of purple stone with a green cap and crystals.',
      'Pixel-art cave with a blue pool in the floor under light shafts and hanging stalactites.',
      'Pixel-art cave with a tall stone pillar and glowing crystals on the floor.',
    ],
  },
];

export const CONCEPT_IDS = REGIONS.map((r) => r.id).filter((id) => id !== 'grassland' && id !== 'caves');
