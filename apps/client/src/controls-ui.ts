// Pause menu, Controls (remapping) screen, first-join controls hint, and the ?pad=debug overlay.
// Styling lives in controls-ui.css (same 16-bit tokens as the creator).
import './controls-ui.css';
import {
  ACTIONS,
  BIT,
  DEADZONE_STEP,
  MAX_SLOTS,
  actionLabel,
  bindToken,
  captureToken,
  clampDeadzone,
  cloneConfig,
  resetAll,
  resetDevice,
  unbindSlot,
  type ActionId,
  type Device,
} from './bindings';
import { STD, type PadKind } from './gamepad';
import { hintEl, tokenEl, tokenName } from './glyphs';
import type { Input } from './input';
import { gameEvents } from './rumble';

function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (text !== undefined) e.textContent = text;
  return e;
}

function button(label: string, cls = '', aria?: string): HTMLButtonElement {
  const b = h('button', { type: 'button', class: `sbh-btn ${cls}`.trim() }, label);
  if (aria) b.setAttribute('aria-label', aria);
  return b;
}

/** `[◀] value [▶]` row. prev/next carry data-step so LT/RT and ui-nav can step them. */
function stepperRow(label: string, text: () => string, onStep: (dir: -1 | 1) => void, key: string): { row: HTMLElement; refresh(): void } {
  const row = h('div', { class: 'sbh-row sbh-steprow', 'data-nav-row': '' });
  const lab = h('span', { class: 'sbh-rowlabel' }, label);
  const prev = button('◀', 'small', `Previous ${label}`);
  const next = button('▶', 'small', `Next ${label}`);
  prev.dataset.step = 'prev';
  next.dataset.step = 'next';
  prev.dataset.key = `${key}-prev`;
  next.dataset.key = `${key}-next`;
  const val = h('span', { class: 'sbh-stepval', role: 'status', 'aria-live': 'polite' });
  const refresh = () => (val.textContent = text());
  prev.addEventListener('click', () => {
    onStep(-1);
    refresh();
  });
  next.addEventListener('click', () => {
    onStep(1);
    refresh();
  });
  refresh();
  row.append(lab, prev, val, next);
  return { row, refresh };
}

export interface PauseMenuDeps {
  input: Input;
  canEditLook(): boolean;
  openCreator(): void;
  openControls(): void;
  cycleRegion(dir: -1 | 1): void;
  cycleTod(dir: -1 | 1): void;
  regionLabel(): string;
  todLabel(): string;
}

abstract class Overlay {
  readonly el: HTMLElement;
  protected captureKey: string;
  constructor(
    protected input: Input,
    id: string,
    label: string,
    captureKey: string,
  ) {
    this.captureKey = captureKey;
    this.el = h('div', { id, class: 'sbh-overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': label });
    document.body.append(this.el);
  }
  get isOpen(): boolean {
    return this.el.classList.contains('open');
  }
  protected show(): void {
    this.el.classList.add('open');
    this.input.capture(this.captureKey);
  }
  close(): void {
    if (!this.isOpen) return;
    this.el.classList.remove('open');
    this.input.release(this.captureKey);
  }
}

export class PauseMenu extends Overlay {
  private region!: ReturnType<typeof stepperRow>;
  private tod!: ReturnType<typeof stepperRow>;
  private creatorBtn!: HTMLButtonElement;
  private resumeBtn!: HTMLButtonElement;
  controlsBtn!: HTMLButtonElement;

