import '@fontsource-variable/schibsted-grotesk';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import '@fontsource/silkscreen/400.css';
import './styles.css';

import { clamp, on, updatePins } from './lib.js';
import { initHero } from './scenes/hero.js';
import { initBot } from './bot/bot.js';
import { initEggs } from './eggs.js';

document.documentElement.classList.add('js');

// One scene throwing should never take the rest of the page down with it
function safe(fn) {
  try {
    const r = fn();
    if (r && r.catch) r.catch((e) => console.error(e));
  } catch (e) {
    console.error(e);
  }
}

// Scenes below the fold load as their own chunks and start about 1.5 screens before they arrive
const LAZY = [
  ['read', () => import('./scenes/read.js').then((m) => m.initRead())],
  ['see', () => import('./scenes/see.js').then((m) => m.initSee())],
  ['guard', () => import('./scenes/guard.js').then((m) => m.initGuard())],
  ['report', () => import('./scenes/report.js').then((m) => m.initReport())],
  ['learn', () => import('./scenes/learn.js').then((m) => m.initLearn())],
  ['card', () => import('./scenes/photo.js').then((m) => m.initPhoto())],
];
const started = new Set();
function startScene(i) {
  // A jump (a link, or a load at /#contact) also starts every scene it skipped over
  for (let k = 0; k <= i; k++) {
    if (started.has(k)) continue;
    started.add(k);
    const el = document.getElementById(LAZY[k][0]);
    if (el) lazyIo.unobserve(el);
    safe(() => LAZY[k][1]().then(updatePins));
  }
}
const lazyIo = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (e.isIntersecting) startScene(LAZY.findIndex(([id]) => id === e.target.id));
  }
}, { rootMargin: '150% 0px' });

function boot() {
  safe(initHero);
  safe(initEggs);
  safe(initBot);
  LAZY.forEach(([id]) => {
    const el = document.getElementById(id);
    if (el) lazyIo.observe(el);
  });
  // Past the last lazy section (the contact form, say): everything above has to start
  const last = document.getElementById(LAZY[LAZY.length - 1][0]);
  if (last && last.getBoundingClientRect().bottom < 0) startScene(LAZY.length - 1);
  updatePins();
  updateHud();
  updateNav();
}

// Reveal on scroll
const io = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (e.isIntersecting) {
      e.target.classList.add('in');
      io.unobserve(e.target);
    }
  }
}, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
document.querySelectorAll('.reveal, .reveal-group').forEach((el) => io.observe(el));

// The page is a training run: scrolling is the epochs, loss falls as you read
const hud = document.getElementById('hud-text');
function updateHud() {
  const max = document.documentElement.scrollHeight - innerHeight;
  const p = clamp(scrollY / Math.max(1, max));
  const epoch = Math.round(p * 100);
  const loss = 2.3 * Math.exp(-4.6 * p) + 0.021;
  hud.textContent = p > 0.995
    ? 'epoch 100 · loss 0.021 · converged'
    : `epoch ${String(epoch).padStart(3, '0')} · loss ${loss.toFixed(3)}`;
}

// The nav takes the theme of the section under it, and marks the link for the part of the page in view
const nav = document.querySelector('.nav');
const sections = [...document.querySelectorAll('main > section')];
const navLinks = [...nav.querySelectorAll('.nav-links a')];
const GROUP = { read: '#read', see: '#read', guard: '#read', report: '#read', more: '#read', learn: '#learn', card: '#card', contact: '#contact' };
const sectionAt = (y) => sections.find((s) => {
  const r = s.getBoundingClientRect();
  return r.top <= y && r.bottom > y;
});
function updateNav() {
  nav.classList.toggle('at-top', scrollY < 8);
  // The hero turns dark half-way through its own scroll, and says so with .is-dark
  const under = sectionAt(nav.offsetHeight / 2);
  nav.classList.toggle('on-dark', !!under && (under.classList.contains('dark') || under.classList.contains('is-dark')));
  const atEnd = scrollY + innerHeight >= document.documentElement.scrollHeight - 2;
  const inView = atEnd ? sections[sections.length - 1] : sectionAt(innerHeight * 0.4);
  const href = inView && GROUP[inView.id];
  for (const a of navLinks) {
    if (a.getAttribute('href') === href) a.setAttribute('aria-current', 'true');
    else a.removeAttribute('aria-current');
  }
}
on('hero-dark', updateNav);

let queued = false;
const onScroll = () => {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    updatePins();
    updateHud();
    updateNav();
  });
};
addEventListener('scroll', onScroll, { passive: true });
addEventListener('resize', onScroll);
// Lazy scenes can change the page height (the photo appears late) without any scroll event
new ResizeObserver(onScroll).observe(document.querySelector('main'));

// A page opened in a background or collapsed view can start with no size to measure
if (innerWidth > 0) {
  boot();
} else {
  addEventListener('resize', boot, { once: true });
}

// Vercel Web Analytics: cookieless page views, loaded only on the deployed site
if (import.meta.env.PROD && /(^|\.)anshyadav\.me$|\.vercel\.app$/.test(location.hostname)) {
  window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };
  const s = document.createElement('script');
  s.defer = true;
  s.src = '/_vercel/insights/script.js';
  document.head.append(s);
}
