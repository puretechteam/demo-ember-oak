// Reservation widget: date rules, seeded availability, inline validation, demo confirmation.
import { $, $$ } from './common.js';
import { HOURS, zonedNow, isoFromParts, fmtTime } from './hours.js';

const MAX_DAYS = 60;
const STEP = 15;
const LAST_SEATING = 75; // minutes before close

const dateFromIso = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
const isoFromDate = (dt) => dt.toISOString().slice(0, 10);
export const addDays = (iso, n) => { const dt = dateFromIso(iso); dt.setUTCDate(dt.getUTCDate() + n); return isoFromDate(dt); };
export const dowOf = (iso) => dateFromIso(iso).getUTCDay();
const longDate = (iso) => dateFromIso(iso).toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric' });

// Small deterministic PRNG so a given date always shows the same booked slots.
function seeded(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => {
    h = (h + 0x6D2B79F5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function slotsFor(iso, now = zonedNow()) {
  const hours = HOURS[dowOf(iso)];
  if (!hours) return [];
  const rand = seeded(`emberoak:${iso}`);
  const isToday = iso === isoFromParts(now);
  const out = [];
  for (let m = hours[0]; m <= hours[1] - LAST_SEATING; m += STEP) {
    const prime = m >= 18 * 60 + 30 && m <= 20 * 60;
    const booked = rand() < (prime ? 0.5 : 0.22);
    if (isToday && m < now.minutes + 30) continue;
    out.push({ m, booked });
  }
  return out;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function initReserve() {
  const form = $('[data-reserve]');
  if (!form) return;
  const date = $('#res-date', form);
  const party = $('#res-party', form);
  const largeNote = $('[data-large-party]', form);
  const slotsBox = $('[data-slots]', form);
  const slotsStatus = $('[data-slots-status]', form);
  const name = $('#res-name', form);
  const email = $('#res-email', form);
  const phone = $('#res-phone', form);
  const notes = $('#res-notes', form);
  const dialog = $('[data-confirm]');
  const list = $('[data-confirm-list]');
  const touched = new Set();

  const today = () => isoFromParts(zonedNow());
  const setBounds = () => { date.min = today(); date.max = addDays(today(), MAX_DAYS); };
  setBounds();

  function setError(input, msg) {
    const err = $(`#${input.id || 'res-time'}-err`, form);
    if (err) err.textContent = msg || '';
    if (input instanceof Element) {
      if (msg) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid');
    }
    return !msg;
  }

  const rules = {
    date() {
      const v = date.value;
      if (!v) return 'Choose a date.';
      if (v < date.min) return 'That date has passed. Pick today or later.';
      if (v > date.max) return 'We book up to 60 days out. Call us for anything further ahead.';
      if (dowOf(v) === 1) return "We're closed on Mondays. Pick Tuesday through Sunday.";
      return '';
    },
    name() { return name.value.trim().length < 2 ? 'Tell us who the table is for.' : ''; },
    email() {
      const v = email.value.trim();
      if (!v) return 'Add an email so we can confirm.';
      return EMAIL_RE.test(v) ? '' : "That email doesn't look right. Check for a missing @ or dot.";
    },
    phone() {
      const digits = phone.value.replace(/\D/g, '');
      const ok = digits.length === 10 || (digits.length === 11 && digits.startsWith('1'));
      return ok ? '' : 'Enter a 10-digit phone number, like (503) 555-0142.';
    },
  };
  const fields = { date, name, email, phone };
  const check = (key) => setError(fields[key], rules[key]());

  function renderSlots() {
    setBounds();
    const msg = rules.date();
    if (date.value) { touched.add('date'); setError(date, msg); }
    setError({ id: 'res-time' }, '');
    if (msg) {
      slotsBox.innerHTML = '';
      slotsStatus.textContent = date.value ? 'No times to show for that date.' : 'Pick a date to see open times.';
      return;
    }
    const slots = slotsFor(date.value);
    const open = slots.filter((s) => !s.booked).length;
    if (!open) {
      slotsBox.innerHTML = '';
      slotsStatus.textContent = `We're full for ${longDate(date.value)}. Try another night, or walk in for the hearth counter.`;
      return;
    }
    slotsBox.innerHTML = slots.map((s) => {
      const label = fmtTime(s.m).replace(' pm', '').replace(' am', '');
      const id = `slot-${s.m}`;
      return `<label class="slot" for="${id}"><input type="radio" id="${id}" name="time" value="${s.m}"${s.booked ? ' disabled' : ''}><span>${label.includes(':') ? label : `${label}:00`}${s.booked ? '<small class="sr-only"> (booked)</small>' : ''}</span></label>`;
    }).join('');
    slotsStatus.textContent = `${open} of ${slots.length} times open on ${longDate(date.value)}, evening seatings.`;
  }

  date.addEventListener('change', renderSlots);
  date.addEventListener('input', renderSlots);
  party.addEventListener('change', () => { largeNote.hidden = Number(party.value) < 8; });
  slotsBox.addEventListener('change', () => setError({ id: 'res-time' }, ''));

  Object.entries(fields).forEach(([key, input]) => {
    if (key === 'date') return;
    input.addEventListener('blur', () => { if (input.value) touched.add(key); if (touched.has(key)) check(key); });
    input.addEventListener('input', () => { if (touched.has(key)) check(key); });
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    Object.keys(fields).forEach((k) => touched.add(k));
    const results = Object.keys(fields).map((k) => [k, check(k)]);
    const time = $('input[name="time"]:checked', form);
    let timeOk = true;
    if (!rules.date() && !time) timeOk = setError({ id: 'res-time' }, 'Choose a time.');
    const firstBad = results.find(([, ok]) => !ok);
    if (firstBad) { fields[firstBad[0]].focus(); return; }
    if (!timeOk) { ($('input[name="time"]:not(:disabled)', form) || date).focus(); return; }

    const rows = [
      ['Date', longDate(date.value)],
      ['Time', fmtTime(Number(time.value))],
      ['Guests', `${party.value} ${party.value === '1' ? 'guest' : 'guests'}`],
      ['Name', name.value.trim()],
      ['Email', email.value.trim()],
      ['Phone', phone.value.trim()],
    ];
    if (notes.value.trim()) rows.push(['Notes', notes.value.trim()]);
    list.replaceChildren(...rows.map(([k, v]) => {
      const div = document.createElement('div');
      const dt = document.createElement('dt'); dt.textContent = k;
      const dd = document.createElement('dd'); dd.textContent = v;
      div.append(dt, dd);
      return div;
    }));
    if (Number(party.value) >= 8) {
      const div = document.createElement('div');
      div.innerHTML = '<dt>Next</dt><dd>We would call you within a day to confirm.</dd>';
      list.append(div);
    }
    if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', '');
  });

  dialog.addEventListener('close', () => {
    form.reset();
    touched.clear();
    $$('[aria-invalid]', form).forEach((el) => el.removeAttribute('aria-invalid'));
    $$('.field-error', form).forEach((el) => { el.textContent = ''; });
    largeNote.hidden = true;
    renderSlots();
    $('button[type="submit"]', form).focus();
  });
}
