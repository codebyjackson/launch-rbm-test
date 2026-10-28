"use client";

// The whole dashboard, as RBM drops it into a page: the frame (header,
// banner, footer, the two forms), the pathway strip and its step panel, the
// medicine board and the map, in today's order, wired together as the static
// page's one script wired them.
//
// It takes only what a server component can pass (data, finished views,
// addresses), and works out its words from the locale (the message files,
// through each area's adapter). Who holds what:
//
//   openStep   here: the strip opens a step, the board lights its column
//   open cell  the board; it reports it (onCellChange) so Escape closes a
//              medicine's stage panel before the strip's step panel
//   product    the host's router: initialProduct asks for a medicine to be
//              opened, onProductChange reports one the reader opened
//   hints      one #tip (stage markers, glossary terms, the map's countries)
//              and one .stat-tip (the board's i buttons), placed by the
//              pathway area's Tip and StatTip inside the root, after .wrap
//
// docs/react-port-notes.md decisions 42 to 51 give the reasons.
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { Board, boardText, type OpenCell } from "@/components/board";
import { boardSlots } from "@/components/boardSlots";
import { DashboardFrame } from "@/components/frame/DashboardFrame";
import { frameText } from "@/components/frame/text";
import type { FrameView } from "@/components/frame/view";
import { MapSection } from "@/components/map/MapSection";
import { mapText } from "@/components/map/text";
import {
  JourneyIconSprite,
  Pathway,
  StagePeek,
  StatTip,
  Tip,
  pathwayText,
  statTipHandlers,
  useStatTipControls,
  useTipControls,
} from "@/components/pathway";
import type { LaunchData, Product, Source } from "@/lib/dataset";
import type { Locale } from "@/lib/locales";
import type { MapInput } from "@/lib/map";
import { tracked } from "@/lib/pathway";
import { applyShowLate, stageContext } from "@/lib/stages";

/** Where the host serves the dashboard's files (the example app: public/). */
export interface DashboardAssets {
  /** assets/unitaid-logo.svg */
  logo: string;
  /** the WHO emblem; WHO_EMBLEM_SRC when left out */
  whoEmblem?: string;
  /** launch-map/world-shapes.json */
  mapShapes: string;
  /** launch-map/maplibre-gl-worker.mjs (maplibre-gl 6.x; served as JavaScript) */
  mapWorker: string;
}

export interface DashboardProps {
  locale: Locale;
  /** one language of the dataset: localize().data (lib/data.ts getDashboard) */
  data: LaunchData;
  /** localize().sources.sources */
  sources: Source[];
  /** frameView(dataset, locale, frameText(locale)), worked out on the server */
  frameView: FrameView;
  /** mapInput(dataset, mapCountries(locale), locale), worked out on the server */
  mapInput: MapInput;
  /** NEXT_PUBLIC_LAUNCH_FORMS_URL; empty or missing: Subscribe hidden, Send feedback not connected */
  formsUrl?: string;
  assets: DashboardAssets;
  /**
   * A medicine to open and scroll to, as a link such as #pyramax did: on
   * load, and again each time it changes to another tracked medicine's id
   * (a link followed, back and forward). Anything else is ignored.
   */
  initialProduct?: string | null;
  /**
   * The reader opened a medicine's row. A router that carries it in the
   * address should pass the same id back as initialProduct: the board takes
   * that as this report's echo and does not jump to the row.
   */
  onProductChange?: (id: string) => void;
}

export function Dashboard({
  locale,
  data,
  sources,
  frameView,
  mapInput,
  formsUrl,
  assets,
  initialProduct,
  onProductChange,
}: DashboardProps) {
  // Each adapter builds its text once per language and returns the same
  // object after that, so these never change while the page is open.
  const ptext = pathwayText(locale);
  const ftext = frameText(locale);
  const btext = boardText(locale);
  const mtext = mapText(locale);

  const ctx = useMemo(() => stageContext(data, locale), [data, locale]);
  // the medicines as the page lists them, "late" shown as in progress (SHOW_LATE)
  const listed = useMemo(() => tracked(applyShowLate(data.products, ctx.display)), [data.products, ctx.display]);

  const [openStep, setOpenStep] = useState<number | null>(null);
  const [cell, setCell] = useState<OpenCell | null>(null);

  const [tipRef, tip] = useTipControls();
  const [statRef, statTip] = useStatTipControls();
  const statHandlers = useMemo(() => statTipHandlers(statTip), [statTip]);

  const onStageHover = useCallback(
    (el: HTMLElement, p: Product, i: number) => tip.showAt(el, <StagePeek product={p} stage={i} ctx={ctx} text={ptext} />),
    [tip, ctx, ptext],
  );
  // a glossary term: the term in bold, then its definition (the page's showTipAt)
  const onTermHover = useCallback(
    (el: HTMLElement, term: string, definition: string) =>
      tip.showAt(
        el,
        <>
          <b>{term}</b>
          {definition}
        </>,
      ),
    [tip],
  );

  // Made once per language and data: the board rebuilds every row when they change.
  const slots = useMemo(
    () => boardSlots({ ctx, sources, text: ptext, whoEmblemSrc: assets.whoEmblem }),
    [ctx, sources, ptext, assets.whoEmblem],
  );

  // what sat directly under <body> on the page; inside the root here, after .wrap
  const outside: ReactNode = (
    <>
      <Tip ref={tipRef} />
      <StatTip ref={statRef} />
      <JourneyIconSprite />
    </>
  );

  return (
    <DashboardFrame text={ftext} view={frameView} formsUrl={formsUrl} logoSrc={assets.logo} outside={outside}>
      <Pathway
        ctx={ctx}
        products={listed}
        stageInfo={data.stageInfo}
        text={ptext}
        openStep={openStep}
        onOpenStep={setOpenStep}
        cellPanelOpen={cell != null}
        whoEmblemSrc={assets.whoEmblem}
      />
      <Board
        data={data}
        sources={sources}
        locale={locale}
        text={btext}
        openProduct={initialProduct}
        onOpenProduct={onProductChange}
        openStep={openStep}
        onStageHover={onStageHover}
        onStageLeave={tip.hide}
        onTermHover={onTermHover}
        onTermLeave={tip.hide}
        statTipHandlers={statHandlers}
        onCellChange={setCell}
        {...slots}
      />
      <MapSection input={mapInput} text={mtext} shapesUrl={assets.mapShapes} workerUrl={assets.mapWorker} tip={tip} />
    </DashboardFrame>
  );
}
