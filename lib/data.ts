// Reads the published LAUNCH dataset on the server. Visitors' browsers never
// contact the data host: the page arrives with the data already in it.
import "server-only";
import { DatasetError, datasetFrom, type Localized } from "./dataset";
import type { Locale } from "./locales";

/**
 * The published dataset, one file per language (since 28 Oct 2026):
 * {locale} becomes en, fr or pt. LAUNCH_DATA_URL may name another address in
 * the same form, or a combined dashboard.json without {locale} (a local test
 * server): lib/dataset.ts datasetFrom() reads either.
 */
export const DATA_URL =
  process.env.LAUNCH_DATA_URL || "https://codebyjackson.github.io/launch-data-test/v1/dashboard.{locale}.json";

/** The address of one language's file. */
export const dataUrl = (locale: Locale): string => DATA_URL.replace("{locale}", locale);

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
