// POST /api/unitaid/notifications: the notifications route of RBM's module
// spec (section 2b). The LAUNCH pipeline calls it after publishing a dataset,
// so the dashboard shows the new data on the next request instead of within
// 5 minutes.
//
// The checks run cheapest first, so a stranger costs nothing:
//   503  UNITAID_NOTIFY_TOKEN is not set: every notification is refused
//   401  no "Authorization: Bearer <token>", or the wrong token
//   413  a body over 1 MB (declared, or counted while reading)
//   400  not JSON, or eventId, type, occurredAt or data.dataset missing or wrong
//   200  { duplicate: true }: this eventId was already received; nothing done
//   502  the new file cannot be read or used: the cache is left as it was
//   202  accepted: the file was read and the cached copy expired
//
// Parts in lib/notifications.ts; the refresh is lib/data.ts refreshDashboard().
import { refreshDashboard } from "@/lib/data";
import { DatasetError } from "@/lib/dataset";
import { parseNotification, readBody, SeenEvents, tokenMatches } from "@/lib/notifications";

// one list per server process (see SeenEvents)
const seen = new SeenEvents();

export async function POST(request: Request): Promise<Response> {
  // read on each request, so a token set or changed needs no new build
  const token = process.env.UNITAID_NOTIFY_TOKEN?.trim();
  if (!token) {
    console.error("[LAUNCH] notifications: UNITAID_NOTIFY_TOKEN is not set; refused");
    return Response.json({ error: "notifications are not configured" }, { status: 503 });
  }
  if (!tokenMatches(request.headers.get("authorization"), token)) {
    return Response.json(
      { error: "invalid token" },
      { status: 401, headers: { "www-authenticate": 'Bearer realm="unitaid"' } },
    );
  }

  const body = await readBody(request);
  if (!body.ok) {
    return body.reason === "too large"
      ? Response.json({ error: "body larger than 1 MB" }, { status: 413 })
      : Response.json({ error: "invalid body", problems: ["the body is not UTF-8 text"] }, { status: 400 });
  }
  const parsed = parseNotification(body.text);
  if (!parsed.ok) return Response.json({ error: "invalid body", problems: parsed.problems }, { status: 400 });

  const { eventId, data } = parsed.event;
  if (seen.has(eventId)) return Response.json({ accepted: true, duplicate: true, eventId });

  try {
    await refreshDashboard(data.dataset);
  } catch (e) {
    if (e instanceof DatasetError) {
      // not recorded as seen: the sender may send the same event again
      console.error(`[LAUNCH] notifications: ${eventId}: not refreshed, ${e.kind}: ${e.message}`);
      return Response.json({ error: "source unavailable", kind: e.kind }, { status: 502 });
    }
    throw e;
  }
  seen.add(eventId);
  console.log(`[LAUNCH] notifications: ${eventId}: ${data.dataset} refreshed`);
  return Response.json({ accepted: true, duplicate: false, eventId, dataset: data.dataset }, { status: 202 });
}
