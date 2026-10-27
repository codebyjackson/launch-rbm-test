"use client";
// One medicine's section of the board (`${p.id}`): the summary row, the
// journey under it (level 1, `${p.id}-l1`), the stage panel
// (`${p.id}-gate`, whose content the pathway area draws) and the detail
// (level 2, `${p.id}-detail`). The page built it as one HTML string in its
// row loop; here the same structure is built by the builders, then passed
// through the glossary walk, then rendered.
import { useLayoutEffect, useMemo, useRef, useState, type ReactElement, type RefObject } from "react";
import { journeyLayout } from "@/lib/board";
import type { Product } from "@/lib/dataset";
import { firstClause } from "@/lib/format";
import { accessLine, statusShown } from "@/lib/stages";
import { fill } from "@/lib/strings";
import { accessCell, accessInfo, lateInfo } from "./access";
import { productDetail } from "./detail";
import { glossTree } from "./gloss";
import { useStageForks, useTimelineFit } from "./hooks";
import { journeyTime, miniJourney, pathTrack } from "./journey";
import type { MarkHooks, MarkView, Scope } from "./types";
import { yardBadge, yardBox, yardTable } from "./yardstick";

type View = "time" | "path" | "taken";

/** What the Board gives each row: its share of board-wide state, and the board's handlers. */
export interface RowHooks {
  onToggleRow(id: string): void;
  onToggleCell(p: Product, i: number, view: MarkView, el: HTMLButtonElement): void;
  onCloseCell(): void;
  onPeek(p: Product, i: number, el: HTMLButtonElement): void;
  onUnpeek(): void;
  /** draws a marked glossary term */
  term(t: string, key: string): ReactElement;
}

export interface ProductRowProps {
  p: Product;
  s: Scope;
  /** level 1 open (l1-open) */
  open: boolean;
  /** counts the times the row was asked open; each re-lays its journey out */
  openSeq: number;
  /** the column the pathway strip has selected, lit in the Journey column; -1 none */
  highlightCol: number;
  /** this row's open stage panel, if the board's one panel is here */
  cell: { stage: number; view: MarkView } | null;
  /** the glossary pattern; null without a glossary */
  glossRe: RegExp | null;
  hooks: RowHooks;
  reduceMotion: RefObject<boolean>;
}

