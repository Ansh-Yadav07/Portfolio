import { emit, pin, range, smooth } from '../lib.js';

// Scores in this sequence are a sample run for the animation, labelled as such on the page
const CHECKS = [
  ['DistilBERT', 0.91],
  ['TF-IDF + LR', 0.84],
  ['Linguistic features', 0.96],
  ['Clickbait patterns', 0.99],
  ['Wikipedia', 0.62],
  ['4 news APIs', 0.78],
];

const CLICKBAIT = ['shocking', 'breaking', 'exposed', 'truth', 'secret', 'you won’t believe', "you won't believe", 'they don’t want you', "they don't want you"];

// Same 8 features, same order, as src/linguistic_features.py in fake-news-detection-adv
function features(text) {
  const words = text.split(/\s+/).filter(Boolean);
  const lower = text.toLowerCase();
  const n = text.length;
  return [
    ['Characters', n, false],
    ['Words', words.length, false],
    ['Avg word length', words.length ? (words.reduce((s, w) => s + w.length, 0) / words.length).toFixed(1) : '0.0', false],
    ['Exclamations', (text.match(/!/g) || []).length, (text.match(/!/g) || []).length > 0],
    ['Questions', (text.match(/\?/g) || []).length, false],
    ['Capital ratio', (n ? [...text].filter((c) => c >= 'A' && c <= 'Z').length / n : 0).toFixed(2), n > 0 && [...text].filter((c) => c >= 'A' && c <= 'Z').length / n > 0.15],
    ['Clickbait hits', CLICKBAIT.filter((w) => lower.includes(w)).length, CLICKBAIT.some((w) => lower.includes(w))],
    ['Numbers', (text.match(/\d+/g) || []).length, false],
  ];
}

export function initRead() {
  const pipeline = document.getElementById('pipeline');
  const verdict = document.getElementById('verdict');
  const headline = document.getElementById('read-headline');

  const rows = CHECKS.map(([name]) => {
    const row = document.createElement('div');
    row.className = 'check';
    row.innerHTML = `<span class="check-name">${name}</span><span class="check-track"><span class="check-fill"></span></span><span class="check-val">0.00</span>`;
    pipeline.append(row);
    return { row, fill: row.querySelector('.check-fill'), val: row.querySelector('.check-val') };
  });

  let announced = false;
  pin(document.querySelector('.read-pin'), (t) => {
    rows.forEach((r, i) => {
      // All six start together, as they do in the thread pool, and finish at different speeds
      const speed = [0.62, 0.42, 0.34, 0.3, 0.72, 0.8][i];
      const p = smooth(range(t, 0.1, 0.1 + speed * 0.8));
      r.row.classList.toggle('on', t > 0.08);
      r.fill.style.width = `${p * CHECKS[i][1] * 100}%`;
      r.val.textContent = (p * CHECKS[i][1]).toFixed(2);
    });
    const done = t > 0.8;
    verdict.classList.toggle('on', done);
    headline.style.color = done ? '#8e8e93' : '';
    if (done && !announced) {
      announced = true;
      emit('bot', { do: 'surprised' });
    }
    if (t < 0.5) announced = false;
  });

  const input = document.getElementById('ling-input');
  const out = document.getElementById('ling-out');
  const render = () => {
    const f = features(input.value);
    out.innerHTML = f.map(([k, v, hot]) => `<div class="ling-item${hot ? ' hot' : ''}"><span>${k}</span><b>${v}</b></div>`).join('');
    if (f[6][2]) emit('bot', { do: 'suspicious' });
  };
  input.addEventListener('input', render);
  const f = features(input.value);
  out.innerHTML = f.map(([k, v, hot]) => `<div class="ling-item${hot ? ' hot' : ''}"><span>${k}</span><b>${v}</b></div>`).join('');
}
