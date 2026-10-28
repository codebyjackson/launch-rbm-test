// lib/dataset.ts: picking one language out of dashboard.json, as loader() in
// launch-development-test's scripts/build-rbm-pages.js does on the static pages,
// and reading the one-language files the dashboard fetches.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DatasetError, datasetFrom, localize, readLanguageFile } from "@/lib/dataset";

const read = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8"));
// The published file on 27 Oct 2026 (pipeline commit 2d30ff3).
const FIXTURE = read("dashboard.json");
// The same file in each language, made from it by launch-development-test's
// scripts/build-dataset.js forLocale() (feat/data-per-language, 4036b90): what
// the publish workflow writes beside dashboard.json.
const LANG_FIXTURE = { en: read("dashboard.en.json"), fr: read("dashboard.fr.json"), pt: read("dashboard.pt.json") };
const URL_ = "https://example.org/v1/dashboard.json";

const minimal = (data: object, extra: object = {}) => ({
  schema_version: 1,
  locales: ["en", "fr", "pt"],
  last_updated: "2026-10-19",
  data_status: "draft",
  approved_at: "2026-10-27T08:38:13.617Z",
  generated_at: "2026-10-27T08:38:13.617Z",
  data: { host: null, stages: [], products: [], sources: [], treatmentPolicy: null, ...data },
  ...extra,
});

describe("localize: picking a language", () => {
  it("keeps the page's language", () => {
    const ds = localize(minimal({ stages: [{ en: "Approval", fr: "Approbation", pt: "Aprovação" }] }), "fr", URL_);
    expect(ds.data.stages).toEqual(["Approbation"]);
  });

  it("falls back to English when the language is missing or empty", () => {
    const ds = localize(minimal({ stages: [{ en: "A" }, { en: "B", pt: "" }] }), "pt", URL_);
    expect(ds.data.stages).toEqual(["A", "B"]);
  });

  it("treats an object with a key outside ds.locales as data, not a text", () => {
    const ds = localize(minimal({ host: { en: "x", es: "y" } }), "fr", URL_);
    expect(ds.data.meta.host).toEqual({ en: "x", es: "y" });
  });

  it("treats an object without a string `en` as data", () => {
    const ds = localize(minimal({ host: { en: 3, fr: "x" } }), "fr", URL_);
    expect(ds.data.meta.host).toEqual({ en: 3, fr: "x" });
  });

  it("uses en, fr, pt when ds.locales has no English", () => {
    const ds = localize(minimal({ stages: [{ en: "A", fr: "B" }] }, { locales: ["fr"] }), "fr", URL_);
    expect(ds.data.stages).toEqual(["B"]);
  });

  it("walks arrays and nested objects", () => {
    const ds = localize(
      minimal({ products: [{ id: "p", stages: [{ status: "done", note: { en: "Yes", fr: "Oui" } }] }] }),
      "fr",
      URL_,
    );
    expect(ds.data.products[0].stages[0]).toEqual({ status: "done", note: "Oui" });
  });

  it("leaves numbers, nulls and plain strings alone", () => {
    const ds = localize(minimal({ yardstick: { wholeYears: 8, expected: [null, 2.5], unit: "years" } }), "pt", URL_);
    expect(ds.data.yardstick).toEqual({ wholeYears: 8, expected: [null, 2.5], unit: "years" });
  });
});

describe("localize: the shape the static pages read", () => {
  it("marks every source public", () => {
    const ds = localize(minimal({ sources: [{ id: "a" }, { id: "b", public: false }] }), "en", URL_);
    expect(ds.sources.sources.map((s) => s.public)).toEqual([true, true]);
  });

  it("copies the dataset's dates and the address it came from", () => {
    const ds = localize(minimal({}), "en", URL_);
    expect(ds.data.meta).toMatchObject({ lastUpdated: "2026-10-19", dataStatus: "draft" });
    expect(ds.dataset).toEqual({
      approved_at: "2026-10-27T08:38:13.617Z",
      generated_at: "2026-10-27T08:38:13.617Z",
      url: URL_,
    });
  });

  it("does not change the input", () => {
    const raw = minimal({ sources: [{ id: "a" }] });
    const before = JSON.stringify(raw);
    localize(raw, "fr", URL_);
    expect(JSON.stringify(raw)).toBe(before);
  });
});

