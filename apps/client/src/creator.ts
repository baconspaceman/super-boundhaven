// Character creator: full-screen HTML UI with a live animated preview. The preview is drawn from the same
// composeSheet() output (cached per look) that in-game sprites use. No game/network knowledge in here.
import './creator.css';
import {
  CHARACTER_OPTIONS,
  DEFAULT_LOOK,
  HERO_ANIMS,
  HERO_H,
  HERO_W,
  decodeLook,
  encodeLook,
  randomLook,
  validateLook,
  type CharacterLook,
} from './art';
import { getLookSheet } from './look-sheet';
import { colorTable, countOf, stepField, type ColorTable } from './look-ui';
import { TICK_MS } from './motion';

type Key = Exclude<keyof CharacterLook, 'v'>;

interface PreviewSeq {
  id: string;
  label: string;
  steps: { frame: string; ticks: number }[];
}

const fromAnim = (id: string, label: string, anim: string): PreviewSeq => ({
  id,
  label,
  steps: HERO_ANIMS[anim].frames.map((frame, i) => ({ frame, ticks: HERO_ANIMS[anim].ticks[i] })),
});

export const PREVIEW_SEQS: PreviewSeq[] = [
  fromAnim('idle', 'Idle', 'idle'),
  fromAnim('walk', 'Walk', 'walk'),
  fromAnim('run', 'Run', 'run'),
  {
    id: 'jump',
    label: 'Jump',
    steps: [
      { frame: 'hero/jump_anticip', ticks: 10 },
      { frame: 'hero/jump_rise', ticks: 22 },
      { frame: 'hero/jump_apex', ticks: 18 },
      { frame: 'hero/fall', ticks: 26 },
      { frame: 'hero/land_0', ticks: 9 },
      { frame: 'hero/land_1', ticks: 9 },
      { frame: 'hero/idle_0', ticks: 20 },
    ],
  },
  fromAnim('stomp', 'Stomp', 'stomp'),
  fromAnim('hurt', 'Hurt', 'hurt'),
];

const COLOR_LABELS: Partial<Record<Key, string>> = {
  skin: 'Skin tone',
  hairColor: 'Hair color',
  hairTintColor: 'Tint color',
  eyeColor: 'Iris color',
};

function colorLabel(key: Key, index: number, count: number): string {
  return COLOR_LABELS[key] ?? (count > 1 ? (index === 0 ? 'Primary color' : 'Secondary color') : 'Color');
}

export interface CreatorOpenOpts {
  mode: 'join' | 'edit';
  name: string;
  code: string;
  onSubmit(name: string, code: string): void;
  onCancel?(): void;
}

const SCALE = 8;
const CANVAS_W = 240;
const CANVAS_H = 300;

export class Creator {
  private look: CharacterLook = { ...DEFAULT_LOOK };
  private tab: Key = 'skin';
  private seq = 0;
  private flip = false;
  private opts: CreatorOpenOpts | null = null;
  private raf = 0;
  private t0 = 0;

  private el: HTMLElement;
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private animName!: HTMLElement;
  private chips: HTMLButtonElement[] = [];
  private tabsEl!: HTMLElement;
  private panel!: HTMLElement;
  private nameInput!: HTMLInputElement;
  private codeInput!: HTMLInputElement;
  private status!: HTMLElement;
  private submitBtn!: HTMLButtonElement;
  private cancelBtn!: HTMLButtonElement;
  private title!: HTMLElement;
  private sub!: HTMLElement;
  private flipBtn!: HTMLButtonElement;

  constructor(root: HTMLElement) {
    this.el = root;
    this.build();
  }

  get isOpen(): boolean {
    return this.el.classList.contains('open');
  }

  get code(): string {
    return encodeLook(this.look);
  }

