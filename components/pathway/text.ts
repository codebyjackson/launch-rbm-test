// TEMPORARY: replaced by the message files in step 2 of the port.
//
// The interface text of the pathway strip (#pathway), the step panel
// (#gatewrap), a medicine's stage panel (.gatepanel), the Country access
// card's rows and the stage marker's hover hint, one table per language.
// Copied from the built pages at launch-rbm-test 7c1bf11 (en|fr|pt/index.html),
// wording, apostrophes and punctuation as they are there, mistakes included
// (pt "Perto" for Close; fr "Scène" in the step panel's label; ", N delayed"
// left in English on every page). tests/markup-pathway.test.ts renders the
// components with each table and compares the result with those pages' own
// markup, so a typo here fails it.
//
// The French strip label has two no-break spaces ("accès : …", "phase 3"),
// written as   so they survive copying; a plain space fails the test.
//
// "{name}" marks where a value goes, the form the message files will use
// (filled by fill() in lib/strings.ts, or fillNodes() where the value is
// markup). The status words, the two phase names and "N years" are not
// here: they come from lib/strings.ts, which the stage rules share.
import type { Status } from "@/lib/dataset";
import type { Locale } from "@/lib/locales";

export interface PathwayText {
  // ---- the strip (#pathway) ----
  /** the strip's label; static in today's markup, so it names the counts and the WHO pair itself */
  pathwayLabel: string;
  /** a step's button: {n} step number, {stage} name, {expected} nodeExpected or "", {delayed} nodeDelayed or "" */
  nodeLabel: string;
  /** ", expected {years}" */
  nodeExpected: string;
  /** ", {n} delayed": English on every page today */
  nodeDelayed: string;
  /** the expected-time tag under a step; {years} is drawn bold */
  expectedTag: string;
  /** joins the names of a parallel pair in its label */
  pairJoin: string;
  /** a parallel pair's label; {names} are joined by pairJoin */
  pairLabel: string;

  // ---- the step panel (#gatewrap) ----
  /** the panel's label: "Stage {n}: {stage}" */
  stepPanelLabel: string;
  /** "Stage {n} of {total}" */
  stepOf: string;
  /** the status tally's label; {count} is how many medicines are listed */
  summaryLabel: string;
  /** a tally chip: "{count} {noun}" with these nouns */
  statusNoun: Record<Status, string>;
  /** both panels' Close button */
  close: string;
  /** "{a} and {b} are parallel milestones within stage {n}." */
  parallel: string;
  whatHappens: string;
  whoDecides: string;
  whyStall: string;
  /** the explanation's own source heading */
  source: string;

  // ---- a medicine's stage panel (.gatepanel) ----
  recorded: string;
  nextStep: string;
  expected: string;
  pendingSince: string;
  adoptionNeeds: string;
  /** the three country levels, as the panel's key and the card's rows name them */
  levels: { registered: string; guidelines: string; mft: string };
  /** "Source: {cites}"; {cites} is the citations */
  sourceLine: string;
  /** "verified {date}" */
  verified: string;
  /** when the country survey's status is "illustrative" */
  surveyIllustrative: string;
  /** any other status but "verified": "country survey is {status}" */
  surveyStatus: string;

  // ---- the Country access card's rows ----
  onMap: string;
  confirmed: string;

  // ---- a stage marker's hover hint (#tip) ----
  clickForDetail: string;
}

