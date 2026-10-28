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
import { existsSync, readFileSync } from "node:fs";
import { afterAll, describe, expect, it } from "vitest";
import { boardText } from "@/components/board/text";
import { frameText } from "@/components/frame/text";
import { mapText } from "@/components/map/text";
import { pathwayText } from "@/components/pathway/text";
import { LOCALES, type Locale } from "@/lib/locales";
import { pageText } from "@/lib/strings";
import { BOARD_TEXT } from "./fixtures/text/board-text";
import { FRAME_TEXT } from "./fixtures/text/frame-text";
import { MAP_MARKUP, readMapMarkup } from "./fixtures/text/map-markup";
import { mapTextEn } from "./fixtures/text/map-text";
import { PAGE_TEXT } from "./fixtures/text/page-text";
import { pathwayText as PATHWAY_TEXT } from "./fixtures/text/pathway-text";
import { deriveText } from "./golden-map/translate";

type Tree = { readonly [key: string]: unknown };

/**
 * Today's value → the value shipped, by area and path. Each entry must still
 * describe both sides, or the test below fails, so it is deleted rather than
 * left to hide a later change.
 */
const CHANGED: Record<Locale, { [areaPath: string]: [today: string, shipped: string] }> = {
  en: {},
  // pathwayText.nodeDelayed: the pathway's per-step delayed count, for screen
  // readers; singular, which is wrong for two or more (for the translation
  // reviewer). Not rendered while DISPLAY.showLate is off.
  // The rest: seven words today's /fr and /pt show in English, translated by
  // launch-development-test PR #129 (28 Oct). French "Transactions" and
  // "Packs" are spelled as in English, so they do not change.
  fr: {
    "pathwayText.nodeDelayed": [", {n} delayed", ", {n} retardé"],
    "boardText.presentation": ["Presentation", "Présentation"],
    "boardText.notEstimated": ["not estimated", "non estimé"],
    "mapText.donutOne": ["country", "pays"],
    "mapText.donutMany": ["countries", "pays"],
    "mapText.tipStatus": [" · {status} data", " · {status} données"],
  },
  pt: {
    "pathwayText.nodeDelayed": [", {n} delayed", ", {n} atrasado"],
    "boardText.presentation": ["Presentation", "Apresentação"],
    "boardText.transactions": ["Transactions", "Transações"],
    "boardText.packs": ["Packs", "Pacotes"],
    "boardText.notEstimated": ["not estimated", "não estimado"],
    "mapText.donutOne": ["country", "país"],
    "mapText.donutMany": ["countries", "países"],
    "mapText.tipStatus": [" · {status} data", " · {status} dados"],
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

    const page = new URL(`../${locale}/index.html`, import.meta.url);
    it.skipIf(!existsSync(page))("the map's static-markup text is today's page's", () => {
      expect(readMapMarkup(readFileSync(page, "utf8"))).toStrictEqual(MAP_MARKUP[locale]);
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