  constructor(private deps: PauseMenuDeps) {
    super(deps.input, 'sbh-menu', 'Pause menu', 'menu');
    const panel = h('div', { class: 'sbh-panel sbh-menupanel' });
    panel.append(h('h1', { class: 'sbh-title' }, 'Paused'));
    const list = h('div', { class: 'sbh-list' });

    this.resumeBtn = button('Resume', 'primary');
    this.resumeBtn.dataset.navDefault = '';
    this.resumeBtn.addEventListener('click', () => this.close());
    const controls = (this.controlsBtn = button('Controls'));
    controls.addEventListener('click', () => deps.openControls());
    this.creatorBtn = button('Character Creator');
    this.creatorBtn.addEventListener('click', () => {
      this.close();
      deps.openCreator();
    });
    this.region = stepperRow('Region', deps.regionLabel, deps.cycleRegion, 'region');
    this.tod = stepperRow('Time of day', deps.todLabel, deps.cycleTod, 'tod');
    const audio = button('Audio (coming soon)');
    audio.disabled = true;
    audio.title = 'Audio settings arrive with the sound system';

    list.append(this.resumeBtn, controls, this.creatorBtn, this.region.row, this.tod.row, audio);
    panel.append(list, h('p', { class: 'sbh-note' }, 'Region / time of day are debug helpers: they only change your own view.'));
    this.el.append(panel);
    this.el.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen && !document.getElementById('sbh-controls')?.classList.contains('open')) {
        e.preventDefault();
        this.close();
      }
    });
  }

  open(): void {
    if (this.isOpen) return;
    this.creatorBtn.disabled = !this.deps.canEditLook();
    this.region.refresh();
    this.tod.refresh();
    this.show();
    this.resumeBtn.focus();
  }
  toggle(): void {
    if (this.isOpen) this.close();
    else this.open();
  }
}

type Listen = { dev: Device; action: ActionId; slot: number | 'add'; startedAt: number; pending?: { token: string; conflicts: ActionId[] } };

export class ControlsScreen extends Overlay {
  private table = h('div', { class: 'sbh-table' });
  private settings = h('div', { class: 'sbh-settings' });
  private status = h('div', { class: 'sbh-status', role: 'status', 'aria-live': 'polite' });
  private padLine = h('p', { class: 'sbh-note' });
  private listening: Listen | null = null;
  private keyHandler = (e: KeyboardEvent) => this.onKey(e);
  private lastFocusKey = '';

