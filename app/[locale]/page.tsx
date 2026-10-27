import { notFound } from "next/navigation";
import { pathwayText } from "@/components/pathway/text";
import { getDashboard } from "@/lib/data";
import { DatasetError, type Localized } from "@/lib/dataset";
import { isLocale } from "@/lib/locales";
import { tracked } from "@/lib/pathway";
import { applyShowLate, stageContext } from "@/lib/stages";
import { PathwayPreview } from "./PathwayPreview";

// Re-check the dataset every 10 minutes (lib/data.ts REVALIDATE).
export const revalidate = 600;

// TEMPORARY: proves the data reaches the page in each language. The
// components (step 3 of the port) replace this list.
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
      return <p role="status">This dashboard is being updated. Please check back shortly.</p>;
    }
    throw e;
  }

  const { data } = ds;
  // ==== PATHWAY AREA (feat/react-port-pathway): example only, until the ====
  // ==== Dashboard component wires the areas together.                  ====
  const ctx = stageContext(data, locale);
  const listed = tracked(applyShowLate(data.products, ctx.display));
  // ==== end PATHWAY AREA ====
  return (
    <>
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
    </>
  );
}
