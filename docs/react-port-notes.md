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
      Once the widget was fenced too, the two tied, so those five rules moved
      to `styles/feedback.css` (decision 18); this file has 723 rules now.
    - `@keyframes disc-flash` became `ld-disc-flash`.
    - Nothing dropped. The site menu's styles live in `assets/site-nav.js`, the
      structured data has none, and the pre-v1.0 page
      (`illustrated-journey-dashboard.html`) is a separate file. Rules that only
      apply with `SHOW_BARRIERS` or `SHOW_PROGRESS` on (`.c-bar`, `.flagnote`,
      `.gp-why`, `.det-flag`, the seven-column grids) are part of the v1.0 page
      and stay.
    - `tests/styles.test.ts` checks the fence, the keyframes, and that its own
      checks can fail.

16. **The page frame renders the `.launch-dashboard` root, not the layout**
    (`components/frame/DashboardFrame.tsx`, branch `feat/react-port-frame`).
    The root carries `sub-open` while Subscribe is open (the page put it on
    `<html>`; the CSS uses it to move the feedback pill aside on phones), so it
    has state, and a layout cannot take state from a page. RBM also takes the
    components, not this layout, so the root has to come with them. Inside it,
    in the page's order: `.wrap` (header, `#banner`, `children`, footer), then
    `outside`, then the feedback dialog and pill. The other areas go in
    `children`; what sat directly under `<body>` (`#tip`, `.stat-tip`, the
    pathway's Tip/StatTip) goes in `outside`. The example layout now renders
    only `<html>`/`<body>`; `error.tsx` and the "being updated" notice wrap
    themselves in a root, so they look as before. Rejected: the layout keeps
    the root and Subscribe adds the class to `closest(".launch-dashboard")`
    by hand (state outside React, and RBM would still need someone to render
    the root); two nested roots (every root rule applied twice).
17. **Everything the frame shows from the data is worked out on the server**
    (`frameView()`, `components/frame/view.ts`); the client components get
    finished strings and lists. Dates and sorting depend on the ICU data of
    whoever runs them, and the server and browser must draw the same markup
    or hydration fails. It also keeps the raw medicines out of the browser
    just for the CSV: the view is 27 KB in English (31 KB fr, 30 KB pt)
    against 31 KB for the products alone and 77 KB for the localised
    dataset; the CSV text is 11.3 KB, 56 rows. Rejected: computing the CSV on
    click from the products (sends the products for one button).
18. **The feedback widget's stylesheet is `styles/feedback.css`, fenced like
    launch-dashboard.css, and the skin's five rules for the widget moved
    into it, after the widget's own.** On the page the skin beat the widget
    on specificity: `html .ri-dialog` (0,1,1) against `.ri-dialog` (0,1,0),
    the widget's sheet loading later. Fenced alike, both read
    `.launch-dashboard .ri-dialog` (0,2,0): a tie, which goes to whichever
    file loads last, and `next build` emits the two as separate CSS chunks
    (67 and 812 selectors) in an order nothing here controls. In one file the
    skin wins by order. Checked in headless Chrome: the dialog's radius is
    8px and its head `rgb(240, 242, 245)`, the skin's values. No other rule
    of launch-dashboard.css ties with the widget: its one `.ri-` rule
    (`.sub-open .ri-pill`) sets only `visibility`, and its element rules
    reaching the dialog (`button`, `input`, `select`, `textarea`, `*`) are
    (0,1,1) or lower against (0,2,0); `tests/styles.test.ts` checks both,
    and that part 1 is the widget's CSS rule for rule (51 rules, `@media`
    included). `ri-spin` is `ld-ri-spin`. Rejected: `:where(.launch-dashboard)`
    (keeps the widget at its old (0,1,0), so the cascade against our CSS is
    exact, but RBM's global `button:hover` (0,1,1) would then beat the
    widget's buttons, while the rest of the dashboard sits at (0,2,0) and
    up); relying on import order; adding element types to the skin's
    selectors (`dialog.ri-dialog`).
19. **One setting for both forms, and no default.** `formsEndpoints()` builds
    `/api/subscribe` and `/api/feedback` from `NEXT_PUBLIC_LAUNCH_FORMS_URL`,
    read by the server page and passed down as a prop. Empty or missing: the
    Subscribe button and panel are not rendered (the static build kept them,
    hidden by CSS, with `--api-url none`), and Send feedback is not connected:
    Send is inert (`aria-disabled`, click blocked) and the note is the red
    "Mock only" line, as on those pages. Rejected: the static build's default
    origin, which would make every development checkout post to the test
    server; refusing a value that is not a bare origin, as the build did (a
    bad setting there stopped a build; here it would stop the page).
