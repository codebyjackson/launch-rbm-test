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
   minutes** (`lib/data.ts`; one file per language since 28 Oct, decision 54;
   every 5 minutes since 29 Oct, decision 58). This is the API RBM asked for (27 Oct): a data
   change reaches the page with nobody involved, and visitors' browsers never
   contact the data host. Rejected: reading a copy beside the pages
   (`data/dashboard.json`, launch-development-test PR #127, from the Hosting Guide
   of 26 Oct). Every data change would need someone to send RBM a file; the two
   teams have since agreed that was a misunderstanding.
5. **`getDashboard()` throws; it never returns a failure.** When a background
   refresh throws, Next.js keeps serving the last page it built. Returning a
   failure instead would replace a good page with an error for 10 minutes (5
   since decision 58) each time the data host blinks. The one exception is an unknown `schema_version`:
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
      to `styles/feedback.css` (decision 27); this file has 723 rules now.
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
17. **The pathway area is more than the strip** (branch
    `feat/react-port-pathway`, `components/pathway/`). On the page,
    `gatePanelHTML` draws a *medicine's* stage panel (`#<id>-gate`, inside the
    board's row, opened from a stage marker), not `#gatewrap`, and
    `countryAccessKv` draws rows of the board's Country access card. Both came
    to this area as assigned, as components the board places: `GatePanel`
    (container and content) and `CountryAccessKv`. `#gatewrap` itself was
    written inline by `openGatePanel`; it is `StepPanel`. `Pathway` renders
    `#pathway` and `#gatewrap` as the page had them, two siblings with no
    wrapper, and keeps the open step itself unless the dashboard holds it
    (`openStep` with `onOpenStep`), which it must, because the board lights the
    step's column (`highlightStep`, now `colIndexOf(openStep, ctx)`).
18. **Hints are components with an imperative handle, not state in the
    dashboard.** `#tip` serves the board (stage peeks, glossary terms) and the
    map (every mouse move over a country); `.stat-tip` serves the board's
    `.info` buttons. `useTipControls()` and `useStatTipControls()` give a ref
    for `<Tip>` / `<StatTip>` and stable controls to hand to the areas, so a
    hint re-renders only itself. Rejected: hint state in the dashboard (the
    map would re-render the whole page on every mouse move); a portal to the
    nearest `.launch-dashboard` (needs the DOM before it can render, and
    nothing is gained when the dashboard can simply render both inside its
    root, after `.wrap`, where the page had `#tip`). `statTipHandlers()` is
    the page's delegated listeners on `#board`, as props for the board's
    element; the document click and window scroll that hide `.stat-tip` stay.
19. **Escape's order between the two panels travels as a prop.** The page had
    one handler: a medicine's panel closed first, else the step panel, and
    focus went back to the button that opened it. Now each owner closes its
    own, and the board passes `cellPanelOpen` so `Pathway` stands aside while
    a medicine's panel is open. Rejected: relying on listener order or
    `preventDefault()` between two areas' document listeners.
20. **The strip re-measures when its own width changes** (`ResizeObserver`),
    and once web fonts land. The page re-ran `fitPathway` and
    `alignPathGroup` on window resize and whenever a row opened. Inside RBM's
    page the strip can change width with no window event (a sidebar), and
    watching the strip covers both old triggers. Window `resize` is the
    fallback where there is no `ResizeObserver`. The page also did not
    re-measure when a step opened (its label turns bold and may rewrap); kept.
21. **Stage icons: the sprite and `<use>`, as the page drew them.** The glyph
    set (`assets/journey-icons/icons-solid.js`) is ported into
    `components/pathway/icons.tsx`; `<JourneyIconSprite>` replaces the
    sprite the page injected at the start of `<body>`, and the dashboard renders
    it once. The WHO emblem stays an `<img>` (it must keep its colours); its
    address is `WHO_EMBLEM_SRC` (`/launch-icons/who-emblem.svg`, served by the
    example app from `public/launch-icons/`) or the `whoEmblemSrc` prop.
    Rejected: an inline SVG per icon (different markup, every glyph repeated
    on every row); importing the SVG file (`tsc` then needs `next-env.d.ts`,
    which only exists after a build, and Vitest returns a different shape).
22. **Pathway text is a temporary typed table, `components/pathway/text.ts`**
    (`pathwayText`), like `lib/strings.ts` and replaced with it in step 2. The
    status words, the phase names and "N years" come from `lib/strings.ts`,
    not a second copy. Where a value is markup ("{years} expected" with the
    years bold, "Source: {cites}"), `fillNodes()` fills the template.
23. **`lib/pathway.ts` holds the area's pure rules**, old names kept:
    `tracked`, `colIndexOf`, `stepNo`, `lateAt`, `stalledSince` (whose
    `nowYear` is `ctx.asOfYear`), and the counts the page worked out inside
    its markup (`statusCounts`, `levelCounts`, `countryList`,
    `countryAccessCounts`, `phaseColumns`, `parallelPair`). Not ported:
    `sameColumn`, which nothing on the page calls; `preBoundaryDone`, which
    draws the board's rail. Two switches that are not in `DISPLAY` live here
    for now, as `PATHWAY_DISPLAY`: `showStageExpected` (`SHOW_STAGE_EXPECTED`)
    and `showBarriers` (`SHOW_BARRIERS`, which the board reads too). They
    belong in `DISPLAY` in `lib/stages.ts`; moved when the areas merge.
24. **Two tests, both against the page's own code.**
    `tests/golden-pathway/extract.mjs` freezes 47 declarations and two
    statements (the `SHOW_LATE` rewrite, the one that fills `#pathway`) from
    each of `git show 7c1bf11:{en,fr,pt}/index.html`, the three elements'
    static markup, and `icons-solid.js` (`--check` confirms them).
    `tests/golden-pathway.test.ts` compares the pure rules over 7 scenarios
    (switches off, all on, late kept with words hidden, "today" in 2020 and
    2033, no `stageColumns`/`yardstick`/`stageInfo`): 36,438 comparisons,
    all equal. `tests/markup-pathway.test.ts` renders every component with
    `renderToStaticMarkup` and compares it with the page's markup for every
    step and for every medicine variant at every stage (sprite, icons, strip
    closed and with each step open, step panel, stage panel and its
    container, stage peek, Country access rows with three source lists):
    97,056 comparisons, all equal after normalising attribute order, boolean
    attributes, entities and whitespace between blocks
    (`tests/golden-pathway/html.ts`). Where the page changed the DOM instead
    of a string (un-hiding, `aria-expanded`, `#gatewrap`'s label, the
    `.gatepanel` container), the test applies the same change to the page's
    string. Planted bugs: golden 7 of 8 caught (the miss, `stalledSince`'s
    `j.length < 2` as `< 1`, cannot change a result); markup 12 of 12.

25. **The page frame renders the `.launch-dashboard` root, not the layout**
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
26. **Everything the frame shows from the data is worked out on the server**
    (`frameView()`, `components/frame/view.ts`); the client components get
    finished strings and lists. Dates and sorting depend on the ICU data of
    whoever runs them, and the server and browser must draw the same markup
    or hydration fails. It also keeps the raw medicines out of the browser
    just for the CSV: the view is 27 KB in English (31 KB fr, 30 KB pt)
    against 31 KB for the products alone and 77 KB for the localised
    dataset; the CSV text is 11.3 KB, 56 rows. Rejected: computing the CSV on
    click from the products (sends the products for one button).
27. **The feedback widget's stylesheet is `styles/feedback.css`, fenced like
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
28. **One setting for both forms, and no default.** *(Replaced on 3 Nov by
    decision 61: the forms post to this site's relays, and the setting is
    gone.)* `formsEndpoints()` builds
    `/api/subscribe` and `/api/feedback` from `NEXT_PUBLIC_LAUNCH_FORMS_URL`,
    read by the server page and passed down as a prop. Empty or missing: the
    Subscribe button and panel are not rendered (the static build kept them,
    hidden by CSS, with `--api-url none`), and Send feedback is not connected:
    Send is inert (`aria-disabled`, click blocked) and the note is the red
    "Mock only" line, as on those pages. Rejected: the static build's default
    origin, which would make every development checkout post to the test
    server; refusing a value that is not a bare origin, as the build did (a
    bad setting there stopped a build; here it would stop the page).
29. **Subscribe sends `page` too.** The brief listed four fields; the page
    sent `{ firstName, lastName, email, organisation, page: location.href }`,
    in that order, and `api/subscribe.js` documents `page` in its header but
    never reads it. Kept, so the request is byte-identical to today's (the
    golden test compares the body strings). Dropping it is one line in
    `sendSubscribe`.
30. **Logic as functions, components split into behaviour and view, no
    jsdom.** `lib/frame.ts` has the checks and the two sends
    (`checkSubscribe`/`sendSubscribe`, `prepareFeedback`/`sendFeedback`,
    fetch passed in). `SubscribePanel` and `FeedbackDialog` draw any state
    from props; `Subscribe` and `FeedbackForm` hold the state, focus and
    listeners. Tests run the functions with a stubbed fetch and render the
    views with the state they produce. The behaviour that needs a browser
    (focus, Escape, outside press, the modal, deep links) was checked once in
    headless Chrome over raw CDP, 18 checks, all passing; that script is not
    committed.
31. **The feedback widget keeps its openers but not its global.** Kept, with
    one `click` listener on `document`: the pill, any `[data-report-issue]`,
    any link to `#report-issue` (a `data-product="<id>"` on it preselects
    that medicine), and `#report-issue` in the address on load. Dropped:
    `window.LAUNCH_REPORT_ISSUE` (open/close from the console) and the
    capture of reports in the browser on pages that are not connected,
    reachable only from that global. The pill opens on General, as today;
    preselecting the medicine that is open would be new behaviour, so there
    is no prop for it.
32. **Listeners go on `document` and `window`, nothing on `<html>` or
    `<body>`.** Subscribe's pointer-press and Escape listeners are on
    `document` only while it is open (a press anywhere on RBM's page must
    still close it); the hash, print and widget listeners as on the page.
    The CSV link is put beside the button for the click, not in `<body>`.
33. **What `lib/frame.ts` ports, and the one quirk not kept.** Old names
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
34. **The frame's golden and markup tests run the page's own code.**
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

35. **The medicine board (`components/board/`, branch `feat/react-port-board`)
    talks to the other areas only through props and callbacks.** `Board` takes
    the localized data, sources, locale and its text, and: `openProduct` (a
    medicine to open and scroll to, as `#pyramax` did) with `onOpenProduct`
    (the reader opened a row; an `openProduct` that echoes it is not a new
    request, so the page does not jump); `openStep` (the strip's open step,
    lit in the Journey column); `onStageHover`/`onStageLeave`,
    `onTermHover`/`onTermLeave` and `statTipHandlers` (spread on `#board`) for
    the hints the pathway area draws; `onCellChange` (the open stage panel, so
    Escape closes it before the strip's step panel, as the page's one Escape
    handler did). Rejected: reading `location.hash` (RBM's router decides how
    state is carried) and a shared store. Listeners go on `document` (Escape)
    and `window` (resize), never on `<html>` or `<body>`.
36. **The pathway area's parts come in as slots** (coordinator, 27 Oct):
    `renderStageIcon`, `renderCountryAccess`, `renderCites`, `renderGatePanel`.
    The board keeps the stage panel's container (`${id}-gate`, `hidden`, its
    `late` class), which panel is open, and Escape; the slot draws the
    content and gets a `close` callback. My own versions of the icons and
    sprite, the Country access rows, the citation links and the stage panel
    were written first and then removed. `trackedProducts` and `colIndexOf`
    stay in `lib/board.ts` because this branch cannot see `lib/pathway.ts`:
    the same rules, golden-tested against the same page code; on merge,
    delete them and import the pathway's.
37. **The glossary terms are marked in the element tree before render, not
    in the DOM after it.** The page walked each row's text nodes once the rows
    existed and wrapped the first occurrence of each term (on the live data
    of 27 Oct, 25 terms marked in `/en`, 22 in `/fr`, 24 in `/pt`, counted in
    this app's `next build` output). Changing text React has
    rendered breaks its next update, so `gloss.tsx` walks the row's elements
    instead, in the same document order, with the page's rules (skip `.exp`,
    `.swg`, `.more`, `.smark`; and `.gatepanel`, which was empty when the page
    walked). That needs the row's text in the tree, so the markup builders are
    hook-free functions the row calls, not components it mounts; the stateful
    parts are `Board` and `ProductRow`. Rejected: a post-render DOM walk (stale
    or failing updates on a data refresh) and a shared "seen" set read during
    render (a render that runs twice, as in Strict Mode, marks nothing the
    second time). Cost: text inside a slot is marked only if the slot returns
    plain elements, so the Dashboard should call the pathway's hook-free
    components as functions in the slots (`renderCountryAccess={(d) =>
    CountryAccessKv({ ... })}`); mounted as `<CountryAccessKv/>`, "MFT" in
    "In MFT plans" and terms in source names are not marked.
