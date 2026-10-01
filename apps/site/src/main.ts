import './styles.css';
import { paintRegion } from './art';
import { assetUrl } from './assets';
import { CONCEPT_IDS, REAL_REGIONS, REGIONS } from './content';
import { initHero } from './hero';
import { pixelIcon } from './icons';
import { initReel, renderStrip } from './reel';
import { initCreator, initCreatures, initMounts, initTod } from './showcase';
import { initWaitlist } from './waitlist';

const PLAY_URL: string = import.meta.env.VITE_PLAY_URL ?? `${import.meta.env.BASE_URL}play/`;

/** Run `fn` once, when `el` first comes within `margin` of the viewport (or immediately without IntersectionObserver). */
function whenNear(el: Element | null, fn: () => void | Promise<unknown>, margin = '400px'): void {
  if (!el) return;
  const run = () => {
    Promise.resolve(fn()).catch((err) => console.error('[site]', err));
  };
  if (!('IntersectionObserver' in window)) return run();
  const io = new IntersectionObserver(
    (es) => {
      if (es.some((e) => e.isIntersecting)) {
        io.disconnect();
        run();
      }
    },
    { rootMargin: margin },
  );
  io.observe(el);
}

// ---- pixel icons (data-icon="name")
document.querySelectorAll<HTMLElement>('[data-icon]').forEach((el) => {
  el.innerHTML = pixelIcon(el.dataset.icon ?? '', Number(el.dataset.size ?? 48));
});

// ---- play links
document.querySelectorAll<HTMLAnchorElement>('[data-play]').forEach((a) => {
  a.href = PLAY_URL;
  a.rel = 'noopener';
});

// ---- hero (real layered sunset art + animated heroes)
const hero = document.getElementById('hero-art') as HTMLCanvasElement | null;
if (hero) initHero(hero).catch((err) => console.error('[hero]', err));

// ---- real regions viewer
const rvImg = document.getElementById('rv-img') as HTMLImageElement | null;
if (rvImg) {
  const rvCap = document.getElementById('rv-cap')!;
  const rvThumbs = document.getElementById('rv-thumbs')!;
  const tabs = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-rv]'));
  let regionIdx = 0;
  const show = (r: number, s: number) => {
    const reg = REAL_REGIONS[r];
    regionIdx = r;
    rvImg.src = assetUrl(reg.scenes[s]);
    rvImg.alt = reg.alts[s];
    rvCap.textContent = `${reg.name}. ${reg.blurb}`;
    rvThumbs.innerHTML = reg.scenes
      .map(
        (f, i) =>
          `<li><button type="button" data-scene="${i}" aria-pressed="${i === s}" aria-label="${reg.name}, scene ${i + 1}"><img src="${assetUrl(f)}" alt="" width="192" height="168" loading="lazy" decoding="async" /></button></li>`,
      )
      .join('');
    tabs.forEach((b, i) => b.setAttribute('aria-pressed', String(i === r)));
  };
  tabs.forEach((b, i) => b.addEventListener('click', () => show(i, 0)));
  rvThumbs.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-scene]');
    if (b) show(regionIdx, Number(b.dataset.scene));
  });
  show(0, 0);
}

// ---- concept regions (procedural sketches, always labelled Concept)
const grid = document.getElementById('region-grid');
if (grid) {
  const concepts = REGIONS.filter((r) => CONCEPT_IDS.includes(r.id));
  grid.innerHTML = concepts
    .map(
      (r) => `
    <li class="region region--concept" id="region-${r.id}">
      <figure>
        <canvas class="region__art" data-region="${r.id}" role="img" aria-label="Rough concept sketch. ${r.alt}"></canvas>
        <figcaption>
          <h3>${r.name}</h3>
          <p>${r.blurb}</p>
          <ul class="tags" aria-label="Themes">${r.tags.map((t) => `<li>${t}</li>`).join('')}</ul>
        </figcaption>
      </figure>
      <span class="chip chip--concept">Concept</span>
    </li>`,
    )
    .join('');
  const paint = (cv: HTMLCanvasElement) => paintRegion(cv, cv.dataset.region!);
  const cvs = Array.from(grid.querySelectorAll<HTMLCanvasElement>('canvas[data-region]'));
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          paint(e.target as HTMLCanvasElement);
          io.unobserve(e.target);
        }
      },
      { rootMargin: '300px' },
    );
    cvs.forEach((cv) => io.observe(cv));
  } else cvs.forEach(paint);
}

