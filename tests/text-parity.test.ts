// The message-file adapters return today's text, apart from the changes
// made on purpose that CHANGED lists.
//
// Each area's text object (pageText, pathwayText, boardText, frameText,
// mapText) is built from messages/*.json. The tables they replaced are frozen
// in tests/fixtures/text/, and the area tests prove those tables against
// today's pages; this proves the adapters equal the tables, value for value,
// in every language. For the map, which had only an English table, the
// French and Portuguese are the old pages' own: their script's strings
// (tests/golden-map/translate.ts, which tests/golden-map.test.ts proves
// against those pages) and their static markup (fixtures/text/map-markup.ts,
// checked against the pages below while they are in the checkout).
//
// Until 28 Oct 2026 lib/held-text.ts kept today's wording where the message
// files differed. The message build now writes it (launch-development-test,
// docs/rbm-messages-notes.md, decisions 9 and 10), except for two changes the
// owner chose, which are applied to today's text here before comparing:
//   - French takes the typographic apostrophe ’ for every straight one
//     (decision 9). Today's French page shows ' in its static markup and in
//     a few script strings.
//   - CHANGED: values today's pages leave in English that the message files
//     translate (decision 10).
import { execFileSync } from "node:child_process";
import { afterAll, describe, expect, it } from "vitest";
import { boardText } from "@/components/board/text";
import { frameText } from "@/components/frame/text";
import { mapText } from "@/components/map/text";
import { pathwayText } from "@/components/pathway/text";
import { LOCALES, type Locale } from "@/lib/locales";
import { provideMessages } from "@/lib/messages";
import { pageText } from "@/lib/strings";
import { BOARD_TEXT } from "./fixtures/text/board-text";
import { FRAME_TEXT } from "./fixtures/text/frame-text";
import { MAP_MARKUP, readMapMarkup } from "./fixtures/text/map-markup";
import { mapTextEn } from "./fixtures/text/map-text";
import { PAGE_TEXT } from "./fixtures/text/page-text";
import { pathwayText as PATHWAY_TEXT } from "./fixtures/text/pathway-text";
import { deriveText } from "./golden-map/translate";

// This file checks the words the message files ship, so it drops the pages'
// words that tests/setup/page-words.ts hands the other test files.
for (const l of LOCALES) provideMessages(l, undefined);

type Tree = { readonly [key: string]: unknown };

/**
 * Today's value → the value shipped, by area and path. Each entry must still
 * describe both sides, or the test below fails, so it is deleted rather than
 * left to hide a later change.
 */
