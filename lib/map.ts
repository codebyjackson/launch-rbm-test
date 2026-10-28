// The country access map: everything its section of the dashboard computes
// without the DOM or MapLibre. Pure: the dataset, the basemap's names and the
// reader's choices all come in as parameters, so tests/golden-map.test.ts can
// run this and the static pages' own code on exactly the same input.
//
// A port of the `if (window.LAUNCH_MAP && ...)` block of the static pages'
// app script (launch-rbm-test 7c1bf11). Each function names the one it
// replaces ("old: mftScope"). Where the old code wrote HTML, the function here
// returns the same content as data, and components/map/ renders it. No words
// are chosen here, only keys (a stage, a group, a region) that the components
// look up in MapText, so one copy of the logic serves every language.
//
// Old behaviour is kept even where it looks wrong; docs/react-port-notes.md
// lists those places.
import type { Localized } from "./dataset";
import type { Locale } from "./locales";
import { tracked } from "./pathway";

// ---- the fixed vocabulary ----------------------------------------------------

/** The access stages a country can reach, lowest first (old: LEVEL_ORDER, STAGE_KEYS). */
export const LEVELS = ["registered", "guidelines", "mft"] as const;
export type Level = (typeof LEVELS)[number];

/** The access-stage rows of the filters and legends (old: STAGE_ROWS). */
export const STAGE_ROWS = ["registered", "guidelines", "mft", "none"] as const;
export type StageKey = (typeof STAGE_ROWS)[number];

/**
 * A country's stage as the data gives it: one of STAGE_ROWS for valid data.
 * Kept a string because the old code passed an unknown level through (as a
 * class name, with the "No data" label) rather than dropping it.
 */
export type Stage = StageKey | (string & {});

/** Country recommended use: the two policy groups drawn as borders (old: MFT_GROUPS). */
export const GROUPS = ["tested", "vivax"] as const;
export type GroupId = (typeof GROUPS)[number];

/** WHO's six regions, in the Region picker's order (old: REGION_NAME's keys). */
export const REGIONS = ["AFRO", "AMRO", "EMRO", "EURO", "SEARO", "WPRO"] as const;
export type Region = (typeof REGIONS)[number];

export type DetailTab = "overview" | "countries";

// WHO's own six-region classification: a fixed, public WHO scheme, not data
// from a tracked source. Covers every WHO member state the basemap has a shape
// for. Dependent territories and disputed areas (Puerto Rico, Hong Kong,
// Western Sahara, Taiwan, Antarctica, ...) are left out on purpose: they have
// no WHO region, so they are drawn but never listed under one. (old: WHO_REGION)
export const WHO_REGION: Readonly<Record<string, Region>> = {
  AFG: "EMRO", AGO: "AFRO", ALB: "EURO", AND: "EURO", ARE: "EMRO", ARG: "AMRO",
  ARM: "EURO", ATG: "AMRO", AUS: "WPRO", AUT: "EURO", AZE: "EURO", BDI: "AFRO",
  BEL: "EURO", BEN: "AFRO", BFA: "AFRO", BGD: "SEARO", BGR: "EURO", BHR: "EMRO",
  BHS: "AMRO", BIH: "EURO", BLR: "EURO", BLZ: "AMRO", BOL: "AMRO", BRA: "AMRO",
  BRB: "AMRO", BRN: "WPRO", BTN: "SEARO", BWA: "AFRO", CAF: "AFRO", CAN: "AMRO",
  CHE: "EURO", CHL: "AMRO", CHN: "WPRO", CIV: "AFRO", CMR: "AFRO", COD: "AFRO",
  COG: "AFRO", COK: "WPRO", COL: "AMRO", COM: "AFRO", CPV: "AFRO", CRI: "AMRO",
  CUB: "AMRO", CYP: "EURO", CZE: "EURO", DEU: "EURO", DJI: "EMRO", DMA: "AMRO",
  DNK: "EURO", DOM: "AMRO", DZA: "AFRO", ECU: "AMRO", EGY: "EMRO", ERI: "AFRO",
  ESP: "EURO", EST: "EURO", ETH: "AFRO", FIN: "EURO", FJI: "WPRO", FRA: "EURO",
  FSM: "WPRO", GAB: "AFRO", GBR: "EURO", GEO: "EURO", GHA: "AFRO", GIN: "AFRO",
  GMB: "AFRO", GNB: "AFRO", GNQ: "AFRO", GRC: "EURO", GRD: "AMRO", GTM: "AMRO",
  GUY: "AMRO", HND: "AMRO", HRV: "EURO", HTI: "AMRO", HUN: "EURO", IDN: "SEARO",
  IND: "SEARO", IRL: "EURO", IRN: "EMRO", IRQ: "EMRO", ISL: "EURO", ISR: "EURO",
  ITA: "EURO", JAM: "AMRO", JOR: "EMRO", JPN: "WPRO", KAZ: "EURO", KEN: "AFRO",
  KGZ: "EURO", KHM: "WPRO", KIR: "WPRO", KNA: "AMRO", KOR: "WPRO", KWT: "EMRO",
  LAO: "WPRO", LBN: "EMRO", LBR: "AFRO", LBY: "EMRO", LCA: "AMRO", LIE: "EURO",
  LKA: "SEARO", LSO: "AFRO", LTU: "EURO", LUX: "EURO", LVA: "EURO", MAR: "EMRO",
  MCO: "EURO", MDA: "EURO", MDG: "AFRO", MDV: "SEARO", MEX: "AMRO", MHL: "WPRO",
  MKD: "EURO", MLI: "AFRO", MLT: "EURO", MMR: "SEARO", MNE: "EURO", MNG: "WPRO",
  MOZ: "AFRO", MRT: "AFRO", MUS: "AFRO", MWI: "AFRO", MYS: "WPRO", NAM: "AFRO",
  NER: "AFRO", NGA: "AFRO", NIC: "AMRO", NIU: "WPRO", NLD: "EURO", NOR: "EURO",
  NPL: "SEARO", NRU: "WPRO", NZL: "WPRO", OMN: "EMRO", PAK: "EMRO", PAN: "AMRO",
  PER: "AMRO", PHL: "WPRO", PLW: "WPRO", PNG: "WPRO", POL: "EURO", PRK: "SEARO",
  PRT: "EURO", PRY: "AMRO", PSE: "EMRO", QAT: "EMRO", ROU: "EURO", RUS: "EURO",
  RWA: "AFRO", SAU: "EMRO", SDN: "EMRO", SEN: "AFRO", SGP: "WPRO", SLB: "WPRO",
  SLE: "AFRO", SLV: "AMRO", SMR: "EURO", SOM: "EMRO", SRB: "EURO", SSD: "AFRO",
  STP: "AFRO", SUR: "AMRO", SVK: "EURO", SVN: "EURO", SWE: "EURO", SWZ: "AFRO",
  SYC: "AFRO", SYR: "EMRO", TCD: "AFRO", TGO: "AFRO", THA: "SEARO", TJK: "EURO",
  TKM: "EURO", TLS: "SEARO", TON: "WPRO", TTO: "AMRO", TUN: "EMRO", TUR: "EURO",
  TZA: "AFRO", UGA: "AFRO", UKR: "EURO", URY: "AMRO", USA: "AMRO", UZB: "EURO",
  VCT: "AMRO", VEN: "AMRO", VNM: "WPRO", VUT: "WPRO", WSM: "WPRO", YEM: "EMRO",
  ZAF: "AFRO", ZMB: "AFRO", ZWE: "AFRO",
};

