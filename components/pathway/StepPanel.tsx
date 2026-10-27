"use client";

// The step panel (#gatewrap), opened from the pathway strip: what happens at
// that step, who decides, why it can stall (data.stageInfo, general to the
// step) and, where the status words are shown, how many medicines are at
// each status. Where each medicine is belongs to the board, which lights the
// step's column; per-medicine detail is one click on that stage's marker.
//
// The markup openGatePanel() wrote into #gatewrap, ported from
// launch-rbm-test 7c1bf11 (en/index.html). tests/markup-pathway.test.ts
// compares it with that markup for every step in all three languages.
import type { Product, StageInfo } from "@/lib/dataset";
import { COUNT_ORDER, parallelPair, statusCounts, stepNo } from "@/lib/pathway";
import type { StageContext } from "@/lib/stages";
import { fill } from "@/lib/strings";
import { StageIcon } from "./icons";
import type { PathwayText } from "./text";

export interface StepPanelProps {
  /** the open step's stage index, or null: the panel is then hidden and empty */
  step: number | null;
  ctx: StageContext;
  /** the listed medicines (tracked(), after applyShowLate) */
  products: Product[];
  /** data.stageInfo; a step without an entry shows no explanation */
  stageInfo?: (StageInfo | null)[] | null;
  text: PathwayText;
  /** the Close button */
  onClose?: () => void;
  whoEmblemSrc?: string;
}

export function StepPanel({ step: i, ctx, products, stageInfo, text, onClose, whoEmblemSrc }: StepPanelProps) {
  if (i == null) return <div className="gatewrap" id="gatewrap" hidden></div>;

  const info = (stageInfo || [])[i];
  // With "delayed" and "in progress" hidden the tally would leave medicines
  // out, so it goes whole; the board's lit column still shows where each is.
  const counts = statusCounts(i, products);
  const chips = ctx.display.showProgress
    ? COUNT_ORDER.filter((k) => counts[k]).map((k) => (
        <span className={`gp-pill ${k}`} key={k}>{`${counts[k]} ${text.statusNoun[k]}`}</span>
      ))
    : null;
  // A step holding two milestones says so: they run in parallel, so eight
  // milestones fit in seven steps.
  const pair = parallelPair(i, ctx);
  const n = stepNo(i, ctx);

  return (
    <div className="gatewrap" id="gatewrap" aria-label={fill(text.stepPanelLabel, { n, stage: ctx.stages[i] })}>
      <div className="gw-head">
        <span className="gw-ico">
          <StageIcon i={i} whoEmblemSrc={whoEmblemSrc} />
        </span>
        <div>
          <div className="gw-step">{fill(text.stepOf, { n, total: ctx.stageColumns.length })}</div>
          <h3>{ctx.stages[i]}</h3>
        </div>
        <span className="gw-sum" aria-label={fill(text.summaryLabel, { count: products.length })}>
          {chips}
        </span>
        <button className="gp-close" type="button" data-close="gate" onClick={onClose}>
          {text.close}
        </button>
      </div>
      {pair ? (
        <p className="gw-par">{fill(text.parallel, { a: ctx.stages[pair[0]], b: ctx.stages[pair[1]], n })}</p>
      ) : null}
      {info ? (
        <div className="gw-band">
          <h4>{text.whatHappens}</h4>
          <p>{info.what}</p>
          <div className="gw-facts">
            <div>
              <h5>{text.whoDecides}</h5>
              <p>{info.who}</p>
            </div>
            <div>
              <h5>{text.whyStall}</h5>
              <p>{info.stall}</p>
            </div>
            <div>
              <h5>{text.source}</h5>
              <p>{info.source}</p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