38. **Measuring stays measuring; the arithmetic is pure.** `fitTimeline`
    became `useTimelineFit` (a ResizeObserver, refitting on a new width, and
    once the fonts arrive) returning tier tops that React renders, with the
    arithmetic in `fitTiers`. Rejected: writing `style.top` directly as the
    page did, which a re-render after a data refresh would leave fitted to the
    old layout. The forks (`useStageForks`) write `--sg-lift` to the track
    directly, because it must be 0 while measuring and a state round would
    paint that first; React never sets the track's style. The strokes come
    back as state (`forkGeometry`). The page measured hidden tracks too, to 0;
    here only a shown track is laid out, with the same visible result.
39. **The board's words are a temporary table, `components/board/text.ts`**,
    as `lib/strings.ts` is for `lib/stages.ts`: en/fr/pt values pulled out of
    the built pages by script, not retyped, with `{name}` templates. Words the
    board shares with `lib/stages.ts` (status words, phases, "3 years") stay
    in `lib/strings.ts`. Mistranslations are copied as they are (below).
40. **Tests.** `tests/golden-board.test.ts`: `lib/board.ts` against the page's
    code frozen by `tests/golden-board/extract.mjs` (`--check` confirms it is
    current), including the timeline's layout read back out of the old
    markup, and `fitTimeline`, `alignStageForks` and `drawStageForks` run on
    fake boxes with made-up sizes: 20,931 comparisons, 6 scenarios per
    language, 0 clock reads. `tests/markup-board.test.ts`: `<Board>` through
    `renderToStaticMarkup` against the board the page's own statements built
    and glossed (on a small DOM in `tests/golden-board/html.ts`, no new
    dependency), in a normal form (attributes sorted, white space folded,
    white-space-only text dropped, entities decoded, boolean attributes as
    `name=""`): 1,776 comparisons, 1,656 whole rows, all equal, with the
    pathway's slots stubbed in today's markup (`tests/markup-board/slots.tsx`).
    Twelve planted bugs: 10 caught; the 2 missed cannot change any result
    (removing `.more` from the walk's skip list: no term is in that text in
    any language; a tick rule `>= 1.5` against `> 1.5` on whole years).
    Three variants with chosen stage years were added after the first round
    missed a change to the 21% tier gap.
41. **Types added to `lib/dataset.ts`, nothing changed:** `CountrySummary`,
    `CountryEntry`, `CountryList`, `ProcurementChannel`,
    `ProcurementPresentation`, `Procurement`, `Research`, `Price`; the detail
    fields they type (`useCase`, `access`, `adoption`, `research`, `country`,
    `countries`, `volume`, `volumeNote`, `price`); `Product.barrier`,
    `acknowledgement`, `note`; `Source.category`.
42. **One client component, `components/Dashboard.tsx`, takes only what a
    server component can pass** (branch `feat/react-port-dashboard`): the
    locale, `data` and `sources` from `localize()`, `frameView` and `mapInput`
    worked out on the server, `formsUrl` (`formsEnabled` since decision 61), and `assets` (logo, WHO emblem,
    map shapes, map worker), plus `initialProduct`/`onProductChange`
    (decision 47). It works out its words from the locale itself. Rejected:
    the server passing the five text objects as props. `lib/stages.ts` reads
    `pageText(locale)` in the browser for every peek line and access figure
    (the board and `StagePeek` run there), so all three languages' words
    reach the browser anyway; text props would send them twice. Cost,
    measured in `next build`: the three message files sit in one client
    chunk of 64.7 KB (20.4 KB gzipped; the files alone gzip to 6.0, 7.2 and
    6.9 KB). Before, only `PAGE_TEXT` (13 words a language) went to the
    browser. Asset addresses are props, never constants in the Dashboard:
    `feat/react-port` has since moved to MapLibre 6.14, whose worker is
    `/launch-map/maplibre-gl-worker.mjs`; only the example page's `ASSETS`
    changes at merge.
43. **Each area's text is built from the message files by an adapter next to
    its type, and whatever the files cannot supply as today's pages word it is
    held in one listed place.** `pageText()` (`lib/strings.ts`),
    `pathwayText()`, `boardText()`, `frameText()`, `mapText()` read
    `uiText(locale)` (`lib/ui-text.ts`): the message files, plus
    `lib/held-text.ts`. An adapter may only rename a placeholder (`rename`) or
    cut a message where a component puts its own value in it (`around`: the
    disclaimer's medicine list, the planned medicine's name, "{shown} of
    {total}"); both throw when the slot is missing, so a reworded message
    fails the tests instead of showing half a sentence. Rejected: reshaping
    the text types to the message files (every component and every area
    test's input would change); picking either value silently where they
    differ. `tests/text-parity.test.ts` proves all five equal today's tables
    (frozen in `tests/fixtures/text/`, which the area tests still use):
    327 values per language. Result: English and Portuguese, no difference.
    French, 36 differences, every one the apostrophe: today's page has ’
    (U+2019), the message file ' (U+0027); the page itself mixes them (61 ’
    and 279 ' in `fr/index.html`; `fr.json` has 8 and 84). Today's wording is
    kept (`KEPT_FROM_PAGES`, 35 keys; `KEPT_IN_ONE_PLACE`, the map filter
    table's heading, because the French page writes `map.accessStage` two
    ways: "Étape d'accès" over the legend, "Étape d’accès" over the filters).
    37 texts have no key at all (`NOT_IN_MESSAGES`, under the key they
    should get in `i18n/ui.en.json`), almost all for parts switched off on
    10 Nov: `common.status.delayed`; `pathway.stageButtonExpected`,
    `.stageButtonDelayed`, `.expectedTag`; `stepPanel.statusCounts.*` (4);
    `board.columns.mainBarrier`, `board.delayedDefinition`,
    `board.delayedHint`, `board.noBarrier`; `product.viewTimeTaken`,
    `product.dotTitle`, `product.timeline.delayed`; `yardstick.*` (22).
    The test fails when a held key appears in the message files or a kept
    text stops differing, so each entry is deleted, not left to hide a later
    change. Three message keys are read by nothing: `errors.dataFailedReload`
    and `errors.sourcesFailed` (the unreachable messages, noted below) and
    `product.accessLine` (`accessLine()` joins with a fixed ": ", the same
    text in all three files). **Since 28 Oct nothing is held: decision 53.**
44. **The map's French and Portuguese reference includes the pages' static
    markup.** `tests/golden-map/translate.ts` builds them from the pages'
    script strings only, so the 21 fields in `#mapsec`'s HTML (heading,
    rail titles, labels, legend head and rows, the resistance note) came back
    in English, while the pages show them translated: the first parity run
    reported 16 Portuguese and 17 French "differences" that were the
    reference's. `tests/fixtures/text/map-markup.ts` freezes those fields
    with a reader; the parity test checks it against `{en,fr,pt}/index.html`
    while they are in the checkout (all three equal) and skips that check
    after.
45. **One `#tip`: the map shows its hints in the pathway area's `Tip`.**
    `MapSection` takes `tip` (the controls from `useTipControls()`), placing
    at the pointer (`showAtPoint`) or above a focused list button
    (`showAt`). `MapTooltip`, the map's own `#tip`, is gone; `MapTipBody` and
    `ListTipBody`, what the hint says, stay. Rejected: an optional `tip` with
    the old tooltip as fallback (two hint elements to keep alike, and a page
    could again render two `#tip`).
46. **The board's slots are `boardSlots()` (`components/boardSlots.tsx`):
    `StageIcon`, `CountryAccessKv` and `Cites` called as functions,
    `GatePanelContent` mounted** (it sits in `.gatepanel`, which the glossary
    walk skips). A plain function so `tests/markup-dashboard.test.ts` can
    render the board with exactly these slots and compare it, in every
    language, 6 scenarios and every medicine variant, with the board using
    today's markup stubs (which `markup-board` proves against the page):
    equal. Planted bugs: mounting `Cites` fails 6 cases; mounting
    `CountryAccessKv` failed none, because on today's data every term in the
    Country access rows has already appeared earlier in its row, so a
    targeted case was added (a glossary whose one term is "Countries on the
    map"), which fails in all three languages.
47. **Deep links: the host's router decides.** `initialProduct` is the
    board's `openProduct` (a medicine to open and scroll to, on load and on
    every change), `onProductChange` its `onOpenProduct`; a router that
    writes the id into the address should pass it back, which the board takes
    as the echo (no jump). The example app (`app/[locale]/ExampleDashboard.tsx`)
    reads `?product=` after hydration and on back/forward, and writes it with
    `history.replaceState` when a row opens. Rejected: reading `searchParams`
    in the server page (every request renders anew: `/en`, `/fr`, `/pt` would
    no longer be pre-built); `useSearchParams()` (in a pre-built page it needs
    a Suspense boundary, and the whole dashboard would then render in the
    browser only). Consequence: the page arrives with every row closed and
    then opens and scrolls, as today's did for `#pyramax` after its script.
48. **One `tracked()` and one `colIndexOf()`: `lib/pathway.ts`'s.** The
    copies in `lib/frame.ts` and `lib/board.ts` are deleted, and so is
    `lib/map.ts`'s `trackedProducts` (the same rule, not on the list but a
    fourth copy). `tracked` is now typed for any read-only list of things
    with a name, which the frame (read-only products) and the map (its own
    product type) need; the body is unchanged. The golden and markup tests
    call it in place of the copies (golden-board, golden-frame, markup-board);
    nothing else in them changed, and all pass.
49. **An `.info` hint answers only to the board's own buttons.**
    `statTipHandlers` takes the `.info` the event is on only if it is inside
    the element the handlers are spread on (`#board`), and the document click
    that hides the hint ignores only an `.info` inside `.launch-dashboard
    #board`. The page's `closest(".info")` alone would also catch an `.info`
    in RBM's page around the dashboard.
50. **The "being updated" notice and the error page are the frame's `Banner`,
    in the page's language** (`kind="schema"` and `"fail"`, from
    `frameText(locale).banner`), in their own root inside `.wrap`. The
    wrapper keeps the example's `role="status"` and `role="alert"`, which
    today's `#banner` does not have. `error.tsx` takes the locale from
    `useParams()`, English when it is not one of the three.
51. **The browser check is `scripts/smoke.mjs`: raw DevTools Protocol over
    Node's `WebSocket`, no dependency.** It launches Chrome with SwiftShader
    (no `--disable-gpu`) against `next start -p 3124` and records every check
    as pass or fail. Found while writing it, and worth knowing for any later
    headless test: once an Escape key is sent over the protocol, headless
    Chrome stops running `requestAnimationFrame` in that tab (119 frames in
    2 s before, 0 after, on a plain `data:` page too), so MapLibre's camera
    moves only when a screenshot forces a frame; the map checks run in a tab
    of their own. Whether the camera moved is read from the map's zoom
    readout (`#mz-lvl`): pixels do not show it, as land and sea are both
    near white (10.7% of pixels change when Africa fills the frame). Not
    counted as page errors, and printed: `/favicon.ico` 404 (the example app
    has no icon) and Chrome's "GL Driver Message … GPU stall due to
    ReadPixels" under SwiftShader (4 per run, about the page's WebGL canvas;
    whether MapLibre or Chrome's compositor reads the pixels is not
    established).
52. **The example app's `<body>` has `margin: 0`** (`app/[locale]/layout.tsx`,
    an inline style). Today's page sets it in `body { margin: 0; … }`;
    fenced, that rule lands on `.launch-dashboard` (as `:root` and `body`
    both do), so the example's own `<body>` kept Chrome's 8px default. The
    dashboard came out 16px narrower than today's page at every width: lines
    wrapped earlier in the map section and the footer, and the page grew by
    31px on `/en` at 1440px, 139px at 390px, 176px on `/fr` at 390px (found
    by the side-by-side check, below). Rejected: a `body` rule in
    `styles/launch-dashboard.css` (the file has no selector outside the
    root, `tests/styles.test.ts` keeps it so, and RBM's `<body>` is RBM's);
    leaving it (every comparison with today's page would show it, and the
    example is what RBM looks at). Nothing changes for RBM: their layout
    decides their `<body>`, and the dashboard fills the width it is given.
53. **`lib/held-text.ts` is gone: the message files supply every text, and
    the two changes the owner chose are applied to today's text in the
    parity test, not held in the app** (28 Oct). launch-development-test
    `ae16ee6` gave the 37 held texts keys, under the paths the port read
    (its decision 10), and writes French with ’ throughout (its decision 9,
    the owner's choice over copying the page's mix or straight '
    throughout). Copied in by `copy-rbm-messages.js` (`messages/manifest.json`:
    built from `ae16ee6`, clean, 7 still English per language until PR #129
    there was merged; since the same day built from `65b969e`, none English,
    the 7 in `CHANGED` too). `uiText()` now returns the message file as it is;
    `mapText().filterStage` reads `map.accessStage`, like the legend. Before
    deleting, the built values were checked against every held text: 144 of
    147 equal. `tests/text-parity.test.ts` compares each adapter with
    today's table passed through `asShipped()`: French `'` → `’` (16 of the
    327 compared French values; the 17th changed key, `errors.sourcesFailed`,
    is read by nothing, decision 43), and `CHANGED`, one entry per language:
    `pathwayText.nodeDelayed`, which today's French and Portuguese pages
    leave as ", {n} delayed" and the files now translate (", {n} retardé",
    ", {n} atrasado"; singular, and not rendered while `showLate` is off). A
    check fails when a `CHANGED` entry no longer matches today's text or the
    shipped one (both seen failing when an entry was broken on purpose).
    Rejected: keeping `held-text.ts` as a list of overrides (the app would
    show text the files RBM receives do not hold, and a wording would live in
    two places); rewriting the frozen tables to the new text (the area tests
    prove those tables against today's pages, and that proof would go).
    Tests: 271 (274, less the six held-text checks, plus one `CHANGED` check
    per language). Visible effect, measured in the browser against today's
    pages with the side-by-side scripts: English and Portuguese identical
    line for line; French 12 visible lines differ, every one only by `'` →
    `’`; heights unchanged.
