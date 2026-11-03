// The forms' relays: POST /api/unitaid/subscribe, /api/unitaid/feedback and
// /api/unitaid/unsubscribe (app/api/unitaid/*/route.ts), lib/forms.ts relay()
// and the two settings in lib/env.ts. fetch is stubbed: what the forms
// service itself does with a form is tested in launch-development-test,
// scripts/test-forms-service.mjs.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formsEnabled, formsSettings, MIN_FORMS_TOKEN } from "@/lib/env";
import { FORMS_MAX_BODY, FORMS_TIMEOUT_MS, relay } from "@/lib/forms";
import * as subscribeRoute from "@/app/api/unitaid/subscribe/route";
import * as feedbackRoute from "@/app/api/unitaid/feedback/route";
import * as unsubscribeRoute from "@/app/api/unitaid/unsubscribe/route";

vi.mock("server-only", () => ({}));

const URL_ = "https://abcdefghijklmnopqrst.supabase.co/functions/v1";
const TOKEN = "8b1f0c2d3e4a5b6c7d8e9f0a1b2c3d4e5f60718293a4b5c6d7e8f9012a3b4c5d";
const SETTINGS = { url: URL_, token: TOKEN };
const FORM = { firstName: "Ada", lastName: "Lovelace", email: "ada@example.org", organisation: "MoH", page: "https://example.org/en" };

type Body = string | Uint8Array | ReadableStream<Uint8Array>;
function post(body: Body = JSON.stringify(FORM), headers: Record<string, string> = {}, method = "POST"): Request {
  return new Request("http://localhost:3000/api/unitaid/subscribe", {
    method,
    headers: { "content-type": "application/json", ...headers },
    ...(method === "GET" || method === "HEAD" ? {} : { body: body as BodyInit }),
    // a stream body is sent chunked, with no Content-Length
    ...(body instanceof ReadableStream ? { duplex: "half" } : {}),
  } as RequestInit);
}

/** A body sent in `count` chunks of `size` bytes, with no Content-Length. */
function chunked(size: number, count: number) {
  let n = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (n === count) return controller.close();
      n++;
      controller.enqueue(new Uint8Array(size).fill(0x20));
    },
  });
}

