// The words lib/format.ts and lib/stages.ts put into their results, and the
// four status words, two phase names and "N years" every area shares, built
// from the message files (lib/ui-text.ts). Until 28 Oct 2026 this was a table
// copied from the built pages; that table is now tests/fixtures/text/page-text.ts,
// and tests/text-parity.test.ts proves pageText() returns exactly it.
//
// "{name}" marks where a value goes. The singular is used for exactly 1 in
// every language, as on the pages, not each language's own plural rule:
// French writes "0 années".
import type { Status } from "./dataset";
import type { Locale } from "./locales";
import { rename, uiText } from "./ui-text";

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

const built = new Map<Locale, PageText>();

/** One language's PageText. Built once per language: the stage rules call it for every value. */
export function pageText(locale: Locale): PageText {
  let t = built.get(locale);
  if (!t) {
    const m = uiText(locale);
    t = {
      status: {
        done: m.common.status.complete,
        prog: m.common.status.inProgress,
        late: m.common.status.delayed,
        idle: m.common.status.notStarted,
      },
      phases: [m.common.phases.market, m.common.phases.country],
      year: m.common.yearsOne,
      years: m.common.yearsOther,
      reachedIn: m.board.accessReachedIn,
      reachedNoYear: m.board.accessReachedNoYear,
      soFar: rename(m.board.accessSoFar, { duration: "years" }),
      underOneYearSoFar: m.board.accessUnderOneYear,
      notYetReached: m.board.accessNotReached,
      expected: m.tooltip.expected,
      doneNoDate: m.yardstick.doneNoDate,
      ongoingNoStart: m.yardstick.ongoingNoStart,
      onTrackSoFar: m.yardstick.onTrackSoFar,
    };
    built.set(locale, t);
  }
  return t;
}

/** Puts values into a "{name}" template. */
export function fill(template: string, values: { [name: string]: string | number }): string {
  return template.replace(/\{(\w+)\}/g, (_, name: string) => String(values[name]));
}
