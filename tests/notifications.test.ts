// app/api/unitaid/notifications/route.ts, POST /api/unitaid/notifications:
// RBM's notifications route (module spec 2b), with lib/notifications.ts and
// lib/data.ts refreshDashboard(). fetch and Next.js's revalidateTag are
// stubbed: what the refresh does to a running server's cache is checked
// against `next start` (docs/react-port-notes.md, decision 59).
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dataUrl } from "@/lib/data";
import { isDateTime, MAX_BODY_BYTES, SeenEvents } from "@/lib/notifications";

vi.mock("server-only", () => ({}));
// one mock each for every fresh copy of the route (vi.resetModules below)
const { revalidateTag, after } = vi.hoisted(() => ({ revalidateTag: vi.fn(), after: vi.fn() }));
vi.mock("next/cache", () => ({ revalidateTag }));
vi.mock("next/server", () => ({ after }));

const read = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8"));
const LANG_FIXTURE: Record<string, unknown> = {
  en: read("dashboard.en.json"),
  fr: read("dashboard.fr.json"),
  pt: read("dashboard.pt.json"),
};

const TOKEN = "3f9c0e7b5a1d2c4e6f8091a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6";
const AUTH = { authorization: `Bearer ${TOKEN}` };
const GOOD = { eventId: "evt-001", type: "dataset.updated", occurredAt: "2026-10-27T12:00:00Z", data: { dataset: "en" } };

type Body = string | Uint8Array | ReadableStream<Uint8Array> | object;
function post(body: Body, headers: Record<string, string> = AUTH): Request {
  const raw = typeof body === "string" || body instanceof Uint8Array || body instanceof ReadableStream ? body : JSON.stringify(body);
  return new Request("http://localhost/api/unitaid/notifications", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: raw as BodyInit,
    // a stream body is sent chunked, with no Content-Length
    ...(raw instanceof ReadableStream ? { duplex: "half" } : {}),
  } as RequestInit);
}

/** A body sent in `count` chunks of `size` bytes; `pulled()` says how many were read. */
function chunked(size: number, count: number) {
  let n = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (n === count) return controller.close();
      n++;
      controller.enqueue(new Uint8Array(size).fill(0x20));
    },
  });
  return { stream, pulled: () => n };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

let POST: (request: Request) => Promise<Response>;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  vi.resetModules();
  ({ POST } = await import("@/app/api/unitaid/notifications/route"));
  revalidateTag.mockReset();
  after.mockReset();
  vi.stubEnv("UNITAID_NOTIFY_TOKEN", TOKEN);
  // the host answers with the language file the address names
  fetchMock = vi.fn(async (url: string) => json(LANG_FIXTURE[/dashboard\.(\w+)\.json/.exec(url)![1]]));
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const nothingDone = () => {
  expect(fetchMock).not.toHaveBeenCalled();
  expect(revalidateTag).not.toHaveBeenCalled();
  expect(after).not.toHaveBeenCalled();
};

describe("notifications: 202, accepted and refreshed", () => {
  it("reads the new file past the cache, then expires that language's cached copy, once", async () => {
    const res = await POST(post(GOOD));
    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ accepted: true, duplicate: false, eventId: "evt-001", dataset: "en" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(dataUrl("en"), { cache: "no-store" });
    expect(revalidateTag).toHaveBeenCalledTimes(1);
    expect(revalidateTag).toHaveBeenCalledWith("launch-data-en", { expire: 0 });
  });

  it("then, once it has answered, reads the file into the cache again, through getDashboard()", async () => {
    await POST(post(GOOD));
    expect(after).toHaveBeenCalledTimes(1);
    await after.mock.calls[0][0]();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenLastCalledWith(dataUrl("en"), {
      next: { revalidate: 300, tags: ["launch-data-en"] },
    });
  });

  it("logs a failed re-read instead of throwing: the next request reads the file itself", async () => {
    await POST(post(GOOD));
    fetchMock.mockResolvedValueOnce(new Response("", { status: 503 }));
    await expect(after.mock.calls[0][0]()).resolves.toBeUndefined();
    expect(String(vi.mocked(console.error).mock.calls.at(-1)?.[0])).toMatch(/re-reading en failed: HTTP 503/);
  });

  for (const dataset of ["fr", "pt"]) {
    it(`refreshes only the language named (${dataset})`, async () => {
      const res = await POST(post({ ...GOOD, data: { dataset } }));
      expect(res.status).toBe(202);
      expect(revalidateTag).toHaveBeenCalledExactlyOnceWith(`launch-data-${dataset}`, { expire: 0 });
    });
  }

  it("takes the Bearer scheme in any case, an offset other than Z, and fields it does not use", async () => {
    const res = await POST(
      post({ ...GOOD, occurredAt: "2026-10-27T14:00:00.250+02:00", extra: 1 }, { authorization: `bearer ${TOKEN}` }),
    );
    expect(res.status).toBe(202);
  });
});