  // ---- lifecycle -----------------------------------------------------------------------------
  open(opts: CreatorOpenOpts): void {
    this.opts = opts;
    const parsed = decodeLook(opts.code);
    this.look = parsed ?? { ...DEFAULT_LOOK };
    this.nameInput.value = opts.name;
    this.nameInput.readOnly = opts.mode === 'edit';
    this.title.textContent = opts.mode === 'join' ? 'Create your hero' : 'Change your look';
    this.sub.textContent =
      opts.mode === 'join'
        ? 'Pick a look, then jump in. You can change it any time with C.'
        : 'The game keeps running. Apply to show everyone your new look.';
    this.submitBtn.textContent = opts.mode === 'join' ? 'Play' : 'Apply';
    this.cancelBtn.hidden = opts.mode === 'join' && !opts.onCancel;
    this.el.classList.add('open');
    this.el.classList.toggle('overlay-mode', opts.mode === 'edit');
    this.setStatus('');
    this.refresh();
    this.t0 = performance.now();
    this.loop();
    (opts.mode === 'join' && !opts.name ? this.nameInput : this.submitBtn).focus();
  }

  close(): void {
    this.el.classList.remove('open');
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.opts = null;
  }

  setStatus(msg: string, err = false): void {
    this.status.textContent = msg;
    this.status.classList.toggle('err', err);
  }

