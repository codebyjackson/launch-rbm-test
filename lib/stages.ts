// The static pages' stage rules, as pure functions: the year a stage was
// cleared, the two access phases, what the current gate has waited since, and
// the yardstick of expected times. Ported from the main script of
// launch-rbm-test 7c1bf11 (en/index.html), keeping the old names;
// tests/golden.test.ts checks each against the original in all three languages.
//
// The page read its data globals and display switches directly. Here they
// come in a StageContext, built once per page by stageContext(), and "today"
// is its asOfYear, so a test can set it.
import type {
  LaunchData,
  Product,
  StageColumn,
  StageEntry,
  Status,
  Yardstick,
  YardstickStep,
} from "./dataset";
import { firstClause } from "./format";
import type { Locale } from "./locales";
import { fill, pageText } from "./strings";

/**
 * The static pages' display switches, as set for the 10 Nov 2026 release.
 * Each hides something the data still holds, at the partners' or the owner's
 * request, until a definition is agreed; turning it on brings it back.
 */
export interface Display {
  /**
   * SHOW_PROGRESS: name a step "In progress" or "Delayed". Off since 20 Oct
   * 2026 (partner feedback sheet) until RBM and Unitaid agree a status taxonomy.
   */
  showProgress: boolean;
  /** PROGRESS_KEPT: medicines that keep those words anyway (owner, 20 Oct 2026). */
  progressKept: { [productId: string]: boolean };
  /**
   * SHOW_LATE: a late stage looks late. Off, it takes the in-progress look
   * everywhere, since its red still said "Delayed" (owner, 20 Oct 2026).
   */
  showLate: boolean;
  /**
   * YARD_COMPARE: compare each medicine's own dates with the yardstick. Off
   * at the partners' request (15 Oct 2026) until the benchmark method is agreed.
   */
  yardCompare: boolean;
}

export const DISPLAY: Display = {
  showProgress: false,
  progressKept: { alaq: true, ganlum: true },
  showLate: false,
  yardCompare: false,
};

/** What the stage rules read besides the product: the page's data and switches. */
export interface StageContext {
  locale: Locale;
  /** stage names, in the page's language */
  stages: string[];
  stageColumns: StageColumn[];
  yardstick: Yardstick | null;
  /**
   * The year "today" is: the dataset's own date, not the visitor's clock, so
   * "today" never reads later than the data was checked.
   */
  asOfYear: number;
  display: Display;
}

/** ASOF_YEAR: the year of the dataset's lastUpdated date. */
export function asOfYear(lastUpdated: string): number {
  return parseInt(lastUpdated.slice(0, 4), 10);
}

export function stageContext(
  data: LaunchData,
  locale: Locale,
  options: { asOfYear?: number; display?: Display } = {},
): StageContext {
  return {
    locale,
    stages: data.stages,
    // without stageColumns, every stage is its own column
    stageColumns: data.stageColumns || data.stages.map((_, i) => ({ stages: [i] })),
    yardstick: data.yardstick || null,
    asOfYear: options.asOfYear ?? asOfYear(data.meta.lastUpdated),
    display: options.display ?? DISPLAY,
  };
}

/**
 * SHOW_LATE, applied: the products as the page shows them. With showLate off,
 * every late stage and milestone reads as in progress. The page did this to
 * its data once at start-up, so every rule below sees it; the input is not
 * changed.
 */
export function applyShowLate(products: Product[], display: Display): Product[] {
  if (display.showLate) return products;
  const asProg = <T extends { status: Status }>(s: T): T => (s.status === "late" ? { ...s, status: "prog" } : s);
  return products.map((p) => {
    const milestones = p.detail && p.detail.milestones;
    return {
      ...p,
      stages: p.stages.map(asProg),
      ...(milestones ? { detail: { ...p.detail, milestones: milestones.map(asProg) } } : {}),
    };
  });
}

/** Is this status's word shown for this medicine? Complete and Not started always are. */
export function statusShown(p: Product, status: Status, display: Display): boolean {
  // a plain-object lookup, as on the page
  return display.showProgress || (status !== "prog" && status !== "late") || !!display.progressKept[p.id];
}

/**
 * The one line a stage marker shows on hover: the status word, then when the
 * gate was cleared or when it is expected. "TBC" is dropped: an unknown date
 * reads better as no date at all. With `shown` false the word goes and the
 * date stays.
 */
export function peekLine(
  status: Status,
  date: string | undefined,
  nextDate: string | undefined,
  shown: boolean,
  locale: Locale,
): string {
  const t = pageText(locale);
  const when = firstClause(date);
  const due = firstClause(nextDate);
  const expected = due && !/^tbc$/i.test(due) ? " · " + fill(t.expected, { date: due }) : "";
  if (status === "done") return t.status.done + (when ? " · " + when : "");
  if (status === "idle") return t.status.idle + expected;
  if (!shown) return when || expected.replace(/^ · /, "");
  return t.status[status] + (when ? " · " + when : expected);
}

