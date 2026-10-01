// Skeleton poses + animation timing for the humanoid. Renderer-agnostic data: a future 3D->2D
// pipeline can consume the same anim names / frame counts / tick tables.

export const HERO_W = 24;
export const HERO_H = 32;

export type EyeState = 'open' | 'blink' | 'shut' | 'wince' | 'wide';
export type MouthState = 'style' | 'open' | 'grit' | 'wail' | 'o' | 'smile';
export type BrowState = 'style' | 'angry' | 'worry' | 'up';

export interface LegPose {
  /** horizontal foot offset from hip (+ = forward/right) */
  dx: number;
  /** raise the foot this many px off the ground line */
  lift: number;
}

export interface Pose {
  dy?: number; // whole-body drop (+ = lower), for bob / crouch
  torsoExtra?: number; // +1 stretch, -1/-2 squash
  torsoDx?: number; // lean (whole upper body)
  headDx?: number;
  headDy?: number;
  tilt?: number; // head shear: + leans head forward
  look?: -1 | 0 | 1; // face up / level / down
  eyes?: EyeState;
  mouth?: MouthState;
  brows?: BrowState;
  back?: 0 | 1 | 2 | 3; // back-item pose: hang, flow, up, stream
  near: LegPose;
  far: LegPose;
  armNear: [number, number]; // hand offset from shoulder
  armFar: [number, number];
}

const P = (o: Partial<Pose> & Pick<Pose, 'near' | 'far'>): Pose => ({ armNear: [1, 4], armFar: [-1, 4], ...o });

export const HERO_POSES: Record<string, Pose> = {
  idle_0: P({ near: { dx: 1, lift: 0 }, far: { dx: -2, lift: 0 }, armNear: [1, 4], armFar: [-1, 4] }),
  idle_1: P({ near: { dx: 1, lift: 0 }, far: { dx: -2, lift: 0 }, armNear: [1, 5], armFar: [-1, 5], back: 1, brows: 'up' }),
  idle_2: P({ dy: 1, near: { dx: 1, lift: 0 }, far: { dx: -2, lift: 0 }, armNear: [1, 4], armFar: [-1, 4], eyes: 'blink' }),
  idle_3: P({ dy: 1, near: { dx: 1, lift: 0 }, far: { dx: -2, lift: 0 }, armNear: [2, 3], armFar: [-1, 4], back: 1 }),

  walk_0: P({ near: { dx: 3, lift: 0 }, far: { dx: -3, lift: 0 }, armNear: [-3, 3], armFar: [3, 3], back: 1 }),
  walk_1: P({ dy: 1, near: { dx: 2, lift: 0 }, far: { dx: -2, lift: 0 }, armNear: [-2, 4], armFar: [2, 4] }),
  walk_2: P({ near: { dx: 0, lift: 0 }, far: { dx: 2, lift: 2 }, armNear: [0, 4], armFar: [0, 4], back: 2 }),
  walk_3: P({ near: { dx: -3, lift: 0 }, far: { dx: 3, lift: 0 }, armNear: [3, 3], armFar: [-3, 3], back: 1 }),
  walk_4: P({ dy: 1, near: { dx: -2, lift: 0 }, far: { dx: 2, lift: 0 }, armNear: [2, 4], armFar: [-2, 4] }),
  walk_5: P({ near: { dx: 2, lift: 2 }, far: { dx: 0, lift: 0 }, armNear: [0, 4], armFar: [0, 4], back: 2 }),

  run_0: P({ torsoDx: 1, tilt: 2, near: { dx: 4, lift: 0 }, far: { dx: -4, lift: 1 }, armNear: [-4, 2], armFar: [4, 2], back: 3, mouth: 'grit' }),
  run_1: P({ dy: 1, torsoDx: 1, tilt: 2, near: { dx: 2, lift: 0 }, far: { dx: -4, lift: 2 }, armNear: [-3, 3], armFar: [3, 3], back: 3, mouth: 'grit' }),
  run_2: P({ torsoDx: 1, tilt: 2, near: { dx: 0, lift: 0 }, far: { dx: 1, lift: 3 }, armNear: [-1, 4], armFar: [1, 4], back: 2, mouth: 'grit' }),
  run_3: P({ torsoDx: 1, tilt: 2, near: { dx: -3, lift: 3 }, far: { dx: 3, lift: 2 }, armNear: [3, 2], armFar: [-3, 3], back: 3, mouth: 'grit' }),
  run_4: P({ torsoDx: 1, tilt: 2, near: { dx: -4, lift: 1 }, far: { dx: 4, lift: 0 }, armNear: [4, 2], armFar: [-4, 2], back: 3, mouth: 'grit' }),
  run_5: P({ dy: 1, torsoDx: 1, tilt: 2, near: { dx: -4, lift: 2 }, far: { dx: 2, lift: 0 }, armNear: [3, 3], armFar: [-3, 3], back: 3, mouth: 'grit' }),
  run_6: P({ torsoDx: 1, tilt: 2, near: { dx: 1, lift: 3 }, far: { dx: 0, lift: 0 }, armNear: [1, 4], armFar: [-1, 4], back: 2, mouth: 'grit' }),
  run_7: P({ torsoDx: 1, tilt: 2, near: { dx: 3, lift: 2 }, far: { dx: -3, lift: 3 }, armNear: [-3, 3], armFar: [3, 2], back: 3, mouth: 'grit' }),

  skid: P({ dy: 1, torsoDx: -1, tilt: -2, near: { dx: 4, lift: 0 }, far: { dx: 2, lift: 0 }, armNear: [-4, -1], armFar: [-3, 2], eyes: 'shut', mouth: 'grit', back: 1 }),

  jump_anticip: P({ dy: 2, torsoExtra: -1, near: { dx: 2, lift: 0 }, far: { dx: -2, lift: 0 }, armNear: [-3, 3], armFar: [-3, 3], eyes: 'shut', back: 0 }),
  jump_rise: P({ torsoExtra: 1, near: { dx: 1, lift: 2 }, far: { dx: -1, lift: 3 }, armNear: [5, -4], armFar: [-5, -3], mouth: 'open', eyes: 'wide', look: -1, back: 2 }),
  jump_apex: P({ near: { dx: 3, lift: 3 }, far: { dx: -2, lift: 4 }, armNear: [5, -2], armFar: [-5, -2], mouth: 'open', back: 1 }),
  fall: P({ torsoExtra: 1, near: { dx: 3, lift: 1 }, far: { dx: -3, lift: 0 }, armNear: [5, -3], armFar: [-5, -3], mouth: 'wail', eyes: 'wide', look: 1, back: 2 }),

  land_0: P({ dy: 4, torsoExtra: -2, near: { dx: 4, lift: 0 }, far: { dx: -4, lift: 0 }, armNear: [4, 1], armFar: [-4, 1], eyes: 'shut', mouth: 'o', back: 1 }),
  land_1: P({ dy: 2, torsoExtra: -1, near: { dx: 2, lift: 0 }, far: { dx: -2, lift: 0 }, armNear: [2, 3], armFar: [-2, 3], back: 0 }),

  hurt_0: P({ torsoDx: -1, tilt: -2, near: { dx: 3, lift: 1 }, far: { dx: -1, lift: 0 }, armNear: [5, -2], armFar: [-3, -2], eyes: 'wince', mouth: 'wail', brows: 'worry', back: 2 }),
  hurt_1: P({ dy: 1, torsoDx: -1, tilt: -2, near: { dx: 4, lift: 0 }, far: { dx: 1, lift: 0 }, armNear: [5, -1], armFar: [-2, -1], eyes: 'wince', mouth: 'wail', brows: 'worry', back: 1 }),

  // rider poses (composited on mounts; hip joint = RIDER_HIP)
  ride_sit: P({ near: { dx: 4, lift: 4 }, far: { dx: 3, lift: 5 }, armNear: [3, 3], armFar: [2, 3] }),
  ride_lean: P({ torsoDx: 1, tilt: 2, near: { dx: 3, lift: 5 }, far: { dx: 1, lift: 6 }, armNear: [4, 1], armFar: [3, 1], mouth: 'grit', back: 3 }),
  ride_grip: P({ near: { dx: 4, lift: 5 }, far: { dx: 2, lift: 6 }, armNear: [4, -1], armFar: [3, -1], mouth: 'open', eyes: 'wide', back: 2 }),
};