  // ---- DOM ---------------------------------------------------------------------------------
  private h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, text?: string): HTMLElementTagNameMap[K] {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    if (text !== undefined) e.textContent = text;
    return e;
  }

  private btn(label: string, cls = '', aria?: string): HTMLButtonElement {
    const b = this.h('button', { type: 'button', class: `cc-btn ${cls}`.trim() }, label);
    if (aria) b.setAttribute('aria-label', aria);
    return b;
  }

  private build(): void {
    const el = this.el;
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-labelledby', 'cc-title');
    const wrap = this.h('div', { class: 'cc-wrap' });

    const head = this.h('div');
    this.title = this.h('h1', { id: 'cc-title', class: 'cc-title' }, 'Create your hero');
    this.sub = this.h('p', { class: 'cc-sub' });
    head.append(this.title, this.sub);

    // preview column
    const prev = this.h('section', { class: 'cc-panel cc-preview', 'aria-label': 'Live preview' });
    this.canvas = this.h('canvas', { width: String(CANVAS_W), height: String(CANVAS_H), role: 'img', 'aria-label': 'Animated preview of your hero' });
    this.ctx = this.canvas.getContext('2d')!;
    const animRow = this.h('div', { class: 'cc-animrow' });
    const prevAnim = this.btn('◀', 'small', 'Previous animation');
    const nextAnim = this.btn('▶', 'small', 'Next animation');
    this.animName = this.h('div', { class: 'cc-animname', 'aria-live': 'polite' });
    animRow.append(prevAnim, this.animName, nextAnim);
    const chips = this.h('div', { class: 'cc-chips', role: 'group', 'aria-label': 'Preview animation' });
    PREVIEW_SEQS.forEach((s, i) => {
      const b = this.btn(s.label, 'small');
      b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', () => this.setSeq(i));
      this.chips.push(b);
      chips.append(b);
    });
    this.flipBtn = this.btn('Flip', 'small', 'Flip facing direction');
    this.flipBtn.setAttribute('aria-pressed', 'false');
    this.flipBtn.addEventListener('click', () => {
      this.flip = !this.flip;
      this.flipBtn.setAttribute('aria-pressed', String(this.flip));
    });
    chips.append(this.flipBtn);
    prevAnim.addEventListener('click', () => this.setSeq((this.seq + PREVIEW_SEQS.length - 1) % PREVIEW_SEQS.length));
    nextAnim.addEventListener('click', () => this.setSeq((this.seq + 1) % PREVIEW_SEQS.length));
    prev.append(this.canvas, animRow, chips);

    // editor column
    const edit = this.h('section', { class: 'cc-panel', 'aria-label': 'Customize' });
    this.tabsEl = this.h('div', { class: 'cc-tabs', role: 'tablist', 'aria-label': 'Category' });
    CHARACTER_OPTIONS.categories.forEach((c) => {
      const t = this.h('button', { type: 'button', class: 'cc-tab', role: 'tab', id: `cc-tab-${c.key}`, 'aria-controls': 'cc-panel' }, c.label);
      t.addEventListener('click', () => this.setTab(c.key as Key));
      this.tabsEl.append(t);
    });
    this.tabsEl.addEventListener('keydown', (e) => this.onTabKey(e));
    this.panel = this.h('div', { id: 'cc-panel', role: 'tabpanel' });
    edit.append(this.tabsEl, this.panel);

    // bottom bar
    const bottom = this.h('div', { class: 'cc-panel cc-bottom' });
    const fields = this.h('div', { class: 'cc-fields' });
    const nf = this.h('div', { class: 'cc-field' });
    nf.append(this.h('label', { for: 'cc-name' }, 'Name'));
    this.nameInput = this.h('input', { id: 'cc-name', maxlength: '16', autocomplete: 'off', placeholder: 'Your name', spellcheck: 'false' });
    nf.append(this.nameInput);
    const cf = this.h('div', { class: 'cc-field' });
    cf.append(this.h('label', { for: 'cc-code' }, 'Look code (copy / paste to share)'));
    const cw = this.h('div', { class: 'cc-codewrap' });
    this.codeInput = this.h('input', { id: 'cc-code', autocomplete: 'off', spellcheck: 'false', 'aria-describedby': 'cc-status' });
    const copy = this.btn('Copy', 'small', 'Copy look code');
    copy.addEventListener('click', () => void this.copyCode());
    cw.append(this.codeInput, copy);
    cf.append(cw);
    fields.append(nf, cf);
    const actions = this.h('div', { class: 'cc-actions' });
    const rand = this.btn('Randomize');
    const reset = this.btn('Reset');
    this.cancelBtn = this.btn('Cancel');
    this.submitBtn = this.btn('Play', 'primary');
    actions.append(rand, reset, this.cancelBtn, this.submitBtn);
    this.status = this.h('div', { id: 'cc-status', class: 'cc-status', role: 'status' });
    const left = this.h('div');
    left.append(fields, this.status);
    bottom.append(left, actions);

    const main = this.h('div', { class: 'cc-main' });
    main.append(prev, edit);
    wrap.append(head, main, bottom);
    el.replaceChildren(wrap);

    rand.addEventListener('click', () => {
      this.look = randomLook((Math.random() * 0x7fffffff) | 0);
      this.refresh();
    });
    reset.addEventListener('click', () => {
      this.look = { ...DEFAULT_LOOK };
      this.refresh();
    });
    this.codeInput.addEventListener('input', () => this.onCodeInput());
    this.codeInput.addEventListener('paste', () => setTimeout(() => this.onCodeInput(), 0));
    this.submitBtn.addEventListener('click', () => this.submit());
    this.cancelBtn.addEventListener('click', () => this.cancel());
    this.nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.submit();
    });
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.opts?.mode === 'edit') {
        e.preventDefault();
        this.cancel();
      }
    });
    this.setSeq(0);
  }

  // ---- actions ---------------------------------------------------------------------------------
  private submit(): void {
    if (!this.opts) return;
    const name = this.nameInput.value.trim().slice(0, 16);
    if (!name) {
      this.setStatus('Enter a name first.', true);
      this.nameInput.focus();
      return;
    }
    const problems = validateLook(this.look);
    if (problems.length) return this.setStatus(problems[0], true);
    this.opts.onSubmit(name, this.code);
  }

  private cancel(): void {
    const cb = this.opts?.onCancel;
    this.close();
    cb?.();
  }

  private onCodeInput(): void {
    const v = this.codeInput.value.trim();
    if (!v) return;
    const parsed = decodeLook(v);
    if (!parsed) {
      this.setStatus('That look code is not valid.', true);
      return;
    }
    this.look = parsed;
    this.setStatus('Look code loaded.');
    this.refresh(true);
  }

  private async copyCode(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.code);
      this.setStatus('Look code copied.');
    } catch {
      this.codeInput.select();
      this.setStatus('Press Ctrl+C to copy the selected code.');
    }
  }

  private setSeq(i: number): void {
    this.seq = i;
    this.t0 = performance.now();
    this.animName.textContent = PREVIEW_SEQS[i].label;
    this.chips.forEach((b, j) => b.setAttribute('aria-pressed', String(j === i)));
  }

  private setTab(key: Key, focus = false): void {
    this.tab = key;
    this.renderTabs();
    this.renderPanel();
    if (focus) document.getElementById(`cc-tab-${key}`)?.focus();
  }

  private onTabKey(e: KeyboardEvent): void {
    const keys = CHARACTER_OPTIONS.categories.map((c) => c.key as Key);
    const i = keys.indexOf(this.tab);
    let n = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') n = (i + 1) % keys.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') n = (i + keys.length - 1) % keys.length;
    else if (e.key === 'Home') n = 0;
    else if (e.key === 'End') n = keys.length - 1;
    if (n < 0) return;
    e.preventDefault();
    this.setTab(keys[n], true);
  }

  private step(key: Key, dir: number): void {
    this.look = stepField(this.look, key, dir);
    this.refresh();
  }

  private pick(key: Key, v: number): void {
    this.look = { ...this.look, [key]: v };
    this.refresh();
    (this.panel.querySelector(`#cc-g-${key}`)?.nextElementSibling?.querySelector('[aria-checked="true"]') as HTMLElement | null)?.focus();
  }

  // ---- rendering ---------------------------------------------------------------------------------
  /** Re-render editor widgets for the current look. */
  private refresh(keepCode = false): void {
    if (!keepCode) this.codeInput.value = this.code;
    this.renderTabs();
    this.renderPanel();
  }

  private renderTabs(): void {
    for (const t of this.tabsEl.children) {
      const on = t.id === `cc-tab-${this.tab}`;
      t.setAttribute('aria-selected', String(on));
      t.setAttribute('tabindex', on ? '0' : '-1');
    }
    this.panel.setAttribute('aria-labelledby', `cc-tab-${this.tab}`);
  }

  private renderPanel(): void {
    const cat = CHARACTER_OPTIONS.categories.find((c) => c.key === this.tab)!;
    const key = cat.key as Key;
    const n = cat.names.length;
    const cur = this.look[key];
    const focusedStep = document.activeElement?.getAttribute('data-step');
    const frag = document.createDocumentFragment();

    // stepper
    const row = this.h('div', { class: 'cc-stepper' });
    const prev = this.btn('◀', '', `Previous ${cat.label}`);
    const next = this.btn('▶', '', `Next ${cat.label}`);
    prev.dataset.step = 'prev';
    next.dataset.step = 'next';
    const val = this.h('div', {
      class: 'cc-stepval',
      role: 'spinbutton',
      tabindex: '0',
      'aria-label': cat.label,
      'aria-valuemin': '1',
      'aria-valuemax': String(n),
      'aria-valuenow': String(cur + 1),
      'aria-valuetext': cat.names[cur],
    });
    val.dataset.step = 'val';
    val.append(this.h('b', {}, cat.names[cur]), this.h('span', {}, `${cur + 1} / ${n}`));
    prev.addEventListener('click', () => this.step(key, -1));
    next.addEventListener('click', () => this.step(key, 1));
    val.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
        e.preventDefault();
        this.step(key, -1);
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
        e.preventDefault();
        this.step(key, 1);
      }
    });
    row.append(prev, val, next);
    frag.append(row);

    // color groups
    const table: ColorTable = key === 'skin' ? 'skin' : (cat.colorTable ?? 'item');
    const keys: Key[] = key === 'skin' ? ['skin'] : (cat.colorKeys as Key[]);
    const colors = keys.length ? colorTable(table) : [];
    keys.forEach((ck, i) => {
      const label = colorLabel(ck, i, keys.length);
      const g = this.h('div', { class: 'cc-group' });
      g.append(this.h('h3', { id: `cc-g-${ck}` }, `${label}: ${colors[this.look[ck]].name}`));
      const sw = this.h('div', { class: 'cc-swatches', role: 'radiogroup', 'aria-labelledby': `cc-g-${ck}` });
      colors.forEach((c, v) => {
        const on = this.look[ck] === v;
        const b = this.h('button', {
          type: 'button',
          class: 'cc-sw',
          role: 'radio',
          'aria-checked': String(on),
          'aria-label': `${label}: ${c.name}`,
          title: c.name,
          tabindex: on ? '0' : '-1',
        });
        b.style.background = c.hex;
        b.addEventListener('click', () => this.pick(ck, v));
        sw.append(b);
      });
      sw.addEventListener('keydown', (e) => {
        const cnt = countOf(ck);
        const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
        if (!d) return;
        e.preventDefault();
        this.pick(ck, (this.look[ck] + d + cnt) % cnt);
      });
      g.append(sw);
      frag.append(g);
    });
    if (key === 'hairTint' && this.look.hairTint === 0) frag.append(this.h('p', { class: 'cc-hint' }, 'Tint is off. Pick a tint style to use the tint color.'));
    if (!keys.length) frag.append(this.h('p', { class: 'cc-hint' }, `${cat.label} has no color options.`));

    this.panel.replaceChildren(frag);
    // keep keyboard focus on the same stepper control after a re-render
    if (focusedStep) (this.panel.querySelector(`[data-step="${focusedStep}"]`) as HTMLElement | null)?.focus();
  }

  // ---- preview loop ---------------------------------------------------------------------------------
  private loop = (): void => {
    if (!this.isOpen) return;
    this.draw(performance.now());
    this.raf = window.requestAnimationFrame(this.loop);
  };

  private draw(now: number): void {
    const ctx = this.ctx;
    const seq = PREVIEW_SEQS[this.seq];
    const total = seq.steps.reduce((a, s) => a + s.ticks, 0) * TICK_MS;
    let t = (now - this.t0) % total;
    let frame = seq.steps[0].frame;
    for (const s of seq.steps) {
      t -= s.ticks * TICK_MS;
      if (t < 0) {
        frame = s.frame;
        break;
      }
    }
    const sheet = getLookSheet(this.code);
    const a = sheet.atlas[frame];
    ctx.imageSmoothingEnabled = false;
    // backdrop: sky band + grass floor, matching the world palette
    ctx.fillStyle = '#7cc8ff';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.fillStyle = '#a8e0ff';
    ctx.fillRect(0, CANVAS_H * 0.45, CANVAS_W, CANVAS_H * 0.55);
    const floorY = 20 + HERO_H * SCALE;
    ctx.fillStyle = '#4dbb57';
    ctx.fillRect(0, floorY, CANVAS_W, CANVAS_H - floorY);
    ctx.fillStyle = '#7fe07a';
    ctx.fillRect(0, floorY, CANVAS_W, 4);
    ctx.fillStyle = '#8a5a3a';
    ctx.fillRect(0, floorY + 20, CANVAS_W, CANVAS_H - floorY - 20);
    ctx.fillStyle = 'rgba(43,35,80,0.35)';
    ctx.fillRect((CANVAS_W - 14 * SCALE) / 2, floorY + 4, 14 * SCALE, 8);
    if (!a) return;
    const x = (CANVAS_W - HERO_W * SCALE) / 2;
    ctx.save();
    if (this.flip) {
      ctx.translate(CANVAS_W, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(sheet.canvas, a.x, a.y, a.w, a.h, x, 20, HERO_W * SCALE, HERO_H * SCALE);
    ctx.restore();
  }
}