/** One medicine's peekLine: the word goes where its status is hidden. */
export function peekLineFor(p: Product, ctx: StageContext) {
  return (status: Status, date: string | undefined, nextDate: string | undefined): string =>
    peekLine(status, date, nextDate, statusShown(p, status, ctx.display), ctx.locale);
}

/**
 * The year a stage was cleared, read out of its free-text date: the first
 * year in it, as a range starts at the year it was reached. Only a done stage
 * has one: a stage still under way carries a target, and a target must never
 * be drawn as elapsed time.
 */
export function stageYear(st: StageEntry | null | undefined): number | null {
  if (!st || st.status !== "done") return null;
  const m = String(st.date || "").match(/\b(19|20)\d{2}\b/);
  if (!m) return null;
  const y = +m[0];
  return y >= 1990 && y <= 2100 ? y : null;
}

/** "1 year", "3 years". */
export function yrsText(n: number, locale: Locale): string {
  const t = pageText(locale);
  return fill(n === 1 ? t.year : t.years, { n });
}

/** The earliest year any stage was cleared: where the pathway starts. */
export function firstYear(p: Product): number | null {
  const ys = p.stages.map((st) => stageYear(st)).filter((y): y is number => y != null);
  return ys.length ? Math.min(...ys) : null;
}

/**
 * Market Access is every stage before country registration; Country Access
 * starts at it and runs to in-country delivery.
 */
export const ACCESS_SPLIT = 4;

/** The access phase a stage belongs to: 0 Market Access, 1 Country Access. */
export function phaseOf(i: number): 0 | 1 {
  return i >= ACCESS_SPLIT ? 1 : 0;
}

/**
 * Whether phase k is reached, and when. A phase is reached when every stage in
 * it is complete, in the year of its latest dated stage (null when none is dated).
 */
export function phaseReached(p: Product, k: number): { year: number | null } | null {
  const idx = p.stages.map((_, i) => i).filter((i) => phaseOf(i) === k);
  if (!idx.every((i) => p.stages[i].status === "done")) return null;
  const ys = idx.map((i) => stageYear(p.stages[i])).filter((y): y is number => y != null);
  return { year: ys.length ? Math.max(...ys) : null };
}

export function reachedText(y: number | null, locale: Locale): string {
  const t = pageText(locale);
  return y != null ? fill(t.reachedIn, { year: y }) : t.reachedNoYear;
}

export function soFarText(n: number, locale: Locale): string {
  const t = pageText(locale);
  return n > 0 ? fill(t.soFar, { years: yrsText(n, locale) }) : t.underOneYearSoFar;
}

/** How a figure is shown: "ok" reached, "none" not reached, "" under way. */
export type AccessTone = "ok" | "none" | "";

/** One access phase as shown: its name, its figure, and how the figure is shown. */
export type AccessPart = [name: string, figure: string, tone: AccessTone];

/**
 * Each access phase shown for a medicine. Country Access appears only once
 * Market Access is reached, and counts from the year it was, not from earlier
 * country steps (ASPY was registered in Viet Nam in 2013, before WHO
 * recommended it).
 */
export function accessParts(p: Product, ctx: StageContext): AccessPart[] {
  const t = pageText(ctx.locale);
  const m = phaseReached(p, 0);
  if (!m) return [[t.phases[0], t.notYetReached, "none"]];
  const c = phaseReached(p, 1);
  const country: [string, AccessTone] = c
    ? [reachedText(c.year, ctx.locale), "ok"]
    : m.year != null
      ? [soFarText(ctx.asOfYear - m.year, ctx.locale), ""]
      : [statusShown(p, "prog", ctx.display) ? t.status.prog : "—", ""];
  return [[t.phases[0], reachedText(m.year, ctx.locale), "ok"], [t.phases[1], ...country]];
}

/** The open row's line: "Market Access: Reached in 2022 · Country Access: 4 years so far". */
export function accessLine(p: Product, ctx: StageContext): string {
  return accessParts(p, ctx)
    .map(([name, figure]) => `${name}: ${figure}`)
    .join(" · ");
}

/**
 * What the current gate has been waiting since, and the milestone that counts
 * from, so the timeline can say "since WHO PQ listing (2015)". It reads the
 * journey milestones the gate panel's "Pending since" line reads, so the two
 * agree; without a journey, the latest year among the gates in the column
 * before the current one.
 */
export function sinceFrom(p: Product, ctx: StageContext): { year: number; label: string } | null {
  const j = p.detail && p.detail.journey;
  if (Array.isArray(j) && j.length > 1 && j[j.length - 1].year === "TBC") {
    const last = [...j].reverse().find((g) => Number.isInteger(g.year));
    if (last) return { year: last.year as number, label: last.label };
  }
  const c = ctx.stageColumns.findIndex((col) => col.stages.includes(p.currentStage));
  if (c > 0) {
    const ys = ctx.stageColumns[c - 1].stages
      .map((i) => ({ year: stageYear(p.stages[i]), label: ctx.stages[i] }))
      .filter((s): s is { year: number; label: string } => s.year != null);
    if (ys.length) return ys.reduce((a, b) => (b.year > a.year ? b : a));
  }
  return null;
}

