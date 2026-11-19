import { initCommon, $, $$, countTo, reducedMotion } from './common.js';
import { initHours } from './hours.js';
import { initMenu, initTasting } from './menu.js';
import { initReserve } from './reserve.js';
import { initGallery } from './gallery.js';

initCommon({ key: 'emberoak' });

// Web fonts are progressive enhancement: request them after first contentful paint so text
// renders at once in the metric-matched fallbacks. <noscript> covers no-JS visits.
const FONTS = 'https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..600;1,9..144,300..500&family=Instrument+Sans:wght@400..600&display=swap';
(function afterFirstPaint(fn) {
  let done = false;
  const run = () => { if (!done) { done = true; fn(); } };
  if (performance.getEntriesByName('first-contentful-paint').length) { run(); return; }
  try {
    new PerformanceObserver((list, obs) => {
      if (list.getEntries().some((e) => e.name === 'first-contentful-paint')) { obs.disconnect(); run(); }
    }).observe({ type: 'paint', buffered: true });
  } catch { addEventListener('load', run, { once: true }); }
  setTimeout(run, 2500); // background tabs never report a paint
})(() => {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = FONTS;
  document.head.append(link);
});

function initHeader() {
  const header = $('[data-header]');
  if (!header) return;
  let ticking = false;
  const sync = () => { header.classList.toggle('is-condensed', window.scrollY > 24); ticking = false; };
  window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(sync); } }, { passive: true });
  sync();
}

function initNav() {
  const header = $('[data-header]');
  const toggle = $('.nav-toggle');
  const list = $('#nav-list');
  if (!header || !toggle || !list) return;
  const setOpen = (open) => {
    header.classList.toggle('nav-open', open);
    toggle.setAttribute('aria-expanded', String(open));
  };
  toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
  list.addEventListener('click', (e) => { if (e.target.closest('a')) setOpen(false); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') { setOpen(false); toggle.focus(); }
  });
  document.addEventListener('click', (e) => { if (!header.contains(e.target)) setOpen(false); });
  window.matchMedia('(min-width: 961px)').addEventListener('change', (e) => { if (e.matches) setOpen(false); });

  // Highlight the section in view.
  const links = $$('a[href^="#"]', list).filter((a) => !a.classList.contains('btn'));
  const map = new Map(links.map((a) => [a.getAttribute('href').slice(1), a]));
  if (!('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      links.forEach((a) => a.classList.remove('is-active'));
      map.get(en.target.id)?.classList.add('is-active');
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  map.forEach((_, id) => { const s = document.getElementById(id); if (s) io.observe(s); });
}

function initStats() {
  const nums = $$('[data-count]');
  if (!nums.length || reducedMotion() || !('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      const el = en.target;
      io.unobserve(el);
      const to = Number(el.dataset.count);
      if (!to) return;
      el.dataset.value = '0';
      el.textContent = '0';
      countTo(el, to, { duration: 1400 });
    });
  }, { threshold: 0.6 });
  nums.forEach((n) => io.observe(n));
}

function initEmbersLater() {
  const hero = $('[data-hero]');
  if (!hero) return;
  const go = () => import('./embers.js').then((m) => m.initEmbers(hero)).catch(() => { hero.dataset.fx = 'static'; });
  // Wait for load plus a beat, then an idle slot, so the effect never competes with first paint.
  const idle = () => setTimeout(() => ('requestIdleCallback' in window ? requestIdleCallback(go, { timeout: 2000 }) : go()), 1200);
  if (document.readyState === 'complete') idle();
  else window.addEventListener('load', idle, { once: true });
}

initHeader();
initNav();
initHours();
initMenu();
initTasting();
initReserve();
initGallery();
initStats();
initEmbersLater();
