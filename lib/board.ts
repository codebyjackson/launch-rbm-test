// The medicine board's pure rules: which medicines are listed and in what
// order, how a journey is laid out on its time axis, the fork drawn for a
// parallel pair, the procurement card's two rules, and where glossary terms
// go. Ported from
// the main script of launch-rbm-test 7c1bf11 (en/index.html), keeping the old
// names; tests/golden-board.test.ts checks each against the original in all
// three languages, and tests/markup-board.test.ts checks the markup built
// from them.
//
// Where the page measured the DOM (fitTimeline, alignStageForks,
// drawStageForks), the measuring stays in components/board/hooks.ts and only
// the arithmetic is here, so the arithmetic can be compared on its own.
import type { Procurement, Product, Status } from "./dataset";
import { sinceFrom, stageYear, statusShown, type StageContext } from "./stages";

/**
 * The board's own display switches, as set for the 10 Nov 2026 release. Like
 * DISPLAY in lib/stages.ts, each hides something the data still holds.
 */
export interface BoardDisplay {
  /**
   * SHOW_BARRIERS: the Main barrier column, the barrier line in an open row
   * and in the stage panel. Off for all four medicines (owner, 20 Oct 2026),
   * until RBM and Unitaid agree barrier definitions.
   */
  showBarriers: boolean;
  /**
   * SHOW_STAGE_NOTE: the grey line under the stage name in the Current stage
   * cell. Off at the owner's request (20 Oct 2026); the date still shows on
   * the journey and in the stage panel.
   */
  showStageNote: boolean;
}

export const BOARD_DISPLAY: BoardDisplay = { showBarriers: false, showStageNote: false };

/** The symbol inside a stage marker, by status. */
export const ICON: Record<Status, string> = { done: "✓", prog: "›", late: "!", idle: "" };

// trackedProducts and colIndexOf are the same rules as lib/pathway.ts's
// `tracked` and `colIndexOf` (the pathway area, branch feat/react-port), which
// this branch cannot see; both are golden-tested against the same page code.
// On merge, delete these two and import those (Board.tsx, and preBoundaryDone
// below). The pathway area also has lateAt and stalledSince, so they are not
// here.

/**
 * `tracked` on the page: the medicines the board, the step panels, the map
 * and the CSV list, in that order everywhere. Placeholders are left out, and
 * the rest sorted by name (30 Sep 2026), not kept in the data's order. "en"
 * in every language, as on the page, so the order never changes with it.
 */
export function trackedProducts(products: readonly Product[]): Product[] {
  return products
    .filter((p) => !p.placeholder)
    .sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
}

/** The display column a stage is drawn in; -1 if none. */
export function colIndexOf(i: number, ctx: StageContext): number {
  return ctx.stageColumns.findIndex((c) => c.stages.includes(i));
}

/**
 * Is the column before stage i's column fully cleared? For a stage alone in
 * its column this is "is stage i-1 done". For one of a parallel pair it looks
 * past the pair to the column before it: the two never gate each other's bar.
 */
export function preBoundaryDone(p: Product, i: number, ctx: StageContext): boolean {
  const ci = colIndexOf(i, ctx);
  if (ci <= 0) return false;
  return ctx.stageColumns[ci - 1].stages.every((j) => p.stages[j].status === "done");
}

// ---- the journey on its time axis (journeyTime) -------------------------------

/**
 * The fixed measures of the timeline, in px. TOP is the first tier's top,
 * TIER the estimated spacing between tiers, LAST the estimated height of the
 * last tier's label block, and MIN_GAP the closest two markers may sit (in %
 * of the axis) before one moves down a tier.
 */
export const TIMELINE = { TOP: 46, TIER: 104, LAST: 126, MIN_GAP: 21 } as const;

/** A gate placed on the axis: stage i, at x % across, in tier `tier`. */
export interface TimelineItem {
  i: number;
  x: number;
  /** the current gate, drawn at today */
  cur: boolean;
  tier: number;
  /** px, before fitting (fitTiers) */
  top: number;
}

export interface JourneyLayout {
  /** what the current gate counts from, as sinceFrom gives it */
  from: { year: number; label: string } | null;
  /** the axis: from lo (the first year) to hi (today, asOfYear) */
  lo: number;
  hi: number;
  ticks: { year: number; x: number }[];
  /** x of today */
  nowX: number;
  /** the bar back from today to `from`, when that is before today */
  run: { left: number; width: number } | null;
  items: TimelineItem[];
  /** tiers used, at least 1 */
  tiers: number;
  /** px: the box's estimated height, and its minimum once fitted */
  height: number;
  /** done, but no year in the date */
  noYear: number[];
  /** started, not current, not dated */
  ongoing: number[];
  notStarted: number[];
  /** whether `ongoing` may be headed with a status word ("Ongoing") */
  ongoingShown: boolean;
}