// The window the map opens on, and returns to for "All regions": the same
// one build-map-geo.js fits the shapes to (old: LON0, LON1, LAT0, LAT1).
export const LON0 = -120, LON1 = 155, LAT0 = -40, LAT1 = 42;
// A LINEAR magnification cap ("64x"). MapLibre's zoom is log2, so the map
// option is log2(ZMAX); passing 64 itself would cap at 2^64 (DEV-13 D26).
export const ZMAX = 64;
export const MAX_ZOOM = Math.log2(ZMAX);

// The 10 Nov 2026 release hides product barrier text everywhere (owner,
// 20 Oct 2026); the static page's SHOW_BARRIERS. true brings the barrier back
// under the medicine facts.
export const SHOW_BARRIERS = false;

// ---- input -------------------------------------------------------------------

/** One entry of a medicine's detail.countries.list in dashboard.json. */
export interface CountryEntry {
  iso3: string;
  level: Stage;
  sources?: string[];
  checked?: string;
}

/** A medicine as the map reads it: a small projection of the dataset's Product. */
export interface MapProduct {
  id: string;
  name: string;
  inn: string;
  class: string;
  currentStage: number;
  flag: string | null;
  /** detail.countries, or null when the medicine has none (pre-launch) */
  countries: { status?: string; list: CountryEntry[] } | null;
  /** detail.volume.total, or null */
  volume: string | null;
}

/** WHO World Malaria Report, Annex 4B, as dashboard.json carries it (old: LAUNCH_TREATMENT_POLICY). */
export interface TreatmentPolicy {
  meta?: { edition?: string; policyYear?: string | number };
  countries: Record<
    string,
    {
      name?: string;
      /** product id → the patient groups its national policy lists it for */
      products?: Record<string, string[]>;
      /** parts of the country with a policy of their own (Zanzibar) */
      parts?: Record<string, { products?: Record<string, string[]> }>;
    }
  >;
}

/** A source a country's stage cites: its name in the Sources list and its link. */
export interface MapSource {
  id: string;
  label: string;
  url: string | null;
}

/** One shape on the basemap. A country can have more than one (AUS has two). */
export interface ShapeName {
  iso3: string;
  name: string;
}

/** The basemap's countries in one language (lib/map-countries.ts). */
export interface MapCountries {
  /** Every shape, in the shapes file's order (old: LAUNCH_MAP_GEO's features). */
  shapes: ShapeName[];
  /** The countries the access map tracks, in order (old: LAUNCH_MAP.countries). */
  drawn: ShapeName[];
}

/** Everything the map section needs, as plain data a server can hand to the browser. */
export interface MapInput {
  /** The medicines the map has tabs for, in tab order (old: tracked). */
  products: MapProduct[];
  /** Stage names, by index (old: STAGES). */
  stages: string[];
  policy: TreatmentPolicy | null;
  sources: MapSource[];
  countries: MapCountries;
  /** The language dates are written in (old: DATE_LANG). */
  dateLocale: string;
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown): string => (v == null ? "" : String(v)); // the old esc()'s String(), without the escaping

// The static pages derive this from <html lang>: en, fr, pt-PT. English
// dates are en-GB ("2 Oct 2026").
// TODO: use lib/format.ts
export const DATE_LOCALE: Record<Locale, string> = { en: "en-GB", fr: "fr", pt: "pt-PT" };

/**
 * Picks out of one language of the dataset what the map reads. Small on
 * purpose: this crosses from the server to the browser.
 */
export function mapInput(ds: Localized, countries: MapCountries, locale: Locale): MapInput {
  // the medicines the dashboard tracks, in its order (old: tracked)
  const products = tracked(ds.data.products).map((p): MapProduct => {
    const detail = isObj(p.detail) ? p.detail : {};
    const c = detail.countries as { status?: string; list: Record<string, unknown>[] } | undefined;
    const vol = isObj(detail.volume) ? detail.volume.total : null;
    return {
      id: p.id,
      name: p.name,
      inn: str(p.inn || ""),
      class: p.class,
      currentStage: p.currentStage,
      flag: p.flag ? String(p.flag) : null,
      // truthiness, as the old `p.detail.countries ? ... : ...`; each entry
      // keeps only what the map reads (not its note or MFT detail)
      countries: c
        ? {
            ...(c.status !== undefined && { status: c.status }),
            list: c.list.map((e) => ({
              iso3: e.iso3 as string,
              level: e.level as Stage,
              ...(Array.isArray(e.sources) && { sources: e.sources as string[] }),
              ...(typeof e.checked === "string" && { checked: e.checked }),
            })),
          }
        : null,
      volume: vol ? String(vol) : null,
    };
  });
  let policy: TreatmentPolicy | null = null;
  const tp = ds.treatmentPolicy;
  if (isObj(tp) && isObj(tp.countries)) {
    const meta = isObj(tp.meta) ? tp.meta : {};
    const out: TreatmentPolicy["countries"] = {};
    for (const [iso3, c] of Object.entries(tp.countries)) {
      if (!isObj(c)) continue;
      const { name, products: prods, parts } = c as TreatmentPolicy["countries"][string];
      // absent keys stay absent: this crosses to the browser
      out[iso3] = { ...(name !== undefined && { name }), ...(prods !== undefined && { products: prods }), ...(parts !== undefined && { parts }) };
    }
    policy = {
      meta: { edition: meta.edition as string | undefined, policyYear: meta.policyYear as string | number | undefined },
      countries: out,
    };
  }
  return {
    products,
    stages: ds.data.stages,
    policy,
    // the old page shows `s.label || s.title`, linked when `s.url` is set
    sources: ds.sources.sources.map((s) => ({
      id: s.id,
      label: str(s.label || s.title),
      url: s.url ? String(s.url) : null,
    })),
    countries,
    dateLocale: DATE_LOCALE[locale],
  };
}

