// The page frame's logic, as pure functions: the header's date line, the
// banner, the CSV download, the Sources list, the disclaimer's country line,
// the Definitions list, and the two forms (Subscribe for updates, Send
// feedback). Ported from launch-rbm-test 7c1bf11: the main script of
// en/index.html and the feedback widget, en/assets/report-issue.js, keeping
// the old names where there were any; tests/golden-frame.test.ts checks each
// against the original in all three languages.
//
// Words come in as arguments (frameText() in components/frame/text.ts, from
// the message files), so these stay pure. The two send* functions are the forms' one seam
// each, as on the page; they take fetch as an argument so tests can stub it.
import type { Product, Source, Status } from "./dataset";
import { DATE_LOCALE, type Citation } from "./format";
import type { Locale } from "./locales";
import { tracked } from "./pathway";
import { DISPLAY, applyShowLate, statusShown, type Display } from "./stages";
import { fill, pageText } from "./strings";

/**
 * PAGE_LANG: the static pages' <html lang>. The Sources list is sorted in
 * it. Dates use DATE_LOCALE instead, which differs for English (en-GB).
 * Portuguese is Brazilian since 28 Oct 2026, as RBM's site (was pt-PT).
 */
export const PAGE_LANG: Record<Locale, string> = { en: "en", fr: "fr", pt: "pt-BR" };

// ---- header and banner ------------------------------------------------------

/**
 * The header's "Last updated 19 Oct 2026". `template` is "Last updated
 * {date}". Not shortDate(): the page wrote this line without its
 * not-a-date check, so a bad date reads "Invalid Date" here too.
 */
export function lastUpdatedText(lastUpdated: string, locale: Locale, template: string): string {
  const dt = new Date(lastUpdated + "T00:00:00");
  return fill(template, {
    date: dt.toLocaleDateString(DATE_LOCALE[locale], { day: "numeric", month: "short", year: "numeric" }),
  });
}

/** What the banner says: a data status's notice, or why there is no data. */
export type BannerKind = "illustrative" | "fail" | "schema";

/**
 * BANNERS[status]: only illustrative (mock-up) data has a banner. The draft
 * banner was removed on 15 Oct 2026; draft data shows none, and the footer's
 * disclaimer is the page's notice.
 *
 * Not kept: the page looked the status up on a plain object, so a status
 * named like an Object.prototype member ("constructor") wrote that function's
 * source into the banner. The port compares the name instead.
 */
export function statusBanner(dataStatus: string): "illustrative" | null {
  return dataStatus === "illustrative" ? "illustrative" : null;
}

// ---- CSV download -----------------------------------------------------------

