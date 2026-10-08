# LAUNCH dashboard — pages for the RBM platform

**Live test copy:** [start page](https://codebyjackson.github.io/launch-rbm-test/)
· [English](https://codebyjackson.github.io/launch-rbm-test/en/)
· [Français](https://codebyjackson.github.io/launch-rbm-test/fr/)
· [Português](https://codebyjackson.github.io/launch-rbm-test/pt/)
· [Español](https://codebyjackson.github.io/launch-rbm-test/es/)
· [iframe test in a mock RBM platform](https://codebyjackson.github.io/launch-rbm-test/iframe-test.html)
· data: [dashboard.json](https://codebyjackson.github.io/launch-data-test/v1/dashboard.json)

The LAUNCH illustrated journey dashboard, one static page per language, for
embedding on dashboards.endmalaria.org. The pages hold no data of their own:
each fetches the approved dataset at runtime, so a data update never needs a
redeploy here.

```
en/index.html   fr/index.html   pt/index.html   es/index.html     the four pages
{en,fr,pt,es}/data/world-map.js, world-map-geo.js  country shapes, with that language's
                                                    country names (static)
{en,fr,pt,es}/assets/report-issue.js                the feedback form, in that language
assets/                                             icons and logos (shared)
```

The platform has /en, /fr and /pt routes today. The Spanish page (es/) is
ready for a /es route if one is added; until then it can be linked directly.

Data: `https://codebyjackson.github.io/launch-data-test/v1/dashboard.json`
(contract and change rules: the README of that repository). Map rendering uses
MapLibre GL JS from cdnjs.cloudflare.com.

The pages follow the RBM Dashboard Design Guidelines v1.0
(dashboards.endmalaria.org/design-guidelines): RBM Blue for actions, white cards
on the #EDF2F9 canvas, Roboto and Poppins, the default map ramp. Fonts load from
Google Fonts; to self-host them instead, swap the fonts.googleapis.com link at
the top of each page.

## Hosting

Any static host works (the files are plain HTML, JS and SVG; no build step).
Serve the folder as it is; each page loads the shared `../assets/` and its own
`data/` and `assets/report-issue.js` beside it.

Allow framing by the RBM platform only — for example as a response header:

```
Content-Security-Policy: frame-ancestors https://dashboards.endmalaria.org
```

The pages make five kinds of outbound request, all from the reader's browser:
the dataset (GitHub Pages, above), MapLibre (cdnjs), the fonts
(fonts.googleapis.com and fonts.gstatic.com), the map shapes (same host as
the pages), and, when a reader uses Subscribe or Send feedback, the LAUNCH
project's email service (below). A content security policy sent with these
pages, by whatever host serves them, must allow all five. The platform's own
policy governs only its page: it must allow framing the pages' host
(`frame-src`), and does not apply to requests made from inside the frame.

## Embedding

One iframe per language route, **sized to the screen, not to the page**: let
it fill the space below the platform's header, as the platform already does
for the WHO Malaria Threats Map (`class="w-full flex-1 min-h-0"` in a column
one screen tall), with a minimum of about 480px. The dashboard then scrolls
inside the frame.

```html
<!-- /en, in a column one screen tall (e.g. display:flex; flex-direction:column; height:100dvh) -->
<iframe src="https://<host>/en/" title="LAUNCH dashboard" class="w-full flex-1 min-h-0" style="border:0;min-height:480px" loading="lazy"></iframe>
<!-- /fr -->
<iframe src="https://<host>/fr/" title="Tableau de bord LAUNCH" class="w-full flex-1 min-h-0" style="border:0;min-height:480px" loading="lazy"></iframe>
<!-- /pt -->
<iframe src="https://<host>/pt/" title="Painel LAUNCH" class="w-full flex-1 min-h-0" style="border:0;min-height:480px" loading="lazy"></iframe>
<!-- /es, if the platform adds it -->
<iframe src="https://<host>/es/" title="Panel LAUNCH" class="w-full flex-1 min-h-0" style="border:0;min-height:480px" loading="lazy"></iframe>
```

**Do not give the frame a fixed height taller than the screen** (for example
`height:2400px`, which an earlier version of this README suggested). The
"Send feedback" button and its dialog are positioned within the frame, so in
a frame taller than the screen the button sits below the visible area until
the reader scrolls to the frame's end, and the dialog opens out of view.
Sized to the screen, the button stays in the bottom corner while the reader
scrolls. `iframe-test.html` in this folder shows it working.

## What readers see when something is wrong

- **The dataset cannot be fetched:** a notice that the data could not be
  loaded, and nothing else drawn — never a half-rendered chart.
- **The dataset's `schema_version` is not 1** (a breaking change has been
  published under `v2/`): a notice that the dashboard is being updated, until
  these pages are updated to read the new version.
- **Subscribe or Send feedback cannot reach the email service** (it is down,
  or the host serving these pages is not yet on its list): the form says it
  could not send just now, and keeps what the reader typed.

## Differences from the LAUNCH site

- No site menu (its other pages are not part of this handover; the platform
  has its own navigation).
- "Subscribe for updates" and "Send feedback" work as on the LAUNCH site, but
  post to the LAUNCH project's own email service at
  `https://launch-development-test.vercel.app/api/` rather than to this host,
  which has none. That service accepts them only from hosts on its list
  (`PARTNERS` in the LAUNCH repository's `api/_mail.js`). Today the list holds
  the two copies of the test repository: `https://codebyjackson.github.io`
  (GitHub Pages) and `https://launch-rbm-test.vercel.app` (Vercel). **Every
  host that serves these pages needs its own entry, test and staging
  included: tell the LAUNCH team each host's address** (scheme and domain,
  e.g. `https://dashboards.endmalaria.org`) before readers use it. On a host
  that is not listed, both forms show their "could not send" message to
  every reader.
  Subscribers' addresses and feedback go to the LAUNCH team, and the emails
  are in English.

## Rebuilding

These files are generated in the LAUNCH pipeline repository by
`node scripts/build-rbm-pages.js` from the same page as the LAUNCH site, so a
fix there reaches here on the next build. Do not edit them by hand.
`--api-url` sets where the two forms post (default: the LAUNCH production
site); `--api-url none` builds them switched off, as they were until
7 Oct 2026.
