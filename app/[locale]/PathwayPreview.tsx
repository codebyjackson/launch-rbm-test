"use client";

// EXAMPLE APP ONLY (branch feat/react-port-pathway): shows the pathway area's
// components working, until the Dashboard wires the areas together. Not for
// RBM. The strip and step panel are the real thing; the per-medicine rows
// below them stand in for the board, only to show what the board will use:
// a medicine's stage panel (GatePanel), the stage peek in #tip (StagePeek),
// the Country access rows (CountryAccessKv) and an .info hint (StatTip).
import { useEffect, useMemo, useState } from "react";
import {
  CountryAccessKv,
  GatePanel,
  JourneyIconSprite,
  Pathway,
  StagePeek,
  StatTip,
  Tip,
  statTipHandlers,
  useStatTipControls,
  useTipControls,
  type PathwayText,
} from "@/components/pathway";
import type { Product, Source, StageInfo } from "@/lib/dataset";
import { colIndexOf } from "@/lib/pathway";
import type { StageContext } from "@/lib/stages";

export function PathwayPreview({
  ctx,
  products,
  stageInfo,
  sources,
  text,
}: {
  ctx: StageContext;
  products: Product[];
  stageInfo?: (StageInfo | null)[] | null;
  sources: Source[];
  text: PathwayText;
}) {
  const [step, setStep] = useState<number | null>(null);
  const [cell, setCell] = useState<{ pid: string; i: number } | null>(null);
  const [tipRef, tip] = useTipControls();
  const [statRef, statTip] = useStatTipControls();
  const statHandlers = useMemo(() => statTipHandlers(statTip), [statTip]);

  // The board's half of the Escape contract: a medicine's panel closes first,
  // and focus goes back to its marker. <Pathway> stands aside meanwhile.
  useEffect(() => {
    if (!cell) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const marker = document.querySelector<HTMLElement>(`[data-preview-cell="${cell.pid}-${cell.i}"]`);
      setCell(null);
      marker?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [cell]);

  return (
    <>
      <JourneyIconSprite />
      <div className="wrap">
        <Pathway
          ctx={ctx}
          products={products}
          stageInfo={stageInfo}
          text={text}
          openStep={step}
          onOpenStep={setStep}
          cellPanelOpen={cell != null}
        />
        <div {...statHandlers} style={{ display: "grid", gap: 12 }}>
          <p>
            Example only: stand-in rows for the board. Open step:{" "}
            {step == null ? "none" : `${step} (board column ${colIndexOf(step, ctx)})`}{" "}
            <button type="button" className="info" data-tip={stageInfo?.[0]?.what ?? ""} aria-label={stageInfo?.[0]?.what ?? ""}>
              i
            </button>
          </p>
          {products.map((p) => (
            <section key={p.id} className="card">
              <h3>{p.name}</h3>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {p.stages.map((_, i) => {
                  const open = cell?.pid === p.id && cell.i === i;
                  return (
                    <button
                      key={i}
                      type="button"
                      data-preview-cell={`${p.id}-${i}`}
                      aria-expanded={open}
                      aria-controls={`${p.id}-gate`}
                      onMouseEnter={(e) => {
                        if (!open) tip.showAt(e.currentTarget, <StagePeek product={p} stage={i} ctx={ctx} text={text} />);
                      }}
                      onFocus={(e) => {
                        if (!open) tip.showAt(e.currentTarget, <StagePeek product={p} stage={i} ctx={ctx} text={text} />);
                      }}
                      onMouseLeave={tip.hide}
                      onBlur={tip.hide}
                      onClick={() => {
                        setCell(open ? null : { pid: p.id, i });
                        tip.hide();
                      }}
                    >
                      {ctx.stages[i]}
                    </button>
                  );
                })}
              </div>
              <GatePanel
                product={p}
                stage={cell?.pid === p.id ? cell.i : null}
                ctx={ctx}
                sources={sources}
                text={text}
                onClose={() => setCell(null)}
              />
              <CountryAccessKv detail={p.detail} sources={sources} text={text} />
            </section>
          ))}
        </div>
      </div>
      <Tip ref={tipRef} />
      <StatTip ref={statRef} />
    </>
  );
}
