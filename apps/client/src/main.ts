import { decodeLook, encodeLook, randomLook } from './art';
import { Creator } from './creator';
import { Game } from './game';
import { Hud } from './hud';
import { Input } from './input';
import { Net } from './net';
import { Renderer } from './render';
import { REGIONS, isRegion, type RegionId } from './world-art';
import { TOD_ORDER, isTod, type TodId } from './tod-art';

const STEP_MS = 1000 / 60;
const NAME_KEY = 'sbh.name';
const LOOK_KEY = 'sbh.look';

const params = new URLSearchParams(location.search);
const num = (k: string) => {
  const v = Number(params.get(k));
  return Number.isFinite(v) && v > 0 ? v : 0;
};

// Debug: ?raf=timer drives the loop from setTimeout (for hidden/headless panes where rAF is paused).
if (params.get('raf') === 'timer') {
  window.requestAnimationFrame = (cb) => window.setTimeout(() => cb(performance.now()), 16) as unknown as number;
}

// Server URL: ?server= > VITE_SERVER_URL > dev default (ws://<host>:8080). Production builds default to
// none (static hosting such as GitHub Pages has no game server): the creator still works offline.
const SERVER_URL: string =
  params.get('server') ?? import.meta.env.VITE_SERVER_URL ?? (import.meta.env.DEV ? `ws://${location.hostname}:8080` : '');
const NO_SERVER_MSG = 'The online server is not hosted yet — run it locally: npm run dev';

const net = new Net({
  url: SERVER_URL,
  lagMs: num('lag'),
  lossPct: Math.min(100, num('loss')),
});
const game = new Game();
const input = new Input();
const regionParam = params.get('region');
const todParam = params.get('tod');
const initialTod: TodId | null = isTod(todParam) ? todParam : null;
const renderer = new Renderer(
  game.level,
  isRegion(regionParam) ? regionParam : initialTod ? Renderer.regionFor(initialTod) : 'meadow_sunset',
  initialTod,
);
const hud = new Hud(game, net, () => `region ${renderer.region}  [ ] to cycle: ${REGIONS.join(' | ')}
tod ${renderer.todLabel}  , . to cycle: off | dawn | day | sunset | night | cycle`);

function cycleRegion(dir: number): void {
  const i = REGIONS.indexOf(renderer.region);
  void renderer.setRegion(REGIONS[(i + dir + REGIONS.length) % REGIONS.length]);
}
function cycleTod(dir: number): void {
  const i = TOD_ORDER.indexOf(renderer.todId);
  void renderer.setTimeOfDay(TOD_ORDER[(i + dir + TOD_ORDER.length) % TOD_ORDER.length]);
}
window.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement || creator.isOpen) return;
  if (e.code === 'Comma') cycleTod(-1);
  else if (e.code === 'Period') cycleTod(1);
  if (e.code === 'BracketLeft') cycleRegion(-1);
  else if (e.code === 'BracketRight') cycleRegion(1);
});

const banner = document.getElementById('banner') as HTMLDivElement;
const toast = document.getElementById('toast') as HTMLDivElement;
const creator = new Creator(document.getElementById('creator') as HTMLElement);

const tryStore = {
  get(k: string): string | null {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set(k: string, v: string): void {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* storage unavailable */
    }
  },
};

/** Shown when no game server is configured (static hosting): points at the run-locally instructions. */
function showOfflineNote(): void {
  const el = document.createElement('div');
  el.id = 'offline-note';
  el.setAttribute('role', 'note');
  el.style.cssText =
    'position:fixed;bottom:0;left:0;right:0;z-index:40;padding:8px 12px;text-align:center;background:#1a1a38;color:#ffd84a;border-top:2px solid #ff4f7b;font-size:13px;';
  el.append(`${NO_SERVER_MSG}. The character creator below works offline. `);
  const a = document.createElement('a');
  a.href = 'https://github.com/baconspaceman/super-boundhaven#run-it-locally';
  a.textContent = 'Run instructions';
  a.style.color = '#9ef';
  a.rel = 'noopener';
  el.append(a);
  document.body.append(el);
}

