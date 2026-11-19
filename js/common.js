// Pure Tech starter: theme toggle, demo ribbon, scroll reveal, toast, helpers.
// Loaded as an ES module. Safe without localStorage (private mode etc.).

export const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const store = {
  get(key) { try { return localStorage.getItem(key); } catch { return null; } },
  set(key, value) { try { localStorage.setItem(key, value); } catch { /* ignore */ } },
};

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/** Theme: honours saved choice, else system preference. Buttons: [data-theme-toggle]. */
export function initTheme(storageKey) {
  const root = document.documentElement;
  const saved = store.get(storageKey);
  const system = window.matchMedia('(prefers-color-scheme: dark)');
  const apply = (t) => {
    root.dataset.theme = t;
    $$('[data-theme-toggle]').forEach((b) => {
      b.setAttribute('aria-pressed', String(t === 'dark'));
      b.setAttribute('aria-label', t === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
    });
    document.dispatchEvent(new CustomEvent('themechange', { detail: t }));
  };
  apply(saved || (system.matches ? 'dark' : 'light'));
  system.addEventListener('change', (e) => { if (!store.get(storageKey)) apply(e.matches ? 'dark' : 'light'); });
  $$('[data-theme-toggle]').forEach((b) => b.addEventListener('click', () => {
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    store.set(storageKey, next);
    apply(next);
  }));
}

/** Demo ribbon: dismissible, remembered per site. Markup: .demo-ribbon with a button. */
export function initRibbon(storageKey) {
  const ribbon = $('.demo-ribbon');
  if (!ribbon) return;
  if (store.get(storageKey) === '1') { ribbon.hidden = true; return; }
  $('button', ribbon)?.addEventListener('click', () => { ribbon.hidden = true; store.set(storageKey, '1'); });
}

/** Reveal [data-reveal] elements as they scroll into view. */
export function initReveal() {
  const els = $$('[data-reveal]');
  if (!('IntersectionObserver' in window) || reducedMotion()) { els.forEach((e) => e.classList.add('is-visible')); return; }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('is-visible'); io.unobserve(en.target); } });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  els.forEach((e) => io.observe(e));
}

/** Small toast for confirmations. */
let toastTimer;
export function toast(html, ms = 5000) {
  let el = $('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    document.body.append(el);
  }
  el.innerHTML = html;
  requestAnimationFrame(() => el.classList.add('is-shown'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-shown'), ms);
}

/** Animate a number from what is shown now to `to`. A newer call on the same element cancels
 *  the older one, and the final value is always written even if frames stop (hidden tab). */
const counting = new WeakMap();
export function countTo(el, to, { duration = 700, format = (n) => Math.round(n).toLocaleString('en-US') } = {}) {
  const prev = counting.get(el);
  const from = prev ? prev.current : Number(el.dataset.value || 0);
  el.dataset.value = String(to);
  if (prev) clearTimeout(prev.timer);
  if (reducedMotion() || from === to || duration <= 0) { counting.delete(el); el.textContent = format(to); return; }
  const run = { current: from, timer: 0 };
  const finish = () => { if (counting.get(el) === run) { counting.delete(el); el.textContent = format(to); } };
  run.timer = setTimeout(finish, duration + 150);
  counting.set(el, run);
  let start = 0;
  const step = (now) => {
    if (counting.get(el) !== run) return;
    if (!start) start = now;
    const t = Math.min(1, (now - start) / duration);
    run.current = from + (to - from) * (1 - Math.pow(1 - t, 3));
    el.textContent = format(run.current);
    if (t < 1) requestAnimationFrame(step); else { clearTimeout(run.timer); finish(); }
  };
  requestAnimationFrame(step);
}

export const money = (n) => '$' + Math.round(n).toLocaleString('en-US');

export function initCommon({ key }) {
  document.documentElement.classList.add('js');
  initTheme(`${key}:theme`);
  initRibbon(`${key}:ribbon`);
  initReveal();
  $$('[data-year]').forEach((e) => { e.textContent = String(new Date().getFullYear()); });
}
