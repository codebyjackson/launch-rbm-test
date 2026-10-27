// The LAUNCH dataset (dashboard.json, schema 1), and how one language is
// picked out of it. Pure: no fetching, no Next.js, so tests can run it.
//
// localize() is a line-for-line port of loader() in launch-development-test's
// scripts/build-rbm-pages.js, which the static pages run in the browser. It
// returns the four globals those pages read, under camelCase names:
//
//   data            = window.LAUNCH_DATA
//   sources         = window.LAUNCH_SOURCES
//   treatmentPolicy = window.LAUNCH_TREATMENT_POLICY
//   dataset         = window.LAUNCH_DATASET
//
// Keeping the old shape is what lets tests/golden feed the old page logic and
// the new lib/ functions exactly the same input.
import type { Locale } from "./locales";

export const SCHEMA_VERSION = 1;

/** Why the dataset could not be used. */
export type DatasetErrorKind =
  | "unavailable" // not reached, or not JSON: usually passes; keep the last good copy
  | "schema"; // a schema_version this code was not written for

export class DatasetError extends Error {
  readonly kind: DatasetErrorKind;
  constructor(kind: DatasetErrorKind, message: string) {
    super(message);
    this.name = "DatasetError";
    this.kind = kind;
  }
}

/**
 * A stage's or milestone's status. The data keeps "late" even while the page
 * shows it as "prog" (DISPLAY.showLate in lib/stages.ts).
 */
export type Status = "done" | "prog" | "late" | "idle";

export interface StageEntry {
  status: Status;
  note?: string;
  /** Free text for a reader ("2012 (label update 2025)", "Since 2018", "Rolling"). */
  date?: string;
  next?: string;
  nextDate?: string;
  source?: string;
  asOf?: string;
  sources?: string[];
  [key: string]: unknown;
}

export interface Milestone {
  milestone: string;
  status: Status;
  label?: string;
  date?: string;
  next?: string;
  anticipated?: string;
  source?: string;
  sources?: string[];
  [key: string]: unknown;
}

/** One access milestone in detail.journey: a product-level list, not one entry per stage. */
export interface JourneyStep {
  label: string;
  /** a year, or "TBC" for the gate still pending */
  year: number | string;
}

/** One country in detail.countries.list: the furthest access level it has reached. */
export interface CountryEntry {
  iso3: string;
  /**
   * "registered", "guidelines" or "mft" in today's data. Typed as text, not
   * as those three: the page counts only those and passes over any other.
   */
  level: string;
  /** source ids; a national register among them confirms the entry */
  sources?: string[];
  [key: string]: unknown;
}

/** detail.countries: the medicine's country list, the one the map is painted from. */
export interface CountrySurvey {
  /** "verified" in today's data; "illustrative" or another key while it is not */
  status?: string;
  note?: string;
  list?: CountryEntry[];
  [key: string]: unknown;
}

/** detail.country: the summary the Country access card shows when there is no list. */
export interface CountrySummary {
  registered: number | string;
  inGuidelines: number | string;
  inMft: number | string;
  forecastDemand?: string;
  [key: string]: unknown;
}

/**
 * detail.countries as the board reads it: a checked list. The data type is
 * the looser CountrySurvey; the board narrows to this where it needs it.
 */
export interface CountryList {
  /** "verified", "illustrative", or another word shown as it is */
  status: string;
  note?: string;
  list: CountryEntry[];
}

export interface ProcurementChannel {
  channel: string;
  pct: number;
}

export interface ProcurementPresentation {
  label: string;
  transactions: number;
  packs: number;
  /** treatment courses, where the build could work them out */
  courses: number | null;
}

/** detail.volume: procurement through public channels. */
export interface Procurement {
  total: string;
  period: string;
  split: ProcurementChannel[];
  source?: string;
  sources?: string[];
  byPresentation?: ProcurementPresentation[];
  /** how treatment courses were counted */
  coursesRule?: string;
}

export interface Research {
  lead: string;
  geographies: string;
  timeline: string;
  question: string;
}

/** detail.price: in the data, not shown on today's page. */
export interface Price {
  value: string;
  note?: string;
  source?: string;
  confirmedInWriting?: boolean;
  asOf?: string;
}

export interface ProductDetail {
  journey?: JourneyStep[];
  milestones?: Milestone[];
  price?: Price;
  useCase?: string;
  access?: string[];
  /** what adoption needs; the national-policy step's panel lists them */
  adoption?: string[];
  research?: Research;
  countries?: CountrySurvey | null;
  country?: CountrySummary;
  volume?: Procurement | null;
  /** shown in place of procurement figures when there are none */
  volumeNote?: string;
  [key: string]: unknown;
}

