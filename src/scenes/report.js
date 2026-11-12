import { emit, playOnView, range, smooth } from '../lib.js';

const PROMPT = 'The streetlight outside Gate 2 has been out for a week.';
const STEPS = ['Reported', 'Acknowledged', 'In progress', 'Resolved'];

// When each part of the sample report appears, as points on a 0..1 clock
const FIELDS_AT = [0.3, 0.36, 0.42];
const STEPS_AT = [0.5, 0.64, 0.78, 0.92];

export function initReport() {
  const ticket = document.getElementById('ticket');
  const typed = document.getElementById('ticket-typed');
  const sync = document.getElementById('ticket-sync');
  const dot = sync.querySelector('i');
  const status = document.getElementById('ticket-status');
  const fields = [...document.getElementById('ticket-fields').children];
  const track = document.getElementById('track');
  const steps = [...track.children];

  let reached = 0;
  let pingTimer = 0;
  let resolved = false;

  playOnView(ticket, 4200, (t) => {
    typed.textContent = PROMPT.slice(0, Math.round(range(t, 0.02, 0.28) * PROMPT.length));
    fields.forEach((f, i) => f.classList.toggle('on', t >= FIELDS_AT[i]));

    const n = STEPS_AT.filter((at) => t >= at).length;
    steps.forEach((s, i) => s.classList.toggle('on', i < n));
    // Ease each leg of the rail on its own so it lands on every dot at the moment that dot lights
    let fill = 0;
    for (let i = 0; i < 3; i++) fill += smooth(range(t, STEPS_AT[i], STEPS_AT[i + 1])) / 3;
    track.style.setProperty('--fill', fill.toFixed(4));

    // Every status change is a write that every open screen would see, so the sync dot pings
    sync.classList.toggle('on', n > 0);
    if (n > reached) {
      // Restart the keyframe even if the last ping has not finished
      dot.classList.remove('ping');
      void dot.offsetWidth;
      dot.classList.add('ping');
      clearTimeout(pingTimer);
      pingTimer = setTimeout(() => dot.classList.remove('ping'), 400);
    }
    reached = n;

    if (t < 0.02) status.textContent = 'Waiting for a report';
    else if (t < FIELDS_AT[0]) status.textContent = 'Writing the report…';
    else if (n === 0) status.textContent = 'Adding details…';
    else status.textContent = `Status: ${STEPS[n - 1]}`;

    if (n === 4 && !resolved) {
      resolved = true;
      emit('bot', { do: 'happy' });
    }
    if (t === 0) resolved = false;
  });
}
