// A medicine's journey, four ways: the dots in the Journey column
// (miniJourney), the stage marker that opens a stage's panel (stageMarkHtml),
// the Actual timeline (journeyTime) and the Pathway order track (stagesHtml in
// the page's row loop). Builders: the row calls them, so the glossary pass
// sees their text; the measuring lives in hooks.ts and arrives as `fit` and
// `forks`. The stage icons are the pathway area's, through
// slots.renderStageIcon.
import type { ReactElement, ReactNode, Ref } from "react";
import {
  FORK_NODE,
  ICON,
  TIMELINE,
  preBoundaryDone,
  type ForkGeometry,
  type JourneyLayout,
  type TierFit,
} from "@/lib/board";
import type { Product } from "@/lib/dataset";
import { peekLineFor, stageYear, statusShown, yrsText } from "@/lib/stages";
import { fill } from "@/lib/strings";
import type { MarkHooks, MarkView, Scope } from "./types";

/** Stage i's icon, drawn by the pathway area; nothing without it. */
const icon = (s: Scope, i: number, className: string): ReactNode =>
  s.slots.renderStageIcon ? s.slots.renderStageIcon(i, className) : null;

/**
 * The Journey column: one dot per stage, a parallel pair stacked in one cell.
 * `onCol` is the column the pathway strip has selected (highlightStep), lit
 * in every row; -1 for none.
 */
export function miniJourney(p: Product, s: Scope, onCol: number): ReactElement {
  const { ctx, text } = s;
  const done = p.stages.filter((st) => st.status === "done").length;
  const dot = (i: number) => {
    const status = p.stages[i].status;
    const title = statusShown(p, status, ctx.display)
      ? fill(text.dotTitle, { stage: ctx.stages[i], status: s.t.status[status] })
      : ctx.stages[i];
    return <i key={i} className={`md ${status}`} title={title}></i>;
  };
  return (
    <div className="mini" role="img" aria-label={fill(text.miniLabel, { done, total: p.stages.length })}>
      {ctx.stageColumns.map((col, c) => [
        c ? <i key={`ln${c}`} className="ln"></i> : null,
        <span key={`c${c}`} className={c === onCol ? "jcell on" : "jcell"} data-c={c}>
          {col.stages.length === 1 ? dot(col.stages[0]) : <span className="mp">{col.stages.map(dot)}</span>}
        </span>,
      ])}
    </div>
  );
}

/**
 * A stage's marker: hover or focus gives the one-line hint, a click opens the
 * stage's panel under the row. The data-* attributes are kept as the page had
 * them; the board reads its closures, not these.
 */
export function stageMark(p: Product, i: number, view: MarkView, s: Scope, marks: MarkHooks): ReactElement {
  const st = p.stages[i];
  const name = s.ctx.stages[i];
  const peek = peekLineFor(p, s.ctx)(st.status, st.date, st.nextDate);
  return (
    <button
      className="smark"
      type="button"
      aria-expanded={marks.isOpen(i, view)}
      aria-controls={`${p.id}-gate`}
      aria-label={fill(s.text.markLabel, { stage: name, peek })}
      data-stage={name}
      data-stagei={i}
      data-pid={p.id}
      data-status={st.status}
      data-date={String(st.date ?? "")}
      data-nextdate={String(st.nextDate ?? "")}
      onClick={(e) => marks.onToggle(i, view, e.currentTarget)}
      onMouseEnter={(e) => marks.onPeek(i, view, e.currentTarget)}
      onFocus={(e) => marks.onPeek(i, view, e.currentTarget)}
      onMouseLeave={marks.onUnpeek}
      onBlur={marks.onUnpeek}
    >
      {icon(s, i, "sicon")}
      <span className={`dot ${st.status}`} aria-hidden="true">
        {ICON[st.status]}
      </span>
    </button>
  );
}

/**
 * The default view. Dated gates at their year on one axis, the current gate
 * at today with a bar back to what it has waited since, and the gates with no
 * year listed on the right. `fit` is the measured tier layout (fitTimeline);
 * until it arrives, the estimate.
 */
