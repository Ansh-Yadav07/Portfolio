import { clamp, on, reducedMotion } from '../lib.js';
import { foundEgg } from '../eggs.js';

// Epoch: a small creature who lives at the bottom of the page and has opinions about it.
// Everything is drawn on a 36x36 pixel grid. Motion is smooth but poses step at 10fps,
// the same trick old handhelds used, which is most of why it feels alive.

const G = 36;
const C = {
  body: '#ffc812', shade: '#e8a800', light: '#ffe27a', line: '#0a0a0b', limb: '#d99a00',
  screen: '#17171c', eye: '#ffffff', cheek: '#ff7a9c', stem: '#8e8e93',
  a: '#2747ff', b: '#ff4a1c', green: '#3fd17a',
};

const PAL = {
  k: '#0a0a0b', w: '#ffffff', g: '#8e8e93', s: '#c9ced6', S: '#8f97a3', o: '#f58a1f', O: '#c4640d',
  l: '#3fa34d', L: '#25692f', a: '#2747ff', A: '#1a2fb0', b: '#ff4a1c', B: '#a8784a', n: '#7a5430',
  y: '#f4d63a', c: '#bfe6ff', p: '#ff7a9c', t: '#e8dcb8', T: '#b7a97f', r: '#d4342a',
};

const PROPS = {
  magnifier: ['...kkk...', '..kcccsk.', '.kccccck.', '.kcwcccck', '.kccccck.', '..kccck..', '...kkk...', '....Bn...', '....Bn...'],
  carrot: ['...l.l...', '....ll...', '...lL....', '...ooo...', '..oooo...', '..oOo....', '..oo.....', '.oo......', '.o.......'],
  shield: ['aaaaaaa', 'awwaaaA', 'awaaaaA', 'aaaaaaA', 'aaaaaaA', '.aaaaA.', '..aaA..', '...A...'],
  map: ['ttTttTtt', 'tatTttTt', 'ttaaTatt', 'ttTtaatt', 'tbTttaTt', 'ttTttTtt'],
  wrench: ['.s.s.', '.s.s.', '.sSs.', '..S..', '..s..', '..S..', '..s..', '..S..'],
  broom: ['...n', '...n', '...n', '..n.', '..n.', '..n.', '.ny.', 'yyyy', 'yyyy', 'y.y.'],
  envelope: ['wwwwwwwww', 'wgwwwwwgw', 'wwgwwwgww', 'wwwgwgwww', 'wwwwgwwww', 'wwwwwwwww'],
};

const WEAR = {
  cap: { x: 10, y: 11, rows: ['......kk......', '....kkkkkk....', '..kkkkkkkkkk..', 'kkkkkkkkkkkkkk', '..kkkkkkkkkb..', '...........b..', '...........b..'] },
  night: { x: 11, y: 11, rows: ['.........a..', '......aawa..', '....aawaa...', '..aawaaaaa..', 'wwwwwwwwwwww'] },
};
const TIE = ['bb', '.b'];

const BUBBLES = {
  '!': ['..b..', '..b..', '..b..', '.....', '..b..'],
  '?': ['.aaa.', '...a.', '..a..', '.....', '..a..'],
  heart: ['.p.p.', 'ppppp', 'ppppp', '.ppp.', '..p..'],
  dots: ['.....', '.....', 'k.k.k', '.....', '.....'],
  z: ['kkkkk', '...k.', '..k..', '.k...', 'kkkkk'],
};

