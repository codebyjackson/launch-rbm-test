// The interface text, one file per language (messages/*.json). Generated in
// launch-development-test (i18n/ui.en.json → scripts/build-rbm-messages.js)
// and copied in: a hand edit here is overwritten by the next copy, so wording
// changes go to ui.en.json there, where they are translated and approved.
import en from "@/messages/en.json";
import fr from "@/messages/fr.json";
import pt from "@/messages/pt.json";
import type { Locale } from "./locales";

export type Messages = typeof en;

const ALL: Record<Locale, Messages> = { en, fr, pt };

export const messagesFor = (locale: Locale): Messages => ALL[locale];
