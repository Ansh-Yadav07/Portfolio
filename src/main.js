import '@fontsource-variable/schibsted-grotesk';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import '@fontsource/silkscreen/400.css';
import './styles.css';

import { clamp, updatePins } from './lib.js';
import { initHero } from './scenes/hero.js';
import { initRead } from './scenes/read.js';
import { initSee } from './scenes/see.js';
import { initGuard } from './scenes/guard.js';
import { initPlan } from './scenes/plan.js';
import { initLearn } from './scenes/learn.js';
import { initPhoto } from './scenes/photo.js';
import { initBot } from './bot/bot.js';
import { initEggs } from './eggs.js';

document.documentElement.classList.add('js');

function boot() {
  initHero();
  initRead();
  initSee();
  initGuard();
  initPlan();
  initLearn();
  initPhoto();
  initEggs();
  initBot();
  updatePins();
  updateHud();
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

// The nav steps out of the way while reading and returns as soon as you scroll back
const nav = document.querySelector('.nav');
let navY = 0;
function updateNav() {
  const y = scrollY;
  if (Math.abs(y - navY) < 6) return;
  nav.classList.toggle('away', y > navY && y > innerHeight * 0.5);
  navY = y;
}

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

// A page opened in a background or collapsed view can start with no size to measure
if (innerWidth > 0) {
  boot();
} else {
  addEventListener('resize', boot, { once: true });
}