54. **The data is fetched one file per language, `dashboard.{locale}.json`**
    (28 Oct, the owner's choice: the same rule as the interface text, one file
    per language, picked by the page's language). launch-development-test
    `feat/data-per-language` publishes `v1/dashboard.en/fr/pt.json` beside
    `dashboard.json`, made from it by `forLocale()`, which follows
    `localize()`'s rule on purpose. `lib/data.ts` fetches
    `dataUrl(locale)`; `lib/dataset.ts` `readLanguageFile()` only reshapes
    (checks `schema_version` and that `locale` is the page's), and
    `datasetFrom()` reads either file, so `LAUNCH_DATA_URL` can still point
    at a combined file (the side-by-side check's local server). Proof:
    `tests/fixtures/dashboard.{en,fr,pt}.json`, made from
    `fixtures/dashboard.json` by the pipeline's own `forLocale()` (its
    `4036b90`), read by `readLanguageFile()`, deep-equal `localize()` of the
    combined file in all three languages, so every golden test, which feeds
    `localize()`, holds for the files the page now reads. Each file is about
    half the combined one (fr 128 KB of 257 KB, pretty-printed). Rejected:
    keeping one file and picking the language here (decision 4 as it was;
    works, but a different shape from the interface text); a fallback to the
    combined file when a language file is missing (it would hide a publish
    that went wrong). **Order:** the language files must be published
    (launch-development-test merged, then "Publish now") before this branch
    runs anywhere, or the first load finds no file and shows the error page.
55. **RBM's page hands the dashboard its words; our files are the fallback,
    message by message** (28 Oct, the owner's choice). RBM loads the message
    files through its `i18n.ts` (next-intl), merged into its own. Every file
    now holds one key, `launchDashboard` (launch-development-test
    `feat/rbm-messages` `b4cbc83`, its decision 13; copied in, the text
    identical to the `65b969e` copy), so nothing collides with RBM's keys and
    its page passes `messages.launchDashboard` in one piece: `<Dashboard
    text>`, and `provideMessages(locale, text)` on the server before
    `frameText()`/`frameView()` (`lib/messages.ts`). Each handed-over message
    is used when it is a non-empty string with exactly our `{placeholders}`;
    otherwise ours stays (and keys we lack are ignored), so an outdated or
    hand-edited copy cannot blank or break a line. The five text adapters
    cache by the messages object (`WeakMap`), not by language, so new words
    rebuild them; the Dashboard's and the Board's `stageContext` memos depend
    on `messagesFor(locale)` too. A new object with the same words keeps the
    messages object, so a page that rebuilds `text` on every render costs a
    comparison, not a rebuild. The server keeps one copy per language for the
    process: RBM's files are the same for every request, so sharing it is
    safe. Rejected: next-intl inside our code (`useTranslations`): our
    Next.js 16 needs next-intl 4, RBM says 3.15.2, whose range stops at
    Next.js 14; passing the text through every adapter call (the stage rules
    in `lib/stages.ts` alone call `pageText()` in six places);
    taking RBM's copy whole (a stale file would show missing or broken
    messages). `tests/messages.test.ts`: 11 (4 before).
56. **The static pages left this branch; the tests read them from git**
    (28 Oct, the owner: "we don't need static pages anymore"). Removed:
    `en/`, `fr/`, `pt/`, `assets/`, `rbm-shell/`, `data/`, `index.html`,
    `iframe-test.html`, `build-manifest.json` (45 files); `main` keeps them,
    and stays the live test site until UNOPS switches. Everything that read
    them from the checkout now reads commit `7c1bf11` from git, as the other
    golden extracts already did: `tests/golden-map/extract.mjs`,
    `tests/text-parity.test.ts`'s map markup check (it skipped once the pages
    were gone; now it runs) and `scripts/build-map-assets.mjs` (still needed
    after a MapLibre upgrade, for the worker; it rebuilt both map assets
    unchanged). `tests/golden-map.test.ts` no longer skips when the pages are
    missing, and passes the extractor's path with `fileURLToPath`: `.pathname`
    gave node `/C:/…`, so on Windows the check failed before and after any
    change. Two byte checks now ignore CRLF (`golden-map/extract.mjs --check`,
    `map-assets.test.ts`'s worker), which a Windows checkout
    (`core.autocrlf=true`) writes and git does not store: on Windows the suite
    went from 286 of 288 to 288 of 288, with nothing else changed by it.
    `tsconfig.json` excludes `node_modules` only. `README.md` is new, for
    RBM's developers: requirements, what to copy, the font, a page with
    next-intl, the message hand-over, the data. Rejected: keeping the pages
    for the tests (the git reads need no copy, and the pages invited merges
    from `main` that broke the map check, below).
57. **RBM's structure, and Brazilian Portuguese** (28 Oct, from RBM's sample
    message files and the owner's choice). The message files now follow the
    sample: `Sidebar.unitaid` and `Sidebar.unitaid_tooltip`, then everything
    under `Unitaid` (was `launchDashboard`), with the page's `title` and
    `metadata` first (launch-development-test #133, its decision 14: made
    from the header's title and description, RBM's name and the keywords in
    English). `NAMESPACE` is `Unitaid`; the example app's layout uses
    `Unitaid.metadata` as the page's metadata and `PAGE_LANG` as `<html
    lang>`. next-intl 3.15.2 read all 319 keys in all three files exactly as
    written. Portuguese is Brazilian, as RBM's own: the words (the translate
    bot translated all 964 strings again, `11681f2`), the country names, and
    the locale for dates and numbers (`DATE_LOCALE`, `PAGE_LANG` and the
    map's `DATE_LOCALE`: `pt-BR`, so "19 de out. de 2026", "14.500.000,5").
    The comparisons with the old pages still test the logic: every test file
    starts with 28 Oct's European words handed over
    (`tests/setup/european-portuguese.ts`, `fixtures/messages/pt-PT.json`,
    the same keys), and the five harnesses give the old code the new code's
    language tag (`PAGE_LANG`) instead of its saved `pt-PT`, so both sides
    format alike. Rejected: rewriting the frozen references and text tables
    in Brazilian (the proof that the port matches the pages would then rest
    on the port's own output); keeping European dates and numbers with
    Brazilian words.
58. **The data route, `GET /api/unitaid/data?dataset=<name>`, and a
    5-minute cache** (29 Oct, RBM/UNOPS module spec 2a: "reads the external
    source, keeps a short server-side cache (default 5 minutes) and returns
    the data as JSON"; 200, 400 unknown name, 502 source unavailable).
    `app/api/unitaid/data/route.ts` is a thin wrapper over `getDashboard()`;
    the example page still calls `getDashboard()` itself. Rejected: the page
    fetching its own route (an extra network hop, and `next build` has no
    server running to answer it).
    - **Dataset names are the dashboard's languages**, `LOCALES`: `en`, `fr`,
      `pt`, exactly (`pt-BR`, `es`, `EN` and an empty name are 400). An
      assumption: the spec does not list names. Asked of RBM, below.
    - **The 200 body is what `getDashboard()` returns** (`Localized`), not
      the published file as it is. It is the shape the components take, so a
      page that reads the route hands it to `Dashboard` unchanged and gets
      what the golden tests prove; and the route must read the file anyway
      to answer 502 for a schema it does not know. Rejected: the published
      file as is (its format is the data repository's documented one, the
      one argument for it, but every reader would then have to run
      `datasetFrom()` itself, and the route would pass on a file it had not
      checked).
    - **502 for both `DatasetError` kinds**, body `{"error": "source
      unavailable", "kind": "unavailable" | "schema"}`: the kind lets a page
      say "being updated" for a schema, as ours does. The reason, with the
      source's address, goes to the server log only (`[LAUNCH] data route:
      …`): `LAUNCH_DATA_URL` may name a host the public should not see. Any
      other error is not caught (Next.js answers 500): a fault in this code
      is not the source's. Found while checking that: below.
    - **5 minutes:** `REVALIDATE` 300 (was 600) and the page's `revalidate`
      300, which Next.js reads from the source, so it is written out;
      `tests/data-route.test.ts` checks the two agree. The bundled Next.js
      16.4.3 docs (`01-getting-started/15-route-handlers.md`,
      `02-guides/caching-without-cache-components.md`, `04-functions/fetch.md`):
      a route handler's GET is not cached by default, but a `fetch` with
      `next.revalidate` is kept in the server's persistent data cache, keyed
      by address and options, so the route and the page share one copy.
      Measured on `next start` against a local host that counts requests
      (`LAUNCH_DATA_URL=http://127.0.0.1:3130/dashboard.{locale}.json`):
      `en` three times and `fr` twice cost 1 request each; the page's
      background regeneration, once its 300 s were up, took `en` from that
      copy (0 requests, and the local host's marker on the page); with the
      host answering 500, the cached `en` stayed 200 with 0 requests and the
      never-read `pt` was 502 each time (1 request each: a failure is not
      cached); past 300 s with the host still down, `en` stayed 200 with the
      old copy and each request tried the host once behind it (3 requests
      for 3 calls, none of them logged); host back, 1 request, then 0. A
      restart of the same build kept the cache (`.next/cache/fetch-cache`,
      on disk; `next build` writes one entry per language, revalidate 300):
      with the host down, `en` 200 with 0 requests, `fr` (stale) 200, `pt`
      502. A new server on the old address (404) or a closed port: 502 for
      all three, and the page still served from its build. So a 502 needs
      both a host that is down and a server that never held that file. The
      build's manifest gives `/en`, `/fr`, `/pt` 300 s, and the page answers
      `Cache-Control: s-maxage=300`; the route sends no `Cache-Control`.
    - **No setting for the 5 minutes.** Rejected `LAUNCH_DATA_REVALIDATE`:
      the page's `revalidate` must stay a literal, so the page's interval and
      the setting could differ without anyone noticing; a 0 or a typo would
      quietly switch off the cache the spec asks for, so it would need
      parsing and a floor; and nobody has asked for another value. Asked of
      RBM, below.
    - **The data repository has moved** (found 29 Oct): now
      `Quantum-Sage-Technologies/unitaid-launch-data`. The old Pages address
      answers 404 for all five files, with no redirect; the new one 200
      (`dashboard.json`, the three language files, `schema.lang.json`).
      `lib/data.ts`, `.env.example` (now the `{locale}` form, as
      `lib/data.ts`; it still named the combined file) and `README.md`
      changed; history below keeps the old name.
59. **The notifications route, `POST /api/unitaid/notifications`** (29 Oct,
    module spec 2b: a shared token as `Authorization: Bearer`; 202 "accepted
    and cache refreshed", 200 `duplicate: true`, 400, 401, 413 over 1 MB).
    The receiver only; the sender, in the pipeline, is not built (below).
    `app/api/unitaid/notifications/route.ts`, its parts in
    `lib/notifications.ts` (a route file may export only what Next.js
    expects), the refresh in `lib/data.ts` `refreshDashboard()`.
    - **The refresh: read the new file, then `revalidateTag(tag, { expire:
      0 })`, then, once the route has answered, read the file into the cache
      again (`after()`).** Every `getDashboard()` fetch now carries the tag
      `launch-data-<locale>`, and the build shows each page carrying its
      language's tag (`x-next-cache-tags` in `.next/server/app/en.meta`), so
      one call expires the cached copy and the pages built from it, wherever
      RBM's page lives. The bundled docs (`04-functions/revalidateTag.md`,
      `updateTag.md`, `01-getting-started/09-revalidating.md`): with `"max"`
      the next request gets the old copy (stale-while-revalidate);
      `updateTag` expires at once but only in a Server Action (its source
      throws for a `/route`); for a webhook the docs give `{ expire: 0 }`.
      Next.js's source (`server/web/spec-extension/revalidate.js`,
      `server/revalidation-utils.js`,
      `server/lib/incremental-cache/file-system-cache.js`): in a route, the
      call only queues the tag; it is applied when the handler returns,
      stamped `Date.now()` then, and a fetch inside the handler does not see
      it. So re-reading inside the handler would get the old copy, and what
      it wrote would be expired with it; `after()` runs once the expiry is
      in place. Measured on `next start`, built against a local host serving
      the live files with a `[vN]` mark on the first stage name: after each
      202, the very next request, page or data route first, showed the new
      version (the page `x-nextjs-cache: MISS`, then `HIT`); `/fr`, not
      notified, kept its version; each notification cost the host 2
      requests (the check, the re-read) and the next requests 0.
      Rejected: `"max"` (the next visitor gets the old data); `revalidatePath`
      (it names pages by path, and RBM's page is at a path of theirs);
      re-reading inside the handler (above); **expiring without re-reading**,
      measured: with the host failing after the 202, the page answered HTTP
      500 and the data route 502 until it came back, where without a
      notification both would have kept the old copy (decision 5). With the
      re-read, the same test gave both 200 with the new version, and no
      visitor's request reached the host. What remains is a host failing
      during the re-read itself.
    - **The new file is checked before anything is expired** (`cache:
      "no-store"`, the page's own checks). If it cannot be used: 502 `{"error":
      "source unavailable", "kind"}`, the cache untouched, the `eventId` not
      recorded. Measured: host at 500 → 502, page and data route kept the
      previous version; the same event sent again after the host came back
      → 202. 502 is not in the spec's list. Rejected: 202 (it says "cache
      refreshed"), 500 (the fault is the host's).
    - **Order:** 503 → 401 → 413 → 400 → duplicate → 502 or 202: the brief's
      order, with the unset token first. The body is not read before the
      token is checked (test: a 2 MB stream behind a wrong token, at most 1
      chunk pulled).
    - **No token set → 503** `{"error": "notifications are not
      configured"}`, logged. Rejected: 401 (the sender would think its token
      wrong and rotate a good secret); 500 (nothing is broken). An empty or
      blank token never matches. `UNITAID_NOTIFY_TOKEN` is read on each
      request, trimmed.
    - **The token is compared in constant time:** SHA-256 of both, then
      `crypto.timingSafeEqual` on the two 32-byte digests (no length leak,
      no early exit; a missing header is hashed too). `Bearer` in any case
      (RFC 7235); a 401 carries `WWW-Authenticate: Bearer realm="unitaid"`
      (RFC 6750).
    - **1 MB is 1,048,576 bytes.** A `Content-Length` over it → 413 without
      reading; otherwise counted while reading, which stops at the first
      chunk past the limit (test: 17 of 32 chunks of 64 KB pulled). Exactly
      1,048,576 bytes accepted, one more refused. Next.js 16.4.3 sets no limit
      of its own on a route handler: a 2 MB chunked body reached the route.
    - **400:** `eventId` non-blank text of at most 256 characters (keeps the
      duplicate list small: 1,000 × 256); `occurredAt` RFC 3339, the ISO 8601
      profile with an offset, a real date (`2026-02-30` refused; no offset
      refused, the moment would be ambiguous; not otherwise used);
      `data.dataset` one of `LOCALES`, as the data route, so RBM's example
      `"sample"` is refused. Every problem listed; other fields ignored;
      `Content-Type` not checked. **An unknown `type` is 400**, not accepted
      and ignored: there is one sender, ours, changed with the receiver, so
      an unknown type is a mistake to show, not a newer event to tolerate;
      and ignoring it would need an answer the spec does not have (202 says
      refreshed).
    - **Duplicates:** in memory, 24 hours and at most 1,000 `eventId`s, the
      oldest dropped first; recorded only after a 202. A restart forgets the
      list (harmless: a repeated refresh changes nothing and costs 2
      requests). Several instances each keep a list and a cache, and
      `revalidateTag` on one invalidates only that one (`02-guides/
      self-hosting.md`, "Multi-Instance Cache Coordination": a shared
      `cacheHandler` with `updateTags`/`refreshTags`). Two copies of one
      event arriving together may both refresh. One notification per
      language: a publish changes all three files, so the sender sends three.
    - Logged: 202, 502 with the reason, 503, a failed re-read. Not logged:
      401, 413, 400 (strangers could fill the log; the sender gets the
      problems in the answer).
60. **The page changes of 3 Nov 2026 (partner feedback), ported** (branch
    `feat/tracker-feedback`, from `feat/data-route` `d322190`). The page side
    is launch-development-test `main` `b0f8675` (`git diff c34d72c b0f8675 --
    index.html`, explained in its `docs/jackson/dale-jan-tracker.md` §3 to
    §8), built into the static pages of scratch commit `ef0bd8c` here (local
    branch `scratch/pages-dale-jan`, not pushed), which the tests now read.
    The page is the truth; each part below follows its code line for line.
    - **The map shows one access stage at a time** (`lib/map.ts`,
      `components/map/`). `MapState.stageOff` (checkboxes that faded a stage)
      became `view` (radio buttons; `VIEW_DEFAULT` "registered", which Reset
      returns to; `setView`). `countryStages()` (`lib/pathway.ts`, one copy
      for the map and the Country access card, decision 48's rule) says which
      stages each listed country has a source for: its level, or a cited
      source whose category is National register (registered) or Policy /
      guidelines (guidelines). So `MapSource` carries `category`, and
      `mapContext()` keeps `stageSets` per medicine instead of `levels`. What
      follows the view: the fill (`featureLevels`, `viewLevels`, old
      `paintView`'s `byIso`), `stageOf` (old `mftStage`), the legend (the
      stage in view and No data, the other rows `hidden`; old `stageCounts`),
      the note under the heading (`MapText.viewNote`, old `VIEW_NOTE`), the
      finder's Stage column, the map hover, the region bar and its key (the
      view and No data only, `inView`), and the country page's pill and
      "Other countries at the same stage" (only when the country is at the
      stage in view). What does not: the keyboard-list tooltip and the
      country page's track tick each stage on its own (`listTip` no longer
      takes a level); the Filters' counts (`viewCounts`, a country in every
      stage it has a source for); the overview, now "Access stages · …" with
      one thin bar per stage and "A country can count at more than one
      stage." Gone: the select-all box and its `indeterminate`, the No data
      filter row, `setAll`, `setStage`, `fillOpacity` (the map no longer sets
      `fill-opacity`), `matches` (Find a country lists every country in
      scope; Previous/Next steps through every tracked country, the old quirk
      for an untracked page kept), `legendCounts` (which counted untracked
      entries; the legend now counts tracked countries only, as the page).
    - **Timeline: `startedYear()`** (`lib/board.ts`). A started stage (in
      progress or delayed, not the current one) whose date reads "Since
      YYYY" (`sinceYearOf`) sits on the axis at that year, labelled "since
      YYYY" (`TimelineItem.from`, `BoardText.startedSince`), and no longer
      under "Ongoing · no date". Its year also widens the axis.
    - **Medicines table** (`components/board/`): the Status column is Market
      Access and the Access column Country Access, one figure each
      (`marketCell`, `countryCell`, `accessFig`; Country Access reads "Not
      yet reached" before Market Access is). The status light left the row;
      `lateInfo` stays, unused, as on the page. The phase name over a figure
      shows on phones only (two CSS rules). `BoardText.colStatus`/`colAccess`
      are `colMarket`/`colCountry`.
    - **Country access card** (`CountryAccessKv`, `countryAccessCounts`):
      Countries on the map, then Confirmed in national registers / In
      national guidelines / In MFT plans counted per stage, then "A country
      can count at more than one stage." (`PathwayText.moreThanOneStage`).
      The furthest-level split and the conditional register row are gone.
      The stage 4–5 panels keep `levelCounts` (the page did not change them).
    - **Words**: the disclaimer's first paragraph and the procurement note
      come reworded from the message files; nothing in the code.
    - **CSS** (`styles/launch-dashboard.css`, by hand, fenced): `.srow .acc
      small` (hidden, shown under 680px), `.det-srow`, `.det-bar.thin`,
      `.det-snote`.
    - **Messages** from launch-development-test `feat/rbm-messages-tracker`
      `1c1da8c` (its decision 15), copied with `copy-rbm-messages.js`,
      first with `--allow-stale` (`map.panel.stageMixTitle` had no
      translation); then recopied from `aabc497`, where the page's own
      reviewed translation was filed under the message's English (fr
      "Étapes d’accès · {medicine}", pt "Etapas de acesso · {medicine}"),
      so nothing ships in English (`untranslated` empty). 318 messages (313
      before).
    - Rejected: keeping the checkboxes beside the views (the page has none);
      a `level` argument to `listTip` (the tooltip no longer depends on the
      fill); a second copy of `countryStages` in `lib/map.ts`.
    - **Tests: every pin moved to `ef0bd8c`** (the five extractors,
      `text-parity`'s map markup check, `scripts/build-map-assets.mjs`, the
      comments); no part kept at `7c1bf11`, since the extractors' `--check`
      compares one commit. Extractor lists: golden-board `accessCell` →
      `accessFig`, `marketCell`, `countryCell`, plus `countryStages` and
      `startedYear`; golden-pathway `countryStages`; golden-map `VIEW_NOTE`
      and `countryStages`, and its hook reads and sets `mapView` (calling
      `paintView` as the radio button's handler does) instead of `stageOff`,
      and exposes `viewCounts` and `paintView` instead of
      `paintStageFilter`. golden-map's sweep is now every medicine × every
      Location choice × every view × every combination of the two
      recommended-use boxes (was × the 16 stage-box combinations), with the
      fill levels, `stageCounts` and `mftStage` per view; the click sequences
      pick a view instead of a stage box or the select-all box; each view
      also compares `#mapnote`, the legend rows' `hidden` (was `dim`), and
      that neither side sets `fill-opacity`. New comparisons: `startedYear`
      for every stage of every variant, a board variant with three started
      gates ("Since 2009", "Depuis 2017", "desde 2021", one before every
      dated gate), the timeline items' `from` read back from the old markup,
      and `countryStages` on every medicine's list plus edge cases (no
      sources, prototype ids, a category with odd spacing and case, a level
      outside the three, a repeated iso3).
    - **Portuguese: the European pin is gone.** The pages at `ef0bd8c` are
      Brazilian (`<html lang="pt-BR">`, from launch-development-test
      `11681f2` onwards), as the port, so `tests/setup/european-portuguese.ts`
      and `tests/fixtures/messages/pt-PT.json` are deleted and the old code
      reads its own page's tag again (each harness throws if it is not
      `PAGE_LANG`). The frozen text tables (`tests/fixtures/text/`) now hold
      the `ef0bd8c` pages' words: Portuguese throughout, English and French
      where the page changed (the five reworded texts, the new ones, and the
      seven words of 28 Oct, which those pages translate, so their `CHANGED`
      entries went); `MAP_MARKUP` was read from the pages. The values were
      taken from the message files and then proved against the pages by the
      area tests, which is what decision 57 could not do while the pages
      were European. That proof found **ten Portuguese messages with a
      {placeholder} that differ from the Brazilian page** (none in French):
      `pathway.stageButtonLabel`, `stepPanel.label`,
      `product.stagePanel.surveyStatus`, `yardstick.sinceNotRoutine`,
      `yardstick.notePublished`, `yardstick.noteEstimate`, `map.preLaunch`,
      `map.noCountryData`, `disclaimer.countriesVerified`,
      `disclaimer.countriesNotVerified`. The page joins translated fragments
      ("Estágio {n}: …", "{name} Está em fase …"), the message files carry
      each message's own translation (filed under its own English since the
      message build's decision 11), and the Brazilian retranslation of 28 Oct
      gave them different words. Hidden until now: both sides were handed the
      European words. The tables keep the page's words; `text-parity`'s
      `CHANGED` lists the ten. Which wording is right is for the Portuguese reviewer;
      the port shows the message files'. Two of them are visible on 10 Nov
      (`disclaimer.countriesVerified`, `countriesNotVerified`), the step
      panel's label and the pathway's screen-reader label too.
    - **The basemap's Portuguese names** (`lib/map-countries.json`) were
      still European (from `7c1bf11`): rebuilt from `ef0bd8c` by
      `scripts/build-map-assets.mjs`, 50 of 235 names change ("Vietnã",
      "Quênia", "Benin"); shapes, tracked countries and the worker
      unchanged.
    - **Found:** the Brazilian page writes the map's "Legend" heading
      "Lenda" (a legend as a myth), now in `MAP_MARKUP`; the message files
      have the same word. For the reviewer.
    - Results: `tsc --noEmit` clean; vitest 17 files, 357 of 357 (357
      before; the new comparisons sit inside existing tests). golden-map
      209,381 comparisons (en 69,806, fr 69,757, pt 69,818; the sweep has 12
      filter states per location where it had 64), 21 kinds of click
      reached, each view 52 to 62 times.

61. **The forms post to this site's relays, not to the forms service**
    (3 Nov; Stage 2 of moving the forms' backend off Vercel onto a Supabase
    function, launch-development-test `supabase/`, its
    `docs/forms-service-notes.md`). `POST /api/unitaid/subscribe`,
    `/api/unitaid/feedback` and `/api/unitaid/unsubscribe`
    (`app/api/unitaid/*/route.ts`, `relay()` in `lib/forms.ts`) pass each
    form, server to server, to `${UNITAID_FORMS_URL}/api/<path>` with
    `Authorization: Bearer ${UNITAID_FORMS_TOKEN}`, and hand back the
    service's status and JSON unchanged. `formsEndpoints(enabled)` now
    returns those relative paths, and `formsEnabled()` (`lib/env.ts`) turns
    the forms on, replacing `NEXT_PUBLIC_LAUNCH_FORMS_URL` (decision 28) and
    the `formsUrl` prop.
    - **Why.** RBM's module rules (3 Nov) allow no `NEXT_PUBLIC_` setting,
      let only `lib/env.ts` and `app/api/unitaid/**` read `process.env`, and
      say the browser calls only `/api/unitaid/…`. And the token must stay on
      the server, because anything a page holds, its readers can read. A side
      effect: the browser never crosses sites, so there is no CORS, and the
      service's address never reaches a reader. Both builds were checked: the
      dummy token and address appear in no file under `.next/static`, nor in
      any built page.
    - **Rejected:** the browser posting to the service, as the static copies
      do (it breaks RBM's rules, and the address sits in every page); a token
      in the page (readable by anyone); the mail code on RBM's server (the
      email key would sit with RBM).
    - **Numbers.**
      - **32 KB** (32,768 bytes) body cap: the forms service's own cap. The
        largest real form, a 2,000-character report with its page details,
        is a few KB.
      - **10 s** timeout. Shorter than the service's worst case: a subscribe
        makes up to six Resend calls (look up, save twice when the
        organisation is retried, add to the segment, the welcome, the team's
        note), each allowed 8 s. Each usually takes a fraction of a second.
        When the relay gives
        up, the service may still finish, and the reader, told it failed,
        tries again and reads "already subscribed". A reader waiting half a
        minute was judged worse.
      - **32 characters** minimum token, the service's own minimum
        (`openssl rand -hex 32` gives 64). Shorter counts as not set, so a
        test value cannot slip into production.
    - **Not followed: redirects** (`redirect: "manual"`, giving 502).
      Following one would drop the token on another host, or turn the POST
      into a GET. A moved service is a setting to fix. Any 3xx, and a
      browser-style `opaqueredirect` (status 0), is refused **before its
      body is read**. The first version parsed the body first, so a 307
      carrying `{"ok": true, …}` reached the browser as a 307 (found by the
      independent test run, 3 Nov).
    - **GET is exported only to refuse it.** A method a route does not
      export gets Next.js's own 405, with no `Allow` header and an empty
      body. That is `autoImplementMethods`, the same code in 16.4.3
      (`node_modules`) and 15.5.7 (its npm package, read 3 Nov). Both also
      serve HEAD with GET when GET exists. So each route's `GET` calls the
      same relay, which answers 405 with `Allow: POST` and a JSON reason, for
      GET and HEAD alike. The build still lists all three routes as dynamic
      (ƒ): the handlers read the request, so nothing is built ahead or
      cached.
    - **Relayed: the body only.** Not the reader's cookies, Origin, user
      agent or IP. The service's planned rate limit therefore cannot tell
      readers apart yet (below).
    - **On/off is drawn into the page,** which is built ahead and refreshed
      at most every 5 minutes (`revalidate = 300`, incremental static
      regeneration). So:
      - a change to `UNITAID_FORMS_*` reaches the page up to about 5 minutes
        later;
      - a cached page survives a restart;
      - a build made without the settings starts with the forms off until
        the first refresh.
      The relays read the settings on every request, so they are always
      current. Advice for RBM (README, "Forms routes"): set both before
      building. Rejected: making the page dynamic, which would give up the
      cache the data relies on (decision 58); deciding in the browser, which
      needs a public setting or an extra request.
    - **The token in the unsubscribe page's address.**
      - **Referer.** The `no-referrer` meta tag comes after the stylesheet
        and scripts in the `<head>`. In the independent test run, 10
        same-origin requests for them carried the address, token included,
        as `Referer`, all to the server that already had the token. The
        real fix is a `Referrer-Policy: no-referrer` response header, which
        needs `next.config` `headers()` or middleware. Both are RBM's
        protected host files, so it is listed for RBM (README).
      - **Analytics.** RBM's analytics will record the address with `?t=`.
        The token allows only unsubscribing that one address; RBM is asked
        to leave `/unitaid/unsubscribe` out of its analytics (README).
    - **Logged:** 503, a 502 with its reason, and any non-2xx answer from the
      service except 400 (the reader's own input), with the path and status
      only. Never the form or the token; a test checks it.
    - **The "Unsubscribe?" page, `app/[locale]/unsubscribe`**
      (`/[locale]/unitaid/unsubscribe` in RBM's module). The service cannot
      draw it: on Supabase's own address a page is served as plain text. So
      the link in the welcome email opens the service, which sends the
      reader here (303) with the link's token.
      - The page reads `?t=` after hydration, so it stays pre-built
        (`ExampleDashboard`'s reason), and never posts on load.
      - Its button posts `{ t }` to the third relay.
      - States: reading (the server's, button disabled), ready, sending,
        done, bad link (no token, or a 400), failed (button kept).
      - When the outcome replaces the button, focus moves to the heading.
        The status line is `aria-live`.
      - Metadata: robots noindex, referrer no-referrer.
      - JavaScript is required; the old Vercel page's button was a plain
        form. The dashboard needs JavaScript anyway.
      - Text: 12 messages under `Unitaid.unsubscribe`, marked `uiOnly` in
        launch-development-test's `i18n/ui.page-forms.json` and copied in by
        `copy-rbm-messages.js`. French and Portuguese are still English
        (manifest `allow_stale`, 12 of 12 untranslated) until the translate
        bot runs.
      - Styles: `.card` and `.sub-go`, plus nine rules for `.unsub*`, all
        under `.launch-dashboard`. The paragraph rules are written
        `.unsub .unsub-msg p` and `.unsub p.unsub-back`: the card's own
        `.card p` (0,2,1) beat a bare `.unsub-back` (0,2,0), setting the back
        link flush under the button at 15px instead of 18px below at 13.5px
        (found by the independent test run).
    - **Tests:**
      - `tests/forms-routes.test.ts` (26): the settings; every refusal, with
        nothing sent; the exact request, without the reader's cookie,
        Origin, IP or own Authorization; pass-through; 502s; every 3xx with
        a JSON body or none, and an opaque redirect, refused unread; logs;
        each route's path; POST and GET exported; GET and HEAD through each
        route give 405 with `Allow: POST`, configured or not.
      - `tests/unsubscribe.test.ts` (11): the token, the exact POST, every
        outcome, every state's markup, the text in each language, the
        metadata, and a server render that sends nothing.
      - `golden-frame` now compares the old and new requests without their
        address, and checks each side's address on its own: the old pages'
        Vercel address, and the relay. My first version of that change
        copied the new calls before the send had made them, so the test was
        wrong, not the code.

## Deferred, and found on the way

- **3 Nov, the forms' relays (decision 61).**
  - **RBM's addresses are assumed.** The forms service sends RBM's readers
    to `/{locale}/unitaid/unsubscribe` on `dashboards.endmalaria.org`, and
    the test site likewise (its `SITES`). Confirm with RBM. When the module
    moves, the page goes to `app/[locale]/unitaid/unsubscribe`, and its back
    link to `/{locale}/unitaid`.
  - **The reader's IP is not passed on,** so the service cannot limit sign-ups
    per reader. If a rate limit is built, the relay must send the IP in a
    header the service trusts only with the token.
  - **The 10 s timeout against the service's worst case** (above). Watch the
    service's logs once it runs on Supabase.
  - ~~**French and Portuguese** for the page wait for the translate bot.~~
    Done 3 Nov. launch-development-test PR #137 merged, the bot translated the
    12 texts (`1b5ae75`), and the messages were copied from there with nothing
    left in English. The Portuguese title reads stiffly ("Cancelar inscrição
    para receber atualizações do painel de controle LAUNCH?"); a reviewer may
    want to reword it in `i18n/translations.json`.
  - **Does RBM's server allow outbound HTTPS** to the forms service?
    (Question 4 of the 3 Nov reply to RBM.) Without it, every form answers
    502.
  - **For RBM, on its own files:** a `Referrer-Policy: no-referrer` header
    for `/{locale}/unitaid/unsubscribe`, and that path left out of its
    analytics (decision 61). Neither can be done from inside the module.
  - **OPTIONS on a relay says `allow: GET, HEAD, OPTIONS, POST`** (Next.js's
    automatic answer, now that the routes export GET), while GET and HEAD
    answer 405 `Allow: POST`. Found by the independent tester, 3 Nov. It is
    harmless, because OPTIONS carries no CORS header and opens nothing to
    other sites, so it was left. An exported OPTIONS handler would make the
    two agree.

- **29 Oct, the notifications route (decision 59).**
  - **What the sender must do** (the pipeline,
    `Quantum-Sage-Technologies/UnitAid-dev`; not built). After the publish,
    wait until the GitHub Pages build of the data repository reports
    `built`, then POST one notification per language (`en`, `fr`, `pt`) to
    `NOTIFY_URL` with `Authorization: Bearer $NOTIFY_TOKEN` (two repository
    secrets: RBM's address plus `/api/unitaid/notifications`, and the token
    RBM generated). `eventId` stable for that publish and language (for
    example `<data commit>-<locale>`) and the same on every retry;
    `occurredAt` the publish time in UTC with `Z`. Retry 502, 503 and
    network errors with a pause, same `eventId`; 400, 401 and 413 are
    mistakes to fix, not to retry; 200 `duplicate: true` means done.
  - **GitHub Pages, 29 Oct.** Seen here: `cache-control: max-age=600` on
    `dashboard.en.json`, `last-modified: 06:33:33 GMT`. Measured by the
    coordinator, not re-measured here: that day's Pages build took 29 s
    (06:33:05 → 06:33:34 UTC), and a unique `?v=` query string still came
    back `x-cache: HIT`, so adding one does not appear to get past Pages'
    cache. So: notify only after `built`, or the check reads the old file
    and it is kept 5 minutes. **Untested:** whether Pages' CDN still serves
    the old file for a while after `built`. Check at the next real publish:
    after `built`, fetch each file and compare its `generated_at` with the
    new one.
  - **The route cannot tell an old file from a new one.** A
    `data.generatedAt` in the notification (the new file's `generated_at`)
    would let it answer "not there yet" so the sender tries again. It
    changes RBM's body; to propose, not done.
  - The expiry is held in memory (the file-system cache handler's tag
    list). A restart between a 202 and the re-read would bring the old copy
    back for up to 5 minutes.
  - **`scripts/smoke.mjs` can hang for ever.** Its `send()` waits for
    Chrome's answer with no time limit. One run (of five on this branch
    today) stopped after `[pt] then Escape closes the step panel`, at the
    mouse move that starts the next check, and was killed after more than
    10 minutes; the 73 checks before it passed, the same as a full run. Not
    the change (no client code changed; the next two runs 87 of 87). Likely
    the Escape effect in decision 51: an input event Chrome never
    acknowledges. A time limit in `send()` would turn a hang into a failed
    check. Not done.

- **29 Oct, found with the data route (decision 58):**
  - A file that says `schema_version: 1` but has no `data`, or no
    `data.sources`, throws a `TypeError` in `lib/dataset.ts` `shape()`, not
    a `DatasetError` (checked: "Cannot read properties of undefined"). The
    route answers 500, not 502, and the page shows the error page, not
    "being updated". The fix belongs in `shape()` (check, then throw
    `DatasetError("schema")`) and changes what the page shows; not done.
  - When a cached copy is past its 5 minutes and the host fails, Next.js's
    background fetch fails silently: nothing reaches the server log, and
    the route and page keep serving the old copy. An outage is visible only
    for a language with no copy (the route's 502 is logged).

- **28 Oct: the static pages are gone (decision 56), so the paragraph below
  is history.** Merging `main` into this branch now gives modify/delete
  conflicts whenever `main` has rebuilt a page; keep the deletion. Nothing on
  `main` is needed here: the React version takes its text from `messages/`.
- ~~Do not merge `main` into this branch while the static pages are still
  in it.~~ `main` gets the pages rebuilt from launch-development-test (on
  28 Oct with the 7 words of its PR #129 translated). The golden tests read
  the pages in the checkout: `tests/golden-map.test.ts` checks its reference
  copies of the old map code against `en/`, `fr/` and `pt/index.html`
  (`golden-map/extract.mjs --check`), so a rebuilt page fails it although
  the port is unchanged. Git itself would merge cleanly (this branch never
  changes those files; trial merge 28 Oct). When the branch goes to
  `main`: first remove the static pages (handoff step 4), or re-extract the
  references from the new pages and re-run the golden tests.
- `app/` is the example app only, to prove the data path. RBM takes the
  components (step 3), not this app.
- The error page and the "being updated" notice are English only until the
  message files exist (step 2). Done: the frame's `Banner`, in the page's
  language (decision 50).
- Next.js caches fetched responses of up to 2 MB. `dashboard.json` is 267 KB
  today; past 2 MB, every refresh would fetch it again. The language files
  the page fetches are 122 to 133 KB (29 Oct).
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
  and dialog (decisions 25, 31). Left to their areas: the map's colour reads,
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
  (decision 27).
- `styles/launch-dashboard.css` is a copy of `89b2011`. CSS changes to
  `index.html` after that are ported by hand.
- **The board (decisions 35 to 41).**
  - Only the markup at load is tested. Opening rows, switching views, the
    stage panel, Escape, the fade, the timeline fit and the forks are React
    state and DOM work with no test here (no DOM library is installed), and
    the board has not been checked in a browser. Do that on the Dashboard.
    Done in part (decision 51): opening rows, the stage panel, Escape, focus
    and the hints, in `/en` and `/fr`. Switching views, the fade, the
    timeline fit and the forks are still unchecked in a browser.
  - The example page shows the board without callbacks or slots (a server
    page cannot pass functions), so its icons, Country access rows and stage
    panels are empty there and citations are plain names.
  - `#det-list` was in this area's brief; it is the map's "Find a country"
    list (`finderRows`, in the map's Detail rail, built from the map's
    filters), so it is left to the map area.
  - `detail.price` is in the data but today's page never draws it; not drawn.
  - Where the page read a detail field without checking it (`d.access.map`),
    a missing field stopped the whole page; here it draws empty.
  - Intended differences, none visible at load: a closed stage panel loses
    its `late` class (the page left it on the hidden panel); the timeline no
    longer writes `data-w`/`data-base`; `.info` hints count only inside
    `#board` if `statTipHandlers` checks it (RBM's page may have its own
    `.info`, which the page's `closest(".info")` would have caught).
  - React 19 server rendering adds a `<link rel="preload" as="image">` for
    each `<img>` (the WHO emblem in the pathway's stage icon); harmless, for
    the pathway area to know.
  - Hydration: the procurement table formats numbers with
    `Intl.NumberFormat` on the server and again in the browser; French uses a
    narrow no-break space, and an ICU difference between Node and a browser
    would show as a text mismatch warning.
  - `onOpenProduct`'s echo rule: a router that never echoes leaves the last
    id remembered, so a real link to that same medicine is skipped once.
  - Kept as they are, worth a decision: the yardstick box says "{n} years"
    even for 1; `.gp-kv` puts `dt`/`dd` in a `div`, not a `dl` (the pathway's
    panel now); the page's `sameColumn` is dead code, not ported.
  - Mistranslations copied from the built pages: fr "Plomb" (the metal) for
    Lead, "Médecine"/"Voyage"/"Accéder" for the Medicine/Journey/Access
    headings, "Scène" for Stage, "Durée du traitement" (duration) for
    treatment courses, and "Presentation", "Transactions", "Packs", "not
    estimated" left in English; pt "Liderar" (to lead), "viagem" (a trip) for
    journey, "Até ao momento, está tudo bem." ("so far all is well") for
    Actual so far, and "data de expiração" (expiry date) for a dated
    approval.

### The pathway area (`feat/react-port-pathway`)

- **What the dashboard must wire.** Render `<JourneyIconSprite />` once, and
  `<Tip ref>` and `<StatTip ref>` once, inside the root after `.wrap`. Hold
  `openStep` and pass it to `Pathway` (with `onOpenStep`) and to the board.
  Compute `tracked(applyShowLate(data.products, ctx.display))` once and give
  the same list to every area. The board places `GatePanel` (one open at a
  time, board-wide; it owns the marker's `aria-expanded`, the row's
  `gate-flag` class, Escape and focus for it), `CountryAccessKv` in its
  Country access card, `StagePeek` as its markers' hint
  (`tip.showAt(marker, <StagePeek …/>)` on hover and focus unless the
  marker's panel is open, `tip.hide()` on leave, blur and when a panel opens),
  spreads `statTipHandlers(statTip)` (memoised) on `#board`, and passes
  `cellPanelOpen`. The map calls `tip.showAtPoint` / `tip.showAt` / `tip.hide`.
- **Shared pieces that live here for now:** `StageIcon` and the sprite (the
  board's markers and chips use the same glyphs), `Cites` (the board's
  milestone sources and procurement source draw citations the same way),
  `tracked`. Move them to a shared folder when the areas merge, rather than
  copy them.
- **Types added to `lib/dataset.ts`:** `StageInfo` (and `LaunchData.stageInfo`
  typed with it, a type-only cast in `localize()`), `CountryEntry`,
  `CountrySurvey`, `CountrySummary`, `ProductDetail.adoption`, `.countries`,
  `.country`, and `Source.category`. The map's area may add its own country
  types; merge them into these.
- **Intended differences from today's markup** (everything else is equal):
  - React 19 preloads the WHO emblem: server rendering writes
    `<link rel="preload" as="image">` for it, into `<head>` on a real page.
  - The emblem's address is `/launch-icons/who-emblem.svg`, not
    `../assets/who-emblem.svg`. `public/launch-icons/who-emblem.svg` is a
    copy of `assets/who-emblem.svg`; RBM serves it there or passes
    `whoEmblemSrc`.
  - `#pathway` arrives drawn from the server. The page kept it `hidden`
    until its script had built and measured it; now the strip shows first and
    is measured after hydration, so on a narrow screen it can shift once
    (stacking, the pair's lift). Hiding it until then was rejected: a reader
    without the script would get no strip.
  - Closed, `#gatewrap` has no `aria-label` and `.gatepanel` no `late` class;
    the page left the last ones on the hidden element.
  - The sprite, `#tip` and `.stat-tip` sit inside the root, not in `<body>`.
- **Not checked in a browser.** The tests compare markup; the measured
  layout (`stack`, `--pg-lift`), the hints' placement, Escape and focus were
  ported line by line but not driven in a browser. Check on `npm run dev`
  (`/en`, `/fr`, `/pt`; the preview under the list stands in for the board).
  Since the Dashboard, `scripts/smoke.mjs` drives the steps, the step panel,
  Escape's order and focus, and the hints on hover and focus (decision 51);
  the narrow-screen stacking is still unchecked, and the preview is gone.
- **Fixed hints inside RBM's page.** `#tip` and `.stat-tip` are
  `position: fixed` and placed in window coordinates. If RBM puts the
  dashboard inside an element with a `transform` or `filter`, they are placed
  relative to that element instead and land in the wrong place. Check on
  staging.
- **Old behaviour kept as it is, and worth a decision later (pathway):**
  - Translations: Portuguese Close is "Perto" ("near"); French names the step
    panel "Scène" ("scene"); Portuguese "Gravado" for Recorded and
    "Registrado" (Brazilian) beside European Portuguese elsewhere; Portuguese
    uses five words for "stage" (Estágio, Etapa, Fase, estádio, passo); French
    puts the count after the noun ("État des médicaments 4 à ce stade");
    Portuguese ends one survey note in a full stop inside a " · " list and
    words the other differently ("pesquisa de país …"); ", N delayed" in a
    step's label is English on every page (unreachable while `showLate` is
    off).
  - `#pathway`'s label is static text that names "eight milestones across
    seven stages" and the WHO pair, so it goes stale if the data changes; the
    English has no final full stop.
  - `#gatewrap` (a `div`) and `.gw-sum` (a `span`) carry an `aria-label` with
    no role; screen readers may not announce a name on a generic element.
  - Close (in both panels) removes the focused button, so focus falls to the
    page; only Escape returns it to the step or marker.
  - A stage whose source ids all fail to resolve, with no free-text source,
    shows "Source: " and nothing after it; a country survey with no status
    shows "country survey is " and nothing after it.
  - `stalledSince` and the stage panel read `p.detail` unchecked, and the
    Country access rows break on a medicine with neither a country list nor
    `detail.country`. Today's data always has both.

### The Dashboard (`feat/react-port-dashboard`, decisions 42 to 51)

- **Differences from today's page** (everything else is equal, by the
  parity and markup tests, or was checked in the browser):
  - An `.info` hint answers only to the board's own buttons (decision 49).
  - The example app writes `?product=<id>` into the address when a row
    opens (`replaceState`); today's page never wrote the address. RBM's
    router decides; without `onProductChange` nothing is written.
  - With `?product=` the row opens after hydration, not in the server's
    markup (decision 47).
  - The "being updated" and error notices look like the page's banner and
    speak its language (decision 50).
  - Against the port before this branch, not against today's page: the map
    is no longer English on `/fr` and `/pt`, and there is one `#tip`.
- ~~For launch-development-test's message pipeline: the 37 held texts need
  keys in `i18n/ui.en.json`, and the 36 French apostrophes need a
  decision.~~ Done 28 Oct: decision 53.
- `product.accessLine` could feed `accessLine()`; not wired, as it would
  change a golden-tested function's inputs for the same text.
- The board still works out its own `stageContext` and `tracked` list from
  `data` (its props take the dataset); the Dashboard works out the same for
  the strip. Same inputs, same values, computed twice.
- The browser check covers `/en` and `/fr`, not `/pt` (`SMOKE_LOCALES=pt`
  runs it), nor narrow screens, switching journey views, the timeline fit,
  the forks or the forms' sends. It needs the forms' two settings
  (`UNITAID_FORMS_URL`, `UNITAID_FORMS_TOKEN`; before decision 61,
  `NEXT_PUBLIC_LAUNCH_FORMS_URL`) set at `next build`, or the Subscribe check
  fails by design. (28 Oct: run with
  `SMOKE_LOCALES=en,fr,pt`, 87 of 87. Narrow screens and `/pt` against
  today's page: the side-by-side check, below.)
- If 20.4 KB of gzipped text in the browser matters (decision 42): pass the
  text in, and give `lib/stages.ts` its words through the context; the
  golden tests' calls would change with it.
- At the merge with MapLibre 6.14: the example page's `ASSETS.mapWorker`
  becomes `/launch-map/maplibre-gl-worker.mjs`. Nothing in the Dashboard.
- The example app has no icon: Chrome logs a `/favicon.ico` 404.

### The side-by-side check (step 5, 28 Oct 2026)

How, so it can be repeated (the scripts were kept outside the repo, like the
smoke screenshots):

- **Same data in both.** Today's pages (`en/`, `fr/`, `pt/` on this branch,
  unchanged from `main`; built from launch-development-test `2d30ff3`, and
  only a Vercel redirect commit separates that from `89b2011`, the CSS's
  source) served by `python3 -m http.server 3125`; the port's `next build`
  and `next start -p 3124` with
  `LAUNCH_DATA_URL=http://127.0.0.1:3125/data/dashboard.json`.
- **Same font.** The example app does not load Source Sans 3 (the host page
  does, see "Remote loads outside this file"), so the port's page was given
  the same Google Fonts link in its `<head>`, as RBM's page will need.
- Headless Chrome (SwiftShader) over the DevTools protocol, at 1440, 1024,
  768, 390 and 360px (the last two as a phone: mobile viewport, touch), in
  en, fr and pt. Per page: a full-page screenshot, the height, horizontal
  overflow, `document.body.innerText`, console errors; each block of `.wrap`
  (header, pathway, board, map, footer) cropped at its own position and
  compared pixel by pixel (a pixel counts when a channel moves by more than
  40 of 255). Three states at 1440 and 390px: a medicine opened by link
  (`#ganlum` today, `?product=ganlum` in the port, each loaded fresh),
  Subscribe open, the feedback dialog open.

Result, after decision 52:

- All 15 pages: the same height to the pixel, the same visible text line for
  line, no horizontal overflow, no console errors in either.
- Header, pathway and board 0.0% different on every page; the map section
  and the footer under 0.12% (0 to 975 pixels).
- The 18 states: open in both, the medicine's row at the top of the window
  (0px) in both, 0.0% different, the same text.
- The leftover pixels, looked at one by one: anti-aliasing on single letters
  (most on the disclaimer's "Country registrations have been verified for…"
  sentence), and the text inside the map's two drop-downs sitting 1–2px
  higher at 360px. The drop-downs measure the same in both (36px high,
  `5px 6px` padding, 16px type). Forcing them to lay out again moves the
  text by the same 975 pixels on *both* pages, and loaded side by side they
  matched exactly: Chrome repaints a native `<select>` after the web font
  swaps in, at a moment of its own. Not a difference between the two.
- Before decision 52 the same run found nothing else: identical text, the
  same states, no overflow; only the 16px narrowing.

Not covered: real phones and Safari (Chrome's mobile emulation only; iOS
WebKit has behaved differently before); hover hints, the journey views, the
map beyond its first frame, the forms' sends; RBM's own page around the
dashboard (its sidebar: see "Breakpoints now measure RBM's window").

A trap in the method: to test today's `#id` link, load it in a fresh tab.
Loading the page, then changing only the hash and reloading, left the row
closed (3,204px above the window); a fresh load opens it, at both widths.

For the README (step 6): RBM must link Source Sans 3 (or serve it with
`next/font`), or the dashboard falls back to Arial and every line wraps
differently from today's page.

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
- **M4. MapLibre's worker served as a file.** Rejected: letting MapLibre
  make its worker itself. On 5.x, the package's main file in `next build`
  (minified) drew only a 28 x 175 px corner of the map; `next dev` (not
  minified) and the untouched npm file drew the whole world. That file made
  its worker from its own source text, which re-minifying breaks; 5.x's CSP
  build, which loaded `maplibre-gl-csp-worker.js` from a file, was the fix.
  MapLibre 6 (M5) has neither: it is ES modules only and always loads its
  worker from a file, which under a bundler it cannot find by itself. The
  page passes the address to `setWorkerUrl()`:
  `public/launch-map/maplibre-gl-worker.mjs` (508 KB, copied unchanged by
  `scripts/build-map-assets.mjs`; `tests/map-assets.test.ts` fails if it is
  not the installed version's). A security policy needs `worker-src 'self'`,
  not `blob:`. RBM serves both files and passes their addresses
  (`shapesUrl`, `workerUrl`).
- **M5. maplibre-gl 6.14.0** (released 11 Oct 2026), up from 5.24.0, to
  close GHSA-jrc7-96c5-q579 (critical, XSS in `DOM.sanitize()`, versions up
  to 6.4.0; first fixed 6.4.1, 18 Aug). `npm audit --omit=dev`: 0
  vulnerabilities; GitHub lists no other maplibre-gl advisory. Rejected:
  staying on 5.24.0 (no fixed 5.x; the sanitizer's only caller is the
  attribution control, which the map turns off, but the audit flags it all
  the same); 6.15.0 and 6.16.0 (18 and 25 Oct, younger than the two-week
  rule; `npm audit fix --force` would have taken 6.16.0). Today's live page
  still loads 5.24.0 from cdnjs. What 6.x changed here: "The MapLibre 6
  upgrade" below.
- **M6. Drawn on the server, not after the map loads.** The old page filled
  the tabs, filters, legend and Detail panel only on MapLibre's load event;
  these render at once, so they work even where WebGL does not.
- **M7. Colours read from the map's own element, not `<html>`**, so a
  stylesheet scoped under `.launch-dashboard` is seen. Before that, and on
  the server, `DEFAULT_TOKENS` (today's values) apply.

### The MapLibre 6 upgrade (branch `feat/react-port-maplibre6`)

Read from MapLibre's CHANGELOG at the `v6.14.0` tag (6.x no longer ships it
in the package) and its v5-to-v6 migration guide. Every breaking entry is in
6.0.0 and its pre-releases; 6.1.0 to 6.14.0 mark none. What applied here:

- **ES modules only; the UMD and CSP builds are gone** (6.0.0, #6254).
  `CountryMap.tsx` now does `import("maplibre-gl")`, which resolves to
  `dist/maplibre-gl.mjs`. It has named exports only, so the old fallbacks to
  `default` and `window.maplibregl` had nothing left to find and are removed.
  `types/maplibre-gl-csp.d.ts` is deleted: the package's `exports` carry its
  own types.
- **The worker is its own file**, `dist/maplibre-gl-worker.mjs`, started as a
  module worker (`new Worker(url, { type: "module" })`; only a `.cjs` URL gets
  a classic one). Under a bundler `setWorkerUrl()` is still required: the
  default comes from `import.meta.url`, which Turbopack turns into a `file:`
  URL. Since 6.13 the worker imports nothing (`maplibre-gl-shared*.mjs` are
  now empty files), so one copied file is enough. Copied under its own name;
  Next serves `.mjs` as `application/javascript`.
- **Paint and layout values are typed per property** (6.0.0, #7481). The two
  `setPaintProperty` calls with `fillColor()` and `fillOpacity()` failed
  `tsc`; they are now asserted to `ExpressionSpecification` at the call, as
  the filters already were. Same values: `lib/map.ts` and the golden test
  are untouched.
- **CSS**: same path, `maplibre-gl/dist/maplibre-gl.css`. Compared rule by
  rule with 5.24.0: the same selectors, declarations reordered and the
  data-URI icons re-encoded by another minifier; new are
  `-webkit-touch-callout: none` on the map, `user-select: none` on control
  buttons and a draggable-marker rule. Every class the skin styles is still
  there.
- **The zoom-out button greys out when `maxBounds` stops zooming out**, not
  only at `minZoom` (6.7.0, #5316): the one visible difference, below.
- **WebGL2 is required** (6.0.0, #7453). Without it the constructor throws
  `GPUInitializationError` (6.7.0); `CountryMap` catches it and logs "[LAUNCH]
  the map could not start", and the rest of the section still works (M6).
  5.x fell back to WebGL1.
- Checked, not applying: events as classes and typed `on()` (6.0.0, 6.3.0;
  the three layer handlers compile unchanged); `map.transform` removed (not
  used); `styleimagemissing`, `setData`, nested GeoJSON properties (the shapes
  carry `iso3` only), `zoomLevelsToOverscale` (vector tiles), `Hash`,
  `#pragma` (none used); the five `locale` keys the map overrides (same names
  in 6.14); style spec 25's warning on legacy filters (every filter here is an
  expression); `fitBounds`'s new `absolutePadding` (off by default) and
  padding now counted in the `maxBounds` constraint (6.12); `DOM.sanitize`
  (called only by the attribution control, off).

**Draw check** (production builds, `next start`). 5.24.0 was built from this
branch's `HEAD` exported to a scratch folder (the sibling worktree was in the
middle of a merge); both builds read the same live dataset (SHA-256 checked
before and after). Headless Chrome with SwiftShader (WebGL2 available), 1280 px
wide, `/en` and `/fr`, each in a fresh profile: load, hover a country, Region
= Africa, Right arrow twice, Down arrow twice, Region = all. After every step
6.14's map area matched 5.24's pixel for pixel, but for at most 4 pixels off by
1 in one colour channel (corner antialiasing; the same appears outside the
map). Each step changed 30,000 to 75,000 map pixels, so each did move it. The
whole world drew (504 x 360 canvas, drawn to every edge) with country fills
and both policy borders; hovering Nigeria showed its tooltip; Africa was framed
at 2.3×. Requests: all same-origin plus MapLibre's two `data:` icons; the
worker once, from `/launch-map/maplibre-gl-worker.mjs` (200,
`application/javascript`). Console: the example app's missing favicon only,
in both; 5.24 also logged SwiftShader "GPU stall due to ReadPixels" warnings,
6.14 none.

**One visible difference.** At 700 and 1600 px wide (map 620 and 798 px),
6.14 greys out "−" at the opening view where 5.24 left it active; clicking it
in 5.24 changed nothing (checked), as the view is already as far out as
`maxBounds` allows. 48 pixels, all in the icon. At 1280 px (504 px map) both
grey it; at 1920 px (1118 px map) neither does. Kept: MapLibre's fix, not
ours to undo.

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
  with the board's when that is ported: make it one tooltip. Done
  (decisions 43 and 45): the map speaks the page's language and shows its
  hints in the one `#tip`.
- Without the ported stylesheet, the keyboard country list shows as 235
  visible buttons; the page wraps the map in `.launch-dashboard` for it.
- Names sort with `localeCompare()` without a locale, as before: by the
  server's or browser's own default. A browser with an unusual default can
  then disagree with the server's render (a hydration mismatch). Dates
  (`toLocaleDateString`) likewise; `lib/format.ts` should settle both.
- Next.js serves `public/` with `max-age=0`: browsers re-check the 1.5 MB
  shapes file on every visit. RBM should cache it and the worker longer.
  But the worker's address carries no version: if it is cached long, the
  next MapLibre upgrade must rename it or add `?v=`, or browsers pair new
  page code with an old worker (MapLibre 6.13 versions only its own default
  address).
- **The worker is a module worker**: browsers refuse it unless it comes with
  a JavaScript content type. Next sends `application/javascript` for `.mjs`;
  RBM's host or CDN must too (an older nginx `mime.types` has no `.mjs`).
- `next build` (Turbopack) copies all six `.mjs` files of
  `maplibre-gl/dist` into `.next/static/media` (5.2 MB, two of them empty),
  as it reads MapLibre's default worker address as "any file there". The
  page never requests them (network log). Build output only.
- Since 6.x, a browser without WebGL2 shows no map at all (see the upgrade
  above); 5.x drew with WebGL1.
- `#tip` is already on the page twice, the pathway's (`components/pathway/Tip.tsx`)
  and the map's, so `getElementById("tip")` finds the pathway's. Found during
  the MapLibre draw check; not changed here.
- For RBM's content security policy: everything is same-origin (scripts,
  the CSS with MapLibre's in it, `fetch` of the shapes, the worker), plus
  `img-src data:` for MapLibre's +/- icons and inline style attributes, as
  today. Checked by logging every request in headless Chrome: none remote.
- `next dev` writes an `AGENTS.md` (Next.js 16 `agentRules`). Removed here;
  set `agentRules: false` or commit it.
- The golden test reads `en|fr|pt/data/world-map*.js`; when the static pages
  leave the branch it rebuilds them from the assets, and skips the
  extractor's freshness check.
- **Page frame: wiring for whoever joins the areas** (`feat/react-port-frame`).
  `DashboardFrame` takes `text` (`FRAME_TEXT[locale]`), `view`
  (`frameView(dataset, locale, text)`), `formsUrl` (`formsEnabled` since decision 61), `logoSrc`, `children`
  and `outside`. Nothing else is needed from other areas, and the frame
  calls back into none. `tracked()` is now in `lib/frame.ts`; the board and
  map should import it rather than port it again. (Since the Dashboard there
  is one copy, `lib/pathway.ts`'s, imported by all: decision 48.) `Banner` also takes
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
- ~~`NEXT_PUBLIC_LAUNCH_FORMS_URL` is read when a page is built: the
  pre-rendered pages keep the value set at `next build`.~~ Gone with decision
  60. Its successor, `formsEnabled()`, is still read when a page is built,
  and again at each 5-minute regeneration.

## Status

- **27 Oct 2026, map section.** `feat/react-port-map`, uncommitted: 29 tests
  pass (16 dataset, 11 golden, 2 assets), `tsc` and `next build` pass,
  `npm audit --omit=dev` 1 critical (maplibre-gl 5.24.0; closed by the
  MapLibre 6 upgrade, M5). Map drawn in headless Chrome
  (software GL) on the production build, `/en` and `/fr`.
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
- **27 Oct 2026, pathway** (branch `feat/react-port-pathway`,
  committed `ab9141a`, merged here; 85 tests pass): `components/pathway/` (`Pathway`, `PathwayStrip`, `StepPanel`,
  `GatePanel`, `CountryAccessKv`, `Tip` with `StagePeek`, `StatTip`, the
  icons, `Cites`, `fillNodes`, `layout.ts`, `text.ts` temporary),
  `lib/pathway.ts`, types in `lib/dataset.ts`, the two tests and
  `tests/golden-pathway/`, `public/launch-icons/who-emblem.svg`, and a marked
  example block on `app/[locale]/page.tsx` (`PathwayPreview.tsx`).
- **27 Oct 2026, page frame** (branch `feat/react-port-frame`, committed `98630ee`, merged here):
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
- **27 Oct 2026, board** (branch `feat/react-port-board`, committed `3f8ab91`, merged here): `lib/board.ts`,
  `components/board/` (`Board`, `ProductRow`, builders, hooks, `text.ts`),
  types added to `lib/dataset.ts`, the example page's board block, and
  `tests/golden-board.test.ts`, `tests/markup-board.test.ts` with
  `tests/golden-board/` and `tests/markup-board/`. 91 tests pass (45 + 46
  new); `tsc --noEmit` clean; `next build` passes with the board in `/en`,
  `/fr` and `/pt`. Not checked in a browser.
- **27 Oct 2026, MapLibre 6** (branch `feat/react-port-maplibre6`,
  committed `ae194bb`, merged here): maplibre-gl 6.14.0 (M5); `npm audit --omit=dev`
  0 vulnerabilities; 179 tests pass, as before; `tsc --noEmit` clean; `next
  build` passes; draw check in the Map section. Files: `package.json`,
  `package-lock.json`, `components/map/CountryMap.tsx`,
  `components/map/MapSection.tsx` (a comment), `app/[locale]/page.tsx`
  (`workerUrl`), `scripts/build-map-assets.mjs`, `tests/map-assets.test.ts`,
  `public/launch-map/maplibre-gl-worker.mjs` (new;
  `maplibre-gl-csp-worker.js` removed), `types/maplibre-gl-csp.d.ts`
  (removed), this file. The regenerated shapes and names came back
  byte-identical.
- **28 Oct 2026, message copy.** `messages/` now comes in through
  launch-development-test's `scripts/copy-rbm-messages.js` (branch
  `feat/rbm-messages`, `18f6a6d`): the first copy wrote only
  `messages/manifest.json`, since the three files already matched. The
  manifest records the source commit, `allow_stale` and the keys still in
  English; the next copy refuses to overwrite a file edited here by hand.
  `messages/README.md` corrected: it named four of the seven untranslated
  keys `download.*`; they are `product.procurement.*`. It now points to the
  manifest instead of repeating it.
- **28 Oct 2026, dashboard** (branch `feat/react-port-dashboard`, from
  `2869943`; committed `0b072ca`, merged here; the example page's map worker
  set to the 6.x `maplibre-gl-worker.mjs` at merge): `components/Dashboard.tsx`,
  `components/boardSlots.tsx`, `lib/ui-text.ts`, `lib/held-text.ts`; the
  tables in `lib/strings.ts` and `components/{pathway,board,frame,map}/text.ts`
  replaced by adapters (the tables are now `tests/fixtures/text/`, with
  `map-markup.ts`); one `tracked`/`colIndexOf`; the map on the shared `Tip`
  (`MapTooltip` removed); `statTipHandlers` limited to `#board`; the example
  app (`page.tsx`, `ExampleDashboard.tsx`, `error.tsx`; `PathwayPreview.tsx`
  and the temporary list deleted); `scripts/smoke.mjs`; tests
  `text-parity` (24) and `markup-dashboard` (25). 274 tests pass in 15
  files; `tsc --noEmit` clean; `next build` passes with `/en`, `/fr`, `/pt`
  pre-built; smoke test 58 of 58 checks on `/en` and `/fr` (screenshots kept
  outside the repo); no NUL bytes, no line-ending churn.
- **28 Oct 2026, side-by-side check** (step 5, on `feat/react-port`):
  decision 52 (`app/[locale]/layout.tsx`) and this file; method and results
  in "The side-by-side check" above. 274 tests pass, `tsc --noEmit` clean,
  `npm audit --omit=dev` 0, `next build` passes; smoke test re-run on the
  merged branch (maplibre-gl 6.14) with `SMOKE_LOCALES=en,fr,pt`: 87 of 87.
- **28 Oct 2026, held texts** (on `feat/react-port`): decision 53.
  `messages/` from launch-development-test `ae16ee6`; `lib/held-text.ts`
  deleted; `lib/ui-text.ts`, `components/map/text.ts`,
  `tests/text-parity.test.ts`, this file. 271 tests pass, `tsc --noEmit`
  clean, `npm audit --omit=dev` 0, `next build` passes; smoke test
  `SMOKE_LOCALES=en,fr,pt` 87 of 87; side-by-side text check as in decision
  53.
- **28 Oct 2026, the last 7 words** (on `feat/react-port`):
  launch-development-test PR #129 merged (`0902567`), its bot translated the
  7 (`e9aff92`, 0 failed), `feat/rbm-messages` took `main` in (`65b969e`) and
  built with nothing in English. `messages/` copied from `65b969e`
  (`manifest.json`: `allow_stale` false, `untranslated` empty). The parity
  test reported exactly 12 values, all from the 7 words (French 5: "Transactions"
  and "Packs" are spelled as in English), now in `CHANGED` (fr 6, pt 8 with
  the delayed count). 271 tests pass, `tsc --noEmit` clean, `npm audit
  --omit=dev` 0, `next build` passes, smoke test en, fr, pt 87 of 87. For
  the reviewer: "Packs" stays "Packs" in French and is "Pacotes" in
  Portuguese (Google; "Boîtes", "Embalagens" are the usual words).
- **28 Oct 2026, data per language** (on `feat/react-port`): decision 54.
  `lib/data.ts`, `lib/dataset.ts`, `tests/dataset.test.ts`, three fixtures,
  this file. Not yet online: needs launch-development-test
  `feat/data-per-language` merged and published first.
- **28 Oct 2026, words handed over** (on `feat/react-port`): decision 55.
  `messages/` from launch-development-test `b4cbc83` (`manifest.json`:
  clean, nothing untranslated), `messages/README.md`, `lib/messages.ts`, the
  five adapters, `components/Dashboard.tsx`, `components/board/Board.tsx`,
  `tests/messages.test.ts`, this file.
- **28 Oct 2026, static pages removed, README** (on `feat/react-port`):
  decision 56. `tsc --noEmit` clean; vitest 288 of 288 (Windows, with
  `--testTimeout=120000`: the markup tests take longer than 5 s on this
  machine). `next build` stops on the published address until the language
  files are published (404, as decision 54 says); built against the three
  fixtures served locally (`LAUNCH_DATA_URL=http://127.0.0.1:3125/dashboard.{locale}.json`),
  each page fetched its own language's file. Smoke test on that build,
  `SMOKE_LOCALES=en,fr,pt`: 85 of 87 on the first run, straight after the
  server started (the two failing checks were not kept), then 87 of 87 twice.
- **28 Oct 2026, the language files are published**: launch-development-test
  #131 (`c9b315c`) and #132 (`4d4625d`) merged, "Publish now" run
  40711081840, launch-data-test `e663da3` (`v1/dashboard.en/fr/pt.json`,
  `schema.lang.json`; data unchanged). Each online file equals
  `forLocale()` of the online `dashboard.json`. `next build` against the
  published address (no `LAUNCH_DATA_URL`) passes; each page shows its own
  language's stage names from those files; smoke test `SMOKE_LOCALES=en,fr,pt`
  87 of 87 on the first run.
- **28 Oct 2026, RBM's structure and Brazilian Portuguese** (decision 57):
  `messages/` from launch-development-test `11681f2` (after #133 and the
  bot's retranslation; nothing untranslated); `lib/messages.ts`,
  `lib/format.ts`, `lib/frame.ts`, `lib/map.ts`, `app/[locale]/layout.tsx`,
  the five harnesses, `tests/setup/european-portuguese.ts`,
  `tests/fixtures/messages/pt-PT.json`, `vitest.config.mts`,
  `tests/messages.test.ts`, `scripts/smoke.mjs`, both READMEs, this file.
  `tsc` clean, vitest 288 of 288, `next build` passes; `/pt` serves
  `<html lang="pt-BR">`, the metadata title and keywords, and Brazilian words.
  Smoke test: its language check now takes `pt-BR` for `pt`, and it waits
  150 ms between the two Escapes (sent at once, the second was sometimes lost:
  2 of 5 runs, a different language each time); then 87 of 87 three times.
  The published data is still European Portuguese until "Publish now" runs.
- **29 Oct 2026, the data route** (branch `feat/data-route`, from
  `feat/react-port` `408ed48`; decision 58): `app/api/unitaid/data/route.ts`
  (new), `lib/data.ts`, `app/[locale]/page.tsx`, `tests/data-route.test.ts`
  (new, 17 tests), `.env.example`, `README.md` ("Data route", the new
  address), this file. vitest 305 of 305 in 16 files (288 before); `tsc
  --noEmit` clean; `next build` passes against the new address (`/en`,
  `/fr`, `/pt` pre-built, revalidate 300; the route dynamic); smoke test
  `SMOKE_LOCALES=en,fr,pt` 87 of 87 on the first run. curl on `next start`:
  `?dataset=en`, `fr`, `pt` 200 (77,741, 88,540, 85,251 bytes); `xx`,
  `pt-BR`, `es` and no `dataset` 400. Each new test was seen failing when
  the code it covers was broken on purpose (502 → 503, the name check
  removed, the page's 300 → 600). No NUL bytes. Not pushed.
- **29 Oct 2026, the notifications route** (branch `feat/data-route`, a
  second commit; decision 59): `app/api/unitaid/notifications/route.ts` and
  `lib/notifications.ts` (new), `lib/data.ts` (`dataTag`, the tag on the
  fetch, `refreshDashboard()`), `tests/notifications.test.ts` (new, 52
  tests), `tests/data-route.test.ts` (the fetch now carries its tag),
  `.env.example` (`UNITAID_NOTIFY_TOKEN`, empty; its first line said nothing
  in it was a secret), `README.md` ("Notifications route"), this file.
  vitest 357 of 357 in 17 files (305 before); `tsc --noEmit` clean; `next
  build` passes (the route dynamic). The new tests were seen failing when
  the code was broken on purpose (no duplicate check; `"max"` for `{ expire:
  0 }`; no counting while reading; the body read before the token; no check
  of the new file). One test was wrong, not the code: it expected an
  `eventId` kept 1000 ms to be there at 1000 ms (the code, as documented,
  drops it then). curl on `next start`: 503 (no token set), 401 (no header,
  wrong token, wrong token with 2 MB), 413 (2 MB with a length, 2 MB
  chunked), 400 (not JSON; `"sample"`; an unknown type with no offset, both
  listed), 202, 200 duplicate, 502 (host at 500), 405 for GET; the v1 → v2
  proof in decision 59; against the real address, a notification for `en`:
  202, then `/en` `MISS`, then `HIT`. Smoke test `SMOKE_LOCALES=en,fr,pt`
  on that build: the first run hung after 73 checks, none failed (below);
  then 87 of 87 twice. No NUL bytes. Not pushed.
- **3 Nov 2026, the page changes of 3 Nov** (branch `feat/tracker-feedback`,
  from `feat/data-route` `d322190`; decision 60), two commits: the code and
  messages (`143ece9`), then the tests, fixtures, map names and READMEs.
  vitest 357 of 357 in 17 files; `tsc --noEmit` clean. Not pushed, and
  **cannot be pushed as it is**: every golden and markup test reads
  `ef0bd8c`, which exists only in this checkout (`scratch/pages-dale-jan`).
  Before the branch leaves this machine, the pages built from
  launch-development-test `b0f8675` (or later) must reach a pushed commit
  here (the usual pages PR to `main`), and the pins move to that commit
  (`--check` then confirms the references are unchanged). Not run:
  `next build`, the smoke test, a browser check of the radio views.
  `tests/fixtures/dashboard*.json` are still the 27–28 Oct dataset (the new
  one, with 20 register-confirmed countries for DHA–PPQ and 14 for ASPY, is
  not published): when it is, refresh them and re-run; every comparison
  feeds both sides the same file, so only the counts change.
  **Then, the same evening: pins on the real pages.** PR #34 here merged the
  pages built from launch-development-test `e3c7832` (after #135, #136,
  #139) with the data published as launch-data-test `3a88ec8`, as `main`
  `2f3d72c`. Every pin moved from `ef0bd8c` to `2f3d72c` (extractors,
  harnesses, `build-map-assets.mjs`, the references' headers); the
  re-extracted references differ from `ef0bd8c`'s only in the commit named
  in their header line, so the real pages are the ones the port was checked
  against. `tests/fixtures/dashboard{,.en,.fr,.pt}.json` are now the files
  published as `3a88ec8` (DHA–PPQ 20 / 11 / 5, ASPY 14 / 9 / 6). Messages
  from launch-development-test `main` `e3c7832` (PR #139; `map.panel.
  stageMixTitle` translated from the page's own reviewed words, so the
  text-parity entry for it went). vitest 357 of 357 in 17 files; `tsc
  --noEmit` clean. Checked in Chrome at 1440 and 390 px against a local copy
  of the new data (`next dev`, `LAUNCH_DATA_URL`): every map view's counts
  and note, the tooltips and country pages (Ghana, Nigeria), Reset, the
  Country access cards, the Market / Country Access columns, the timelines
  (ASPY since 2013 and 2018; DHA–PPQ 2010), French; no page errors. Not run:
  a real iPhone or Safari. The scratch branch is no longer needed.
  Later the same day: six planted bugs, each caught (`countryStages` not
  reading guidelines sources: golden-pathway and markup-pathway, 36 tests
  fail; `startedYear` placing the current gate: golden-board and
  markup-board, 39; Country Access "Not yet reached" without its `none`
  tone: markup-board, 21; the keyboard-list tooltip following the view, the
  country page's pill shown at No data, the legend hiding No data:
  golden-map, 3 each, one per language). `next build` against the new
  dataset, built locally and not published (served at
  `LAUNCH_DATA_URL=http://127.0.0.1:3125/dashboard.{locale}.json`): passes,
  `/en`, `/fr`, `/pt` pre-built; `/en` opens on ASPY's Registered view, 14
  countries, the Country access cards read 14 and 20 confirmed in national
  registers, "since 2013" and "since 2018" on ASPY's timeline, three radio
  buttons, the new disclaimer sentence; `/fr` and `/pt` show "Access stages
  · ASPY" in English (above). Pages served, not opened in a browser. Data
  text the Brazilian pages do not control: the preview dataset's pt still
  writes "Vietname" in two findings.
- **3 Nov 2026, the forms' relays** (decision 61). Branch `feat/forms-relay`
  from `feat/data-route` `d322190`, not pushed, uncommitted: 391 tests pass
  (357 + 34 new); `tsc --noEmit` is clean; `next build` passes with the
  forms' two settings unset (no Subscribe, Send not connected, in en, fr and
  pt) and with dummy values (Subscribe present, Send connected; neither value
  in `.next/static` or the built pages). There is no lint script. The
  browser run, against the forms service on localhost, is a separate check.
- **Next:** ~~the README for RBM (step 6)~~ written 28 Oct at the owner's
  request (decision 56; it says to load Source Sans 3). A check on a real
  iPhone and in Safari. Publish the language files, then build against the
  published address.
- **Questions for RBM, added:** which library is behind `i18n.ts` (placeholder
  form `{name}` or `{{name}}`); and, if their own Next.js is on 16.x, that it
  is 16.4.1 or later (decision 2).
- **Questions for RBM, from the data route (decision 58):** are the dataset
  names `en`, `fr`, `pt` what the module should take (the spec names none;
  `pt-BR` is refused)? Should the 5 minutes be a setting, or is the default
  enough?
- **Questions for RBM/UNOPS, from the notifications route (decision 59):**
  the spec's example dataset, `"sample"`, looks like a placeholder: we take
  `en`, `fr`, `pt`, one notification per language; agreed? Does the
  dashboard run as one server process or several (several need a shared
  cache handler for a notification to reach all of them)? Are 503 (no token
  set) and 502 (the new file cannot be read; nothing changed), which the
  spec does not list, acceptable? Is 1 MB 1,048,576 bytes for them too?
