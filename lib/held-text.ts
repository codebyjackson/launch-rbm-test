// Interface text the dashboard shows that the message files do not supply as
// today's pages word it. Two lists, both meant to shrink to nothing:
//
// NOT_IN_MESSAGES: texts with no key in messages/*.json at all, under the key
// they should get in launch-development-test's i18n/ui.en.json. Most belong to
// parts switched off for 10 Nov (the yardstick comparison, "Delayed", the
// barrier column, the expected time under each step), which is why the
// pipeline never collected them. Values are today's pages' (en|fr|pt
// index.html at launch-rbm-test 7c1bf11), mistakes included.
//
// KEPT_FROM_PAGES: keys the message files do have, where their text differs
// from what today's page shows (most often a straight ' where the page has
// ’). Today's wording is kept, so the port changes no visible text; each entry
// is a decision for the owner and the translation reviewer, not a fix.
//
// tests/text-parity.test.ts fails when a key here appears in the message
// files (NOT_IN_MESSAGES), or when a kept text has become equal to the
// message files' or its key has gone (KEPT_FROM_PAGES): either way the entry
// is no longer needed and should be deleted. docs/react-port-notes.md
// (decision 43) lists them for the reviewer.
import type { Locale } from "./locales";
import type { Messages } from "./messages";

/** The keys NOT_IN_MESSAGES adds, in the message files' shape. */
export interface HeldText {
  common: { status: { delayed: string } };
  pathway: {
    /** ", expected {years}", added to a step's label with SHOW_STAGE_EXPECTED on */
    stageButtonExpected: string;
    /** ", {n} delayed", added to a step's label: English on every page today */
    stageButtonDelayed: string;
    /** the expected time under a step; {years} is drawn bold */
    expectedTag: string;
  };
  /** the step panel's tally chips, shown only with SHOW_PROGRESS on */
  stepPanel: { statusCounts: { complete: string; inProgress: string; delayed: string; notStarted: string } };
  board: {
    columns: { mainBarrier: string };
    /** what "Delayed" means, behind its i button */
    delayedDefinition: string;
    /** "{status}: {definition}", the i button's text */
    delayedHint: string;
    /** the Main barrier cell when there is none */
    noBarrier: string;
  };
  product: {
    viewTimeTaken: string;
    /** a Journey column dot's tooltip */
    dotTitle: string;
    timeline: { delayed: string };
  };
  /** the yardstick comparison (DISPLAY.yardCompare, off as shipped) */
  yardstick: {
    soFar: string;
    notApprovedYet: string;
    expected: string;
    routineUseBy: string;
    actual: string;
    actualSoFar: string;
    since: string;
    sinceNotRoutine: string;
    variance: string;
    fromExpected: string;
    expectedRoutineUse: string;
    stillNotRoutine: string;
    largestVariance: string;
    notApprovedTitle: string;
    notApprovedBody: string;
    stageHeading: string;
    wholeJourney: string;
    notePublished: string;
    noteEstimate: string;
    doneNoDate: string;
    ongoingNoStart: string;
    onTrackSoFar: string;
  };
}

