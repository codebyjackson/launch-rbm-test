// Today's text, frozen: the table that lib/strings.ts held until the message files
// replaced it (copied unchanged from feat/react-port-dashboard 2869943).
// The area tests compare the components with today's pages using it, and
// tests/text-parity.test.ts proves the message-file adapter returns exactly it.
import type { PageText } from "@/lib/strings";
import type { Locale } from "@/lib/locales";

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
