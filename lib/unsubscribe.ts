// The "Unsubscribe?" page's logic (app/[locale]/unsubscribe,
// components/unsubscribe/Unsubscribe.tsx), as plain functions the tests run.
//
// The link in the welcome email opens the forms service, which sends the
// reader on to this page with the same token: /en/unsubscribe?t=…. The page
// never unsubscribes on opening it — many mail systems open every link in an
// email to scan it — only when its button is pressed: then it posts { t } to
// this site's relay, which passes it to the service with the site's token.

/** Where the button posts: this site's relay (app/api/unitaid/unsubscribe, lib/forms.ts). */
export const UNSUBSCRIBE_ENDPOINT = "/api/unitaid/unsubscribe";

/** What pressing the button came to. */
export type UnsubscribeOutcome = "done" | "badLink" | "failed";

/** The link's token from the page's query string (`?t=…`), or "" when there is none. */
export function tokenFrom(search: string): string {
  return (new URLSearchParams(search).get("t") ?? "").trim();
}

/**
 * Posts the token and says how it went: "done" for { ok: true, status:
 * "unsubscribed" }, "badLink" for a 400 (the service could not read the
 * link), "failed" for anything else, a network failure included.
 */
export async function sendUnsubscribe(token: string, fetchImpl: typeof fetch = fetch): Promise<UnsubscribeOutcome> {
  try {
    const res = await fetchImpl(UNSUBSCRIBE_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ t: token }),
    });
    if (res.status === 400) return "badLink";
    const answer: unknown = await res.json().catch(() => null);
    const a = answer as { ok?: unknown; status?: unknown } | null;
    return res.ok && a && a.ok === true && a.status === "unsubscribed" ? "done" : "failed";
  } catch {
    return "failed";
  }
}
