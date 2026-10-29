# LAUNCH dashboard: React components for RBM's Next.js site

The LAUNCH malaria product launch dashboard as React components, for the RBM
Partnership to End Malaria's site (dashboards.endmalaria.org). This repository
holds the components and a small example app that shows them working
(`app/[locale]/`). The data comes from an API and updates itself; the
interface text comes as one JSON file per language for your `i18n.ts`.

Languages: English (`en`), French (`fr`), Portuguese (`pt`, Brazilian: words,
country names, dates and numbers).

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
| `app/api/unitaid/data/route.ts` | The data route, `GET /api/unitaid/data` (see "Data route"). Copy it to the same path in your `app/`. |
| `app/api/unitaid/notifications/route.ts` | The notifications route, `POST /api/unitaid/notifications` (see "Notifications route"). Copy it to the same path in your `app/`. |

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

export const revalidate = 300; // check for new data every 5 minutes (lib/data.ts REVALIDATE)

export default async function LaunchPage({ params }: { params: Promise<{ locale: "en" | "fr" | "pt" }> }) {
  const { locale } = await params;
  const text = (await getMessages()).Unitaid;         // our part of your messages
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

`messages/en.json`, `fr.json` and `pt.json` follow the structure of your sample
files, with the same keys in all three:

| Key | What it is |
|---|---|
| `Sidebar.unitaid`, `Sidebar.unitaid_tooltip` | The module's menu entry and its tooltip. |
| `Unitaid.title` | The page's title. |
| `Unitaid.metadata` | `title`, `description` and `keywords` for the page's `<head>`. Your name stays in English in the title, and the keywords are the same English list in every language, as in your sample. |
| `Unitaid.*` (everything else) | The dashboard's 313 messages, by component area (`header`, `subscribe`, `board`, `map`, …). |

Merge them into your own message files: under `Unitaid` our messages cannot
collide with yours. Then pass `Unitaid` to the dashboard as `text`, and call
`provideMessages()` on the server, as above. The example app
(`app/[locale]/layout.tsx`) shows `Unitaid.metadata` used as the page's
metadata.

- Placeholders are `{name}`, which next-intl reads as they are. next-intl
  3.15.2 read all 319 keys in all three files exactly as written.
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
https://quantum-sage-technologies.github.io/unitaid-launch-data/v1/dashboard.en.json
https://quantum-sage-technologies.github.io/unitaid-launch-data/v1/dashboard.fr.json
https://quantum-sage-technologies.github.io/unitaid-launch-data/v1/dashboard.pt.json
```

It reads it on your server and checks for a new version every 5 minutes, so
an approved data change reaches the page with nobody involved, and visitors'
browsers never contact the data host. If the host cannot be reached, Next.js
keeps serving the last page it built. `LAUNCH_DATA_URL` changes the address
(`{locale}` becomes the language). The format is described in the data
repository's README and in `v1/schema.lang.json` there.

**The data repository has moved** (found 29 Oct 2026): it is now
`Quantum-Sage-Technologies/unitaid-launch-data`, and was
`codebyjackson/launch-data-test`. GitHub Pages does not redirect: the old
address (`https://codebyjackson.github.io/launch-data-test/…`) answers 404. If
you set `LAUNCH_DATA_URL` to it, change it or remove it (the default above is
the new address).

## Data route

`GET /api/unitaid/data?dataset=<name>` (`app/api/unitaid/data/route.ts`), the
data route of your module spec (2a). It reads the dataset on your server
through `getDashboard()` and returns it as JSON: the browser never contacts
the data host.

| | |
|---|---|
| `dataset` | `en`, `fr` or `pt`, the dashboard's languages (`lib/locales.ts`), exactly so (`pt-BR` is the page's language tag, not a dataset name). |
| **200** | The dataset in that language: what `getDashboard()` returns, the shape the `Dashboard` takes (`Localized` in `lib/dataset.ts`: `data`, `sources`, `treatmentPolicy`, `dataset`). |
| **400** | `dataset` missing or not one of the three: `{"error": "dataset is required"}` or `{"error": "unknown dataset"}`, each with `"datasets": ["en", "fr", "pt"]`. |
| **502** | The source cannot be used: `{"error": "source unavailable", "kind": "unavailable"}` when it cannot be reached, answers an HTTP error or is not JSON; `"kind": "schema"` when it is in a format this version does not read (the page shows "being updated" then). The reason, with the source's address, goes to your server log (`[LAUNCH] data route: …`), not to the browser. |

**Cache: 5 minutes, on your server** (`REVALIDATE` in `lib/data.ts`). The
route itself runs on every request; the fetch inside it is kept in Next.js's
server-side data cache, which the page shares, so the route and the page cost
the data host at most one request per language every 5 minutes. After 5
minutes the next request still gets the cached copy at once while Next.js
fetches a new one behind it. Two consequences:

