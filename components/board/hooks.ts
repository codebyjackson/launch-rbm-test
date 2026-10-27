"use client";
// The board's measuring: where the page read sizes off the DOM and moved
// things to fit. The arithmetic is in lib/board.ts (fitTiers, forkLift,
// forkGeometry); these hooks only measure, and hand the result to React.
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { fitTiers, forkGeometry, forkLift, type ForkGeometry, type JourneyLayout, type TierFit } from "@/lib/board";

/**
 * fitTimeline: the timeline's tiers spaced by their measured label blocks.
 * Rows open closed, so a timeline has no size until it is shown; it is fitted
 * on its first non-zero width and again whenever its width changes (opening a
 * row, switching back to the timeline, resizing). Its own height change does
 * not change its width, so this cannot loop. Once the fonts arrive (a late web
 * font rewraps the labels) a visible timeline is fitted again.
 *
 * Returns null until fitted, and again when the layout changes, so the
 * estimate shows rather than a fit of the old layout. Without ResizeObserver
 * it fits only when the fonts arrive, as the page did.
 */
export function useTimelineFit(ref: RefObject<HTMLDivElement | null>, layout: JourneyLayout): TierFit | null {
  const [fit, setFit] = useState<{ layout: JourneyLayout; fit: TierFit } | null>(null);
  const lastWidth = useRef(0);

  const measure = useCallback(() => {
    const tsa = ref.current;
    if (!tsa) return;
    const heights: number[][] = [];
    tsa.querySelectorAll<HTMLElement>(".it").forEach((it) => {
      const t = +(it.dataset.tier ?? 0);
      (heights[t] = heights[t] || []).push(it.offsetHeight);
    });
    setFit({ layout, fit: fitTiers(heights, layout.height) });
  }, [ref, layout]);

  useEffect(() => {
    const tsa = ref.current;
    if (!tsa) return;
    lastWidth.current = 0;
    let live = true;
    const ro =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver((entries) =>
            entries.forEach((e) => {
              const w = Math.round(e.contentRect.width);
              if (w && w !== lastWidth.current) {
                lastWidth.current = w;
                measure();
              }
            }),
          );
    ro?.observe(tsa);
    document.fonts?.ready.then(() => {
      if (live && tsa.offsetWidth) measure();
    });
    return () => {
      live = false;
      ro?.disconnect();
    };
  }, [ref, measure]);

  return fit && fit.layout === layout ? fit.fit : null;
}

/**
 * alignStageForks and drawStageForks, for one row's Pathway order track,
 * while it is shown (`active`): the lift that puts a pair's spine on every
 * other marker's line, then each pair's strokes. Re-run on `again` changing
 * (each time the row is opened), on resize, and when the fonts arrive, since
 * labels wrap differently and move the spine.
 *
 * --sg-lift is written to the track's style directly, as on the page: it must
 * be 0 while measuring, which a React state round would paint first. React
 * never sets the track's style, so the two do not meet. The strokes return as
 * state; a pair not laid out keeps the strokes it had.
 */
export function useStageForks(
  ref: RefObject<HTMLDivElement | null>,
  active: boolean,
  again: unknown,
): (ForkGeometry | null)[] {
  const [forks, setForks] = useState<(ForkGeometry | null)[]>([]);

  const layout = useCallback(() => {
    const track = ref.current;
    if (!track) return;
    // the lift is read from the first pair only, per track
    const group = track.querySelector(".stagegroup");
    if (group) {
      track.style.setProperty("--sg-lift", "0px");
      const note = group.querySelector(".stagegroup-note");
      const mark = group.querySelector<HTMLElement>(".smark");
      if (note && mark) {
        track.style.setProperty(
          "--sg-lift",
          forkLift(note.getBoundingClientRect(), group.getBoundingClientRect().top, mark.offsetHeight),
        );
      }
    }
    const drawn = Array.from(track.querySelectorAll(".stagegroup"), (g) => {
      const marks = g.querySelectorAll(".smark");
      if (!g.querySelector(".forkline") || marks.length < 2) return undefined;
      return (
        forkGeometry(
          g.getBoundingClientRect(),
          marks[0].getBoundingClientRect(),
          marks[marks.length - 1].getBoundingClientRect(),
        ) ?? undefined
      );
    });
    setForks((prev) => drawn.map((g, n) => (g === undefined ? (prev[n] ?? null) : g)));
  }, [ref]);

  useLayoutEffect(() => {
    if (active) layout();
  }, [active, again, layout]);

  useEffect(() => {
    if (!active) return;
    let frame = 0;
    let live = true;
    const onResize = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(layout);
    };
    window.addEventListener("resize", onResize);
    document.fonts?.ready.then(() => {
      if (live) layout();
    });
    return () => {
      live = false;
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(frame);
    };
  }, [active, layout]);

  return forks;
}

/**
 * prefers-reduced-motion, read once when the board mounts, as the page read
 * it once at start-up. false on the server: the only motion is a fade when a
 * view is switched, which never happens before the board is live.
 */
export function useReducedMotion(): RefObject<boolean> {
  const reduce = useRef(false);
  useEffect(() => {
    reduce.current = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);
  return reduce;
}
