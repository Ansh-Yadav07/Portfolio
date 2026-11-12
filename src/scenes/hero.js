import { clamp, emit, fitCanvas, lerp, pin, range, reducedMotion, smooth } from '../lib.js';
import { foundEgg } from '../eggs.js';

// The hero is the DDPM forward process run both ways:
//   x_t = sqrt(alphaBar) * x_0 + sqrt(1 - alphaBar) * noise
// Intro and scroll just move alphaBar, and scrolling swaps which x_0 the dots are heading for.

export function initHero() {
  const canvas = document.getElementById('hero-canvas');
  const ctx = canvas.getContext('2d');
  const tLabel = document.getElementById('hero-t');
  const classLabel = document.getElementById('hero-class');
  const line = document.getElementById('hero-line');
  const scrollHint = document.getElementById('hero-scroll');
  const hero = document.getElementById('hero');

  let W, H, dpr, N = 0;
  let nameX, nameY, wordX, wordY, noiseX, noiseY, offX, offY, sizes;
  let introStart = 0;
  let scrollP = 0;
  const mouse = { x: -9999, y: -9999, active: false };
  let attacks = 0;
  let attackUntil = 0;
  let solidName, solidWord;
  let hole = 0;
  let lastMove = 0;

  function sampleText(lines) {
    const off = document.createElement('canvas');
    off.width = Math.round(W);
    off.height = Math.round(H);
    const c = off.getContext('2d', { willReadFrequently: true });
    const portrait = W < H * 0.9;
    const maxW = W * (portrait ? 0.9 : 0.86);
    const maxH = H * (portrait ? 0.44 : 0.58);
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.font = `700 100px "Schibsted Grotesk Variable", Arial, sans-serif`;
    const widest = Math.max(...lines.map((l) => c.measureText(l).width));
    const size = Math.min((100 * maxW) / widest, maxH / (lines.length * 0.92));
    c.font = `700 ${size}px "Schibsted Grotesk Variable", Arial, sans-serif`;
    if ('letterSpacing' in c) c.letterSpacing = `${-size * 0.045}px`;
    const cy = H * (portrait ? 0.42 : 0.44);
    lines.forEach((l, i) => c.fillText(l, W / 2, cy + (i - (lines.length - 1) / 2) * size * 0.92));
    const data = c.getImageData(0, 0, off.width, off.height).data;
    const pts = [];
    const step = Math.max(2, Math.round(W / 480));
    for (let y = 0; y < off.height; y += step) {
      for (let x = 0; x < off.width; x += step) {
        if (data[(y * off.width + x) * 4 + 3] > 128) pts.push(x, y);
      }
    }
    // Shuffle so any subset still covers the letters evenly
    const n = pts.length / 2;
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pts[i * 2], pts[j * 2]] = [pts[j * 2], pts[i * 2]];
      [pts[i * 2 + 1], pts[j * 2 + 1]] = [pts[j * 2 + 1], pts[i * 2 + 1]];
    }
    return { pts, n, solid: { font: c.font, spacing: -size * 0.045, lines, cy, size } };
  }

  function build() {
    ({ w: W, h: H, dpr } = fitCanvas(canvas));
    const portrait = W < H * 0.9;
    const name = sampleText(portrait ? ['Ansh', 'Yadav'] : ['Ansh Yadav']);
    const word = sampleText(['Read.']);
    solidName = name.solid;
    solidWord = word.solid;
    N = Math.min(W < 700 ? 7000 : 18000, name.n);
    nameX = new Float32Array(N); nameY = new Float32Array(N);
    wordX = new Float32Array(N); wordY = new Float32Array(N);
    noiseX = new Float32Array(N); noiseY = new Float32Array(N);
    offX = new Float32Array(N); offY = new Float32Array(N);
    sizes = new Float32Array(N);
    const dot = Math.max(1.6, W / 620);
    for (let i = 0; i < N; i++) {
      nameX[i] = name.pts[i * 2]; nameY[i] = name.pts[i * 2 + 1];
      const k = i % word.n;
      wordX[i] = word.pts[k * 2]; wordY[i] = word.pts[k * 2 + 1];
      noiseX[i] = Math.random() * W; noiseY[i] = Math.random() * H;
      sizes[i] = dot * (0.8 + Math.random() * 0.5);
    }
  }

  function draw(now) {
    const introT = reducedMotion ? 1 : clamp((now - introStart) / 2600);
    const intro = smooth(introT);
    // Scroll: name -> pure noise (p .12-.5) -> "Read." (p .5-.88)
    const out = smooth(range(scrollP, 0.12, 0.5));
    const inn = smooth(range(scrollP, 0.5, 0.88));
    const heading = scrollP > 0.5;
    const alphaBar = heading ? inn : intro * (1 - out);
    const sa = Math.sqrt(alphaBar);
    const sn = Math.sqrt(1 - alphaBar);

    // Paper inverts to the night colour while the frame is mostly noise, so the next scene is already dark
    const flip = smooth(range(scrollP, 0.38, 0.6));
    const fg = Math.round(lerp(10, 245, flip));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = `rgb(${Math.round(lerp(245, 10, flip))},${Math.round(lerp(245, 10, flip))},${Math.round(lerp(243, 11, flip))})`;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = `rgb(${fg},${fg},${fg})`;

    const cx = W / 2, cy = H / 2;
    const tx = heading ? wordX : nameX;
    const ty = heading ? wordY : nameY;
    const jitter = sn > 0.02 ? 0.6 + sn * 1.2 : 0;
    const R = W < 700 ? 90 : 150;
    const moving = mouse.active && now - lastMove < 900;
    hole += ((moving ? R * 0.8 : 0) - hole) * 0.12;
    const attacking = now < attackUntil;
    // Once the type is fully resolved and nothing disturbs it, the dots underneath only roughen its edges
    const dotsHidden = !attacking && hole <= 2 && alphaBar >= 0.999;
    for (let i = 0; i < N && !dotsHidden; i++) {
      if (jitter) {
        noiseX[i] += (Math.random() - 0.5) * jitter;
        noiseY[i] += (Math.random() - 0.5) * jitter;
      }
      let x = cx + sa * (tx[i] - cx) + sn * (noiseX[i] - cx);
      let y = cy + sa * (ty[i] - cy) + sn * (noiseY[i] - cy);
      // The cursor adds noise locally, and it heals back
      const dx = x - mouse.x, dy = y - mouse.y;
      const d2 = dx * dx + dy * dy;
      if (mouse.active && d2 < R * R) {
        const f = (1 - Math.sqrt(d2) / R) * 3;
        offX[i] += (Math.random() - 0.5) * f * 5 + (dx / R) * f;
        offY[i] += (Math.random() - 0.5) * f * 5 + (dy / R) * f;
      }
      offX[i] *= 0.92; offY[i] *= 0.92;
      x += offX[i]; y += offY[i];
      if (attacking) {
        // Barely any perturbation at all. The classifier falls for it anyway.
        x += (Math.random() - 0.5) * 2.2;
        y += (Math.random() - 0.5) * 2.2;
      }
      ctx.fillRect(x, y, sizes[i], sizes[i]);
    }

    // The last few steps resolve into real type, the crisp x_0. The cursor keeps a hole of noise open in it.
    const solidAlpha = attacking ? 0 : range(alphaBar, 0.975, 0.999);
    if (solidAlpha > 0) {
      const sol = heading ? solidWord : solidName;
      ctx.save();
      if (hole > 2) {
        ctx.beginPath();
        ctx.rect(0, 0, W, H);
        ctx.arc(mouse.x, mouse.y, hole, 0, Math.PI * 2);
        ctx.clip('evenodd');
      }
      // Cover the dots first, so type sits clean on paper rather than on grain
      ctx.globalAlpha = solidAlpha;
      ctx.font = sol.font;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if ('letterSpacing' in ctx) ctx.letterSpacing = `${sol.spacing}px`;
      sol.lines.forEach((l, i) => ctx.fillText(l, W / 2, sol.cy + (i - (sol.lines.length - 1) / 2) * sol.size * 0.92));
      ctx.restore();
    }

    const t = Math.round((1 - alphaBar) * 1000);
    tLabel.textContent = `t = ${String(t).padStart(4, ' ')}`;
    tLabel.parentElement.style.color = flip > 0.5 ? '#8e8e93' : '';
    // The nav reads this to switch to its dark theme while the hero is dark
    if (hero.classList.contains('is-dark') !== flip > 0.5) {
      hero.classList.toggle('is-dark', flip > 0.5);
      emit('hero-dark');
    }
    const settled = intro > 0.995 && scrollP < 0.1;
    line.classList.toggle('on', settled);
    scrollHint.classList.toggle('on', settled && scrollP < 0.01);
    if (now >= attackUntil && settled && classLabel.classList.contains('flip') === false) {
      classLabel.textContent = 'class: human, student   97.1%';
    } else if (!settled && !attacking) {
      classLabel.textContent = '';
    }
    if (introT === 1 && !draw.announced) {
      draw.announced = true;
      emit('bot', { do: 'wave' });
    }
  }

  function attack() {
    if (scrollP > 0.1) return;
    attacks++;
    attackUntil = performance.now() + 700;
    classLabel.classList.add('flip');
    classLabel.textContent = 'ε = 0.007 → class: gibbon   99.3%';
    emit('bot', { do: 'confused' });
    if (attacks >= 1) foundEgg('gibbon', 'Adversarial attack: Ansh is now a gibbon');
    clearTimeout(attack.timer);
    attack.timer = setTimeout(() => classLabel.classList.remove('flip'), 3200);
  }

  canvas.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = e.clientX - r.left;
    mouse.y = e.clientY - r.top;
    mouse.active = true;
    lastMove = performance.now();
  }, { passive: true });
  canvas.addEventListener('pointerleave', () => (mouse.active = false));
  canvas.addEventListener('click', attack);

  pin(hero, (t) => (scrollP = t));

  let raf = 0, running = false;
  const loop = (now) => {
    if (!running) return;
    // Fonts can arrive late on a slow connection, and there is nothing to draw until they do
    if (solidName) draw(now);
    raf = requestAnimationFrame(loop);
  };
  new IntersectionObserver(([e]) => {
    if (e.isIntersecting && !running) {
      running = true;
      raf = requestAnimationFrame(loop);
    } else if (!e.isIntersecting) {
      running = false;
      cancelAnimationFrame(raf);
    }
  }).observe(canvas);

  const start = () => {
    build();
    introStart = performance.now();
  };
  let resizeTimer;
  let lastW = innerWidth;
  addEventListener('resize', () => {
    // Mobile URL bars fire height-only resizes; rebuilding on those makes the dots jump
    if (innerWidth === lastW) return;
    lastW = innerWidth;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(build, 200);
  });
  document.fonts.load('700 100px "Schibsted Grotesk Variable"').finally(start);
}
