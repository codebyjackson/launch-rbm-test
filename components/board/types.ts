// The board's types. BoardSlots and OpenCell are its contract with the other
// areas; Scope and MarkHooks are internal to components/board/.
import type { ReactNode } from "react";
import type { BoardDisplay } from "@/lib/board";
import type { Product, ProductDetail, Source } from "@/lib/dataset";
import type { Citation } from "@/lib/format";
import type { StageContext } from "@/lib/stages";
import type { PageText } from "@/lib/strings";
import type { BoardText } from "./text";

/**
 * The parts of a row the pathway area draws (components/pathway/), passed in
 * by the Dashboard. Each is optional so the board renders without them; the
 * part is then left empty, except citations, which fall back to plain names.
 *
 * The glossary walk (gloss.tsx) reads text only in what a slot returns as
 * plain elements. Call a hook-free component as a function in the slot, and
 * its text is marked as on today's page; mount it as <Component/>, and terms
 * inside it (MFT in "In MFT plans", PQ in a source's name) are not marked.
 */
export interface BoardSlots {
  /** stageIconImg: stage i's icon, class "sicon" in a marker, "" elsewhere */
  renderStageIcon?: (stage: number, className: string) => ReactNode;
  /** countryAccessKv: the Country access card's rows, before Forecast demand */
  renderCountryAccess?: (detail: ProductDetail) => ReactNode;
  /** a claim's citations, after the board's "Source: " */
  renderCites?: (cites: readonly Citation[]) => ReactNode;
  /**
   * gatePanelHTML: the content of a medicine's stage panel. The board keeps
   * the panel itself (`${id}-gate`, hidden, its late class) and which one is
   * open; `close` is for the panel's Close button.
   */
  renderGatePanel?: (product: Product, stage: number, close: () => void) => ReactNode;
}

/** The stage panel open under a medicine's row; one at most, board-wide. */
export interface OpenCell {
  productId: string;
  stage: number;
}

/** What every builder reads besides the medicine: built once per render by the Board. */
export interface Scope {
  ctx: StageContext;
  /** the board's own words */
  text: BoardText;
  /** the words shared with lib/stages.ts: status words, phases */
  t: PageText;
  sources: readonly Source[];
  board: BoardDisplay;
  slots: BoardSlots;
}

/** The two views a stage marker appears in; each is its own button. */
export type MarkView = "time" | "path";

/** A row's stage markers: whose panel is open, and what a marker does. */
export interface MarkHooks {
  /** whether this marker's panel is the one open */
  isOpen(i: number, view: MarkView): boolean;
  onToggle(i: number, view: MarkView, el: HTMLButtonElement): void;
  /** hover or focus: the one-line hint, unless its panel is open */
  onPeek(i: number, view: MarkView, el: HTMLButtonElement): void;
  onUnpeek(): void;
}