export function sinceFor(p: Product, ctx: StageContext): number | null {
  const s = sinceFrom(p, ctx);
  return s ? s.year : null;
}

/** How far a step ran past its expected time: "+2 years". */
export function varianceText(n: number, locale: Locale): string {
  return "+" + yrsText(n, locale);
}

/**
 * The year in a "Since 2018" date. The data is translated ("Depuis 2018",
 * "Desde 2018"), so the word is matched in every page language.
 */
export function sinceYearOf(st: StageEntry | null | undefined): number | null {
  const m = String((st && st.date) || "").match(/(?:Since|Depuis|Desde)\s+((?:19|20)\d{2})/i);
  return m ? +m[1] : null;
}

/**
 * One stage against its expected time. `took` and `late` (years past the
 * expected time, never below 0) are there only when the stage has a start
 * and, if done, a year.
 */
export interface YardStep {
  i: number;
  exp: number;
  basis: YardstickStep["basis"];
  kind: "done" | "nodate" | "idle" | "nostart" | "going";
  took?: number;
  late?: number;
}

/** The whole journey against the yardstick's wholeYears. */
export interface YardWhole {
  kind: "done" | "going";
  exp: number;
  took: number;
  late: number;
}

export type Yard =
  | { approved: false }
  | { approved: true; start: number; steps: YardStep[]; whole: YardWhole; biggest: YardStep | null };

/**
 * A medicine's dates against the yardstick; null when there is no yardstick or
 * the comparison is switched off (display.yardCompare). The clock starts at
 * the pathway's first year (firstYear), and only once there is a dated
 * regulatory approval (stage 1). Each stage's own clock: stages up to 4 start
 * with the pathway, policy adoption (5) at the WHO recommendation, procurement
 * and delivery at a "Since YYYY" date, and the current stage where the
 * timeline's "since" says; never before the pathway's start.
 */
export function yardstick(p: Product, ctx: StageContext): Yard | null {
  const yard = ctx.yardstick;
  if (!yard || !ctx.display.yardCompare) return null;
  const start = firstYear(p);
  if (start == null || stageYear(p.stages[1]) == null) return { approved: false };
  const recYear = stageYear(p.stages[2]);
  const since = sinceFor(p, ctx);
  const steps: YardStep[] = [];
  yard.expected.forEach((e, i) => {
    if (!e) return;
    const st = p.stages[i];
    let from =
      i === p.currentStage && since != null ? since
      : i <= 4 ? start
      : i === 5 ? Math.max(start, recYear != null ? recYear : start)
      : sinceYearOf(st);
    if (from != null) from = Math.max(from, start);
    let kind: YardStep["kind"];
    let took: number | undefined;
    if (st.status === "done") {
      const y = stageYear(st);
      if (y == null) kind = "nodate";
      else {
        kind = "done";
        took = Math.max(0, y - (from != null ? from : start));
      }
    } else if (st.status === "idle") kind = "idle";
    else if (from == null) kind = "nostart";
    else {
      kind = "going";
      took = ctx.asOfYear - from;
    }
    const s: YardStep = { i, exp: e.years, basis: e.basis, kind };
    if (took != null) {
      s.took = took;
      s.late = Math.max(0, took - s.exp);
    }
    steps.push(s);
  });
  const endYear = stageYear(p.stages[p.stages.length - 1]);
  const going = endYear == null;
  const took = (going ? ctx.asOfYear : endYear) - start;
  const whole: YardWhole = {
    kind: going ? "going" : "done",
    exp: yard.wholeYears,
    took,
    late: Math.max(0, took - yard.wholeYears),
  };
  const biggest =
    steps
      .filter((s): s is YardStep & { late: number } => s.late != null && s.late > 0)
      .sort((a, b) => b.late - a.late)[0] || null;
  return { approved: true, start, steps, whole, biggest };
}

/** A step's result as one plain label: text, tone, and whether it is still going. */
export interface YardResult {
  t: string;
  tone: "none" | "diff" | "good";
  going?: boolean;
}

export function yardResult(s: YardStep | YardWhole, locale: Locale): YardResult {
  const t = pageText(locale);
  if (s.kind === "idle") return { t: t.status.idle, tone: "none" };
  if (s.kind === "nodate") return { t: t.doneNoDate, tone: "none" };
  if (s.kind === "nostart") return { t: t.ongoingNoStart, tone: "none" };
  if (s.late != null && s.late > 0) return { t: varianceText(s.late, locale), tone: "diff", going: s.kind === "going" };
  return s.kind === "going" ? { t: t.onTrackSoFar, tone: "good" } : { t: yrsText(0, locale), tone: "good" };
}
