// app/api/unitaid/data/route.ts: GET /api/unitaid/data?dataset=<name>, RBM's
// data route (module spec 2a): 200 with the data, 400 for a dataset name it
// does not know, 502 when the source cannot be used. fetch is stubbed: no
// test here reaches the network. The route's caching is Next.js's (the fetch
// in lib/data.ts) and is checked against a running server, not here
// (docs/react-port-notes.md, decision 58).
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/unitaid/data/route";
import { dataUrl, REVALIDATE } from "@/lib/data";
import { readLanguageFile } from "@/lib/dataset";
import { LOCALES } from "@/lib/locales";

// lib/data.ts imports "server-only", which throws outside a Next.js server
// build by design. Stubbed for this file only.
vi.mock("server-only", () => ({}));

const read = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8"));
// The language files the data host publishes (as in tests/dataset.test.ts).
const LANG_FIXTURE = { en: read("dashboard.en.json"), fr: read("dashboard.fr.json"), pt: read("dashboard.pt.json") };

const request = (query: string) => new Request(`http://localhost/api/unitaid/data${query}`);
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

let fetchMock: ReturnType<typeof vi.fn>;
let errorLog: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("data route: 400 for a dataset it does not know", () => {
  it("refuses a request without a dataset, and names the ones it has", async () => {
    const res = await GET(request(""));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "dataset is required", datasets: ["en", "fr", "pt"] });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // es was removed on 27 Oct; pt-BR is the page's language tag, not a
  // dataset name; names are exact, as the page's own route takes them.
  for (const name of ["xx", "es", "pt-BR", "EN", ""]) {
    it(`refuses ?dataset=${name}`, async () => {
      const res = await GET(request(`?dataset=${encodeURIComponent(name)}`));
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "unknown dataset", datasets: ["en", "fr", "pt"] });
      expect(fetchMock).not.toHaveBeenCalled();
    });
  }
});

describe("data route: 200 with the data", () => {
  for (const locale of LOCALES) {
    it(`returns getDashboard()'s dataset as JSON (${locale})`, async () => {
      fetchMock.mockResolvedValue(json(LANG_FIXTURE[locale]));
      const res = await GET(request(`?dataset=${locale}`));
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toMatch(/^application\/json/);
      // what the page gets from getDashboard(), and what the components take
      expect(await res.json()).toEqual(readLanguageFile(LANG_FIXTURE[locale], locale, dataUrl(locale)));
      // one fetch of that language's file, through Next.js's 5-minute cache
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith(dataUrl(locale), { next: { revalidate: 300 } });
    });
  }
});

describe("data route: 502 when the source cannot be used", () => {
  const cases: [string, () => unknown, string][] = [
    ["unreachable", () => fetchMock.mockRejectedValue(new TypeError("fetch failed")), "unavailable"],
    ["not OK (404)", () => fetchMock.mockResolvedValue(new Response("Not Found", { status: 404 })), "unavailable"],
    ["not OK (500)", () => fetchMock.mockResolvedValue(new Response("", { status: 500 })), "unavailable"],
    ["not JSON", () => fetchMock.mockResolvedValue(new Response("<!doctype html><p>maintenance</p>")), "unavailable"],
    ["another schema_version", () => fetchMock.mockResolvedValue(json({ ...LANG_FIXTURE.en, schema_version: 2 })), "schema"],
    ["in another language", () => fetchMock.mockResolvedValue(json(LANG_FIXTURE.fr)), "schema"],
  ];

  for (const [what, arrange, kind] of cases) {
    it(`answers 502 when the source is ${what}`, async () => {
      arrange();
      const res = await GET(request("?dataset=en"));
      expect(res.status).toBe(502);
      expect(await res.json()).toEqual({ error: "source unavailable", kind });
    });
  }

  it("logs the reason on the server and keeps the source's address out of the answer", async () => {
    fetchMock.mockResolvedValue(new Response("", { status: 503 }));
    const res = await GET(request("?dataset=fr"));
    expect(await res.text()).not.toContain(dataUrl("fr"));
    expect(errorLog).toHaveBeenCalledTimes(1);
    expect(String(errorLog.mock.calls[0][0])).toContain(`HTTP 503 from ${dataUrl("fr")}`);
  });
});

describe("the 5-minute cache", () => {
  it("is 300 seconds, and the page's revalidate says the same", () => {
    expect(REVALIDATE).toBe(300);
    // Next.js reads a page's revalidate from the source, so the page writes
    // the number out instead of importing REVALIDATE.
    const page = readFileSync(new URL("../app/[locale]/page.tsx", import.meta.url), "utf8");
    expect(page).toMatch(new RegExp(`^export const revalidate = ${REVALIDATE};$`, "m"));
  });
});