describe("localize: refusing a dataset", () => {
  it("refuses another schema_version", () => {
    expect(() => localize(minimal({}, { schema_version: 2 }), "en", URL_)).toThrow(DatasetError);
    try {
      localize(minimal({}, { schema_version: 2 }), "en", URL_);
    } catch (e) {
      expect((e as DatasetError).kind).toBe("schema");
    }
  });

  it("refuses something that is not a dataset", () => {
    expect(() => localize(null, "en", URL_)).toThrow(DatasetError);
    expect(() => localize([], "en", URL_)).toThrow(DatasetError);
  });
});

describe("localize: the published file", () => {
  for (const locale of ["en", "fr", "pt"] as const) {
    it(`leaves no { en, fr, pt } text unpicked (${locale})`, () => {
      const ds = localize(FIXTURE, locale, URL_);
      const left: string[] = [];
      const walk = (v: unknown, path: string) => {
        if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}[${i}]`));
        else if (v && typeof v === "object") {
          const keys = Object.keys(v);
          if (keys.length && keys.every((k) => ["en", "fr", "pt"].includes(k))) left.push(path);
          for (const k of keys) walk((v as Record<string, unknown>)[k], `${path}.${k}`);
        }
      };
      walk(ds, "ds");
      expect(left).toEqual([]);
    });
  }

  it("has the four products and eight stages", () => {
    const ds = localize(FIXTURE, "en", URL_);
    expect(ds.data.products.map((p) => p.id)).toEqual(["ganlum", "alaq", "pyramax", "dhappq"]);
    expect(ds.data.stages).toHaveLength(8);
  });
});

describe("readLanguageFile: one file per language", () => {
  // The point of the files: the page gets exactly what it got from the
  // combined file, so every golden test run on localize() holds for them too.
  for (const locale of ["en", "fr", "pt"] as const) {
    it(`gives the page what localize() gives it (${locale})`, () => {
      expect(readLanguageFile(LANG_FIXTURE[locale], locale, URL_)).toEqual(localize(FIXTURE, locale, URL_));
    });
  }

  it("is in its own language", () => {
    expect(readLanguageFile(LANG_FIXTURE.fr, "fr", URL_).data.stages[0]).toBe("Recherche et développement et clinique");
    expect(readLanguageFile(LANG_FIXTURE.pt, "pt", URL_).data.stages[0]).not.toBe(
      readLanguageFile(LANG_FIXTURE.en, "en", URL_).data.stages[0],
    );
  });

  it("refuses a file in another language", () => {
    try {
      readLanguageFile(LANG_FIXTURE.fr, "pt", URL_);
      expect.unreachable();
    } catch (e) {
      expect((e as DatasetError).kind).toBe("schema");
      expect((e as DatasetError).message).toMatch(/in fr, not pt/);
    }
  });

  it("refuses another schema_version", () => {
    expect(() => readLanguageFile({ ...LANG_FIXTURE.en, schema_version: 2 }, "en", URL_)).toThrow(DatasetError);
  });

  it("does not change the input", () => {
    const before = JSON.stringify(LANG_FIXTURE.pt);
    readLanguageFile(LANG_FIXTURE.pt, "pt", URL_);
    expect(JSON.stringify(LANG_FIXTURE.pt)).toBe(before);
  });
});

describe("datasetFrom: either file", () => {
  it("reads a language file by its locale, and the combined file by its locales", () => {
    expect(datasetFrom(LANG_FIXTURE.fr, "fr", URL_)).toEqual(localize(FIXTURE, "fr", URL_));
    expect(datasetFrom(FIXTURE, "fr", URL_)).toEqual(localize(FIXTURE, "fr", URL_));
  });

  it("still refuses a language file in the wrong language", () => {
    expect(() => datasetFrom(LANG_FIXTURE.en, "fr", URL_)).toThrow(/in en, not fr/);
  });
});