/**
 * journeyTime's layout. Dated gates sit at their real year on one axis that
 * starts at the first milestone (no empty years); the current gate sits at
 * today, with a bar back to the year it has waited since. Gates too close to
 * the one before move down a tier. Gates with no year are listed beside the
 * axis instead of being given an invented date.
 */
export function journeyLayout(p: Product, ctx: StageContext): JourneyLayout {
  const from = sinceFrom(p, ctx);
  const since = from ? from.year : null;
  const ys = p.stages.map((st) => stageYear(st)).filter((y): y is number => y != null);
  if (since != null) ys.push(since);
  let lo = ys.length ? Math.min(...ys) : ctx.asOfYear - 1;
  const hi = ctx.asOfYear;
  if (lo >= hi) lo = hi - 1;
  // the page's expression, unchanged, so every position is the same double
  const x = (y: number) => 8 + ((y - lo) / (hi - lo)) * 84;
  const span = hi - lo;
  const step = span <= 6 ? 1 : span <= 12 ? 2 : 5;
  const tickYears = [lo];
  for (let t = Math.ceil((lo + 1) / step) * step; t < hi; t += step) {
    if (t - lo >= step * 0.6 && hi - t >= 1.5) tickYears.push(t);
  }

  const placed: { i: number; x: number; cur: boolean }[] = [];
  p.stages.forEach((st, i) => {
    if (i === p.currentStage) placed.push({ i, x: x(hi), cur: true });
    else {
      const y = stageYear(st);
      if (y != null) placed.push({ i, x: x(y), cur: false });
    }
  });
  placed.sort((a, b) => a.x - b.x || a.i - b.i);
  const last: number[] = [];
  const items = placed.map((it): TimelineItem => {
    let tier = 0;
    while (last[tier] != null && it.x - last[tier] < TIMELINE.MIN_GAP) tier++;
    last[tier] = it.x;
    return { ...it, tier, top: TIMELINE.TOP + tier * TIMELINE.TIER };
  });

  const noYear: number[] = [];
  const ongoing: number[] = [];
  const notStarted: number[] = [];
  p.stages.forEach((st, j) => {
    if (j === p.currentStage) return;
    if (st.status === "done" && stageYear(st) == null) noYear.push(j);
    else if (st.status === "prog" || st.status === "late") ongoing.push(j);
    else if (st.status === "idle") notStarted.push(j);
  });

  return {
    from,
    lo,
    hi,
    ticks: tickYears.map((year) => ({ year, x: x(year) })),
    nowX: x(hi),
    run: since != null && since < hi ? { left: x(since), width: x(hi) - x(since) } : null,
    items,
    tiers: Math.max(1, last.length),
    height: TIMELINE.TOP + (Math.max(1, last.length) - 1) * TIMELINE.TIER + TIMELINE.LAST,
    noYear,
    ongoing,
    notStarted,
    ongoingShown: ongoing.every((j) => statusShown(p, p.stages[j].status, ctx.display)),
  };
}

/** Each tier's top, and the box's height, once the label blocks are measured. */
export interface TierFit {
  tops: number[];
  height: number;
}

/**
 * fitTimeline's arithmetic. TIER and LAST are estimates for English, but a
 * block's height depends on how its label wraps, which differs by language
 * (20 Oct 2026): ASPY's SRA block ran into the WHO PQ icon under it. So each
 * tier goes 10px under the tallest block of the tier above, and the box grows
 * to hold the last one. It only grows: `base`, the estimate, is the minimum.
 *
 * @param heights the label blocks' heights, by tier
 */
export function fitTiers(heights: readonly (readonly number[])[], base: number): TierFit {
  const tops: number[] = [];
  let top: number = TIMELINE.TOP;
  heights.forEach((list, t) => {
    tops[t] = top;
    top += Math.max(...list) + 10;
  });
  return { tops, height: Math.max(base, top + 6) };
}

// ---- the fork drawn for a parallel pair (alignStageForks, drawStageForks) -----

/** The parts of a DOMRect the fork reads. */
export interface Box {
  top: number;
  bottom: number;
  left: number;
  right: number;
  width: number;
  height: number;
}

/** The fork's corner radius, on the stroke's centreline. */
export const FORK_R = 10;
/** The radius of the node on each junction. */
export const FORK_NODE = 4.5;