export const NOT_IN_MESSAGES: Record<Locale, HeldText> = {
  en: {
    common: {
      status: {
        delayed: "Delayed",
      },
    },
    pathway: {
      stageButtonExpected: ", expected {years}",
      stageButtonDelayed: ", {n} delayed",
      expectedTag: "{years} expected",
    },
    stepPanel: {
      statusCounts: {
        complete: "complete",
        inProgress: "in progress",
        delayed: "delayed",
        notStarted: "not started",
      },
    },
    board: {
      columns: {
        mainBarrier: "Main barrier",
      },
      delayedDefinition: "the medicine's current stage has stalled or is moving unusually slowly, in LAUNCH's judgement from public evidence. The main barrier gives the reason. It is not measured against a set deadline.",
      delayedHint: "{status}: {definition}",
      noBarrier: "No publicly documented barrier identified",
    },
    product: {
      viewTimeTaken: "Time taken",
      dotTitle: "{stage}: {status}",
      timeline: {
        delayed: "delayed",
      },
    },
    yardstick: {
      soFar: "so far",
      notApprovedYet: "Not approved yet",
      expected: "Expected",
      routineUseBy: "routine use by {year}",
      actual: "Actual",
      actualSoFar: "Actual so far",
      since: "since {year}",
      sinceNotRoutine: "since {year}, not yet in routine use",
      variance: "Variance",
      fromExpected: "from expected",
      expectedRoutineUse: "Expected in routine use by {due}, {n} years after its first milestone in {start}.",
      stillNotRoutine: "Still not in routine use in {year}.",
      largestVariance: "Largest variance:",
      notApprovedTitle: "Not approved yet.",
      notApprovedBody: "We start comparing once the medicine has a dated regulatory approval.",
      stageHeading: "Stage",
      wholeJourney: "Whole journey",
      notePublished: "Expected times from a published timeline: {stages}.",
      noteEstimate: "Expected times from LAUNCH's working estimates, still to be agreed: {stages}.",
      doneNoDate: "Done, no date recorded",
      ongoingNoStart: "Ongoing, no start date",
      onTrackSoFar: "On track so far",
    },
  },
  fr: {
    common: {
      status: {
        delayed: "Retardé",
      },
    },
    pathway: {
      stageButtonExpected: ", attendu {years}",
      stageButtonDelayed: ", {n} delayed",
      expectedTag: "{years} attendu",
    },
    stepPanel: {
      statusCounts: {
        complete: "complet",
        inProgress: "en cours",
        delayed: "retardé",
        notStarted: "pas commencé",
      },
    },
    board: {
      columns: {
        mainBarrier: "Barrière principale",
      },
      delayedDefinition: "Le développement du médicament est actuellement au point mort ou progresse anormalement lentement, selon l’évaluation de LAUNCH basée sur des informations publiques. Le principal obstacle en est la raison. Il n’est pas assorti d’un délai précis.",
      delayedHint: "{status}: {definition}",
      noBarrier: "Aucun obstacle documenté publiquement n’a été identifié.",
    },
    product: {
      viewTimeTaken: "Temps passé",
      dotTitle: "{stage}: {status}",
      timeline: {
        delayed: "retardé",
      },
    },
    yardstick: {
      soFar: "jusqu’à présent",
      notApprovedYet: "Pas encore approuvé",
      expected: "Attendu",
      routineUseBy: "utilisation courante par {year}",
      actual: "Réel",
      actualSoFar: "Situation actuelle jusqu’à présent",
      since: "depuis {year}",
      sinceNotRoutine: "depuis {year}, pas encore en usage courant",
      variance: "Variance",
      fromExpected: "par rapport aux attentes",
      expectedRoutineUse: "Son utilisation courante est prévue d’ici {due}, {n} ans après sa première étape importante en {start}.",
      stillNotRoutine: "Toujours pas d’usage courant dans {year}.",
      largestVariance: "Variance la plus importante :",
      notApprovedTitle: "Pas encore approuvé.",
      notApprovedBody: "Nous commençons la comparaison une fois que le médicament a reçu une autorisation de mise sur le marché datée.",
      stageHeading: "Scène",
      wholeJourney: "Tout le voyage",
      notePublished: "Délais prévus d’après le calendrier publié : {stages}.",
      noteEstimate: "Délais prévus d’après les estimations de travail de LAUNCH, encore à convenir : {stages}.",
      doneNoDate: "Terminé, aucune date enregistrée",
      ongoingNoStart: "En cours, sans date de début",
      onTrackSoFar: "Tout se déroule comme prévu jusqu’à présent",
    },
  },
  pt: {
    common: {
      status: {
        delayed: "Atrasado",
      },
    },
    pathway: {
      stageButtonExpected: ", esperado {years}",
      stageButtonDelayed: ", {n} delayed",
      expectedTag: "{years} esperado",
    },
    stepPanel: {
      statusCounts: {
        complete: "concluir",
        inProgress: "em curso",
        delayed: "atrasado",
        notStarted: "não iniciado",
      },
    },
    board: {
      columns: {
        mainBarrier: "Barreira principal",
      },
      delayedDefinition: "O estado atual do medicamento estagnou ou está a avançar de forma excecionalmente lenta, na avaliação de LAUNCH com base em evidência pública. A principal barreira explica o motivo. Não existe um prazo definido para a sua avaliação.",
      delayedHint: "{status}: {definition}",
      noBarrier: "Nenhuma barreira publicamente documentada foi identificada.",
    },
    product: {
      viewTimeTaken: "Tempo gasto",
      dotTitle: "{stage}: {status}",
      timeline: {
        delayed: "atrasado",
      },
    },
    yardstick: {
      soFar: "até agora",
      notApprovedYet: "Ainda não aprovado",
      expected: "Esperado",
      routineUseBy: "uso de rotina por {year}",
      actual: "Real",
      actualSoFar: "Até ao momento, está tudo bem.",
      since: "desde {year}",
      sinceNotRoutine: "desde {year}, ainda não é de uso rotineiro",
      variance: "Variância",
      fromExpected: "do esperado",
      expectedRoutineUse: "Prevê-se que entre em uso de rotina em {due}, {n} anos após o seu primeiro marco em {start}.",
      stillNotRoutine: "Ainda não é de uso rotineiro em {year}.",
      largestVariance: "Maior variação:",
      notApprovedTitle: "Ainda não foi aprovado.",
      notApprovedBody: "Começamos a comparar assim que o medicamento tem uma aprovação regulamentar com data de expiração.",
      stageHeading: "Fase",
      wholeJourney: "Toda a viagem",
      notePublished: "Horários previstos com base num cronograma publicado: {stages}.",
      noteEstimate: "Tempos previstos a partir das estimativas de trabalho de LAUNCH, ainda a acordar: {stages}.",
      doneNoDate: "Feito, sem data registada",
      ongoingNoStart: "Em curso, sem data de início definida.",
      onTrackSoFar: "Até agora, tudo dentro do esperado.",
    },
  },
};

