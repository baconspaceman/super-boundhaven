import { describe, expect, it } from 'vitest';
import { CAMERA, FollowCamera, smoothDamp, type CameraInput } from '../src/camera';
import { UNDERGROUND_ROWS } from '../src/viewport';

const VW = 480;
const VH = 270;
const LEVEL_W = 3000;
const LEVEL_H = 256;
const FLOOR = 208;

interface P {
  x: number;
  y: number;
  vx: number;
  onGround: boolean;
}
const input = (p: P, others: { x: number; y: number }[] = [], levelW = LEVEL_W): CameraInput => ({
  px: p.x,
  py: p.y,
  vx: p.vx,
  onGround: p.onGround,
  others,
  levelW,
  levelH: LEVEL_H,
  viewW: VW,
  viewH: VH,
});

/** Drive a camera with a script: script(t seconds, player) mutates the player each frame (player speeds in px/tick). */
function drive(
  fps: number,
  seconds: number,
  start: P,
  script: (t: number, p: P, dt: number) => void,
  others: (t: number) => { x: number; y: number }[] = () => [],
  levelW = LEVEL_W,
  cam = new FollowCamera(),
) {
  const p = { ...start };
  const dt = 1000 / fps;
  cam.snap(input(p, [], levelW));
  const trace: { t: number; cx: number; cy: number; z: number; px: number; py: number }[] = [];
  for (let f = 0; f < seconds * fps; f++) {
    const t = f / fps;
    script(t, p, dt / 1000);
    const s = cam.update(dt, input(p, others(t), levelW));
    trace.push({ t, cx: s.cx, cy: s.cy, z: s.zoom, px: p.x, py: p.y });
  }
  return { trace, cam, p };
}
const ground = (x: number, y = FLOOR): P => ({ x, y, vx: 0, onGround: true });

describe('FollowCamera: horizontal', () => {
  it('settles on a standing player and then does not move at all', () => {
    const { trace } = drive(60, 4, ground(1000), () => {});
    const last = trace[trace.length - 1];
    expect(Math.abs(last.cx - last.px)).toBeLessThanOrEqual(CAMERA.deadZoneStill + 0.01);
    const late = trace.filter((r) => r.t > 3);
    expect(Math.max(...late.map((r) => r.cx)) - Math.min(...late.map((r) => r.cy === r.cy ? r.cx : 0))).toBeLessThan(0.01);
  });

  it('follows a runner without overshoot and settles after they stop', () => {
    const { trace } = drive(60, 7, ground(500), (t, p, dt) => {
      p.vx = t < 2 ? 2.6 : 0;
      p.x += p.vx * 60 * dt;
    });
    const stopX = 500 + 2.6 * 60 * 2;
    // never ahead of the player by more than the look-ahead + dead zone, never past where they stopped (no overshoot)
    for (const r of trace) {
      expect(r.cx - r.px).toBeLessThanOrEqual(CAMERA.lookAheadMax + CAMERA.deadZoneMoving + 2);
      expect(r.px - r.cx).toBeLessThanOrEqual(CAMERA.deadZoneMoving + 40); // the player is never lost off the back
      if (r.t > 2) expect(r.cx).toBeLessThanOrEqual(stopX + CAMERA.lookAheadMax + 1);
    }
    expect(Math.abs(trace[trace.length - 1].cx - stopX)).toBeLessThanOrEqual(CAMERA.deadZoneStill + 0.5);
  });

  it('turning around does not whip the camera: bounded acceleration', () => {
    const { trace } = drive(60, 8, ground(1500), (t, p, dt) => {
      p.vx = t < 2 ? 2.6 : t < 5 ? -2.6 : 2.6;
      p.x += p.vx * 60 * dt;
    });
    let maxAcc = 0;
    for (let i = 2; i < trace.length; i++) {
      const v1 = (trace[i].cx - trace[i - 1].cx) * 60;
      const v0 = (trace[i - 1].cx - trace[i - 2].cx) * 60;
      maxAcc = Math.max(maxAcc, Math.abs(v1 - v0) * 60);
    }
    expect(maxAcc).toBeLessThan(900); // px/s^2 (a hard snap would be thousands)
  });
});

