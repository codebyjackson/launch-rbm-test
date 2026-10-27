import { notFound } from "next/navigation";
import { BOARD_TEXT, Board } from "@/components/board";
import { getDashboard } from "@/lib/data";
import { DatasetError, type Localized } from "@/lib/dataset";
import { isLocale } from "@/lib/locales";

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
  return (
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

      {/* ---- MEDICINE BOARD (components/board/), branch feat/react-port-board ----
          Shown here so `npm run dev` shows it. No callbacks or slots: a
          server page cannot pass functions to a client component. So the
          stage icons, the Country access rows and the stage panels' content
          (the pathway area's, through the board's render* slots) are empty,
          citations are plain names, and there are no hints, until the
          Dashboard wires the areas together. */}
      <div className="wrap">
        <Board data={data} sources={ds.sources.sources} locale={locale} text={BOARD_TEXT[locale]} />
      </div>
      {/* ---- end MEDICINE BOARD ---- */}
    </main>
  );
}
