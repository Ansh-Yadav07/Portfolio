import { emit, fitCanvas, reducedMotion, whenVisible } from '../lib.js';

const PAL = {
  r: '#e5352b', R: '#a81f1a', g: '#3fa34d', G: '#25692f', o: '#f58a1f', O: '#c4640d',
  y: '#f4d63a', Y: '#c9a81c', p: '#6b2f8f', P: '#46185f', w: '#f3efe2', W: '#c9c3ae',
  b: '#a8784a', B: '#7a5430', m: '#b0204f', M: '#7d1236', l: '#8fd14f', L: '#5fa32c',
};

// Hand-placed pixel vegetables, using class names from the model's labels.json
const VEG = {
  tomato: ['....GgG.....', '...gGGGg....', '..rrrGrrr...', '.rrrrrrrrr..', '.rwrrrrrrr..', 'rrwrrrrrrrR.', 'rrrrrrrrrrR.', 'rrrrrrrrrrR.', '.rrrrrrrrR..', '.rrrrrrRRR..', '..RRRRRRR...'],
  carrot: ['.......g.g..', '......ggg...', '.......gG...', '......ooo...', '.....oooo...', '.....oOoo...', '....oooo....', '....ooOo....', '...oooo.....', '...oOo......', '..ooo.......', '..oo........', '.o..........'],
  eggplant: ['........GG..', '.......GgG..', '......GGG...', '.....pppP...', '....pwpppP..', '...pwppppP..', '..ppppppP...', '.pppppppP...', '.ppppppPP...', '.pppppPP....', '..PPPPP.....'],
  lemon: ['..........', '...yyyy...', '..yywyyyY.', '.yywyyyyyY', 'yyyyyyyyyY', 'yyyyyyyyyY', '.yyyyyyyY.', '..yyyyYY..', '...YYYY...'],
  capsicum: ['....GG......', '....gG......', '.rrrgrrrr...', 'rrwrrrrrrR..', 'rwwrrrRrrR..', 'rwrrrrRrrR..', 'rrrrrrRrrR..', 'rrrrrrRrrR..', '.rrrrrRrR...', '.rrRrRRrR...', '..RR.RRR....'],
  green_chilli: ['G...........', '.G..........', '.gg.........', '.lgg........', '..lgg.......', '..lggg......', '...lggg.....', '....lggg....', '.....lggg...', '......lgggg.', '........Lg..'],
  potato: ['............', '...bbbbbb...', '.bbbbbbbbbb.', 'bbBbbbbbBbbb', 'bbbbbbbbbbbB', 'bbbbBbbbbbbB', 'bbbbbbbbBbbB', '.bbbbbbbbbB.', '..BBBBBBBB..'],
  cauliflower: ['...wwwwww...', '..wwwWwwww..', '.wwWwwwwWww.', '.wwwwwWwwww.', 'gwwWwwwwWwwg', 'ggwwwWwwwwgg', 'Gggwwwwwwgg.', '.GgggggggG..', '..GGgggGG...', '....GGG.....'],
  beetroot: ['..g...g.g...', '..gg.gg.g...', '...gggggg...', '....mmgm....', '..mmmmmmmm..', '.mmmmmmmmmM.', '.mwmmmmmmmM.', '.mmmmmmmmmM.', '..mmmmmmMM..', '...mMMMMM...', '.....MM.....', '.....M......'],
  cucumber: ['..........gG', '.........ggG', '........glgG', '.......glgG.', '......ggggG.', '.....glgGG..', '....ggggG...', '...glgGG....', '..ggggG.....', '.glgGG......', '.gGG........'],
};

function spriteCanvas(rows, s) {
  const c = document.createElement('canvas');
  const w = Math.max(...rows.map((r) => r.length));
  c.width = w * s; c.height = rows.length * s;
  const x = c.getContext('2d');
  rows.forEach((row, j) => [...row].forEach((ch, i) => {
    if (PAL[ch]) { x.fillStyle = PAL[ch]; x.fillRect(i * s, j * s, s, s); }
  }));
  return c;
}

