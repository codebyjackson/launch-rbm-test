// The pathway strip's and the step panels' rules, as pure functions: which
// medicines are listed, a step's number and column, how many medicines are
// delayed at it, how long the current gate has waited, and the counts the
// panels show. Ported from the main script of launch-rbm-test 7c1bf11
// (en/index.html), keeping the old names where the page had a function.
//
// tests/golden-pathway.test.ts checks every function the page had on its own
// against the original in all three languages. The counts the page worked
// out inline, inside the markup it built (statusCounts, levelCounts,
// countryAccessCounts, phaseColumns, parallelPair), have no old function to
// call, so tests/markup-pathway.test.ts checks them through that markup.
import type { CountryEntry, CountrySurvey, Product, ProductDetail, Source, StageColumn, Status } from "./dataset";
import { phaseOf, statusShown, type StageContext } from "./stages";

/**
 * The static pages' display switches for the pathway and its panels, as set
 * for the 10 Nov 2026 release. They belong with the others in DISPLAY
 * (lib/stages.ts); they are here only until the areas are merged.
 */
export interface PathwayDisplay {
  /**
   * SHOW_STAGE_EXPECTED: the expected time under each step on the strip, and
   * its words in the step's screen-reader label. Hidden for every step at the
   * owner's request (20 Oct 2026); the yardstick data is unchanged.
   */
  showStageExpected: boolean;
  /**
   * SHOW_BARRIERS: the current gate's barrier text (p.flag) in its panel.
   * Off since 20 Oct 2026 (partner feedback sheet) until barrier definitions
   * are agreed. The board's Main barrier column reads the same switch.
   */
  showBarriers: boolean;
}

export const PATHWAY_DISPLAY: PathwayDisplay = { showStageExpected: false, showBarriers: false };

/**
 * The medicines the page lists: placeholders out, then A to Z by name. Every
 * list on the page (board, step panels, map tabs, CSV) follows this order.
 * Give it the products as shown (applyShowLate), as the page computed it
 * after rewriting "late".
 */
export function tracked(products: Product[]): Product[] {
  return products
    .filter((p) => !p.placeholder)
    .sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
}

/** The column a stage is drawn in; -1 when no column holds it. */
export function colIndexOf(i: number, ctx: StageContext): number {
  return ctx.stageColumns.findIndex((c) => c.stages.includes(i));
}

/**
 * A stage's step number: its column's position, so the two parallel WHO
 * gates both read "3". 0 for a stage no column holds.
 */
export function stepNo(i: number, ctx: StageContext): number {
  return colIndexOf(i, ctx) + 1;
}

/** The columns of one access phase, in order: those whose first stage is in it. */
export function phaseColumns(k: number, ctx: StageContext): StageColumn[] {
  return ctx.stageColumns.filter((col) => phaseOf(col.stages[0]) === k);
}

/**
 * The two stages of a parallel pair, when stage i is in one: the step panel
 * says they run in parallel. Only a column of exactly two counts, as on the page.
 */
export function parallelPair(i: number, ctx: StageContext): [number, number] | null {
  const col = ctx.stageColumns.find((c) => c.stages.includes(i));
  return col && col.stages.length === 2 ? [col.stages[0], col.stages[1]] : null;
}

/**
 * How many medicines are delayed at stage i, counted only where "Delayed" is
 * shown. The strip's screen-reader label carries it. With showLate off no
 * stage is late any more, so this is 0.
 */
export function lateAt(i: number, products: Product[], ctx: StageContext): number {
  return products.filter((p) => p.stages[i].status === "late" && statusShown(p, "late", ctx.display)).length;
}

/** A gate's wait, as its panel's "Pending since" line says it. */
export interface Stalled {
  /** whole years from `year` to the dataset's year; at least 1 */
  yrs: number;
  /** the journey milestone the wait counts from */
  label: string;
  year: number;
  /** the milestone still pending, the journey's last */
  pending: string;
}

/**
 * How long the current gate has waited, only where the data supports it.
 * detail.journey is a product-level list of access milestones, not one per
 * stage, so a per-stage duration would be invented: this answers only for
 * the current stage, when the journey ends in an undated ("TBC") milestone
 * after a dated one, and names the milestone it counts from. Under a year is
 * not reported.
 *
 * Like the page, it reads p.detail without checking it is there.
 */
export function stalledSince(p: Product, i: number, ctx: StageContext): Stalled | null {
  if (i !== p.currentStage) return null;
  const j = p.detail.journey;
  if (!Array.isArray(j) || j.length < 2) return null;
  if (j[j.length - 1].year !== "TBC") return null;
  const last = [...j].reverse().find((g) => Number.isInteger(g.year));
  if (!last) return null;
  const year = last.year as number;
  const yrs = ctx.asOfYear - year;
  if (yrs < 1) return null;
  return { yrs, label: last.label, year, pending: j[j.length - 1].label };
}

/** How many medicines are at each status at one stage. */
export type StatusCounts = Record<Status, number>;

/** The order the step panel lists its status counts in: most urgent first. */
export const COUNT_ORDER: readonly Status[] = ["late", "prog", "done", "idle"];

/** The step panel's tally: the listed medicines by their status at stage i. */
export function statusCounts(i: number, products: Product[]): StatusCounts {
  const counts: StatusCounts = { late: 0, prog: 0, done: 0, idle: 0 };
  for (const p of products) counts[p.stages[i].status]++;
  return counts;
}

/** Countries by the furthest level each has reached. */
export interface LevelCounts {
  registered: number;
  guidelines: number;
  mft: number;
}

/** Counts the three levels; any other level is passed over, as on the page. */
export function levelCounts(list: readonly CountryEntry[]): LevelCounts {
  const c: LevelCounts = { registered: 0, guidelines: 0, mft: 0 };
  for (const e of list) {
    // The page tested `e.level in c`, which a level such as "toString" also
    // passes; its count went to a property nobody read. An own-key test gives
    // the same three numbers.
    if (Object.prototype.hasOwnProperty.call(c, e.level)) c[e.level as keyof LevelCounts]++;
  }
  return c;
}

/** detail.countries.list, when the medicine has one. */
export function countryList(detail: ProductDetail): CountryEntry[] | null {
  const s: CountrySurvey | undefined = detail.countries;
  return s && Array.isArray(s.list) ? s.list : null;
}

/** The Country access card's figures, all from the one list the map is painted from. */
export interface CountryAccessCounts {
  /** countries on the map */
  onMap: number;
  levels: LevelCounts;
  /**
   * how many entries a national register among their sources confirms; null
   * when there are no sources at all to judge by, and the row is left out
   */
  confirmed: number | null;
}

/**
 * Where a medicine has a country list, every count comes from it, so the
 * card, the map legend and the stage 4–5 panels cannot disagree (partner
 * feedback, 15 Oct 2026). A source's category is compared in slug form
 * ("national-register"), as on the page.
 */
export function countryAccessCounts(list: readonly CountryEntry[], sources: readonly Source[]): CountryAccessCounts {
  // a plain object keyed by id, as on the page; Object.keys counts the ids
  const cat: { [id: string]: string } = {};
  for (const s of sources) cat[s.id] = String(s.category || "").toLowerCase().replace(/\s+/g, "-");
  const reg = list.filter((e) => (e.sources || []).some((id) => cat[id] === "national-register")).length;
  return { onMap: list.length, levels: levelCounts(list), confirmed: Object.keys(cat).length ? reg : null };
}
