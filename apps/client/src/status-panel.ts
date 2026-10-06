// In-game mini-status in the pixel font (top-right of the 256x224 playfield): shards, flag, deaths, players in the
// room, and "NEEDS n PLAYERS" while a co-op room lacks its minimum. Rebuilt only when the text changes.
import { Container, Graphics, Sprite } from 'pixi.js';
import { VIEW_W } from './viewport';
import { makeLabel, type Label } from './sprites';

const PAD = 3;
const LINE_H = 9;
const COLORS: Record<string, string> = { default: '#f6f3ff', warn: '#ffd84a' };

export class StatusPanel {
  readonly root = new Container();
  private bg = new Graphics();
  private rows: { sprite: Sprite; label: Label }[] = [];
  private key = '';

  constructor() {
    this.root.addChild(this.bg);
    this.root.eventMode = 'none';
  }

  private clear(): void {
    for (const r of this.rows) {
      r.sprite.destroy();
      r.label.tex.destroy(true);
    }
    this.rows.length = 0;
  }

  /** Lines starting with '!' are drawn in the warning color. Empty list hides the panel. */
  set(lines: string[]): void {
    const key = lines.join('\n');
    if (key === this.key) return;
    this.key = key;
    this.clear();
    this.bg.clear();
    this.root.visible = lines.length > 0;
    if (!lines.length) return;
    let w = 0;
    lines.forEach((ln, i) => {
      const warn = ln.startsWith('!');
      const label = makeLabel(warn ? ln.slice(1) : ln, warn ? COLORS.warn : COLORS.default);
      const sprite = new Sprite(label.tex);
      sprite.anchor.set(1, 0);
      sprite.position.set(VIEW_W - PAD - 2, PAD + 1 + i * LINE_H);
      this.root.addChild(sprite);
      this.rows.push({ sprite, label });
      w = Math.max(w, label.w);
    });
    const h = lines.length * LINE_H + 2;
    this.bg
      .roundRect(VIEW_W - PAD - w - 6, PAD - 1, w + 6, h + 1, 2)
      .fill({ color: 0x14102a, alpha: 0.55 });
    this.root.addChild(this.bg);
    for (const r of this.rows) this.root.addChild(r.sprite);
  }

  destroy(): void {
    this.clear();
    this.root.destroy({ children: true });
  }
}
