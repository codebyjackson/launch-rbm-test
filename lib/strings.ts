// TEMPORARY: replaced by the message files in step 2 of the port.
//
// The words lib/format.ts and lib/stages.ts put into their results, one table
// per language. On the static pages the build wrote each translation into the
// page's code, so these are copied from the built pages at launch-rbm-test
// 7c1bf11 (en|fr|pt/index.html), wording and punctuation as they are there.
// tests/golden.test.ts checks every entry against those pages' own functions.
//
// "{name}" marks where a value goes, the form the message files will use. The
// singular is used for exactly 1 in every language, as on the pages, not each
// language's own plural rule: French writes "0 années".
import type { Status } from "./dataset";
import type { Locale } from "./locales";

export interface PageText {
  /** LABEL: the four status words */
  status: Record<Status, string>;
  /** PHASES: the two access phases, Market then Country */
  phases: readonly [string, string];
  /** yrsText for exactly 1 */
  year: string;
  /** yrsText for any other number */
  years: string;
  /** reachedText */
  reachedIn: string;
  reachedNoYear: string;
  /** soFarText; {years} is yrsText's result */
  soFar: string;
  underOneYearSoFar: string;
  /** accessParts, when Market Access is not reached */
  notYetReached: string;
  /** peekLine: the expected date of a gate still ahead */
  expected: string;
  /** yardResult */
  doneNoDate: string;
  ongoingNoStart: string;
  onTrackSoFar: string;
}

export const PAGE_TEXT: Record<Locale, PageText> = {
  en: {
    status: { done: "Complete", prog: "In progress", late: "Delayed", idle: "Not started" },
    phases: ["Market Access", "Country Access"],
    year: "{n} year",
    years: "{n} years",
    reachedIn: "Reached in {year}",
    reachedNoYear: "Reached, year not recorded",
    soFar: "{years} so far",
    underOneYearSoFar: "Under 1 year so far",
    notYetReached: "Not yet reached",
    expected: "expected {date}",
    doneNoDate: "Done, no date recorded",
    ongoingNoStart: "Ongoing, no start date",
    onTrackSoFar: "On track so far",
  },
  fr: {
    status: { done: "Complet", prog: "En cours", late: "Retardé", idle: "Pas encore commencé" },
    phases: ["Accès au marché", "Accès au pays"],
    year: "{n} année",
    years: "{n} années",
    reachedIn: "Atteint en {year}",
    reachedNoYear: "Atteint, année non enregistrée",
    soFar: "{years} jusqu’à présent",
    underOneYearSoFar: "Moins d’un an jusqu’à présent",
    notYetReached: "Pas encore atteint",
    expected: "attendu {date}",
    doneNoDate: "Terminé, aucune date enregistrée",
    ongoingNoStart: "En cours, sans date de début",
    onTrackSoFar: "Tout se déroule comme prévu jusqu’à présent",
  },
  pt: {
    status: { done: "Concluir", prog: "Em curso", late: "Atrasado", idle: "Não iniciado" },
    phases: ["Acesso ao mercado", "Acesso ao país"],
    year: "{n} ano",
    years: "{n} anos",
    reachedIn: "Alcançado em {year}",
    reachedNoYear: "Atingido, ano não registado",
    soFar: "{years} até ao momento",
    underOneYearSoFar: "Menos de 1 ano até agora",
    notYetReached: "Ainda não alcançado",
    expected: "esperado {date}",
    doneNoDate: "Feito, sem data registada",
    ongoingNoStart: "Em curso, sem data de início definida.",
    onTrackSoFar: "Até agora, tudo dentro do esperado.",
  },
};

/** Puts values into a "{name}" template. */
export function fill(template: string, values: { [name: string]: string | number }): string {
  return template.replace(/\{(\w+)\}/g, (_, name: string) => String(values[name]));
}