- Once a language has been read, a data host that is down does not turn into
  a 502: the route goes on answering 200 with the last good copy, as the page
  keeps its last good page, and tries the host again on each later request.
  A 502 means the host is down and this server has no good copy of that
  file at all: `LAUNCH_DATA_URL` names an address it has never read, or
  `.next/cache` was emptied.
- The cache is kept on disk (`.next/cache`), so a restart of the same build
  keeps it, and `next build` stores a copy of each file it reads.

The responses carry no `Cache-Control` header: nothing asks a browser or a CDN
to keep them. The example page does not call the route. It calls
`getDashboard()` directly, as your page can: same data, same cache, no extra
network hop, and `next build` has no running server to call.

A notification (next section) refreshes one language at once instead of
within 5 minutes.

## Notifications route

`POST /api/unitaid/notifications` (`app/api/unitaid/notifications/route.ts`),
the notifications route of your module spec (2b). The LAUNCH pipeline calls it
after it publishes the dataset, so the page and the data route show the new
data on the very next request.

**Token.** Make one with `openssl rand -hex 32` and set it on your server as
`UNITAID_NOTIFY_TOKEN` (in `.env.local`, which git ignores, or in your host's
environment); give the same value to the LAUNCH team by a private channel.
Never commit it and never put it in a `NEXT_PUBLIC_` setting, which is copied
into visitors' browsers. It is read on each request, so setting or changing it
needs no new build. Without it every notification is refused.

**Request.**

```http
POST /api/unitaid/notifications
Authorization: Bearer <token>
Content-Type: application/json

{ "eventId": "evt-001", "type": "dataset.updated",
  "occurredAt": "2026-10-27T12:00:00Z", "data": { "dataset": "en" } }
```

| Field | Rule |
|---|---|
| `eventId` | Text, not empty, at most 256 characters. The same event sent again keeps its `eventId`. |
| `type` | `dataset.updated`, the only type there is. |
| `occurredAt` | An ISO 8601 date and time with its offset (`Z` or `+02:00`). |
| `data.dataset` | `en`, `fr` or `pt`, as for the data route: one notification refreshes one language. |

Other fields are ignored.

**Responses**, checked in this order, so a request without the token costs
nothing:

| Status | Body | When |
|---|---|---|
| **503** | `{"error": "notifications are not configured"}` | `UNITAID_NOTIFY_TOKEN` is not set. |
| **401** | `{"error": "invalid token"}` | No `Authorization: Bearer`, or the wrong token. The body is not read. |
| **413** | `{"error": "body larger than 1 MB"}` | Over 1 MB (1,048,576 bytes), by its `Content-Length` or counted while reading (a chunked body has no length). |
| **400** | `{"error": "invalid body", "problems": [...]}` | Not JSON, or a field missing or wrong; every problem is listed. |
| **200** | `{"accepted": true, "duplicate": true, "eventId": ...}` | This `eventId` was already received. Nothing is done. |
| **502** | `{"error": "source unavailable", "kind": ...}` | The new file cannot be read or used. The cache is left as it was, so the dashboard keeps its last good data; send the same event again later. |
| **202** | `{"accepted": true, "duplicate": false, "eventId": ..., "dataset": ...}` | Accepted, cache refreshed. |

**What a 202 does.** The route reads that language's file from the data host
past the cache and checks it as the page would. Only then does it expire the
cached copy and the pages built from it (`revalidateTag` with
`{ expire: 0 }`, through the tag `launch-data-<language>` on the fetch), and,
once it has answered, it reads the file into the cache again. The next
request for that language, page or data route, gets the new data; it waits
for the data host only if it arrives before that re-read has finished.

**Limits to know.**

- **One server process.** The list of received `eventId`s (kept 24 hours, at
  most 1,000) and the cache belong to the process that received the
  notification. A restart forgets the list, which is harmless: a repeated
  refresh changes nothing. If you run several instances, a notification
  reaches one of them; the others show the new data within their own 5
  minutes. Making it reach all of them takes a shared cache handler (Next.js
  self-hosting guide, "Multi-Instance Cache Coordination"). Tell us which you
  run.
- If the data host fails in the moment between the check and the re-read
  (one fetch long), the expired copy has nothing behind it: until the host is
  back, the page shows its error and the data route answers 502, where
  without a notification both would have kept the old data.
- The route cannot tell an old file from a new one. If the data host still
  serves the old file when the notification arrives, the old file is kept for
  5 minutes. The LAUNCH pipeline is to notify only once its publish has
  finished.

## Updates from the LAUNCH team

- **Data:** automatic, as above: within 5 minutes, or on the next request
  when the pipeline sends a notification.
- **Interface text:** new `messages/` files, built and translated by the
  LAUNCH pipeline. `messages/manifest.json` records which build they come
  from.
- **Components:** new versions of this repository.

## For the LAUNCH team

`docs/react-port-notes.md` records every decision behind the port, with the
tests that prove the components show what the earlier static pages showed.
Those pages left this branch on 28 Oct 2026; the tests read them from git
(commit `7c1bf11`).
