# LAUNCH dashboard — pages for the RBM platform

**Live test copy:** [start page](https://codebyjackson.github.io/launch-rbm-test/)
· [English](https://codebyjackson.github.io/launch-rbm-test/en/)
· [Français](https://codebyjackson.github.io/launch-rbm-test/fr/)
· [Português](https://codebyjackson.github.io/launch-rbm-test/pt/)
· [iframe test in a mock RBM platform](https://codebyjackson.github.io/launch-rbm-test/iframe-test.html)
· data: [dashboard.json](https://codebyjackson.github.io/launch-data-test/v1/dashboard.json)

The LAUNCH illustrated journey dashboard, one static page per language, for
embedding on dashboards.endmalaria.org. The pages hold no data of their own:
each fetches the approved dataset at runtime, so a data update never needs a
redeploy here.

```
en/index.html   fr/index.html   pt/index.html     the three pages
{en,fr,pt}/data/world-map.js, world-map-geo.js     country shapes, with that language's
                                                    country names (static)
{en,fr,pt}/assets/report-issue.js                   the feedback form, in that language
assets/                                             icons and logos (shared)
```

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

One iframe per language route:

```html
<!-- /en -->
<iframe src="https://<host>/en/" title="LAUNCH dashboard" style="width:100%;height:2400px;border:0" loading="lazy"></iframe>
<!-- /fr -->
<iframe src="https://<host>/fr/" title="Tableau de bord LAUNCH" style="width:100%;height:2400px;border:0" loading="lazy"></iframe>
<!-- /pt -->
<iframe src="https://<host>/pt/" title="Painel LAUNCH" style="width:100%;height:2400px;border:0" loading="lazy"></iframe>
```

The page's height changes as readers open rows; a fixed height with the
iframe scrolling inside it is the simplest option.

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
  `https://codebyjackson.github.io`, the test copy. **When RBM serves these
  pages from its own host, tell the LAUNCH team the host's address** (scheme
  and domain, e.g. `https://dashboards.endmalaria.org`) so it can be added;
  until then both forms show their "could not send" message there.
  Subscribers' addresses and feedback go to the LAUNCH team, and the emails
  are in English.

## Rebuilding

These files are generated in the LAUNCH pipeline repository by
`node scripts/build-rbm-pages.js` from the same page as the LAUNCH site, so a
fix there reaches here on the next build. Do not edit them by hand.
`--api-url` sets where the two forms post (default: the LAUNCH production
site); `--api-url none` builds them switched off, as they were until
7 Oct 2026.