describe('FollowCamera: vertical', () => {
  it('does not move vertically during an ordinary jump', () => {
    const { trace } = drive(60, 4, ground(1000), (t, p, dt) => {
      if (t > 1.5 && t < 2.5) {
        const k = (t - 1.5) / 1; // 0..1 parabola, apex 100 px
        p.y = FLOOR - 400 * k * (1 - k);
        p.onGround = false;
      } else {
        p.y = FLOOR;
        p.onGround = true;
      }
      void dt;
    });
    const cys = trace.filter((r) => r.t > 1).map((r) => r.cy);
    expect(Math.max(...cys) - Math.min(...cys)).toBeLessThan(1);
  });

  it('frames the ground at the configured height and re-frames smoothly on a higher platform', () => {
    const { trace } = drive(60, 6, ground(1000), (t, p) => {
      if (t > 1 && t < 1.5) {
        p.y = FLOOR - 96 * ((t - 1) / 0.5);
        p.onGround = false;
      } else if (t >= 1.5) {
        p.y = FLOOR - 96;
        p.onGround = true;
      }
    });
    const end = trace[trace.length - 1];
    expect((end.py - end.cy) / VH).toBeCloseTo(CAMERA.groundFrac - 0.5, 1);
    // no overshoot: cy decreases monotonically (world y goes up) from the start of the rise
    let prev = Infinity;
    for (const r of trace.filter((r) => r.t > 1.4)) {
      expect(r.cy).toBeLessThanOrEqual(prev + 1e-6);
      prev = r.cy;
    }
  });

  it('follows a long fall and a very high bounce, and keeps the player in view', () => {
    const { trace } = drive(60, 5, ground(1000, 100), (t, p) => {
      if (t < 1) {
        p.y = 100;
        p.onGround = true;
      } else if (t < 2) {
        p.y = 100 + 300 * (t - 1) * (t - 1); // free fall to y=400
        p.onGround = false;
      } else {
        p.y = 400;
        p.onGround = true;
      }
    });
    for (const r of trace) {
      expect(Math.abs(r.py - r.cy)).toBeLessThan(VH / 2);
    }
    const end = trace[trace.length - 1];
    expect((end.py - end.cy) / VH).toBeGreaterThan(0.1);
  });
});

describe('FollowCamera: zoom', () => {
  it('stays at exactly 1 with no teammates, and never goes above 1', () => {
    const { trace } = drive(60, 3, ground(1000), () => {});
    expect(trace.every((r) => r.z === 1)).toBe(true);
  });

  it('zooms out (never below the limit) for a distant teammate and returns to exactly 1.0 when they leave', () => {
    const { trace } = drive(60, 14, ground(1000), () => {}, (t) => (t > 1 && t < 6 ? [{ x: 1250, y: FLOOR }] : []));
    const mid = trace.find((r) => r.t > 5.5)!;
    expect(mid.z).toBeLessThan(0.8);
    expect(Math.min(...trace.map((r) => r.z))).toBeGreaterThanOrEqual(CAMERA.zoomMin - 1e-9);
    expect(trace[trace.length - 1].z).toBe(1);
    // the local player stays centred while zoomed out (teammates are framed around them, not the other way round)
    expect(Math.abs(mid.cx - mid.px)).toBeLessThanOrEqual(CAMERA.deadZoneStill + 0.5);
  });

  it('does not flip-flop when a teammate hovers around the threshold', () => {
    let flips = 0;
    let dir = 0;
    let last = 1;
    const { trace } = drive(60, 20, ground(1000), () => {}, (t) => [{ x: 1000 + 190 + (Math.floor(t * 4) % 2) * 25, y: FLOOR }]);
    for (const r of trace) {
      const d = Math.sign(r.z - last);
      if (d !== 0 && d !== dir && Math.abs(r.z - last) > 1e-4) {
        if (dir !== 0) flips++;
        dir = d;
      }
      last = r.z;
    }
    expect(flips).toBeLessThanOrEqual(2);
  });

  it('zoom can be switched off', () => {
    const cam = new FollowCamera();
    cam.zoomEnabled = false;
    const { trace } = drive(60, 4, ground(1000), () => {}, () => [{ x: 1250, y: FLOOR }], LEVEL_W, cam);
    expect(trace.every((r) => r.z === 1)).toBe(true);
  });
});

