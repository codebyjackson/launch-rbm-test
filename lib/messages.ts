// The interface text, one file per language (messages/*.json), every message
// under one key, "launchDashboard" (NAMESPACE). Generated in
// launch-development-test (i18n/ui.en.json → scripts/build-rbm-messages.js)
// and copied in: a hand edit here is overwritten by the next copy, so wording
// changes go to ui.en.json there, where they are translated and approved.
//
// RBM's site loads the same files through its own i18n.ts (next-intl), merged
// into its own en.json, fr.json, pt.json. Its page can hand the dashboard its
// part, messages.launchDashboard: provideMessages(), or the Dashboard's `text`
// prop. Our own copy is the fallback, message by message, so the dashboard
// never shows a blank or broken text whatever it is handed.
import en from "@/messages/en.json";
import fr from "@/messages/fr.json";
import pt from "@/messages/pt.json";
import type { Locale } from "./locales";

/** The one top-level key of every message file; RBM passes messages[NAMESPACE]. */
export const NAMESPACE = "launchDashboard";

export type Messages = (typeof en)[typeof NAMESPACE];

const OWN: Record<Locale, Messages> = { en: en[NAMESPACE], fr: fr[NAMESPACE], pt: pt[NAMESPACE] };

// What RBM handed over, per language: the source object (to skip a repeat),
// the result (our own copy with every acceptable handed-over message in it),
// and what was taken.
const given = new Map<Locale, { from: unknown; messages: Messages; report: Provided }>();

/**
 * One language's messages: what RBM handed over (provideMessages), or our own
 * copy. The same object until provideMessages() changes it, so the text
 * adapters build their text once per object (they cache by it).
 */
export const messagesFor = (locale: Locale): Messages => given.get(locale)?.messages ?? OWN[locale];

type Tree = { [key: string]: unknown };
const isTree = (v: unknown): v is Tree => !!v && typeof v === "object" && !Array.isArray(v);
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join();

/** What provideMessages() took from the handed-over messages, and what it left. */
export interface Provided {
  /** messages taken from RBM's copy */
  used: number;
  /** key paths where our own copy was kept: missing, empty, not text, or other {placeholders} */
  kept: string[];
}

/**
 * Hands the dashboard RBM's copy of its messages for one language: next-intl's
 * messages.launchDashboard on RBM's page. Each message is taken when it is a
 * non-empty string with exactly our {placeholders}; anything else keeps our
 * own copy, so an outdated or edited file cannot break a line. Keys we do not
 * have are ignored. `undefined` or `null` goes back to our own copy.
 *
 * Call it on the server before frameText()/frameView(), and pass the same
 * object to <Dashboard text>, which calls it in the browser.
 */
export function provideMessages(locale: Locale, text: unknown): Provided {
  if (text === undefined || text === null) {
    given.delete(locale);
    return { used: 0, kept: [] };
  }
  // the same object again (every render of the Dashboard): nothing to redo
  const before = given.get(locale);
  if (before && before.from === text) return before.report;
  const kept: string[] = [];
  let used = 0;
  const merge = (own: Tree, theirs: unknown, at: string): Tree => {
    const out: Tree = {};
    for (const [k, v] of Object.entries(own)) {
      const there = isTree(theirs) ? theirs[k] : undefined;
      const path = at ? `${at}.${k}` : k;
      if (isTree(v)) out[k] = merge(v, there, path);
      else if (typeof there === "string" && there.trim() && placeholders(there) === placeholders(v as string)) {
        out[k] = there;
        used++;
      } else {
        out[k] = v;
        kept.push(path);
      }
    }
    return out;
  };
  const merged = merge(OWN[locale] as unknown as Tree, text, "") as unknown as Messages;
  const report = { used, kept };
  // a new object with the same words (a page that rebuilds it on every
  // render) keeps the messages object, so nothing downstream rebuilds
  const same = before && JSON.stringify(before.messages) === JSON.stringify(merged);
  given.set(locale, { from: text, messages: same ? before.messages : merged, report });
  return report;
}
