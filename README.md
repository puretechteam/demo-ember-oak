# Ember & Oak: concept restaurant website

A sample website by [Pure Tech](https://puretechteam.github.io/) for a fictional wood-fired
kitchen and wine bar. Ember & Oak is not a real business: the name, people, address, phone
number, menu and reviews are all invented.

**Live demo:** https://puretechteam.github.io/demo-ember-oak/

## Features
- **Live ember hero.** A WebGL shader draws drifting embers and heat shimmer. It pauses when
  off screen, and falls back to a still gradient on low-power devices or when reduced motion
  is on.
- **Scroll motion.** Parallax and reveals are driven by CSS scroll timelines, with a fallback
  for older browsers.
- **Live menu.** 16 dishes with dietary filters (vegan, vegetarian, gluten-free, spicy),
  search, animated re-layout and a spoken result count for screen readers.
- **Tasting menu builder.** Pick a dish per course and see per-guest and table totals. The
  suggested wine pairing changes with your picks, and the result can be sent to the booking
  form.
- **Reservations.** Date limits and Monday closures, time slots built from that night's
  hours, inline validation and a confirmation dialog. Nothing is sent anywhere.
- **Open now badge.** Live open or closed status computed in Pacific time and updated every
  minute.
- **Gallery.** Six illustrated tiles with a lightbox that uses the View Transitions API, with
  keyboard and Esc support.
- Light and dark themes, a mobile menu, a custom 404 page, structured data (schema.org
  Restaurant) and social preview cards.

Every visual is drawn in code (SVG, CSS and WebGL). There are no stock photos.

## Run it locally
No build step. Serve the folder with any static server, for example:

```powershell
npx serve . -l 4301
```

Then open http://localhost:4301.

## Tests
Tests use Playwright (desktop and mobile), axe-core for accessibility and html-validate.

```powershell
npm install
npx playwright install chromium
npm test
npm run validate
```

## License
MIT. See [LICENSE](LICENSE).
