import { notFound } from "next/navigation";
import type { DashboardAssets } from "@/components/Dashboard";
import { Banner } from "@/components/frame/Banner";
import { frameText } from "@/components/frame/text";
import { frameView } from "@/components/frame/view";
import { getDashboard } from "@/lib/data";
import { DatasetError, type Localized } from "@/lib/dataset";
import { isLocale } from "@/lib/locales";
import { mapInput } from "@/lib/map";
import { mapCountries } from "@/lib/map-countries";
import { ExampleDashboard } from "./ExampleDashboard";

// Re-check the dataset every 10 minutes (lib/data.ts REVALIDATE).
export const revalidate = 600;

// Where this example app serves the dashboard's files, from public/. RBM
// serves them where it likes and passes its own addresses.
const ASSETS: DashboardAssets = {
  logo: "/assets/unitaid-logo.svg",
  whoEmblem: "/launch-icons/who-emblem.svg",
  mapShapes: "/launch-map/world-shapes.json",
  mapWorker: "/launch-map/maplibre-gl-worker.mjs",
};

// The example app's page: the server loads the dataset and works out what the
// frame and the map show from it; the Dashboard (a client component) does the
// rest. RBM's page does the same with its own route and router.
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  let ds: Localized;
  try {
    ds = await getDashboard(locale);
  } catch (e) {
    // A schema the code does not know is not going to pass by itself, so say
    // so, as the static pages do, in the page's language. "unavailable" is
    // thrown on, so Next.js keeps the last good page, or shows error.tsx when
    // there is none.
    if (e instanceof DatasetError && e.kind === "schema") {
      return (
        // in its own root: there is no data for the frame to draw
        <div className="launch-dashboard">
          <div className="wrap" role="status">
            <Banner kind="schema" text={frameText(locale).banner} />
          </div>
        </div>
      );
    }
    throw e;
  }

  return (
    <ExampleDashboard
      locale={locale}
      data={ds.data}
      sources={ds.sources.sources}
      frameView={frameView(ds, locale, frameText(locale))}
      mapInput={mapInput(ds, mapCountries(locale), locale)}
      formsUrl={process.env.NEXT_PUBLIC_LAUNCH_FORMS_URL}
      assets={ASSETS}
    />
  );
}
