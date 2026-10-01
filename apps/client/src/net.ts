import type { ClientMsg, ServerMsg } from '@sbh/protocol';

export interface NetOptions {
  url: string;
  lagMs: number; // total round-trip added; half each direction
  lossPct: number; // drops 'input' sends and 'snap' receives only
}

const TOKEN_KEY = 'sbh.token';

/** WebSocket wrapper: JSON messages, lag/loss simulation, auto-reconnect with token. */
export class Net {
  connected = false;
  ping = 0;
  onMessage: (m: ServerMsg) => void = () => {};
  onStatus: (connected: boolean) => void = () => {};

  private ws: WebSocket | null = null;
  private name = '';
  private look = '';
  private wanted = false;
  private retry: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;

  constructor(readonly opts: NetOptions) {}

  connect(name: string, look: string): void {
    this.name = name;
    this.look = look;
    this.wanted = true;
    this.open();
    if (!this.pingTimer) {
      this.pingTimer = setInterval(() => this.send({ t: 'ping', ts: performance.now() }), 1000);
    }
  }

  private open(): void {
    if (this.ws) return;
    let ws: WebSocket;
    try {
      ws = new WebSocket(this.opts.url);
    } catch {
      this.scheduleRetry();
      return;
    }
    this.ws = ws;
    ws.onopen = () => {
      this.connected = true;
      let token: string | undefined;
      try {
        token = sessionStorage.getItem(TOKEN_KEY) ?? undefined;
      } catch {
        /* storage unavailable */
      }
      this.rawSend({ t: 'join', name: this.name, token, look: this.look });
      this.onStatus(true);
    };
    ws.onmessage = (ev) => {
      let m: ServerMsg;
      try {
        m = JSON.parse(String(ev.data)) as ServerMsg;
      } catch {
        return;
      }
      if (m.t === 'pong') this.ping = performance.now() - m.ts;
      if (m.t === 'welcome') {
        try {
          sessionStorage.setItem(TOKEN_KEY, m.token);
        } catch {
          /* ignore */
        }
      }
      const { lagMs, lossPct } = this.opts;
      if (m.t === 'snap' && lossPct > 0 && Math.random() * 100 < lossPct) return;
      if (lagMs > 0) setTimeout(() => this.onMessage(m), lagMs / 2);
      else this.onMessage(m);
    };
    ws.onclose = () => {
      const was = this.connected;
      this.ws = null;
      this.connected = false;
      if (was) this.onStatus(false);
      this.scheduleRetry();
    };
    ws.onerror = () => {
      /* onclose follows */
    };
  }

  private scheduleRetry(): void {
    if (!this.wanted || this.retry) return;
    this.retry = setTimeout(() => {
      this.retry = null;
      this.open();
    }, 1000);
  }

  /** Remember the look for reconnects and send it live. */
  setLook(look: string): void {
    this.look = look;
    this.send({ t: 'setLook', look });
  }

  send(m: ClientMsg): void {
    if (!this.connected) return;
    const { lagMs, lossPct } = this.opts;
    if (m.t === 'input' && lossPct > 0 && Math.random() * 100 < lossPct) return;
    if (lagMs > 0) setTimeout(() => this.rawSend(m), lagMs / 2);
    else this.rawSend(m);
  }

  private rawSend(m: ClientMsg): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(m));
  }
}
