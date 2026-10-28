// The interface text as the areas' adapters read it: one language of the
// message files (lib/messages.ts), with the texts they do not have yet added
// and today's wording kept where they differ (lib/held-text.ts).
//
// Each area turns this tree into its own typed text object, next to the type
// (lib/strings.ts pageText, components/*/text.ts). An adapter may only
// rename a placeholder or cut a message where the old code put a value in
// the middle of it; anything else is a held text, so it is listed.
// tests/text-parity.test.ts proves every adapter returns today's text exactly.
import { KEPT_FROM_PAGES, NOT_IN_MESSAGES, type HeldText } from "./held-text";
import type { Locale } from "./locales";
import { messagesFor, type Messages } from "./messages";

export type UiText = Messages & HeldText;

type Tree = { [key: string]: string | Tree };

// `extra`'s texts over `base`'s, key by key, at every level.
function merged(base: Tree, extra: Tree): Tree {
  const out: Tree = { ...base };
  for (const [k, v] of Object.entries(extra)) {
    const b = out[k];
    out[k] = typeof v === "string" || typeof b !== "object" ? v : merged(b, v);
  }
  return out;
}

function setAt(tree: Tree, key: string, value: string): void {
  const path = key.split(".");
  let node = tree;
  for (const k of path.slice(0, -1)) {
    const next = node[k];
    if (typeof next !== "object") throw new Error(`held text ${key}: no such key in the message files`);
    node = next;
  }
  node[path[path.length - 1]] = value;
}

const built = new Map<Locale, UiText>();

/** One language's text: built once, then shared. */
export function uiText(locale: Locale): UiText {
  let t = built.get(locale);
  if (!t) {
    // The message files are imported JSON modules shared by every caller, so
    // this works on copies and never writes into them.
    const tree = merged(
      structuredClone(messagesFor(locale)) as unknown as Tree,
      structuredClone(NOT_IN_MESSAGES[locale]) as unknown as Tree,
    );
    for (const [key, value] of Object.entries(KEPT_FROM_PAGES[locale])) setAt(tree, key, value as string);
    t = tree as unknown as UiText;
    built.set(locale, t);
  }
  return t;
}

/** The template with its {placeholders} renamed: rename("{duration} so far", { duration: "years" }). */
export function rename(template: string, names: { [from: string]: string }): string {
  for (const from of Object.keys(names)) {
    if (!template.includes(`{${from}}`)) throw new Error(`"${template}" has no {${from}}`);
  }
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in names ? `{${names[k]}}` : m));
}

/**
 * The text before and after {slot}, for a component that puts its own value
 * there (the disclaimer's medicine list, the planned medicine's name).
 * Throws when the message has no such slot, so a reworded message fails the
 * tests instead of showing a half sentence.
 */
export function around(template: string, slot: string): [before: string, after: string] {
  const at = template.indexOf(`{${slot}}`);
  if (at < 0) throw new Error(`"${template}" has no {${slot}}`);
  return [template.slice(0, at), template.slice(at + slot.length + 2)];
}
