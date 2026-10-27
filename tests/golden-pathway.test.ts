// The golden test for lib/pathway.ts: each function the page had on its own,
// against the page's original, frozen in tests/golden-pathway/reference/ by
// tests/golden-pathway/extract.mjs (launch-rbm-test 7c1bf11). Same method as
// tests/golden.test.ts: the reference runs in node:vm with the globals from
// localize(), old and new are called on the same inputs, and every result
// must be deeply and strictly equal, or both must throw the same error.
//
// The counts the page worked out inline, inside markup (statusCounts,
// levelCounts, countryList, countryAccessCounts, phaseColumns, parallelPair,
// COUNT_ORDER), have no old function to call; tests/markup-pathway.test.ts
// checks them through that markup.
import { isDeepStrictEqual } from "node:util";
import { afterAll, describe, expect, it } from "vitest";
import type { Product } from "@/lib/dataset";
import { LOCALES, type Locale } from "@/lib/locales";
import * as pathway from "@/lib/pathway";
import { applyShowLate } from "@/lib/stages";
import { SCENARIOS, attempt, input, newSide, variants } from "./golden-pathway/inputs";
import { oldPage } from "./golden-pathway/old-page";

const perLocale: Record<Locale, number> = { en: 0, fr: 0, pt: 0 };
const perFunction = new Map<string, number>();

// Checked in tests/markup-pathway.test.ts, through the markup that uses them.
const VIA_MARKUP = [
  "statusCounts", "COUNT_ORDER", "levelCounts", "countryList", "countryAccessCounts", "phaseColumns", "parallelPair",
];

function comparer(locale: Locale) {
  const diffs: { fn: string; input: string; old: unknown; new: unknown }[] = [];
  /** `want` comes from the old page and is copied out of its realm first. */
  const same = (fn: string, input: string, got: unknown, want: unknown) => {
    perLocale[locale]++;
    perFunction.set(fn, (perFunction.get(fn) || 0) + 1);
    const w = structuredClone(want);
    if (!isDeepStrictEqual(got, w)) diffs.push({ fn, input, old: w, new: got });
  };
  const check = () => expect(diffs.slice(0, 20), `${diffs.length} differences`).toEqual([]);
  return { same, check };
}

for (const locale of LOCALES) {
  describe(`golden pathway: ${locale}`, () => {
    for (const sc of SCENARIOS) {
      it(sc.name, () => {
        const ds = input(locale, sc);
        const { ctx, pathway: pd } = newSide(ds, locale, sc);
        const list = variants(ds.data.products);
        const raw = list.map((v) => v.p);
        const listed = pathway.tracked(applyShowLate(raw, ctx.display));
        const old = oldPage(locale, sc.on, ds, raw, sc.lastUpdated);
        const { same, check } = comparer(locale);
        const f = old.fn;

        same("PATHWAY_DISPLAY", sc.name, pd, {
          showBarriers: old.value("SHOW_BARRIERS"),
          showStageExpected: old.value("SHOW_STAGE_EXPECTED"),
        });
        if (!sc.on.length) same("PATHWAY_DISPLAY", "as shipped", pathway.PATHWAY_DISPLAY, pd);

        same("nowYear", sc.lastUpdated ?? ds.data.meta.lastUpdated, ctx.asOfYear, old.value("nowYear"));

        const oldListed = old.value("tracked") as Product[];
        same("tracked", `${list.length} variants`, listed, oldListed);
        same("tracked", "order", listed.map((p) => p.name), oldListed.map((p) => p.name));

        for (let i = -1; i <= 9; i++) {
          same("colIndexOf", String(i), pathway.colIndexOf(i, ctx), f("colIndexOf")(i));
          same("stepNo", String(i), pathway.stepNo(i, ctx), f("stepNo")(i));
        }
        ds.data.stages.forEach((_, i) => {
          same("lateAt", String(i), pathway.lateAt(i, listed, ctx), f("lateAt")(i));
        });

        listed.forEach((p, n) => {
          for (let i = -1; i <= ds.data.stages.length; i++) {
            same(
              "stalledSince",
              `${p.id} #${n}, stage ${i}`,
              attempt(() => pathway.stalledSince(p, i, ctx)),
              attempt(() => f("stalledSince")(oldListed[n], i)),
            );
          }
        });

        check();
      });
    }
  });
}

// Every function and constant lib/pathway.ts exports is compared here or
// through the markup, so a new one cannot arrive without a check.
it("compares everything lib/pathway.ts exports", () => {
  const exported = Object.keys(pathway).sort();
  expect(exported.filter((name) => !perFunction.has(name) && !VIA_MARKUP.includes(name))).toEqual([]);
  expect(VIA_MARKUP.filter((name) => !exported.includes(name)), "VIA_MARKUP names a missing export").toEqual([]);
});

afterAll(() => {
  const total = LOCALES.reduce((n, l) => n + perLocale[l], 0);
  const byFn = [...perFunction].map(([fn, n]) => `${fn} ${n}`).join(", ");
  console.log(
    `golden pathway: ${total} comparisons (${LOCALES.map((l) => `${l} ${perLocale[l]}`).join(", ")})\n  by function: ${byFn}`,
  );
});
