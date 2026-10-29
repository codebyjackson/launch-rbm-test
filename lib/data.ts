// Reads the published LAUNCH dataset on the server. Visitors' browsers never
// contact the data host: the page arrives with the data already in it.
import "server-only";
import { DatasetError, datasetFrom, type Localized } from "./dataset";
import type { Locale } from "./locales";

/**
 * The published dataset, one file per language (since 28 Oct 2026):
 * {locale} becomes en, fr or pt. LAUNCH_DATA_URL may name another address in
 * the same form, or a combined dashboard.json without {locale} (a local test
 * server): lib/dataset.ts datasetFrom() reads either. The data repository has
 * moved (found 29 Oct 2026): it was codebyjackson/launch-data-test, whose
 * GitHub Pages address now answers 404, with no redirect.
 */
export const DATA_URL =
  process.env.LAUNCH_DATA_URL ||
  "https://quantum-sage-technologies.github.io/unitaid-launch-data/v1/dashboard.{locale}.json";

/** The address of one language's file. */
export const dataUrl = (locale: Locale): string => DATA_URL.replace("{locale}", locale);

/**
 * Seconds a fetched file is kept fresh in Next.js's server-side cache: 5
 * minutes, the default in RBM's module spec (2a). After that, the next request
 * still gets the cached copy while Next.js fetches a new one behind it. The page (app/[locale]/page.tsx) and the data route
 * (app/api/unitaid/data/route.ts) share the cached copy. The page's own
 * `revalidate` must be the same number written out: Next.js reads it from the
 * source, so it cannot refer to this one.
 */
export const REVALIDATE = 300;

/**
 * The dataset in one language.
 *
 * Throws instead of returning a failure, on purpose: when a background
 * refresh throws, Next.js keeps serving the last page it built successfully,
 * so a data host that is briefly down costs nothing. Only a first-ever load
 * with no good copy reaches the error page.
 *
 * @throws DatasetError("unavailable") when the file cannot be fetched or read
 * @throws DatasetError("schema") when its schema_version is not supported, or
 * it is in another language
 */
export async function getDashboard(locale: Locale): Promise<Localized> {
  const url = dataUrl(locale);
  let res: Response;
  try {
    res = await fetch(url, { next: { revalidate: REVALIDATE } });
  } catch {
    throw new DatasetError("unavailable", `could not reach ${url}`);
  }
  if (!res.ok) throw new DatasetError("unavailable", `HTTP ${res.status} from ${url}`);
  let raw: unknown;
  try {
    raw = await res.json();
  } catch {
    throw new DatasetError("unavailable", `${url} is not JSON`);
  }
  return datasetFrom(raw, locale, url);
}
