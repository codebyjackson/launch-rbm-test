// The map section's visible text: what the components need, by key.
//
// TEMPORARY: mapTextEn below is today's English page (en/index.html at
// launch-rbm-test 7c1bf11), copied by hand. The message files (step 2 of the
// port) replace it and supply French and Portuguese; MapText is the shape
// they must fill. Keys follow the old code's own strings: where it wrote the
// same English twice in separate places, there are two keys, because a
// translation can differ (the French "Étape d'accès" and "Access stage").
//
// Texts are plain strings so a server component can pass them to these
// client components. "{name}"-style slots are filled by fill().
import type { GroupId, MapLibreText, Region, StageKey } from "@/lib/map";

export interface MapText {
  heading: string;
  note: string;
  /** rail headings */
  medicine: string;
  filters: string;
  location: string;
  legend: string;
  detail: string;

  /** aria-label of the medicine tabs */
  tabsLabel: string;
  reset: string;
  /** aria-label of the Filters table */
  filtersLabel: string;
  region: string;
  regionLabel: string;
  country: string;
  countryLabel: string;
  allRegions: string;
  allCountries: string;
  regions: Record<Region, string>;
  mapHint: string;

  /** the access legend: its head, rows and the drug-resistance note */
  legendStage: string;
  legendCount: string;
  legendRows: Record<StageKey, string>;
  resBefore: string;
  resLink: string;
  resAfter: string;

  /** a stage's name (old: LEVEL_LABEL, and STAGE_ROWS's labels) */
  stage: Record<StageKey, string>;
  /** "In guidelines", the short form in the region legend, the finder and the track */
  inGuidelines: string;
  track: [string, string, string];

  map: MapLibreText & { canvasLabel: string; listLabel: string };
  emptyPipeline: string; // {name}
  emptyNoData: string; // {name}

  groups: Record<GroupId, { short: string; label: string; why: string }>;
  /** old: MFT_TXT */
  show: string;
  count: string;
  use: string;
  group: string;
  filterStage: string;
  tickHint: string;
  tickLeft: string;
  noPolicy: string; // {name}
  notListed: string;
  sourcesFor: string;
  checkedOn: string;
  policySource: string; // {edition} {year}

  donutLabelOne: string; // {n}
  donutLabelMany: string; // {n}
  donutOne: string;
  donutMany: string;

  banner: string;
  factsTitle: string; // {name}
  currentStage: string;
  procurement: string;
  overviewPre: string; // {name}
  mixTitle: string; // {name}
  mixOf: string; // {n}
  overviewNoPolicy: string; // {name}
  undrawn: string; // {list}

  overviewTab: string;
  countriesTab: string;
  /** old: FIND_TXT */
  find: { country: string; stage: string; use: string; none: string; reset: string; of: string };
  noMatch: string;
  findTitle: string;
  searchPlaceholder: string;
  searchLabel: string;

  backCountries: string;
  backOverview: string;
  prev: string;
  next: string;
  countryPre: string; // {name}
  partLists: string; // {part} {name}
  partNotLists: string; // {part} {name}
  inPolicy: string; // {year}
  notInPolicy: string;
  among: string; // {country} {n} {region} {name}
  peersTitle: string; // {stage}
  morePeers: string; // {n}

  clickForDetails: string;
  tipStatus: string; // {status}
}

/** Fills "{key}" slots. A slot with no value is left as it is, so a missing one shows. */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in values ? String(values[k]) : m));
}