export function journeyTime(
  p: Product,
  s: Scope,
  marks: MarkHooks,
  L: JourneyLayout,
  fit: TierFit | null,
  tsaRef: Ref<HTMLDivElement>,
): ReactElement {
  const { ctx, text } = s;
  const locale = ctx.locale;
  const cur = p.stages[p.currentStage];
  const topOf = (tier: number) => (fit && fit.tops[tier] != null ? fit.tops[tier] : TIMELINE.TOP + tier * TIMELINE.TIER);

  const items = L.items.map((it) => {
    const st = p.stages[it.i];
    const top = topOf(it.tier);
    const sub: ReactNode = it.cur
      ? [
          statusShown(p, st.status, ctx.display) ? (
            <div key="now" className={`snow ${st.status}`}>
              {s.t.status[st.status]}
            </div>
          ) : null,
          L.run && L.from ? (
            <div key="since" className="ssince">
              {fill(text.since, { label: L.from.label, year: L.from.year, years: yrsText(L.hi - L.from.year, locale) })}
            </div>
          ) : null,
        ]
      : <div className="syear">{stageYear(st)}</div>;
    return [
      <i key={`s${it.i}`} className="stem" data-tier={it.tier} style={{ left: `${it.x}%`, height: `${top - 32}px` }}></i>,
      <i key={`p${it.i}`} className={`pt${it.cur ? " " + st.status : ""}`} style={{ left: `${it.x}%` }}></i>,
      <div
        key={`i${it.i}`}
        className={`it stage s-${st.status}${it.cur ? " cur" : ""}`}
        data-tier={it.tier}
        style={{ left: `${it.x}%`, top: `${top}px` }}
      >
        {stageMark(p, it.i, "time", s, marks)}
        <div className="lbl">{ctx.stages[it.i]}</div>
        {sub}
      </div>,
    ];
  });

  const chip = (j: number, withStatus: boolean) => {
    const st = p.stages[j];
    return (
      <span key={j} className="uchip">
        <span className={`ui m-${st.status}`}>{icon(s, j, "")}</span>
        <span>{ctx.stages[j]}</span>
        {withStatus
          ? [" · ", <span key="st" className={`st ${st.status}`}>{st.status === "late" ? text.chipLate : text.chipOngoing}</span>]
          : null}
      </span>
    );
  };
  const group = (title: string, list: number[], key: string, withStatus = false) => (
    <div key={key} className="ugrp">
      <div className="h">{title}</div>
      {list.length ? (
        <div className="uchips">{list.map((j) => chip(j, withStatus))}</div>
      ) : (
        <span className="unone">{text.none}</span>
      )}
    </div>
  );
  // Not-started gates are a row of dimmed icons, not labelled chips: early in
  // the pathway there are up to seven, which made this the tallest panel.
  const notStarted = (
    <div key="ns" className="ugrp">
      <div className="h">{fill(text.notStarted, { n: L.notStarted.length })}</div>
      {L.notStarted.length ? (
        <div className="uicons">
          {L.notStarted.map((j) => (
            <span key={j} className="ui" role="img" title={ctx.stages[j]} aria-label={ctx.stages[j]}>
              {icon(s, j, "")}
            </span>
          ))}
        </div>
      ) : (
        <span className="unone">{text.none}</span>
      )}
    </div>
  );

  return (
    <div className="tsp">
      <div className="cscroll">
        <div className="tsa" ref={tsaRef} style={{ height: `${fit ? fit.height : L.height}px` }}>
          <div className="ax"></div>
          {L.ticks.map((t) => [
            <i key={`tt${t.year}`} className="tt" style={{ left: `${t.x}%` }}></i>,
            <span key={`tk${t.year}`} className="tk" style={{ left: `${t.x}%` }}>
              {t.year}
            </span>,
          ])}
          <span className="tk now" style={{ left: `${L.nowX}%` }}>
            {`${L.hi} `}
            <i>{text.today}</i>
          </span>
          <i className="today" style={{ left: `${L.nowX}%`, height: `${TIMELINE.TOP - 20}px` }}></i>
          {L.run ? (
            <i className={`run ${cur.status}`} style={{ left: `${L.run.left}%`, width: `${L.run.width}%` }}></i>
          ) : null}
          {items}
        </div>
      </div>
      <div className="tsz">
        {L.noYear.length ? group(text.noYear, L.noYear, "ny") : null}
        {/* with the status words hidden, a neutral heading rather than "Ongoing" */}
        {L.ongoingShown ? group(text.ongoingNoDate, L.ongoing, "on", true) : group(text.notYetDated, L.ongoing, "on")}
        {notStarted}
      </div>
    </div>
  );
}

