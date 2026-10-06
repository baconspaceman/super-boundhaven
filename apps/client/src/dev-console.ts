// A small slash-command console (backquote key). Everyone can use /help /whoami /register /renew; the server only
// honours developer commands for the developer account, so nothing here is trusted: it just sends lines and prints
// the replies.
import type { Net } from './net';
import type { Input } from './input';

const STYLE = `
#sbh-console { position: fixed; left: 8px; right: 8px; bottom: 8px; z-index: 9; display: none; max-width: 760px;
  background: rgba(14,10,32,.93); border: 2px solid #7a5cc7; border-radius: 6px; color: #f6f3ff; font: 12px/1.45 monospace; }
#sbh-console.open { display: block; }
#sbh-console .log { max-height: 34vh; overflow-y: auto; padding: 6px 8px; white-space: pre-wrap; word-break: break-word; }
#sbh-console .log .me { color: #ffd84a; }
#sbh-console .log .err { color: #ff8a9a; }
#sbh-console form { display: flex; border-top: 1px solid #4b3a8a; }
#sbh-console input { flex: 1; background: transparent; border: 0; outline: 0; color: inherit; font: inherit; padding: 6px 8px; }
#sbh-console .tag { padding: 6px 8px; color: #8fe6ff; }
`;

export class DevConsole {
  private el = document.createElement('div');
  private log = document.createElement('div');
  private field = document.createElement('input');
  private tag = document.createElement('span');
  private history: string[] = [];
  private hi = -1;
  private ready = false;

  constructor(
    private net: Net,
    private input: Input,
  ) {
    const st = document.createElement('style');
    st.textContent = STYLE;
    document.head.append(st);
    this.el.id = 'sbh-console';
    this.el.setAttribute('role', 'dialog');
    this.el.setAttribute('aria-label', 'Console');
    this.log.className = 'log';
    this.log.setAttribute('aria-live', 'polite');
    const form = document.createElement('form');
    this.tag.className = 'tag';
    this.tag.textContent = '/';
    this.field.type = 'text';
    this.field.autocomplete = 'off';
    this.field.spellcheck = false;
    this.field.maxLength = 400;
    this.field.placeholder = 'type /help';
    form.append(this.tag, this.field);
    this.el.append(this.log, form);
    document.body.append(this.el);

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const line = this.field.value.trim();
      this.field.value = '';
      if (!line) return;
      this.history.unshift(line);
      this.hi = -1;
      // never echo a password back onto the screen
      this.print(line.replace(/^(\/?register\s+\S+\s+).*/i, '$1********'), 'me');
      this.net.send({ t: 'cmd', line: line.startsWith('/') ? line : `/${line}` });
    });
    this.field.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Escape' || e.code === 'Backquote') {
        e.preventDefault();
        this.close();
      } else if (e.key === 'ArrowUp' && this.history.length) {
        e.preventDefault();
        this.hi = Math.min(this.history.length - 1, this.hi + 1);
        this.field.value = this.history[this.hi];
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        this.hi = Math.max(-1, this.hi - 1);
        this.field.value = this.hi < 0 ? '' : this.history[this.hi];
      }
    });
    window.addEventListener('keydown', (e) => {
      if (e.code !== 'Backquote' || e.repeat || !this.ready || this.isOpen) return;
      if (document.querySelector('#creator.open, .sbh-overlay.open')) return;
      e.preventDefault();
      this.open();
    });
  }

  get isOpen(): boolean {
    return this.el.classList.contains('open');
  }

  /** Called once the server welcomed us. */
  setReady(role: string): void {
    this.ready = true;
    this.tag.textContent = role === 'admin' ? 'dev/' : '/';
    this.field.placeholder = role === 'admin' ? 'developer console: /help' : 'type /help';
  }

  print(text: string, cls = ''): void {
    for (const line of text.split('\n')) {
      const d = document.createElement('div');
      if (cls) d.className = cls;
      d.textContent = line;
      this.log.append(d);
    }
    while (this.log.childElementCount > 200) this.log.firstElementChild?.remove();
    this.log.scrollTop = this.log.scrollHeight;
  }

  open(): void {
    this.el.classList.add('open');
    this.input.captured = true;
    this.field.focus();
    if (!this.log.childElementCount) this.print('Console. Type /help for commands.');
  }

  close(): void {
    this.el.classList.remove('open');
    this.field.blur();
    this.input.captured = false;
  }
}