const CHANGED: Record<Locale, { [areaPath: string]: [today: string, shipped: string] }> = {
  en: {},
  // French and Portuguese messages with {placeholders} whose words differ from
  // the page's (launch-rbm-test 565cec0, built 4 Nov 2026 with the professional
  // translators' text). The page says the sentence, or joins its pieces, in the
  // translators' words; the message has its own memory entry under its own
  // English, still Google's until the translators' follow-up file comes back
  // (launch-development-test docs/translation-notes.md, "Professional
  // translations"). Messages whose page sentence the translators delivered
  // already take its words (import-xliff.js, "derived") and are not here.
  fr: {
    "pageText.year": ["{n} an", "{n} année"],
    "pageText.years": ["{n} ans", "{n} années"],
    "boardText.sinceNotRoutine": [
      "depuis {year}, pas encore couramment utilisé",
      "depuis {year}, pas encore en usage courant",
    ],
    "boardText.notePublished": [
      "Délais attendus, d’après le calendrier communiqué : {stages}.",
      "Délais prévus d’après le calendrier publié : {stages}.",
    ],
    "boardText.noteEstimate": [
      "Délais attendus d’après les estimations de LAUNCH, qui restent à valider : {stages}.",
      "Délais prévus d’après les estimations de travail de LAUNCH, encore à convenir : {stages}.",
    ],
    "frameText.footer.verifiedFor": [
      "Les enregistrements nationaux ont été vérifiés pour :",
      "Les enregistrements des pays ont été vérifiés pour :",
    ],
    "frameText.footer.notVerifiedFor": [
      "Les phases atteintes par les pays n’ont pas encore été vérifiées pour :",
      "Les étapes nationales n’ont pas encore été vérifiées pour :",
    ],
    "pathwayText.nodeLabel": [
      "Phase {n}, {stage}{expected}. Indique le déroulé de cette phase et où en est chaque médicament{delayed}.",
      "Étape {n}, {stage}{expected}. Indique ce qui se passe ici et où se trouve chaque médicament{delayed}.",
    ],
    // pathwayText.nodeDelayed: the pathway's per-step delayed count, for screen
    // readers. The page writes it in English in every language (", " + n +
    // " delayed"); the message files translate it.
    "pathwayText.nodeDelayed": [", {n} delayed", ", {n} retardé"],
    "pathwayText.stepPanelLabel": ["Phase {n}: {stage}", "Scène {n}: {stage}"],
    "pathwayText.surveyStatus": ["l’enquête nationale est {status}", "L’enquête nationale est {status}"],
    "mapText.emptyPipeline": [
      "{name} est en prélancement – pas d’accès aux pays à ce jour.",
      "{name} En phase de pré-lancement — aucun accès national pour le moment.",
    ],
    "mapText.emptyNoData": [
      "Aucune donnée nationale à ce jour pour {name}.",
      "Aucune donnée au niveau national pour le moment. {name}.",
    ],
    "mapText.checkedOn": ["Vérifié sur", "Vérifié"],
    "mapText.partLists": ["{part}: a inscrit {name}.", "{part}: listes {name}."],
    "mapText.partNotLists": ["{part}: n’a pas inscrit {name}.", "{part}: ne liste pas {name}."],
    "mapText.inPolicy": ["dans les politiques de l’OMS {year}", "dans la politique de l’OMS {year}"],
  },
  pt: {
    // pathwayText.nodeDelayed: the pathway's per-step delayed count, for screen
    // readers. The page writes it in English in every language (", " + n +
    // " delayed"); the message files translate it.
    "pathwayText.nodeDelayed": [", {n} delayed", ", {n} atrasado"],
    "boardText.sinceNotRoutine": [
      "desde {year}, ainda não em uso de rotina",
      "desde {year}, ainda não em uso rotineiro",
    ],
    "boardText.notePublished": [
      "Tempos previstos com base em um cronograma publicado: {stages}.",
      "Tempos esperados a partir de um cronograma publicado: {stages}.",
    ],
    "boardText.noteEstimate": [
      "Tempos previstos com base nas estimativas preliminares do LAUNCH, ainda a serem acordadas: {stages}.",
      "Tempos esperados a partir das estimativas de trabalho de LAUNCH, ainda a serem acordados: {stages}.",
    ],
    "frameText.footer.verifiedFor": [
      "Os registros nacionais foram verificados para:",
      "Os registros de país foram verificados para:",
    ],
    "frameText.footer.notVerifiedFor": [
      "As etapas de país ainda não foram verificadas para:",
      "As etapas do país ainda não foram verificadas para:",
    ],
    "pathwayText.nodeLabel": [
      "Etapa {n}, {stage}{expected}. Mostra o que acontece nesta etapa e em que ponto se encontra cada medicamento{delayed}.",
      "Estágio {n}, {stage}{expected}. Mostra o que acontece aqui e onde cada medicamento está localizado{delayed}.",
    ],
    "pathwayText.surveyStatus": ["a pesquisa no país é {status}", "A pesquisa de país é {status}"],
    "mapText.emptyPipeline": [
      "{name} pré-lançamento — ainda sem acesso de país.",
      "{name} está em fase de pré-lançamento — ainda não há acesso a determinados países.",
    ],
    "mapText.emptyNoData": [
      "Ainda não há dados por país para {name}.",
      "Ainda não existem dados a nível de país para {name}.",
    ],
    "mapText.noPolicy": [
      "Nenhuma política nacional de tratamento inclui {name} ainda.",
      "Nenhuma política nacional de tratamento inclui {name} até o momento.",
    ],
    "mapText.overviewNoPolicy": [
      "Nenhuma política nacional de tratamento inclui {name} ainda.",
      "Nenhuma política nacional de tratamento inclui {name} até o momento.",
    ],
    "mapText.partLists": ["{part}: inclui {name}.", "{part}: listas {name}."],
    "mapText.partNotLists": ["{part}: não inclui {name}.", "{part}: não lista {name}."],
  },
};

const retyped: Record<Locale, number> = { en: 0, fr: 0, pt: 0 };

