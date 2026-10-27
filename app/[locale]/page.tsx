import { notFound } from "next/navigation";
import { BOARD_TEXT, Board } from "@/components/board";
import { DashboardFrame } from "@/components/frame/DashboardFrame";
import { FRAME_TEXT } from "@/components/frame/text";
import { frameView } from "@/components/frame/view";
import { MapSection } from "@/components/map/MapSection";
import { mapTextEn } from "@/components/map/text";
import { pathwayText } from "@/components/pathway/text";
import { getDashboard } from "@/lib/data";
import { DatasetError, type Localized } from "@/lib/dataset";
import { isLocale } from "@/lib/locales";
import { mapInput } from "@/lib/map";
import { mapCountries } from "@/lib/map-countries";
import { tracked } from "@/lib/pathway";
import { applyShowLate, stageContext } from "@/lib/stages";
import { PathwayPreview } from "./PathwayPreview";

// Re-check the dataset every 10 minutes (lib/data.ts REVALIDATE).
export const revalidate = 600;

// TEMPORARY: the areas side by side, each as its agent left it, until one
// Dashboard component wires them together.
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  let ds: Localized;
  try {
    ds = await getDashboard(locale);
  } catch (e) {
    // A schema the code does not know is not going to pass by itself, so say
    // so, as the static pages do. "unavailable" is thrown on, so Next.js keeps
    // the last good page, or shows error.tsx when there is none.
    if (e instanceof DatasetError && e.kind === "schema") {
      // in its own root: the layout no longer provides one (the frame does)
      return (
        <div className="launch-dashboard">
          <p role="status">This dashboard is being updated. Please check back shortly.</p>
        </div>
      );
    }
    throw e;
  }

  const { data } = ds;
  // ==== PATHWAY AREA (feat/react-port-pathway): example only ====
  const ctx = stageContext(data, locale);
  const listed = tracked(applyShowLate(data.products, ctx.display));
  // ==== end PATHWAY AREA ====

  // ==== FRAME (feat/react-port-frame) ======================================
  // DashboardFrame renders the .launch-dashboard root, the header, the banner,
  // the footer and the feedback form; the other areas go inside it as
  // children, and what sat directly under <body> on the page (#tip,
  // .stat-tip) goes in `outside`. Every value from the data is worked out
  // here, on the server (frameView).
  const frameText = FRAME_TEXT[locale];
  return (
    <DashboardFrame
      text={frameText}
      view={frameView(ds, locale, frameText)}
      formsUrl={process.env.NEXT_PUBLIC_LAUNCH_FORMS_URL}
      logoSrc="/assets/unitaid-logo.svg"
    >
      <main>
        <h1>Malaria Product Launch Dashboard</h1>
        <p>
          Data last updated {data.meta.lastUpdated} ({data.meta.dataStatus})
        </p>
        <ul>
          {data.products.map((p) => (
            <li key={p.id}>
              {p.name}: {data.stages[p.currentStage]}
            </li>
          ))}
        </ul>
      </main>
      {/* ==== PATHWAY AREA (feat/react-port-pathway): example only ==== */}
      <PathwayPreview
        ctx={ctx}
        products={listed}
        stageInfo={data.stageInfo}
        sources={ds.sources.sources}
        text={pathwayText[locale]}
      />
      {/* ==== end PATHWAY AREA ==== */}
      {/* ==== MEDICINE BOARD (feat/react-port-board): example only. No slots or
          callbacks: a server page cannot pass functions to a client
          component, so the stage icons, Country access rows and stage panel
          content are empty and there are no hints, until the Dashboard wires
          the areas together. ==== */}
      <div className="wrap">
        <Board data={data} sources={ds.sources.sources} locale={locale} text={BOARD_TEXT[locale]} />
      </div>
      {/* ==== end MEDICINE BOARD ==== */}
      {/* ==== MAP AREA (feat/react-port-map): example only. English text in
          every language until the message files are wired; the data is the
          page's language. ==== */}
      <MapSection
        input={mapInput(ds, mapCountries(locale), locale)}
        text={mapTextEn}
        shapesUrl="/launch-map/world-shapes.json"
        workerUrl="/launch-map/maplibre-gl-worker.mjs"
      />
      {/* ==== end MAP AREA ==== */}
    </DashboardFrame>
  );
}