/** One CSV cell: quoted when it holds a quote, comma or line feed (not a lone CR, as on the page). */
export function csvCell(v: unknown): string {
  const s = String(v == null ? "" : v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

/** CSV_COL and CSV_REC: the column names and the two record types. */
export interface CsvText {
  columns: {
    product: string;
    record: string;
    item: string;
    status: string;
    detail: string;
    date: string;
    next: string;
    anticipated: string;
    source: string;
    asOf: string;
  };
  stageRow: string;
  milestoneRow: string;
}

/**
 * The CSV's rows: a heading row, then for each tracked medicine its stages
 * and then its milestones. A status word the page hides (DISPLAY) is an
 * empty cell, and late reads as in progress unless showLate is on, as on the
 * page. Every other cell is the data as it is, so the CSV keeps exact figures.
 *
 * @throws TypeError for a medicine with no detail.milestones list, as the
 * page's click handler did (no download). Every medicine in the data has one.
 */
export function csvRows(
  products: readonly Product[],
  stages: readonly string[],
  locale: Locale,
  text: CsvText,
  display: Display = DISPLAY,
): unknown[][] {
  const label: Record<Status, string> = pageText(locale).status;
  const c = text.columns;
  const rows: unknown[][] = [
    [c.product, c.record, c.item, c.status, c.detail, c.date, c.next, c.anticipated, c.source, c.asOf],
  ];
  for (const p of tracked(applyShowLate([...products], display))) {
    p.stages.forEach((s, i) =>
      rows.push([
        p.name, text.stageRow, stages[i], statusShown(p, s.status, display) ? label[s.status] : "",
        s.note, s.date, s.next, s.nextDate, s.source || "", s.asOf || "",
      ]),
    );
    // non-null as the page assumed it: see @throws
    p.detail.milestones!.forEach((m) =>
      rows.push([
        p.name, text.milestoneRow, m.milestone, statusShown(p, m.status, display) ? label[m.status] : "",
        m.label, m.date, m.next, m.anticipated, m.source || "", "",
      ]),
    );
  }
  return rows;
}

/** The rows as CSV text: comma between cells, CRLF between rows, no final newline. */
export function csvText(rows: readonly (readonly unknown[])[]): string {
  return rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
}

/** Put before the text in the download, so Excel reads the file as UTF-8. */
export const CSV_BOM = "﻿";
export const CSV_TYPE = "text/csv;charset=utf-8";

export function csvFileName(lastUpdated: string): string {
  return "launch-dashboard-data-" + lastUpdated + ".csv";
}

// ---- footer: Sources, disclaimer, Definitions --------------------------------

/** One entry of the Sources list. */
export interface SourceItem {
  /** its name, linked to the public page when it has one */
  cite: Citation;
  plain: string;
  /** always drawn as links, as on the page, even without an address */
  alsoSee: { label: string; url: string }[];
  /** shown as copyable text, never a link: it often opens raw data or an error */
  dataUrl?: string;
}

/** The two lists: registers and feeds, then Key documents (empty: that part stays hidden). */
export interface SourceLists {
  data: SourceItem[];
  docs: SourceItem[];
}

const str = (v: unknown) => String(v == null ? "" : v);

/**
 * renderSources: every public source, A–Z by the name shown in the page's
 * language (8 Oct 2026), split into registers and feeds, then the documents.
 *
 * @throws TypeError when two sources being compared have neither label nor
 * title, as on the page (whose list then stayed empty).
 */
export function sourceLists(sources: readonly Source[], locale: Locale): SourceLists {
  const nameOf = (s: Source) => (s.label || s.title)!;
  const shown = sources
    .filter((s) => s.public)
    .sort((a, b) => nameOf(a).localeCompare(nameOf(b), PAGE_LANG[locale], { sensitivity: "base", numeric: true }));
  const item = (s: Source): SourceItem => {
    const label = str(s.label || s.title);
    const out: SourceItem = {
      cite: s.url ? { label, url: s.url } : { label },
      plain: str(s.plain),
      alsoSee: (s.alsoSee || []).map((a) => ({ label: str(a.label), url: str(a.url) })),
    };
    if (s.dataUrl) out.dataUrl = str(s.dataUrl);
    return out;
  };
  return {
    data: shown.filter((s) => s.group !== "document").map(item),
    docs: shown.filter((s) => s.group === "document").map(item),
  };
}

/**
 * renderDisclaimer: the disclaimer's sentence on country data (12 Oct 2026),
 * from each medicine's detail.countries.status, in data order. A medicine
 * with no country list is not named: its country stages have not started.
 * Each part ends in ". ", as it sits before the next sentence.
 */
export function countryCheckText(
  products: readonly Product[],
  text: { verifiedFor: string; notVerifiedFor: string },
): string {
  const named = (ok: boolean) =>
    products
      .filter((p) => {
        const countries = p.detail && p.detail.countries;
        return !!countries && ((countries as { status?: unknown }).status === "verified") === ok;
      })
      .map((p) => p.name)
      .join(", ");
  const line = (label: string, list: string) => (list ? `${label} ${list}. ` : "");
  return line(text.verifiedFor, named(true)) + line(text.notVerifiedFor, named(false));
}

/** The Definitions list: every glossary term A–Z (code-unit order, as on the page) with its definition. */
export function glossaryEntries(glossary: unknown): [term: string, definition: string][] {
  const g = (glossary || {}) as { [term: string]: unknown };
  return Object.keys(g)
    .sort()
    .map((t) => [t, str(g[t])]);
}

// ---- the two forms ------------------------------------------------------------

/** The test both forms run, and the one api/_mail.js runs on the server. */
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Where the two forms post, from NEXT_PUBLIC_LAUNCH_FORMS_URL, or null when
 * it is empty: then Subscribe is hidden and Send feedback is not connected,
 * as `--api-url none` does on the static pages. Trailing slashes are dropped,
 * as the static build did.
 */
export function formsEndpoints(base: string | undefined): { subscribe: string; feedback: string } | null {
  const origin = (base || "").trim().replace(/\/+$/, "");
  return origin ? { subscribe: origin + "/api/subscribe", feedback: origin + "/api/feedback" } : null;
}

// Both endpoints answer { ok: true, ... }; anything else, including a reply
// that is not JSON, is a failure.
async function postJson(fetchImpl: typeof fetch, url: string, body: unknown): Promise<{ [key: string]: unknown }> {
  const res = await fetchImpl(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const answer: unknown = await res.json().catch(() => null);
  if (!res.ok || !answer || typeof answer !== "object" || !(answer as { ok?: unknown }).ok) {
    throw new Error("HTTP " + res.status);
  }
  return answer as { [key: string]: unknown };
}

// -- Subscribe for updates

export interface SubscribeFields {
  firstName: string;
  lastName: string;
  email: string;
  organisation: string;
}
export type SubscribeField = "firstName" | "lastName" | "email";

/** What api/subscribe.js reads (it also re-checks names and address). */
export interface SubscribeDetails {
  firstName: string;
  lastName: string;
  email: string;
  organisation: string;
}

export type SubscribeCheck =
  | { ok: true; details: SubscribeDetails }
  | { ok: false; invalid: SubscribeField[]; problem: "names" | "email" };

/**
 * The checks the server also runs: both names, and an address that looks
 * like one; the organisation is optional. `invalid` lists the fields to mark,
 * the first of which takes focus.
 */
export function checkSubscribe(f: SubscribeFields): SubscribeCheck {
  const missing = (["firstName", "lastName"] as const).filter((k) => !f[k].trim());
  if (missing.length) return { ok: false, invalid: [...missing], problem: "names" };
  const email = f.email.trim();
  if (!EMAIL_RE.test(email)) return { ok: false, invalid: ["email"], problem: "email" };
  return {
    ok: true,
    details: { firstName: f.firstName.trim(), lastName: f.lastName.trim(), email, organisation: f.organisation.trim() },
  };
}

/**
 * subscribeEmail: posts the details, with the page's address as `page`, and
 * resolves to the server's answer: "already" for an address already on the
 * list, "subscribed" otherwise. Throws on anything but an { ok: true } reply.
 */
export async function sendSubscribe(
  details: SubscribeDetails,
  pageUrl: string,
  endpoint: string,
  fetchImpl: typeof fetch = fetch,
): Promise<"subscribed" | "already"> {
  const answer = await postJson(fetchImpl, endpoint, { ...details, page: pageUrl });
  return answer.status === "already" ? "already" : "subscribed";
}

// -- Send feedback

/** The widget's four values; the server keys its labels on them, so only the words change by page. */
export const FEEDBACK_TYPES = ["correction", "source", "suggestion", "other"] as const;
export type FeedbackType = (typeof FEEDBACK_TYPES)[number];

/** LAUNCH_FEEDBACK_COPY.view on the page: tells the team which view a report came from. */
export const FEEDBACK_VIEW = "illustrated";

/** One choice in "Which medicine does it concern?". */
export interface FeedbackOption {
  id: string;
  label: string;
}

/**
 * trackedProducts() and fillProducts(): every medicine with an id and a
 * name, in data order (not the A–Z `tracked` order), planned ones marked.
 */
export function feedbackProducts(products: readonly Product[], plannedSuffix: string): FeedbackOption[] {
  return products
    .filter((p) => p && p.id && p.name)
    .map((p) => ({ id: p.id, label: p.name + (p.placeholder ? plannedSuffix : "") }));
}

/**
 * HTMLOptionElement.text, which the page sent as productName: the option's
 * words with ASCII whitespace collapsed and stripped.
 */
export function optionText(label: string): string {
  return label.replace(/[\t\n\f\r ]+/g, " ").replace(/^ | $/g, "");
}

export interface FeedbackFields {
  type: string;
  /** "" for General */
  productId: string;
  message: string;
  name: string;
  email: string;
  organisation: string;
}

/** What validate() found: which message to show under each field, or "". */
export interface FeedbackErrors {
  message: "" | "empty" | "short";
  email: "" | "bad";
}

/** validate(): a message of at least 10 characters, and an address only if it looks like one. */
export function checkFeedback(message: string, email: string): FeedbackErrors {
  const msg = message.trim();
  const mail = email.trim();
  return {
    message: !msg ? "empty" : msg.length < 10 ? "short" : "",
    email: mail && !EMAIL_RE.test(mail) ? "bad" : "",
  };
}

/** What the page reads from the browser for a report; the component supplies it at submit time. */
export interface FeedbackEnv {
  url: string;
  path: string;
  title: string;
  userAgent: string;
  now: Date;
}

/** The report as api/feedback.js receives it (the widget's header documents the shape). */
export interface FeedbackPayload {
  type: string;
  productId: string | null;
  productName: string | null;
  message: string;
  name: string | null;
  email: string | null;
  organisation: string | null;
  page: { url: string; path: string; title: string; view: string };
  data: { lastUpdated: string | null; dataStatus: string | null };
  submittedAt: string;
  userAgent: string;
}

export function feedbackPayload(
  f: FeedbackFields,
  products: readonly FeedbackOption[],
  meta: { lastUpdated?: string | null; dataStatus?: string | null },
  env: FeedbackEnv,
): FeedbackPayload {
  const prod = products.find((o) => o.id === f.productId);
  return {
    type: f.type,
    productId: f.productId || null,
    productName: f.productId && prod ? optionText(prod.label) : null,
    message: f.message.trim(),
    name: f.name.trim() || null,
    email: f.email.trim() || null,
    organisation: f.organisation.trim() || null,
    page: { url: env.url, path: env.path, title: env.title, view: FEEDBACK_VIEW },
    data: { lastUpdated: meta.lastUpdated || null, dataStatus: meta.dataStatus || null },
    submittedAt: env.now.toISOString(),
    userAgent: env.userAgent,
  };
}

export type FeedbackPrepared =
  | { kind: "invalid"; errors: FeedbackErrors }
  /** no forms address: Send is blocked and nothing is posted */
  | { kind: "blocked" }
  | { kind: "ready"; endpoint: string; payload: FeedbackPayload };

/** The submit handler up to the post: validate, then build the report if there is somewhere to send it. */
export function prepareFeedback(
  f: FeedbackFields,
  ctx: {
    endpoint: string | null;
    products: readonly FeedbackOption[];
    meta: { lastUpdated?: string | null; dataStatus?: string | null };
    env: FeedbackEnv;
  },
): FeedbackPrepared {
  const errors = checkFeedback(f.message, f.email);
  if (errors.message || errors.email) return { kind: "invalid", errors };
  if (!ctx.endpoint) return { kind: "blocked" };
  return { kind: "ready", endpoint: ctx.endpoint, payload: feedbackPayload(f, ctx.products, ctx.meta, ctx.env) };
}

/**
 * submitIssueReport, connected: posts the report and resolves to the
 * reference the server gives, or "" when it gives none (shown as "—").
 * Throws on anything but an { ok: true } reply.
 */
export async function sendFeedback(
  payload: FeedbackPayload,
  endpoint: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const answer = await postJson(fetchImpl, endpoint, payload);
  return answer.ref ? String(answer.ref) : "";
}
