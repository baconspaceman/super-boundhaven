// Button glyphs, drawn procedurally (inline SVG / styled spans). No external assets.
// `padGlyph` / `keyLabel` are pure (unit-tested); `glyphEl` / `tokenEl` build DOM.
import type { PadKind } from './gamepad';

export type GlyphShape = 'face' | 'cross' | 'circle' | 'square' | 'triangle' | 'pill';
export interface GlyphSpec {
  shape: GlyphShape;
  /** Text shown (face letters, "LB", "Menu"...). For PS symbols this is the accessible name (Cross, Circle, ...). */
  label: string;
  /** Accent color for face buttons. */
  color?: string;
}

const XBOX_FACE: GlyphSpec[] = [
  { shape: 'face', label: 'A', color: '#6cc04a' },
  { shape: 'face', label: 'B', color: '#e0443e' },
  { shape: 'face', label: 'X', color: '#3b82f6' },
  { shape: 'face', label: 'Y', color: '#f2c230' },
];
const PS_FACE: GlyphSpec[] = [
  { shape: 'cross', label: 'Cross', color: '#6fa8ff' },
  { shape: 'circle', label: 'Circle', color: '#ff6b6b' },
  { shape: 'square', label: 'Square', color: '#e58bd8' },
  { shape: 'triangle', label: 'Triangle', color: '#5fd6a6' },
];
// Switch lettering is positional-swapped vs Xbox: the south button is B, east is A, west is Y, north is X.
const SWITCH_FACE: GlyphSpec[] = ['B', 'A', 'Y', 'X'].map((l) => ({ shape: 'face' as const, label: l, color: '#c9ccd8' }));
const GENERIC_FACE: GlyphSpec[] = ['A', 'B', 'X', 'Y'].map((l) => ({ shape: 'face' as const, label: l, color: '#c9ccd8' }));

const SHOULDER: Record<PadKind, [string, string]> = { xbox: ['LB', 'RB'], playstation: ['L1', 'R1'], switch: ['L', 'R'], generic: ['LB', 'RB'] };
const TRIGGER: Record<PadKind, [string, string]> = { xbox: ['LT', 'RT'], playstation: ['L2', 'R2'], switch: ['ZL', 'ZR'], generic: ['LT', 'RT'] };
const BACK: Record<PadKind, string> = { xbox: 'View', playstation: 'Share', switch: '-', generic: 'Back' };
const START: Record<PadKind, string> = { xbox: 'Menu', playstation: 'Options', switch: '+', generic: 'Start' };
const STICK: Record<PadKind, [string, string]> = { xbox: ['LS', 'RS'], playstation: ['L3', 'R3'], switch: ['L3', 'R3'], generic: ['L3', 'R3'] };
const HOME: Record<PadKind, string> = { xbox: 'Xbox', playstation: 'PS', switch: 'Home', generic: 'Home' };
const ARROWS: Record<string, string> = { '12': '↑', '13': '↓', '14': '←', '15': '→' };
const DIR_ARROW: Record<string, string> = { '-': '←', '+': '→' };

/** Glyph for a gamepad binding token ("b0", "lx-", ...) on a given controller family. */
export function padGlyph(kind: PadKind, token: string): GlyphSpec {
  const face = kind === 'playstation' ? PS_FACE : kind === 'switch' ? SWITCH_FACE : kind === 'xbox' ? XBOX_FACE : GENERIC_FACE;
  if (token[0] === 'b') {
    const i = Number(token.slice(1));
    if (i >= 0 && i <= 3) return face[i];
    if (i === 4 || i === 5) return { shape: 'pill', label: SHOULDER[kind][i - 4] };
    if (i === 6 || i === 7) return { shape: 'pill', label: TRIGGER[kind][i - 6] };
    if (i === 8) return { shape: 'pill', label: BACK[kind] };
    if (i === 9) return { shape: 'pill', label: START[kind] };
    if (i === 10 || i === 11) return { shape: 'pill', label: `${STICK[kind][i - 10]}` };
    if (i >= 12 && i <= 15) return { shape: 'pill', label: `D${ARROWS[String(i)]}` };
    if (i === 16) return { shape: 'pill', label: HOME[kind] };
  }
  const m = /^([lr])([xy])([+-])$/.exec(token);
  if (m) {
    const side = m[1] === 'l' ? 'L' : 'R';
    const arrow = m[2] === 'x' ? DIR_ARROW[m[3]] : m[3] === '-' ? '↑' : '↓';
    return { shape: 'pill', label: `${side}${arrow}` };
  }
  return { shape: 'pill', label: token };
}

/** Plain-text name for toasts / aria-labels: "A", "Cross", "LT", "Left stick left". */
export function padTokenName(kind: PadKind, token: string): string {
  const g = padGlyph(kind, token);
  const m = /^([lr])([xy])([+-])$/.exec(token);
  if (m) {
    const dir = m[2] === 'x' ? (m[3] === '-' ? 'left' : 'right') : m[3] === '-' ? 'up' : 'down';
    return `${m[1] === 'l' ? 'Left' : 'Right'} stick ${dir}`;
  }
  if (token === 'b12' || token === 'b13' || token === 'b14' || token === 'b15') {
    const dir = { b12: 'up', b13: 'down', b14: 'left', b15: 'right' }[token];
    return `D-pad ${dir}`;
  }
  return g.label;
}