/** Hero frame px that must sit on a mount's seat anchor when riding. */
export const RIDER_HIP: [number, number] = [12, 22];

/** Tuck pose rendered then rotated for the stomp-bounce spin. */
export const TUCK_POSE: Pose = P({
  dy: 2,
  torsoExtra: -1,
  near: { dx: 3, lift: 2 },
  far: { dx: 1, lift: 3 },
  armNear: [4, 1],
  armFar: [-3, 2],
  eyes: 'shut',
  back: 1,
});

export interface AnimDef {
  /** frame names, e.g. `hero/run_0` */
  frames: string[];
  fps: number;
  loop: boolean;
  /** per-frame hold in ticks at 60 Hz (authoritative; fps is the mean) */
  ticks: number[];
}

function anim(prefix: string, n: number, ticks: number | number[], loop: boolean, namePrefix = 'hero/'): AnimDef {
  const t = Array.isArray(ticks) ? ticks : Array<number>(n).fill(ticks);
  const mean = t.reduce((a, b) => a + b, 0) / t.length;
  return {
    frames: Array.from({ length: n }, (_, i) => `${namePrefix}${prefix}_${i}`),
    fps: Math.round((60 / mean) * 10) / 10,
    loop,
    ticks: t,
  };
}

export const HERO_ANIMS: Record<string, AnimDef> = {
  idle: anim('idle', 4, [52, 12, 10, 14], true),
  walk: anim('walk', 6, 6, true),
  run: anim('run', 8, 4, true),
  skid: { frames: ['hero/skid'], fps: 4, loop: false, ticks: [15] },
  jump_start: { frames: ['hero/jump_anticip'], fps: 10, loop: false, ticks: [6] },
  jump_rise: { frames: ['hero/jump_rise'], fps: 4, loop: false, ticks: [15] },
  jump_apex: { frames: ['hero/jump_apex'], fps: 4, loop: false, ticks: [15] },
  fall: { frames: ['hero/fall'], fps: 4, loop: false, ticks: [15] },
  land: anim('land', 2, [5, 7], false),
  stomp: anim('stomp', 4, 4, true),
  hurt: anim('hurt', 2, [6, 6], true),
  respawn: anim('flash', 2, 3, true),
  ride_sit: { frames: ['hero/ride_sit'], fps: 1, loop: false, ticks: [60] },
  ride_lean: { frames: ['hero/ride_lean'], fps: 1, loop: false, ticks: [60] },
  ride_grip: { frames: ['hero/ride_grip'], fps: 1, loop: false, ticks: [60] },
};

/** Canonical frame order: every name that exists in a composed sheet/atlas (no duplicates). */
export const HERO_FRAME_NAMES: string[] = [...new Set(Object.values(HERO_ANIMS).flatMap((a) => a.frames))];

/** Frame name -> [poseKey]; flash frames reuse idle_0 / land_1 silhouettes. */
export function poseKeyForFrame(frame: string): string {
  const n = frame.replace('hero/', '');
  if (n === 'flash_0') return 'idle_0';
  if (n === 'flash_1') return 'land_1';
  return n;
}