/** MapInput with the lookups every function below needs, built once. */
export interface MapContext {
  readonly products: readonly MapProduct[];
  readonly stages: readonly string[];
  readonly policy: TreatmentPolicy | null;
  readonly dateLocale: string;
  readonly shapes: readonly ShapeName[];
  /** The tracked countries' iso3, in order (old: Object.keys(M.countries)). */
  readonly drawn: readonly string[];
  /** old: M.countries[iso3].n */
  readonly drawnName: ReadonlyMap<string, string>;
  /** iso3 → name, the last shape with that iso3 naming it (old: GEO_COUNTRY_NAME). */
  readonly shapeName: ReadonlyMap<string, string>;
  readonly sources: ReadonlyMap<string, MapSource>;
  /** Each medicine's countries, iso3 → stage, the last entry winning (old: byIso, mftByIso). */
  readonly levels: ReadonlyMap<string, Readonly<Record<string, Stage>>>;
}

export function mapContext(input: MapInput): MapContext {
  const shapeName = new Map<string, string>();
  for (const s of input.countries.shapes) shapeName.set(s.iso3, s.name);
  const levels = new Map<string, Record<string, Stage>>();
  for (const p of input.products) {
    const byIso: Record<string, Stage> = {};
    (p.countries ? p.countries.list : []).forEach((e) => { byIso[e.iso3] = e.level; });
    levels.set(p.id, byIso);
  }
  return {
    products: input.products,
    stages: input.stages,
    policy: input.policy,
    dateLocale: input.dateLocale,
    shapes: input.countries.shapes,
    drawn: input.countries.drawn.map((c) => c.iso3),
    drawnName: new Map(input.countries.drawn.map((c) => [c.iso3, c.name])),
    shapeName,
    sources: new Map(input.sources.map((s) => [s.id, s])),
    levels,
  };
}

// ---- the reader's choices ------------------------------------------------------

/** What the reader has chosen. Everything on the map section follows from this. */
export interface MapState {
  /** The medicine shown (old: mftProductId). */
  productId: string;
  /** Location filter: a WHO region, or "" for all (old: locRegion). */
  region: Region | "";
  /** Location filter: an iso3, or "" for all (old: locCountry). */
  country: string;
  /** The country whose page the Detail rail shows (old: mftSel). */
  selected: string | null;
  /** Access stages unticked in Filters (old: stageOff). */
  stageOff: readonly StageKey[];
  /** Recommended-use groups ticked in Filters (old: mftTick). */
  ticked: readonly GroupId[];
  /** The Detail rail's tab (old: detTab). */
  tab: DetailTab;
  /** The tab a country page was opened from, for its Back button (old: cameFrom). */
  cameFrom: DetailTab;
}

/**
 * The map as it opens: the first medicine with country data (old: the map's
 * load handler), every filter on, both groups ticked, no location.
 */
export function initialState(ctx: MapContext): MapState {
  const p = ctx.products.find((x) => x.countries) || ctx.products[0];
  return {
    productId: p ? p.id : "",
    region: "",
    country: "",
    selected: null,
    stageOff: [],
    ticked: [...GROUPS],
    tab: "overview",
    cameFrom: "overview",
  };
}

const without = <T,>(list: readonly T[], x: T): T[] => list.filter((y) => y !== x);
const withOne = <T,>(list: readonly T[], x: T): T[] => (list.includes(x) ? [...list] : [...list, x]);

/** A medicine tab (old: selectMap). The open country page, if any, stays open. */
export function selectProduct(st: MapState, id: string): MapState {
  return { ...st, productId: id };
}

// old: the end of applyLocationFilter: a country page outside the new
// location closes
function closeOutOfScope(ctx: MapContext, st: MapState): MapState {
  return st.selected && !scope(ctx, st).includes(st.selected) ? { ...st, selected: null } : st;
}

/** The Region picker (old: its change handler). Clears the country. */
export function setRegion(ctx: MapContext, st: MapState, region: Region | ""): MapState {
  return closeOutOfScope(ctx, { ...st, region, country: "" });
}

/**
 * The Country picker (old: its change handler). Picking a country while its
 * region is not chosen moves the Region picker to it, so the two never
 * disagree.
 */
export function setCountry(ctx: MapContext, st: MapState, country: string): MapState {
  let next: MapState = { ...st, country };
  const r = country ? WHO_REGION[country] : undefined;
  if (r && r !== st.region) {
    next = { ...next, region: r };
    // old: fillCountryList(), which drops a country the region does not list
    if (!countryOptions(ctx, r).some((c) => c.iso3 === next.country)) next = { ...next, country: "" };
  }
  return closeOutOfScope(ctx, next);
}

/** An access-stage checkbox in Filters. */
export function setStage(st: MapState, key: StageKey, on: boolean): MapState {
  return { ...st, stageOff: on ? without(st.stageOff, key) : withOne(st.stageOff, key) };
}

/** A recommended-use checkbox in Filters. */
export function setGroup(st: MapState, id: GroupId, on: boolean): MapState {
  return { ...st, ticked: on ? withOne(st.ticked, id) : without(st.ticked, id) };
}

/** The "Show on map" box: everything on, or everything off. */
export function setAll(ctx: MapContext, st: MapState, on: boolean): MapState {
  if (on) {
    const av = availableGroups(ctx, st.productId);
    let ticked = [...st.ticked];
    for (const g of GROUPS) if (av[g]) ticked = withOne(ticked, g);
    return { ...st, stageOff: [], ticked };
  }
  return { ...st, stageOff: [...STAGE_ROWS], ticked: [] };
}

/** Filters' Reset, and the "Reset filters" button in an empty country list. Also closes a country page. */
export function resetFilters(st: MapState): MapState {
  return { ...st, stageOff: [], ticked: [...GROUPS], selected: null };
}

/** A Detail tab. Closes a country page opened from the map or a list. */
export function openTab(st: MapState, tab: DetailTab): MapState {
  return { ...st, tab, selected: null };
}

/** Opens a country's page: a map click, a list row or chip (old: selectCountry). */
export function selectCountry(st: MapState, iso3: string): MapState {
  return { ...st, cameFrom: st.tab, selected: iso3 };
}

/** A country page's Back button. */
export function closeCountry(st: MapState): MapState {
  return { ...st, selected: null };
}

/**
 * A country page's Previous / Next: through the countries the filters list
 * when this one is among them, else through every tracked country. Wraps.
 *
 * Kept from the old code: a page opened by the Location filter on a country
 * the map does not track (France, say) is not in either list, so Next goes
 * to the first country and Previous to the second-to-last, not the last.
 */