export const pathwayText: Record<Locale, PathwayText> = {
  en: {
    pathwayLabel:
      "The access pathway: eight milestones across seven stages. WHO recommendation and WHO PQ listing are parallel milestones within stage 3. Choose a stage to see what happens there and where each medicine is",
    nodeLabel: "Stage {n}, {stage}{expected}. Shows what happens here and where each medicine is{delayed}.",
    nodeExpected: ", expected {years}",
    nodeDelayed: ", {n} delayed",
    expectedTag: "{years} expected",
    pairJoin: " and ",
    pairLabel: "{names} — independent approvals with no defined order between them",
    stepPanelLabel: "Stage {n}: {stage}",
    stepOf: "Stage {n} of {total}",
    summaryLabel: "Status of the {count} medicines at this stage",
    statusNoun: { done: "complete", prog: "in progress", late: "delayed", idle: "not started" },
    close: "Close",
    parallel: "{a} and {b} are parallel milestones within stage {n}.",
    whatHappens: "What happens here",
    whoDecides: "Who decides",
    whyStall: "Why it can stall",
    source: "Source",
    recorded: "Recorded",
    nextStep: "Next step",
    expected: "Expected",
    pendingSince: "Pending since",
    adoptionNeeds: "What adoption needs",
    levels: { registered: "Registered", guidelines: "In national guidelines", mft: "In MFT plans" },
    sourceLine: "Source: {cites}",
    verified: "verified {date}",
    surveyIllustrative: "country survey is illustrative",
    surveyStatus: "country survey is {status}",
    onMap: "Countries on the map",
    confirmed: "Confirmed in national registers",
    clickForDetail: "Click for the full detail",
  },
  fr: {
    pathwayLabel:
      "Le parcours d'accès\u00a0: huit étapes clés réparties en sept phases. La recommandation de l'OMS et l'inscription de l'OMS sur la liste PQ sont des étapes clés parallèles au sein de la phase\u00a03. Choisissez une phase pour découvrir ce qui s'y passe et où se trouve chaque médicament.",
    nodeLabel: "Étape {n}, {stage}{expected}. Indique ce qui se passe ici et où se trouve chaque médicament{delayed}.",
    nodeExpected: ", attendu {years}",
    nodeDelayed: ", {n} delayed",
    expectedTag: "{years} attendu",
    pairJoin: " et ",
    pairLabel: "{names} — approbations indépendantes sans ordre défini entre elles",
    stepPanelLabel: "Scène {n}: {stage}",
    stepOf: "Étape {n} sur {total}",
    summaryLabel: "État des médicaments {count} à ce stade",
    statusNoun: { done: "complet", prog: "en cours", late: "retardé", idle: "pas commencé" },
    close: "Fermer",
    parallel: "{a} et {b} sont des étapes parallèles au sein de l’étape {n}.",
    whatHappens: "Que se passe-t-il ici ?",
    whoDecides: "Qui décide ?",
    whyStall: "Pourquoi cela peut bloquer",
    source: "Source",
    recorded: "Enregistré",
    nextStep: "Étape suivante",
    expected: "Attendu",
    pendingSince: "En attente depuis",
    adoptionNeeds: "Quels sont les besoins en matière d’adoption ?",
    levels: {
      registered: "Inscrit",
      guidelines: "Conformément aux directives nationales",
      mft: "Dans les plans MFT",
    },
    sourceLine: "Source: {cites}",
    verified: "vérifié {date}",
    surveyIllustrative: "L’enquête nationale est illustrative",
    surveyStatus: "L’enquête nationale est {status}",
    onMap: "Pays sur la carte",
    confirmed: "Confirmé dans les registres nationaux",
    clickForDetail: "Cliquez pour plus de détails",
  },
  pt: {
    pathwayLabel:
      "O caminho de acesso: oito marcos em sete etapas. A recomendação da OMS e a inclusão na lista PQ da OMS são marcos paralelos dentro do passo 3. Escolha um passo para ver o que acontece nele e onde se encontra cada medicamento.",
    nodeLabel: "Estágio {n}, {stage}{expected}. Mostra o que acontece aqui e onde está cada medicamento{delayed}.",
    nodeExpected: ", esperado {years}",
    nodeDelayed: ", {n} delayed",
    expectedTag: "{years} esperado",
    pairJoin: " e ",
    pairLabel: "{names} — aprovações independentes sem ordem definida entre elas",
    stepPanelLabel: "Fase {n}: {stage}",
    stepOf: "Etapa {n} de {total}",
    summaryLabel: "Situação dos medicamentos {count} nesta fase",
    statusNoun: { done: "concluir", prog: "em curso", late: "atrasado", idle: "não iniciado" },
    close: "Perto",
    parallel: "{a} e {b} são marcos paralelos dentro do estádio {n}.",
    whatHappens: "O que acontece aqui?",
    whoDecides: "Quem decide?",
    whyStall: "Porque pode parar",
    source: "Fonte",
    recorded: "Gravado",
    nextStep: "Próximo passo",
    expected: "Esperado",
    pendingSince: "Pendente desde",
    adoptionNeeds: "Quais as necessidades da adoção?",
    levels: { registered: "Registrado", guidelines: "Em orientações nacionais", mft: "Em planos MFT" },
    sourceLine: "Fonte: {cites}",
    verified: "verificado {date}",
    surveyIllustrative: "O inquérito nacional é ilustrativo.",
    surveyStatus: "pesquisa de país {status}",
    onMap: "Países no mapa",
    confirmed: "Confirmado nos registos nacionais",
    clickForDetail: "Clique para ver todos os detalhes.",
  },
};