20. **Subscribe sends `page` too.** The brief listed four fields; the page
    sent `{ firstName, lastName, email, organisation, page: location.href }`,
    in that order, and `api/subscribe.js` documents `page` in its header but
    never reads it. Kept, so the request is byte-identical to today's (the
    golden test compares the body strings). Dropping it is one line in
    `sendSubscribe`.
21. **Logic as functions, components split into behaviour and view, no
    jsdom.** `lib/frame.ts` has the checks and the two sends
    (`checkSubscribe`/`sendSubscribe`, `prepareFeedback`/`sendFeedback`,
    fetch passed in). `SubscribePanel` and `FeedbackDialog` draw any state
    from props; `Subscribe` and `FeedbackForm` hold the state, focus and
    listeners. Tests run the functions with a stubbed fetch and render the
    views with the state they produce. The behaviour that needs a browser
    (focus, Escape, outside press, the modal, deep links) was checked once in
    headless Chrome over raw CDP, 18 checks, all passing; that script is not
    committed.
22. **The feedback widget keeps its openers but not its global.** Kept, with
    one `click` listener on `document`: the pill, any `[data-report-issue]`,
    any link to `#report-issue` (a `data-product="<id>"` on it preselects
    that medicine), and `#report-issue` in the address on load. Dropped:
    `window.LAUNCH_REPORT_ISSUE` (open/close from the console) and the
    capture of reports in the browser on pages that are not connected,
    reachable only from that global. The pill opens on General, as today;
    preselecting the medicine that is open would be new behaviour, so there
    is no prop for it.
23. **Listeners go on `document` and `window`, nothing on `<html>` or
    `<body>`.** Subscribe's pointer-press and Escape listeners are on
    `document` only while it is open (a press anywhere on RBM's page must
    still close it); the hash, print and widget listeners as on the page.
    The CSV link is put beside the button for the click, not in `<body>`.
24. **What `lib/frame.ts` ports, and the one quirk not kept.** Old names
    where there were any: `lastUpdatedText` (the header line), `statusBanner`
    (`BANNERS`), `tracked`, `csvCell`, `csvRows`/`csvText`/`csvFileName`,
    `sourceLists` (`renderSources`), `countryCheckText` (`renderDisclaimer`),
    `glossaryEntries`, and the forms' logic from `subscribeEmail`, the submit
    handlers and the widget's `validate`. Not kept: the banner looked the
    data status up on a plain object, so a status named `"constructor"`
    wrote `function Object() { [native code] }` into it; `statusBanner`
    compares the name (the golden test pins both behaviours). Kept as they
    were: `csvRows` throws for a medicine with no milestones list (the page's
    click did nothing); `sourceLists` throws when two sources with neither
    label nor title are compared; `csvCell` does not quote a lone CR; the
    CSV's object URL is not revoked; a bad `lastUpdated` reads "Invalid
    Date"; the feedback reference stays after "Send more feedback".
25. **The frame's golden and markup tests run the page's own code.**
    `tests/golden-frame/extract.mjs` copies, verbatim from
    `git show 7c1bf11:…`, the main script's frame statements and the
    loader's messages (`{lang}.page.js`), the served `<header>`, `#banner`
    and `<footer>` (`{lang}.markup.html`), and the page's
    `LAUNCH_FEEDBACK_COPY` script plus the widget (`{lang}.feedback.js`);
    `--check` confirms them. `tests/golden-frame/harness.ts` runs each in
    `node:vm` with only the DOM members it touches stubbed. The golden test
    makes 1,856 comparisons, all equal (en 618, fr 619, pt 619): every
    string in the data through `csvCell`, the CSV for 5 product variants ×
    4 switch settings, the Sources list with edge cases, and 49 Subscribe
    and 45 Send feedback submits per language with seven server replies,
    whose request bodies are compared as strings. Seven planted bugs, seven
    caught. The markup test compares the rendered components with the
    page's markup as its script filled it, after normalising (attribute
    order and case, entity forms, whitespace where layout ignores it, and
    React's own `<link rel="preload">` for the logo, which goes in `<head>`);
    a fixed Portuguese word, a dropped space and a lost French no-break
    space are each caught.

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
  they lose their styles. Done by the frame: `sub-open` and the feedback pill
  and dialog (decisions 16, 22). Left to their areas: the map's colour reads,
  and `#tip` and `.stat-tip`, which go in DashboardFrame's `outside`. The `prefers-color-scheme` listener and the
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
  unscoped; scope it too if the widget is ported. Done: `styles/feedback.css`
  (decision 18).
