// The map's static files (scripts/build-map-assets.mjs): they must match
// what the code expects, or the map fails only in a browser.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { mapCountries } from "@/lib/map-countries";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url));

describe("the map's static files", () => {
  it("serves the installed maplibre-gl's own worker", () => {
    // MapLibre's page code and its worker must be the same version; after an
    // upgrade, rerun node scripts/build-map-assets.mjs
    const installed = read("node_modules/maplibre-gl/dist/maplibre-gl-csp-worker.js");
    expect(read("public/launch-map/maplibre-gl-csp-worker.js").equals(installed)).toBe(true);
  });

  it("names every shape, in the shapes file's order, in each language", () => {
    const shapes = JSON.parse(read("public/launch-map/world-shapes.json").toString()) as { features: { properties: { iso3: string } }[] };
    for (const locale of ["en", "fr", "pt"] as const) {
      const c = mapCountries(locale);
      expect(c.shapes.map((s) => s.iso3)).toEqual(shapes.features.map((f) => f.properties.iso3));
      expect(c.shapes.every((s) => s.name)).toBe(true);
      expect(c.drawn).toHaveLength(94);
    }
  });
});
