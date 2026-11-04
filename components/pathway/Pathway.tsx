"use client";

// The pathway area: the strip (#pathway) and, under it, the step panel
// (#gatewrap) it opens. One step's panel is open at a time; choosing the open
// step again closes it, Close closes it, and Escape closes it and puts focus
// back on the step's button, as on the page.
//
// It renders the two siblings the page had, with no wrapper. Which step is
// open can be left to it, or held by the dashboard (openStep with
// onOpenStep), which the board needs to light the step's column.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Product, StageInfo } from "@/lib/dataset";
import { PATHWAY_DISPLAY, type PathwayDisplay } from "@/lib/pathway";
import type { StageContext } from "@/lib/stages";
import { layoutStrip } from "./layout";
import { PathwayStrip } from "./PathwayStrip";
import { StepPanel } from "./StepPanel";
import type { PathwayText } from "./text";

export interface PathwayProps {
  ctx: StageContext;
  /** the listed medicines: tracked(applyShowLate(data.products, ctx.display)) */
  products: Product[];
  /** data.stageInfo */
  stageInfo?: (StageInfo | null)[] | null;
  text: PathwayText;
  display?: PathwayDisplay;
  /**
   * The open step's stage index, or null. Leave it undefined and the
   * component keeps it; pass it (with onOpenStep) to hold it in the dashboard.
   */
  openStep?: number | null;
  /** a step was opened (its stage index), or the panel was closed (null) */
  onOpenStep?: (i: number | null) => void;
  /**
   * True while a medicine's stage panel (the board's .gatepanel) is open.
   * Escape then closes that panel first, as on the page, and leaves this one.
   */
  cellPanelOpen?: boolean;
  whoEmblemSrc?: string;
}

export function Pathway({
  ctx,
  products,
  stageInfo,
  text,
  display = PATHWAY_DISPLAY,
  openStep,
  onOpenStep,
  cellPanelOpen = false,
  whoEmblemSrc,
}: PathwayProps) {
  const stripRef = useRef<HTMLDivElement>(null);
  const [ownStep, setOwnStep] = useState<number | null>(null);
  const controlled = openStep !== undefined;
  const open = controlled ? openStep : ownStep;

  const setOpen = useCallback(
    (i: number | null) => {
      if (!controlled) setOwnStep(i);
      onOpenStep?.(i);
    },
    [controlled, onOpenStep],
  );

  // Lay the strip out once it is drawn, again when its width changes (the
  // window, or the host page's own columns), and again once web fonts land,
  // as labels rewrap. The page re-ran this on window resize and whenever a
  // medicine's row opened; watching the strip itself covers both, and a
  // host's sidebar opening, which no window event reports. Only a change of
  // width re-runs it: its own height changes when it stacks, and must not.
  useLayoutEffect(() => {
    const el = stripRef.current;
    if (!el) return;
    layoutStrip(el);
    let frame = 0;
    const again = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => layoutStrip(el));
    };
    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      // the first reading (on observe) runs one more pass, which changes nothing
      let width = -1;
      observer = new ResizeObserver((entries) => {
        const w = entries[entries.length - 1].contentRect.width;
        if (w !== width) {
          width = w;
          again();
        }
      });
      observer.observe(el);
    } else {
      window.addEventListener("resize", again);
    }
    let live = true;
    if (document.fonts) {
      document.fonts.ready.then(() => {
        if (live) layoutStrip(el);
      });
    }
    return () => {
      live = false;
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("resize", again);
    };
    // re-measure only when what the strip draws changes
  }, [ctx.locale, ctx.stages, ctx.stageColumns, text, display.showStageExpected]);

  // Escape closes the open step and returns focus to its button. A medicine's
  // stage panel, when one is open, is closed first (by the board).
  useEffect(() => {
    if (open == null || cellPanelOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const button = stripRef.current?.querySelector<HTMLElement>(`[data-gate="${open}"]`);
      setOpen(null);
      button?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, cellPanelOpen, setOpen]);

  return (
    <>
      <PathwayStrip
        ref={stripRef}
        ctx={ctx}
        products={products}
        text={text}
        display={display}
        openStep={open}
        onToggle={(i) => setOpen(open === i ? null : i)}
        whoEmblemSrc={whoEmblemSrc}
      />
      {/* Close leaves focus where it falls, as on the page (see the notes) */}
      <StepPanel
        step={open}
        ctx={ctx}
        products={products}
        stageInfo={stageInfo}
        text={text}
        onClose={() => setOpen(null)}
        whoEmblemSrc={whoEmblemSrc}
      />
    </>
  );
}