describe("notifications: 200, a duplicate", () => {
  it("answers duplicate: true for an eventId already received, and does not refresh again", async () => {
    expect((await POST(post(GOOD))).status).toBe(202);
    const again = await POST(post({ ...GOOD, data: { dataset: "fr" } }));
    expect(again.status).toBe(200);
    expect(await again.json()).toEqual({ accepted: true, duplicate: true, eventId: "evt-001" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(revalidateTag).toHaveBeenCalledTimes(1);
    expect(after).toHaveBeenCalledTimes(1);
  });

  it("checks the body before the duplicate list", async () => {
    await POST(post(GOOD));
    expect((await POST(post({ ...GOOD, type: "dataset.deleted" }))).status).toBe(400);
  });

  it("does not record an event it could not act on: the same event, sent again, refreshes", async () => {
    fetchMock.mockResolvedValueOnce(new Response("", { status: 500 }));
    expect((await POST(post(GOOD))).status).toBe(502);
    expect((await POST(post(GOOD))).status).toBe(202);
    expect(revalidateTag).toHaveBeenCalledTimes(1);
  });
});

describe("notifications: 503 without a token set", () => {
  for (const value of ["", "   "]) {
    it(`refuses everything when UNITAID_NOTIFY_TOKEN is ${JSON.stringify(value)}`, async () => {
      vi.stubEnv("UNITAID_NOTIFY_TOKEN", value);
      const res = await POST(post(GOOD, { authorization: `Bearer ${value}` }));
      expect(res.status).toBe(503);
      expect(await res.json()).toEqual({ error: "notifications are not configured" });
      nothingDone();
    });
  }

  it("refuses everything when UNITAID_NOTIFY_TOKEN is not set at all", async () => {
    vi.stubEnv("UNITAID_NOTIFY_TOKEN", undefined);
    expect((await POST(post(GOOD))).status).toBe(503);
    nothingDone();
  });
});

describe("notifications: 401, the token", () => {
  const wrong: [string, Record<string, string>][] = [
    ["no Authorization header", {}],
    ["another token", { authorization: `Bearer ${TOKEN.replace(/.$/, "0")}` }],
    ["the token with a character more", { authorization: `Bearer ${TOKEN}0` }],
    ["the token with a character less", { authorization: `Bearer ${TOKEN.slice(1)}` }],
    ["the token without Bearer", { authorization: TOKEN }],
    ["Basic", { authorization: `Basic ${TOKEN}` }],
    ["Bearer and nothing", { authorization: "Bearer " }],
  ];
  for (const [what, headers] of wrong) {
    it(`refuses ${what}`, async () => {
      const res = await POST(post(GOOD, headers));
      expect(res.status).toBe(401);
      expect(res.headers.get("www-authenticate")).toMatch(/^Bearer/);
      expect(await res.json()).toEqual({ error: "invalid token" });
      nothingDone();
    });
  }

  it("answers 401 before reading the body: a stranger's 2 MB costs nothing", async () => {
    const big = chunked(65_536, 32);
    const res = await POST(post(big.stream, { authorization: "Bearer nope" }));
    expect(res.status).toBe(401);
    expect(big.pulled()).toBeLessThanOrEqual(1); // a stream may fill its first chunk on its own
  });

  it("answers 401 before checking the body", async () => {
    expect((await POST(post("not json", {}))).status).toBe(401);
  });
});

describe("notifications: 413, over 1 MB", () => {
  it("refuses a declared Content-Length over 1 MB without reading the body", async () => {
    const big = chunked(65_536, 32);
    const res = await POST(post(big.stream, { ...AUTH, "content-length": String(MAX_BODY_BYTES + 1) }));
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: "body larger than 1 MB" });
    expect(big.pulled()).toBeLessThanOrEqual(1);
    nothingDone();
  });

  it("refuses a chunked body (no Content-Length) once it passes 1 MB, and stops reading", async () => {
    const big = chunked(65_536, 32); // 2 MB in 64 KB chunks
    const res = await POST(post(big.stream));
    expect(res.status).toBe(413);
    expect(big.pulled()).toBe(17); // 17 × 64 KB = 1,114,112 bytes, the first chunk past the limit
    nothingDone();
  });

  it("refuses a body longer than its declared Content-Length says", async () => {
    const big = chunked(65_536, 32);
    const res = await POST(post(big.stream, { ...AUTH, "content-length": "120" }));
    expect(res.status).toBe(413);
  });

  it("takes a body of exactly 1,048,576 bytes, and refuses one byte more", async () => {
    const exact = JSON.stringify(GOOD).padEnd(MAX_BODY_BYTES, " ");
    expect(Buffer.byteLength(exact)).toBe(1_048_576);
    expect((await POST(post(exact))).status).toBe(202);
    expect((await POST(post(`${exact} `))).status).toBe(413);
  });
});

