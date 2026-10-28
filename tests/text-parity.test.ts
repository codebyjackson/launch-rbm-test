// The message-file adapters return exactly today's text.
//
// Each area's text object (pageText, pathwayText, boardText, frameText,
// mapText) is built from messages/*.json plus the texts held in
// lib/held-text.ts. The tables they replaced are frozen in
// tests/fixtures/text/, and the area tests prove those tables against
// today's pages; this proves the adapters equal the tables, value for value,
// in every language. For the map, which had only an English table, the
// French and Portuguese are the old pages' own: their script's strings
// (tests/golden-map/translate.ts, which tests/golden-map.test.ts proves
// against those pages) and their static markup (fixtures/text/map-markup.ts,
// checked against the pages below while they are in the checkout).
//
// It also keeps lib/held-text.ts honest: a held text whose key has reached
// the message files, or a kept text the message files now match, fails here,
// so the entry is deleted rather than left to hide a later change.
import { existsSync, readFileSync } from "node:fs";
import { afterAll, describe, expect, it } from "vitest";
import { boardText } from "@/components/board/text";
import { frameText } from "@/components/frame/text";
import { mapText } from "@/components/map/text";
import { pathwayText } from "@/components/pathway/text";
import { KEPT_FROM_PAGES, KEPT_IN_ONE_PLACE, NOT_IN_MESSAGES } from "@/lib/held-text";
import { LOCALES, type Locale } from "@/lib/locales";
import { messagesFor } from "@/lib/messages";
import { pageText } from "@/lib/strings";
import { BOARD_TEXT } from "./fixtures/text/board-text";
import { FRAME_TEXT } from "./fixtures/text/frame-text";
import { MAP_MARKUP, readMapMarkup } from "./fixtures/text/map-markup";
import { mapTextEn } from "./fixtures/text/map-text";
import { PAGE_TEXT } from "./fixtures/text/page-text";
import { pathwayText as PATHWAY_TEXT } from "./fixtures/text/pathway-text";
import { deriveText } from "./golden-map/translate";

type Tree = { readonly [key: string]: unknown };

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
    const cases: [string, () => unknown, unknown][] = [
      ["pageText (lib/strings.ts)", () => pageText(locale), PAGE_TEXT[locale]],
      ["pathwayText", () => pathwayText(locale), PATHWAY_TEXT[locale]],
      ["boardText", () => boardText(locale), BOARD_TEXT[locale]],
      ["frameText", () => frameText(locale), FRAME_TEXT[locale]],
      ["mapText", () => mapText(locale), locale === "en" ? mapTextEn : { ...deriveText(locale).text, ...MAP_MARKUP[locale] }],
    ];
    for (const [name, adapter, today] of cases) {
      it(`${name} equals today's text`, () => {
        const got = adapter();
        compared[locale] += leaves(today).length;
        expect(differences(got, today)).toEqual([]);
        // and nothing but text: no stray functions or undefined values
        expect(got).toStrictEqual(today);
      });
    }

    const page = new URL(`../${locale}/index.html`, import.meta.url);
    it.skipIf(!existsSync(page))("the map's static-markup text is today's page's", () => {
      expect(readMapMarkup(readFileSync(page, "utf8"))).toStrictEqual(MAP_MARKUP[locale]);
      // the reader picks the fields it names: in English they are the old table's
      if (locale === "en") {
        const en = mapTextEn as unknown as { [k: string]: unknown };
        expect(Object.fromEntries(Object.keys(MAP_MARKUP.en).map((k) => [k, en[k]]))).toStrictEqual(MAP_MARKUP.en);
      }
    });

    it("holds back only texts the message files do not have", () => {
      const m = messagesFor(locale);
      const present = leaves(NOT_IN_MESSAGES[locale])
        .map(([key]) => key)
        .filter((key) => lookup(m, key) !== undefined);
      expect(present, "now in the message files: delete them from NOT_IN_MESSAGES").toEqual([]);
    });

    it("keeps today's wording only where the message files differ", () => {
      const m = messagesFor(locale);
      const stale = Object.entries(KEPT_FROM_PAGES[locale]).filter(([key, today]) => {
        const v = lookup(m, key);
        return typeof v !== "string" || v === today;
      });
      expect(stale.map(([key]) => key), "missing or now equal in the message files").toEqual([]);
      const filterStage = KEPT_IN_ONE_PLACE[locale]["map.filterStage"];
      if (filterStage !== undefined) expect(filterStage).not.toBe(m.map.accessStage);
    });
  });
}

afterAll(() => {
  const held = (l: Locale) => leaves(NOT_IN_MESSAGES[l]).length;
  const kept = (l: Locale) => Object.keys(KEPT_FROM_PAGES[l]).length + Object.keys(KEPT_IN_ONE_PLACE[l]).length;
  console.log(
    `text-parity: ${LOCALES.map((l) => `${l} ${compared[l]} values (${held(l)} held, ${kept(l)} kept)`).join(", ")}`,
  );
});
