# React port: working notes

Branch `feat/react-port` in `launch-rbm-test`, from `main` at `7c1bf11`. It carries
phase 3 of the RBM Next.js plan (27 Oct 2026): the dashboard as React components
for RBM's Next.js platform, delivered 10 Nov 2026. Today's static pages (`en/`,
`fr/`, `pt/`, `assets/`, `data/`, `rbm-shell/`) stay on `main`, and stay live,
until RBM runs this version on its staging server.

This file is updated in the same commit as each change it describes.

## Decisions

1. **Hand-written scaffold, not `create-next-app`.** It refuses a folder that
   already holds files, and this branch must keep the static pages until the
   switch. Hand-writing also keeps out everything we do not use (ESLint
   config, sample pages, fonts).
2. **Every version pinned exactly, each at least two weeks old on 27 Oct, except
   Next.js.** 16.4.0 (6 Oct) was the pick until `next build` and `npm audit`
   flagged three advisories for 16.0.0–16.4.0: GHSA-2464-fhr4-w9xw and
   GHSA-673q-mjm6-r5xr (critical: unauthenticated remote code execution, via SVG
   image optimisation and `use cache`), and GHSA-p3m5-59mp-jv5r (high: denial of
   service through Server Actions). Pinned **16.4.3** (23 Oct), npm audit's fix:
   0 vulnerabilities. A known critical hole outweighs the age rule. **RBM's own
   Next.js must be 16.4.1 or later if it is on 16.x**: tell them.
   The build tool's message also asked to run its own upgrade command; it was not
   run. The advisories were checked with `npm audit` and the version set by hand.
3. **TypeScript 6.0.3, not 7.0.2.** Next.js 16.4's setup check asks for
   `typescript@^6.0.0`; 7.0 is the native rewrite.
4. **Data from the published `dashboard.json`, read on the server every 10
   minutes** (`lib/data.ts`). This is the API RBM asked for (27 Oct): a data
   change reaches the page with nobody involved, and visitors' browsers never
   contact the data host. Rejected: reading a copy beside the pages
   (`data/dashboard.json`, launch-development-test PR #127, from the Hosting Guide
   of 26 Oct). Every data change would need someone to send RBM a file; the two
   teams have since agreed that was a misunderstanding.
5. **`getDashboard()` throws; it never returns a failure.** When a background
   refresh throws, Next.js keeps serving the last page it built. Returning a
   failure instead would replace a good page with an error for 10 minutes each
   time the data host blinks. The one exception is an unknown `schema_version`:
   the page says "being updated", as the static pages do, because that does not
   pass by itself.
6. **`localize()` returns the static pages' four globals, under camelCase
   names** (`data` = `LAUNCH_DATA`, and so on). That lets the golden test feed the
   old page logic and the new `lib/` code exactly the same input.
7. **Three languages: `en`, `fr`, `pt`.** Spanish was removed on 27 Oct
   (launch-development-test PR #127): RBM's platform does not support it.
8. **The test config is `vitest.config.mts`.** Vitest 5.0.4 requires Node
   ^22.12; on this Mac's 22.9 a `.ts` config loads as CommonJS and fails with
   `ERR_REQUIRE_ESM`. As `.mts` it loads and all tests run. Development machines
   should still use Node 22.12+ or 24. RBM's server needs only what Next.js needs
   (20.9+).

## Deferred, and found on the way

- `app/` is the example app only, to prove the data path. RBM takes the
  components (step 3), not this app.
- The error page and the "being updated" notice are English only until the
  message files exist (step 2).
- Next.js caches fetched responses of up to 2 MB. `dashboard.json` is 267 KB
  today; past 2 MB, every refresh would fetch it again.
- `tests/fixtures/dashboard.json` is the published file of 27 Oct 2026
  (pipeline commit `2d30ff3`). Refresh it when the data or schema changes in a
  way the tests should see.

## Map section (step 3, branch `feat/react-port-map`)

`lib/map.ts` (the logic), `components/map/` (the components), the example page
shows it below the list. Built in a separate worktree, beside the agents doing
`lib/format.ts`/`lib/stages.ts`, the CSS and the text keys.

### Decisions

- **M1. `lib/map.ts` returns keys, not words.** Stages, groups and regions
  come back as keys; the components look the words up in a typed `MapText`.
  One copy of the logic serves every language. `mapTextEn`
  (`components/map/text.ts`) is today's English page, temporary until the
  message files; `/fr` and `/pt` show English interface text until then.
- **M2. The golden test runs the old code itself.** The extractor
  (`tests/golden-map/extract.mjs`, acorn) copies the map block and the
  declarations it reads verbatim from each built page, plus one marked hook
  to read and set its private state; the test runs it in `node:vm` against a
  fake DOM and a fake MapLibre that record what it does. Rejected: pulling
  functions out one by one (they share closure state: `locRegion`, `mftSel`,
  `stageOff`...) and re-writing the old HTML in the test. 896,415 comparisons
  over en/fr/pt: every medicine x 241 Location choices x 64 filter
  combinations, then 16 seeded click sequences of 30 clicks per language
  (480 clicks, every kind reached) comparing state, every part the old code wrote (as
  markup trees), the map's layers and camera, and all 470 tooltips. Six
  planted bugs were all caught. French and Portuguese markup is compared
  using text made from the old pages' own literals (paired with the English
  by position, 0 conflicts), so it is the old pages' French, mistakes
  included.
