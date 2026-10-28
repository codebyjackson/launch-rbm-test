// The static pages' text formatting, as pure functions: dates, large figures,
// citations. Ported from the main script of launch-rbm-test 7c1bf11
// (en/index.html), keeping the old names; tests/golden.test.ts checks each
// against the original in all three languages.
//
// esc() is not ported: React escapes text. Where the page built markup
// (citeLinks, citeHtml), these return the values it was built from, and the
// components draw them.
import type { Source } from "./dataset";
import type { Locale } from "./locales";

/**
 * The locale each language's dates are written in: the static pages'
 * <html lang>, except English, which is en-GB so a date reads "2 Oct 2026".
 * Portuguese is Brazilian since 28 Oct 2026, as RBM's site (was pt-PT).
 */
export const DATE_LOCALE: Record<Locale, string> = { en: "en-GB", fr: "fr", pt: "pt-BR" };

// Midnight local time, then written out in local time: the calendar date is
// the same in every time zone, so the server and the browser agree.
const atMidnight = (iso: string) => new Date(iso + "T00:00:00");

/** "2026-08-25" → "25 August 2026". Anything that is not a date comes back unchanged. */
export function readableDate(iso: string, locale: Locale): string {
  const d = atMidnight(iso);
  return isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString(DATE_LOCALE[locale], { day: "numeric", month: "long", year: "numeric" });
}

/** "2026-08-23" → "23 Aug 2026", the form "Last updated" uses. */
export function shortDate(iso: string, locale: Locale): string {
  const d = atMidnight(iso);
  return isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString(DATE_LOCALE[locale], { day: "numeric", month: "short", year: "numeric" });
}

// en-US in every language: Chrome's en-GB writes a lowercase "940k" beside "11.5M".
const COMPACT = new Intl.NumberFormat("en-US", { notation: "compact", maximumSignificantDigits: 3 });

/**
 * Large figures in data text as 940K or 11.5M, and millions of dollars as
 * US$14.5M rather than US$14.5m. For display only: the data, and so the CSV,
 * keep the exact figures. Only comma-grouped figures are found, so a French
 * or Portuguese "11,6 millions" is left as it is.
 */
export function fmtFig(s: string | number | null | undefined): string {
  return String(s == null ? "" : s)
    .replace(/\b\d{1,3}(?:,\d{3})+\b/g, (m) => COMPACT.format(+m.replace(/,/g, "")))
    .replace(/(US\$\d+(?:\.\d+)?)m\b/g, "$1M");
}

/** The first clause of a free-text date: "2015–2023; requal. 2025" → "2015–2023". */
export function firstClause(text: string | null | undefined): string {
  return String(text || "").split(";")[0].trim();
}

/** One source as a claim cites it: its short name, linked when it has an address. */
export interface Citation {
  label: string;
  url?: string;
}

/**
 * A claim's source ids as citations, in the claim's order, by each source's
 * name in the Sources list (so in the page's language). Unknown ids are
 * dropped. Shown joined by " · ".
 */
export function citeLinks(ids: readonly string[] | undefined, sources: readonly Source[]): Citation[] {
  // A plain object, not a Map, as on the page: an id that is also the name of
  // an Object.prototype member ("constructor") finds that member and shows as
  // a nameless, unlinked entry. Kept so the port behaves the same.
  const byId: { [id: string]: Source | undefined } = {};
  for (const s of sources) byId[s.id] = s;
  return (ids || [])
    .map((id) => byId[id])
    .filter((s): s is Source => !!s)
    .map((s) => {
      const label = String((s.label || s.title) ?? "");
      return s.url ? { label, url: s.url } : { label };
    });
}

/**
 * citeHtml on the page: a claim's citations, or else its free-text `source`
 * as a single unlinked entry. "Else" is judged as the page judged it, on the
 * joined markup being empty, so a lone source with no name and no address
 * also falls back to the text.
 */
export function citeOrText(
  ids: readonly string[] | undefined,
  text: string | undefined,
  sources: readonly Source[],
): Citation[] {
  const cites = citeLinks(ids, sources);
  if (cites.length > 1 || (cites.length === 1 && (cites[0].url || cites[0].label))) return cites;
  return text ? [{ label: String(text) }] : [];
}