// ---- gameplay reel, film strip, co-op storyboard (all drawn from the real sim + real art)
whenNear(document.getElementById('reel'), () => initReel());
const strip = Array.from(document.querySelectorAll<HTMLCanvasElement>('canvas[data-strip]'));
whenNear(strip[0] ?? null, () => renderStrip('solo', [135, 168, 256, 283, 334, 396], strip));
const sb = Array.from(document.querySelectorAll<HTMLCanvasElement>('canvas[data-story]'));
whenNear(sb[0] ?? null, () => renderStrip('coop', [34, 57, 74, 100], sb, { focusX: 1338 }));

// ---- screenshots
const SHOTS: { file: string; title: string; alt: string; fit?: 'contain' }[] = [
  { file: 'shot-sunset.png', title: 'Sunset meadow', alt: 'Prototype screenshot: a character in a safari hat runs past a big round tree in the sunset meadow, with coral clouds and purple mountains behind.' },
  { file: 'shot-day.png', title: 'Grassland by day', alt: 'Prototype screenshot: a character mid-jump above a dirt slope in the bright daytime grassland, with a windmill and big white clouds behind.' },
  { file: 'shot-caves.png', title: 'Crystal Caves', alt: 'Prototype screenshot: a character runs through the purple crystal caves past a glowing blue mushroom and pink and cyan crystals, under hanging stalactites.' },
  { file: 'shot-night.png', title: 'Night, three players', alt: 'Prototype screenshot: three differently dressed players standing together in the grassland at night under a full moon, each with a name tag.' },
  { file: 'shot-together.png', title: 'Two players, one world', alt: 'Prototype screenshot: two players with different looks, a punk with pink hair and a green sprite, share the sunset meadow.' },
  { file: 'shot-creator.png', title: 'Character creator', alt: 'Prototype screenshot: the Create Your Hero screen with a live animated preview, option tabs, skin-tone swatches, a name field and a look code.', fit: 'contain' },
];
const shotsEl = document.getElementById('shots');
if (shotsEl) {
  shotsEl.innerHTML = SHOTS.map(
    (s) =>
      `<li><figure><a href="${import.meta.env.BASE_URL}shots/${s.file}" target="_blank" rel="noopener"><img ${s.fit ? `data-fit="${s.fit}" ` : ''}width="768" height="672" src="${import.meta.env.BASE_URL}shots/${s.file}" alt="${s.alt}" loading="lazy" decoding="async" /></a><figcaption>${s.title}</figcaption></figure></li>`,
  ).join('');
  shotsEl.querySelectorAll('img').forEach((im) =>
    im.addEventListener('error', () => im.closest('li')?.remove(), { once: true }),
  );
}

// ---- real-art showcases (lazy)
whenNear(document.getElementById('creator'), () => initCreator());
whenNear(document.getElementById('mounts'), () => initMounts());
whenNear(document.getElementById('creatures'), () => initCreatures());
whenNear(document.getElementById('tod-canvas'), () => initTod());

// ---- waitlist
initWaitlist();

// ---- nav: mobile menu, current section, header state
const nav = document.getElementById('site-nav')!;
const toggle = document.getElementById('nav-toggle') as HTMLButtonElement;
const menu = document.getElementById('nav-menu')!;
const setMenu = (open: boolean) => {
  toggle.setAttribute('aria-expanded', String(open));
  menu.dataset.open = String(open);
};
toggle.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));
menu.addEventListener('click', (e) => {
  if ((e.target as HTMLElement).closest('a')) setMenu(false);
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
    setMenu(false);
    toggle.focus();
  }
});

const links = Array.from(menu.querySelectorAll<HTMLAnchorElement>('a[href^="#"]'));
const sections = links
  .map((a) => document.querySelector<HTMLElement>(a.getAttribute('href')!))
  .filter((s): s is HTMLElement => !!s);
const spy = new IntersectionObserver(
  (entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      links.forEach((a) => {
        const on = a.getAttribute('href') === `#${e.target.id}`;
        if (on) a.setAttribute('aria-current', 'true');
        else a.removeAttribute('aria-current');
      });
    }
  },
  { rootMargin: '-45% 0px -50% 0px' },
);
sections.forEach((s) => spy.observe(s));

const onScroll = () => {
  nav.classList.toggle('is-stuck', window.scrollY > 8);
  if (window.scrollY < 300) links.forEach((a) => a.removeAttribute('aria-current'));
};
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

document.getElementById('year')!.textContent = String(new Date().getFullYear());

document.querySelectorAll<HTMLAnchorElement>('a[data-placeholder]').forEach((a) => {
  a.addEventListener('click', (e) => e.preventDefault());
  a.setAttribute('aria-disabled', 'true');
  a.title = 'Coming soon';
});
