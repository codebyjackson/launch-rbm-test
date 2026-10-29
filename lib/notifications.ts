// The notifications route's parts (RBM/UNOPS module spec 2b), kept out of
// app/api/unitaid/notifications/route.ts because a route file may export only
// what Next.js expects. No fetching and no Next.js here: tests run them as
// they are.
import { createHash, timingSafeEqual } from "node:crypto";
import { isLocale, LOCALES, type Locale } from "./locales";

/** The largest body accepted: 1 MB, read as 1,048,576 bytes. */
export const MAX_BODY_BYTES = 1_048_576;

/** The event types the route acts on. */
export const EVENT_TYPES = ["dataset.updated"] as const;

/** The longest eventId accepted, in characters. */
export const MAX_EVENT_ID = 256;

/**
 * Whether `authorization` is "Bearer <expected>". Compared in constant time:
 * both sides are hashed first, so the comparison takes as long whatever the
 * token's length or how much of it is right.
 */
export function tokenMatches(authorization: string | null, expected: string): boolean {
  const m = /^Bearer +(\S+) *$/i.exec(authorization ?? "");
  const digest = (s: string) => createHash("sha256").update(s, "utf8").digest();
  // hash something even when there is no token, so a missing header costs
  // the same as a wrong one
  const given = digest(m ? m[1] : "");
  return timingSafeEqual(given, digest(expected)) && m !== null;
}

export type BodyRead = { ok: true; text: string } | { ok: false; reason: "too large" | "not UTF-8" };

/**
 * The request's body as text, refusing more than `limit` bytes. Checks a
 * declared Content-Length first, then counts while reading: a chunked body
 * declares no length, and a declared one may be wrong.
 */
export async function readBody(request: Request, limit = MAX_BODY_BYTES): Promise<BodyRead> {
  const declared = Number(request.headers.get("content-length"));
  if (declared > limit) return { ok: false, reason: "too large" };
  if (!request.body) return { ok: true, text: "" };
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      return { ok: false, reason: "too large" };
    }
    chunks.push(value);
  }
  try {
    return { ok: true, text: new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)) };
  } catch {
    return { ok: false, reason: "not UTF-8" };
  }
}

export interface Notification {
  eventId: string;
  type: (typeof EVENT_TYPES)[number];
  occurredAt: string;
  data: { dataset: Locale };
}

export type Parsed = { ok: true; event: Notification } | { ok: false; problems: string[] };

type Obj = { [key: string]: unknown };
const isObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);

/**
 * An ISO 8601 date and time with its offset, as RFC 3339 profiles it:
 * 2026-10-27T12:00:00Z, 2026-10-27T14:00:00.5+02:00. A real calendar date and
 * time; without an offset the moment is ambiguous, so it is refused.
 */
export function isDateTime(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d+)?(Z|[+-](\d{2}):(\d{2}))$/.exec(value);
  if (!m) return false;
  const [y, mo, d, h, mi, s] = m.slice(1, 7).map(Number);
  const day = new Date(Date.UTC(y, mo - 1, d));
  const realDate = day.getUTCFullYear() === y && day.getUTCMonth() === mo - 1 && day.getUTCDate() === d;
  const offsetOk = m[8] === "Z" || (Number(m[9]) <= 23 && Number(m[10]) <= 59);
  return realDate && h <= 23 && mi <= 59 && s <= 59 && offsetOk;
}

/** A notification's body, checked; every problem is listed, not just the first. */
export function parseNotification(text: string): Parsed {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, problems: ["the body is not JSON"] };
  }
  if (!isObj(raw)) return { ok: false, problems: ["the body is not a JSON object"] };

  const problems: string[] = [];
  const { eventId, type, occurredAt, data } = raw;
  if (typeof eventId !== "string" || eventId.trim() === "" || eventId.length > MAX_EVENT_ID) {
    problems.push(`eventId must be a non-empty string of at most ${MAX_EVENT_ID} characters`);
  }
  if (typeof type !== "string" || !(EVENT_TYPES as readonly string[]).includes(type)) {
    problems.push(`type must be one of: ${EVENT_TYPES.join(", ")}`);
  }
  if (!isDateTime(occurredAt)) {
    problems.push("occurredAt must be an ISO 8601 date and time with an offset, such as 2026-10-27T12:00:00Z");
  }
  if (!isObj(data) || typeof data.dataset !== "string" || !isLocale(data.dataset)) {
    problems.push(`data.dataset must be one of: ${LOCALES.join(", ")}`);
  }
  return problems.length ? { ok: false, problems } : { ok: true, event: raw as unknown as Notification };
}

/**
 * The eventIds received, kept in memory: each for `maxAgeMs`, at most
 * `maxCount` of them (the oldest go first). A restart forgets them, and each
 * server process keeps its own list.
 */
export class SeenEvents {
  private readonly seen = new Map<string, number>();

  constructor(
    private readonly maxAgeMs = 24 * 60 * 60 * 1000,
    private readonly maxCount = 1000,
    private readonly now: () => number = Date.now,
  ) {}

  has(eventId: string): boolean {
    this.prune();
    return this.seen.has(eventId);
  }

  add(eventId: string): void {
    this.seen.delete(eventId);
    this.seen.set(eventId, this.now());
    this.prune();
  }

  get size(): number {
    this.prune();
    return this.seen.size;
  }

  private prune(): void {
    const oldest = this.now() - this.maxAgeMs;
    // a Map keeps insertion order, and add() re-inserts, so the oldest come first
    for (const [id, at] of this.seen) {
      if (at > oldest && this.seen.size <= this.maxCount) break;
      this.seen.delete(id);
    }
  }
}
