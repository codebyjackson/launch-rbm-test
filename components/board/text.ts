// The medicine board's interface text, built from the message files
// (lib/ui-text.ts). Until 28 Oct 2026 this was a table copied from the built
// pages at launch-rbm-test 7c1bf11, mistranslations included (fr "Plomb", the
// metal, for Lead); that table is now tests/fixtures/text/board-text.ts, which
// tests/markup-board.test.ts compares with those pages' markup, and
// tests/text-parity.test.ts proves boardText() returns exactly it.
//
// The words the board shares with lib/stages.ts (the four status words, the
// two phases, "3 years") are lib/strings.ts's pageText(), so there is one
// copy of each. The stage panel, the Country access rows and the hints are
// the pathway area's (components/pathway/), so their words are in its text.
//
// "{name}" marks where a value goes.
import type { Locale } from "@/lib/locales";
import { rename, uiText } from "@/lib/ui-text";

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

const built = new Map<Locale, BoardText>();

/** One language's BoardText, built once. */
export function boardText(locale: Locale): BoardText {
  let t = built.get(locale);
  if (t) return t;
  const m = uiText(locale);
  const y = m.yardstick;
  const tl = m.product.timeline;
  const cards = m.product.cards;
  const proc = m.product.procurement;
  const ms = m.product.milestones;
  t = {
    colMedicine: m.board.columns.medicine,
    colJourney: m.board.columns.journey,
    colStage: m.board.columns.currentStage,
    colStatus: m.board.columns.status,
    colAccess: m.board.columns.access,
    colBarrier: m.board.columns.mainBarrier,
    lateDef: m.board.delayedDefinition,
    lateTip: m.board.delayedHint,
    accessDef: m.board.accessDefinition,
    showJourney: rename(m.board.showJourney, { medicine: "name" }),
    noBarrier: m.board.noBarrier,
    journeyView: m.product.journeyView,
    viewTime: m.product.viewTimeline,
    viewPath: m.product.viewPathway,
    viewTaken: m.product.viewTimeTaken,
    moreDetail: m.product.moreDetail,
    hideDetail: m.product.hideDetail,
    miniLabel: m.board.milestonesComplete,
    dotTitle: m.product.dotTitle,
    markLabel: rename(m.product.stageMarkerLabel, { status: "peek" }),
    today: tl.today,
    since: rename(tl.since, { milestone: "label", duration: "years" }),
    chipLate: tl.delayed,
    chipOngoing: tl.ongoing,
    none: tl.none,
    notStarted: rename(tl.notStarted, { count: "n" }),
    noYear: tl.reachedNoYear,
    ongoingNoDate: tl.ongoingNoDate,
    notYetDated: tl.notYetDated,
    listJoin: ` ${m.common.and} `,
    forkLabel: m.product.parallelGroupLabel,
    soFar: y.soFar,
    notApprovedYet: y.notApprovedYet,
    expected: y.expected,
    routineUseBy: y.routineUseBy,
    actual: y.actual,
    actualSoFar: y.actualSoFar,
    sinceYear: y.since,
    sinceNotRoutine: y.sinceNotRoutine,
    variance: y.variance,
    fromExpected: y.fromExpected,
    boxLine: y.expectedRoutineUse,
    stillNotRoutine: y.stillNotRoutine,
    largestVariance: y.largestVariance,
    notApprovedTitle: y.notApprovedTitle,
    notApprovedBody: y.notApprovedBody,
    stage: y.stageHeading,
    wholeJourney: y.wholeJourney,
    notePublished: y.notePublished,
    noteEstimate: y.noteEstimate,
    useCase: cards.useCase,
    accessCommitments: cards.accessCommitments,
    adoptionRequirements: cards.adoption,
    countryAccess: cards.countryAccess,
    forecastDemand: cards.forecastDemand,
    research: cards.research,
    lead: cards.researchLead,
    geographies: cards.researchGeographies,
    timeline: cards.researchTimeline,
    procurement: proc.title,
    procScope: proc.globalFundOnly,
    presentation: proc.presentation,
    transactions: proc.transactions,
    packs: proc.packs,
    courses: proc.courses,
    notEstimated: proc.notEstimated,
    dataNotYetAvailable: proc.notAvailable,
    acknowledgement: cards.acknowledgement,
    source: m.common.sourceLabel,
    msMilestone: ms.milestone,
    msStatus: ms.status,
    msDate: ms.dateAchieved,
    msNext: ms.nextStep,
    msAnticipated: ms.anticipated,
  };
  built.set(locale, t);
  return t;
}
