// The interface text as the areas' adapters read it: one language of the
// message files (lib/messages.ts), as they are. Until 28 Oct 2026 the texts
// the files lacked, and today's wording where they differed, were held here
// (lib/held-text.ts); launch-development-test's message build now supplies
// both (its decisions 9 and 10).
//
// Each area turns this tree into its own typed text object, next to the type
// (lib/strings.ts pageText, components/*/text.ts). An adapter may only
// rename a placeholder or cut a message where the old code put a value in
// the middle of it. tests/text-parity.test.ts proves every adapter returns
// today's text, apart from the changes made on purpose that it lists.
import type { Locale } from "./locales";
import { messagesFor, type Messages } from "./messages";

export type UiText = Messages;

/** One language's text. The adapters only read it. */
export function uiText(locale: Locale): UiText {
  return messagesFor(locale);
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
