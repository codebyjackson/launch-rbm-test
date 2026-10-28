// Today's text, frozen: the table that components/map/text.ts held until the message files
// replaced it (copied unchanged from feat/react-port-dashboard 2869943).
// The area tests compare the components with today's pages using it, and
// tests/text-parity.test.ts proves the message-file adapter returns exactly it.
import type { MapText } from "@/components/map/text";

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
