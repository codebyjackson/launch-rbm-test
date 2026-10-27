"use client";

// Small pieces the map section's components share: the swatches, the stage
// bar, and the shape of the callbacks the section passes down.
import {
  LINE_PATTERN,
  STAGE_ROWS,
  groupColor,
  stageBar,
  stageVar,
  type DetailTab,
  type GroupId,
  type Region,
  type ShapeName,
  type Stage,
  type StageCounts,
  type StageKey,
  type TokenReader,
} from "@/lib/map";
import type { MapText } from "./text";

/** What the components can ask the section to do. */
export interface MapActions {
  product(id: string): void;
  stage(key: StageKey, on: boolean): void;
  group(id: GroupId, on: boolean): void;
  all(on: boolean): void;
  reset(): void;
  region(region: Region | ""): void;
  country(iso3: string): void;
  tab(tab: DetailTab): void;
  select(iso3: string): void;
  back(): void;
  step(dir: 1 | -1): void;
  search(q: string): void;
}

/** Where a tooltip goes: beside a point (the pointer), or above an element (keyboard focus). */
export type TipAt = { x: number; y: number } | { el: HTMLElement };

/** The tooltip, shown and hidden without re-rendering the section. */
export interface MapTips {
  showMap(iso3: string, at: TipAt): void;
  showList(shape: ShapeName, level: Stage | null, at: TipAt): void;
  hide(): void;
}

/** Does nothing: for rendering without a browser (tests). */
export const NO_ACTIONS: MapActions = {
  product() {}, stage() {}, group() {}, all() {}, reset() {}, region() {}, country() {},
  tab() {}, select() {}, back() {}, step() {}, search() {},
};
export const NO_TIPS: MapTips = { showMap() {}, showList() {}, hide() {} };

/** A stage's name; an unknown stage reads "No data", as on the old page. */
export const stageLabel = (text: MapText, lvl: Stage | null): string =>
  (lvl && (text.stage as Record<string, string>)[lvl]) || text.stage.none;

/** A short sample of a group's border, for legends and lists (old: mftLineSvg). */
export function LineSwatch({ id, len = 28, token }: { id: GroupId; len?: number; token: TokenReader }) {
  const p = LINE_PATTERN[id];
  return (
    <svg className="mft-lsw" width={len} height="10" viewBox={`0 0 ${len} 10`} aria-hidden="true">
      <line
        x1="1"
        y1="5"
        x2={len - 1}
        y2="5"
        stroke={groupColor(token, id)}
        strokeWidth={p.w}
        strokeDasharray={p.da || undefined}
        strokeLinecap={(p.cap || "butt") as "butt" | "round"}
      />
    </svg>
  );
}

/** Countries per stage as one bar (old: stageBar). */
export function StageBar({ counts, total, text }: { counts: StageCounts; total: number; text: MapText }) {
  return (
    <div className="det-bar" role="img" aria-label={STAGE_ROWS.map((k) => `${text.stage[k]} ${counts[k]}`).join(", ")}>
      {stageBar(counts, total).map((s) => (
        <i key={s.key} style={{ width: `${s.width}%`, background: stageVar(s.key) }} />
      ))}
    </div>
  );
}

/** The bar's key, with counts (old: stageLegend). */
export function StageLegend({ counts, text }: { counts: StageCounts; text: MapText }) {
  return (
    <div className="det-lg">
      {STAGE_ROWS.map((k) => (
        <span key={k}>
          <i className={`mapsw ${k}`} />
          {k === "guidelines" ? text.inGuidelines : text.stage[k]} <b>{counts[k]}</b>
        </span>
      ))}
    </div>
  );
}
