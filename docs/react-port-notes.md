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
9. **What "the pure logic" is.** Ported: the formatting helpers (`readableDate`,
   `shortDate`, `fmtFig`, `firstClause`, `citeLinks`, `citeHtml` as
   `citeOrText`) to `lib/format.ts`, and the stage rules from `stageYear` to
   `yardResult`, with every helper they read (`statusShown`, `peekLine`,
   `peekLineFor`, `phaseOf`, and the start-up statement that rewrites `late` as
   `prog`, as `applyShowLate`) to `lib/stages.ts`. Old names kept. Not ported:
   functions that only build markup (`yardBadge`, `yardPill`, `yardBox`,
   `yardTable`, `yardNote`, `accessCell`, `accessInfo`, `lateInfo`); they
   become components. Rejected: porting the small values inside those now
   (`yardBox`'s due year, `yardTable`'s phase headers, `yardNote`'s stage
   lists). No old function returns them alone, so the golden test could check
   them only by writing the markup again.
10. **The page's globals and switches travel in a `StageContext`**
    (`stageContext()`), and "today" is its `asOfYear`: the year of the
    dataset's `lastUpdated`, as `ASOF_YEAR` was, overridable for tests.
    Rejected: injecting a clock. The page never reads one (the golden test
    counts 0 clock reads across its 82,911 comparisons), so a clock would be
    new behaviour.
11. **The display switches are `DISPLAY`, as shipped** (`showProgress`,
    `progressKept`, `showLate`, `yardCompare`). The golden test also runs them
    turned on. As shipped, `yardstick()` returns null for every medicine, so
    its port would otherwise never be compared on a real result.
12. **Language text is a temporary table, `lib/strings.ts`**, one typed entry
    per language, copied from the built fr/pt pages, with `{name}`
    placeholders, the form the message files will use. Step 2 replaces it.
    Rejected: one copy of the functions per language, which is what the pages
    did (the build wrote translations into the code); and message files now,
    which is step 2 and needs its library chosen first.
13. **Citations are values, not markup**: `{ label, url? }[]`. Two quirks of
    the page are kept, so the port behaves the same: ids are looked up on a
    plain object, so `"constructor"` finds `Object.prototype`'s and shows as an
    empty name; and the free-text fallback is judged on the joined markup being
    empty, so one nameless, unlinked source also falls back.
14. **The golden test runs the page's own code.** `tests/golden/extract.mjs`
    copies the needed top-level declarations, verbatim, out of
    `git show 7c1bf11:{en,fr,pt}/index.html` into `tests/golden/reference/`
    (`--check` confirms they are current), so it works after the static pages
    are deleted. The test loads each copy into `node:vm` with the globals from
    `localize()`, and compares old and new over 85 product variants, every
    stage, every string, date and citation in the data, and synthetic edge
    cases, in 6 scenarios (switches, three "today" years, no `stageColumns`)
    per language: 82,911 comparisons, all equal. Eleven planted bugs: 9
    caught; the 2 missed cannot change any result (`sinceFrom`'s
    `j.length > 1` against `> 0`; `stageYear`'s unreachable `<= 2100`).
15. **Today's CSS, scoped under one root class, not CSS Modules**
    (`styles/launch-dashboard.css`, branch `feat/react-port-styles`). Without the
    iframe, our CSS and RBM's share one page, so ours must be fenced in. Keeping
    the class names lets the components reuse the CSS unchanged, which protects
    visual parity before 10 Nov. Rejected: CSS Modules per component, which
    rewrites all 1,471 lines and every class reference in the markup and script.
    The file is the page's `<style>` block plus the Unitaid skin
    (`scripts/rbm-skin.js`), from launch-development `main` at `89b2011`, in the
    built RBM page's order (checked byte-identical against `en/index.html`). 728
    rules, 821 selectors scoped; values, comments and order unchanged.
    - `:root`, `html` and `body` rules apply to the `.launch-dashboard` element
      itself, so the tokens live there. `*` became `.launch-dashboard,
      .launch-dashboard *`, so the root keeps `box-sizing` as `body` had it. The
      skin's `:root:not([data-theme="light"])` and `:root[data-theme="dark"]`
      keep their specificity on the root; nothing sets `data-theme`.
    - `html.sub-open .ri-pill` became `.launch-dashboard.sub-open .ri-pill`; the
      skin's `html .ri-*` rules became `.launch-dashboard .ri-*` (still more
      specific than the widget's own `.ri-*`, the reason they had `html`).
    - `@keyframes disc-flash` became `ld-disc-flash`.
    - Nothing dropped. The site menu's styles live in `assets/site-nav.js`, the
      structured data has none, and the pre-v1.0 page
      (`illustrated-journey-dashboard.html`) is a separate file. Rules that only
      apply with `SHOW_BARRIERS` or `SHOW_PROGRESS` on (`.c-bar`, `.flagnote`,
      `.gp-why`, `.det-flag`, the seven-column grids) are part of the v1.0 page
      and stay.
    - `tests/styles.test.ts` checks the fence, the keyframes, and that its own
      checks can fail.
16. **The interface text is copied in, not written here** (`messages/*.json`,
    `lib/messages.ts`). The English source is `i18n/ui.en.json` in
    launch-development-test (276 keys, by component area), translated and
    approved by the existing pipeline; `scripts/build-rbm-messages.js` writes the
    three files from the translation memory. Rejected: the English next to the
    code here, which would take the text out of the approval flow. Copy
    `feat/rbm-messages` `280ad5d`, built with `--allow-stale`: 269 of 276
    strings are translated in fr and pt; the 7 that are not (four download
    table headings, "country"/"countries" on the map, "data" in a hint) have
    never been through the pipeline and already show in English on /fr and /pt.
    `tests/messages.test.ts` keeps the three files' keys and `{placeholders}`
    in step.

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
- **Old behaviour kept as it is, and worth a decision later:**
  - `fmtFig` reads a comma as a thousands separator in every language: a French
    or Portuguese decimal with three digits after the comma (`"0,125 mg"`)
    would show as `"125 mg"`, and `"US$1,234.50"` as `"US$1.23K.50"`. Neither
    is in today's data. It changes only English text today; fr/pt write the
    figures out ("11,6 millions de dollars").
  - Singular for exactly 1 in every language: French reads "0 années".
  - The Portuguese status word for Complete is `"Concluir"` ("to complete"),
    not "Concluído". Two Portuguese yardstick labels end in a full stop where
    English has none.
  - `yardstick()` treats a final stage that is done but undated as still
    going, so the whole journey counts on to today.
  - `peekLine` with a status outside the four writes "undefined"; the types
    now rule that out.
  - `readableDate` is not called anywhere on today's page.
- **Pure, but outside this step**, to port with their components:
  `colIndexOf`, `sameColumn`, `preBoundaryDone`, `stalledSince` (with
  `nowYear`, the same value as `ASOF_YEAR`), `lateAt`, `stepNo`, the `tracked`
  order, `csvCell`, `journeyTime`'s axis and tier layout, and the counts in
  `countryAccessKv` and `gatePanelHTML`.
- The texts inside the markup builders (`LATE_DEF`, `ACCESS_DEF`, the
  yardstick box and table labels) are not in `lib/strings.ts`; they go
  straight to the message files with their components.
- **The components must move four things off `<html>`/`<body>`** (the page's
  script, `index.html` at `89b2011`):
  `openSub()`/`closeSub()` toggle `sub-open` on `<html>`, which goes on the root
  instead; the map reads its colours with
  `getComputedStyle(document.documentElement)`, which finds no tokens now, so
  read from the root; `#tip` (markup, outside `.wrap`), `.stat-tip`
  (appended to `<body>`) and the feedback widget's pill and dialog
  (`report-issue.js`, appended to `<body>`) must render inside the root or
  they lose their styles. The `prefers-color-scheme` listener and the
  `data-theme` observer on `<html>` are no-ops (light only) and can go.
- **The fence is one way.** RBM's global CSS (element rules, resets) still
  reaches inside. Check against RBM's real stylesheet on staging.
- **Breakpoints now measure RBM's window, not the iframe.** In the iframe a
  `max-width: 760px` query saw the frame; now it sees the whole window, which
  includes RBM's sidebar (270px, by the page's own comments). Container queries
  would fix it but change every breakpoint; not done.
