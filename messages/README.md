# Interface text: do not edit here

`en.json`, `fr.json` and `pt.json` are generated in `launch-development-test`
from `i18n/ui.en.json` by `scripts/build-rbm-messages.js`, and copied in by
`scripts/copy-rbm-messages.js`. To change wording, change `i18n/ui.en.json`
there: the pipeline translates it and a reviewer approves it.

`manifest.json` records the current copy: the commit it was built from,
whether the build allowed untranslated strings (`allow_stale`), the keys still
in English per language (`untranslated`), and each file's sha256. The copy
script compares the files with those hashes and refuses to overwrite one that
was edited here by hand, so an edit made here is caught rather than lost.

Placeholders are `{name}`. RBM's `i18n.ts` library decides the final form
(next-intl reads `{name}`; i18next's default is `{{name}}`), so the files may
be reshaped once RBM sends its structure.
