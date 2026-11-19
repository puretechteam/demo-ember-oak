// Live menu filtering and the build-a-tasting-menu tool. Both read dishes from the menu markup.
import { $, $$, reducedMotion, countTo, money } from './common.js';

const TAG_LABEL = { vegan: 'Vegan', vegetarian: 'Vegetarian', 'gluten-free': 'Gluten-free', spicy: 'Spicy' };

export function readDishes(root = document) {
  return $$('.dish', root).map((el) => ({
    el,
    id: el.dataset.id,
    section: el.dataset.section,
    name: $('.dish-name', el).textContent.trim(),
    price: Number(el.dataset.price),
    tags: (el.dataset.tags || '').split(/\s+/).filter(Boolean),
    text: el.textContent.toLowerCase(),
  }));
}

/* ---------- Filters + search with FLIP re-layout ---------- */
export function initMenu() {
  const root = $('[data-menu]');
  if (!root) return;
  const dishes = readDishes(root);
  const sections = $$('[data-menu-section]', root);
  const chips = $$('[data-filter]', root);
  const search = $('#menu-search', root);
  const count = $('[data-menu-count]', root);
  const empty = $('[data-menu-empty]', root);
  const clearAll = $('.chip-clear', root);
  const active = new Set();
  const total = dishes.length;
  let announceTimer;

  const fits = (d, words) => {
    for (const f of active) {
      const ok = f === 'vegetarian' ? d.tags.includes('vegetarian') || d.tags.includes('vegan') : d.tags.includes(f);
      if (!ok) return false;
    }
    return words.every((w) => d.text.includes(w));
  };

  const countText = (n) => {
    if (n === 0) return 'No dishes match';
    if (n === total) return `Showing all ${total} dishes`;
    return `Showing ${n} of ${total} dishes`;
  };

  function apply({ debounce = false } = {}) {
    const words = search.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const animate = !reducedMotion();
    const movers = [...dishes.map((d) => d.el), ...sections.map((s) => s.firstElementChild)];
    const before = new Map();
    if (animate) movers.forEach((el) => { if (el.offsetParent) before.set(el, el.getBoundingClientRect()); });

    let n = 0;
    dishes.forEach((d) => { const show = fits(d, words); d.el.hidden = !show; if (show) n++; });
    sections.forEach((s) => { s.hidden = !s.querySelector('.dish:not([hidden])'); });
    empty.hidden = n > 0;
    clearAll.hidden = !(active.size || words.length);

    clearTimeout(announceTimer);
    const say = () => { count.textContent = countText(n); };
    if (debounce) announceTimer = setTimeout(say, 350); else say();

    if (!animate) return;
    const vh = window.innerHeight;
    movers.forEach((el) => {
      if (!el.offsetParent) return;
      const after = el.getBoundingClientRect();
      if (after.bottom < -200 || after.top > vh + 200) return;
      const prev = before.get(el);
      if (prev) {
        const dx = prev.left - after.left;
        const dy = prev.top - after.top;
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
        el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }],
          { duration: 480, easing: 'cubic-bezier(.2,.7,.2,1)' });
      } else {
        el.animate([{ opacity: 0, transform: 'translateY(12px) scale(.98)' }, { opacity: 1, transform: 'none' }],
          { duration: 420, easing: 'cubic-bezier(.2,.7,.2,1)' });
      }
    });
  }

  chips.forEach((chip) => chip.addEventListener('click', () => {
    const f = chip.dataset.filter;
    const on = chip.getAttribute('aria-pressed') !== 'true';
    chip.setAttribute('aria-pressed', String(on));
    if (on) active.add(f); else active.delete(f);
    apply();
  }));
  search.addEventListener('input', () => apply({ debounce: true }));
  search.addEventListener('keydown', (e) => { if (e.key === 'Escape' && search.value) { search.value = ''; apply(); } });
  $$('[data-menu-clear]', root).forEach((b) => b.addEventListener('click', () => {
    active.clear();
    chips.forEach((c) => c.setAttribute('aria-pressed', 'false'));
    search.value = '';
    apply();
    search.focus();
  }));
}

/* ---------- Build a tasting menu ---------- */
const MAIN_WINE = {
  ribeye: { name: 'Ashgrove Syrah 2020', region: 'Walla Walla Valley, Washington', note: 'Black olive, smoked meat and enough grip for the marrow butter.' },
  chicken: { name: 'Morgon, Côte du Py 2022', region: 'Beaujolais, France', note: 'Bright, crunchy gamay that cools the chili oil without hiding it.' },
  branzino: { name: 'Albariño 2023', region: 'Rías Baixas, Spain', note: 'Salty and citrusy, made for fish that tastes of the grill.' },
  cauliflower: { name: 'Skin-contact Pinot Gris 2022', region: 'Willamette Valley, Oregon', note: 'Copper-colored with a little tannin to stand up to the romesco.' },
  pork: { name: 'Eola Hills Pinot Noir 2021', region: 'Willamette Valley, Oregon', note: 'Red cherry and forest floor next to the cider glaze.' },
};
const HEAT_WINE = { name: 'Riesling Kabinett 2021', region: 'Mosel, Germany', note: 'Your picks bring real heat, so Hollis goes off-dry: a touch of sweetness and bright acid to calm the chili.' };
const FIRST_POUR = {
  beets: 'Dry rosé of Grenache', padron: 'Txakoli, poured from height', flatbread: 'Willamette brut sparkling',
  trout: 'Grüner Veltliner', clams: 'Muscadet sur lie',
};
const LAST_POUR = { cheesecake: '10-year tawny port', chocolate: 'Banyuls', peaches: "Moscato d'Asti" };
const PAIRING_PRICE = 38;
const COURSES = ['small', 'fire', 'side', 'sweet'];

