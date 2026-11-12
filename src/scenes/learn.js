import { emit, fitCanvas, whenVisible } from '../lib.js';

// A from-scratch MLP: tanh hidden layers, sigmoid output, binary cross-entropy, SGD with momentum.
class Net {
  constructor(sizes) {
    this.sizes = sizes;
    this.W = [];
    this.b = [];
    this.vW = [];
    this.vb = [];
    for (let l = 1; l < sizes.length; l++) {
      const m = sizes[l], n = sizes[l - 1];
      const scale = Math.sqrt(1 / n);
      this.W.push(Array.from({ length: m }, () => Float64Array.from({ length: n }, () => (Math.random() * 2 - 1) * scale)));
      this.b.push(new Float64Array(m));
      this.vW.push(Array.from({ length: m }, () => new Float64Array(n)));
      this.vb.push(new Float64Array(m));
    }
  }

  forward(x, y) {
    let a = [x, y];
    const L = this.W.length;
    this.as = [a];
    this.zs = [];
    for (let l = 0; l < L; l++) {
      const W = this.W[l], b = this.b[l];
      const out = new Float64Array(W.length), z = new Float64Array(W.length);
      for (let i = 0; i < W.length; i++) {
        let s = b[i];
        const row = W[i];
        for (let j = 0; j < row.length; j++) s += row[j] * a[j];
        z[i] = s;
        out[i] = l === L - 1 ? 1 / (1 + Math.exp(-s)) : Math.tanh(s);
      }
      a = out;
      this.as.push(a);
      this.zs.push(z);
    }
    return a[0];
  }

  // Cheaper version for painting the decision surface
  predict(x, y) {
    let a = [x, y];
    const L = this.W.length;
    for (let l = 0; l < L; l++) {
      const W = this.W[l], b = this.b[l];
      const out = new Array(W.length);
      for (let i = 0; i < W.length; i++) {
        let s = b[i];
        const row = W[i];
        for (let j = 0; j < row.length; j++) s += row[j] * a[j];
        out[i] = l === L - 1 ? 1 / (1 + Math.exp(-s)) : Math.tanh(s);
      }
      a = out;
    }
    return a[0];
  }

  // One full-batch step. Returns mean loss and accuracy before the update.
  step(data, lr, momentum = 0.9) {
    const L = this.W.length;
    const gW = this.W.map((W) => W.map((r) => new Float64Array(r.length)));
    const gb = this.b.map((b) => new Float64Array(b.length));
    let loss = 0, correct = 0;
    for (const { x, y, c } of data) {
      const p = this.forward(x, y);
      const q = Math.min(1 - 1e-7, Math.max(1e-7, p));
      loss += -(c * Math.log(q) + (1 - c) * Math.log(1 - q));
      if ((p > 0.5) === (c === 1)) correct++;
      let delta = [p - c]; // d(BCE)/dz for a sigmoid output
      for (let l = L - 1; l >= 0; l--) {
        const prev = this.as[l];
        const W = this.W[l];
        const next = new Float64Array(W[0].length);
        for (let i = 0; i < W.length; i++) {
          gb[l][i] += delta[i];
          for (let j = 0; j < W[i].length; j++) {
            gW[l][i][j] += delta[i] * prev[j];
            next[j] += delta[i] * W[i][j];
          }
        }
        if (l > 0) {
          const act = this.as[l];
          for (let j = 0; j < next.length; j++) next[j] *= 1 - act[j] * act[j]; // tanh'
        }
        delta = next;
      }
    }
    const n = data.length;
    for (let l = 0; l < L; l++) {
      for (let i = 0; i < this.W[l].length; i++) {
        for (let j = 0; j < this.W[l][i].length; j++) {
          this.vW[l][i][j] = momentum * this.vW[l][i][j] - lr * (gW[l][i][j] / n);
          this.W[l][i][j] += this.vW[l][i][j];
        }
        this.vb[l][i] = momentum * this.vb[l][i] - lr * (gb[l][i] / n);
        this.b[l][i] += this.vb[l][i];
      }
    }
    return { loss: loss / n, acc: correct / n };
  }
}

const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) * 0.6;

const PRESETS = {
  xor() {
    const out = [];
    for (let i = 0; i < 80; i++) {
      const sx = Math.random() < 0.5 ? -1 : 1, sy = Math.random() < 0.5 ? -1 : 1;
      out.push({ x: sx * 0.5 + gauss() * 0.42, y: sy * 0.5 + gauss() * 0.42, c: sx * sy > 0 ? 1 : 0 });
    }
    return out;
  },
  rings() {
    const out = [];
    for (let i = 0; i < 120; i++) {
      const a = Math.random() * Math.PI * 2;
      const c = i % 2;
      const r = (c ? 0.28 : 0.76) + gauss() * 0.14;
      out.push({ x: Math.cos(a) * r, y: Math.sin(a) * r, c });
    }
    return out;
  },
  spiral() {
    const out = [];
    for (let i = 0; i < 70; i++) {
      const t = i / 70, r = 0.08 + t * 0.82, a = t * Math.PI * 3.1;
      out.push({ x: Math.cos(a) * r + gauss() * 0.04, y: Math.sin(a) * r + gauss() * 0.04, c: 1 });
      out.push({ x: -Math.cos(a) * r + gauss() * 0.04, y: -Math.sin(a) * r + gauss() * 0.04, c: 0 });
    }
    return out;
  },
};