export interface Product {
  id: string;
  name: string;
  inn: string;
  manufacturer: string;
  class: string;
  classLabel: string;
  phase: string;
  currentStage: number;
  flag: string | null;
  /** the medicines table's Main barrier text, read before flag */
  barrier?: string;
  /** a card of its own under the product's detail */
  acknowledgement?: string;
  /** a row not yet tracked: drawn with its note, no journey */
  placeholder?: boolean;
  /** a placeholder row's text */
  note?: string;
  stages: StageEntry[];
  detail: ProductDetail;
  [key: string]: unknown;
}

/** Stage indices drawn as one column; [2, 3] is a pair with no order between them. */
export interface StageColumn {
  stages: number[];
}

export interface YardstickStep {
  years: number;
  /** a published timeline, or LAUNCH's working estimate */
  basis: "published" | "estimate";
}

/** The years each stage, and the whole journey, is expected to take. */
export interface Yardstick {
  wholeYears: number;
  /** by stage index; null where a stage has no expected time */
  expected: (YardstickStep | null)[];
}

/** One step explained, as the step panel (#gatewrap) shows it: general to the step, not to a medicine. */
export interface StageInfo {
  what: string;
  who: string;
  stall: string;
  source: string;
}

/** Same shape as window.LAUNCH_DATA on the static pages. */
export interface LaunchData {
  meta: { lastUpdated: string; dataStatus: string; host: unknown };
  stages: string[];
  stageColumns?: StageColumn[];
  /** by stage index; a step without one shows its panel without the explanation */
  stageInfo?: (StageInfo | null)[] | null;
  yardstick?: Yardstick | null;
  glossary: unknown;
  changelog: unknown;
  products: Product[];
}

export interface Source {
  id: string;
  public: true;
  title?: string;
  /** the short name a citation shows */
  label?: string;
  url?: string;
  /** "National register", "Policy / guidelines", …: English on every page */
  category?: string;
  /** "document": a one-off document behind one medicine (Key documents); anything else is a register or feed */
  group?: string;
  /** one sentence on what the source is, in the Sources list */
  plain?: string;
  /** further links shown after `plain`, each followed by a full stop */
  alsoSee?: { label?: string; url?: string }[];
  /** the address a fetcher reads, shown to developers as text, never as a link */
  dataUrl?: string;
  [key: string]: unknown;
}

export interface Localized {
  data: LaunchData;
  sources: { sources: Source[] };
  treatmentPolicy: unknown;
  dataset: { approved_at: string; generated_at: string; url: string };
}

type Obj = { [key: string]: unknown };
const isObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);

/**
 * One language of the dataset. Every reader-facing text in dashboard.json is
 * { en, fr, pt }, one key per language in ds.locales: this keeps `locale`'s,
 * or the English where that is missing or empty. An object with any other key
 * is data, not a text, exactly as on the static pages.
 *
 * @throws DatasetError("schema") when schema_version is not SCHEMA_VERSION.
 */
export function localize(raw: unknown, locale: Locale, url: string): Localized {
  if (!isObj(raw) || raw.schema_version !== SCHEMA_VERSION) {
    const got = isObj(raw) ? String(raw.schema_version) : typeof raw;
    throw new DatasetError("schema", `schema_version ${got} is not ${SCHEMA_VERSION}`);
  }
  const locs: string[] =
    Array.isArray(raw.locales) && raw.locales.includes("en") ? raw.locales : ["en", "fr", "pt"];

  const isText = (v: unknown): v is { [key: string]: string } =>
    isObj(v) && typeof v.en === "string" && Object.keys(v).every((k) => locs.includes(k));

  const pick = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(pick);
    if (isText(v)) return v[locale] || v.en;
    if (isObj(v)) {
      const out: Obj = {};
      for (const k of Object.keys(v)) out[k] = pick(v[k]);
      return out;
    }
    return v;
  };

  const d = pick(raw.data) as Obj;
  return {
    data: {
      meta: {
        lastUpdated: raw.last_updated as string,
        dataStatus: raw.data_status as string,
        host: d.host,
      },
      stages: d.stages as string[],
      stageColumns: d.stageColumns as StageColumn[] | undefined,
      stageInfo: d.stageInfo as LaunchData["stageInfo"],
      yardstick: d.yardstick as Yardstick | null | undefined,
      glossary: d.glossary,
      changelog: d.changelog,
      products: d.products as Product[],
    },
    // everything published is public; the page lists only entries marked so
    sources: { sources: (d.sources as Obj[]).map((s) => ({ ...s, public: true }) as Source) },
    treatmentPolicy: d.treatmentPolicy,
    dataset: {
      approved_at: raw.approved_at as string,
      generated_at: raw.generated_at as string,
      url,
    },
  };
}
