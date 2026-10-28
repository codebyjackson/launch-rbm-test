# LAUNCH dashboard: React components for RBM's Next.js site

The LAUNCH malaria product launch dashboard as React components, for the RBM
Partnership to End Malaria's site (dashboards.endmalaria.org). This repository
holds the components and a small example app that shows them working
(`app/[locale]/`). The data comes from an API and updates itself; the
interface text comes as one JSON file per language for your `i18n.ts`.

Languages: English (`en`), French (`fr`), Portuguese (`pt`).

## Requirements

| | Version | Notes |
|---|---|---|
| Node.js | 20.9 or later | |
| Next.js | 16.4.3 | If your site runs 16.x, use 16.4.1 or later: 16.0.0 to 16.4.0 have published security advisories (GHSA-2464-fhr4-w9xw, GHSA-673q-mjm6-r5xr, GHSA-p3m5-59mp-jv5r). |
| React | 19.3.0 | |
| maplibre-gl | 6.14.0 | From npm, as a dependency. |
| next-intl | not used by the components | Your `i18n.ts` loads our message files; see "Interface text". |

Every version is pinned exactly in `package.json`. If your site runs an older
Next.js or React, tell us which, so we can test the components on it.

## Try it

```bash
npm ci
npm run dev          # http://localhost:3000 → /en, /fr, /pt
npm test             # unit, golden and markup tests (vitest)
npm run typecheck
npm run build
```

`NEXT_PUBLIC_LAUNCH_FORMS_URL` (set at build time) is the address of the
Subscribe and Send feedback forms. Without it, Subscribe is hidden and Send
feedback shows as not connected.

## What to copy into your app

| Folder or file | What it is |
|---|---|
| `components/` | The dashboard. `components/Dashboard.tsx` is the one to place on a page. |
| `lib/` | Data loading, stage rules, map logic, the text adapters. |
| `messages/` | The interface text, `en.json`, `fr.json`, `pt.json` (see below). |
| `styles/launch-dashboard.css` | The dashboard's styles. Import it once, for example in your layout. Every rule is scoped under `.launch-dashboard`, so it does not touch your page. (`styles/feedback.css` is imported by the feedback form itself.) |
| `public/launch-map/` | The map's shapes (`world-shapes.json`) and MapLibre's worker (`maplibre-gl-worker.mjs`, served as JavaScript). |
| `public/launch-icons/`, `public/assets/` | The WHO emblem and the Unitaid logo. |

Imports use the `@/` alias for this repository's root (`tsconfig.json`
`paths`). Map `@/` to wherever you put these folders, or adjust the imports.

**Font.** The dashboard is set in Source Sans 3. Load it on your page (Google
Fonts, or `next/font`), or the text falls back to Arial and every line wraps
differently.

## Placing the dashboard on a page

The example app's page, `app/[locale]/page.tsx`, is the pattern: a server
component loads the data and works out what the frame and the map show; the
`Dashboard` (a client component) does the rest. In your app, with next-intl:

```tsx
// app/[locale]/launch/page.tsx (a server component)
import { getMessages } from "next-intl/server";
import { Dashboard } from "@/components/Dashboard";
import { frameText } from "@/components/frame/text";
import { frameView } from "@/components/frame/view";
import { getDashboard } from "@/lib/data";
import { mapInput } from "@/lib/map";
import { mapCountries } from "@/lib/map-countries";
import { provideMessages } from "@/lib/messages";

export const revalidate = 600; // check for new data every 10 minutes

export default async function LaunchPage({ params }: { params: Promise<{ locale: "en" | "fr" | "pt" }> }) {
  const { locale } = await params;
  const text = (await getMessages()).launchDashboard; // our part of your messages
  provideMessages(locale, text);                       // before frameText()
  const ds = await getDashboard(locale);
  return (
    <Dashboard
      locale={locale}
      text={text}
      data={ds.data}
      sources={ds.sources.sources}
      frameView={frameView(ds, locale, frameText(locale))}
      mapInput={mapInput(ds, mapCountries(locale), locale)}
      formsUrl={process.env.NEXT_PUBLIC_LAUNCH_FORMS_URL}
      assets={{
        logo: "/assets/unitaid-logo.svg",
        whoEmblem: "/launch-icons/who-emblem.svg",
        mapShapes: "/launch-map/world-shapes.json",
        mapWorker: "/launch-map/maplibre-gl-worker.mjs",
      }}
    />
  );
}
```

`assets` are the addresses where you serve the files in `public/`.
`initialProduct` and `onProductChange` (optional) let your router carry an
opened medicine in the address; `app/[locale]/ExampleDashboard.tsx` shows one
way. The example page also shows how to handle a dataset the code does not
know (`DatasetError`, kind `"schema"`): a "being updated" notice in the page's
language.

## Interface text (your `i18n.ts`)

`messages/en.json`, `fr.json` and `pt.json` each hold one key,
`launchDashboard`, with all 313 messages under it. Merge them into your own
message files: under that one key they cannot collide with yours. Then pass
that part to the dashboard as `text`, and call `provideMessages()` on the
server, as above.

- Placeholders are `{name}`, which next-intl reads as they are. next-intl
  3.15.2 read all 313 messages in all three files exactly as written.
- Each message you pass is used when it is text with the same `{placeholders}`
  as ours. Anything missing or broken shows our own copy (the files in
  `messages/`), so the dashboard never shows a blank or a raw key.
- Leave `text` out and the dashboard uses its own copy.
- Do not change the wording in these files by hand: the next update replaces
  them. Ask the LAUNCH team; the change goes through their translation and
  approval process, and you receive new files.

## Data

`getDashboard(locale)` (`lib/data.ts`, server only) reads one file per
language from the published dataset:

```
https://codebyjackson.github.io/launch-data-test/v1/dashboard.en.json
https://codebyjackson.github.io/launch-data-test/v1/dashboard.fr.json
https://codebyjackson.github.io/launch-data-test/v1/dashboard.pt.json
```

It reads it on your server and checks for a new version every 10 minutes, so
an approved data change reaches the page with nobody involved, and visitors'
browsers never contact the data host. If the host cannot be reached, Next.js
keeps serving the last page it built. `LAUNCH_DATA_URL` changes the address
(`{locale}` becomes the language). The format is described in the data
repository's README and in `v1/schema.lang.json` there.

## Updates from the LAUNCH team

- **Data:** automatic, as above.
- **Interface text:** new `messages/` files, built and translated by the
  LAUNCH pipeline. `messages/manifest.json` records which build they come
  from.
- **Components:** new versions of this repository.

## For the LAUNCH team

`docs/react-port-notes.md` records every decision behind the port, with the
tests that prove the components show what the earlier static pages showed.
Those pages left this branch on 28 Oct 2026; the tests read them from git
(commit `7c1bf11`).
