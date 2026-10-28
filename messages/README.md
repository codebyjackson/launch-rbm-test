# Interface text: do not edit here

`en.json`, `fr.json` and `pt.json` are generated in `launch-development-test`
from `i18n/ui.en.json` by `scripts/build-rbm-messages.js`, and copied in by
`scripts/copy-rbm-messages.js`. To change wording, change `i18n/ui.en.json`
there: the translate bot translates it and a reviewer approves it.

Every file follows RBM's sample structure: `Sidebar.unitaid` and
`Sidebar.unitaid_tooltip` (the module's menu entry), then `Unitaid`, with the
page's `title` and `metadata` and all the messages under it, so the files can
be merged into RBM's own `en.json`, `fr.json` and `pt.json` (next-intl,
`i18n.ts`) without colliding with RBM's keys. Portuguese is Brazilian. RBM's
page hands the dashboard its part, `messages.Unitaid`, through `<Dashboard text>`
(and `provideMessages()` on the server, `lib/messages.ts`). This folder is the
fallback, message by message: anything RBM's copy lacks or has broken shows
our own text.

`manifest.json` records the current copy: the commit it was built from,
whether the build allowed untranslated strings (`allow_stale`), the keys still
in English per language (`untranslated`), and each file's sha256. The copy
script compares the files with those hashes and refuses to overwrite one that
was edited here by hand, so an edit made here is caught rather than lost.

Placeholders are `{name}`, which next-intl reads as they are: next-intl 3.15.2
read all 319 keys in all three files exactly as written (28 Oct 2026).
