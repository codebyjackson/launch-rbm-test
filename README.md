# LAUNCH dashboard — pages for the RBM platform

**Live test copy:** [start page](https://codebyjackson.github.io/launch-rbm-test/)
· [English](https://codebyjackson.github.io/launch-rbm-test/en/)
· [Français](https://codebyjackson.github.io/launch-rbm-test/fr/)
· [Português](https://codebyjackson.github.io/launch-rbm-test/pt/)
· [iframe test](https://codebyjackson.github.io/launch-rbm-test/iframe-test.html)
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

## Hosting

Any static host works (the files are plain HTML, JS and SVG; no build step).
Serve the folder as it is; each page loads the shared `../assets/` and its own
`data/` and `assets/report-issue.js` beside it.

Allow framing by the RBM platform only — for example as a response header:

```
Content-Security-Policy: frame-ancestors https://dashboards.endmalaria.org
```

The pages make three kinds of outbound request, all from the reader's browser:
the dataset (GitHub Pages, above), MapLibre (cdnjs), and the map shapes (same
host as the pages). A content security policy on the platform must allow the
first two.

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

## Differences from the LAUNCH site

- No site menu (its other pages are not part of this handover; the platform
  has its own navigation).
- No "Subscribe for updates" (its email service runs on the LAUNCH project's
  own hosting and is not included).
- "Send feedback" is not connected: Send is blocked, and the dialog says so.
  On the LAUNCH site it emails the team through the same hosting as
  Subscribe, which is not included.

## Rebuilding

These files are generated in the LAUNCH pipeline repository by
`node scripts/build-rbm-pages.js` from the same page as the LAUNCH site, so a
fix there reaches here on the next build. Do not edit them by hand.