/**
 * The Pathway order view: every stage in order, a parallel pair drawn as a
 * fork. `forks` holds each pair's drawn strokes, in the order the pairs come
 * (hooks.ts measures them once the track is shown); null draws none yet.
 */
export function pathTrack(
  p: Product,
  s: Scope,
  marks: MarkHooks,
  forks: readonly (ForkGeometry | null)[],
  trackRef: Ref<HTMLDivElement>,
): ReactElement {
  const { ctx } = s;
  const years = p.stages.map((st) => stageYear(st));

  const unit = (i: number, extraClass?: string) => {
    const st = p.stages[i];
    const preDone = preBoundaryDone(p, i, ctx);
    const postDone = st.status === "done";
    return (
      <div key={i} className={`stage ${extraClass || ""} ${i === p.currentStage ? "cur" : ""} s-${st.status}`}>
        <div className="row">
          <div className={`bar pre ${preDone ? "done-bar" : ""}`}></div>
          {stageMark(p, i, "path", s, marks)}
          <div className={`bar post ${postDone ? "done-bar" : ""}`}></div>
        </div>
        <div className="lbl">{ctx.stages[i]}</div>
        {years[i] ? <div className="syear">{years[i]}</div> : null}
      </div>
    );
  };

  let pair = 0;
  const columns = ctx.stageColumns.map((col, c) => {
    if (col.stages.length === 1) return unit(col.stages[0]);
    // The first branch mirrors upward (sg-top), the caption band sits on the
    // spine, the rest hang below; the strokes turn green as the bars do: in
    // when the column before is cleared, out when both gates are.
    const geom = forks[pair++] || null;
    const preDone = preBoundaryDone(p, col.stages[0], ctx);
    const allDone = col.stages.every((i) => p.stages[i].status === "done");
    const cls = ["stagegroup", preDone ? "sg-pre-done" : "", allDone ? "sg-post-done" : ""].filter(Boolean).join(" ");
    const names = col.stages.map((i) => ctx.stages[i]).join(s.text.listJoin);
    return (
      <div key={`g${c}`} className={cls} role="group" aria-label={fill(s.text.forkLabel, { names })}>
        <svg
          className="forkline"
          preserveAspectRatio="none"
          aria-hidden="true"
          focusable="false"
          viewBox={geom ? geom.viewBox : undefined}
        >
          {geom ? (
            <>
              <path className="fk-arm is-in" d={geom.inD} />
              <path className="fk-arm is-out" d={geom.outD} />
              <circle className="fk-node is-in" cx="0" cy={geom.spine} r={FORK_NODE} />
              <circle className="fk-node is-out" cx={geom.w} cy={geom.spine} r={FORK_NODE} />
            </>
          ) : null}
        </svg>
        {col.stages.map((i, n) => [
          n ? <div key={`note${n}`} className="stagegroup-note" aria-hidden="true"></div> : null,
          unit(i, n === 0 ? "sg-top" : "sg-bottom"),
        ])}
      </div>
    );
  });

  return (
    <div className="trackbox">
      <div className="track" ref={trackRef}>
        {columns}
      </div>
    </div>
  );
}