export function pairingFor(picks, byId) {
  const main = picks.fire && MAIN_WINE[picks.fire];
  if (!main) return null;
  const chosen = Object.values(picks).filter(Boolean).map((id) => byId[id]);
  const heat = chosen.filter((d) => d.tags.includes('spicy')).length >= 2;
  const wine = heat ? HEAT_WINE : main;
  const pours = [];
  if (picks.small) pours.push(['First', `${FIRST_POUR[picks.small]} with the ${byId[picks.small].name.toLowerCase()}`]);
  pours.push(['Main', `${wine.name}, ${wine.region}`]);
  if (picks.sweet) pours.push(['Finish', LAST_POUR[picks.sweet]]);
  return { ...wine, pours, heat };
}

const checkSvg = '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

export function initTasting() {
  const form = $('[data-tasting]');
  if (!form) return;
  const dishes = readDishes();
  const byId = Object.fromEntries(dishes.map((d) => [d.id, d]));
  const picks = { small: null, fire: null, side: null, sweet: null };
  let party = 2;

  const perEl = $('[data-per-person]');
  const tableEl = $('[data-table-total]');
  const partyEl = $('[data-party]');
  const status = $('[data-tasting-status]');
  const pairingBox = $('[data-pairing]');
  const pairName = $('[data-pairing-name]');
  const pairNote = $('[data-pairing-note]');
  const pours = $('[data-pours]');
  const addPair = $('[data-pairing-add]');
  const minus = $('[data-step="-1"]');
  const plus = $('[data-step="1"]');
  const book = $('[data-book-tasting]');

  // Render one card per dish into its course.
  COURSES.forEach((course) => {
    const holder = $(`[data-course="${course}"] [data-options]`, form);
    holder.innerHTML = dishes.filter((d) => d.section === course).map((d) => `
      <label class="opt">
        <input type="radio" name="course-${course}" value="${d.id}" data-price="${d.price}">
        <span class="opt-body">
          <span class="opt-top"><span class="opt-name">${d.name}</span><span class="opt-check">${checkSvg}</span></span>
          <span class="opt-price">${money(d.price)}</span>
          <span class="opt-tags">${d.tags.map((t) => TAG_LABEL[t]).join(' · ') || '&nbsp;'}</span>
        </span>
      </label>`).join('');
  });

  let statusTimer;
  function update() {
    const food = COURSES.reduce((sum, c) => sum + (picks[c] ? byId[picks[c]].price : 0), 0);
    const pairing = pairingFor(picks, byId);
    const wine = addPair.checked ? PAIRING_PRICE : 0;
    const per = food + wine;
    const table = per * party;
    countTo(perEl, per, { format: money, duration: 500 });
    countTo(tableEl, table, { format: money, duration: 600 });
    partyEl.textContent = String(party);
    minus.disabled = party <= 1;
    plus.disabled = party >= 12;

    COURSES.forEach((c) => {
      const li = $(`[data-pick="${c}"]`);
      li.classList.toggle('is-set', !!picks[c]);
      $('.pick-name', li).textContent = picks[c] ? byId[picks[c]].name : 'Not chosen yet';
    });

    const nextName = pairing ? pairing.name : 'Choose something from the fire';
    if (pairName.textContent !== nextName) {
      pairName.textContent = nextName;
      pairingBox.classList.remove('is-changed');
      void pairingBox.offsetWidth;
      pairingBox.classList.add('is-changed');
    }
    pairNote.textContent = pairing ? `${pairing.region}. ${pairing.note}` : 'The main course sets the direction. Hollis builds the other pours around it.';
    pours.innerHTML = pairing ? pairing.pours.map(([k, v]) => `<li><span>${k}</span><span>${v}</span></li>`).join('') : '';

    book.textContent = `Reserve for ${party} ${party === 1 ? 'guest' : 'guests'}`;
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => {
      status.textContent = `${money(per)} per guest, ${money(table)} for a table of ${party}.`;
    }, 400);
  }

  form.addEventListener('change', (e) => {
    const input = e.target;
    if (input.type !== 'radio') return;
    picks[input.name.replace('course-', '')] = input.value;
    update();
  });
  addPair.addEventListener('change', update);
  [minus, plus].forEach((b) => b.addEventListener('click', () => {
    party = Math.min(12, Math.max(1, party + Number(b.dataset.step)));
    update();
  }));

  // Carry the table size and picks into the booking form.
  book.addEventListener('click', () => {
    const sel = $('#res-party');
    if (sel) { sel.value = String(party); sel.dispatchEvent(new Event('change', { bubbles: true })); }
    const notes = $('#res-notes');
    const chosen = COURSES.filter((c) => picks[c]).map((c) => byId[picks[c]].name);
    if (notes && chosen.length && !notes.value) {
      notes.value = `Tasting menu: ${chosen.join(', ')}${addPair.checked ? ', with the wine pairing' : ''}.`;
    }
  });

  update();
}
