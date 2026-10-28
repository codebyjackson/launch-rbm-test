// The map section's visible text: what the components need, by key, built
// from the message files (lib/ui-text.ts) in the page's language. Until 28 Oct
// 2026 it was a table of today's English page (mapTextEn, now
// tests/fixtures/text/map-text.ts), used in every language. Keys follow the
// old code's own strings: where it wrote the same English twice in separate
// places, there are two keys, because a translation can differ (the French
// "Étape d'accès" and "Access stage"). tests/text-parity.test.ts proves
// mapText() returns today's text: the English table, and for French and
// Portuguese the text the old pages showed (tests/golden-map/translate.ts).
//
// Texts are plain strings so a server component can pass them to these
// client components. "{name}"-style slots are filled by fill().
import type { Locale } from "@/lib/locales";
import type { GroupId, MapLibreText, Region, StageKey } from "@/lib/map";
import { KEPT_IN_ONE_PLACE } from "@/lib/held-text";
import { around, rename, uiText } from "@/lib/ui-text";

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

const built = new Map<Locale, MapText>();

/** One language's MapText, built once. */
export function mapText(locale: Locale): MapText {
  let t = built.get(locale);
  if (t) return t;
  const m = uiText(locale);
  const map = m.map;
  const f = map.filters;
  const p = map.panel;
  const levels = m.common.accessLevels;
  const stage = { registered: levels.registered, guidelines: levels.guidelines, mft: levels.mft, none: levels.none };
  // "{shown} of {total}": the finder and the Countries tab write the word between the numbers themselves
  const [, of] = around(map.finder.count, "shown");
  t = {
    heading: map.title,
    note: map.note,
    medicine: map.tabs.heading,
    filters: f.heading,
    location: f.location,
    legend: map.legend.heading,
    detail: p.heading,

    tabsLabel: map.tabs.label,
    reset: f.reset,
    filtersLabel: f.show,
    region: f.region,
    regionLabel: f.regionLabel,
    country: f.country,
    countryLabel: f.countryLabel,
    allRegions: map.regions.all,
    allCountries: f.allCountries,
    regions: {
      AFRO: map.regions.afro,
      AMRO: map.regions.amro,
      EMRO: map.regions.emro,
      EURO: map.regions.euro,
      SEARO: map.regions.searo,
      WPRO: map.regions.wpro,
    },
    mapHint: map.hint,

    legendStage: map.accessStage,
    legendCount: map.countHeading,
    legendRows: { ...stage },
    // the link sits between the two: "… see the <a>WHO Malaria Threats Map</a>."
    resBefore: `${map.legend.resistanceNote} `,
    resLink: map.legend.resistanceLink,
    resAfter: ".",

    stage,
    inGuidelines: levels.guidelinesShort,
    track: [levels.registered, levels.guidelinesShort, levels.mft],

    map: {
      zoomIn: map.zoomIn,
      zoomOut: map.zoomOut,
      windowsHelp: map.ctrlScrollHelp,
      macHelp: map.cmdScrollHelp,
      mobileHelp: map.twoFingerHelp,
      canvasLabel: map.canvasLabel,
      listLabel: map.countryListLabel,
    },
    emptyPipeline: rename(map.preLaunch, { medicine: "name" }),
    emptyNoData: rename(map.noCountryData, { medicine: "name" }),

    groups: {
      tested: { short: map.groups.testedShort, label: map.groups.testedLabel, why: map.groups.testedWhy },
      vivax: { short: map.groups.vivaxShort, label: map.groups.vivaxLabel, why: map.groups.vivaxWhy },
    },
    show: f.show,
    count: map.countHeading,
    use: map.recommendedUse,
    group: p.group,
    // today's French page writes this heading differently from the legend's (lib/held-text.ts)
    filterStage: KEPT_IN_ONE_PLACE[locale]["map.filterStage"] ?? map.accessStage,
    tickHint: f.tickHint,
    tickLeft: p.tickLeft,
    noPolicy: rename(map.noPolicy, { medicine: "name" }),
    notListed: m.tooltip.notListed,
    sourcesFor: p.countrySources,
    // the panel writes " {checkedOn} {date}." itself
    checkedOn: around(p.checkedOn, "date")[0].trimEnd(),
    policySource: map.policySource,

    donutLabelOne: rename(p.donutLabelOne, { count: "n" }),
    donutLabelMany: rename(p.donutLabelOther, { count: "n" }),
    donutOne: p.donutUnitOne,
    donutMany: p.donutUnitOther,

    banner: p.selectHint,
    factsTitle: rename(p.factsTitle, { medicine: "name" }),
    currentStage: p.currentStage,
    procurement: p.procurement,
    overviewPre: rename(p.preLaunchOverview, { medicine: "name" }),
    mixTitle: rename(p.stageMixTitle, { medicine: "name" }),
    // follows the count, in its own element
    mixOf: ` ${rename(p.stageMixCount, { total: "n" })}`,
    overviewNoPolicy: rename(map.noPolicy, { medicine: "name" }),
    undrawn: rename(p.notDrawn, { countries: "list" }),

    overviewTab: p.overviewTab,
    countriesTab: p.countriesTab,
    find: {
      country: map.table.country,
      stage: map.table.stage,
      use: map.table.use,
      none: map.finder.noneMatchFilters,
      reset: map.finder.resetFilters,
      of: around(of, "total")[0].trim(),
    },
    noMatch: map.finder.noMatch,
    findTitle: map.finder.title,
    searchPlaceholder: map.finder.searchPlaceholder,
    searchLabel: map.finder.searchLabel,

    backCountries: `‹ ${p.backToCountries}`,
    backOverview: `‹ ${p.backToOverview}`,
    prev: p.previousCountry,
    next: p.nextCountry,
    countryPre: rename(p.preLaunchCountry, { medicine: "name" }),
    partLists: rename(p.partLists, { medicine: "name" }),
    partNotLists: rename(p.partDoesNotList, { medicine: "name" }),
    inPolicy: p.inWhoPolicy,
    notInPolicy: p.notInPolicy,
    among: rename(p.amongRegion, { count: "n", medicine: "name" }),
    peersTitle: p.sameStage,
    morePeers: rename(p.moreInCountriesTab, { count: "n" }),

    clickForDetails: m.tooltip.mapClickForDetails,
    // the tooltip writes the medicine's name, then this
    tipStatus: around(m.tooltip.dataStatus, "medicine")[1],
  };
  built.set(locale, t);
  return t;
}