/** The service's answer: JSON text, or anything else as given. */
const reply = (status: number, body: unknown) =>
  new Response(typeof body === "string" ? body : JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

let fetchMock: ReturnType<typeof vi.fn>;
let logs: string[];

beforeEach(() => {
  fetchMock = vi.fn(async () => reply(200, { ok: true, status: "subscribed" }));
  logs = [];
  vi.spyOn(console, "error").mockImplementation((...a: unknown[]) => void logs.push(a.join(" ")));
  vi.spyOn(console, "log").mockImplementation((...a: unknown[]) => void logs.push(a.join(" ")));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const run = (request: Request, settings = SETTINGS as typeof SETTINGS | null) =>
  relay(request, "subscribe", settings, fetchMock as unknown as typeof fetch);
const jsonOf = async (res: Response) => JSON.parse(await res.text());

describe("the settings (lib/env.ts)", () => {
  it("reads the service's address and the token", () => {
    expect(formsSettings({ UNITAID_FORMS_URL: URL_, UNITAID_FORMS_TOKEN: TOKEN })).toEqual(SETTINGS);
    expect(formsEnabled({ UNITAID_FORMS_URL: URL_, UNITAID_FORMS_TOKEN: TOKEN })).toBe(true);
  });

  it("trims spaces and trailing slashes", () => {
    expect(formsSettings({ UNITAID_FORMS_URL: ` ${URL_}// `, UNITAID_FORMS_TOKEN: ` ${TOKEN} ` })).toEqual(SETTINGS);
  });

  it("allows plain http only for this computer", () => {
    for (const url of ["http://localhost:8000/functions/v1", "http://127.0.0.1:8000"]) {
      expect(formsSettings({ UNITAID_FORMS_URL: url, UNITAID_FORMS_TOKEN: TOKEN })?.url, url).toBe(url);
    }
    expect(formsSettings({ UNITAID_FORMS_URL: "http://forms.example.org", UNITAID_FORMS_TOKEN: TOKEN })).toBe(null);
  });

  it("is off when either is missing or unusable", () => {
    const off: { [k: string]: string | undefined }[] = [
      {},
      { UNITAID_FORMS_URL: URL_ },
      { UNITAID_FORMS_TOKEN: TOKEN },
      { UNITAID_FORMS_URL: "", UNITAID_FORMS_TOKEN: TOKEN },
      { UNITAID_FORMS_URL: "not an address", UNITAID_FORMS_TOKEN: TOKEN },
      { UNITAID_FORMS_URL: "ftp://forms.example.org", UNITAID_FORMS_TOKEN: TOKEN },
      { UNITAID_FORMS_URL: `${URL_}?x=1`, UNITAID_FORMS_TOKEN: TOKEN },
      { UNITAID_FORMS_URL: `${URL_}#x`, UNITAID_FORMS_TOKEN: TOKEN },
      { UNITAID_FORMS_URL: "https://user:pw@forms.example.org", UNITAID_FORMS_TOKEN: TOKEN },
      { UNITAID_FORMS_URL: URL_, UNITAID_FORMS_TOKEN: "   " },
    ];
    for (const env of off) {
      expect(formsSettings(env), JSON.stringify(env)).toBe(null);
      expect(formsEnabled(env)).toBe(false);
    }
  });

  it(`counts a token under ${MIN_FORMS_TOKEN} characters as not set`, () => {
    expect(MIN_FORMS_TOKEN).toBe(32);
    expect(formsSettings({ UNITAID_FORMS_URL: URL_, UNITAID_FORMS_TOKEN: "x".repeat(31) })).toBe(null);
    expect(formsSettings({ UNITAID_FORMS_URL: URL_, UNITAID_FORMS_TOKEN: "x".repeat(32) })).toEqual({ url: URL_, token: "x".repeat(32) });
  });

  it("reads the environment itself when given nothing", () => {
    vi.stubEnv("UNITAID_FORMS_URL", URL_);
    vi.stubEnv("UNITAID_FORMS_TOKEN", TOKEN);
    expect(formsSettings()).toEqual(SETTINGS);
    vi.stubEnv("UNITAID_FORMS_TOKEN", "");
    expect(formsEnabled()).toBe(false);
  });
});

describe("the relay: what it refuses, before anything is sent", () => {
  it("answers 405 to anything but a POST", async () => {
    for (const method of ["GET", "PUT", "DELETE"]) {
      const res = await run(post(undefined, {}, method));
      expect(res.status, method).toBe(405);
      expect(res.headers.get("allow")).toBe("POST");
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("answers 503 when the settings are missing, and says which, never their values", async () => {
    const res = await run(post(), null);
    expect(res.status).toBe(503);
    expect(await jsonOf(res)).toEqual({ ok: false, error: "Not configured." });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(logs.join("\n")).toContain("UNITAID_FORMS_URL or UNITAID_FORMS_TOKEN is not set");
  });

  it("answers 415 to anything but JSON", async () => {
    for (const type of ["text/plain", "application/x-www-form-urlencoded", ""]) {
      const res = await run(post(undefined, { "content-type": type }));
      expect(res.status, type).toBe(415);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it(`answers 413 to a body over ${FORMS_MAX_BODY} bytes, declared or counted`, async () => {
    expect(FORMS_MAX_BODY).toBe(32 * 1024);
    const declared = await run(post("x", { "content-length": String(FORMS_MAX_BODY + 1) }));
    expect(declared.status).toBe(413);
    const counted = await run(post(chunked(1024, 33)));
    expect(counted.status).toBe(413);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("takes a body of exactly the cap", async () => {
    const wrapper = JSON.stringify({ message: "" }).length;
    const body = JSON.stringify({ message: "x".repeat(FORMS_MAX_BODY - wrapper) });
    expect(new TextEncoder().encode(body).byteLength).toBe(FORMS_MAX_BODY);
    expect((await run(post(body))).status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("answers 400 to a body that is not UTF-8 text", async () => {
    const res = await run(post(new Uint8Array([0x7b, 0xff, 0xfe, 0x7d])));
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("the relay: what it sends", () => {
  it("posts the body unchanged to the service's path, with the token and nothing else of the reader's", async () => {
    const body = JSON.stringify(FORM);
    await run(
      post(body, {
        cookie: "session=secret",
        origin: "https://evil.example",
        "x-forwarded-for": "203.0.113.7",
        "user-agent": "Reader/1.0",
        authorization: "Bearer readers-own",
      }),
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${URL_}/api/subscribe`);
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ "content-type": "application/json", authorization: `Bearer ${TOKEN}` });
    expect(init.body).toBe(body);
    expect(init.cache).toBe("no-store");
    expect(init.redirect).toBe("manual");
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("uses each route's own path", async () => {
    for (const path of ["subscribe", "feedback", "unsubscribe"] as const) {
      fetchMock.mockClear();
      await relay(post(), path, SETTINGS, fetchMock as unknown as typeof fetch);
      expect(fetchMock.mock.calls[0][0]).toBe(`${URL_}/api/${path}`);
    }
  });

  it(`gives the service ${FORMS_TIMEOUT_MS / 1000} seconds`, () => {
    expect(FORMS_TIMEOUT_MS).toBe(10_000);
  });
});

describe("the relay: what it answers", () => {
  it("hands back the service's status and JSON as they are, never cached", async () => {
    const cases: [number, string][] = [
      [200, JSON.stringify({ ok: true, status: "subscribed" })],
      [200, JSON.stringify({ ok: true, status: "already" })],
      [200, JSON.stringify({ ok: true, ref: "LAUNCH-0A1B2C3D" })],
      [400, JSON.stringify({ ok: false, error: "Please enter your first and last name." })],
      [401, JSON.stringify({ ok: false, error: "Wrong token." })],
      [502, JSON.stringify({ ok: false, error: "Could not subscribe you just now." })],
      [503, JSON.stringify({ ok: false, error: "Not configured." })],
    ];
    for (const [status, text] of cases) {
      fetchMock.mockResolvedValueOnce(reply(status, text));
      const res = await run(post());
      expect(res.status, text).toBe(status);
      expect(await res.text()).toBe(text);
      expect(res.headers.get("cache-control")).toBe("no-store");
      expect(res.headers.get("content-type")).toBe("application/json; charset=utf-8");
    }
  });

  it("logs a refusal the site should fix, but not the reader's own mistake", async () => {
    fetchMock.mockResolvedValueOnce(reply(400, { ok: false }));
    await run(post());
    expect(logs).toEqual([]);
    fetchMock.mockResolvedValueOnce(reply(401, { ok: false }));
    await run(post());
    expect(logs).toEqual(["[LAUNCH] forms: subscribe: the forms service answered 401"]);
  });

  it("answers 502 when the service cannot be reached, or takes too long", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));
    const down = await run(post());
    expect(down.status).toBe(502);
    expect(await jsonOf(down)).toEqual({ ok: false, error: "The forms service did not answer." });
    fetchMock.mockRejectedValueOnce(new DOMException("The operation timed out.", "TimeoutError"));
    expect((await run(post())).status).toBe(502);
    expect(logs).toEqual([
      "[LAUNCH] forms: subscribe: the forms service could not be reached",
      "[LAUNCH] forms: subscribe: the forms service did not answer in 10 s",
    ]);
  });

  it("answers 502 to an answer that is not a JSON object", async () => {
    const odd = [
      new Response("<html>Bad gateway</html>", { status: 502 }),
      new Response("[1,2]", { status: 200 }),
      new Response("null", { status: 200 }),
      new Response("", { status: 200 }),
    ];
    for (const r of odd) {
      fetchMock.mockResolvedValueOnce(r);
      const res = await run(post());
      expect(res.status).toBe(502);
      expect(await jsonOf(res)).toEqual({ ok: false, error: "The forms service gave an unexpected answer." });
    }
  });

  it("answers 502 to any redirect, JSON body or not, without reading it", async () => {
    const good = JSON.stringify({ ok: true, status: "subscribed" });
    for (const status of [301, 302, 303, 307, 308]) {
      for (const body of [good, null]) {
        const r = new Response(body, { status, headers: body ? { "content-type": "application/json" } : { location: "https://elsewhere.example" } });
        const read = vi.spyOn(r, "text");
        fetchMock.mockResolvedValueOnce(r);
        const res = await run(post());
        expect(res.status, `${status} ${body ? "with JSON" : "empty"}`).toBe(502);
        expect(await jsonOf(res)).toEqual({ ok: false, error: "The forms service gave an unexpected answer." });
        expect(read).not.toHaveBeenCalled();
      }
    }
    expect(logs[0]).toBe("[LAUNCH] forms: subscribe: the forms service answered 301, which is not followed");
  });

  it("answers 502 to a browser-style opaque redirect (status 0)", async () => {
    const text = vi.fn(async () => JSON.stringify({ ok: true, status: "subscribed" }));
    fetchMock.mockResolvedValueOnce({ type: "opaqueredirect", status: 0, ok: false, body: null, text } as unknown as Response);
    const res = await run(post());
    expect(res.status).toBe(502);
    expect(text).not.toHaveBeenCalled();
    expect(logs).toEqual(["[LAUNCH] forms: subscribe: the forms service answered a redirect, which is not followed"]);
  });

  it("never logs the form or the token", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));
    await run(post());
    fetchMock.mockResolvedValueOnce(reply(503, { ok: false }));
    await run(post());
    await run(post(), null);
    const all = logs.join("\n");
    expect(logs.length).toBe(3);
    for (const secret of [TOKEN, FORM.email, FORM.firstName, FORM.organisation]) expect(all).not.toContain(secret);
  });
});

describe("the three routes", () => {
  const routes = { subscribe: subscribeRoute, feedback: feedbackRoute, unsubscribe: unsubscribeRoute };

  it("export POST, and GET only to refuse it: nothing else", () => {
    for (const [name, mod] of Object.entries(routes)) expect(Object.keys(mod).sort(), name).toEqual(["GET", "POST"]);
  });

  it("refuse GET and HEAD (served by GET) with 405, Allow: POST and a reason, configured or not", async () => {
    vi.stubGlobal("fetch", fetchMock);
    for (const configured of [true, false]) {
      vi.unstubAllEnvs();
      vi.stubEnv("UNITAID_FORMS_URL", configured ? URL_ : "");
      vi.stubEnv("UNITAID_FORMS_TOKEN", configured ? TOKEN : "");
      for (const [name, mod] of Object.entries(routes)) {
        for (const method of ["GET", "HEAD"]) {
          const res = await mod.GET(new Request(`http://localhost:3000/api/unitaid/${name}`, { method }));
          const label = `${name} ${method}${configured ? "" : ", not configured"}`;
          expect(res.status, label).toBe(405);
          expect(res.headers.get("allow"), label).toBe("POST");
          expect(res.headers.get("cache-control"), label).toBe("no-store");
          expect(await jsonOf(res), label).toEqual({ ok: false, error: "Use POST." });
        }
      }
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("pass the form to their own path with the settings from the environment", async () => {
    vi.stubEnv("UNITAID_FORMS_URL", `${URL_}/`);
    vi.stubEnv("UNITAID_FORMS_TOKEN", TOKEN);
    vi.stubGlobal("fetch", fetchMock);
    for (const [name, mod] of Object.entries(routes)) {
      fetchMock.mockClear();
      const res = await mod.POST(post());
      expect(res.status, name).toBe(200);
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(`${URL_}/api/${name}`);
      expect((init.headers as Record<string, string>).authorization).toBe(`Bearer ${TOKEN}`);
    }
  });

  it("answer 503 and send nothing while the settings are missing or too short", async () => {
    vi.stubGlobal("fetch", fetchMock);
    for (const env of [{}, { UNITAID_FORMS_URL: URL_, UNITAID_FORMS_TOKEN: "short" }]) {
      vi.unstubAllEnvs();
      vi.stubEnv("UNITAID_FORMS_URL", env.UNITAID_FORMS_URL ?? "");
      vi.stubEnv("UNITAID_FORMS_TOKEN", env.UNITAID_FORMS_TOKEN ?? "");
      for (const mod of Object.values(routes)) expect((await mod.POST(post())).status).toBe(503);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
