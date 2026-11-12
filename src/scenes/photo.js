import { clamp, emit, reducedMotion, smooth } from '../lib.js';

// The model card's "sample output": the photo starts as a halftone of pure noise and
// denoises into place, the same forward process as the hero, run on a portrait.
// The whole section stays hidden until /ansh.jpg actually loads.

export function initPhoto() {
  const section = document.getElementById('mc-sample');
  const img = document.getElementById('mc-img');
  const canvas = document.getElementById('mc-noise');
  const tLabel = document.getElementById('mc-t');
  if (!section || !img || !canvas) return;
  // The photo is far down the page, so it only downloads once this scene starts
  if (img.dataset.src && !img.getAttribute('src')) img.src = img.dataset.src;

  const start = () => {
    section.hidden = false;
    if (reducedMotion) {
      canvas.remove();
      tLabel.textContent = 't = 0';
      return;
    }
    setup();
  };
  if (img.complete && img.naturalWidth) start();
  else {
    img.addEventListener('load', start, { once: true });
    img.addEventListener('error', () => section.remove(), { once: true });
  }

  function setup() {
    const ctx = canvas.getContext('2d');
    let W = 0, dpr = 1, N = 0;
    let tx, ty, nx, ny, rad;
    let t0 = 0, raf = 0;
    const DURATION = 2400;

    function sample() {
      const box = canvas.getBoundingClientRect();
      W = box.width;
      dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(W * dpr);
      const step = Math.max(4, W / 52);
      const cells = Math.floor(W / step);
      const off = document.createElement('canvas');
      off.width = off.height = cells;
      const c = off.getContext('2d', { willReadFrequently: true });
      // Centre-crop to a square, like object-fit: cover
      const s = Math.min(img.naturalWidth, img.naturalHeight);
      c.drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, cells, cells);
      const data = c.getImageData(0, 0, cells, cells).data;
      N = cells * cells;
      tx = new Float32Array(N); ty = new Float32Array(N);
      nx = new Float32Array(N); ny = new Float32Array(N);
      rad = new Float32Array(N);
      for (let i = 0; i < N; i++) {
        const x = i % cells, y = (i / cells) | 0;
        const k = i * 4;
        const lum = (0.299 * data[k] + 0.587 * data[k + 1] + 0.114 * data[k + 2]) / 255;
        tx[i] = (x + 0.5) * step; ty[i] = (y + 0.5) * step;
        nx[i] = Math.random() * W; ny[i] = Math.random() * W;
        rad[i] = (1 - lum) * step * 0.62;
      }
    }

    function frame(now) {
      const p = clamp((now - t0) / DURATION);
      // Halftone resolves first, then the real photo fades up underneath
      const alphaBar = smooth(clamp(p / 0.75));
      const sa = Math.sqrt(alphaBar), sn = Math.sqrt(1 - alphaBar);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = '#f5f5f3';
      ctx.fillRect(0, 0, W, W);
      ctx.fillStyle = '#0a0a0b';
      const jitter = sn * 1.4;
      ctx.beginPath();
      for (let i = 0; i < N; i++) {
        if (jitter) {
          nx[i] += (Math.random() - 0.5) * jitter;
          ny[i] += (Math.random() - 0.5) * jitter;
        }
        const x = sa * tx[i] + sn * nx[i];
        const y = sa * ty[i] + sn * ny[i];
        const r = Math.max(0.6, rad[i] * (0.35 + 0.65 * alphaBar));
        ctx.moveTo(x + r, y);
        ctx.arc(x, y, r, 0, Math.PI * 2);
      }
      ctx.fill();
      canvas.style.opacity = String(1 - smooth(clamp((p - 0.72) / 0.28)));
      tLabel.textContent = `t = ${Math.round(1000 * (1 - alphaBar))}`;
      if (p < 1) raf = requestAnimationFrame(frame);
      else emit('bot', { do: 'happy' });
    }

    function run() {
      cancelAnimationFrame(raf);
      sample();
      t0 = performance.now();
      raf = requestAnimationFrame(frame);
    }

    // Denoise once when the card scrolls in, and again whenever someone hovers to re-sample
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        io.disconnect();
        run();
      }
    }, { threshold: 0.5 });
    io.observe(canvas);
    canvas.parentElement.addEventListener('pointerenter', () => {
      if (performance.now() - t0 > DURATION) run();
    });
  }
}