- `styles/launch-dashboard.css` is a copy of `89b2011`. CSS changes to
  `index.html` after that are ported by hand.

- **Page frame: wiring for whoever joins the areas** (`feat/react-port-frame`).
  `DashboardFrame` takes `text` (`FRAME_TEXT[locale]`), `view`
  (`frameView(dataset, locale, text)`), `formsUrl`, `logoSrc`, `children`
  and `outside`. Nothing else is needed from other areas, and the frame
  calls back into none. `tracked()` is now in `lib/frame.ts`; the board and
  map should import it rather than port it again. `Banner` also takes
  `"fail"` and `"schema"` (the loader's messages, translated), ready for
  `error.tsx` and the page's schema branch, which still say it in English.
  The sources list has its own renderer (`SourceEntry` in `Footer.tsx`): it
  draws a source's name, not a citation (no `class="cite"`, no " · "), so
  the pathway's `Cites` does not replace it.
- **The forms server refuses this app until RBM's host is a partner.**
  `api/_mail.js` PARTNERS lists only `https://codebyjackson.github.io`. A
  post from any other origin (RBM's staging host, `localhost:3000`) gets a
  403 with no CORS headers, and the reader sees "could not add you" or the
  feedback failure alert. Add RBM's origin there before testing on staging.
- **Old text that looks wrong, kept as it is** (all in `components/frame/text.ts`):
  - Portuguese "Close" is "Perto" ("near"), on the × button and the done screen.
  - French CSV headings: Record is "Enregistrer" ("to save"), Stage is
    "Scène" (a theatre stage), As of is "À partir de" ("from"). Portuguese:
    As of is "Até" ("until"), Status "Estatuto".
  - Portuguese mixes Brazilian forms into pt-PT: "Baixar CSV", "planejado"
    (pt-PT "planeado"), "Enviando…"; the Subscribe placeholder is English
    ("you@organization.org").
  - The page's `LAUNCH_FEEDBACK_COPY` comment says the RBM build turns
    `connected` off; it does so only with `--api-url none`.
  - The widget wrote its done message as HTML, unescaped; it holds no
    markup today, and React draws it as text.
- **Not ported, by nobody yet:** the schema.org structured data the page
  appended to `<head>` (a `Dataset` and one `Drug` per medicine). Pure and
  small, but not in the frame's brief.
- **Not ported, unreachable:** the main script's own "could not be loaded,
  please reload" banner and the Sources list's "could not be loaded" line.
  Both ran only without data, and `localize()` throws before a page renders
  without it.
- **The logo is a prop.** `logoSrc` is where the host serves
  `assets/unitaid-logo.svg`; the example app has a copy in
  `public/assets/`. The WHO emblem and the journey icons need the same
  decision in their areas.
- **Fixed-position pill and dialog** (`position: fixed`, z-index 900 and
  1000): an ancestor in RBM's page with a `transform` or `filter` would pin
  them to it, and RBM's own header may sit above or below them. Check on
  staging. The pill's 560px and the panel's 760px breakpoints measure RBM's
  window, as noted for the rest of the CSS.
- `NEXT_PUBLIC_LAUNCH_FORMS_URL` is read when a page is built: the
  pre-rendered pages keep the value set at `next build`.

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
- **27 Oct 2026, page frame** (branch `feat/react-port-frame`, not committed):
  `components/frame/` (DashboardFrame, Header, CsvButton, Subscribe, Banner,
  Footer, FeedbackForm, icons, text, view), `lib/frame.ts`,
  `styles/feedback.css` (and the skin's five widget rules moved out of
  `styles/launch-dashboard.css`), the missing `Source` fields in
  `lib/dataset.ts` (`group`, `plain`, `alsoSee`, `dataUrl`), the example app
  (layout without the root, page wrapped in the frame, `error.tsx` and the
  schema notice in their own root, `public/assets/unitaid-logo.svg`), and
  tests: `tests/golden-frame.test.ts` (31), `tests/markup-frame.test.ts`
  (27), `tests/forms-frame.test.ts` (13), `tests/styles.test.ts` extended
  (14), `tests/golden-frame/` (extractor, harness, reference). 123 tests
  pass; `tsc --noEmit` clean; `next build` passes with `/en`, `/fr`, `/pt`;
  the built CSS has no selector outside the root; no NUL bytes. Smoke-tested
  in headless Chrome against `next start`: 18 checks pass, no hydration
  warnings.
- **Next:** step 2, the message files (branch `feat/rbm-messages` in
  launch-development-test, in progress), replacing `lib/strings.ts`; the map
  (branch `feat/react-port-map`, in progress); then the components (step 3).