export function initSee() {
  const canvas = document.getElementById('see-canvas');
  const ctx = canvas.getContext('2d');
  const count = document.getElementById('vf-count');
  let W, H, dpr, items = [];
  const cursor = { x: 0, y: 0, active: false, last: 0 };
  const found = new Set();

  function layout() {
    ({ w: W, h: H, dpr } = fitCanvas(canvas));
    const names = Object.keys(VEG);
    const cols = W < 460 ? 3 : 4;
    const rows = Math.ceil(names.length / cols);
    const cell = Math.min(W / cols, (H - 96) / rows);
    const scale = Math.max(3, Math.floor(cell / 19));
    const offX = (W - cell * cols) / 2;
    items = names.map((name, i) => {
      const img = spriteCanvas(VEG[name], scale);
      const c = i % cols, r = Math.floor(i / cols);
      // A little disorder, seeded by index so it stays put across resizes
      const jx = ((i * 37) % 11 - 5) / 5 * cell * 0.1;
      const jy = ((i * 53) % 9 - 4) / 4 * cell * 0.09;
      const x = offX + c * cell + (cell - img.width) / 2 + jx;
      const y = 44 + r * cell + (cell - img.height) / 2 + jy;
      const base = 0.86 + ((i * 29) % 13) / 100;
      return { name, img, x, y, w: img.width, h: img.height, base, on: 0 };
    });
  }

  function draw(now) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.imageSmoothingEnabled = false;
    ctx.font = '500 11px "IBM Plex Mono", monospace';
    ctx.textBaseline = 'middle';

    // With no pointer the camera pans on its own, so phones still see detections
    const idle = !cursor.active || now - cursor.last > 2500;
    const t = reducedMotion ? 0 : now / 1000;
    const sx = idle ? W / 2 + Math.sin(t * 0.7) * W * 0.4 : cursor.x;
    const sy = idle ? H / 2 + Math.cos(t * 0.53) * H * 0.34 : cursor.y;
    const reach = Math.max(W, H) * 0.24;

    for (const it of items) {
      ctx.drawImage(it.img, it.x, it.y);
      const dx = it.x + it.w / 2 - sx, dy = it.y + it.h / 2 - sy;
      const seen = dx * dx + dy * dy < reach * reach;
      it.on += ((seen ? 1 : 0) - it.on) * 0.22;
      if (seen && !found.has(it.name)) {
        found.add(it.name);
        count.textContent = `${found.size} found`;
        if (it.name === 'carrot') emit('bot', { do: 'happy' });
      }
      if (it.on > 0.05) {
        const pad = 6 + (1 - it.on) * 18;
        const x = it.x - pad, y = it.y - pad, w = it.w + pad * 2, h = it.h + pad * 2;
        ctx.globalAlpha = it.on;
        ctx.strokeStyle = '#ffc812';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, w, h);
        // Confidence wobbles frame to frame, the way a live detector's does
        const conf = Math.min(0.99, it.base + Math.sin(now / 170 + it.x) * 0.012);
        const label = `${it.name} ${conf.toFixed(2)}`;
        const tw = ctx.measureText(label).width + 10;
        ctx.fillStyle = '#ffc812';
        ctx.fillRect(x - 1, y - 18, tw, 18);
        ctx.fillStyle = '#000';
        ctx.fillText(label, x + 4, y - 8.5);
        ctx.globalAlpha = 1;
      }
    }
  }

  const move = (e) => {
    const r = canvas.getBoundingClientRect();
    cursor.x = e.clientX - r.left;
    cursor.y = e.clientY - r.top;
    cursor.active = true;
    cursor.last = performance.now();
  };
  canvas.addEventListener('pointermove', move, { passive: true });
  canvas.addEventListener('pointerdown', move, { passive: true });
  canvas.addEventListener('pointerleave', () => (cursor.active = false));

  layout();
  let lastW = innerWidth;
  addEventListener('resize', () => {
    if (innerWidth !== lastW) { lastW = innerWidth; layout(); }
  });
  whenVisible(canvas, draw);
}
