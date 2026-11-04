import { emit, fitCanvas, reducedMotion, whenVisible } from '../lib.js';

// A sketch of the MAVIS console: each dash is a network flow crossing the sensor line.
export function initGuard() {
  const stage = document.getElementById('guard-stage');
  const canvas = document.getElementById('guard-canvas');
  const ctx = canvas.getContext('2d');
  const status = document.getElementById('guard-status');
  const btn = document.getElementById('guard-attack');
  const card = document.getElementById('alert-card');
  const risk = document.getElementById('alert-risk');
  const response = document.getElementById('alert-response');

  let W, H, dpr;
  let flows = [];
  let phase = 'normal'; // normal -> attack -> blocked -> normal
  let phaseAt = 0;
  let lastNow = 0;
  const LANES = 26;

  const resize = () => ({ w: W, h: H, dpr } = fitCanvas(canvas));
  resize();
  addEventListener('resize', resize);

  function spawn(evil) {
    const lane = evil ? Math.floor(Math.random() * LANES) : Math.floor(Math.random() * LANES);
    flows.push({
      x: -60, lane,
      len: evil ? 6 + Math.random() * 10 : 18 + Math.random() * 70,
      v: evil ? 620 + Math.random() * 320 : 90 + Math.random() * 170,
      evil, dead: 0,
    });
  }

  function setStatus(text) {
    status.lastChild.textContent = text;
  }

  function draw(now) {
    const dt = Math.min(50, now - lastNow) / 1000;
    lastNow = now;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    const sensor = W * 0.62;
    const top = 62, laneH = (H - top - 14) / LANES;

    ctx.fillStyle = 'rgba(255,255,255,.1)';
    ctx.fillRect(sensor, top, 1, H - top - 14);

    if (Math.random() < dt * 12) spawn(false);
    if (phase === 'attack' && !reducedMotion) for (let i = 0; i < 3; i++) spawn(true);
    if (phase === 'attack' && reducedMotion && Math.random() < 0.3) spawn(true);

    ctx.lineCap = 'round';
    for (const f of flows) {
      f.x += f.v * dt;
      const blocked = f.evil && phase !== 'attack' && f.x > sensor - f.len;
      if (blocked) { f.x = sensor - f.len; f.dead += dt * 3; }
      const y = top + (f.lane + 0.5) * laneH;
      ctx.globalAlpha = f.evil ? Math.max(0, 1 - f.dead) : 0.5;
      ctx.strokeStyle = f.evil ? '#ff4a1c' : '#d9d9dc';
      ctx.lineWidth = f.evil ? 3 : 2;
      ctx.beginPath();
      ctx.moveTo(f.x, y);
      ctx.lineTo(f.x + f.len, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    flows = flows.filter((f) => f.x < W + 100 && f.dead < 1);

    if (phase === 'attack') {
      const t = (now - phaseAt) / 1000;
      risk.textContent = Math.min(94, Math.round(t * 70));
      if (t > 2.6) {
        phase = 'blocked';
        phaseAt = now;
        response.textContent = 'Source blocked (dry run). Incident contained.';
        setStatus('Contained');
        stage.classList.remove('alarm');
        emit('bot', { do: 'relieved' });
      }
    } else if (phase === 'blocked' && now - phaseAt > 3800) {
      phase = 'normal';
      card.classList.remove('on');
      setStatus('Watching flows');
      btn.disabled = false;
    }
  }

  btn.addEventListener('click', () => {
    phase = 'attack';
    phaseAt = performance.now();
    btn.disabled = true;
    risk.textContent = '0';
    response.textContent = 'Blocking source (dry run)…';
    card.classList.add('on');
    stage.classList.add('alarm');
    setStatus('Under attack');
    emit('bot', { do: 'panic' });
  });

  whenVisible(canvas, draw);
}
