// TEMPORARY: replaced by the message files in step 2 of the port.
//
// The medicine board's interface text, one table per language, copied from
// the built pages at launch-rbm-test 7c1bf11 (en|fr|pt/index.html), wording
// and punctuation as they are there, mistranslations included (fr "Plomb",
// the metal, for Lead): the message files are where they get fixed.
// tests/markup-board.test.ts renders the board with each table and compares
// it with those pages' own markup.
//
// The words the board shares with lib/stages.ts (the four status words, the
// two phases, "3 years") stay in lib/strings.ts, so there is one copy of each.
// The stage panel, the Country access rows and the hints are the pathway
// area's (components/pathway/), so their words are in its table, not here.
//
// "{name}" marks where a value goes, the form the message files will use.
import type { Locale } from "@/lib/locales";

export interface BoardText {
  // Header row of the medicines table
  colMedicine: string;
  colJourney: string;
  colStage: string;
  colStatus: string;
  /** before the i that explains Market and Country Access */
  colAccess: string;
  /** shown only with BoardDisplay.showBarriers */
  colBarrier: string;

  // Definitions behind the i buttons
  /** LATE_DEF: what "Delayed" means */
  lateDef: string;
  /** the i beside Delayed: {status} is the status word */
  lateTip: string;
  /** ACCESS_DEF: what the two access figures mean */
  accessDef: string;

  // A medicine's row
  /** the row's chevron, for screen readers */
  showJourney: string;
  /** the Main barrier cell when there is none */
  noBarrier: string;
  /** the view switch, for screen readers */
  journeyView: string;
  viewTime: string;
  viewPath: string;
  /** shown only with the yardstick comparison on */
  viewTaken: string;
  moreDetail: string;
  hideDetail: string;
  /** the Journey column's dots, for screen readers */
  miniLabel: string;
  /** one dot's tooltip; without {status} where the word is hidden */
  dotTitle: string;

  // Stage markers
  /** {peek} is peekLine's one line */
  markLabel: string;

  // The Actual timeline view
  /** beside today's year on the axis */
  today: string;
  /** under the current gate; {years} is yrsText's */
  since: string;
  /** an undated step's status, lower case */
  chipLate: string;
  chipOngoing: string;
  /** an empty group */
  none: string;
  notStarted: string;
  noYear: string;
  ongoingNoDate: string;
  /** in place of ongoingNoDate when the status words are hidden */
  notYetDated: string;

  // The Pathway order view
  /** between the names of a parallel pair, spaces included */
  listJoin: string;
  /** a parallel pair, for screen readers; {names} joined by listJoin */
  forkLabel: string;

  // The yardstick comparison (off as shipped: DISPLAY.yardCompare)
  soFar: string;
  /** the badge under the access figures */
  notApprovedYet: string;
  expected: string;
  routineUseBy: string;
  actual: string;
  actualSoFar: string;
  sinceYear: string;
  /** sinceYear, once the expected year has passed */
  sinceNotRoutine: string;
  variance: string;
  fromExpected: string;
  /** {n} is a plain number: the page wrote "years" even for 1 */
  boxLine: string;
  stillNotRoutine: string;
  /** before the stage's name */
  largestVariance: string;
  notApprovedTitle: string;
  notApprovedBody: string;
  /** the Time taken table's first heading */
  stage: string;
  wholeJourney: string;
  /** {stages}: stage names joined by ", " */
  notePublished: string;
  noteEstimate: string;

  // More detail: the cards and the milestone table
  useCase: string;
  accessCommitments: string;
  adoptionRequirements: string;
  countryAccess: string;
  forecastDemand: string;
  research: string;
  lead: string;
  geographies: string;
  timeline: string;
  procurement: string;
  /** in place of the bar, when the only channel is Global Fund PQR */
  procScope: string;
  presentation: string;
  transactions: string;
  packs: string;
  courses: string;
  notEstimated: string;
  /** when there are no figures and no volumeNote */
  dataNotYetAvailable: string;
  acknowledgement: string;
  /** before a claim's citations; a space follows */
  source: string;
  msMilestone: string;
  msStatus: string;
  msDate: string;
  msNext: string;
  msAnticipated: string;
}

