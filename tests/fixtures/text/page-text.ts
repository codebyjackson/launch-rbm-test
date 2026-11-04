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
    status: {
      done: "Terminé",
      prog: "En cours",
      late: "En retard",
      idle: "Non démarré",
    },
    phases: ["Accès au marché", "Accès aux pays"],
    year: "{n} an",
    years: "{n} ans",
    reachedIn: "Atteint en {year}",
    reachedNoYear: "Atteint, année non consignée",
    soFar: "{years} à ce jour",
    underOneYearSoFar: "Moins de 1 an à ce jour",
    notYetReached: "Pas encore atteint",
    expected: "attendu {date}",
    doneNoDate: "Terminé, pas de date connue",
    ongoingNoStart: "En cours, pas de date de début",
    onTrackSoFar: "En bonne voie jusqu’à présent",
  },
  pt: {
    status: {
      done: "Completo",
      prog: "Em andamento",
      late: "Atrasado",
      idle: "Não iniciado",
    },
    phases: ["Acesso ao Mercado", "Acesso no País"],
    year: "{n} ano",
    years: "{n} anos",
    reachedIn: "Alcançado em {year}",
    reachedNoYear: "Alcançado, ano não registrado",
    soFar: "{years} até o momento",
    underOneYearSoFar: "Menos de 1 ano até o momento",
    notYetReached: "Ainda não alcançado",
    expected: "esperado {date}",
    doneNoDate: "Concluído, data não registrada",
    ongoingNoStart: "Em andamento, sem data de início",
    onTrackSoFar: "Dentro do previsto até o momento",
  },
};
