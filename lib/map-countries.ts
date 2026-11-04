// The basemap's countries in one language: each shape's name, and the
// countries the access map tracks. From lib/map-countries.json, which
// scripts/build-map-assets.mjs generates from the static pages' map files.
//
// Only names travel with the page. The shapes themselves are a static file
// the browser loads (public/launch-map/world-shapes.json, 1.5 MB), in the
// same order as `shapes` here.
import raw from "./map-countries.json";
import type { Locale } from "./locales";
import type { MapCountries } from "./map";

export function mapCountries(locale: Locale): MapCountries {
  const names: string[] = raw.names[locale];
  const shapes = raw.shapes.map((iso3, i) => ({ iso3, name: names[i] }));
  // by iso3, the last shape with an iso3 naming it, as the page's own lookup
  // did; the generator checks that this is also world-map.js's name for
  // every tracked country
  const byIso = new Map<string, string>();
  for (const s of shapes) byIso.set(s.iso3, s.name);
  return { shapes, drawn: raw.drawn.map((iso3) => ({ iso3, name: byIso.get(iso3) ?? iso3 })) };
}