- **Remote loads outside this file.** Source Sans 3 comes from Google Fonts
  (`fonts.googleapis.com`, `fonts.gstatic.com`) and MapLibre's CSS from cdnjs.
  RBM's content security policy may block both. Options: `next/font/google`
  (fetched at build, served from RBM's own host) and `maplibre-gl.css` from
  npm. The file itself has no `@import`, `url()` or `@font-face`.
- The feedback widget's own stylesheet (`report-issue.js`) is global and
  unscoped; scope it too if the widget is ported.
- `styles/launch-dashboard.css` is a copy of `89b2011`. CSS changes to
  `index.html` after that are ported by hand.

## Status

- **27 Oct 2026.** Step 0 done: scaffold, pinned versions. Step 1 started:
  `lib/locales.ts`, `lib/dataset.ts`, `lib/data.ts`, 16 tests passing;
  `next build` passes with `/en`, `/fr` and `/pt` pre-built from the live
  dataset; `npm audit`: 0 vulnerabilities. Not pushed.
- **27 Oct 2026, later.** Step 1 continued: `lib/format.ts`, `lib/stages.ts`,
  `lib/strings.ts` (temporary), types filled in `lib/dataset.ts` (no change to
  what `localize()` returns), and the golden test (`tests/golden.test.ts`,
  `tests/golden/`). 38 tests pass (16 + 22), `tsc --noEmit` clean, `next build`
  passes. Committed `aebe664`.
- **27 Oct 2026, styles** (branch `feat/react-port-styles`):
  `styles/launch-dashboard.css`, `tests/styles.test.ts`, and the example
  layout imports the file and wraps its children in `.launch-dashboard`. 23
  tests pass; `tsc --noEmit` and `next build` pass, and the built CSS has no
  selector outside the root. Committed `5f5447b`, merged here.
- **27 Oct 2026, message files.** `messages/{en,fr,pt}.json` copied from
  launch-development-test `feat/rbm-messages` `280ad5d` (its verify block as
  expected; its test 46 passed), with `lib/messages.ts`, `messages/README.md`
  and `tests/messages.test.ts`. Not yet used by any component.
- **Found in the translations, already live on /fr and /pt** (listed in
  launch-development-test `docs/rbm-messages-notes.md` for a bilingual
  reviewer): French "Stage" as "Scène" (theatre) and "Lead" as "Plomb" (the
  metal), Portuguese "Close" as "Perto" ("near"), several garbled French
  sentences, and Brazilian forms in what the pages declare as European
  Portuguese. Carried over unchanged.
- **Next:** the components (step 3: pathway, board, frame, in progress on their
  own branches) and the map (branch `feat/react-port-map`, in progress); then
  one Dashboard component wiring them together, with the text from
  `messagesFor()` replacing the temporary `text.ts` tables and `lib/strings.ts`.
- **Questions for RBM, added:** which library is behind `i18n.ts` (placeholder
  form `{name}` or `{{name}}`); and, if their own Next.js is on 16.x, that it
  is 16.4.1 or later (decision 2).