/**
 * --sg-lift: how far a pair's group pulls itself up so its spine (the middle
 * of the caption band between the two markers) sits on the line every other
 * marker's centre is on. Measured with the lift at 0. Not rounded: half a
 * pixel shows as the spine 1px off its neighbours.
 */
export function forkLift(note: Pick<Box, "top" | "bottom">, groupTop: number, markHeight: number): string {
  const spine = (note.top + note.bottom) / 2 - groupTop;
  const lift = Math.max(0, spine - markHeight / 2);
  return lift.toFixed(2) + "px";
}

/** The fork's two strokes (in, out) and the node on each junction. */
export interface ForkGeometry {
  viewBox: string;
  /** path data: arm, corner, spine, corner, arm */
  inD: string;
  outD: string;
  /** x of the out-side nodes; the in-side nodes sit at 0 */
  w: number;
  /** y of both nodes */
  spine: number;
}

/**
 * Where the two markers ended up, as one path per side. Two strokes never
 * have to meet, which is why it is drawn rather than made of borders. Pairs
 * only: the first and last marker. Unrounded, for the same reason as the
 * lift. null when the group is not laid out (hidden).
 */
export function forkGeometry(group: Box, first: Box, last: Box): ForkGeometry | null {
  if (!group.width || !group.height) return null;
  const w = group.width;
  const h = group.height;
  const R = FORK_R;
  const yT = first.top - group.top + first.height / 2;
  const yB = last.top - group.top + last.height / 2;
  // the arms stop at the marker's own 4px gap
  const xIn = first.left - group.left - 4;
  const xOut = first.right - group.left + 4;
  const spine = (yT + yB) / 2;
  return {
    viewBox: `0 0 ${w} ${h}`,
    inD: `M ${xIn} ${yT} H ${R}` + ` A ${R} ${R} 0 0 0 0 ${yT + R} V ${yB - R}` + ` A ${R} ${R} 0 0 0 ${R} ${yB} H ${xIn}`,
    outD:
      `M ${xOut} ${yT} H ${w - R}` + ` A ${R} ${R} 0 0 1 ${w} ${yT + R} V ${yB - R}` + ` A ${R} ${R} 0 0 1 ${w - R} ${yB} H ${xOut}`,
    w,
    spine,
  };
}

// ---- the medicine's detail -----------------------------------------------------

/**
 * A single 100% Global Fund channel is a sentence, not a full bar, so it
 * cannot be read as the product's whole procurement (partner feedback, 15 Oct
 * 2026).
 */
export function procurementGfOnly(volume: Procurement | null | undefined): boolean {
  return !!volume && volume.split.length === 1 && volume.split[0].pct === 100 && /PQR/.test(volume.source || "");
}

/** The procurement bar's colours, one per channel in turn. */
export const PROCUREMENT_SHADES = ["#212E92", "#0066FF", "#66A3FF", "#75D8F7"] as const;

// ---- glossary terms in the rows ------------------------------------------------

/** data.glossary: term → definition. Anything else reads as no glossary. */
export function glossaryOf(glossary: unknown): { [term: string]: string } {
  return glossary && typeof glossary === "object" && !Array.isArray(glossary)
    ? (glossary as { [term: string]: string })
    : {};
}

/**
 * The terms as one pattern, longest first so "PQR" wins over "PQ"; null with
 * no glossary. Whole words only.
 */
export function glossPattern(glossary: { [term: string]: string }): RegExp | null {
  const terms = Object.keys(glossary).sort((a, b) => b.length - a.length);
  if (!terms.length) return null;
  return new RegExp("\\b(" + terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + ")\\b", "g");
}

/** A text cut where a term is marked; a string is plain text. */
export type GlossPart = string | { term: string };

/**
 * One text's first occurrences: each term is marked only the first time it
 * appears in a medicine's row (repetition is noise), so `seen` is shared by
 * every text of one row, in document order, and updated. null when the text
 * marks nothing. A term already seen is matched and skipped, so "PQ" inside a
 * seen "PQR" is never marked.
 */
export function glossSplit(text: string, re: RegExp, seen: Set<string>): GlossPart[] | null {
  let m: RegExpExecArray | null;
  let parts: GlossPart[] | null = null;
  let last = 0;
  re.lastIndex = 0;
  while ((m = re.exec(text))) {
    if (seen.has(m[1])) continue;
    seen.add(m[1]);
    if (!parts) parts = [];
    parts.push(text.slice(last, m.index), { term: m[1] });
    last = m.index + m[1].length;
  }
  if (parts) parts.push(text.slice(last));
  return parts;
}
