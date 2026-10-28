"use client";

// The small definition hint (.stat-tip) behind each "i" button (.info): what
// "Delayed" means, what the two access figures mean. Hover, focus or a tap
// shows it; leaving, moving focus, a click elsewhere or any scroll hides it.
//
// Ported from the block after the board's header row in launch-rbm-test
// 7c1bf11 (en/index.html), which appended the hint to <body> and listened on
// #board. Here the dashboard renders <StatTip> once inside its root, and
// the board spreads statTipHandlers(controls) on its own element, so every
// .info inside it works as before. An .info button carries its text in
// data-tip.
import {
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type DOMAttributes,
  type Ref,
  type RefObject,
} from "react";

export interface StatTipControls {
  /** show this .info button's data-tip next to it */
  show(button: Element): void;
  hide(): void;
}

interface StatTipState {
  text: string;
  rect: DOMRect | null;
  shown: boolean;
  n: number;
}

/** The hint itself: today's <div class="stat-tip" role="tooltip" hidden>. */
export function StatTip({ ref }: { ref?: Ref<StatTipControls> }) {
  const box = useRef<HTMLDivElement>(null);
  const [s, setS] = useState<StatTipState>({ text: "", rect: null, shown: false, n: 0 });

  useImperativeHandle(
    ref,
    () => ({
      show: (b) =>
        setS((p) => ({ text: b.getAttribute("data-tip") || "", rect: b.getBoundingClientRect(), shown: true, n: p.n + 1 })),
      hide: () => setS((p) => (p.shown ? { ...p, shown: false } : p)),
    }),
    [],
  );

  // A click anywhere but on the board's .info, and any scroll, hides it: a
  // fixed hint would otherwise stay put while its button scrolls away. Only
  // the dashboard's own board counts: the host page may have an .info too.
  useEffect(() => {
    const hide = () => setS((p) => (p.shown ? { ...p, shown: false } : p));
    const onClick = (e: MouseEvent) => {
      const info = e.target instanceof Element ? e.target.closest(".info") : null;
      if (!(info && info.closest(".launch-dashboard #board"))) hide();
    };
    document.addEventListener("click", onClick);
    window.addEventListener("scroll", hide, true);
    return () => {
      document.removeEventListener("click", onClick);
      window.removeEventListener("scroll", hide, true);
    };
  }, []);

  // above its button, or below it when there is no room; 8px inside the window
  useLayoutEffect(() => {
    const tip = box.current;
    if (!tip || !s.shown || !s.rect) return;
    const r = s.rect;
    const w = tip.offsetWidth;
    const h = tip.offsetHeight;
    tip.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left + r.width / 2 - w / 2)) + "px";
    tip.style.top = (r.top - h - 8 < 8 ? r.bottom + 8 : r.top - h - 8) + "px";
  }, [s]);

  return (
    <div className="stat-tip" role="tooltip" hidden={!s.shown} ref={box}>
      {s.text}
    </div>
  );
}

/** The ref to give <StatTip>, and controls that never change. */
export function useStatTipControls(): [RefObject<StatTipControls | null>, StatTipControls] {
  const ref = useRef<StatTipControls>(null);
  const controls = useMemo<StatTipControls>(
    () => ({ show: (b) => ref.current?.show(b), hide: () => ref.current?.hide() }),
    [],
  );
  return [ref, controls];
}

/**
 * The .info button the event is on, if it is inside the element the handlers
 * are spread on. The page's closest(".info") alone would also find an .info
 * the host page wraps around the dashboard.
 */
const infoOf = (e: { target: EventTarget; currentTarget: EventTarget }) => {
  const b = e.target instanceof Element ? e.target.closest(".info") : null;
  return b && e.currentTarget instanceof Element && e.currentTarget.contains(b) ? b : null;
};

/**
 * The page's listeners on #board, as props for the element that holds the
 * .info buttons: hover, focus or click on one shows its hint; the pointer
 * leaving one, or focus leaving anything inside, hides it. React's focus and
 * blur bubble, as the page's focusin and focusout did.
 */
export function statTipHandlers(tip: StatTipControls): Pick<
  DOMAttributes<HTMLElement>,
  "onMouseOver" | "onMouseOut" | "onFocus" | "onBlur" | "onClick"
> {
  return {
    onMouseOver: (e) => {
      const b = infoOf(e);
      if (b) tip.show(b);
    },
    onMouseOut: (e) => {
      if (infoOf(e)) tip.hide();
    },
    onFocus: (e) => {
      const b = infoOf(e);
      if (b) tip.show(b);
    },
    onBlur: () => tip.hide(),
    onClick: (e) => {
      const b = infoOf(e);
      if (b) tip.show(b);
    },
  };
}
