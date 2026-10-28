// The interface text of the pathway strip (#pathway), the step panel
// (#gatewrap), a medicine's stage panel (.gatepanel), the Country access
// card's rows and the stage marker's hover hint, built from the message
// files (lib/ui-text.ts). Until 28 Oct 2026 this was a table copied from the
// built pages at launch-rbm-test 7c1bf11; that table is now
// tests/fixtures/text/pathway-text.ts, which tests/markup-pathway.test.ts
// compares with those pages' markup, and tests/text-parity.test.ts proves
// pathwayText() returns exactly it, mistakes included (pt "Perto" for Close;
// fr "Scène" in the step panel's label; ", N delayed" in English everywhere).
//
// "{name}" marks where a value goes (filled by fill() in lib/strings.ts, or
// fillNodes() where the value is markup). The status words, the two phase
// names and "N years" are not here: they come from lib/strings.ts, which the
// stage rules share.
import type { Status } from "@/lib/dataset";
import type { Locale } from "@/lib/locales";
import { rename, type UiText, uiText } from "@/lib/ui-text";

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

// by the messages object, not the language: new messages handed over by RBM
// (lib/messages.ts provideMessages) build the text again
const built = new WeakMap<UiText, PathwayText>();

/** One language's PathwayText, built once. */
export function pathwayText(locale: Locale): PathwayText {
  const m = uiText(locale);
  let t = built.get(m);
  if (t) return t;
  const counts = m.stepPanel.statusCounts;
  // The step's label in the message files is the sentence as shown today;
  // the page also had room in it for two parts that are switched off (the
  // expected time after the name, the delayed count before the full stop).
  const label = m.pathway.stageButtonLabel;
  if (!label.includes("{stage}") || !label.endsWith(".")) {
    throw new Error(`pathway.stageButtonLabel "${label}" has no {stage} or no final full stop`);
  }
  t = {
    pathwayLabel: m.pathway.label,
    nodeLabel: label.replace("{stage}", "{stage}{expected}").replace(/\.$/, "{delayed}."),
    nodeExpected: m.pathway.stageButtonExpected,
    nodeDelayed: m.pathway.stageButtonDelayed,
    expectedTag: m.pathway.expectedTag,
    pairJoin: ` ${m.common.and} `,
    pairLabel: m.pathway.parallelGroupLabel,
    stepPanelLabel: m.stepPanel.label,
    stepOf: m.stepPanel.stepOfTotal,
    summaryLabel: m.stepPanel.statusSummaryLabel,
    statusNoun: { done: counts.complete, prog: counts.inProgress, late: counts.delayed, idle: counts.notStarted },
    close: m.common.close,
    parallel: rename(m.stepPanel.parallelMilestones, { first: "a", second: "b" }),
    whatHappens: m.stepPanel.whatHappens,
    whoDecides: m.stepPanel.whoDecides,
    whyStall: m.stepPanel.whyItCanStall,
    source: m.stepPanel.source,
    recorded: m.product.stagePanel.recorded,
    nextStep: m.product.stagePanel.nextStep,
    expected: m.product.stagePanel.expected,
    pendingSince: m.product.stagePanel.pendingSince,
    adoptionNeeds: m.product.stagePanel.adoptionNeeds,
    levels: {
      registered: m.common.accessLevels.registered,
      guidelines: m.common.accessLevels.guidelines,
      mft: m.common.accessLevels.mft,
    },
    sourceLine: `${m.common.sourceLabel} {cites}`,
    verified: m.product.stagePanel.verifiedOn,
    surveyIllustrative: m.product.stagePanel.surveyIllustrative,
    surveyStatus: m.product.stagePanel.surveyStatus,
    onMap: m.product.cards.countriesOnMap,
    confirmed: m.product.cards.confirmedInRegisters,
    clickForDetail: m.tooltip.clickForDetail,
  };
  built.set(m, t);
  return t;
}
