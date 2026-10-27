// Everything the frame shows that comes from the data, worked out once on the
// server. The client components get finished strings and lists, never the
// raw dataset: dates and sorting depend on the ICU data of whoever runs them,
// and the server and the browser must produce the same markup or hydration
// fails. It also keeps the whole dataset out of the browser just for the CSV.
import type { Localized } from "@/lib/dataset";
import {
  countryCheckText,
  csvFileName,
  csvRows,
  csvText,
  feedbackProducts,
  glossaryEntries,
  lastUpdatedText,
  sourceLists,
  statusBanner,
  type FeedbackOption,
  type SourceLists,
} from "@/lib/frame";
import type { Locale } from "@/lib/locales";
import { DISPLAY, type Display } from "@/lib/stages";
import type { FrameText } from "./text";

export interface FrameView {
  /** "Last updated 19 Oct 2026" */
  updated: string;
  /** the banner the data's status asks for, if any */
  banner: "illustrative" | null;
  /** the CSV download, without its byte-order mark (added at download) */
  csv: { text: string; fileName: string };
  sources: SourceLists;
  /** the disclaimer's sentence on verified country data; "" names none */
  countryChecks: string;
  glossary: [term: string, definition: string][];
  feedback: { products: FeedbackOption[]; lastUpdated: string | null; dataStatus: string | null };
}

export function frameView(ds: Localized, locale: Locale, text: FrameText, display: Display = DISPLAY): FrameView {
  const { data } = ds;
  return {
    updated: lastUpdatedText(data.meta.lastUpdated, locale, text.header.lastUpdated),
    banner: statusBanner(data.meta.dataStatus),
    csv: {
      text: csvText(csvRows(data.products, data.stages, locale, text.csv, display)),
      fileName: csvFileName(data.meta.lastUpdated),
    },
    sources: sourceLists(ds.sources.sources, locale),
    countryChecks: countryCheckText(data.products, text.footer),
    glossary: glossaryEntries(data.glossary),
    feedback: {
      products: feedbackProducts(data.products, text.feedback.planned),
      lastUpdated: data.meta.lastUpdated || null,
      dataStatus: data.meta.dataStatus || null,
    },
  };
}
