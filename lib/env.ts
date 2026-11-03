import "server-only";

// The module's settings from the environment. RBM's contract check lets only
// this file and app/api/unitaid/** read process.env, and wants every name to
// start with UNITAID_; nothing here is NEXT_PUBLIC_, so no value reaches the
// browser. (The data and notifications routes read their own two settings,
// LAUNCH_DATA_URL and UNITAID_NOTIFY_TOKEN, where they use them; both move
// here, renamed, with the module.)

/** The shortest token accepted: anything shorter counts as not set. */
export const MIN_FORMS_TOKEN = 32;

/** Where the forms service is, and the token this site's server sends it. */
export interface FormsSettings {
  /** the service's base address, no trailing slash: https://<project>.supabase.co/functions/v1 */
  url: string;
  token: string;
}

type Env = { [name: string]: string | undefined };

/**
 * UNITAID_FORMS_URL and UNITAID_FORMS_TOKEN, or null when either is missing
 * or unusable: then Subscribe is hidden, Send feedback is not connected, and
 * the relays answer 503. The address must be https (http only for this
 * computer, when testing locally) with no query string or fragment; the
 * token at least MIN_FORMS_TOKEN characters. Read on every call, so a
 * relay picks up a changed setting without a new build.
 */
export function formsSettings(env: Env = process.env): FormsSettings | null {
  const token = (env.UNITAID_FORMS_TOKEN ?? "").trim();
  const url = serviceUrl(env.UNITAID_FORMS_URL);
  if (!url || token.length < MIN_FORMS_TOKEN) return null;
  return { url, token };
}

/** Whether the two forms are on: the page shows Subscribe and connects Send feedback. */
export function formsEnabled(env: Env = process.env): boolean {
  return formsSettings(env) !== null;
}

function serviceUrl(value: string | undefined): string | null {
  let u: URL;
  try {
    u = new URL((value ?? "").trim());
  } catch {
    return null;
  }
  const local = u.protocol === "http:" && ["localhost", "127.0.0.1"].includes(u.hostname);
  if ((u.protocol !== "https:" && !local) || u.search || u.hash || u.username || u.password) return null;
  return u.origin + u.pathname.replace(/\/+$/, "");
}
