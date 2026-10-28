"use client";
// The medicine board (#board): the medicines table, one section per medicine,
// in the page's order (tracked, lib/pathway.ts), then the rows not yet tracked.
//
// It owns what is board-wide on the page: which rows are open, and the one
// stage panel open at a time. What crosses into other areas goes through
// props and callbacks, never globals (docs/react-port-notes.md, decision 16):
//
//   openProduct / onOpenProduct    a link to a medicine (#pyramax), and back
//   openStep                       the pathway strip's open step, lit here
//   onStageHover / onStageLeave    a stage marker's hint (the pathway's StagePeek)
//   onTermHover / onTermLeave      a glossary term's hint (the pathway's Tip)
//   statTipHandlers                the i buttons' hint (the pathway's StatTip)
//   onCellChange                   the open stage panel, so Escape closes it
//                                  before the strip's step panel
//   render* (BoardSlots)           the parts the pathway area draws
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type DOMAttributes,
  type ReactElement,
} from "react";
import { BOARD_DISPLAY, glossPattern, glossaryOf, type BoardDisplay } from "@/lib/board";
import type { LaunchData, Product, Source } from "@/lib/dataset";
import type { Locale } from "@/lib/locales";
import { colIndexOf, tracked as trackedOf } from "@/lib/pathway";
import { DISPLAY, applyShowLate, stageContext, type Display } from "@/lib/stages";
import { pageText } from "@/lib/strings";
import { accessInfo } from "./access";
import { glossTree } from "./gloss";
import { useReducedMotion } from "./hooks";
import { ProductRow, type RowHooks } from "./ProductRow";
import type { BoardText } from "./text";
import type { BoardSlots, MarkView, OpenCell, Scope } from "./types";

export interface BoardProps extends BoardSlots {
  /** one language of the dataset (localize().data) */
  data: LaunchData;
  /** localize().sources.sources: the names citations show */
  sources: readonly Source[];
  locale: Locale;
  /** the board's interface text in `locale` */
  text: BoardText;
  /**
   * A medicine to open and scroll to, as a link such as #pyramax did. The
   * board acts each time it changes to a tracked medicine's id; anything else
   * is ignored, as unknown hashes were. The router decides where it comes from.
   */
  openProduct?: string | null;
  /**
   * The reader opened a medicine's row. For a router that wants to carry it
   * (today's page did not change the hash). If it comes back as openProduct,
   * it is taken as this report's echo: the row is already open, and the page
   * does not jump to it.
   */
  onOpenProduct?: (id: string) => void;
  /** The step the pathway strip has open; its column lights up in every row. */
  openStep?: number | null;
  /**
   * Hover or focus on a stage marker whose panel is not open: show its
   * one-line hint by `el` (showStageTip on the page). Not called while the
   * marker's own panel is open.
   */
  onStageHover?: (el: HTMLElement, product: Product, stage: number) => void;
  /** Hide the stage hint: the pointer or focus left, or a panel opened. */
  onStageLeave?: () => void;
  /** Hover or focus on a glossary term: show its definition by `el`. */
  onTermHover?: (el: HTMLElement, term: string, definition: string) => void;
  onTermLeave?: () => void;
  /**
   * Spread on #board: the i buttons' hint, delegated from the board as on the
   * page (mouseover, mouseout, focus, blur and click on an .info inside it).
   */
  statTipHandlers?: Omit<DOMAttributes<HTMLDivElement>, "children" | "dangerouslySetInnerHTML">;
  /** The open stage panel changed; null once closed. */
  onCellChange?: (cell: OpenCell | null) => void;
  /** The display switches; as shipped unless a test turns them. */
  display?: Display;
  boardDisplay?: BoardDisplay;
  /** "today" for tests; otherwise the dataset's year */
  asOfYear?: number;
}

interface RowState {
  open: boolean;
  seq: number;
}

interface CellState {
  pid: string;
  stage: number;
  view: MarkView;
}

const isTracked = (tracked: readonly Product[], id: string | null | undefined) =>
  !!id && tracked.some((p) => p.id === id);

