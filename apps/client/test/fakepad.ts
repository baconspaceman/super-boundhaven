import type { PadLike } from '../src/gamepad';

/** Scriptable fake standard-mapping pad (Xbox-style). Mutates in place like the browser's live state. */
export function fakePad(opts: { id?: string; index?: number; mapping?: string; nButtons?: number; nAxes?: number } = {}) {
  const n = opts.nButtons ?? 17;
  const pad = {
    id: opts.id ?? 'Xbox 360 Controller (XInput STANDARD GAMEPAD)',
    index: opts.index ?? 0,
    connected: true,
    mapping: opts.mapping ?? 'standard',
    buttons: Array.from({ length: n }, () => ({ pressed: false, value: 0 })),
    axes: new Array<number>(opts.nAxes ?? 4).fill(0),
  };
  const api = {
    pad: pad as PadLike,
    press(i: number, v = 1) {
      pad.buttons[i] = { pressed: v > 0.5, value: v };
      return api;
    },
    release(i: number) {
      pad.buttons[i] = { pressed: false, value: 0 };
      return api;
    },
    axes(...a: number[]) {
      a.forEach((v, i) => (pad.axes[i] = v));
      return api;
    },
    clear() {
      pad.buttons.forEach((_, i) => (pad.buttons[i] = { pressed: false, value: 0 }));
      pad.axes.fill(0);
      return api;
    },
  };
  return api;
}