  constructor(
    input: Input,
    private onClose: () => void = () => {},
  ) {
    super(input, 'sbh-controls', 'Controls', 'controls');
    const panel = h('div', { class: 'sbh-panel sbh-ctlpanel' });
    panel.append(h('h1', { class: 'sbh-title' }, 'Controls'), this.padLine, this.table, this.settings, this.status);
    const actions = h('div', { class: 'sbh-actions' });
    const rk = button('Reset keyboard');
    const rp = button('Reset gamepad');
    const ra = button('Reset all');
    const back = button('Back', 'primary');
    back.dataset.key = 'back';
    rk.addEventListener('click', () => this.apply(resetDevice(this.input.store.cfg, 'kb'), 'Keyboard bindings reset.'));
    rp.addEventListener('click', () => this.apply(resetDevice(this.input.store.cfg, 'pad'), 'Gamepad bindings reset.'));
    ra.addEventListener('click', () => this.apply(resetAll(this.input.store.cfg), 'All controls reset to defaults.'));
    back.addEventListener('click', () => this.back());
    actions.append(rk, rp, ra, back);
    panel.append(actions);
    this.el.append(panel);
    this.el.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !this.listening) {
        e.preventDefault();
        this.back();
      }
    });
    this.input.store.subscribe(() => this.isOpen && this.render());
  }

  get busy(): boolean {
    return this.listening !== null;
  }

  open(): void {
    if (this.isOpen) return;
    this.say('');
    this.show();
    this.render();
    (this.el.querySelector('.sbh-chip') as HTMLElement | null)?.focus();
  }

  back(): void {
    if (this.listening) return this.stopListening('Cancelled.');
    this.close();
    this.onClose();
  }

  private say(msg: string, err = false): void {
    this.status.textContent = msg;
    this.status.classList.toggle('err', err);
  }

  private apply(cfg: ReturnType<typeof cloneConfig>, msg: string): void {
    this.input.store.set(cfg);
    this.say(msg);
  }

  private kind(): PadKind {
    return this.input.pads.active?.kind ?? 'xbox';
  }

  /** Re-render after a pad connects/disconnects or the device kind changes. */
  refresh(): void {
    if (this.isOpen) this.render();
  }

  private render(): void {
    const cfg = this.input.store.cfg;
    const kind = this.kind();
    const active = this.input.pads.active;
    this.padLine.textContent = active
      ? `Controller: ${active.name}${active.mapping === 'standard' ? '' : ' (non-standard mapping: check ?pad=debug)'}`
      : 'No controller detected yet. Press any button on your controller to wake it up.';

    const focusKey = (document.activeElement as HTMLElement | null)?.dataset?.key ?? this.lastFocusKey;
    const head = h('div', { class: 'sbh-row sbh-headrow' });
    head.append(h('span', { class: 'sbh-rowlabel' }, 'Action'), h('span', { class: 'sbh-cell' }, 'Keyboard'), h('span', { class: 'sbh-cell' }, `Gamepad (${active ? active.name : 'Xbox layout'})`));
    this.table.replaceChildren(head);
    for (const a of ACTIONS) {
      const row = h('div', { class: 'sbh-row', 'data-nav-row': '' });
      row.append(h('span', { class: 'sbh-rowlabel' }, a.label));
      for (const dev of ['kb', 'pad'] as Device[]) {
        const cell = h('span', { class: 'sbh-cell' });
        const toks = cfg.bindings[dev][a.id];
        toks.forEach((tok, slot) => {
          const chip = h('button', { type: 'button', class: 'sbh-chip', 'data-key': `${dev}-${a.id}-${slot}` });
          const name = tokenName(dev, kind, tok);
          chip.setAttribute('aria-label', `${a.label}, ${dev === 'kb' ? 'keyboard' : 'gamepad'} binding ${slot + 1}: ${name}. Activate to rebind.`);
          chip.append(tokenEl(dev, kind, tok));
          if (this.listening && this.listening.dev === dev && this.listening.action === a.id && this.listening.slot === slot) chip.classList.add('listening');
          chip.addEventListener('click', () => this.startListening(dev, a.id, slot));
          cell.append(chip);
        });
        if (toks.length === 0) cell.append(h('span', { class: 'sbh-unbound' }, 'unbound'));
        if (toks.length < MAX_SLOTS) {
          const add = h('button', { type: 'button', class: 'sbh-chip add', 'data-key': `${dev}-${a.id}-add` }, '+');
          add.setAttribute('aria-label', `${a.label}: add ${dev === 'kb' ? 'keyboard' : 'gamepad'} binding`);
          if (this.listening && this.listening.dev === dev && this.listening.action === a.id && this.listening.slot === 'add') add.classList.add('listening');
          add.addEventListener('click', () => this.startListening(dev, a.id, 'add'));
          cell.append(add);
        }
        row.append(cell);
      }
      this.table.append(row);
    }

    const dz = stepperRow(
      'Stick deadzone',
      () => `${Math.round(this.input.store.cfg.settings.deadzone * 100)}%`,
      (d) => this.input.store.patchSettings({ deadzone: clampDeadzone(this.input.store.cfg.settings.deadzone + d * DEADZONE_STEP) }),
      'dz',
    );
    const run = stepperRow(
      'Run mode',
      () => (this.input.store.cfg.settings.runToggle ? 'Toggle' : 'Hold'),
      () => this.input.store.patchSettings({ runToggle: !this.input.store.cfg.settings.runToggle }),
      'run',
    );
    const rum = stepperRow(
      'Rumble',
      () => (this.input.store.cfg.settings.rumble ? 'On' : 'Off'),
      () => this.input.store.patchSettings({ rumble: !this.input.store.cfg.settings.rumble }),
      'rumble',
    );
    this.settings.replaceChildren(dz.row, run.row, rum.row);

    if (focusKey) (this.el.querySelector(`[data-key="${focusKey}"]`) as HTMLElement | null)?.focus();
  }

  // ---- listening for a new binding ------------------------------------------------------------
  private startListening(dev: Device, action: ActionId, slot: number | 'add'): void {
    this.listening = { dev, action, slot, startedAt: performance.now() };
    this.lastFocusKey = `${dev}-${action}-${slot}`;
    window.addEventListener('keydown', this.keyHandler, true);
    this.say(
      dev === 'kb'
        ? `Press a key for "${actionLabel(action)}". Esc cancels, Delete removes this slot.`
        : `Press a button or push a stick for "${actionLabel(action)}" on your controller. Waiting...`,
    );
    this.render();
  }

  private stopListening(msg = ''): void {
    window.removeEventListener('keydown', this.keyHandler, true);
    this.listening = null;
    this.say(msg);
    this.render();
  }

  private onKey(e: KeyboardEvent): void {
    const l = this.listening;
    if (!l) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (e.repeat) return;
    if (e.code === 'Escape') return this.stopListening('Cancelled.');
    if (l.dev === 'pad') return; // keyboard can only cancel a gamepad capture
    if ((e.code === 'Delete' || e.code === 'Backspace') && l.slot !== 'add') {
      const r = unbindSlot(this.input.store.cfg, 'kb', l.action, l.slot);
      if (r.ok) {
        this.input.store.set(r.config);
        this.stopListening('Binding removed.');
      } else this.say('Keep at least one binding for the pause menu.', true);
      return;
    }
    this.tryBind(e.code);
  }

  /** Called every tick (via Input.onTick) so a gamepad press can complete a capture. */
  tick(now: number): void {
    const l = this.listening;
    if (!l || l.dev !== 'pad') return;
    if (now - l.startedAt > 8000) return this.stopListening('Timed out.');
    const t = this.input.pads.active;
    if (!t || now - l.startedAt < 150) return;
    const tok = captureToken(t);
    if (tok) this.tryBind(tok);
  }

  private tryBind(token: string): void {
    const l = this.listening;
    if (!l) return;
    const cfg = this.input.store.cfg;
    const swap = l.pending?.token === token;
    const r = bindToken(cfg, l.dev, l.action, token, l.slot, swap);
    const name = tokenName(l.dev, this.kind(), token);
    if (r.ok) {
      this.input.store.set(r.config);
      const note = r.displaced.length ? ` (taken from ${r.displaced.map(actionLabel).join(', ')})` : '';
      this.stopListening(`${actionLabel(l.action)} = ${name}${note}.`);
      return;
    }
    if (r.reason === 'conflict') {
      l.pending = { token, conflicts: r.conflicts };
      l.startedAt = performance.now();
      this.say(`${name} is already ${r.conflicts.map(actionLabel).join(' / ')}. Press it again to swap, or press something else.`, true);
    } else if (r.reason === 'full') this.say(`At most ${MAX_SLOTS} bindings per action. Rebind an existing one instead.`, true);
    else if (r.reason === 'last-menu') this.say('The pause menu must keep at least one binding on each device.', true);
    else this.say('That input cannot be bound.', true);
  }
}