/** "a.b.c" for every text in the message files. */
type Leaves<T, P extends string = ""> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];

export type MessageKey = Leaves<Messages>;

export const KEPT_FROM_PAGES: Record<Locale, Partial<Record<MessageKey, string>>> = {
  en: {},
  // Every French difference is the apostrophe: today's page has the
  // typographic ’ (U+2019) in these texts, the message file a straight '
  // (U+0027). The page itself mixes the two (61 ’ and 279 ' in fr/index.html;
  // fr.json has 8 and 84), so neither is "the" French style yet.
  fr: {
    "banner.mockupLink":
      "Lisez l’avertissement",
    "board.accessSoFar":
      "{duration} jusqu’à présent",
    "board.accessUnderOneYear":
      "Moins d’un an jusqu’à présent",
    "disclaimer.countriesNotVerified":
      "Les étapes nationales n’ont pas encore été vérifiées pour : {medicines}.",
    "errors.dataFailedTitle":
      "Les données du tableau de bord n’ont pas pu être chargées.",
    "feedback.doneMessage":
      "L’équipe LAUNCH lit chaque message et, lorsque vous nous indiquez une source publique vérifiée, nous corrigeons les données lors de la prochaine mise à jour. Si vous avez laissé une adresse e-mail, toute réponse de notre part mentionnera la référence ci-dessous.",
    "feedback.failed":
      "Désolé(e), votre commentaire n’a pas pu être envoyé pour le moment. Veuillez réessayer dans quelques instants.",
    "feedback.messagePlaceholder":
      "Par exemple, la carte indique que ce médicament n’est pas encore enregistré en Tanzanie, mais il y a été approuvé en juin 2026.",
    "feedback.messageTooShort":
      "Un peu plus de détails, s’il vous plaît — au moins 10 caractères.",
    "feedback.notConnected.doneMessage":
      "Ce formulaire n’est pas encore associé à une boîte de réception ; votre message est donc resté dans cet onglet. Dès que la connexion sera établie, l’équipe LAUNCH lira chaque message et, si vous nous avez indiqué une source publique valide, nous corrigerons les données lors de la prochaine mise à jour.",
    "feedback.notConnected.doneTitle":
      "Merci — même si ce message n’a encore été envoyé nulle part.",
    "feedback.notConnected.note":
      "Simulation uniquement — L’envoi de commentaires n’est pas encore activé.",
    "feedback.note":
      "Votre adresse e-mail est facultative et sert uniquement à vous répondre. Votre message nous permet d’envoyer la page que vous consultez, la version des données affichées et votre navigateur, afin que l’équipe puisse voir ce que vous avez vu.",
    "feedback.productLabel":
      "De quel médicament s’agit-il ?",
    "map.finder.searchPlaceholder":
      "Saisissez le nom d’un pays…",
    "map.panel.backToOverview":
      "Retour à l’aperçu",
    "map.panel.countrySources":
      "Sources pour cette étape d’accès :",
    "map.panel.inWhoPolicy":
      "dans la politique de l’OMS {year}",
    "map.panel.moreInCountriesTab":
      "+{count} Plus d’informations dans l’onglet Pays",
    "map.panel.preLaunchCountry":
      "{medicine} est en phase de pré-lancement, il n’y a donc pas encore de statut ni de politique concernant certains pays.",
    "map.panel.preLaunchOverview":
      "{medicine} est en phase de pré-lancement, il n’y a donc pas encore de statut ou de politique au niveau national.",
    "map.panel.selectHint":
      "Sélectionnez un pays sur la carte ou dans l’onglet Pays pour ouvrir sa page.",
    "map.panel.stageMixCount":
      "{total} pays ont une étape d’accès",
    "map.panel.stageMixTitle":
      "Mix d’accès à la scène · {medicine}",
    "product.cards.accessCommitments":
      "Engagements en matière d’accès et d’approvisionnement",
    "product.cards.adoption":
      "exigences d’adoption",
    "product.cards.useCase":
      "Cas d’utilisation cible",
    "product.milestones.dateAchieved":
      "Date d’obtention / de soumission",
    "product.procurement.globalFundOnly":
      "100 % des transactions figurant dans l’ensemble de données présenté proviennent du programme PQR du Fonds mondial ; il ne s’agit pas de l’ensemble des achats mondiaux du produit.",
    "product.stagePanel.adoptionNeeds":
      "Quels sont les besoins en matière d’adoption ?",
    "product.stagePanel.surveyIllustrative":
      "L’enquête nationale est illustrative",
    "product.stagePanel.surveyStatus":
      "L’enquête nationale est {status}",
    "product.timeline.today":
      "aujourd’hui",
    "stepPanel.parallelMilestones":
      "{first} et {second} sont des étapes parallèles au sein de l’étape {n}.",
    "subscribe.failed":
      "Désolé, nous n’avons pas pu vous ajouter pour le moment. Veuillez réessayer dans quelques instants.",
  },
  pt: {},
};

/**
 * A text today's page writes two ways under one message key, kept for the
 * one place that differs from the message file. The French page heads the
 * map legend "Étape d'accès" (its static markup, as fr.json has
 * map.accessStage) and the filter table "Étape d’accès" (its script).
 */
export const KEPT_IN_ONE_PLACE: Record<Locale, { "map.filterStage"?: string }> = {
  en: {},
  fr: { "map.filterStage": "Étape d’accès" },
  pt: {},
};
