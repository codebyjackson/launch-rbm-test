"use client";

// One medicine's panel for one stage: what the data says about that gate, the
// next step, how long the current gate has waited, the countries (for
// country registration and policy adoption) and the sources. It opens under a
// medicine's journey in the board when one of its stage markers is chosen.
//
// gatePanelHTML(p, i) and the .gatepanel container in the board's row markup,
// ported from launch-rbm-test 7c1bf11 (en/index.html). The board owns which
// panel is open (one at a time, board-wide), the marker's aria-expanded, the
// row's gate-flag class and Escape; this draws the panel.
// tests/markup-pathway.test.ts compares GatePanelContent with gatePanelHTML
// for every medicine and stage in all three languages.
import { Fragment, type ReactNode } from "react";
import type { Product, Source } from "@/lib/dataset";
import { citeOrText, shortDate } from "@/lib/format";
import { PATHWAY_DISPLAY, levelCounts, stalledSince, type PathwayDisplay } from "@/lib/pathway";
import { statusShown, yrsText, type StageContext } from "@/lib/stages";
import { fill, pageText } from "@/lib/strings";
import { Cites } from "./Cites";
import { fillNodes } from "./fillNodes";
import type { PathwayText } from "./text";

export interface GatePanelContentProps {
  product: Product;
  /** the stage index */
  stage: number;
  ctx: StageContext;
  /** every source, for the citations (Localized.sources.sources) */
  sources: readonly Source[];
  text: PathwayText;
  display?: PathwayDisplay;
  /** the Close button; the board closes the panel */
  onClose?: () => void;
}

/** gatePanelHTML: the inside of a medicine's stage panel. */
export function GatePanelContent({
  product: p,
  stage: i,
  ctx,
  sources,
  text,
  display = PATHWAY_DISPLAY,
  onClose,
}: GatePanelContentProps) {
  const st = p.stages[i];
  const el2 = stalledSince(p, i, ctx);
  const isCur = i === p.currentStage;
  const shown = statusShown(p, st.status, ctx.display);
  const countriesOf = i === 4 || i === 5 ? p.detail.countries : undefined;

  const kv: [string, ReactNode][] = [];
  if (st.date) kv.push([text.recorded, st.date]);
  if (st.next) kv.push([text.nextStep, st.next]);
  if (st.nextDate) kv.push([text.expected, st.nextDate]);
  if (el2 && shown) {
    kv.push([
      text.pendingSince,
      <>
        <span className="gp-elapsed">{yrsText(el2.yrs, ctx.locale)}</span>
        {` — ${el2.label} (${el2.year})`}
      </>,
    ]);
  }

  // Adoption requirements belong to the national-policy gate specifically.
  // p.detail is read only for that stage, as on the page.
  const reqs =
    i === 5 && Array.isArray(p.detail.adoption) && p.detail.adoption.length ? (
      <div className="gp-kv">
        <dt>{text.adoptionNeeds}</dt>
        <dd>{p.detail.adoption.join(" · ")}</dd>
      </div>
    ) : null;

  // the country survey speaks to registration and policy adoption
  const list = countriesOf && Array.isArray(countriesOf.list) ? countriesOf.list : null;
  const c = list ? levelCounts(list) : null;

  // Each part is there only when the page's string for it was not empty. The
  // source line shows even when no citation resolves, as "Source: ".
  const prov: ReactNode[] = [];
  if (st.source || (st.sources || []).length) {
    prov.push(fillNodes(text.sourceLine, { cites: <Cites cites={citeOrText(st.sources, st.source, sources)} /> }));
  }
  if (st.asOf) prov.push(fill(text.verified, { date: shortDate(st.asOf, ctx.locale) }));
  if (countriesOf && countriesOf.status !== "verified") {
    // the status is a key ("illustrative"); spelled out whole so the sentence translates as one
    prov.push(
      countriesOf.status === "illustrative"
        ? text.surveyIllustrative
        : fill(text.surveyStatus, { status: countriesOf.status == null ? "" : String(countriesOf.status) }),
    );
  }

  return (
    <>
      <div className="gp-head">
        <span className="gp-stage">{ctx.stages[i]}</span>
        {shown ? <span className={`gp-pill ${st.status}`}>{pageText(ctx.locale).status[st.status]}</span> : null}
        <button className="gp-close" type="button" data-close="cell" onClick={onClose}>
          {text.close}
        </button>
      </div>
      {st.note ? <p className="gp-note">{st.note}</p> : null}
      {isCur && display.showBarriers && p.flag ? <div className="gp-why">{p.flag}</div> : null}
      {kv.length || reqs ? (
        <div className="gp-grid">
          {kv.map(([k, v]) => (
            <div className="gp-kv" key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
          {reqs}
        </div>
      ) : null}
      {c ? (
        <div className="gp-countries">
          <span className="key">
            <span className="mapsw registered"></span>
            {text.levels.registered} <span className="n">{c.registered}</span>
          </span>
          <span className="key">
            <span className="mapsw guidelines"></span>
            {text.levels.guidelines} <span className="n">{c.guidelines}</span>
          </span>
          <span className="key">
            <span className="mapsw mft"></span>
            {text.levels.mft} <span className="n">{c.mft}</span>
          </span>
        </div>
      ) : null}
      {prov.length ? (
        <div className="gp-prov">
          {prov.map((part, n) => (
            <Fragment key={n}>
              {n ? " · " : null}
              {part}
            </Fragment>
          ))}
        </div>
      ) : null}
    </>
  );
}

export interface GatePanelProps extends Omit<GatePanelContentProps, "stage"> {
  /** the stage whose panel is open for this medicine, or null when it is closed */
  stage: number | null;
}

/**
 * The panel's container under a medicine's journey, id "<product id>-gate"
 * (each stage marker's aria-controls). Hidden and empty while closed. It
 * takes the delayed look (a red edge) only where "Delayed" is shown.
 */
export function GatePanel({ stage, ...props }: GatePanelProps) {
  const p = props.product;
  const late = stage != null && p.stages[stage].status === "late" && statusShown(p, "late", props.ctx.display);
  return (
    <div className={late ? "gatepanel late" : "gatepanel"} id={`${p.id}-gate`} hidden={stage == null}>
      {stage != null ? <GatePanelContent {...props} stage={stage} /> : null}
    </div>
  );
}