/** TEMPORARY, until the message files: today's English page. */
export const mapTextEn: MapText = {
  heading: "Country access map",
  note: "Each country is shaded by the furthest stage it has reached.",
  medicine: "Medicine",
  filters: "Filters",
  location: "Location",
  legend: "Legend",
  detail: "Detail",

  tabsLabel: "Select medicine for map",
  reset: "Reset",
  filtersLabel: "Show on map",
  region: "Region",
  regionLabel: "Filter map by WHO region",
  country: "Country or area",
  countryLabel: "Filter map by country",
  allRegions: "All regions",
  allCountries: "All countries",
  regions: {
    AFRO: "Africa", AMRO: "Americas", EMRO: "Eastern Mediterranean",
    EURO: "Europe", SEARO: "South-East Asia", WPRO: "Western Pacific",
  },
  mapHint: "Drag to pan · Ctrl + scroll or double-click to zoom · arrow keys pan when the map has focus",

  legendStage: "Access stage",
  legendCount: "No. of countries",
  legendRows: { registered: "Registered", guidelines: "In national guidelines", mft: "In MFT plans", none: "No data" },
  resBefore: "Drug-resistance results are not shown on this map. To explore them, see the ",
  resLink: "WHO Malaria Threats Map",
  resAfter: ".",

  stage: { registered: "Registered", guidelines: "In national guidelines", mft: "In MFT plans", none: "No data" },
  inGuidelines: "In guidelines",
  track: ["Registered", "In guidelines", "In MFT plans"],

  map: {
    zoomIn: "Zoom in",
    zoomOut: "Zoom out",
    windowsHelp: "Use Ctrl + scroll to zoom the map",
    macHelp: "Use ⌘ + scroll to zoom the map",
    mobileHelp: "Use two fingers to move the map",
    canvasLabel: "World map, pan and zoom with the mouse or arrow keys",
    listLabel: "Countries on this map, list form",
  },
  emptyPipeline: "{name} is pre-launch — no country access yet.",
  emptyNoData: "No country-level data yet for {name}.",

  groups: {
    tested: {
      short: "Recommended for P. falciparum",
      label: "Recommended for Plasmodium falciparum malaria",
      why: "First-line for confirmed (tested) cases in national policy",
    },
    vivax: {
      short: "Recommended for P. vivax",
      label: "Recommended for Plasmodium vivax malaria",
      why: "Listed as treatment in national policy",
    },
  },
  show: "Show on map",
  count: "No. of countries",
  use: "Country recommended use",
  group: "Group",
  filterStage: "Access stage",
  tickHint: "Tick a group to draw its borders on the map.",
  tickLeft: "Tick a group on the left to see its countries.",
  noPolicy: "No national treatment policy lists {name} yet.",
  notListed: "not listed",
  sourcesFor: "Sources for this access stage:",
  checkedOn: "Checked on",
  policySource: "Source: WHO {edition}, Annex 4B ({year} policy).",

  donutLabelOne: "{n} country by patient group",
  donutLabelMany: "{n} countries by patient group",
  donutOne: "country",
  donutMany: "countries",

  banner: "Select any country on the map, or from the Countries tab, to open its page.",
  factsTitle: "{name} · medicine facts",
  currentStage: "Current stage",
  procurement: "Public-channel procurement (Global Fund)",
  overviewPre: "{name} is pre-launch, so there is no country-level status or policy yet.",
  mixTitle: "Access stage mix · {name}",
  mixOf: " of {n} countries have an access stage",
  overviewNoPolicy: "No national treatment policy lists {name} yet.",
  undrawn: "Also in policy but not drawn on this map: {list}.",

  overviewTab: "Overview",
  countriesTab: "Countries",
  find: {
    country: "Country", stage: "Stage", use: "Use", none: "No countries match the filters on the left.",
    reset: "Reset filters", of: "of",
  },
  noMatch: "No country matches.",
  findTitle: "Find a country",
  searchPlaceholder: "Type a country name…",
  searchLabel: "Search countries",

  backCountries: "‹ Back to countries",
  backOverview: "‹ Back to overview",
  prev: "Previous country",
  next: "Next country",
  countryPre: "{name} is pre-launch, so there is no country status or policy yet.",
  partLists: "{part}: lists {name}.",
  partNotLists: "{part}: does not list {name}.",
  inPolicy: "in WHO policy {year}",
  notInPolicy: "Not listed in national treatment policy",
  among: "{country} among {n} {region} countries · {name}",
  peersTitle: "Other countries at the same stage · {stage}",
  morePeers: "+{n} more in the Countries tab",

  clickForDetails: "Click for details ›",
  tipStatus: " · {status} data",
};
