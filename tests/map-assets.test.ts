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
    // line endings aside: a Windows checkout (core.autocrlf) writes CRLF
    const lf = (path: string) => read(path).toString("utf8").replace(/\r\n/g, "\n");
    expect(lf("public/launch-map/maplibre-gl-worker.mjs") === lf("node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs")).toBe(true);
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
