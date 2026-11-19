// Gallery lightbox: <dialog> with View Transitions when available, arrow keys, focus restore.
import { $, $$, reducedMotion } from './common.js';

const NAME = 'lb-art';

export function initGallery() {
  const grid = $('[data-gallery]');
  const dialog = $('[data-lightbox]');
  if (!grid || !dialog) return;
  const tiles = $$('.tile', grid);
  const art = $('[data-lb-art]', dialog);
  const title = $('[data-lb-title]', dialog);
  const desc = $('[data-lb-desc]', dialog);
  const counter = $('[data-lb-count]', dialog);
  let index = 0;
  let busy = false;

  const canTransition = () => typeof document.startViewTransition === 'function' && !reducedMotion();
  const tileArt = (i) => $('.art', tiles[i]);

  function fill(i) {
    index = (i + tiles.length) % tiles.length;
    const t = tiles[index];
    const svg = tileArt(index).cloneNode(true);
    svg.removeAttribute('style');
    art.replaceChildren(svg);
    title.textContent = t.dataset.title;
    desc.textContent = t.dataset.desc;
    counter.textContent = `${index + 1} of ${tiles.length}`;
  }

  async function run(update) {
    // Mid-transition input applies immediately rather than being dropped.
    if (busy || !canTransition()) { update(); return; }
    busy = true;
    try {
      const vt = document.startViewTransition(update);
      vt.ready.catch(() => {});
      await vt.finished;
    } catch { /* transition skipped */ } finally {
      busy = false;
    }
  }

  function open(i) {
    if (dialog.open) return;
    fill(i);
    const from = tileArt(index);
    from.style.viewTransitionName = NAME;
    run(() => {
      from.style.viewTransitionName = '';
      art.style.viewTransitionName = NAME;
      dialog.showModal();
      $('[data-lb-close]', dialog).focus();
    }).then(() => { art.style.viewTransitionName = ''; });
  }

  function close() {
    if (!dialog.open) return;
    const target = tileArt(index);
    art.style.viewTransitionName = NAME;
    run(() => {
      art.style.viewTransitionName = '';
      target.style.viewTransitionName = NAME;
      dialog.close();
    }).then(() => { target.style.viewTransitionName = ''; });
  }

  function step(dir) {
    run(() => fill(index + dir));
  }

  tiles.forEach((t, i) => t.addEventListener('click', () => open(i)));
  $('[data-lb-prev]', dialog).addEventListener('click', () => step(-1));
  $('[data-lb-next]', dialog).addEventListener('click', () => step(1));
  $('[data-lb-close]', dialog).addEventListener('click', close);
  dialog.addEventListener('cancel', (e) => { e.preventDefault(); close(); });
  dialog.addEventListener('click', (e) => { if (e.target === dialog) close(); });
  dialog.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
  });
  // Return focus to the tile now on screen, so keyboard users land where they left off.
  dialog.addEventListener('close', () => { tiles[index].focus({ preventScroll: true }); tiles[index].scrollIntoView({ block: 'nearest' }); });
}
