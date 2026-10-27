"use client";

// The page's one hover hint (#tip): a dark box above what the pointer or
// focus is on, or below it when there is no room above. The board's stage
// markers and glossary terms and the map's countries all use it.
//
// tip, showTipAt, showTipAtPoint and hideTip, ported from launch-rbm-test
// 7c1bf11 (en/index.html), with showStageTip's content as <StagePeek>. The
// page's #tip sat outside .wrap, directly under <body>, where the scoped CSS
// cannot reach it now. The dashboard renders <Tip> once, inside its root
// (after .wrap, where the page had it), and hands the controls from
// useTipControls() to the areas that show hints. Showing a hint re-renders
// only the Tip, never the area that asked, so the map can move it on every
// mouse move.
import { useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type Ref, type RefObject } from "react";
import type { Product } from "@/lib/dataset";
import { peekLineFor, type StageContext } from "@/lib/stages";
import type { PathwayText } from "./text";

/** What an area may do with the hint. */
export interface TipControls {
  /** showTipAt: centred above `el`, or below it when there is no room; kept 8px inside the window */
  showAt(el: Element, content: ReactNode): void;
  /** showTipAtPoint: anchored to a point (the map's pointer), not an element */
  showAtPoint(x: number, y: number, content: ReactNode): void;
  /** hideTip */
  hide(): void;
}

type Anchor = { rect: DOMRect } | { x: number; y: number };

interface TipState {
  content: ReactNode;
  anchor: Anchor | null;
  shown: boolean;
  /** counts every show, so showing the same content at a new place moves it */
  n: number;
}

/**
 * The hint itself. Before anything is shown it is today's empty
 * <div id="tip" role="tooltip">, which the CSS keeps hidden.
 */
export function Tip({ ref }: { ref?: Ref<TipControls> }) {
  const box = useRef<HTMLDivElement>(null);
  const [s, setS] = useState<TipState>({ content: null, anchor: null, shown: false, n: 0 });

  useImperativeHandle(
    ref,
    () => ({
      // the anchor's place is read when the hint is asked for, as on the page
      showAt: (el, content) =>
        setS((p) => ({ content, anchor: { rect: el.getBoundingClientRect() }, shown: true, n: p.n + 1 })),
      showAtPoint: (x, y, content) => setS((p) => ({ content, anchor: { x, y }, shown: true, n: p.n + 1 })),
      // the content stays, hidden, until the next show, as on the page
      hide: () => setS((p) => (p.shown ? { ...p, shown: false } : p)),
    }),
    [],
  );

  // Placed after its content is drawn and before it is painted: its size
  // decides where it goes. Position and display are set on the element, not
  // rendered, so the server's markup stays today's.
  useLayoutEffect(() => {
    const tip = box.current;
    if (!tip || !s.n) return;
    if (!s.shown || !s.anchor) {
      tip.style.display = "none";
      return;
    }
    tip.style.display = "block";
    const tw = tip.offsetWidth;
    const th = tip.offsetHeight;
    let x: number;
    let y: number;
    if ("rect" in s.anchor) {
      const r = s.anchor.rect;
      x = Math.max(8, Math.min(r.left + r.width / 2 - tw / 2, window.innerWidth - tw - 8));
      y = r.top - th - 10;
      if (y < 8) y = r.bottom + 10;
    } else {
      const { x: cx, y: cy } = s.anchor;
      x = Math.max(8, Math.min(cx - tw / 2, window.innerWidth - tw - 8));
      const above = cy - th - 14;
      y = above < 8 ? cy + 18 : above;
    }
    tip.style.left = x + "px";
    tip.style.top = y + "px";
  }, [s]);

  return (
    <div id="tip" role="tooltip" ref={box}>
      {s.content}
    </div>
  );
}

/**
 * The ref to give <Tip>, and controls that are safe to hand to any area: they
 * never change, and do nothing until the Tip is mounted.
 */
export function useTipControls(): [RefObject<TipControls | null>, TipControls] {
  const ref = useRef<TipControls>(null);
  const controls = useMemo<TipControls>(
    () => ({
      showAt: (el, content) => ref.current?.showAt(el, content),
      showAtPoint: (x, y, content) => ref.current?.showAtPoint(x, y, content),
      hide: () => ref.current?.hide(),
    }),
    [],
  );
  return [ref, controls];
}

/**
 * showStageTip's content: a stage marker's one-line peek. The stage, its
 * status word and when it was cleared or is expected (peekLine), and a hint
 * that a click opens the full detail. The board shows it on a marker's hover
 * or focus, unless that marker's own panel is open.
 */
export function StagePeek({
  product: p,
  stage: i,
  ctx,
  text,
}: {
  product: Product;
  stage: number;
  ctx: StageContext;
  text: PathwayText;
}) {
  const st = p.stages[i];
  const line = peekLineFor(p, ctx)(st.status, st.date, st.nextDate);
  return (
    <>
      <b>{ctx.stages[i]}</b>
      {line ? <div>{line}</div> : null}
      <div className="thint">{text.clickForDetail}</div>
    </>
  );
}