export function Board(props: BoardProps) {
  const {
    data,
    sources,
    locale,
    text,
    openProduct,
    openStep,
    statTipHandlers,
    renderStageIcon,
    renderCountryAccess,
    renderCites,
    renderGatePanel,
    display = DISPLAY,
    boardDisplay = BOARD_DISPLAY,
    asOfYear,
  } = props;

  const ctx = useMemo(() => stageContext(data, locale, { display, asOfYear }), [data, locale, display, asOfYear]);
  // the page rewrote late as in progress once at start-up (SHOW_LATE)
  const products = useMemo(() => applyShowLate(data.products, display), [data.products, display]);
  const tracked = useMemo(() => trackedOf(products), [products]);
  const placeholders = useMemo(() => products.filter((p) => p.placeholder), [products]);
  const s: Scope = useMemo(
    () => ({
      ctx,
      text,
      t: pageText(locale),
      sources,
      board: boardDisplay,
      slots: { renderStageIcon, renderCountryAccess, renderCites, renderGatePanel },
    }),
    [ctx, text, locale, sources, boardDisplay, renderStageIcon, renderCountryAccess, renderCites, renderGatePanel],
  );
  const glossary = useMemo(() => glossaryOf(data.glossary), [data.glossary]);
  const glossRe = useMemo(() => glossPattern(glossary), [glossary]);
  const highlightCol = openStep == null ? -1 : colIndexOf(openStep, ctx);

  // Every row starts closed (30 Sep 2026): the table is then short and the
  // reader chooses what to open. A medicine asked for opens from the start.
  const [rows, setRows] = useState<{ [id: string]: RowState }>(() =>
    isTracked(tracked, openProduct) ? { [openProduct as string]: { open: true, seq: 1 } } : {},
  );
  const [cell, setCell] = useState<CellState | null>(null);
  const [scrollTo, setScrollTo] = useState<{ id: string; n: number } | null>(null);

  const boardRef = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const cellRef = useRef<CellState | null>(cell);
  const reported = useRef<string | null>(null);
  const reduceMotion = useReducedMotion();
  // the latest props, for handlers made once
  const latest = useRef(props);
  useLayoutEffect(() => {
    latest.current = props;
    cellRef.current = cell;
  });

  const openRow = useCallback((id: string) => {
    setRows((r) => ({ ...r, [id]: { open: true, seq: (r[id]?.seq ?? 0) + 1 } }));
  }, []);

  // a link to a medicine: open its row and bring it to the top
  useEffect(() => {
    if (!openProduct) return;
    if (openProduct === reported.current) {
      reported.current = null;
      return;
    }
    if (!isTracked(tracked, openProduct)) return;
    openRow(openProduct);
    setScrollTo((prev) => ({ id: openProduct, n: (prev?.n ?? 0) + 1 }));
  }, [openProduct, tracked, openRow]);

  useLayoutEffect(() => {
    if (!scrollTo || !boardRef.current) return;
    const section = Array.from(boardRef.current.children).find((el) => el.id === scrollTo.id);
    section?.scrollIntoView({ block: "start" });
  }, [scrollTo]);

  // report the open panel after it is drawn; not the closed one at mount
  const reportedCell = useRef(false);
  useEffect(() => {
    if (!reportedCell.current && !cell) return;
    reportedCell.current = true;
    latest.current.onCellChange?.(cell ? { productId: cell.pid, stage: cell.stage } : null);
  }, [cell]);

  const closeCell = useCallback(() => setCell(null), []);

  // Escape closes the open stage panel and puts focus back on its marker.
  // With none open, the key is the pathway strip's (onCellChange tells it).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || !cellRef.current) return;
      const m = opener.current;
      setCell(null);
      m?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const hooks: RowHooks = useMemo(
    () => ({
      onToggleRow: (id) => {
        const wasOpen = !!rows[id]?.open;
        setRows((r) => {
          const was = r[id];
          if (was?.open) return { ...r, [id]: { ...was, open: false } };
          return { ...r, [id]: { open: true, seq: (was?.seq ?? 0) + 1 } };
        });
        if (!wasOpen && latest.current.onOpenProduct) {
          reported.current = id;
          latest.current.onOpenProduct(id);
        }
      },
      onToggleCell: (p, i, view, el) => {
        const c = cellRef.current;
        if (c && c.pid === p.id && c.stage === i && c.view === view) {
          setCell(null);
          return;
        }
        setCell({ pid: p.id, stage: i, view });
        opener.current = el;
        // the hint must not fight its own panel
        latest.current.onStageLeave?.();
      },
      onCloseCell: closeCell,
      onPeek: (p, i, el) => latest.current.onStageHover?.(el, p, i),
      onUnpeek: () => latest.current.onStageLeave?.(),
      term: (t, key) => (
        <span
          key={key}
          className="gloss"
          tabIndex={0}
          data-term={t}
          onMouseEnter={(e) => latest.current.onTermHover?.(e.currentTarget, t, glossary[t])}
          onFocus={(e) => latest.current.onTermHover?.(e.currentTarget, t, glossary[t])}
          onMouseLeave={() => latest.current.onTermLeave?.()}
          onBlur={() => latest.current.onTermLeave?.()}
        >
          {t}
        </span>
      ),
    }),
    [rows, glossary, closeCell],
  );

  const placeholderRow = (p: Product): ReactElement => {
    const row = (
      <section key={p.id} className="product future">
        <div className="srow">
          <span></span>
          <div className="nm">
            <b>{p.name}</b>
            <small>{p.inn}</small>
          </div>
          <div className="c-mini">
            <span className="chip soon">{p.classLabel}</span>
          </div>
          <div className="c-bar none" style={{ gridColumn: "4 / -1" }}>
            {p.note}
          </div>
        </div>
      </section>
    );
    return (glossRe ? glossTree(row, glossRe, new Set(), hooks.term) : row) as ReactElement;
  };

  return (
    <div {...statTipHandlers} className={"board" + (boardDisplay.showBarriers ? "" : " nobar")} id="board" ref={boardRef}>
      <div className="srow hd" role="presentation">
        <span></span>
        <span>{text.colMedicine}</span>
        <span className="c-mini">{text.colJourney}</span>
        <span className="c-stage">{text.colStage}</span>
        <span className="c-stat">{text.colStatus}</span>
        <span className="c-path">
          {text.colAccess + " "}
          {accessInfo(s)}
        </span>
        {boardDisplay.showBarriers ? <span className="c-bar">{text.colBarrier}</span> : null}
      </div>
      {tracked.map((p) => (
        <ProductRow
          key={p.id}
          p={p}
          s={s}
          open={!!rows[p.id]?.open}
          openSeq={rows[p.id]?.seq ?? 0}
          highlightCol={highlightCol}
          cell={cell && cell.pid === p.id ? { stage: cell.stage, view: cell.view } : null}
          glossRe={glossRe}
          hooks={hooks}
          reduceMotion={reduceMotion}
        />
      ))}
      {placeholders.map(placeholderRow)}
    </div>
  );
}
