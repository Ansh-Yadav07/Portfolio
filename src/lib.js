export const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const range = (v, a, b) => clamp((v - a) / (b - a));
export const smooth = (t) => t * t * (3 - 2 * t);

// A tiny event bus so scenes can tell the bot how things are going
const listeners = {};
export const on = (name, fn) => ((listeners[name] ||= []).push(fn));
export const emit = (name, data) => (listeners[name] || []).forEach((fn) => fn(data));

// Scroll progress for tall pinned sections. Callback gets 0..1 across the pinned distance.
const pinned = [];
export function pin(el, fn) {
  pinned.push({ el, fn, last: -1 });
}
export function updatePins() {
  const vh = innerHeight;
  for (const p of pinned) {
    const r = p.el.getBoundingClientRect();
    if (r.bottom < -vh || r.top > vh * 2) continue;
    const t = clamp(-r.top / Math.max(1, r.height - vh));
    if (t !== p.last) {
      p.last = t;
      p.fn(t);
    }
  }
}

// Runs a render loop only while the element is close to the viewport
export function whenVisible(el, loop) {
  let visible = false;
  let raf = 0;
  const tick = (now) => {
    if (!visible) return;
    loop(now);
    raf = requestAnimationFrame(tick);
  };
  new IntersectionObserver(([e]) => {
    if (e.isIntersecting && !visible) {
      visible = true;
      raf = requestAnimationFrame(tick);
    } else if (!e.isIntersecting) {
      visible = false;
      cancelAnimationFrame(raf);
    }
  }, { rootMargin: '100px' }).observe(el);
}

export function fitCanvas(canvas, maxDpr = 2) {
  const dpr = Math.min(devicePixelRatio || 1, maxDpr);
  const { width, height } = canvas.getBoundingClientRect();
  canvas.width = Math.max(1, Math.round(width * dpr));
  canvas.height = Math.max(1, Math.round(height * dpr));
  return { w: width, h: height, dpr };
}