describe('FollowCamera: bounds and safety', () => {
  it('keeps the view inside the level at both ends', () => {
    const left = drive(60, 3, ground(30), () => {}).trace.pop()!;
    expect(left.cx).toBeCloseTo(VW / 2, 5);
    const right = drive(60, 3, ground(LEVEL_W - 30), () => {}).trace.pop()!;
    expect(right.cx).toBeCloseTo(LEVEL_W - VW / 2, 5);
  });

  it('copes with a level narrower than the view', () => {
    const { trace } = drive(60, 2, ground(150), () => {}, () => [], 300);
    const end = trace[trace.length - 1];
    expect(end.cx).toBeCloseTo(150, 5);
    expect(Number.isFinite(end.cy)).toBe(true);
  });

  it('snaps (no long glide) after a teleport or respawn', () => {
    const { trace } = drive(60, 3, ground(500), (t, p) => {
      if (t > 1) p.x = 2500;
    });
    const after = trace.find((r) => r.t > 1.05)!;
    expect(Math.abs(after.cx - 2500)).toBeLessThan(10);
  });

  it('the local player is ALWAYS inside the view: random walks, jumps, falls and teleports at 30, 60 and 144 fps', () => {
    let seed = 12345;
    const rnd = () => ((seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 4294967296);
    for (const fps of [30, 60, 144]) {
      for (let run = 0; run < 12; run++) {
        const others = [0, 1, 2].map(() => ({ x: 500 + rnd() * 2000, y: 40 + rnd() * 400 }));
        let vy = 0;
        const { trace, cam } = drive(
          fps,
          20,
          ground(1500),
          (t, p, dt) => {
            const r = rnd();
            if (r < 0.01) p.vx = (rnd() - 0.5) * 6;
            if (r > 0.995) p.x = 100 + rnd() * 2800; // teleport
            p.x = Math.max(10, Math.min(LEVEL_W - 10, p.x + p.vx * 60 * dt));
            if (p.onGround && rnd() < 0.01) {
              vy = -420 - rnd() * 200;
              p.onGround = false;
            }
            if (!p.onGround) {
              vy += 1500 * dt;
              p.y += vy * dt;
              if (p.y >= FLOOR) {
                p.y = FLOOR;
                p.onGround = true;
                vy = 0;
              }
            }
            for (const o of others) o.x += (rnd() - 0.5) * 8;
          },
          () => others,
        );
        for (const r of trace) {
          const halfW = VW / (2 * r.z);
          const halfH = VH / (2 * r.z);
          expect(Math.abs(r.px - r.cx)).toBeLessThanOrEqual(halfW);
          expect(r.py).toBeLessThanOrEqual(r.cy + halfH);
          expect(r.py - CAMERA.bodyHeight).toBeGreaterThanOrEqual(r.cy - halfH);
        }
        expect(cam.zoom).toBeGreaterThanOrEqual(CAMERA.zoomMin - 1e-9);
        expect(cam.zoom).toBeLessThanOrEqual(1);
      }
    }
  });

  it('gives (nearly) the same camera at different frame rates', () => {
    const script = (t: number, p: P, dt: number) => {
      p.vx = t < 2 ? 2.6 : t < 4 ? -1.4 : 0;
      p.x += p.vx * 60 * dt;
    };
    const a = drive(60, 7, ground(1000), script).trace;
    const b = drive(144, 7, ground(1000), script).trace;
    for (const t of [1, 2.5, 4, 6]) {
      const ra = a.find((r) => r.t >= t)!;
      const rb = b.find((r) => r.t >= t)!;
      expect(Math.abs(ra.cx - rb.cx)).toBeLessThan(4);
    }
  });
});

describe('smoothDamp', () => {
  it('converges without overshoot', () => {
    let x = 0;
    let v = 0;
    let max = 0;
    for (let i = 0; i < 600; i++) {
      [x, v] = smoothDamp(x, 100, v, 0.3, 1e9, 1 / 60);
      max = Math.max(max, x);
    }
    expect(max).toBeLessThanOrEqual(100 + 1e-6);
    expect(x).toBeCloseTo(100, 3);
  });
  it('is bounded by the max speed', () => {
    let x = 0;
    let v = 0;
    let prev = 0;
    let fastest = 0;
    for (let i = 0; i < 600; i++) {
      [x, v] = smoothDamp(x, 10000, v, 0.3, 200, 1 / 60);
      fastest = Math.max(fastest, (x - prev) * 60);
      prev = x;
    }
    expect(fastest).toBeLessThan(260);
  });
});

void UNDERGROUND_ROWS;
