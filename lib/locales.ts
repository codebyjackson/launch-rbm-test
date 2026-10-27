// The dashboard's languages. Spanish was removed on 27 Oct 2026
// (launch-development-test PR #127): RBM's platform does not support it.
export const LOCALES = ["en", "fr", "pt"] as const;

export type Locale = (typeof LOCALES)[number];

export const isLocale = (value: string): value is Locale =>
  (LOCALES as readonly string[]).includes(value);
