// Builds the country map's two assets from the static pages' map files:
//
//   public/launch-map/world-shapes.json  the basemap shapes, one file for
//                                        every language (GeoJSON, iso3 only)
//   lib/map-countries.json               each shape's name per language, and
//                                        the countries the access map tracks
//   public/launch-map/maplibre-gl-csp-worker.js
//                                        MapLibre's worker, copied unchanged
//                                        from node_modules (see below)
//
// Source: {en,fr,pt}/data/world-map-geo.js (window.LAUNCH_MAP_GEO: shapes and
// names, Natural Earth 50m) and {en,fr,pt}/data/world-map.js (window.LAUNCH_MAP:
// the tracked countries) as on launch-rbm-test 7c1bf11. Those are generated
// upstream by launch-development-test's scripts/build-map-geo.js and
// build-map.js; once the static pages leave this branch, regenerate from there.
//
// The three languages' shapes differ only in names. This script refuses to
// write anything if that stops being true, or if a tracked country's name in
// world-map.js differs from its shape's name (lib/map-countries.ts reads both
// from the one names list).
//
// Usage: node scripts/build-map-assets.mjs
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const LANGS = ["en", "fr", "pt"];

// The files are `window.NAME = {json};` after two comment lines.
function readGlobal(file, name) {
  const s = readFileSync(join(ROOT, file), "utf8");
  const at = s.indexOf(`window.${name} = `);
  if (at < 0) throw new Error(`${file}: no window.${name}`);
  return JSON.parse(s.slice(at + `window.${name} = `.length).trim().replace(/;$/, ""));
}

const fail = (msg) => {
  console.error(`build-map-assets: ${msg}`);
  process.exit(1);
};

const geo = Object.fromEntries(LANGS.map((l) => [l, readGlobal(`${l}/data/world-map-geo.js`, "LAUNCH_MAP_GEO")]));
const map = Object.fromEntries(LANGS.map((l) => [l, readGlobal(`${l}/data/world-map.js`, "LAUNCH_MAP")]));

const en = geo.en.features;
for (const l of LANGS) {
  const f = geo[l].features;
  if (f.length !== en.length) fail(`${l}: ${f.length} shapes, en has ${en.length}`);
  f.forEach((x, i) => {
    if (x.properties.iso3 !== en[i].properties.iso3) fail(`${l}: shape ${i} is ${x.properties.iso3}, en has ${en[i].properties.iso3}`);
    if (JSON.stringify(x.geometry) !== JSON.stringify(en[i].geometry)) fail(`${l}: shape ${i} (${x.properties.iso3}) has other geometry`);
  });
  const drawn = Object.keys(map[l].countries);
  if (drawn.join() !== Object.keys(map.en.countries).join()) fail(`${l}: world-map.js lists other countries than en`);
  // the page looks names up by iso3, so the last shape with an iso3 names it
  const byIso = {};
  f.forEach((x) => { byIso[x.properties.iso3] = x.properties.name; });
  for (const iso3 of drawn) {
    if (!(iso3 in byIso)) fail(`${l}: tracked country ${iso3} has no shape`);
    if (map[l].countries[iso3].n !== byIso[iso3]) fail(`${l}: ${iso3} is "${map[l].countries[iso3].n}" in world-map.js, "${byIso[iso3]}" in world-map-geo.js`);
  }
}

// Names are left out: the map draws no labels, and one file then serves every
// language. Feature order is kept: lib/map-countries.json lists names in it.
const shapes = {
  type: "FeatureCollection",
  features: en.map((x) => ({ type: "Feature", properties: { iso3: x.properties.iso3 }, geometry: x.geometry })),
};
const countries = {
  generated:
    "by scripts/build-map-assets.mjs from {en,fr,pt}/data/world-map-geo.js and world-map.js (launch-rbm-test 7c1bf11). Do not edit by hand.",
  shapes: en.map((x) => x.properties.iso3),
  drawn: Object.keys(map.en.countries),
  names: Object.fromEntries(LANGS.map((l) => [l, geo[l].features.map((x) => x.properties.name)])),
};

mkdirSync(join(ROOT, "public/launch-map"), { recursive: true });
writeFileSync(join(ROOT, "public/launch-map/world-shapes.json"), JSON.stringify(shapes));
// one line per key, so a name change shows as a readable diff
const lines = Object.entries(countries).map(([k, v]) =>
  k === "names"
    ? `  "names": {\n${LANGS.map((l) => `    ${JSON.stringify(l)}: ${JSON.stringify(v[l])}`).join(",\n")}\n  }`
    : `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`);
writeFileSync(join(ROOT, "lib/map-countries.json"), `{\n${lines.join(",\n")}\n}\n`);
// MapLibre's CSP build loads its worker from a file instead of making it
// from its own source text at run time; a bundler that re-minifies MapLibre
// breaks the latter (only part of the map drew in a production build). The
// worker must be the same version as the installed maplibre-gl:
// tests/map-assets.test.ts checks the copy.
copyFileSync(join(ROOT, "node_modules/maplibre-gl/dist/maplibre-gl-csp-worker.js"), join(ROOT, "public/launch-map/maplibre-gl-csp-worker.js"));
const version = JSON.parse(readFileSync(join(ROOT, "node_modules/maplibre-gl/package.json"), "utf8")).version;
console.log(`build-map-assets: ${shapes.features.length} shapes, ${countries.drawn.length} tracked countries, ${LANGS.length} languages; maplibre-gl ${version} worker`);
