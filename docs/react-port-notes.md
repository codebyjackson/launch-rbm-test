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
28. **One setting for both forms, and no default.** `formsEndpoints()` builds
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
    worked out on the server, `formsUrl`, and `assets` (logo, WHO emblem,
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
    text in all three files).
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

## Deferred, and found on the way

- `app/` is the example app only, to prove the data path. RBM takes the
  components (step 3), not this app.
- The error page and the "being updated" notice are English only until the
  message files exist (step 2). Done: the frame's `Banner`, in the page's
  language (decision 50).
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
- **For launch-development-test's message pipeline:** the 37 held texts need
  keys in `i18n/ui.en.json` (list in decision 43 and `lib/held-text.ts`),
  and the 36 French apostrophes need a decision (typographic ’ or straight
  '). Each entry then comes out of `lib/held-text.ts`, and the parity test
  says so.
- `product.accessLine` could feed `accessLine()`; not wired, as it would
  change a golden-tested function's inputs for the same text.
- The board still works out its own `stageContext` and `tracked` list from
  `data` (its props take the dataset); the Dashboard works out the same for
  the strip. Same inputs, same values, computed twice.
- The browser check covers `/en` and `/fr`, not `/pt` (`SMOKE_LOCALES=pt`
  runs it), nor narrow screens, switching journey views, the timeline fit,
  the forks or the forms' sends. It needs `NEXT_PUBLIC_LAUNCH_FORMS_URL` set
  at `next build`, or the Subscribe check fails by design.
- If 20.4 KB of gzipped text in the browser matters (decision 42): pass the
  text in, and give `lib/stages.ts` its words through the context; the
  golden tests' calls would change with it.
- At the merge with MapLibre 6.14: the example page's `ASSETS.mapWorker`
  becomes `/launch-map/maplibre-gl-worker.mjs`. Nothing in the Dashboard.
- The example app has no icon: Chrome logs a `/favicon.ico` 404.

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
  (`frameView(dataset, locale, text)`), `formsUrl`, `logoSrc`, `children`
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
- `NEXT_PUBLIC_LAUNCH_FORMS_URL` is read when a page is built: the
  pre-rendered pages keep the value set at `next build`.

## Status

- **27 Oct 2026, map section.** `feat/react-port-map`, uncommitted: 29 tests
  pass (16 dataset, 11 golden, 2 assets), `tsc` and `next build` pass,
  `npm audit --omit=dev` 1 critical (M5). Map drawn in headless Chrome
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
  `/fr` and `/pt`. Not committed; not checked in a browser.
- **28 Oct 2026, dashboard** (branch `feat/react-port-dashboard`, from
  `2869943`; uncommitted, not pushed): `components/Dashboard.tsx`,
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
- **Next:** merge with `feat/react-port` (MapLibre 6.14: the example's
  worker address); the held and kept texts to launch-development-test; RBM's
  staging server (CSP, the fence, fixed hints inside their layout).
- **Questions for RBM, added:** which library is behind `i18n.ts` (placeholder
  form `{name}` or `{{name}}`); and, if their own Next.js is on 16.x, that it
  is 16.4.1 or later (decision 2).