export function ProductRow({ p, s, open, openSeq, highlightCol, cell, glossRe, hooks, reduceMotion }: ProductRowProps) {
  const { ctx, text, board } = s;
  // null until the reader switches: the page set data-view only then
  const [view, setView] = useState<View | null>(null);
  const [more, setMore] = useState(false);
  const shownView: View = view ?? "time";

  const sectionRef = useRef<HTMLElement>(null);
  const tsaRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  const layout = useMemo(() => journeyLayout(p, ctx), [p, ctx]);
  const fit = useTimelineFit(tsaRef, layout);
  const forks = useStageForks(trackRef, open && shownView === "path", openSeq);

  // where the axis scrolls (a phone), open it at the present: the current
  // stage is drawn at the right-hand end
  useLayoutEffect(() => {
    if (!open || !sectionRef.current) return;
    sectionRef.current.querySelectorAll(".cscroll").forEach((c) => {
      c.scrollLeft = c.scrollWidth;
    });
  }, [open, openSeq]);

  // a switched-to view fades in, unless the reader asked for less motion
  useLayoutEffect(() => {
    if (view == null || reduceMotion.current) return;
    const active = sectionRef.current?.querySelector<HTMLElement>(`.view[data-v="${view}"]`);
    if (!active) return;
    active.classList.add("fade-in");
    void active.offsetHeight;
    active.classList.remove("fade-in");
  }, [view, reduceMotion]);

  const showView = (which: View) => {
    if (which === shownView) return;
    hooks.onCloseCell();
    setView(which);
  };

  const marks: MarkHooks = {
    isOpen: (i, v) => !!cell && cell.stage === i && cell.view === v,
    onToggle: (i, v, el) => hooks.onToggleCell(p, i, v, el),
    onPeek: (i, v, el) => {
      // the hint stands down once a marker's own panel is open
      if (!(cell && cell.stage === i && cell.view === v)) hooks.onPeek(p, i, el);
    },
    onUnpeek: hooks.onUnpeek,
  };

  const cur = p.stages[p.currentStage];
  const yardOn = !!ctx.yardstick && ctx.display.yardCompare;
  const note = firstClause(cur.date);
  const barrier = p.barrier || p.flag;
  const cellStatus = cell ? p.stages[cell.stage].status : null;
  const sectionClass =
    "product" +
    (open ? " l1-open" : "") +
    (more ? " open" : "") +
    // the panel restates the flag for the current gate, so the row's copy hides
    (cell && cell.stage === p.currentStage && board.showBarriers && p.flag ? " gate-flag" : "");

  const section = (
    <section className={sectionClass} id={p.id} data-view={view ?? undefined} ref={sectionRef}>
      <div
        className="srow"
        onClick={(e) => {
          if (!(e.target as Element).closest("button, a, .gloss")) hooks.onToggleRow(p.id);
        }}
      >
        <button
          className="exp"
          type="button"
          aria-expanded={open}
          aria-controls={`${p.id}-l1`}
          aria-label={fill(text.showJourney, { name: p.name })}
          onClick={() => hooks.onToggleRow(p.id)}
        >
          ▾
        </button>
        <div className="nm">
          <b>{p.name}</b>
          <small>{p.inn}</small>
        </div>
        <div className="c-mini">{miniJourney(p, s, highlightCol)}</div>
        <span className="c-stage">
          <span className="stg">{ctx.stages[p.currentStage]}</span>
          {board.showStageNote && note ? <span className="note">{note}</span> : null}
        </span>
        {statusShown(p, cur.status, ctx.display) ? (
          <span className="c-stat">
            <span className={`light ${cur.status}`}>
              <i></i>
              {s.t.status[cur.status]}
              {cur.status === "late" ? lateInfo(s) : null}
            </span>
          </span>
        ) : (
          <span className="c-stat none" aria-hidden="true">
            —
          </span>
        )}
        <span className="cell c-path">
          {accessCell(p, s)}
          {yardBadge(p, s)}
        </span>
        {board.showBarriers ? <div className={`c-bar${barrier ? "" : " none"}`}>{barrier || text.noBarrier}</div> : null}
      </div>
      <div className="l1" id={`${p.id}-l1`}>
        <div className="l1in">
          <div className="l1h">
            <div className="l1id">
              <span>{p.manufacturer}</span>
              <span className={`chip ${p.class === "pipeline" ? "pipeline" : ""}`}>{p.classLabel}</span>
            </div>
            <div className="l1ctl">
              <span className="l1t">
                {accessLine(p, ctx) + " "}
                {accessInfo(s)}
              </span>
              <div className="swg" role="group" aria-label={text.journeyView}>
                <button type="button" data-v="time" aria-pressed={shownView === "time"} onClick={() => showView("time")}>
                  {text.viewTime}
                </button>
                <button type="button" data-v="path" aria-pressed={shownView === "path"} onClick={() => showView("path")}>
                  {text.viewPath}
                </button>
                {yardOn ? (
                  <button type="button" data-v="taken" aria-pressed={shownView === "taken"} onClick={() => showView("taken")}>
                    {text.viewTaken}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
          {yardBox(p, s)}
          <div className="views">
            <div className="view" data-v="time" hidden={shownView !== "time"}>
              {journeyTime(p, s, marks, layout, fit, tsaRef)}
            </div>
            <div className="view" data-v="path" hidden={shownView !== "path"}>
              {pathTrack(p, s, marks, forks, trackRef)}
            </div>
            {yardOn ? (
              <div className="view" data-v="taken" hidden={shownView !== "taken"}>
                {yardTable(p, s)}
              </div>
            ) : null}
          </div>
          <div
            className={`gatepanel${cellStatus === "late" && statusShown(p, "late", ctx.display) ? " late" : ""}`}
            id={`${p.id}-gate`}
            hidden={!cell}
          >
            {cell && s.slots.renderGatePanel ? s.slots.renderGatePanel(p, cell.stage, hooks.onCloseCell) : null}
          </div>
          {board.showBarriers && p.flag ? (
            <div className="flagnote">
              <span>{p.flag}</span>
            </div>
          ) : null}
          <button className="more" type="button" aria-expanded={more} aria-controls={`${p.id}-detail`} onClick={() => setMore(!more)}>
            <span className="more-t">{more ? text.hideDetail : text.moreDetail}</span>
            <span className="ch" aria-hidden="true">
              ▾
            </span>
          </button>
          {productDetail(p, s)}
        </div>
      </div>
    </section>
  );

  // a fresh record per render, so a render that runs twice marks the same terms
  return glossRe ? glossTree(section, glossRe, new Set(), hooks.term) : section;
}
