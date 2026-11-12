import { clamp, emit, fitCanvas, reducedMotion, whenVisible } from '../lib.js';

const CAPTIONS = [
  'Every line is one connection passing through MAVIS into the network. Right now it is all ordinary traffic, so everything gets through. Press “Simulate an attack” to see what changes.',
  'An attacker starts trying hundreds of ports, the numbered doors into a network, to find one left open. This is called a port scan.',
  'MAVIS spots it: one sender, hundreds of tiny connections in a few seconds. Ordinary traffic never looks like that, so the risk score climbs.',
  'MAVIS blocks that one sender at the line. The orange connections stop there, and ordinary traffic keeps flowing as before.',
];
const STATUS = ['Watching traffic', 'Under attack', 'Attack spotted', 'Attack blocked'];

// Seconds after the press. Slow enough to read each caption before the next one lands.
const SPOT_AT = 2;
const BLOCK_AT = 4.2;
const STOP_AT = BLOCK_AT + 4; // the attacker keeps trying, and keeps being stopped, a while longer
const FADE = 0.6;

const LANES = 26;
const ORANGE = '#ff4a1c';
const LABEL = '#8e8e93';

// A sketch of the MAVIS console: each dash is one connection crossing the checkpoint line.
export function initGuard() {
  const stage = document.getElementById('guard-stage');
  const canvas = document.getElementById('guard-canvas');
  const ctx = canvas.getContext('2d');
  const status = document.getElementById('guard-status');
  const btn = document.getElementById('guard-attack');
  const card = document.getElementById('alert-card');
  const risk = document.getElementById('alert-risk');
  const response = document.getElementById('alert-response');
  const steps = [...document.querySelectorAll('#guard-steps li')];
  const caption = document.getElementById('guard-caption');

  let W, H, dpr;
  let flows = [];
  let runAt = 0; // when the button was last pressed, 0 before the first press
  let step = 0;
  let owed = 0; // fractional attack dashes carried between frames
  let lastNow = 0;
  let span = 400; // attacker to checkpoint, so every attack dash takes about a second to cross

  const resize = () => ({ w: W, h: H, dpr } = fitCanvas(canvas));
  resize();
  addEventListener('resize', resize);

  function spawn(evil) {
    const lane = Math.floor(Math.random() * LANES);
    flows.push(evil
      // s is the distance travelled along the path from the attacker to its lane and on through the line
      ? { s: 0, lane, len: Math.max(10, span * 0.03) * (1 + Math.random()), v: span * (0.8 + Math.random() * 0.4), evil, dead: 0, held: false }
      : { x: -60, lane, len: 18 + Math.random() * 70, v: 90 + Math.random() * 170, evil });
  }

  function setStep(n) {
    if (n === step) return;
    step = n;
    steps.forEach((s, i) => {
      s.classList.toggle('on', i < n);
      s.classList.toggle('now', i === n - 1);
    });
    if (caption.textContent !== CAPTIONS[n - 1]) caption.textContent = CAPTIONS[n - 1];
    status.lastChild.textContent = STATUS[n - 1];
    stage.classList.toggle('alarm', n === 2 || n === 3);
    if (n === 2) {
      btn.disabled = true;
      btn.textContent = 'Simulating…';
      emit('bot', { do: 'panic' });
    } else if (n === 3) {
      card.classList.add('on');
    } else if (n === 4) {
      response.textContent = 'Blocked the sender';
      btn.disabled = false;
      btn.textContent = 'Run it again';
      emit('bot', { do: 'relieved' });
    }
  }

  function label(text, x, y, align) {
    ctx.textAlign = align;
    ctx.fillText(text, x, y);
  }

  function draw(now) {
    const dt = Math.min(50, now - lastNow) / 1000;
    lastNow = now;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // Lanes start below the status bar and the three labels
    const top = 92, bottom = H - 14, laneH = (bottom - top) / LANES;
    // Phones pull the line left so MAVIS and YOUR NETWORK do not run together, and lift the
    // attacker so the alert card, which fills the lower half there, never hides it
    const narrow = W < 560;
    const sensor = W * (narrow ? 0.55 : 0.62);
    const ax = 22, ay = top + (bottom - top) * (narrow ? 0.3 : 0.5);
    span = sensor - ax;
    const laneY = (lane) => top + (lane + 0.5) * laneH;

    const t = runAt ? (now - runAt) / 1000 : -1;
    if (runAt) setStep(t < SPOT_AT ? 2 : t < BLOCK_AT ? 3 : 4);
    if (step >= 3) risk.textContent = reducedMotion ? 94 : Math.round(94 * clamp((t - SPOT_AT) / 1.4));
    const sending = runAt && t < STOP_AT;
    const blocking = step === 4;

    ctx.fillStyle = 'rgba(255,255,255,.22)';
    ctx.fillRect(sensor - 1, top - 4, 2, bottom - top + 4);

    ctx.font = '400 11px "IBM Plex Mono", ui-monospace, Menlo, monospace';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = LABEL;
    // Spaced caps where there is room; phones need every pixel between MAVIS and YOUR NETWORK
    ctx.letterSpacing = narrow ? '0px' : '1px';
    label('INTERNET', 18, top - 14, 'left');
    label('MAVIS', sensor, top - 14, 'center');
    label('YOUR NETWORK', W - 18, top - 14, 'right');

    if (Math.random() < dt * 12) spawn(false);
    if (sending) {
      owed += dt * (reducedMotion ? 8 : 40);
      for (; owed >= 1; owed--) spawn(true);
    }

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const f of flows) {
      const y = laneY(f.lane);
      if (!f.evil) {
        f.x += f.v * dt;
        ctx.globalAlpha = 0.5;
        ctx.strokeStyle = '#d9d9dc';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(f.x, y);
        ctx.lineTo(f.x + f.len, y);
        ctx.stroke();
        continue;
      }
      // Straight from the attacker to this lane at the line, then on into the network
      const reach = Math.hypot(sensor - ax, y - ay);
      const at = (s) => (s <= reach
        ? [ax + (sensor - ax) * (s / reach), ay + (y - ay) * (s / reach)]
        : [sensor + s - reach, y]);
      if (!f.held) f.s += f.v * dt;
      if (blocking && !f.held) {
        if (f.s - f.len >= reach) f.dead += dt * 5; // already inside when the block landed: gone in a blink
        else if (f.s >= reach) { f.s = reach; f.held = true; }
      }
      if (f.held) f.dead += dt * 3;
      const tail = Math.max(0, f.s - f.len);
      if (f.s <= 0) continue;
      ctx.globalAlpha = 0.9 * Math.max(0, 1 - f.dead);
      ctx.strokeStyle = ORANGE;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(...at(tail));
      if (tail < reach && f.s > reach) ctx.lineTo(sensor, y);
      ctx.lineTo(...at(f.s));
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    flows = flows.filter((f) => (f.evil ? f.dead < 1 && f.s < W * 2 : f.x < W + 100));

    // The one sender behind every orange dash
    const seen = runAt ? clamp(1 - (t - STOP_AT) / FADE) : 0;
    if (seen > 0) {
      ctx.globalAlpha = seen;
      if (!reducedMotion) {
        const p = (now / 1200) % 1;
        ctx.strokeStyle = ORANGE;
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = seen * 0.6 * (1 - p);
        ctx.beginPath();
        ctx.arc(ax, ay, 5 + p * 12, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = seen;
      }
      ctx.fillStyle = ORANGE;
      ctx.beginPath();
      ctx.arc(ax, ay, 5, 0, Math.PI * 2);
      ctx.fill();
      // A patch of panel colour keeps the label readable over passing traffic
      ctx.letterSpacing = '0px';
      const w = ctx.measureText('attacker').width;
      ctx.fillStyle = '#161618';
      ctx.fillRect(12, ay + 12, w + 8, 16);
      ctx.fillStyle = LABEL;
      label('attacker', 16, ay + 24, 'left');
      ctx.globalAlpha = 1;
    }
  }

  btn.addEventListener('click', () => {
    // Start clean from step 2: the old card out, the old attack gone
    card.classList.remove('on');
    risk.textContent = '0';
    response.textContent = 'Deciding…';
    flows = flows.filter((f) => !f.evil);
    owed = 0;
    runAt = performance.now();
    setStep(2);
  });

  setStep(1);
  whenVisible(canvas, draw);
}
