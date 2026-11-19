// Opening hours in restaurant time (America/Los_Angeles), shared by the badge and booking form.
import { $$ } from './common.js';

export const TZ = 'America/Los_Angeles';
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Minutes after midnight, keyed by day of week (0 = Sunday). null = closed.
export const HOURS = {
  0: [16 * 60, 21 * 60],
  1: null,
  2: [17 * 60, 22 * 60],
  3: [17 * 60, 22 * 60],
  4: [17 * 60, 22 * 60],
  5: [17 * 60, 23 * 60],
  6: [17 * 60, 23 * 60],
};

const fmt = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

/** Wall-clock parts for the restaurant's time zone. */
export function zonedNow(date = new Date()) {
  const p = Object.fromEntries(fmt.formatToParts(date).map((x) => [x.type, x.value]));
  const hour = Number(p.hour) % 24;
  return {
    y: Number(p.year), m: Number(p.month), d: Number(p.day),
    dow: DAYS.indexOf(p.weekday),
    minutes: hour * 60 + Number(p.minute),
  };
}

export const pad = (n) => String(n).padStart(2, '0');
export const isoFromParts = ({ y, m, d }) => `${y}-${pad(m)}-${pad(d)}`;

/** "5 pm", "5:30 pm", "12 pm" */
export function fmtTime(min) {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  const suffix = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m ? `${h12}:${pad(m)} ${suffix}` : `${h12} ${suffix}`;
}

export function openStatus(date = new Date()) {
  const now = zonedNow(date);
  const today = HOURS[now.dow];
  if (today && now.minutes >= today[0] && now.minutes < today[1]) {
    return { open: true, text: `Open now · closes at ${fmtTime(today[1])}` };
  }
  for (let i = 0; i < 8; i++) {
    const dow = (now.dow + i) % 7;
    const h = HOURS[dow];
    if (!h) continue;
    if (i === 0 && now.minutes >= h[0]) continue;
    const when = i === 0 ? 'today' : DAYS[dow];
    return { open: false, text: `Closed · opens ${when} ${fmtTime(h[0])}` };
  }
  return { open: false, text: 'Closed' };
}

export function initHours() {
  const badges = $$('[data-open-status]');
  const rows = $$('[data-hours-table] tr[data-dow]');
  if (!badges.length && !rows.length) return;
  const update = () => {
    const s = openStatus();
    badges.forEach((b) => {
      b.classList.toggle('is-open', s.open);
      b.classList.toggle('is-closed', !s.open);
      const t = b.querySelector('[data-status-text]');
      if (t && t.textContent !== s.text) t.textContent = s.text;
    });
    const dow = zonedNow().dow;
    rows.forEach((r) => r.classList.toggle('is-today', Number(r.dataset.dow) === dow));
  };
  update();
  // Tick on the minute boundary, then every minute.
  const msToNextMinute = 60000 - (Date.now() % 60000) + 50;
  setTimeout(() => { update(); setInterval(update, 60000); }, msToNextMinute);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) update(); });
}
