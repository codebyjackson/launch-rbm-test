# Interface text: do not edit here

`en.json`, `fr.json` and `pt.json` are generated in `launch-development-test`
from `i18n/ui.en.json` by `scripts/build-rbm-messages.js`, and copied in. A
hand edit here is overwritten by the next copy. To change wording, change
`i18n/ui.en.json` there: the pipeline translates it and a reviewer approves it.

Current copy: `feat/rbm-messages` at `280ad5d` (27 Oct 2026), built with
`--allow-stale`. Seven strings have no French or Portuguese translation yet and
are in English in all three files (the same seven already show in English on
today's /fr and /pt pages): `download.presentation`, `download.transactions`,
`download.packs`, `download.notEstimated`, `map.panel.donutUnitOne`,
`map.panel.donutUnitOther`, `tooltip.dataStatus`.

Placeholders are `{name}`. RBM's `i18n.ts` library decides the final form
(next-intl reads `{name}`; i18next's default is `{{name}}`), so the files may
be reshaped once RBM sends its structure.
