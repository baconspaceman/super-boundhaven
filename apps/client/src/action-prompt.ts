// "Press ACTION" glyph that floats above a lever while the local player is within reach. A small DOM overlay so the
// glyph/keycap reuses the controller-aware builders in glyphs.ts (right pad family, rebinding-aware).
import type { Input } from './input';
import { tokenEl } from './glyphs';

const STYLE = `
#sbh-prompt { position: fixed; z-index: 6; pointer-events: none; display: none; transform: translate(-50%, -100%);
  padding: 2px 5px; background: rgba(20,16,42,.82); border: 2px solid #ffd84a; border-radius: 4px; color: #f6f3ff;
  font: 11px monospace; white-space: nowrap; animation: sbh-bob 0.9s ease-in-out infinite alternate; }
#sbh-prompt .sbh-glyph, #sbh-prompt kbd { vertical-align: middle; margin-right: 3px; }
@keyframes sbh-bob { from { margin-top: 0; } to { margin-top: -3px; } }
`;

export class ActionPrompt {
  private el = document.createElement('div');
  private key = '';
  private shown = false;

  constructor(private input: Input) {
    this.el.id = 'sbh-prompt';
    this.el.setAttribute('role', 'note');
    const st = document.createElement('style');
    st.textContent = STYLE;
    document.head.append(st);
    document.body.append(this.el);
  }

  /** screen = canvas-space position of the point above the lever (or null to hide). */
  update(screen: { x: number; y: number } | null, label = 'Pull'): void {
    if (!screen) {
      if (this.shown) {
        this.el.style.display = 'none';
        this.shown = false;
      }
      return;
    }
    const dev = this.input.lastDevice;
    const kind = this.input.pads.active?.kind ?? 'xbox';
    const tok = this.input.store.cfg.bindings[dev].action[0];
    const key = `${dev}|${kind}|${tok}|${label}`;
    if (key !== this.key) {
      this.key = key;
      this.el.replaceChildren();
      if (tok) this.el.append(tokenEl(dev, kind, tok));
      this.el.append(document.createTextNode(label));
    }
    this.el.style.left = `${Math.round(screen.x)}px`;
    this.el.style.top = `${Math.round(screen.y)}px`;
    if (!this.shown) {
      this.el.style.display = 'block';
      this.shown = true;
    }
  }

  /** Test/debug: the text currently shown ('' when hidden). */
  get text(): string {
    return this.shown ? (this.el.textContent ?? '') : '';
  }
}
