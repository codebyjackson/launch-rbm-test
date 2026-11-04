// The map section's text that today's pages carry in their static markup
// (#mapsec in {en,fr,pt}/index.html at launch-rbm-test 565cec0), not in their
// script. tests/golden-map/translate.ts builds the French and Portuguese
// MapText from the script's strings alone, so it leaves these in English,
// while the pages show them translated (the golden test compares only what
// the script wrote). tests/text-parity.test.ts lays these over it.
//
// MAP_MARKUP is frozen, so the test still works once the static pages leave
// the branch; while they are here, the test reads them again with
// readMapMarkup() and fails if this copy is stale.
import type { MapText } from "@/components/map/text";
import type { Locale } from "@/lib/locales";

export type MapMarkupText = Pick<
  MapText,
  | "heading" | "medicine" | "tabsLabel" | "filters" | "reset" | "filtersLabel" | "location"
  | "region" | "regionLabel" | "country" | "countryLabel" | "mapHint" | "legend" | "legendStage"
  | "legendCount" | "legendRows" | "resBefore" | "resLink" | "resAfter" | "detail"
>;

const decode = (s: string) =>
  s.replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (_, e: string) =>
    ({ amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", nbsp: " " })[e] as string,
  );

/** The static #mapsec markup's texts, from one built page. */
export function readMapMarkup(page: string): MapMarkupText {
  const start = page.indexOf('<section class="viz" id="mapsec"');
  if (start < 0) throw new Error("no #mapsec in the page");
  const sec = page.slice(start, page.indexOf("</section>", start));
  const one = (re: RegExp, what: string) => {
    const m = re.exec(sec);
    if (!m) throw new Error(`#mapsec: no ${what}`);
    return decode(m[1]);
  };
  const row = (lvl: string) => one(new RegExp(`data-lvl="${lvl}"><td class="sw">.*?</td><td>(.*?)</td>`), `${lvl} row`);
  return {
    heading: one(/<h2>(.*?)<\/h2>/, "heading"),
    medicine: one(/<h3>(.*?)<\/h3>\s*<div class="tabs"/, "medicine heading"),
    tabsLabel: one(/id="maptabs"[^>]*aria-label="([^"]*)"/, "tabs label"),
    filters: one(/<h3>(.*?) <span class="flt-act"/, "filters heading"),
    reset: one(/id="flt-reset">(.*?)<\/button>/, "reset"),
    filtersLabel: one(/id="flt-table"[^>]*aria-label="([^"]*)"/, "filters label"),
    location: one(/id="loc-controls">\s*<h3>(.*?)<\/h3>/, "location heading"),
    region: one(/<label class="res-pick">(.*?) <select id="loc-region"/, "region label"),
    regionLabel: one(/id="loc-region" aria-label="([^"]*)"/, "region aria-label"),
    country: one(/<label class="res-pick">(.*?) <select id="loc-country"/, "country label"),
    countryLabel: one(/id="loc-country" aria-label="([^"]*)"/, "country aria-label"),
    mapHint: one(/id="map-hint">(.*?)<\/p>/, "map hint"),
    legend: one(/<h3>(.*?)<\/h3>\s*<div class="legend-tables"/, "legend heading"),
    legendStage: one(/<th colspan="2">(.*?)<\/th>/, "legend stage heading"),
    legendCount: one(/<th class="n">(.*?)<\/th>/, "legend count heading"),
    legendRows: { registered: row("registered"), guidelines: row("guidelines"), mft: row("mft"), none: row("none") },
    resBefore: one(/id="mapnote-who">(.*?)<a /, "resistance note"),
    resLink: one(/<a href="[^"]*" target="_blank" rel="noopener noreferrer">(.*?)<span class="ext"/, "resistance link"),
    resAfter: one(/<\/a>(.*?)<\/p>/, "resistance note's end"),
    detail: one(/<div class="dock-section dock-detail">\s*<h3>(.*?)<\/h3>/, "detail heading"),
  };
}

export const MAP_MARKUP: Record<Locale, MapMarkupText> = {
  en: {
    heading: "Country access map",
    medicine: "Medicine",
    tabsLabel: "Select medicine for map",
    filters: "Filters",
    reset: "Reset",
    filtersLabel: "Show on map",
    location: "Location",
    region: "Region",
    regionLabel: "Filter map by WHO region",
    country: "Country or area",
    countryLabel: "Filter map by country",
    mapHint: "Drag to pan · Ctrl + scroll or double-click to zoom · arrow keys pan when the map has focus",
    legend: "Legend",
    legendStage: "Access stage",
    legendCount: "No. of countries",
    legendRows: { registered: "Registered", guidelines: "In national guidelines", mft: "In MFT plans", none: "No data" },
    resBefore: "Drug-resistance results are not shown on this map. To explore them, see the ",
    resLink: "WHO Malaria Threats Map",
    resAfter: ".",
    detail: "Detail",
  },
  fr: {
    heading: "Carte de l’accès aux pays",
    medicine: "Médicament",
    tabsLabel: "Sélectionner un médicament pour l’afficher",
    filters: "Filtres",
    reset: "Réinitialiser",
    filtersLabel: "Afficher sur la carte",
    location: "Lieu",
    region: "Région",
    regionLabel: "Filtrer la carte par région de l’OMS",
    country: "Pays ou zone",
    countryLabel: "Filtrer la carte par pays",
    mapHint: "Faire glisser pour déplacer la vue · Ctrl + molette ou double-clic pour zoomer · utiliser les flèches du clavier pour déplacer la vue dans la carte",
    legend: "Légende",
    legendStage: "Phases du parcours d’accès",
    legendCount: "Nombre de pays",
    legendRows: {
      registered: "Enregistré",
      guidelines: "Dans les directives nationales",
      mft: "Dans les plans MFT",
      none: "Aucune donnée",
    },
    resBefore: "Les résultats relatifs à la pharmacorésistance n’apparaissent pas sur cette carte. Pour les consulter, rendez-vous sur la ",
    resLink: "Carte des menaces du paludisme de l’OMS",
    resAfter: ".",
    detail: "Détail",
  },
  pt: {
    heading: "Mapa de acesso por país",
    medicine: "Medicamento",
    tabsLabel: "Selecione um medicamento para o mapa",
    filters: "Filtros",
    reset: "Redefinir",
    filtersLabel: "Mostrar no mapa",
    location: "Local",
    region: "Região",
    regionLabel: "Filtrar mapa por região da OMS",
    country: "País ou área",
    countryLabel: "Filtrar mapa por país",
    mapHint: "Arraste para mover · Ctrl + rolagem ou clique duplo para ampliar · use as teclas de seta para mover o mapa quando ele estiver em foco",
    legend: "Legenda",
    legendStage: "Estágio de acesso",
    legendCount: "No. de países",
    legendRows: {
      registered: "Registrado",
      guidelines: "Em diretrizes nacionais",
      mft: "Em planos de MFT",
      none: "Nenhum dado",
    },
    resBefore: "Os resultados sobre resistência aos medicamentos não são apresentados neste mapa. Para explorá-los, consulte o ",
    resLink: "Mapa de Ameaças da Malária da OMS",
    resAfter: ".",
    detail: "Detalhe",
  },
};