export function initLearn() {
  const canvas = document.getElementById('lab-canvas');
  const ctx = canvas.getContext('2d');
  const curve = document.getElementById('lab-curve');
  const curveCtx = curve.getContext('2d');
  const empty = document.getElementById('lab-empty');
  const lossEl = document.getElementById('lab-loss');
  const accEl = document.getElementById('lab-acc');
  const stepsEl = document.getElementById('lab-steps');
  const lrEl = document.getElementById('lab-lr');
  const lrVal = document.getElementById('lab-lr-val');

  const RES = 72;
  const field = document.createElement('canvas');
  field.width = field.height = RES;
  const fctx = field.getContext('2d');
  const img = fctx.createImageData(RES, RES);

  let net = new Net([2, 12, 12, 1]);
  let data = [];
  let paint = 1;
  let steps = 0;
  let history = [];
  let last = { loss: 0, acc: 0 };
  let lr = 0.03;
  let mood = 'none';
  let size, dpr;

  const resize = () => { ({ w: size, dpr } = fitCanvas(canvas)); fitCurve(); };
  const fitCurve = () => { fitCanvas(curve); };
  resize();
  addEventListener('resize', resize);

  const setLr = () => {
    // Log scale from 0.001 to 1: where a learning rate actually behaves differently
    lr = 0.001 * Math.pow(1000, lrEl.value / 100 * 0.9);
    lrVal.textContent = lr < 0.1 ? lr.toFixed(3) : lr.toFixed(2);
  };
  lrEl.addEventListener('input', setLr);
  setLr();

  const reset = (keep) => {
    net = new Net([2, 12, 12, 1]);
    steps = 0;
    history = [];
    mood = 'none';
    if (!keep) data = [];
    empty.classList.toggle('off', data.length > 0);
    if (!data.length) { lossEl.textContent = 'n/a'; accEl.textContent = 'n/a'; stepsEl.textContent = '0'; }
  };

  document.querySelectorAll('.seg button').forEach((b) => b.addEventListener('click', () => {
    document.querySelectorAll('.seg button').forEach((o) => o.classList.remove('on'));
    b.classList.add('on');
    paint = +b.dataset.class;
  }));
  document.querySelectorAll('[data-preset]').forEach((b) => b.addEventListener('click', () => {
    const name = b.dataset.preset;
    if (name === 'clear') return reset(false);
    data = PRESETS[name]();
    reset(true);
    emit('bot', { do: 'curious' });
  }));

  canvas.addEventListener('click', (e) => {
    const r = canvas.getBoundingClientRect();
    data.push({ x: ((e.clientX - r.left) / r.width) * 2 - 1, y: ((e.clientY - r.top) / r.height) * 2 - 1, c: paint });
    empty.classList.add('off');
    mood = 'none';
  });

  const CA = [39, 71, 255], CB = [255, 74, 28];

  function paintField() {
    for (let j = 0; j < RES; j++) {
      for (let i = 0; i < RES; i++) {
        const p = data.length ? net.predict((i / (RES - 1)) * 2 - 1, (j / (RES - 1)) * 2 - 1) : 0.5;
        const c = p > 0.5 ? CA : CB;
        const k = Math.abs(p - 0.5) * 2;
        const a = data.length && steps ? k * 0.55 : 0;
        const o = (j * RES + i) * 4;
        // Blend toward the card colour (--white), so an untrained surface matches the stage
        img.data[o] = 251 + (c[0] - 251) * a;
        img.data[o + 1] = 251 + (c[1] - 251) * a;
        img.data[o + 2] = 249 + (c[2] - 249) * a;
        img.data[o + 3] = 255;
      }
    }
    fctx.putImageData(img, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(field, 0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (const d of data) {
      const x = (d.x + 1) / 2 * size, y = (d.y + 1) / 2 * size;
      ctx.beginPath();
      ctx.arc(x, y, 5.5, 0, Math.PI * 2);
      ctx.fillStyle = d.c ? '#2747ff' : '#ff4a1c';
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#fff';
      ctx.stroke();
    }
  }

  function paintCurve() {
    const w = curve.width, h = curve.height;
    curveCtx.clearRect(0, 0, w, h);
    if (history.length < 2) return;
    const max = Math.max(0.75, ...history);
    curveCtx.beginPath();
    history.forEach((v, i) => {
      const x = (i / (history.length - 1)) * w;
      const y = h - (v / max) * (h - 4) - 2;
      i ? curveCtx.lineTo(x, y) : curveCtx.moveTo(x, y);
    });
    curveCtx.strokeStyle = '#0a0a0b';
    curveCtx.lineWidth = 2 * (devicePixelRatio > 1 ? 2 : 1);
    curveCtx.stroke();
  }

  let frame = 0;
  function loop() {
    frame++;
    if (data.length >= 2 && new Set(data.map((d) => d.c)).size === 2) {
      for (let i = 0; i < 6; i++) { last = net.step(data, lr); steps++; }
      if (!Number.isFinite(last.loss)) { reset(true); return; }
      if (frame % 3 === 0) {
        history.push(last.loss);
        if (history.length > 240) history = history.filter((_, i) => i % 2 === 0);
      }
      lossEl.textContent = last.loss.toFixed(3);
      accEl.textContent = `${Math.round(last.acc * 100)}%`;
      stepsEl.textContent = steps.toLocaleString('en-IN');

      // The bot watches the same numbers you do
      if (mood !== 'solved' && last.loss < 0.08 && steps > 200) { mood = 'solved'; emit('bot', { do: 'happy' }); }
      else if (mood === 'none' && steps > 1500 && last.loss > 0.5) { mood = 'stuck'; emit('bot', { do: 'confused' }); }
    }
    paintField();
    if (frame % 3 === 0) paintCurve();
  }

  // Start with a problem already on screen, so there's something to watch on arrival
  data = PRESETS.xor();
  empty.classList.add('off');
  whenVisible(canvas, loop);
}