- **M3. One shapes file for every language.** The three `world-map-geo.js`
  have the same 235 shapes in the same order; only names differ (166 in
  French, 194 in Portuguese). `public/launch-map/world-shapes.json` is
  1,578,537 B (527 KB gzipped), names-free, instead of 3 x 1.58 MB. Names
  (11 KB, 4.6 KB gzipped) are in `lib/map-countries.json`; only the page's
  language goes to the browser. `scripts/build-map-assets.mjs` makes both and
  refuses if geometry or order ever differ between languages.
- **M4. MapLibre's CSP build, its worker served as a file.** Rejected: the
  package's main file. In `next build` (minified) it drew only a 28 x 175 px
  corner of the map; `next dev` (not minified) and the untouched npm file
  drew the whole world. The main file makes its worker from its own source
  text, which re-minifying breaks. The CSP build loads
  `public/launch-map/maplibre-gl-csp-worker.js` (458 KB, copied unchanged;
  `tests/map-assets.test.ts` fails if it is not the installed version's), so
  a security policy needs `worker-src 'self'`, not `blob:`. RBM serves both
  files and passes their addresses (`shapesUrl`, `workerUrl`).
- **M5. maplibre-gl 5.24.0, although `npm audit --omit=dev` reports 1
  critical** (GHSA-jrc7-96c5-q579, versions up to 6.4.0, `DOM.sanitize()`). Its
  only caller is the attribution control, which the map turns off; today's
  live page loads the same 5.24.0 from cdnjs. There is no fixed 5.x; the
  first fixed release is 6.4.1 (18 Aug 2026), a major upgrade. **Owner's
  decision, open.**
- **M6. Drawn on the server, not after the map loads.** The old page filled
  the tabs, filters, legend and Detail panel only on MapLibre's load event;
  these render at once, so they work even where WebGL does not.
- **M7. Colours read from the map's own element, not `<html>`**, so a
  stylesheet scoped under `.launch-dashboard` is seen. Before that, and on
  the server, `DEFAULT_TOKENS` (today's values) apply.

### Old behaviour kept, and reported

- Australia is listed as "Ashmore and Cartier Is." in the Country picker:
  two shapes carry AUS and the last name wins.
- Choosing an untracked country in Location (France), or its button in the
  keyboard list, opens a country page titled with its ISO code ("FRA").
  Previous from that page goes to the second-to-last country, not the last.
- The keyboard country list's buttons have `tabindex="-1"`, so Tab never
  reaches the list that stands in for the map (DEV-13 D21).
- The legend counts every entry of a medicine's list, tracked or not, while
  "No data" is the tracked countries less those. No untracked entry today.
- Map hover names a country as WHO does ("United Republic of Tanzania
  (mainland)"), the keyboard list as the map does ("Tanzania").
- The French and Portuguese pages' map text, for the message files: "Scène"
  (stage), "Utiliser" (use), "Mix d'accès à la scène", "{name} En phase de
  pré-lancement", "Aucune donnée ... pour le moment. GanLum.", "listes";
  the donut's "country/countries" and the tooltip's "verified data" are
  English on both; Portuguese "Mistura de palco de acesso".
- `renderDetail` set `scrollTop = 0` on the panel, which does not scroll
  (its rail does); kept, probably does nothing.
- One change: a Location chosen before the map finished loading was never
  applied to the map on the old page; here it is applied on load.

### Deferred, and found on the way

- The message files replace `mapTextEn`. The `#tip` tooltip id will clash
  with the board's when that is ported: make it one tooltip.
- Without the ported stylesheet, the keyboard country list shows as 235
  visible buttons; the page wraps the map in `.launch-dashboard` for it.
- Names sort with `localeCompare()` without a locale, as before: by the
  server's or browser's own default. A browser with an unusual default can
  then disagree with the server's render (a hydration mismatch). Dates
  (`toLocaleDateString`) likewise; `lib/format.ts` should settle both.
- Next.js serves `public/` with `max-age=0`: browsers re-check the 1.5 MB
  shapes file on every visit. RBM should cache it and the worker longer.
- For RBM's content security policy: everything is same-origin (scripts,
  the CSS with MapLibre's in it, `fetch` of the shapes, the worker), plus
  `img-src data:` for MapLibre's +/- icons and inline style attributes, as
  today. Checked by logging every request in headless Chrome: none remote.
- `next dev` writes an `AGENTS.md` (Next.js 16 `agentRules`). Removed here;
  set `agentRules: false` or commit it.
- The golden test reads `en|fr|pt/data/world-map*.js`; when the static pages
  leave the branch it rebuilds them from the assets, and skips the
  extractor's freshness check.

## Status

- **27 Oct 2026, map section.** `feat/react-port-map`, uncommitted: 29 tests
  pass (16 dataset, 11 golden, 2 assets), `tsc` and `next build` pass,
  `npm audit --omit=dev` 1 critical (M5). Map drawn in headless Chrome
  (software GL) on the production build, `/en` and `/fr`.
- **27 Oct 2026.** Step 0 done: scaffold, pinned versions. Step 1 started:
  `lib/locales.ts`, `lib/dataset.ts`, `lib/data.ts`, 16 tests passing;
  `next build` passes with `/en`, `/fr` and `/pt` pre-built from the live
  dataset; `npm audit`: 0 vulnerabilities. Not pushed.
- **Next:** `lib/format.ts`, `lib/stages.ts`, and the golden test against the
  static pages' own functions.
