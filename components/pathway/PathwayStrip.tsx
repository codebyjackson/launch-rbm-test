"use client";

// The pathway strip (#pathway): the eight milestones in their seven steps,
// under the two access phases, Market Access then Country Access. Each step
// is a button that opens its step panel (#gatewrap). A column of two stages
// (stageColumns [2, 3]: WHO recommendation and WHO PQ listing) is a parallel
// pair with no order between them, drawn stacked and bracketed, and both
// carry the column's step number.
//
// pathNodeHtml, stepColumnHtml, pathExpHtml and the statement that fills
// #pathway, ported from launch-rbm-test 7c1bf11 (en/index.html).
// tests/markup-pathway.test.ts compares the result with that markup in all
// three languages. Its layout (side by side or stacked, the pair lifted onto
// the other icons' line) is measured by <Pathway>, which renders this.
import { Fragment, type Ref } from "react";
import type { Product, StageColumn } from "@/lib/dataset";
import { PATHWAY_DISPLAY, lateAt, phaseColumns, stepNo, type PathwayDisplay } from "@/lib/pathway";
import { phaseOf, yrsText, type StageContext } from "@/lib/stages";
import { fill, pageText } from "@/lib/strings";
import { fillNodes } from "./fillNodes";
import { StageIcon } from "./icons";
import type { PathwayText } from "./text";

export interface PathwayStripProps {
  ctx: StageContext;
  /** the listed medicines (tracked(), after applyShowLate): the delayed counts read them */
  products: Product[];
  text: PathwayText;
  display?: PathwayDisplay;
  /** the step whose panel is open: its button reads as expanded */
  openStep?: number | null;
  /** a step's button was chosen */
  onToggle?: (i: number) => void;
  whoEmblemSrc?: string;
  ref?: Ref<HTMLDivElement>;
}

export function PathwayStrip({
  ctx,
  products,
  text,
  display = PATHWAY_DISPLAY,
  openStep = null,
  onToggle,
  whoEmblemSrc,
  ref,
}: PathwayStripProps) {
  const phases = pageText(ctx.locale).phases;

  const node = (i: number, stacked: boolean) => {
    const s = ctx.stages[i];
    const n = lateAt(i, products, ctx);
    const e = display.showStageExpected && ctx.yardstick ? ctx.yardstick.expected[i] : null;
    const label = fill(text.nodeLabel, {
      n: stepNo(i, ctx),
      stage: s,
      expected: e ? fill(text.nodeExpected, { years: yrsText(e.years, ctx.locale) }) : "",
      // the per-step delayed count is for screen readers only (the visible
      // "N delayed" line went on 10 Sep 2026)
      delayed: n ? fill(text.nodeDelayed, { n }) : "",
    });
    return (
      <button
        className={stacked ? "pathnode pathnode-sm" : "pathnode"}
        type="button"
        aria-expanded={openStep === i}
        aria-controls="gatewrap"
        data-gate={i}
        data-phase={stacked ? undefined : phaseOf(i)}
        aria-label={label}
        onClick={onToggle ? () => onToggle(i) : undefined}
      >
        <span className="pill">
          <StageIcon i={i} whoEmblemSrc={whoEmblemSrc} />
          <span className="nb" aria-hidden="true">
            {stepNo(i, ctx)}
          </span>
        </span>
        <span className="plabel">{s}</span>
        {e ? (
          // the expected time under the step: a clock tag, so it reads as an estimate
          <span className="pathexp">
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <circle cx="12" cy="13" r="8" />
              <path d="M12 9v4l2.5 2M9.5 2.5h5" />
            </svg>
            {fillNodes(text.expectedTag, { years: <b>{yrsText(e.years, ctx.locale)}</b> })}
          </span>
        ) : null}
      </button>
    );
  };

  const column = (col: StageColumn) => {
    if (col.stages.length === 1) return node(col.stages[0], false);
    const names = col.stages.map((i) => ctx.stages[i]).join(text.pairJoin);
    return (
      <span
        className="pathgroup"
        data-phase={phaseOf(col.stages[0])}
        role="group"
        aria-label={fill(text.pairLabel, { names })}
      >
        {col.stages.map((i, n) => (
          <Fragment key={i}>
            {/* an empty spacer: the pair keeps its gap, and the lift measures the same structure */}
            {n ? <span className="pathgroup-note" aria-hidden="true"></span> : null}
            {node(i, true)}
          </Fragment>
        ))}
      </span>
    );
  };

  return (
    <div className="pathway" id="pathway" role="group" aria-label={text.pathwayLabel} ref={ref}>
      {phases.map((name, k) => (
        <Fragment key={k}>
          {k ? (
            <span className="patharrow phasegap" aria-hidden="true">
              →
            </span>
          ) : null}
          {/* two white cards, one per phase, with the arrow between them in the gap */}
          <section className={`phase ph${k}`} aria-label={name}>
            <div className="phase-t">
              <b>
                <i className="phn">{k + 1}</i>
                {name}
              </b>
            </div>
            <div className="phase-body">
              {phaseColumns(k, ctx).map((col, n) => (
                <Fragment key={col.stages.join(",")}>
                  {n ? (
                    <span className="patharrow" aria-hidden="true">
                      →
                    </span>
                  ) : null}
                  {column(col)}
                </Fragment>
              ))}
            </div>
          </section>
        </Fragment>
      ))}
    </div>
  );
}
