// Gamepad (and arrow-key) navigation for HTML overlays: spatial focus movement, A = activate, B = back,
// LB/RB = tabs, LT/RT = step the focused option, right stick = scroll. Pure helpers are exported for tests.
import { STD, type Gamepads, type PadKind } from './gamepad';
import { hintEl } from './glyphs';

export type Dir = 'up' | 'down' | 'left' | 'right';
export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * Pick the best neighbor of rects[cur] in direction `dir` (index into `rects`), or -1.
 * Candidates must lie in that direction (by center); score = distance along the axis + 3x the perpendicular offset,
 * with the perpendicular offset forgiven when the two rects overlap on that axis (so rows/columns stay aligned).
 */
export function pickNext(rects: readonly Rect[], cur: number, dir: Dir): number {
  const c = rects[cur];
  if (!c) return rects.length ? 0 : -1;
  const cx = (c.left + c.right) / 2;
  const cy = (c.top + c.bottom) / 2;
  let best = -1;
  let bestScore = Infinity;
  for (let i = 0; i < rects.length; i++) {
    if (i === cur) continue;
    const r = rects[i];
    const x = (r.left + r.right) / 2;
    const y = (r.top + r.bottom) / 2;
    let along: number;
    let across: number;
    let overlap: boolean;
    if (dir === 'left' || dir === 'right') {
      along = dir === 'right' ? x - cx : cx - x;
      across = Math.abs(y - cy);
      overlap = r.top < c.bottom && r.bottom > c.top;
    } else {
      along = dir === 'down' ? y - cy : cy - y;
      across = Math.abs(x - cx);
      overlap = r.left < c.right && r.right > c.left;
    }
    if (along <= 0.5) continue;
    const score = along + (overlap ? 0 : 3) * across + (overlap ? across * 0.25 : 0);
    if (score < bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return best;
}

/** Key-repeat style gate: fires on press, then after `delay`, then every `rate` ms while held. */
export class Repeater {
  private heldSince = -1;
  private lastFire = -1;
  constructor(
    private delay = 350,
    private rate = 110,
  ) {}
  step(down: boolean, now: number): boolean {
    if (!down) {
      this.heldSince = -1;
      return false;
    }
    if (this.heldSince < 0) {
      this.heldSince = now;
      this.lastFire = now;
      return true;
    }
    if (now - this.heldSince >= this.delay && now - this.lastFire >= this.rate) {
      this.lastFire = now;
      return true;
    }
    return false;
  }
}

export interface HintItem {
  token: string; // pad token, e.g. 'b0'
  text: string;
}

export interface NavOverlay {
  id: string;
  root: HTMLElement;
  isOpen(): boolean;
  /** Higher wins when several overlays are open (controls screen > pause menu > creator). */
  priority: number;
  onBack?(): void;
  onTab?(dir: -1 | 1): void;
  /** Footer prompts shown while a pad is the last-used device. */
  hints?: HintItem[];
  /** Also let arrow keys move focus (for overlays that do not handle them natively). */
  arrowKeys?: boolean;
  /** Treat Start as Back (pause menu). */
  startBack?: boolean;
  /** While true the overlay is capturing raw input (e.g. rebinding), so navigation is paused. */
  busy?(): boolean;
}

const FOCUSABLE = 'button, input, select, textarea, [tabindex], [role="radio"], [role="tab"]';

function isVisible(el: HTMLElement): boolean {
  if (el.hidden || el.closest('[hidden], [inert]')) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
}

export function focusables(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => {
    if ((el as HTMLButtonElement).disabled || el.hasAttribute('data-nav-skip')) return false;
    const ti = el.getAttribute('tabindex');
    const role = el.getAttribute('role');
    const native = /^(BUTTON|INPUT|SELECT|TEXTAREA)$/.test(el.tagName);
    if (!native && role !== 'radio' && role !== 'tab' && (ti === null || Number(ti) < 0)) return false;
    return isVisible(el);
  });
}

function key(el: HTMLElement, k: string): void {
  el.dispatchEvent(new KeyboardEvent('keydown', { key: k, code: k, bubbles: true, cancelable: true }));
}

export class UiNav {
  private overlays: NavOverlay[] = [];
  private repeat: Record<Dir, Repeater> = { up: new Repeater(), down: new Repeater(), left: new Repeater(), right: new Repeater() };
  private topId = '';
  private bars = new Map<string, HTMLElement>();
  private barSig = '';

  constructor(
    private pads: Gamepads,
    private isPadMode: () => boolean,
  ) {}

  register(o: NavOverlay): void {
    this.overlays.push(o);
    if (o.hints) {
      const bar = document.createElement('div');
      bar.className = 'sbh-navbar';
      bar.setAttribute('aria-hidden', 'true');
      o.root.append(bar);
      this.bars.set(o.id, bar);
    }
    if (o.arrowKeys) {
      o.root.addEventListener('keydown', (e) => {
        if (e.defaultPrevented || !o.isOpen() || e.ctrlKey || e.metaKey || e.altKey) return;
        const t = e.target as HTMLElement;
        if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement) return;
        const dir = ({ ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' } as const)[e.key as 'ArrowUp'];
        if (!dir) return;
        e.preventDefault();
        this.move(o, dir);
      });
    }
  }

  get top(): NavOverlay | null {
    let best: NavOverlay | null = null;
    for (const o of this.overlays) if (o.isOpen() && (!best || o.priority > best.priority)) best = o;
    return best;
  }
  get active(): boolean {
    return this.top !== null;
  }

  /** Move focus within `o` in direction `dir`. Returns true if focus changed. */
  move(o: NavOverlay, dir: Dir): boolean {
    const els = focusables(o.root);
    if (!els.length) return false;
    const cur = els.indexOf(document.activeElement as HTMLElement);
    if (cur < 0) {
      els[0].focus();
      return true;
    }
    const next = pickNext(els.map((e) => e.getBoundingClientRect()), cur, dir);
    if (next < 0) return false;
    els[next].focus();
    els[next].scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    return true;
  }

  private ensureFocus(o: NavOverlay): void {
    const a = document.activeElement as HTMLElement | null;
    if (a && o.root.contains(a) && isVisible(a)) return;
    const def = o.root.querySelector<HTMLElement>('[data-nav-default]');
    const target = def && isVisible(def) ? def : focusables(o.root)[0];
    target?.focus();
  }

  private renderBar(o: NavOverlay): void {
    const bar = this.bars.get(o.id);
    if (!bar || !o.hints) return;
    const pad = this.pads.active;
    const kind: PadKind = pad?.kind ?? 'xbox';
    const show = this.isPadMode();
    const sig = `${o.id}|${show}|${kind}`;
    if (sig === this.barSig) return;
    this.barSig = sig;
    bar.hidden = !show;
    bar.replaceChildren(...o.hints.map((h) => hintEl('pad', kind, h.token, h.text)));
  }

  /** Call once per tick after Gamepads.poll(). */
  update(now: number): void {
    const o = this.top;
    if (!o) {
      this.topId = '';
      for (const r of Object.values(this.repeat)) r.step(false, now);
      return;
    }
    if (o.id !== this.topId) {
      this.topId = o.id;
      this.barSig = '';
      this.ensureFocus(o);
    }
    this.renderBar(o);
    const t = this.pads.active;
    if (!t || o.busy?.()) return;

    const dirs: Record<Dir, boolean> = {
      up: t.isDown(STD.UP) || t.dirs['ly-'],
      down: t.isDown(STD.DOWN) || t.dirs['ly+'],
      left: t.isDown(STD.LEFT) || t.dirs['lx-'],
      right: t.isDown(STD.RIGHT) || t.dirs['lx+'],
    };
    for (const d of ['up', 'down', 'left', 'right'] as Dir[]) {
      if (this.repeat[d].step(dirs[d], now)) this.move(o, d);
    }

    const a = document.activeElement as HTMLElement | null;
    if (t.justPressed(STD.A) && a && o.root.contains(a)) {
      if (!(a instanceof HTMLInputElement && a.type === 'text')) a.click();
    }
    if (t.justPressed(STD.B) || (o.startBack && t.justPressed(STD.START))) o.onBack?.();
    if (t.justPressed(STD.LB)) o.onTab?.(-1);
    if (t.justPressed(STD.RB)) o.onTab?.(1);
    if (t.justPressed(STD.LT) || t.justPressed(STD.RT)) this.stepFocused(o, t.justPressed(STD.LT) ? -1 : 1);

    const ry = t.stickR.analog.y;
    if (ry) o.root.scrollBy?.({ top: ry * 14 });
  }

  /** LT/RT: step the option stepper in the focused row (or the first one in the overlay). */
  private stepFocused(o: NavOverlay, dir: -1 | 1): void {
    const a = document.activeElement as HTMLElement | null;
    const scope = (a && (a.closest('[data-nav-row], .cc-stepper') as HTMLElement | null)) ?? o.root;
    const btn = scope.querySelector<HTMLElement>(`[data-step="${dir < 0 ? 'prev' : 'next'}"]`) ?? o.root.querySelector<HTMLElement>(`[data-step="${dir < 0 ? 'prev' : 'next'}"]`);
    if (btn) btn.click();
    else if (a) key(a, dir < 0 ? 'ArrowLeft' : 'ArrowRight');
  }
}

/** LB/RB helper: click the next/previous `[role=tab]` (wraps). Returns the newly selected tab. */
export function cycleTabs(root: HTMLElement, dir: -1 | 1): HTMLElement | null {
  const tabs = [...root.querySelectorAll<HTMLElement>('[role="tab"]')].filter(isVisible);
  if (!tabs.length) return null;
  const cur = Math.max(0, tabs.findIndex((t) => t.getAttribute('aria-selected') === 'true'));
  const next = tabs[(cur + dir + tabs.length) % tabs.length];
  next.click();
  return next;
}
