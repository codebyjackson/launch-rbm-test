// POST /api/unitaid/subscribe: the Subscribe for updates form. A relay: the
// form goes on to the LAUNCH forms service with this site's token, and its
// answer comes back as it is ({ ok, status: "subscribed" | "already" }).
// lib/forms.ts says how, and what each status means.
import { formsSettings } from "@/lib/env";
import { relay } from "@/lib/forms";

export async function POST(request: Request): Promise<Response> {
  return relay(request, "subscribe", formsSettings());
}

// GET (and HEAD, which Next.js serves with GET) goes to the same relay, which
// refuses it: 405 with "Allow: POST" and a JSON reason, where a method left
// unexported gets Next.js's bare 405. Reading the request keeps the route
// dynamic: nothing is built ahead or cached.
export async function GET(request: Request): Promise<Response> {
  return relay(request, "subscribe", formsSettings());
}
