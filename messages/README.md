# Interface text: do not edit here

`en.json`, `fr.json` and `pt.json` are generated in `launch-development-test`
from `i18n/ui.en.json` by `scripts/build-rbm-messages.js`, and copied in by
`scripts/copy-rbm-messages.js`. To change wording, change `i18n/ui.en.json`
there: the translate bot translates it and a reviewer approves it.

Every file follows the rules of RBM's module repository (`rbm-module-unitaid`,
its `scripts/check-contract.mjs`): `Sidebar.partners_subitem_unitaid` and
`Sidebar.partners_subitem_unitaid_tooltip` (the module's menu entry), then
`Unitaid`, with the page's `title` and `metadata` and all the messages under
it, indented with tabs (its Biome format check). There they go in
`src/app/[locale]/unitaid/i18n/`, and its `i18n.ts` (next-intl) merges them
into RBM's own messages without colliding with RBM's keys. Portuguese is
Brazilian. RBM's
page hands the dashboard its part, `messages.Unitaid`, through `<Dashboard text>`
(and `provideMessages()` on the server, `lib/messages.ts`). This folder is the
fallback, message by message: anything RBM's copy lacks or has broken shows
our own text.

`manifest.json` records the current copy: the commit it was built from,
whether the build allowed untranslated strings (`allow_stale`), the keys still
in English per language (`untranslated`), and each file's sha256. The copy
script compares the files with those hashes and refuses to overwrite one that
was edited here by hand, so an edit made here is caught rather than lost.

Placeholders are `{name}`, which next-intl reads as they are: next-intl 3.26.5,
RBM's, read all 336 keys in all three files exactly as written (4 Nov 2026, in
`rbm-module-unitaid`).
