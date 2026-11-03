// POST /api/unitaid/unsubscribe: the button on the "Unsubscribe?" page
// (app/[locale]/unsubscribe), posting the token from the welcome email's link
// as { t }. A relay: it goes on to the LAUNCH forms service with this site's
// token, and the answer comes back as it is ({ ok, status: "unsubscribed" },
// or 400 for a link that does not work). lib/forms.ts says how.
import { formsSettings } from "@/lib/env";
import { relay } from "@/lib/forms";

export async function POST(request: Request): Promise<Response> {
  return relay(request, "unsubscribe", formsSettings());
}

// GET (and HEAD, which Next.js serves with GET) goes to the same relay, which
// refuses it: 405 with "Allow: POST" and a JSON reason, where a method left
// unexported gets Next.js's bare 405. Reading the request keeps the route
// dynamic: nothing is built ahead or cached.
export async function GET(request: Request): Promise<Response> {
  return relay(request, "unsubscribe", formsSettings());
}
