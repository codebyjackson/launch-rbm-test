// GET /api/unitaid/data?dataset=<name>: the data route of RBM's module spec
// (section 2a). The dataset in one language, as JSON, read on the server so a
// visitor's browser never contacts the data host.
//
// A thin wrapper over getDashboard() (lib/data.ts): the same fetch, the same
// checks, and the same 5-minute server-side cache, which the example page
// shares. The page does not call this route; it calls getDashboard() itself
// (no extra network hop, and `next build` has no server running to call).
//
//   200  what getDashboard() returns: the shape the components take
//   400  `dataset` missing, or not one of the dashboard's languages
//   502  the source could not be read, or is in a format this code does not
//        read (DatasetError, kind "unavailable" or "schema")
import { getDashboard } from "@/lib/data";
import { DatasetError } from "@/lib/dataset";
import { isLocale, LOCALES } from "@/lib/locales";

export async function GET(request: Request): Promise<Response> {
  const name = new URL(request.url).searchParams.get("dataset");
  if (name === null || !isLocale(name)) {
    return Response.json(
      { error: name === null ? "dataset is required" : "unknown dataset", datasets: LOCALES },
      { status: 400 },
    );
  }
  try {
    return Response.json(await getDashboard(name));
  } catch (e) {
    if (e instanceof DatasetError) {
      // The reason, with the source's address, goes to the server log only.
      console.error(`[LAUNCH] data route: ${e.kind}: ${e.message}`);
      return Response.json({ error: "source unavailable", kind: e.kind }, { status: 502 });
    }
    throw e;
  }
}