let joined = false;
let toastTimer = 0;
function showToast(msg: string): void {
  toast.textContent = msg;
  toast.style.display = 'block';
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (toast.style.display = 'none'), 2500);
}

net.onStatus = (up) => {
  banner.style.display = up || !joined ? 'none' : 'block';
  if (!up && !joined) creator.setStatus('Cannot reach server, retrying...', true);
};
net.onMessage = (m) => {
  switch (m.t) {
    case 'welcome':
      joined = true;
      game.welcome(m.id);
      game.setLook(m.id, m.look);
      tryStore.set(LOOK_KEY, m.look);
      creator.close();
      input.captured = false;
      banner.style.display = 'none';
      break;
    case 'look':
      game.setLook(m.id, m.look);
      break;
    case 'snap':
      game.onSnapshot(m.tick, m.players, performance.now());
      break;
    case 'error':
      if (joined) showToast(m.message);
      else creator.setStatus(m.message, true);
      break;
  }
};

function join(name: string, code: string): void {
  name = name.trim().slice(0, 16);
  if (!name) return;
  tryStore.set(NAME_KEY, name);
  tryStore.set(LOOK_KEY, code);
  if (!SERVER_URL) return creator.setStatus(NO_SERVER_MSG, true);
  creator.setStatus('Connecting...');
  net.connect(name, code);
}

/** Look for this session: ?look= (validated) > saved > a fresh random one. */
function initialLook(): string {
  for (const c of [params.get('look'), tryStore.get(LOOK_KEY)]) {
    if (c && decodeLook(c)) return c;
  }
  return encodeLook(randomLook((Math.random() * 0x7fffffff) | 0));
}

function openJoin(name: string, code: string): void {
  input.captured = true;
  creator.open({ mode: 'join', name, code, onSubmit: join });
}

function openEdit(): void {
  if (!joined || creator.isOpen) return;
  input.captured = true;
  creator.open({
    mode: 'edit',
    name: game.myName,
    code: game.lookOf(game.myId),
    onSubmit: (_name, code) => {
      game.setLook(game.myId, code); // optimistic; the server echoes it back
      tryStore.set(LOOK_KEY, code);
      net.setLook(code);
      creator.close();
      input.captured = false;
    },
    onCancel: () => (input.captured = false),
  });
}

window.addEventListener('keydown', (e) => {
  if (e.code !== 'KeyC' || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
  openEdit();
});

let acc = 0;
let last = performance.now();

function frame(now: number): void {
  const dt = Math.min(now - last, 100);
  last = now;
  acc += dt;
  while (acc >= STEP_MS) {
    acc -= STEP_MS;
    if (!net.connected || !joined) continue;
    const buttons = input.read();
    const seq = game.tick(buttons);
    if (seq !== null) net.send({ t: 'input', seq, buttons });
  }
  renderer.draw(game.drawables(now), game.me ? { x: game.me.x + game.errX } : null);
  hud.frame(now);
  requestAnimationFrame(frame);
}

(window as unknown as { __sbh: unknown }).__sbh = {
  game,
  net,
  input,
  creator,
  openEdit,
  params: Object.fromEntries(params),
  renderer,
  setRegion: (id: RegionId) => renderer.setRegion(id),
  setTimeOfDay: (id: TodId | null) => renderer.setTimeOfDay(id),
  setTodPaused: (p: boolean) => renderer.setTodPaused(p),
  get todClock() {
    return renderer.todClock;
  },
  set todClock(v: number | null) {
    renderer.todClock = v;
  },
  get tod() {
    return renderer.todId;
  },
  get region() {
    return renderer.region;
  },
};

renderer.init().then(() => {
  requestAnimationFrame((t) => {
    last = t;
    frame(t);
  });
  const auto = params.get('name');
  const name = auto ?? tryStore.get(NAME_KEY) ?? '';
  const look = initialLook();
  if (auto && SERVER_URL) join(auto, look);
  else openJoin(name, look);
  if (!SERVER_URL) showOfflineNote();
});
