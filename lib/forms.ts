import "server-only";

// The relays behind the two forms and the "Unsubscribe?" page: POST
// /api/unitaid/subscribe, /api/unitaid/feedback and /api/unitaid/unsubscribe
// take the form from the reader's browser and pass it to the LAUNCH forms
// service (the Supabase function in launch-development-test, supabase/), with
// this site's token, then hand back the service's answer as it is.
//
// Why a relay and not the browser posting to the service itself: RBM's module
// rules allow no NEXT_PUBLIC_ setting and say the browser calls only
// /api/unitaid/… on RBM's own site; and the token must stay on the server,
// since anything a page holds, its readers can read. docs/react-port-notes.md,
// decision 61.
//
// The checks run cheapest first:
//   405  not a POST, with "Allow: POST". Each route exports GET to reach this
//        (Next.js serves HEAD with GET); a method a route does not export
//        gets Next.js's own bare 405, with no Allow header
//   503  UNITAID_FORMS_URL / UNITAID_FORMS_TOKEN not set (lib/env.ts)
//   415  not JSON
//   413  a body over 32 KB (declared, or counted while reading)
//   400  not UTF-8 text
//   502  the service could not be reached in 10 s, answered with a redirect
//        (any 3xx, whatever its body), or did not answer JSON
//   …    otherwise the service's own status and JSON, unchanged
// Kept out of the route files because a route file may export only what
// Next.js expects; the tests call relay() as the routes do.
import type { FormsSettings } from "./env";
import { readBody } from "./notifications";

/** The largest form accepted: 32 KB, the forms service's own cap. The largest real one, a 2,000-character report, is a few KB. */
export const FORMS_MAX_BODY = 32 * 1024;

/** How long the service may take before the reader is told it failed. */
export const FORMS_TIMEOUT_MS = 10_000;

/** The service's paths these relays pass forms to. */
export type FormsPath = "subscribe" | "feedback" | "unsubscribe";

const answer = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });

/**
 * Passes one form to the forms service and returns its answer. Only the body
 * goes on, with this site's token: no cookie, no address and no other header
 * of the reader's. Failures are logged with the path and status only, never
 * the form, which carries names and addresses.
 */
export async function relay(
  request: Request,
  path: FormsPath,
  settings: FormsSettings | null,
  fetchImpl: typeof fetch = fetch,
): Promise<Response> {
  if (request.method !== "POST") return answer(405, { ok: false, error: "Use POST." }, { allow: "POST" });
  if (!settings) {
    console.error(`[LAUNCH] forms: ${path}: UNITAID_FORMS_URL or UNITAID_FORMS_TOKEN is not set; refused`);
    return answer(503, { ok: false, error: "Not configured." });
  }
  if (!/^application\/json\b/i.test(request.headers.get("content-type") ?? "")) {
    return answer(415, { ok: false, error: "Send JSON." });
  }
  const body = await readBody(request, FORMS_MAX_BODY);
  if (!body.ok) {
    return body.reason === "too large"
      ? answer(413, { ok: false, error: "Too large." })
      : answer(400, { ok: false, error: "Malformed request." });
  }

  let res: Response;
  let text: string;
  try {
    res = await fetchImpl(`${settings.url}/api/${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${settings.token}` },
      body: body.text,
      // never cached; and a redirect is not followed, which would drop the
      // token or turn the POST into a GET: a moved service is a setting to fix
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(FORMS_TIMEOUT_MS),
    });
    // A redirect is refused before its body is read: whatever it carries is
    // not the service's answer, and passed through it would reach the
    // browser as a 3xx, JSON and all. A runtime whose fetch behaves as a
    // browser's gives an "opaqueredirect" (status 0) instead.
    if (res.type === "opaqueredirect" || (res.status >= 300 && res.status < 400)) {
      await res.body?.cancel().catch(() => {});
      console.error(`[LAUNCH] forms: ${path}: the forms service answered ${res.status || "a redirect"}, which is not followed`);
      return answer(502, { ok: false, error: "The forms service gave an unexpected answer." });
    }
    text = await res.text();
  } catch (e) {
    const timedOut = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
    console.error(`[LAUNCH] forms: ${path}: the forms service ${timedOut ? "did not answer in 10 s" : "could not be reached"}`);
    return answer(502, { ok: false, error: "The forms service did not answer." });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = undefined;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    console.error(`[LAUNCH] forms: ${path}: the forms service answered ${res.status}, not JSON`);
    return answer(502, { ok: false, error: "The forms service gave an unexpected answer." });
  }
  // 400 is the reader's own input (a name missing, a bad link): nothing to fix here
  if (!res.ok && res.status !== 400) console.error(`[LAUNCH] forms: ${path}: the forms service answered ${res.status}`);
  return new Response(text, {
    status: res.status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}