const KEY_NAMES: Record<string, string> = {
  ArrowLeft: '←',
  ArrowRight: '→',
  ArrowUp: '↑',
  ArrowDown: '↓',
  Space: 'Space',
  Enter: 'Enter',
  NumpadEnter: 'Num Enter',
  Escape: 'Esc',
  ShiftLeft: 'Shift',
  ShiftRight: 'R-Shift',
  ControlLeft: 'Ctrl',
  ControlRight: 'R-Ctrl',
  AltLeft: 'Alt',
  AltRight: 'R-Alt',
  Tab: 'Tab',
  Backspace: 'Bksp',
  Delete: 'Del',
  Comma: ',',
  Period: '.',
  Slash: '/',
  Backslash: '\\',
  Semicolon: ';',
  Quote: "'",
  BracketLeft: '[',
  BracketRight: ']',
  Backquote: '`',
  Minus: '-',
  Equal: '=',
  CapsLock: 'Caps',
};

/** Short keycap text for a KeyboardEvent.code. */
export function keyLabel(code: string): string {
  if (KEY_NAMES[code]) return KEY_NAMES[code];
  let m = /^Key([A-Z])$/.exec(code);
  if (m) return m[1];
  m = /^Digit(\d)$/.exec(code);
  if (m) return m[1];
  m = /^Numpad(\w+)$/.exec(code);
  if (m) return `Num${m[1].replace('Add', '+').replace('Subtract', '-').replace('Multiply', '*').replace('Divide', '/').replace('Decimal', '.')}`;
  return code;
}

/** Accessible name for any binding token. */
export function tokenName(dev: 'kb' | 'pad', kind: PadKind, token: string): string {
  return dev === 'kb' ? keyLabel(token) : padTokenName(kind, token);
}

// ---- DOM builders -------------------------------------------------------------------------------

const SVG_NS = 'http://www.w3.org/2000/svg';
function svgEl<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string>): SVGElementTagNameMap[K] {
  const e = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}

/** A glyph element (inline SVG for face buttons, styled pill for everything else). */
export function glyphEl(spec: GlyphSpec): HTMLElement {
  const wrap = document.createElement('span');
  wrap.className = `sbh-glyph sbh-glyph-${spec.shape}`;
  wrap.setAttribute('role', 'img');
  wrap.setAttribute('aria-label', spec.label);
  if (spec.shape === 'pill') {
    wrap.textContent = spec.label;
    return wrap;
  }
  const c = spec.color ?? '#c9ccd8';
  const svg = svgEl('svg', { viewBox: '0 0 20 20', width: '20', height: '20', 'aria-hidden': 'true', focusable: 'false' });
  svg.append(svgEl('circle', { cx: '10', cy: '10', r: '9', fill: '#10102a', stroke: spec.shape === 'face' ? '#8c90b5' : '#8c90b5', 'stroke-width': '1.5' }));
  switch (spec.shape) {
    case 'face': {
      const t = svgEl('text', { x: '10', y: '14.2', 'text-anchor': 'middle', 'font-size': '12', 'font-weight': '700', fill: c, 'font-family': 'monospace' });
      t.textContent = spec.label;
      svg.append(t);
      break;
    }
    case 'cross':
      svg.append(svgEl('path', { d: 'M6 6 L14 14 M14 6 L6 14', stroke: c, 'stroke-width': '2.2', 'stroke-linecap': 'square', fill: 'none' }));
      break;
    case 'circle':
      svg.append(svgEl('circle', { cx: '10', cy: '10', r: '4.4', stroke: c, 'stroke-width': '2', fill: 'none' }));
      break;
    case 'square':
      svg.append(svgEl('rect', { x: '5.8', y: '5.8', width: '8.4', height: '8.4', stroke: c, 'stroke-width': '2', fill: 'none' }));
      break;
    case 'triangle':
      svg.append(svgEl('path', { d: 'M10 5 L15 13.6 L5 13.6 Z', stroke: c, 'stroke-width': '2', 'stroke-linejoin': 'miter', fill: 'none' }));
      break;
  }
  wrap.append(svg);
  return wrap;
}

export function keycapEl(code: string): HTMLElement {
  const k = document.createElement('kbd');
  k.className = 'sbh-keycap';
  k.textContent = keyLabel(code);
  k.setAttribute('aria-label', keyLabel(code));
  return k;
}

/** Glyph or keycap for a binding token on a device. */
export function tokenEl(dev: 'kb' | 'pad', kind: PadKind, token: string): HTMLElement {
  return dev === 'kb' ? keycapEl(token) : glyphEl(padGlyph(kind, token));
}

/** "[glyph] Label" chip row used by hints and overlay footers. */
export function hintEl(dev: 'kb' | 'pad', kind: PadKind, token: string, text: string): HTMLElement {
  const s = document.createElement('span');
  s.className = 'sbh-hintitem';
  s.append(tokenEl(dev, kind, token), document.createTextNode(` ${text}`));
  return s;
}
