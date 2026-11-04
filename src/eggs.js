import { emit } from './lib.js';

const TOTAL = 7;
const KEY = 'ansh-eggs';
let found = new Set();
try { found = new Set(JSON.parse(localStorage.getItem(KEY) || '[]')); } catch { /* private mode */ }

let toastTimer;
export function toast(text, ms = 3600) {
  const el = document.getElementById('toast');
  el.textContent = text;
  el.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('on'), ms);
}

function renderCount() {
  const el = document.getElementById('egg-count');
  if (el && found.size) el.textContent = `Easter eggs ${found.size}/${TOTAL}`;
}

export function foundEgg(id, label) {
  if (found.has(id)) return;
  found.add(id);
  try { localStorage.setItem(KEY, JSON.stringify([...found])); } catch { /* private mode */ }
  renderCount();
  toast(`Egg ${found.size}/${TOTAL}: ${label}`);
  emit('bot', { do: 'happy' });
}

// Dropout, p = 0.3: Konami code randomly turns off a third of the page's "neurons"
function dropout() {
  foundEgg('dropout', 'Dropout, p = 0.3');
  emit('bot', { do: 'surprised' });
  const nodes = [...document.querySelectorAll('main h2, main p, main li, main .stat, main .links a, main .check, main .chips button, main .contact-links a')]
    .filter((n) => Math.random() < 0.3);
  nodes.forEach((n) => n.classList.add('dropped'));
  setTimeout(() => nodes.forEach((n) => n.classList.remove('dropped')), 5000);
}

function hire() {
  foundEgg('hire', 'You typed the magic word');
  document.getElementById('contact').scrollIntoView({ behavior: 'smooth' });
  emit('bot', { do: 'party' });
}

const KONAMI = ['arrowup', 'arrowup', 'arrowdown', 'arrowdown', 'arrowleft', 'arrowright', 'arrowleft', 'arrowright', 'b', 'a'];

function listenKeys() {
  let k = 0;
  let typed = '';
  addEventListener('keydown', (e) => {
    if (e.target.matches('input, textarea')) return;
    const key = e.key.toLowerCase();
    k = key === KONAMI[k] ? k + 1 : key === KONAMI[0] ? 1 : 0;
    if (k === KONAMI.length) { k = 0; dropout(); }
    if (key.length === 1) {
      typed = (typed + key).slice(-4);
      if (typed === 'hire') { typed = ''; hire(); }
    }
  });
}

const TEMPS = [
  [0.1, 'Ansh Yadav is a computer science student at VIT Chennai.'],
  [0.5, 'Ansh Yadav is a computer science student who specialises in AI and ML.'],
  [0.9, 'Ansh builds machines that read, see, guard and plan.'],
  [1.2, 'Ansh is mostly a for-loop with ambitions.'],
  [1.5, 'Verified by 4 news APIs and one gibbon. Confidence is very high, sources are unclear.'],
  [1.8, 'The tomato is 0.97 sure Ansh lives in a backwater with twelve hidden layers.'],
  [2.01, 'ansh ansh the tensor of chennai drinks gradient at dawn purple purple purple'],
];

function initTemperature() {
  const input = document.getElementById('temp');
  const val = document.getElementById('temp-val');
  const out = document.getElementById('temp-out');
  const render = () => {
    const t = input.value / 10;
    val.textContent = t.toFixed(1);
    out.textContent = TEMPS.find(([max]) => t <= max)[1];
  };
  input.addEventListener('input', () => {
    render();
    if (input.value >= 15) foundEgg('temperature', 'High temperature sampling');
    if (input.value >= 18) emit('bot', { do: 'dizzy' });
  });
  render();
}

function initConsole() {
  const title = 'font: 700 20px sans-serif';
  const mono = 'font: 12px monospace';
  console.log('%cYou opened the console. Respect.', title);
  console.log(
    '%cLayer (type)          Output shape     Param #\n' +
    '-----------------------------------------------\n' +
    'curiosity (Input)     (None, ∞)        0\n' +
    'distilbert (Finetune) (None, 2)        67M\n' +
    'yolo26s (OnDevice)    (None, 22)       ships offline\n' +
    'mavis (Ensemble)      (None, risk)     0.9995 AUC\n' +
    'side_projects (Dense) (None, 21)       see GitHub\n' +
    '-----------------------------------------------\n' +
    'Trainable: yes.  Available for hire: also yes.\n\n' +
    'Try epoch.pet(), epoch.dance(), or hire()',
    mono,
  );
  window.epoch = {
    pet() { foundEgg('console', 'Console whisperer'); emit('bot', { do: 'happy' }); return '♥'; },
    dance() { foundEgg('console', 'Console whisperer'); emit('bot', { do: 'party' }); return 'unce unce'; },
  };
  window.hire = () => { hire(); return 'anshy047@gmail.com'; };
}

function initEmail() {
  const btn = document.getElementById('email-btn');
  const hint = document.getElementById('email-hint');
  btn.addEventListener('click', async () => {
    const address = btn.dataset.email;
    try {
      await navigator.clipboard.writeText(address);
      hint.textContent = 'Copied';
      emit('bot', { do: 'happy' });
      setTimeout(() => (hint.textContent = 'Copy'), 1800);
    } catch {
      location.href = `mailto:${address}`;
    }
  });
}

function initTitle() {
  const original = document.title;
  document.addEventListener('visibilitychange', () => {
    document.title = document.hidden ? 'epoch misses you' : original;
    if (!document.hidden) emit('bot', { do: 'surprised' });
  });
}

export function initEggs() {
  renderCount();
  listenKeys();
  initTemperature();
  initConsole();
  initEmail();
  initTitle();
}