describe("notifications: 400, the body", () => {
  const problemsFor = async (body: Body) => {
    const res = await POST(post(body));
    expect(res.status).toBe(400);
    nothingDone();
    const out = await res.json();
    expect(out.error).toBe("invalid body");
    return out.problems as string[];
  };

  it("refuses a body that is not JSON, empty, or not an object", async () => {
    expect(await problemsFor("{eventId: evt-001}")).toEqual(["the body is not JSON"]);
    expect(await problemsFor("")).toEqual(["the body is not JSON"]);
    expect(await problemsFor("[1, 2]")).toEqual(["the body is not a JSON object"]);
    expect(await problemsFor('"evt-001"')).toEqual(["the body is not a JSON object"]);
  });

  it("refuses a body that is not UTF-8", async () => {
    expect(await problemsFor(new Uint8Array([0x7b, 0xff, 0xfe, 0x7d]))).toEqual(["the body is not UTF-8 text"]);
  });

  it("lists every problem at once", async () => {
    expect(await problemsFor({})).toHaveLength(4);
  });

  const bad: [string, object, RegExp][] = [
    ["no eventId", { eventId: undefined }, /^eventId/],
    ["an empty eventId", { eventId: "   " }, /^eventId/],
    ["an eventId that is a number", { eventId: 1 }, /^eventId/],
    ["an eventId of 257 characters", { eventId: "e".repeat(257) }, /^eventId/],
    ["no type", { type: undefined }, /^type/],
    ["a type it does not know", { type: "dataset.deleted" }, /^type must be one of: dataset\.updated$/],
    ["no occurredAt", { occurredAt: undefined }, /^occurredAt/],
    ["a date without a time", { occurredAt: "2026-10-27" }, /^occurredAt/],
    ["a time without an offset", { occurredAt: "2026-10-27T12:00:00" }, /^occurredAt/],
    ["a day that does not exist", { occurredAt: "2026-02-30T12:00:00Z" }, /^occurredAt/],
    ["an hour that does not exist", { occurredAt: "2026-10-27T24:00:00Z" }, /^occurredAt/],
    ["words", { occurredAt: "yesterday" }, /^occurredAt/],
    ["no data", { data: undefined }, /^data\.dataset/],
    ["data that is not an object", { data: ["en"] }, /^data\.dataset/],
    ["RBM's example dataset name, sample", { data: { dataset: "sample" } }, /^data\.dataset must be one of: en, fr, pt$/],
    ["the language tag pt-BR", { data: { dataset: "pt-BR" } }, /^data\.dataset/],
  ];
  for (const [what, change, problem] of bad) {
    it(`refuses ${what}`, async () => {
      const problems = await problemsFor({ ...GOOD, ...change });
      expect(problems).toHaveLength(1);
      expect(problems[0]).toMatch(problem);
    });
  }

  it("takes an eventId of 256 characters", async () => {
    expect((await POST(post({ ...GOOD, eventId: "e".repeat(256) }))).status).toBe(202);
  });
});

describe("notifications: 502, the new file cannot be used", () => {
  const cases: [string, () => unknown, string][] = [
    ["unreachable", () => fetchMock.mockRejectedValue(new TypeError("fetch failed")), "unavailable"],
    ["an HTTP error", () => fetchMock.mockResolvedValue(new Response("", { status: 404 })), "unavailable"],
    ["not JSON", () => fetchMock.mockResolvedValue(new Response("<html>")), "unavailable"],
    ["another schema_version", () => fetchMock.mockResolvedValue(json({ ...(LANG_FIXTURE.en as object), schema_version: 2 })), "schema"],
  ];
  for (const [what, arrange, kind] of cases) {
    it(`answers 502 and leaves the cache alone when the file is ${what}`, async () => {
      arrange();
      const res = await POST(post(GOOD));
      expect(res.status).toBe(502);
      expect(await res.json()).toEqual({ error: "source unavailable", kind });
      expect(revalidateTag).not.toHaveBeenCalled();
      expect(after).not.toHaveBeenCalled();
    });
  }
});

describe("lib/notifications.ts: the parts", () => {
  it("isDateTime: RFC 3339 date-times only", () => {
    for (const ok of ["2026-10-27T12:00:00Z", "2026-10-27T12:00:00.5Z", "2024-02-29T00:00:00-05:30", "2026-12-31T23:59:59+14:00"]) {
      expect(isDateTime(ok), ok).toBe(true);
    }
    for (const no of ["2026-10-27 12:00:00Z", "2026-10-27T12:00Z", "2025-02-29T00:00:00Z", "2026-10-27T12:00:00+24:00", "2026-10-27t12:00:00z", 20261027, null]) {
      expect(isDateTime(no), String(no)).toBe(false);
    }
  });

  it("SeenEvents forgets an eventId after its time", () => {
    let now = 0;
    const seen = new SeenEvents(1000, 10, () => now);
    seen.add("a");
    now = 999;
    expect(seen.has("a")).toBe(true);
    now = 1000; // kept for 1000 ms: gone at 1000
    expect(seen.has("a")).toBe(false);
  });

  it("SeenEvents keeps at most its count, dropping the oldest", () => {
    let now = 0;
    const seen = new SeenEvents(60_000, 3, () => now);
    for (const id of ["a", "b", "c", "d"]) {
      now++;
      seen.add(id);
    }
    expect(seen.size).toBe(3);
    expect(["a", "b", "c", "d"].map((id) => seen.has(id))).toEqual([false, true, true, true]);
  });
});