export function stepCountry(ctx: MapContext, st: MapState, dir: 1 | -1): MapState {
  const cur = st.selected || st.country;
  const all = drawnIsos(ctx);
  const pool = all.filter((i) => matches(ctx, st, i));
  const ids = pool.includes(cur) ? pool : all;
  return { ...st, selected: ids[(ids.indexOf(cur) + dir + ids.length) % ids.length] };
}

// ---- countries, stages, policy ---------------------------------------------------

/** old: curProduct */
export const productOf = (ctx: MapContext, id: string): MapProduct | undefined => ctx.products.find((p) => p.id === id);

/** Has this medicine any country-level data? (old: hasCountries) */
export function hasCountries(ctx: MapContext, id: string): boolean {
  const p = productOf(ctx, id);
  return !!(p && p.countries);
}

/** Every country with a shape, in a region or all (old: regionCountries). */
export function regionCountries(ctx: MapContext, region: string): string[] {
  return [...ctx.shapeName.keys()].filter((iso3) => !region || WHO_REGION[iso3] === region);
}

/** The Country picker's options for a region, by name (old: fillCountryList). */
export function countryOptions(ctx: MapContext, region: string): ShapeName[] {
  return regionCountries(ctx, region)
    .map((iso3) => ({ iso3, name: ctx.drawnName.get(iso3) || ctx.shapeName.get(iso3) || "" }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** The countries the Location filter keeps, or null for all (old: isoList). */
export function locationList(ctx: MapContext, st: MapState): string[] | null {
  return st.country ? [st.country] : st.region ? regionCountries(ctx, st.region) : null;
}

/**
 * The countries the counts, borders and lists cover: tracked, and inside
 * the Location filter (old: mftScope).
 */
export function scope(ctx: MapContext, st: MapState): string[] {
  const isoList = locationList(ctx, st);
  return ctx.drawn.filter((iso3) => !isoList || isoList.includes(iso3));
}

/** A country's access stage for the medicine shown (old: mftStage(iso3).lvl). */
export function stageOf(ctx: MapContext, productId: string, iso3: string): Stage {
  const lvl = ctx.drawnName.has(iso3) ? (ctx.levels.get(productId)?.[iso3] || null) : null;
  return lvl || "none";
}

/** WHO's name for a country (as in the annex), else the map's (old: mftName). */
export function policyName(ctx: MapContext, iso3: string): string {
  const tp = ctx.policy;
  return (tp && tp.countries[iso3] && tp.countries[iso3].name) || ctx.drawnName.get(iso3) || iso3;
}

const byPolicyName = (ctx: MapContext) => (a: string, b: string) => policyName(ctx, a).localeCompare(policyName(ctx, b));

/** Tracked countries by name (old: drawnIsos). */
export function drawnIsos(ctx: MapContext): string[] {
  return [...ctx.drawn].sort(byPolicyName(ctx));
}

/** The patient groups a country's policy lists the medicine for, any group (old: mftGroups). */
export function policyGroups(ctx: MapContext, productId: string, iso3: string): string[] {
  const c = ctx.policy && ctx.policy.countries[iso3];
  return (c && c.products && c.products[productId]) || [];
}

/** The two drawn groups that list the medicine for a country (old: mftCatsOf). */
export function groupsOf(ctx: MapContext, productId: string, iso3: string): GroupId[] {
  const g = policyGroups(ctx, productId, iso3);
  return GROUPS.filter((id) => g.includes(id));
}

/** Countries per group, in scope, by name (old: mftCounts). Empty without a policy. */
export function groupCountries(ctx: MapContext, st: MapState): Record<GroupId, string[]> {
  const byCat: Record<GroupId, string[]> = { tested: [], vivax: [] };
  if (!ctx.policy) return byCat;
  for (const iso3 of scope(ctx, st)) for (const g of groupsOf(ctx, st.productId, iso3)) byCat[g].push(iso3);
  for (const g of GROUPS) byCat[g].sort(byPolicyName(ctx));
  return byCat;
}

/**
 * Countries whose policy lists the medicine but which the map cannot draw
 * (French Guiana: part of France's shape here). Only with no location
 * chosen (old: mftUndrawn).
 */
export function undrawnInPolicy(ctx: MapContext, st: MapState): string[] {
  const tp = ctx.policy;
  if (!tp || st.region || st.country) return [];
  return Object.keys(tp.countries)
    .filter((iso3) => !ctx.drawnName.has(iso3) && policyGroups(ctx, st.productId, iso3).length)
    .map((iso3) => tp.countries[iso3].name ?? "");
}

/** Tracked countries per group for a medicine, ignoring location; a group with none is absent (old: mftAvail). */
export function availableGroups(ctx: MapContext, productId: string): Partial<Record<GroupId, number>> {
  const a: Partial<Record<GroupId, number>> = {};
  for (const iso3 of ctx.drawn) for (const g of groupsOf(ctx, productId, iso3)) a[g] = (a[g] || 0) + 1;
  return a;
}

/** Are the policy borders drawn? Whenever a group with countries is ticked (old: mftSync, mftOn). */
export function policyOn(ctx: MapContext, st: MapState): boolean {
  const av = availableGroups(ctx, st.productId);
  return !!ctx.policy && GROUPS.some((g) => st.ticked.includes(g) && !!av[g]);
}

export type StageCounts = Record<StageKey, number>;

// old: `l in counts`, counts holding the three levels
const isLevel = (l: unknown): l is Level => (LEVELS as readonly unknown[]).includes(l);

/** Tracked countries per access stage (old: stageCounts). */
export function stageCounts(ctx: MapContext, productId: string): StageCounts {
  const c = { registered: 0, guidelines: 0, mft: 0, none: 0 };
  const byIso = ctx.levels.get(productId) || {};
  for (const iso3 of ctx.drawn) {
    const l = byIso[iso3];
    if (isLevel(l)) c[l]++;
  }
  c.none = ctx.drawn.length - (c.registered + c.guidelines + c.mft);
  return c;
}

/**
 * Is a country listed under the left Filters: its access stage is ticked,
 * or it is in a ticked recommended-use group (old: mftMatches)?
 */
export function matches(ctx: MapContext, st: MapState, iso3: string): boolean {
  return (
    !(st.stageOff as readonly string[]).includes(stageOf(ctx, st.productId, iso3)) ||
    groupsOf(ctx, st.productId, iso3).some((g) => st.ticked.includes(g))
  );
}

/** The countries the Find a country list starts from (old: mftListed). */
export function listed(ctx: MapContext, st: MapState): string[] {
  return scope(ctx, st).filter((i) => matches(ctx, st, i));
}

/** "12 of 94" beside the Countries tab and the finder (old: countLabel). */
export function listedCount(ctx: MapContext, st: MapState): { listed: number; total: number } {
  return { listed: listed(ctx, st).length, total: scope(ctx, st).length };
}

// ---- the medicine tabs and the map ----------------------------------------------

/**
 * The access legend's counts (old: selectMap). From every entry of the
 * medicine's list, tracked or not, while "No data" is the tracked countries
 * less those: an untracked country in the list would be counted and push
 * "No data" down. The validator warns about untracked countries.
 */
export function legendCounts(ctx: MapContext, productId: string): { counts: StageCounts; noneZero: boolean } {
  const c = { registered: 0, guidelines: 0, mft: 0, none: 0 };
  for (const l of Object.values(ctx.levels.get(productId) || {})) if (isLevel(l)) c[l]++;
  const withData = c.registered + c.guidelines + c.mft;
  c.none = ctx.drawn.length - withData;
  return { counts: c, noneZero: withData === ctx.drawn.length };
}

/** The message over the map when a medicine has no country data (old: selectMap's #map-empty). */
export function emptyNotice(ctx: MapContext, productId: string): { kind: "pipeline" | "nodata"; name: string } | null {
  const p = productOf(ctx, productId);
  if (!p || p.countries) return null;
  return { kind: p.class === "pipeline" ? "pipeline" : "nodata", name: p.name };
}

/** The fill each shape is painted with, iso3 → stage or null; only tracked countries carry one (old: applyCountryLevels). */
export function featureLevels(ctx: MapContext, productId: string): Record<string, Stage | null> {
  const byIso = ctx.levels.get(productId) || {};
  const out: Record<string, Stage | null> = {};
  for (const s of ctx.shapes) out[s.iso3] = ctx.drawnName.has(s.iso3) ? byIso[s.iso3] || null : null;
  return out;
}

/** Colours the map's canvas layers read from the page's CSS custom properties. */
export interface MapColors {
  registered: string;
  guidelines: string;
  mft: string;
  nodata: string;
  border: string;
  surface2: string;
}

/** Reads a CSS custom property, trimmed; "" when unset. */
export type TokenReader = (name: string) => string;

/** old: readMapColors */
export function readMapColors(token: TokenReader): MapColors {
  return {
    registered: token("--map-registered") || token("--map1"),
    guidelines: token("--map-guidelines") || token("--map2"),
    mft: token("--map-mft") || token("--map3"),
    nodata: token("--map-nodata"),
    border: token("--map-border"),
    surface2: token("--surface-2"),
  };
}

/** A group's colour in swatches, the donut and the legend (old: mftGroupColor). */
export const groupColor = (token: TokenReader, g: GroupId): string => token("--mfg-" + g) || token("--accent");

/**
 * Every colour the map reads, as today's page sets them (the base sheet,
 * with the RBM skin's --surface-2 and --accent). The server has no CSS to
 * read, so the first render, on the server and again in the browser, uses
 * these; the component then reads the page's own values. A token the page
 * does not set keeps its value here, so the map still draws before the
 * ported stylesheet is in.
 */
export const DEFAULT_TOKENS: Readonly<Record<string, string>> = {
  "--map-registered": "#6FC1CF",
  "--map-guidelines": "#2A7FA8",
  "--map-mft": "#1B2A5E",
  "--map-nodata": "#FFFFFF",
  "--map-border": "#8299A2",
  "--surface-2": "#F7F8FA",
  "--mfg-tested": "#D55E00",
  "--mfg-vivax": "#7A4B00",
  "--accent": "#0066FF",
};

/** A token reader that falls back to DEFAULT_TOKENS for a token the page leaves unset. */
export const withDefaults = (read: TokenReader): TokenReader => (name) => read(name) || DEFAULT_TOKENS[name] || "";

/** The CSS colour of a stage's swatch, bar segment and track (old: stageVar). */
export const stageVar = (k: string): string => (k === "none" ? "var(--map-nodata)" : `var(--map-${k})`);

/** Each group's border pattern, for the swatches (old: MFT_PATTERN). */
export const LINE_PATTERN: Readonly<Record<GroupId, { w: number; da: string; cap?: string }>> = {
  tested: { w: 3, da: "" },
  vivax: { w: 2.8, da: "1.5 4.5", cap: "round" },
};

// MapLibre style expressions are JSON arrays.
export type Expr = readonly unknown[];

/** Fill colour by stage (old: paintCountries). */
export function fillColor(c: MapColors): Expr {
  return [
    "case",
    ["==", ["feature-state", "level"], "registered"], c.registered,
    ["==", ["feature-state", "level"], "guidelines"], c.guidelines,
    ["==", ["feature-state", "level"], "mft"], c.mft,
    c.nodata,
  ];
}

/** An unticked access stage fades its countries to 0.15 (old: paintStageFilter). */
export function fillOpacity(st: MapState): Expr {
  const o = (k: StageKey) => (st.stageOff.includes(k) ? 0.15 : 1);
  return [
    "case",
    ["==", ["feature-state", "level"], "registered"], o("registered"),
    ["==", ["feature-state", "level"], "guidelines"], o("guidelines"),
    ["==", ["feature-state", "level"], "mft"], o("mft"),
    o("none"),
  ];
}

const inList = (list: readonly string[]): Expr => ["in", ["get", "iso3"], ["literal", list]];

/** The open country's outline (old: paintSelection). */
export function selectionFilter(st: MapState): Expr {
  return ["==", ["get", "iso3"], st.selected || ""];
}

/** The fill and border layers' filter for the Location filter; null shows every shape (old: applyLocationFilter). */
export function locationFilter(ctx: MapContext, st: MapState): Expr | null {
  const isoList = locationList(ctx, st);
  return isoList ? inList(isoList) : null;
}

/**
 * The policy border layers (old: mftPaint). While they are hidden the old
 * code left their filters as they were, so `filters` is null then.
 */
export function policyLayers(ctx: MapContext, st: MapState): { visible: boolean; filters: Record<"mft-halo" | "mft-g-tested" | "mft-g-vivax", Expr> | null } {
  if (!policyOn(ctx, st)) return { visible: false, filters: null };
  const by: Record<GroupId, string[]> = { tested: [], vivax: [] };
  for (const iso3 of scope(ctx, st)) {
    for (const g of GROUPS) if (st.ticked.includes(g) && groupsOf(ctx, st.productId, iso3).includes(g)) by[g].push(iso3);
  }
  return {
    visible: true,
    filters: { "mft-halo": inList([...by.tested, ...by.vivax]), "mft-g-tested": inList(by.tested), "mft-g-vivax": inList(by.vivax) },
  };
}

/** The ids of the policy border layers, halo first (old: MFT_LAYERS). */
export const POLICY_LAYERS = ["mft-halo", "mft-g-tested", "mft-g-vivax"] as const;

export type Bounds = [[number, number], [number, number]];

/** The parts of a GeoJSON FeatureCollection the map reads. */
export interface Shapes {
  type: "FeatureCollection";
  features: { type: "Feature"; properties: { iso3: string }; geometry: { type: string; coordinates: unknown } }[];
}

/**
 * The box around some shapes, at any nesting depth of Polygon or
 * MultiPolygon coordinates (old: bboxOfFeatures).
 */
export function bboxOfFeatures(feats: Shapes["features"]): Bounds {
  let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;
  const walk = (node: unknown): void => {
    const n = node as unknown[];
    if (typeof n[0] === "number") {
      const [lon, lat] = n as number[];
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    } else n.forEach(walk);
  };
  walk(feats.map((f) => f.geometry.coordinates));
  return [[minLon, minLat], [maxLon, maxLat]];
}

/**
 * Where the camera goes for the Location filter (old: applyLocationFilter's
 * fitBounds), or null to stay put. A shape that straddles the antimeridian
 * (Russia, USA, New Zealand, Fiji, Kiribati) would stretch a region's box
 * round the globe, so it is left out of the framing only: it is still drawn
 * and still filtered.
 */
export function cameraFit(ctx: MapContext, st: MapState, shapes: Shapes): { bounds: Bounds; padding: number; maxZoom?: number } | null {
  if (st.country) {
    const feat = shapes.features.find((f) => f.properties.iso3 === st.country);
    return feat ? { bounds: bboxOfFeatures([feat]), padding: 40, maxZoom: MAX_ZOOM } : null;
  }
  if (st.region) {
    const isoList = regionCountries(ctx, st.region);
    const feats = shapes.features.filter((f) => isoList.includes(f.properties.iso3));
    const framing = feats.filter((f) => {
      const b = bboxOfFeatures([f]);
      return b[1][0] - b[0][0] < 180;
    });
    return framing.length ? { bounds: bboxOfFeatures(framing), padding: 30, maxZoom: MAX_ZOOM } : null;
  }
  return { bounds: [[LON0, LAT0], [LON1, LAT1]], padding: 0 };
}

/** The zoom readout beside the +/- buttons, "2.5×"; hidden near 1× (old: the map's zoom handler). */
export function zoomReadout(z: number): { hidden: boolean; text: string } {
  return { hidden: z <= 0.05, text: z > 0.05 ? Math.pow(2, z).toFixed(1).replace(/\.0$/, "") + "×" : "" };
}

/**
 * MapLibre's style: the shapes, a no-data fill, borders, the two policy
 * border groups (hidden until a group is ticked) and the open country's
 * outline on top. No tiles, fonts or sprites: nothing is loaded from
 * another server. (old: the style in `new maplibregl.Map`)
 */
export function mapStyle(c: MapColors, token: TokenReader, data: unknown) {
  const none = inList([]);
  return {
    version: 8 as const,
    sources: { world: { type: "geojson" as const, data, promoteId: "iso3" } },
    layers: [
      { id: "bg", type: "background", paint: { "background-color": c.surface2 } },
      { id: "country-fill", type: "fill", source: "world", paint: { "fill-color": c.nodata } },
      { id: "country-line", type: "line", source: "world", paint: { "line-color": c.border, "line-width": 0.75 } },
      // halo first, so a border reads on any fill
      { id: "mft-halo", type: "line", source: "world", layout: { visibility: "none" }, filter: none, paint: { "line-color": "#FFFFFF", "line-width": 4.2, "line-opacity": 0.9 } },
      { id: "mft-g-tested", type: "line", source: "world", layout: { visibility: "none" }, filter: none, paint: { "line-color": token("--mfg-tested") || "#D55E00", "line-width": 2.8 } },
      // round caps on near-zero dashes draw dots; a cap eats half a line-width of each gap, hence the wide gaps
      { id: "mft-g-vivax", type: "line", source: "world", layout: { visibility: "none", "line-cap": "round" }, filter: none, paint: { "line-color": token("--mfg-vivax") || "#7A4B00", "line-width": 2.6, "line-dasharray": [0.01, 3] } },
      // the country whose page is open: white halo, ink outline, above everything
      { id: "sel-halo", type: "line", source: "world", filter: ["==", ["get", "iso3"], ""], paint: { "line-color": "#FFFFFF", "line-width": 6, "line-opacity": 0.95 } },
      { id: "sel-line", type: "line", source: "world", filter: ["==", ["get", "iso3"], ""], paint: { "line-color": "#10272F", "line-width": 3 } },
    ],
  };
}

/** MapLibre's own interface text, keyed as MapLibre names it. */
export interface MapLibreText {
  zoomIn: string;
  zoomOut: string;
  windowsHelp: string;
  macHelp: string;
  mobileHelp: string;
}

/** The map's options apart from its container (old: `new maplibregl.Map({...})`). */
export function mapOptions(c: MapColors, token: TokenReader, data: unknown, t: MapLibreText) {
  return {
    style: mapStyle(c, token, data),
    center: [(LON0 + LON1) / 2, (LAT0 + LAT1) / 2] as [number, number],
    zoom: 0,
    minZoom: 0,
    maxZoom: MAX_ZOOM,
    // Near-global rather than the tracked countries' window: MapLibre raises
    // the effective minimum zoom until maxBounds fills the container, so a
    // tight box stopped "zoom out" at 2-3x (D30). Not -180/90: MapLibre
    // throws on bounds that reach the antimeridian or a pole exactly.
    maxBounds: [[-179, -85], [179, 85]] as Bounds,
    // 2D and north-up, as the SVG map it replaced (D19). keyboard:false
    // drops MapLibre's own keys, Shift+arrows rotating included; arrows are
    // wired to a plain pan instead.
    dragRotate: false,
    pitchWithRotate: false,
    touchPitch: false,
    keyboard: false,
    // Ctrl + scroll to zoom, so the page still scrolls over the map
    cooperativeGestures: true,
    locale: {
      "NavigationControl.ZoomIn": t.zoomIn,
      "NavigationControl.ZoomOut": t.zoomOut,
      "CooperativeGesturesHandler.WindowsHelpText": t.windowsHelp,
      "CooperativeGesturesHandler.MacHelpText": t.macHelp,
      "CooperativeGesturesHandler.MobileHelpText": t.mobileHelp,
    },
    attributionControl: false as const,
  };
}

/** Arrow keys pan the focused map this many pixels (old: the canvas keydown handler). */
export const PAN_STEP = 80;

/** The pan for an arrow key, or null for any other key. */
export function panFor(key: string): [number, number] | null {
  if (key === "ArrowLeft") return [-PAN_STEP, 0];
  if (key === "ArrowRight") return [PAN_STEP, 0];
  if (key === "ArrowUp") return [0, -PAN_STEP];
  if (key === "ArrowDown") return [0, PAN_STEP];
  return null;
}

// ---- tooltips ----------------------------------------------------------------------

/** The recommended-use line of a tooltip, or null without a policy (old: mftTipLine). */
export function tipPolicyLine(ctx: MapContext, st: MapState, iso3: string): { product: string; groups: GroupId[] } | null {
  if (!ctx.policy) return null;
  return { product: productOf(ctx, st.productId)?.name || "", groups: groupsOf(ctx, st.productId, iso3) };
}

/** Hovering a tracked country on the map; null for an untracked one (old: the map's mousemove handler). */
export function mapTip(ctx: MapContext, st: MapState, iso3: string) {
  if (!ctx.drawnName.has(iso3)) return null;
  return { name: policyName(ctx, iso3), stage: stageOf(ctx, st.productId, iso3), policy: tipPolicyLine(ctx, st, iso3) };
}

/**
 * A button of the keyboard country list, hovered or focused (old:
 * countryTip). The stages are listed and ticked up to the one reached.
 * Unlike the map's tooltip it names the shape (Tanzania, not WHO's
 * "United Republic of Tanzania (mainland)"), as the old page did.
 */
export function listTip(ctx: MapContext, st: MapState, shape: ShapeName, level: Stage | null) {
  const rank = (LEVELS as readonly string[]).indexOf(level || "");
  const p = productOf(ctx, st.productId);
  return {
    name: shape.name,
    rows: rank < 0 ? null : LEVELS.map((k, i) => ({ key: k, on: i <= rank })),
    policy: tipPolicyLine(ctx, st, shape.iso3),
    // old: mapProduct and mapStatus, set by selectMap; no line without a name
    product: p && p.name ? { name: p.name, status: p.countries ? p.countries.status || "" : "" } : null,
  };
}

// ---- Filters and legend ----------------------------------------------------------------

/** The Filters table, its badge and its hint (old: renderFilters). */
export function filterTable(ctx: MapContext, st: MapState) {
  const sc = stageCounts(ctx, st.productId);
  const av = availableGroups(ctx, st.productId);
  const byCat = groupCountries(ctx, st);
  const mine = ctx.policy ? GROUPS.filter((g) => av[g]) : [];
  const nOn = STAGE_ROWS.filter((k) => !st.stageOff.includes(k)).length + mine.filter((g) => st.ticked.includes(g)).length;
  const nAll = STAGE_ROWS.length + mine.length;
  const any = Object.keys(av).length > 0;
  return {
    allChecked: nOn === nAll,
    indeterminate: nOn > 0 && nOn < nAll,
    stages: STAGE_ROWS.map((key) => ({ key, checked: !st.stageOff.includes(key), count: sc[key] })),
    groups: ctx.policy
      ? GROUPS.map((id) => {
          const off = !av[id];
          return { id, off, checked: st.ticked.includes(id) && !off, count: byCat[id].length };
        })
      : null,
    /** the number in the Filters heading's badge; 0 hides it */
    active: st.stageOff.length + mine.filter((g) => !st.ticked.includes(g)).length,
    hint: {
      hidden: !ctx.policy || (policyOn(ctx, st) && any),
      kind: (any ? "tickHint" : "noPolicy") as "tickHint" | "noPolicy",
      product: productOf(ctx, st.productId)?.name || "",
    },
  };
}

/**
 * The legends under the map (old: mftLegend): access stages whose box is
 * unticked are dimmed; the recommended-use table always shows both groups,
 * dimmed when unticked or empty. `policy` is null without a policy.
 */
export function mapLegend(ctx: MapContext, st: MapState) {
  const av = availableGroups(ctx, st.productId);
  const byCat = groupCountries(ctx, st);
  return {
    dimStages: STAGE_ROWS.filter((k) => st.stageOff.includes(k)),
    policy: ctx.policy
      ? {
          product: productOf(ctx, st.productId)?.name || "",
          rows: GROUPS.map((id) => ({ id, dim: !(st.ticked.includes(id) && av[id]), count: byCat[id].length })),
        }
      : null,
  };
}

// ---- Detail rail ---------------------------------------------------------------------

/** One bar segment per non-empty stage, its width a percentage (old: stageBar). */
export function stageBar(c: StageCounts, total: number): { key: StageKey; width: number }[] {
  return STAGE_ROWS.filter((k) => c[k]).map((key) => ({ key, width: (c[key] / total) * 100 }));
}

// The donut's ring: radius, stroke width, circumference.
export const DONUT_R = 40, DONUT_W = 16, DONUT_C = 2 * Math.PI * DONUT_R;

/**
 * Countries by ticked group as a ring, with a table of both groups (old:
 * mftDonut). A country in both groups is one country in the centre count
 * but a share of each group's arc.
 */
export function donut(byCat: Record<GroupId, string[]>, on: readonly GroupId[]) {
  const total = GROUPS.reduce((s, g) => s + (on.includes(g) ? byCat[g].length : 0), 0);
  const union = new Set<string>();
  for (const g of GROUPS) if (on.includes(g)) byCat[g].forEach((i) => union.add(i));
  const segs = GROUPS.filter((g) => byCat[g].length && on.includes(g));
  const gap = segs.length > 1 ? 2 : 0; // thin white seam between groups
  let off = 0;
  const arcs = segs.map((id) => {
    const len = (DONUT_C * byCat[id].length) / total;
    const dash = Math.max(len - gap, 0.5);
    const arc = { id, dash, rest: DONUT_C - dash, offset: -off };
    off += len;
    return arc;
  });
  return { n: union.size, arcs, rows: GROUPS.map((id) => ({ id, dim: !on.includes(id), count: byCat[id].length })) };
}

// "2026-08-23" → "23 Aug 2026" in the page's language (old: shortDate).
// TODO: use lib/format.ts
export function shortDate(iso: string, locale: string): string {
  const d = new Date(iso + "T00:00:00");
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
}

// Large figures in data text as 940K or 11.5M, and US$14.5m as US$14.5M,
// where shown only; the data keeps the exact figures (old: fmtFig). en-US,
// because Chrome's en-GB writes a lowercase "940k" beside "11.5M".
// TODO: use lib/format.ts
const COMPACT = new Intl.NumberFormat("en-US", { notation: "compact", maximumSignificantDigits: 3 });
export function fmtFig(s: unknown): string {
  return str(s)
    .replace(/\b\d{1,3}(?:,\d{3})+\b/g, (m) => COMPACT.format(+m.replace(/,/g, "")))
    .replace(/(US\$\d+(?:\.\d+)?)m\b/g, "$1M");
}

/** The policy's edition and year for "Source: WHO ..." (old: mftSource). */
export function policySource(ctx: MapContext): { edition: string; year: string } {
  const m = (ctx.policy && ctx.policy.meta) || {};
  return { edition: m.edition || "World Malaria Report", year: str(m.policyYear || "") };
}

/**
 * The sources a country's access stage cites for the medicine, named and
 * linked as in the Sources list, with the date they were checked (partner
 * feedback, 15 Oct 2026). Null when it cites none the list knows. Reads the
 * medicine's first entry for the country (old: countrySources).
 */
export function countrySources(ctx: MapContext, productId: string, iso3: string) {
  const p = productOf(ctx, productId);
  const e = ((p && p.countries) || { list: [] as CountryEntry[] }).list.find((x) => x.iso3 === iso3);
  const items = ((e && e.sources) || [])
    .map((id) => ctx.sources.get(id))
    .filter((s): s is MapSource => !!s)
    .map((s) => ({ label: s.label, url: s.url }));
  if (!items.length || !e) return null;
  return { items, checked: e.checked ? shortDate(e.checked, ctx.dateLocale) : null };
}

/** The overview tab (old: detFacts and detOverview). */
export function overview(ctx: MapContext, st: MapState) {
  const p = productOf(ctx, st.productId);
  if (!p) return null;
  const n = ctx.drawn.length;
  const facts = {
    name: p.name,
    inn: p.inn,
    stage: ctx.stages[p.currentStage] || "",
    volume: p.volume ? fmtFig(p.volume) : null,
    flag: SHOW_BARRIERS && p.flag ? p.flag : null,
  };
  if (!p.countries) return { facts, mix: null, policy: null };
  const c = stageCounts(ctx, st.productId);
  const withStage = c.registered + c.guidelines + c.mft;
  type Policy =
    | { kind: "none" }
    | { kind: "tickLeft" }
    | { kind: "donut"; donut: ReturnType<typeof donut>; undrawn: string[]; source: ReturnType<typeof policySource> };
  let policy: Policy;
  if (!Object.keys(availableGroups(ctx, st.productId)).length) policy = { kind: "none" };
  else if (!policyOn(ctx, st)) policy = { kind: "tickLeft" };
  else
    policy = {
      kind: "donut",
      donut: donut(groupCountries(ctx, st), st.ticked),
      undrawn: undrawnInPolicy(ctx, st),
      source: policySource(ctx),
    };
  return { facts, mix: { withStage, total: n, counts: c, bar: stageBar(c, n) }, policy };
}

/**
 * The Find a country list for a search (old: finderRows): "empty" when the
 * filters leave no country, "nomatch" when the search leaves none, else the
 * rows by name. A name matches when it contains the search, ignoring case.
 */
export function finder(ctx: MapContext, st: MapState, q: string) {
  const k = q.trim().toLowerCase();
  const pool = listed(ctx, st);
  if (!pool.length) return { kind: "empty" as const };
  const list = pool.filter((i) => !k || policyName(ctx, i).toLowerCase().includes(k)).sort(byPolicyName(ctx));
  if (!list.length) return { kind: "nomatch" as const };
  return {
    kind: "rows" as const,
    /** pre-launch medicines leave the Stage column empty */
    showStage: hasCountries(ctx, st.productId),
    rows: list.map((iso3) => ({
      iso3,
      name: policyName(ctx, iso3),
      stage: stageOf(ctx, st.productId, iso3),
      groups: GROUPS.filter((g) => st.ticked.includes(g) && groupsOf(ctx, st.productId, iso3).includes(g)),
    })),
  };
}

/** How many other countries at the same stage a country page shows as chips. */
export const PEER_CHIPS = 24;

/** A country's page for the medicine shown (old: detCountry). */
export function countryPage(ctx: MapContext, st: MapState, iso3: string) {
  const p = productOf(ctx, st.productId);
  const regionCode = WHO_REGION[iso3] as Region | undefined;
  const head = {
    iso3,
    name: policyName(ctx, iso3),
    region: regionCode ?? null,
    /** the Back button, and where it goes; none for a page the Location filter opened */
    back: st.selected ? (st.cameFrom === "countries" ? ("countries" as const) : ("overview" as const)) : null,
    product: p ? p.name : "",
  };
  if (!hasCountries(ctx, st.productId)) return { ...head, access: null };
  const stage = stageOf(ctx, st.productId, iso3);
  const g = policyGroups(ctx, st.productId, iso3);
  const gl = groupsOf(ctx, st.productId, iso3);
  const tp = ctx.policy && ctx.policy.countries[iso3];
  const parts =
    tp && tp.parts
      ? Object.keys(tp.parts).map((name) => ({ name, lists: ((tp.parts![name].products || {})[st.productId] || []).length > 0 }))
      : [];
  // where it stands among the tracked countries of its WHO region
  const ids = ctx.drawn.filter((x) => WHO_REGION[x] === regionCode);
  let regionMix: { count: number; counts: StageCounts; bar: ReturnType<typeof stageBar>; pos: number } | null = null;
  if (ids.length > 1) {
    const rc: Record<string, number> = { registered: 0, guidelines: 0, mft: 0, none: 0 };
    for (const x of ids) rc[stageOf(ctx, st.productId, x)]++;
    let before = 0;
    for (const k of STAGE_ROWS) {
      if (k === stage) break;
      before += rc[k];
    }
    const counts = rc as StageCounts;
    regionMix = { count: ids.length, counts, bar: stageBar(counts, ids.length), pos: ((before + rc[stage] / 2) / ids.length) * 100 };
  }
  const peers = drawnIsos(ctx)
    .filter((x) => x !== iso3 && stageOf(ctx, st.productId, x) === stage)
    .map((x) => ({ iso3: x, name: policyName(ctx, x) }));
  return {
    ...head,
    access: {
      stage,
      /** how many of the three track segments are filled */
      track: (LEVELS as readonly string[]).indexOf(stage) + 1,
      sources: countrySources(ctx, st.productId, iso3),
      groups: gl,
      /** every drawn group, marked when the policy lists the medicine for it; shown only when one is */
      chips: GROUPS.map((id) => ({ id, yes: g.includes(id) })),
      policyYear: str((ctx.policy && ctx.policy.meta && ctx.policy.meta.policyYear) || ""),
      parts,
      source: policySource(ctx),
      regionMix,
      peers,
    },
  };
}

/**
 * What the Detail rail shows (old: renderDetail): a country's page when one
 * is open or chosen in Location, else the tabs.
 */
export function detail(ctx: MapContext, st: MapState) {
  const iso3 = st.selected || st.country || null;
  if (iso3) return { kind: "country" as const, page: countryPage(ctx, st, iso3) };
  return { kind: "tabs" as const, tab: st.tab, count: listedCount(ctx, st) };
}
