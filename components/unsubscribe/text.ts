// The "Unsubscribe?" page's interface text, from the message files
// (Unitaid.unsubscribe, lib/ui-text.ts). Added on 3 Nov 2026 with the page; the
// static pages had no such page (api/unsubscribe.js on Vercel drew its own),
// so these messages are marked uiOnly in launch-development-test's
// i18n/ui.page-forms.json.
import type { Locale } from "@/lib/locales";
import { type UiText, uiText } from "@/lib/ui-text";

export interface UnsubscribeText {
  title: string;
  intro: string;
  button: string;
  /** the button's label while the request is out */
  sending: string;
  doneTitle: string;
  doneText: string;
  doneAgain: string;
  badLinkTitle: string;
  badLinkText: string;
  failedTitle: string;
  failedText: string;
  /** the link back to the dashboard */
  back: string;
}

// by the messages object, not the language, as components/frame/text.ts does
const built = new WeakMap<UiText, UnsubscribeText>();

/** One language's UnsubscribeText, built once. */
export function unsubscribeText(locale: Locale): UnsubscribeText {
  const m = uiText(locale);
  let t = built.get(m);
  if (t) return t;
  const u = m.unsubscribe;
  t = {
    title: u.title,
    intro: u.intro,
    button: u.button,
    sending: u.sending,
    doneTitle: u.doneTitle,
    doneText: u.doneText,
    doneAgain: u.doneAgain,
    badLinkTitle: u.badLinkTitle,
    badLinkText: u.badLinkText,
    failedTitle: u.failedTitle,
    failedText: u.failedText,
    back: u.back,
  };
  built.set(m, t);
  return t;
}