export function initBot() {
  const canvas = document.getElementById('bot');
  const ctx = canvas.getContext('2d');
  const hit = document.createElement('div');
  hit.setAttribute('aria-hidden', 'true');
  hit.style.cssText = 'position:fixed;left:0;top:0;z-index:51;touch-action:none;cursor:grab;';
  document.body.append(hit);
  canvas.style.pointerEvents = 'none';

  let S = innerWidth < 700 ? 3 : 4;
  const applySize = () => {
    S = innerWidth < 700 ? 3 : 4;
    canvas.width = G * S;
    canvas.height = G * S;
    canvas.style.width = `${G * S}px`;
    canvas.style.height = `${G * S}px`;
    hit.style.width = `${20 * S}px`;
    hit.style.height = `${24 * S}px`;
  };
  applySize();

  const groundY = () => innerHeight - 6;
  const walkMin = () => (innerWidth < 700 ? innerWidth * 0.5 : innerWidth * 0.42);
  const walkMax = () => innerWidth - 17 * S;

  const b = {
    x: innerWidth + 60, y: groundY(), vx: 0, vy: 0,
    facing: -1, mode: 'walk', targetX: innerWidth - 150,
    expr: 'normal', exprUntil: 0, action: null, actionUntil: 0,
    bubble: null, bubbleUntil: 0, prop: 'broom',
    squash: 0, nextThought: 0, frame: 0, blinkAt: 2000, tilt: 0,
  };
  const pointer = { x: innerWidth / 2, y: innerHeight / 2 };
  let lastInput = performance.now();
  let sleeping = false;
  let clicks = [];
  let dragging = false;
  let dragDist = 0;
  let trail = [];
  let hoverSince = 0;
  let confetti = [];
  let rot = 0;

  const lateNight = () => { const h = new Date().getHours(); return h >= 0 && h < 5; };

  function say(bubble, ms = 1600) {
    b.bubble = bubble;
    b.bubbleUntil = performance.now() + ms;
  }
  function feel(expr, ms = 1600) {
    b.expr = expr;
    b.exprUntil = performance.now() + ms;
  }
  function act(action, ms) {
    b.action = action;
    b.actionUntil = performance.now() + ms;
  }
  function hop(power = 300) {
    if (b.mode === 'air' || b.mode === 'drag' || reducedMotion) return;
    b.mode = 'air';
    b.vy = -power;
    b.vx = 0;
  }
  function wake() {
    if (!sleeping) return;
    sleeping = false;
    b.mode = 'idle';
    feel('surprised', 700);
    say('!', 700);
    hop(180);
  }

  // What the rest of the page can ask of it
  const REACTIONS = {
    wave() { act('wave', 2200); feel('happy', 1400); },
    happy() { feel('happy', 2000); say('heart', 1800); hop(280); },
    surprised() { feel('surprised', 1100); say('!', 1100); hop(240); },
    confused() { feel('squint', 2000); say('?', 2000); },
    curious() { feel('normal', 1400); say('?', 1200); },
    suspicious() {
      if (performance.now() < b.exprUntil) return;
      feel('squint', 1400); say('dots', 1400);
    },
    relieved() { b.mode = 'idle'; b.action = null; feel('happy', 2200); say('heart', 2000); },
    panic() {
      act('panic', 2800); feel('surprised', 2800); say('!', 2800);
      b.mode = 'walk';
      b.targetX = walkMin();
    },
    dizzy() { act('dizzy', 2800); feel('dizzy', 2800); b.mode = 'idle'; b.vx = 0; },
    party() {
      act('party', 3200); feel('happy', 3200); say('heart', 3000);
      confetti = Array.from({ length: 34 }, () => ({
        x: 18, y: 18, vx: (Math.random() - 0.5) * 34, vy: -12 - Math.random() * 26,
        c: [C.a, C.b, C.body, C.green][Math.floor(Math.random() * 4)], life: 1,
      }));
    },
  };
  on('bot', ({ do: what }) => {
    wake();
    REACTIONS[what]?.();
  });

  // Input
  const noteInput = () => {
    lastInput = performance.now();
    wake();
  };
  addEventListener('pointermove', (e) => {
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    noteInput();
  }, { passive: true });
  addEventListener('keydown', noteInput);
  addEventListener('touchstart', noteInput, { passive: true });

  let lastScroll = scrollY;
  let lastScrollAt = 0;
  addEventListener('scroll', () => {
    noteInput();
    const d = Math.abs(scrollY - lastScroll);
    lastScroll = scrollY;
    const now = performance.now();
    if (d > innerHeight * 0.28 && now - lastScrollAt > 2500 && !dragging) {
      lastScrollAt = now;
      REACTIONS.surprised();
    }
    updateProp();
  }, { passive: true });

  function updateProp() {
    const el = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
    const scene = el?.closest('[data-bot]');
    if (!scene) return;
    const next = scene.dataset.bot;
    if (next !== b.prop) {
      if (next === 'wave') act('wave', 2400);
      b.prop = next;
    }
  }

  hit.addEventListener('pointerenter', () => (hoverSince = performance.now()));
  hit.addEventListener('pointerleave', () => (hoverSince = 0));
  hit.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    hit.setPointerCapture(e.pointerId);
    dragging = true;
    dragDist = 0;
    trail = [];
    b.mode = 'drag';
    b.action = null;
    hit.style.cursor = 'grabbing';
    feel('surprised', 400);
    noteInput();
  });
  hit.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const nx = e.clientX, ny = e.clientY + 11 * S;
    dragDist += Math.abs(nx - b.x) + Math.abs(ny - b.y);
    b.x = nx;
    b.y = ny;
    trail.push({ x: nx, y: ny, t: performance.now() });
    if (trail.length > 24) trail.shift();
    checkShake();
  });
  const release = () => {
    if (!dragging) return;
    dragging = false;
    hit.style.cursor = 'grab';
    if (dragDist < 8) {
      // A click rather than a drag
      b.mode = 'idle';
      b.y = groundY();
      const now = performance.now();
      clicks = clicks.filter((t) => now - t < 5000);
      clicks.push(now);
      if (clicks.length >= 8) {
        clicks = [];
        foundEgg('dizzy', 'Stop poking Epoch');
        REACTIONS.dizzy();
      } else {
        feel('happy', 700);
        hop(260);
      }
      return;
    }
    const a = trail[Math.max(0, trail.length - 5)], z = trail[trail.length - 1];
    if (a && z && z.t > a.t) {
      b.vx = clamp(((z.x - a.x) / (z.t - a.t)) * 1000, -1100, 1100);
      b.vy = clamp(((z.y - a.y) / (z.t - a.t)) * 1000, -1100, 1100);
    }
    b.mode = 'air';
  };
  hit.addEventListener('pointerup', release);
  hit.addEventListener('pointercancel', release);

  function checkShake() {
    const now = performance.now();
    const recent = trail.filter((p) => now - p.t < 700);
    let flips = 0, lastDir = 0;
    for (let i = 1; i < recent.length; i++) {
      const dx = recent[i].x - recent[i - 1].x;
      if (Math.abs(dx) < 6) continue;
      const dir = Math.sign(dx);
      if (lastDir && dir !== lastDir) flips++;
      lastDir = dir;
    }
    if (flips >= 4 && b.action !== 'dizzy') {
      foundEgg('dizzy', 'You shook the small yellow one');
      act('dizzy', 2800);
      feel('dizzy', 2800);
    }
  }

  // Drawing
  function px(x, y, w, h, c) {
    ctx.fillStyle = c;
    ctx.fillRect(x * S, y * S, w * S, h * S);
  }
  function sprite(rows, x, y) {
    rows.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        const c = PAL[row[i]];
        if (c) px(x + i, y + j, 1, 1, c);
      }
    });
  }

  function drawEyes(expr, lx, ly, blink, alarm) {
    const e = alarm ? C.b : C.eye;
    const L = 15 + lx, R = 19 + lx, Y = 22 + Math.min(0, ly);
    switch (expr) {
      case 'happy':
        px(15, 23, 1, 1, e); px(16, 22, 1, 1, e); px(17, 23, 1, 1, e);
        px(19, 23, 1, 1, e); px(20, 22, 1, 1, e); px(21, 23, 1, 1, e);
        px(17, 25, 2, 1, e);
        px(14, 25, 2, 1, C.cheek); px(20, 25, 2, 1, C.cheek);
        break;
      case 'surprised':
        px(14, 21, 3, 3, e); px(19, 21, 3, 3, e);
        px(15, 22, 1, 1, C.screen); px(20, 22, 1, 1, C.screen);
        px(17, 25, 2, 1, e);
        break;
      case 'squint':
        px(14, 23, 3, 1, e); px(19, 23, 3, 1, e);
        px(15, 24, 1, 1, e); px(20, 24, 1, 1, e);
        px(18, 25, 2, 1, e);
        break;
      case 'sleep':
        px(15, 23, 3, 1, e); px(19, 23, 3, 1, e);
        break;
      case 'dizzy':
        for (const o of [15, 19]) {
          px(o, 21, 1, 1, e); px(o + 2, 21, 1, 1, e); px(o + 1, 22, 1, 1, e);
          px(o, 23, 1, 1, e); px(o + 2, 23, 1, 1, e);
        }
        px(17, 25, 2, 1, e);
        break;
      default:
        if (blink) {
          px(L, Y + 2, 2, 1, e); px(R, Y + 2, 2, 1, e);
        } else {
          px(L, Y, 2, 3, e); px(R, Y, 2, 3, e);
        }
        px(17, 25, 2, 1, e);
    }
  }

  function draw(now, lx, ly) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const f = b.frame;
    const walking = b.mode === 'walk';
    const airborne = b.mode === 'air' || b.mode === 'drag';
    const alarm = b.action === 'panic';
    const expr = sleeping ? 'sleep' : now < b.exprUntil ? b.expr : 'normal';
    const blink = now > b.blinkAt && now < b.blinkAt + 130;
    const breathe = sleeping ? (f % 16 < 8 ? 1 : 0) : !walking && !airborne && f % 20 < 10 ? 0 : 0;
    const bob = walking && f % 4 < 2 ? -1 : 0;
    const dy = breathe + bob;

    ctx.save();
    if (b.facing < 0) {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }

    // Antenna, the mood light
    const bulb = alarm ? (f % 2 ? C.b : '#fff') : b.action === 'party' ? [C.a, C.b, C.green][f % 3] : sleeping ? C.stem : C.a;
    px(17, 15 + dy, 2, 3, C.stem);
    if (!(airborne && f % 2)) {
      px(16, 12 + dy, 4, 3, bulb);
    } else {
      px(17, 12 + dy, 2, 3, bulb);
    }

    // Feet
    const legA = walking ? (f % 4 < 2 ? 2 : 0) : airborne ? 3 : 1;
    const legB = walking ? (f % 4 < 2 ? 0 : 2) : airborne ? 3 : 1;
    px(13, 30, 3, 1 + legA, C.limb);
    px(20, 30, 3, 1 + legB, C.limb);

    // Body
    px(12, 18 + dy, 12, 12, C.line);
    px(11, 19 + dy, 14, 10, C.line);
    px(13, 19 + dy, 10, 10, C.body);
    px(12, 20 + dy, 12, 8, C.body);
    px(12, 27 + dy, 12, 1, C.shade);
    px(13, 28 + dy, 10, 1, C.shade);
    px(13, 19 + dy, 3, 1, C.light);

    // Face. Eyes keep their own offset so they can look around while the body stays still.
    px(13, 20 + dy, 10, 7, C.screen);
    ctx.save();
    ctx.translate(0, dy * S);
    drawEyes(expr, lx, ly, blink, alarm);
    ctx.restore();

    // Arms and whatever it is holding
    const wave = b.action === 'wave' || b.action === 'party';
    const hold = !wave && !sleeping && b.action !== 'dizzy' && PROPS[b.prop];
    px(9, 23 + dy, 2, 3, C.limb);
    if (wave) {
      const up = f % 4 < 2;
      px(25, up ? 17 : 19, 2, 4, C.limb);
      px(25 + (up ? 2 : 0), up ? 15 : 18, 2, 2, C.limb);
    } else {
      px(25, 23 + dy, 2, 3, C.limb);
    }
    if (hold) {
      const prop = PROPS[b.prop];
      const swing = (b.prop === 'broom' || b.prop === 'magnifier') && !walking ? (f % 8 < 4 ? 0 : 1) : 0;
      sprite(prop, 26 + swing, 26 + dy - prop.length + 3);
    }
    if (b.prop === 'cap' && !sleeping) sprite(WEAR.cap.rows, WEAR.cap.x, WEAR.cap.y + dy + 2);
    if (b.prop === 'tie') sprite(TIE, 17, 27 + dy);
    if (sleeping && lateNight()) sprite(WEAR.night.rows, WEAR.night.x, WEAR.night.y + dy + 3);

    ctx.restore();

    // Dizzy stars orbit
    if (b.action === 'dizzy') {
      const a = f * 0.9;
      for (let i = 0; i < 3; i++) {
        const t = a + (i * Math.PI * 2) / 3;
        px(Math.round(18 + Math.cos(t) * 9), Math.round(13 + Math.sin(t) * 2), 1, 1, C.body);
      }
    }

    // Thought bubble, always the right way round
    const icon = sleeping ? 'z' : now < b.bubbleUntil ? b.bubble : null;
    if (icon) {
      const bx = 24, by = sleeping ? 3 - (f % 16 < 8 ? 0 : 1) : 3;
      px(bx + 1, by, 7, 9, C.line);
      px(bx, by + 1, 9, 7, C.line);
      px(bx + 1, by + 1, 7, 7, '#fff');
      px(bx + 1, by + 9, 2, 1, C.line);
      px(bx, by + 10, 1, 1, C.line);
      sprite(BUBBLES[icon], bx + 2, by + 2);
    }

    for (const p of confetti) {
      if (p.life > 0) px(Math.round(p.x), Math.round(p.y), 1, 1, p.c);
    }
  }

  // Simulation
  let lastNow = performance.now();
  let frameClock = 0;
  function tick(now) {
    requestAnimationFrame(tick);
    const dt = Math.min(50, now - lastNow) / 1000;
    lastNow = now;
    frameClock += dt;
    if (frameClock > 0.1) { frameClock = 0; b.frame++; }

    if (b.action && now > b.actionUntil) b.action = null;
    if (now > b.blinkAt + 130) b.blinkAt = now + 1800 + Math.random() * 3600;

    const ground = groundY();
    if (b.mode === 'drag') {
      b.tilt = 0;
    } else if (b.mode === 'air') {
      b.vy += 1500 * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.x < 8 * S) { b.x = 8 * S; b.vx *= -0.6; }
      if (b.x > innerWidth - 8 * S) { b.x = innerWidth - 8 * S; b.vx *= -0.6; }
      if (b.y >= ground) {
        const hard = b.vy > 750;
        b.y = ground;
        b.squash = Math.min(1, b.vy / 900);
        if (hard) {
          b.vy *= -0.32;
          b.vx *= 0.6;
          if (b.action !== 'dizzy') { feel('surprised', 500); }
        } else {
          b.vy = 0;
          b.vx = 0;
          b.mode = 'idle';
          b.nextThought = now + 900;
        }
      }
    } else if (b.mode === 'walk') {
      const speed = b.action === 'panic' ? 300 : 62;
      const d = b.targetX - b.x;
      b.facing = Math.sign(d) || b.facing;
      b.x += Math.sign(d) * Math.min(Math.abs(d), speed * dt);
      if (Math.abs(d) < 2) {
        if (b.action === 'panic') {
          b.targetX = b.targetX < innerWidth * 0.7 ? walkMax() : walkMin();
        } else {
          b.mode = 'idle';
          b.nextThought = now + 1500 + Math.random() * 4500;
        }
      }
    } else if (b.mode === 'idle' && now > b.nextThought && !reducedMotion && !b.action) {
      const r = Math.random();
      if (r < 0.62) {
        b.targetX = walkMin() + Math.random() * (walkMax() - walkMin());
        b.mode = 'walk';
      } else {
        b.nextThought = now + 2000 + Math.random() * 3000;
        if (r > 0.9) { feel('squint', 800); say('dots', 800); }
      }
    }
    if (b.action === 'party' && b.mode === 'idle' && b.frame % 7 === 0) hop(260);
    if (b.action === 'dizzy') b.tilt = Math.sin(now / 140) * 2;
    else b.tilt = 0;

    // Sleep when ignored. Sooner in the small hours, because it knows what time it is.
    const idleFor = now - lastInput;
    if (!sleeping && b.mode === 'idle' && !b.action && idleFor > (lateNight() ? 12000 : 25000)) {
      sleeping = true;
    }
    if (sleeping && idleFor > 40000) foundEgg('sleeper', 'You let Epoch fall asleep');
    if (sleeping) b.nextThought = now + 1000;

    // Pet by hovering
    if (hoverSince && now - hoverSince > 1100 && !dragging) {
      hoverSince = now + 2200;
      feel('happy', 1500);
      say('heart', 1500);
    }

    // Eyes follow the cursor
    const eyeX = clamp((pointer.x - b.x) / 240, -1, 1) * (b.facing < 0 ? -1 : 1);
    const eyeY = clamp((pointer.y - (b.y - 20 * S)) / 240, -1, 1);
    const lx = Math.round(eyeX);
    const ly = Math.round(eyeY);

    for (const p of confetti) {
      p.vy += 60 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt * 0.55;
    }
    if (confetti.length && confetti.every((p) => p.life <= 0)) confetti = [];

    draw(now, lx, ly);

    b.squash *= 0.86;
    const sx = 1 + b.squash * 0.18, sy = 1 - b.squash * 0.2;
    rot = b.tilt;
    const left = Math.round(b.x - (G * S) / 2);
    const top = Math.round(b.y - G * S + 2 * S);
    canvas.style.transformOrigin = '50% 100%';
    canvas.style.transform = `translate(${left}px, ${top}px) scale(${sx}, ${sy}) rotate(${rot}deg)`;
    hit.style.transform = `translate(${Math.round(b.x - 10 * S)}px, ${top + 11 * S}px)`;
  }

  addEventListener('resize', () => {
    applySize();
    if (b.mode !== 'drag' && b.mode !== 'air') b.y = groundY();
    b.x = clamp(b.x, 8 * S, innerWidth - 8 * S);
    if (b.targetX > walkMax()) b.targetX = walkMax();
  });

  if (reducedMotion) {
    b.x = innerWidth - 120;
    b.mode = 'idle';
    b.facing = -1;
  }
  requestAnimationFrame(tick);
}
