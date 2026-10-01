import { ControlsStore, BIT, maskFromKeys, maskFromPad, systemActionsForKey, systemActionsForPad, type ActionId } from './bindings';
import { Gamepads } from './gamepad';

const PREVENT = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space']);

const typing = (e: KeyboardEvent) =>
  e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement;

export type Device = 'kb' | 'pad';

/**
 * Keyboard + gamepad -> sim input bitmask (LEFT/RIGHT/JUMP/RUN/CROUCH/ACTION), plus system actions (menu, creator).
 * Call `read()` once per fixed tick: that is also what polls the pads and drives overlay navigation (`onTick`).
 */
export class Input {
  readonly store: ControlsStore;
  readonly pads: Gamepads;
  /** Which device produced input last (drives glyph prompts). */
  lastDevice: Device = 'kb';
  /** Fired for pause-menu / creator presses while no overlay owns the input. */
  onSystem: (a: ActionId) => void = () => {};
  /** Called every tick after polling (UI navigation hooks in here), even while captured. */
  readonly onTick: Array<(now: number) => void> = [];
  onDeviceChange: (d: Device) => void = () => {};
  /** Most recent mask returned by read() (diagnostics / tests). */
  lastMask = 0;

  private keys = new Set<string>();
  private reasons = new Set<string>();
  private runLatched = false;
  private prevRunRaw = false;

  constructor(store: ControlsStore = new ControlsStore(), pads: Gamepads = new Gamepads()) {
    this.store = store;
    this.pads = pads;
    this.pads.deadzone = store.cfg.settings.deadzone;
    this.pads.start();
    this.pads.onDisconnect = () => this.releaseAll();

    window.addEventListener('keydown', (e) => {
      if (typing(e) || e.defaultPrevented) return; // defaultPrevented: an overlay already consumed it (e.g. Esc closing the menu)
      // A key held across an overlay close must not register on auto-repeat.
      if (e.repeat && !this.keys.has(e.code)) return;
      this.setDevice('kb');
      if (this.captured) return;
      if (PREVENT.has(e.code)) e.preventDefault();
      this.keys.add(e.code);
      if (!e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey) {
        for (const a of systemActionsForKey(e.code, this.store.cfg)) this.onSystem(a);
      }
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.releaseAll());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.releaseAll();
    });
  }

  // ---- capture (an overlay owns the input) -------------------------------------------------------
  get captured(): boolean {
    return this.reasons.size > 0;
  }
  /** Legacy single-flag API used by main.ts: true = a UI overlay owns the keyboard/pad. */
  set captured(v: boolean) {
    if (v) this.capture('legacy');
    else this.release('legacy');
  }
  capture(reason: string): void {
    const was = this.captured;
    this.reasons.add(reason);
    if (!was) this.releaseAll();
  }
  release(reason: string): void {
    if (!this.reasons.delete(reason)) return;
    if (!this.captured) {
      this.keys.clear();
      // buttons still held from the overlay (e.g. the B/A that closed it) are ignored until released
      this.pads.suppressHeld();
    }
  }

  /** Drop every held key/button and any run-toggle latch (blur, disconnect, overlay open). */
  releaseAll(): void {
    this.keys.clear();
    this.runLatched = false;
    this.prevRunRaw = false;
    this.lastMask = 0;
  }

  private setDevice(d: Device): void {
    if (d !== this.lastDevice) {
      this.lastDevice = d;
      this.onDeviceChange(d);
    }
  }

  /** Poll devices; returns the sim input mask for this tick (0 while an overlay owns the input). */
  read(now: number = performance.now()): number {
    const cfg = this.store.cfg;
    this.pads.deadzone = cfg.settings.deadzone;
    const pad = this.pads.poll(now);
    if (pad && (pad.pressedEdges.length || pad.dirEdges.length)) this.setDevice('pad');
    for (const fn of this.onTick) fn(now);

    if (this.captured) {
      this.lastMask = 0;
      return 0;
    }
    if (pad) for (const a of systemActionsForPad(pad, cfg)) this.onSystem(a);
    if (this.captured) {
      // a system action (menu) just took over this tick
      this.lastMask = 0;
      return 0;
    }

    let b = maskFromKeys(this.keys, cfg) | maskFromPad(pad, cfg);

    if (cfg.settings.runToggle) {
      const raw = (b & BIT.RUN) !== 0;
      if (raw && !this.prevRunRaw) this.runLatched = !this.runLatched;
      this.prevRunRaw = raw;
      b = this.runLatched ? b | BIT.RUN : b & ~BIT.RUN;
    } else {
      this.runLatched = false;
    }
    this.lastMask = b;
    return b;
  }
}