// ---- first-join hint -----------------------------------------------------------------------------

export class ControlsHint {
  private el = h('div', { id: 'sbh-hint', role: 'note', 'aria-label': 'Controls hint' });
  private timer = 0;
  private shown = false;

  constructor(private input: Input) {
    this.el.hidden = true;
    document.body.append(this.el);
  }

  /** Show once per browser profile (until dismissed / timed out). */
  showFirstTime(): void {
    if (this.input.store.cfg.settings.hintSeen) return;
    this.shown = true;
    this.el.hidden = false;
    this.render();
    clearTimeout(this.timer);
    this.timer = window.setTimeout(() => this.dismiss(), 16000);
  }

  dismiss(): void {
    if (!this.shown) return;
    this.shown = false;
    this.el.hidden = true;
    clearTimeout(this.timer);
    this.input.store.patchSettings({ hintSeen: true });
  }

  refresh(): void {
    if (this.shown) this.render();
  }

  private render(): void {
    const dev: Device = this.input.lastDevice;
    const kind = this.input.pads.active?.kind ?? 'xbox';
    const b = this.input.store.cfg.bindings[dev];
    const parts: [ActionId, string][] = [
      ['jump', 'Jump'],
      ['run', 'Run'],
      ['crouch', 'Crouch'],
      ['action', 'Action'],
      ['menu', 'Menu'],
    ];
    const items: HTMLElement[] = [];
    for (const [a, text] of parts) {
      const tok = b[a][0];
      if (tok) items.push(hintEl(dev, kind, tok, text));
    }
    const close = button('×', 'small', 'Dismiss controls hint');
    close.addEventListener('click', () => this.dismiss());
    this.el.replaceChildren(...items, close);
  }
}