/** Today's text as the message files now ship it: CHANGED, then French ’. */
function asShipped(locale: Locale, area: string, today: unknown, path = ""): unknown {
  if (typeof today === "string") {
    const changed = CHANGED[locale][`${area}.${path}`];
    if (changed && changed[0] === today) return changed[1];
    if (locale === "fr" && today.includes("'")) {
      retyped[locale]++;
      return today.replace(/'/g, "’");
    }
    return today;
  }
  if (Array.isArray(today)) return today.map((v, i) => asShipped(locale, area, v, path ? `${path}.${i}` : String(i)));
  if (today && typeof today === "object") {
    return Object.fromEntries(Object.entries(today).map(([k, v]) => [k, asShipped(locale, area, v, path ? `${path}.${k}` : k)]));
  }
  return today;
}

/** Every value that differs, by its path: "footer.disclaimer.1". */
function differences(got: unknown, want: unknown, path = ""): { at: string; adapter: unknown; today: unknown }[] {
  if (got !== null && want !== null && typeof got === "object" && typeof want === "object") {
    const keys = [...new Set([...Object.keys(got), ...Object.keys(want)])];
    return keys.flatMap((k) => differences((got as Tree)[k], (want as Tree)[k], path ? `${path}.${k}` : k));
  }
  return Object.is(got, want) ? [] : [{ at: path, adapter: got, today: want }];
}

const leaves = (tree: unknown, prefix = ""): [string, string][] =>
  Object.entries(tree as Tree).flatMap(([k, v]) =>
    typeof v === "string" ? [[prefix + k, v] as [string, string]] : leaves(v, `${prefix}${k}.`),
  );

function lookup(tree: unknown, key: string): unknown {
  return key.split(".").reduce<unknown>((node, k) => (node && typeof node === "object" ? (node as Tree)[k] : undefined), tree);
}

const compared: Record<Locale, number> = { en: 0, fr: 0, pt: 0 };

for (const locale of LOCALES) {
  describe(`text parity: ${locale}`, () => {
    // [area, what the test names it, the adapter, today's text]
    const cases: [string, string, () => unknown, unknown][] = [
      ["pageText", "pageText (lib/strings.ts)", () => pageText(locale), PAGE_TEXT[locale]],
      ["pathwayText", "pathwayText", () => pathwayText(locale), PATHWAY_TEXT[locale]],
      ["boardText", "boardText", () => boardText(locale), BOARD_TEXT[locale]],
      ["frameText", "frameText", () => frameText(locale), FRAME_TEXT[locale]],
      ["mapText", "mapText", () => mapText(locale), locale === "en" ? mapTextEn : { ...deriveText(locale).text, ...MAP_MARKUP[locale] }],
    ];
    for (const [area, name, adapter, today] of cases) {
      it(`${name} equals today's text, as shipped`, () => {
        const got = adapter();
        const want = asShipped(locale, area, today);
        compared[locale] += leaves(today).length;
        expect(differences(got, want)).toEqual([]);
        // and nothing but text: no stray functions or undefined values
        expect(got).toStrictEqual(want);
      });
    }

    it("lists only changes that still apply", () => {
      const stale = Object.entries(CHANGED[locale]).filter(([at, [before, after]]) => {
        const [area, ...rest] = at.split(".");
        const c = cases.find(([a]) => a === area);
        return !c || lookup(c[3], rest.join(".")) !== before || lookup(c[2](), rest.join(".")) !== after;
      });
      expect(stale.map(([at]) => at), "today's text or the shipped text has moved: update or delete the entry").toEqual([]);
    });

    it("the map's static-markup text is today's page's", () => {
      // the page as frozen at 565cec0 (built from launch-development-test b0f8675), from git
      const page = execFileSync("git", ["show", `565cec0:${locale}/index.html`], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
      expect(readMapMarkup(page)).toStrictEqual(MAP_MARKUP[locale]);
      // the reader picks the fields it names: in English they are the old table's
      if (locale === "en") {
        const en = mapTextEn as unknown as { [k: string]: unknown };
        expect(Object.fromEntries(Object.keys(MAP_MARKUP.en).map((k) => [k, en[k]]))).toStrictEqual(MAP_MARKUP.en);
      }
    });
  });
}

afterAll(() => {
  console.log(
    `text-parity: ${LOCALES.map((l) => `${l} ${compared[l]} values (${Object.keys(CHANGED[l]).length} changed, ${retyped[l]} with ’ for ')`).join(", ")}`,
  );
});
