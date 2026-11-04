import { emit, pin, range, smooth } from '../lib.js';

const PROMPT = '4 days in Kerala. Two people. Slow mornings, ₹40,000.';

// Sample itinerary for the animation, labelled as such on the page
const STOPS = [
  { x: 80, y: 60, day: 'Day 1', name: 'Kochi', note: 'Fort Kochi walk, Chinese fishing nets', cost: 9200 },
  { x: 60, y: 205, day: 'Day 2', name: 'Munnar', note: 'Tea estates, slow start', cost: 21400 },
  { x: 90, y: 350, day: 'Day 3', name: 'Thekkady', note: 'Periyar Lake, spice garden', cost: 30100 },
  { x: 70, y: 495, day: 'Day 4', name: 'Alappuzha', note: 'Backwaters by houseboat', cost: 38600 },
];

export function initPlan() {
  const svg = document.getElementById('plan-svg');
  const typed = document.getElementById('plan-typed');
  const status = document.getElementById('plan-status');
  const budget = document.getElementById('plan-budget');
  const NS = 'http://www.w3.org/2000/svg';

  const el = (tag, attrs, parent = svg) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    parent.append(e);
    return e;
  };

  const d = `M80 60 C 160 100, 150 165, 60 205 S 0 310, 90 350 S 160 450, 70 495`;
  el('path', { d, fill: 'none', stroke: 'rgba(10,10,11,.1)', 'stroke-width': 3, 'stroke-dasharray': '2 9', 'stroke-linecap': 'round' });
  const route = el('path', { d, fill: 'none', stroke: '#2747ff', 'stroke-width': 4, 'stroke-linecap': 'round' });
  const len = route.getTotalLength();
  route.style.strokeDasharray = len;
  route.style.strokeDashoffset = len;

  // Find how far along the path each stop is, so stops light up as the line reaches them
  const stops = STOPS.map((s) => {
    let best = 0, bestD = Infinity;
    for (let i = 0; i <= 200; i++) {
      const p = route.getPointAtLength((len * i) / 200);
      const dd = (p.x - s.x) ** 2 + (p.y - s.y) ** 2;
      if (dd < bestD) { bestD = dd; best = i / 200; }
    }
    const g = el('g', { opacity: 0 });
    g.style.transition = 'opacity .35s';
    el('circle', { cx: s.x, cy: s.y, r: 9, fill: '#2747ff', stroke: '#fff', 'stroke-width': 3 }, g);
    const tx = 176;
    el('text', { x: tx, y: s.y - 30, style: 'font: 400 15px "IBM Plex Mono", monospace; fill: #6b6b70' }, g).textContent = s.day;
    el('text', { x: tx, y: s.y + 8, style: 'font-weight: 700; font-size: 38px; letter-spacing: -.035em' }, g).textContent = s.name;
    el('text', { x: tx, y: s.y + 36, style: 'font-size: 18px; fill: #6b6b70' }, g).textContent = s.note;
    return { ...s, at: best, g };
  });

  const rupees = (n) => `₹${Math.round(n).toLocaleString('en-IN')}`;
  let finished = false;

  pin(document.querySelector('.plan-pin'), (t) => {
    typed.textContent = PROMPT.slice(0, Math.round(range(t, 0.02, 0.22) * PROMPT.length));
    const p = smooth(range(t, 0.26, 0.88));
    route.style.strokeDashoffset = len * (1 - p);

    let spend = 0, day = 0;
    stops.forEach((s, i) => {
      const reached = p >= s.at - 0.005;
      s.g.setAttribute('opacity', reached ? 1 : 0);
      if (reached) { day = i + 1; spend = s.cost; }
    });
    budget.textContent = `${rupees(spend)} of ₹40,000`;
    if (t < 0.24) status.textContent = t < 0.03 ? 'Waiting for a prompt' : 'Reading your trip…';
    else if (p < 1) status.textContent = `Planning day ${Math.min(4, day + 1)} of 4…`;
    else status.textContent = 'Plan ready, under budget';
    if (p >= 1 && !finished) {
      finished = true;
      emit('bot', { do: 'happy' });
    }
    if (p < 0.9) finished = false;
  });
}
