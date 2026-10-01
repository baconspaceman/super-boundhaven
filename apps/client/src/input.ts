import { BTN } from '@sbh/sim';

const LEFT = new Set(['KeyA', 'ArrowLeft']);
const RIGHT = new Set(['KeyD', 'ArrowRight']);
const JUMP = new Set(['Space', 'KeyZ', 'KeyK', 'ArrowUp', 'KeyW']);
const RUN = new Set(['ShiftLeft', 'ShiftRight', 'KeyX', 'KeyJ']);
const PREVENT = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space']);

const typing = (e: KeyboardEvent) => e.target instanceof HTMLInputElement;

/** Keyboard + first gamepad -> BTN bitmask. */
export class Input {
  private keys = new Set<string>();
  /** When true (a UI overlay owns the keyboard) no keys register and read() returns 0. */
  private held = false;

  get captured(): boolean {
    return this.held;
  }
  set captured(v: boolean) {
    this.held = v;
    if (v) this.keys.clear();
  }

  constructor() {
    window.addEventListener('keydown', (e) => {
      if (this.held || typing(e)) return;
      if (PREVENT.has(e.code)) e.preventDefault();
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
  }

  private any(set: Set<string>): boolean {
    for (const k of set) if (this.keys.has(k)) return true;
    return false;
  }

  read(): number {
    if (this.held) return 0;
    let b = 0;
    if (this.any(LEFT)) b |= BTN.LEFT;
    if (this.any(RIGHT)) b |= BTN.RIGHT;
    if (this.any(JUMP)) b |= BTN.JUMP;
    if (this.any(RUN)) b |= BTN.RUN;

    const pad = Array.from(navigator.getGamepads?.() ?? []).find((g) => g && g.connected);
    if (pad) {
      const ax = pad.axes[0] ?? 0;
      if (ax < -0.4 || pad.buttons[14]?.pressed) b |= BTN.LEFT;
      if (ax > 0.4 || pad.buttons[15]?.pressed) b |= BTN.RIGHT;
      if (pad.buttons[0]?.pressed) b |= BTN.JUMP;
      if (pad.buttons[1]?.pressed || pad.buttons[2]?.pressed) b |= BTN.RUN;
    }
    return b;
  }
}
