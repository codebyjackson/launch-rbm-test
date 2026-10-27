// Reads the published LAUNCH dataset on the server. Visitors' browsers never
// contact the data host: the page arrives with the data already in it.
import "server-only";
import { DatasetError, localize, type Localized } from "./dataset";
import type { Locale } from "./locales";

/** The published dataset: one address for every language. */
export const DATA_URL =
  process.env.LAUNCH_DATA_URL || "https://codebyjackson.github.io/launch-data-test/v1/dashboard.json";

/** Seconds between checks for a newer dataset. */
export const REVALIDATE = 600;

/**
 * The dataset in one language.
 *
 * Throws instead of returning a failure, on purpose: when a background
 * refresh throws, Next.js keeps serving the last page it built successfully,
 * so a data host that is briefly down costs nothing. Only a first-ever load
 * with no good copy reaches the error page.
 *
 * @throws DatasetError("unavailable") when the file cannot be fetched or read
 * @throws DatasetError("schema") when its schema_version is not supported
 */
export async function getDashboard(locale: Locale): Promise<Localized> {
  let res: Response;
  try {
    res = await fetch(DATA_URL, { next: { revalidate: REVALIDATE } });
  } catch {
    throw new DatasetError("unavailable", `could not reach ${DATA_URL}`);
  }
  if (!res.ok) throw new DatasetError("unavailable", `HTTP ${res.status} from ${DATA_URL}`);
  let raw: unknown;
  try {
    raw = await res.json();
  } catch {
    throw new DatasetError("unavailable", `${DATA_URL} is not JSON`);
  }
  return localize(raw, locale, DATA_URL);
}