// ---- ?pad=debug overlay ----------------------------------------------------------------------------

const BIT_NAMES: [string, number][] = [
  ['LEFT', BIT.LEFT],
  ['RIGHT', BIT.RIGHT],
  ['JUMP', BIT.JUMP],
  ['RUN', BIT.RUN],
  ['CROUCH', BIT.CROUCH],
  ['ACTION', BIT.ACTION],
];
const STD_NAMES = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'Back', 'Start', 'L3', 'R3', 'Up', 'Down', 'Left', 'Right', 'Home'];

export class PadDebug {
  private el = h('pre', { id: 'sbh-paddebug', 'aria-label': 'Gamepad debug' });
  private n = 0;
  private events: string[] = [];
  constructor(private input: Input) {
    document.body.append(this.el);
    gameEvents.on('*', (name) => {
      this.events.push(`${(performance.now() / 1000).toFixed(1)}s ${name}`);
      if (this.events.length > 5) this.events.shift();
    });
  }
  tick(): void {
    if (++this.n % 4) return;
    const pads = this.input.pads.list();
    const f = (v: number) => (v >= 0 ? ' ' : '') + v.toFixed(2);
    const L: string[] = [`SBH pad debug   device: ${this.input.lastDevice}   captured: ${this.input.captured}`];
    if (!pads.length) L.push('No pads. Press a button on your controller (browsers hide pads until the first press).');
    for (const { tracker: t, raw } of pads) {
      const act = this.input.pads.active === t ? '  <== ACTIVE' : '';
      L.push('', `#${raw.index} ${raw.id}${act}`);
      L.push(`mapping="${raw.mapping}" kind=${t.kind} profile=${t.profile} buttons=${raw.buttons.length} axes=${raw.axes.length}`);
      L.push(`haptics: ${(raw.vibrationActuator as { playEffect?: unknown } | undefined)?.playEffect ? 'dual-rumble' : raw.hapticActuators ? 'legacy pulse' : 'none'}`);
      L.push('raw buttons: ' + raw.buttons.map((b, i) => `${i}${b.pressed ? '*' : ''}:${b.value.toFixed(2)}`).join(' '));
      L.push('raw axes:    ' + raw.axes.map((a, i) => `${i}:${f(a)}`).join('  '));
      L.push('std down:    ' + (t.down.map((d, i) => (d ? STD_NAMES[i] : '')).filter(Boolean).join(' ') || '-'));
      L.push('stick dirs:  ' + (Object.entries(t.dirs).filter(([, v]) => v).map(([k]) => k).join(' ') || '-'));
      const m = t.move;
      L.push(`move: x=${f(m.x)} y=${f(m.y)} mag=${m.mag.toFixed(2)}   deadzone ${(this.input.store.cfg.settings.deadzone * 100) | 0}%   LT=${t.value[STD.LT].toFixed(2)} RT=${t.value[STD.RT].toFixed(2)}`);
    }
    const mask = this.input.lastMask;
    L.push('', `sent mask: ${mask} = ${BIT_NAMES.filter(([, b]) => mask & b).map(([n]) => n).join('|') || '-'}`);
    L.push(`events: ${this.events.join(', ') || '-'}`);
    this.el.textContent = L.join('\n');
  }
}