export const BOARD_TEXT: Record<Locale, BoardText> = {
  en: {
    colMedicine: "Medicine",
    colJourney: "Journey",
    colStage: "Current stage",
    colStatus: "Status",
    colAccess: "Access",
    colBarrier: "Main barrier",
    lateDef: "the medicine's current stage has stalled or is moving unusually slowly, in LAUNCH's judgement from public evidence. The main barrier gives the reason. It is not measured against a set deadline.",
    lateTip: "{status}: {definition}",
    accessDef: "Market Access is reached when a medicine is both recommended by WHO and WHO-prequalified. Country Access runs from then until national registration, policy adoption, procurement in significant volumes and in-country delivery are all complete.",
    showJourney: "Show journey for {name}",
    noBarrier: "No publicly documented barrier identified",
    journeyView: "Journey view",
    viewTime: "Actual timeline",
    viewPath: "Pathway order",
    viewTaken: "Time taken",
    moreDetail: "More detail",
    hideDetail: "Hide detail",
    miniLabel: "{done} of {total} milestones complete",
    dotTitle: "{stage}: {status}",
    markLabel: "{stage}. {peek}. Opens the full detail.",
    today: "today",
    since: "since {label} ({year}) · {years}",
    chipLate: "delayed",
    chipOngoing: "ongoing",
    none: "None",
    notStarted: "Not started · {n}",
    noYear: "Reached · year not recorded",
    ongoingNoDate: "Ongoing · no date",
    notYetDated: "Not yet dated",
    listJoin: " and ",
    forkLabel: "{names} — independent approvals, no defined order between them",
    soFar: "so far",
    notApprovedYet: "Not approved yet",
    expected: "Expected",
    routineUseBy: "routine use by {year}",
    actual: "Actual",
    actualSoFar: "Actual so far",
    sinceYear: "since {year}",
    sinceNotRoutine: "since {year}, not yet in routine use",
    variance: "Variance",
    fromExpected: "from expected",
    boxLine: "Expected in routine use by {due}, {n} years after its first milestone in {start}.",
    stillNotRoutine: "Still not in routine use in {year}.",
    largestVariance: "Largest variance:",
    notApprovedTitle: "Not approved yet.",
    notApprovedBody: "We start comparing once the medicine has a dated regulatory approval.",
    stage: "Stage",
    wholeJourney: "Whole journey",
    notePublished: "Expected times from a published timeline: {stages}.",
    noteEstimate: "Expected times from LAUNCH's working estimates, still to be agreed: {stages}.",
    useCase: "Target use case",
    accessCommitments: "Access & supply commitments",
    adoptionRequirements: "Adoption requirements",
    countryAccess: "Country access",
    forecastDemand: "Forecast demand",
    research: "Operational research",
    lead: "Lead",
    geographies: "Geographies",
    timeline: "Timeline",
    procurement: "Procurement through public channels",
    procScope: "100% of transactions in the dataset shown are from Global Fund PQR; this is not the product's total global procurement.",
    presentation: "Presentation",
    transactions: "Transactions",
    packs: "Packs",
    courses: "Treatment courses (est.)",
    notEstimated: "not estimated",
    dataNotYetAvailable: "Data not yet available",
    acknowledgement: "Acknowledgement",
    source: "Source:",
    msMilestone: "Milestone",
    msStatus: "Status",
    msDate: "Date achieved / submitted",
    msNext: "Next expected step",
    msAnticipated: "Anticipated",
  },
  fr: {
    colMedicine: "Médecine",
    colJourney: "Voyage",
    colStage: "Stade actuel",
    colStatus: "Statut",
    colAccess: "Accéder",
    colBarrier: "Barrière principale",
    lateDef: "Le développement du médicament est actuellement au point mort ou progresse anormalement lentement, selon l’évaluation de LAUNCH basée sur des informations publiques. Le principal obstacle en est la raison. Il n’est pas assorti d’un délai précis.",
    lateTip: "{status}: {definition}",
    accessDef: "L’accès au marché est accordé lorsqu’un médicament est à la fois recommandé par l’OMS et préqualifié par celle-ci. L’accès au pays intervient ensuite jusqu’à ce que l’enregistrement national, l’adoption de politiques de santé, l’approvisionnement en volumes importants et la distribution dans le pays soient achevés.",
    showJourney: "Afficher le parcours pour {name}",
    noBarrier: "Aucun obstacle documenté publiquement n’a été identifié.",
    journeyView: "Vue du voyage",
    viewTime: "Chronologie réelle",
    viewPath: "Ordre du parcours",
    viewTaken: "Temps passé",
    moreDetail: "Plus de détails",
    hideDetail: "Masquer les détails",
    miniLabel: "{done} sur {total} étapes franchies",
    dotTitle: "{stage}: {status}",
    markLabel: "{stage}. {peek}. Ouvre les détails complets.",
    today: "aujourd’hui",
    since: "depuis {label} ({year}) · {years}",
    chipLate: "retardé",
    chipOngoing: "en cours",
    none: "Aucun",
    notStarted: "Pas encore démarré · {n}",
    noYear: "Atteint · année non enregistrée",
    ongoingNoDate: "En cours · sans date",
    notYetDated: "Pas encore daté",
    listJoin: " et ",
    forkLabel: "{names} — approbations indépendantes, sans ordre défini entre elles",
    soFar: "jusqu’à présent",
    notApprovedYet: "Pas encore approuvé",
    expected: "Attendu",
    routineUseBy: "utilisation courante par {year}",
    actual: "Réel",
    actualSoFar: "Situation actuelle jusqu’à présent",
    sinceYear: "depuis {year}",
    sinceNotRoutine: "depuis {year}, pas encore en usage courant",
    variance: "Variance",
    fromExpected: "par rapport aux attentes",
    boxLine: "Son utilisation courante est prévue d’ici {due}, {n} ans après sa première étape importante en {start}.",
    stillNotRoutine: "Toujours pas d’usage courant dans {year}.",
    largestVariance: "Variance la plus importante :",
    notApprovedTitle: "Pas encore approuvé.",
    notApprovedBody: "Nous commençons la comparaison une fois que le médicament a reçu une autorisation de mise sur le marché datée.",
    stage: "Scène",
    wholeJourney: "Tout le voyage",
    notePublished: "Délais prévus d’après le calendrier publié : {stages}.",
    noteEstimate: "Délais prévus d’après les estimations de travail de LAUNCH, encore à convenir : {stages}.",
    useCase: "Cas d’utilisation cible",
    accessCommitments: "Engagements en matière d’accès et d’approvisionnement",
    adoptionRequirements: "exigences d’adoption",
    countryAccess: "Accès au pays",
    forecastDemand: "Prévision de la demande",
    research: "Recherche opérationnelle",
    lead: "Plomb",
    geographies: "Géographies",
    timeline: "Chronologie",
    procurement: "Achats par voie publique",
    procScope: "100 % des transactions figurant dans l’ensemble de données présenté proviennent du programme PQR du Fonds mondial ; il ne s’agit pas de l’ensemble des achats mondiaux du produit.",
    presentation: "Presentation",
    transactions: "Transactions",
    packs: "Packs",
    courses: "Durée du traitement (estimation)",
    notEstimated: "not estimated",
    dataNotYetAvailable: "Données non disponibles pour le moment",
    acknowledgement: "Reconnaissance",
    source: "Source:",
    msMilestone: "Jalon",
    msStatus: "Statut",
    msDate: "Date d’obtention / de soumission",
    msNext: "Prochaine étape prévue",
    msAnticipated: "Prévu",
  },
  pt: {
    colMedicine: "Medicina",
    colJourney: "Jornada",
    colStage: "Estágio atual",
    colStatus: "Estatuto",
    colAccess: "Acesso",
    colBarrier: "Barreira principal",
    lateDef: "O estado atual do medicamento estagnou ou está a avançar de forma excecionalmente lenta, na avaliação de LAUNCH com base em evidência pública. A principal barreira explica o motivo. Não existe um prazo definido para a sua avaliação.",
    lateTip: "{status}: {definition}",
    accessDef: "O acesso ao mercado é conseguido quando um medicamento é recomendado pela OMS e pré-qualificado por esta. O acesso no país estende-se a partir desse momento até que o registo nacional, a adoção de políticas, a aquisição em volumes significativos e a distribuição no país estejam concluídos.",
    showJourney: "Mostrar viagem para {name}",
    noBarrier: "Nenhuma barreira publicamente documentada foi identificada.",
    journeyView: "Visão da viagem",
    viewTime: "Cronograma real",
    viewPath: "Ordem do caminho",
    viewTaken: "Tempo gasto",
    moreDetail: "Mais detalhes",
    hideDetail: "Ocultar detalhes",
    miniLabel: "{done} de {total} marcos concluídos",
    dotTitle: "{stage}: {status}",
    markLabel: "{stage}. {peek}. Abre os detalhes completos.",
    today: "hoje",
    since: "desde {label} ({year}) · {years}",
    chipLate: "atrasado",
    chipOngoing: "em curso",
    none: "Nenhum",
    notStarted: "Não iniciado · {n}",
    noYear: "Atingido · ano não registado",
    ongoingNoDate: "Em curso · sem data",
    notYetDated: "Ainda não tem data.",
    listJoin: " e ",
    forkLabel: "{names} — aprovações independentes, sem ordem definida entre elas",
    soFar: "até agora",
    notApprovedYet: "Ainda não aprovado",
    expected: "Esperado",
    routineUseBy: "uso de rotina por {year}",
    actual: "Real",
    actualSoFar: "Até ao momento, está tudo bem.",
    sinceYear: "desde {year}",
    sinceNotRoutine: "desde {year}, ainda não é de uso rotineiro",
    variance: "Variância",
    fromExpected: "do esperado",
    boxLine: "Prevê-se que entre em uso de rotina em {due}, {n} anos após o seu primeiro marco em {start}.",
    stillNotRoutine: "Ainda não é de uso rotineiro em {year}.",
    largestVariance: "Maior variação:",
    notApprovedTitle: "Ainda não foi aprovado.",
    notApprovedBody: "Começamos a comparar assim que o medicamento tem uma aprovação regulamentar com data de expiração.",
    stage: "Fase",
    wholeJourney: "Toda a viagem",
    notePublished: "Horários previstos com base num cronograma publicado: {stages}.",
    noteEstimate: "Tempos previstos a partir das estimativas de trabalho de LAUNCH, ainda a acordar: {stages}.",
    useCase: "Caso de uso alvo",
    accessCommitments: "Compromissos de acesso e fornecimento",
    adoptionRequirements: "Requisitos de adoção",
    countryAccess: "Acesso ao país",
    forecastDemand: "Previsão da procura",
    research: "Pesquisa operacional",
    lead: "Liderar",
    geographies: "Geografias",
    timeline: "Linha do tempo",
    procurement: "Contratação através de canais públicos",
    procScope: "100% das transações do conjunto de dados apresentado são do Fundo Global PQR; este valor não representa o total das compras globais do produto.",
    presentation: "Presentation",
    transactions: "Transactions",
    packs: "Packs",
    courses: "Cursos de tratamento (est.)",
    notEstimated: "not estimated",
    dataNotYetAvailable: "Dados ainda não disponíveis",
    acknowledgement: "Reconhecimento",
    source: "Fonte:",
    msMilestone: "Marco",
    msStatus: "Estatuto",
    msDate: "Data de conclusão/entrega",
    msNext: "Próximo passo esperado",
    msAnticipated: "Antecipado",
  },
};
