import type { Game } from './game';
import type { Net } from './net';

/** Debug overlay, F1 toggles. */
export class Hud {
  private el = document.getElementById('hud') as HTMLPreElement;
  private visible = true;
  private fps = 0;
  private last = performance.now();
  private nextUpdate = 0;

  constructor(
    private game: Game,
    private net: Net,
    private extra: () => string = () => '',
  ) {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'F1') {
        e.preventDefault();
        this.visible = !this.visible;
        this.el.style.display = this.visible ? 'block' : 'none';
      }
    });
  }

  frame(now: number): void {
    const dt = now - this.last;
    this.last = now;
    if (dt > 0) this.fps = this.fps * 0.9 + (1000 / dt) * 0.1;
    if (!this.visible || now < this.nextUpdate) return;
    this.nextUpdate = now + 100;
    const g = this.game;
    const me = g.me;
    const f = (n: number) => n.toFixed(2);
    this.el.textContent = [
      `fps ${this.fps.toFixed(0)}  ping ${this.net.ping.toFixed(0)}ms`,
      `level ${g.levelName}  server tick ${g.serverTick}  players ${g.playerCount}`,
      me ? `pos ${f(me.x)}, ${f(me.y)}` : 'pos -',
      me ? `vx ${f(me.vx)}  vy ${f(me.vy)}  ground ${me.onGround}` : '',
      `pending ${g.pending.length}  corrections ${g.corrections}  snaps ${g.snaps}`,
      me ? `shards ${me.shards}  flag ${me.checkpoint}  deaths ${me.deaths}  invuln ${me.invuln}  crouch ${me.crouching}` : '',
      this.extra(),
      `sim lag ${this.net.opts.lagMs}ms  loss ${this.net.opts.lossPct}%`,
    ]
      .filter(Boolean)
      .join('\n');
  }
}
