// The golden test: lib/format.ts and lib/stages.ts against the static pages'
// own functions, frozen in tests/golden/reference/{en,fr,pt}.js by
// tests/golden/extract.mjs (launch-rbm-test 7c1bf11).
//
// Each reference runs in its own node:vm context, given only what the page
// gave it: the globals, set from localize() exactly as the new functions get
// them, and its <html lang>. Any other DOM access would throw there, which is
// also the check that the ported code was pure. Old and new are called on the
// same inputs, and every result must be deeply and strictly equal.
import { readFileSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";
import { createContext, runInContext } from "node:vm";
import { afterAll, describe, expect, it, vi } from "vitest";
import { localize, type LaunchData, type Localized, type Product, type StageEntry, type Status } from "@/lib/dataset";
import * as format from "@/lib/format";
import { LOCALES, type Locale } from "@/lib/locales";
import * as stages from "@/lib/stages";
import { PAGE_TEXT } from "@/lib/strings";

// The published file on 27 Oct 2026 (pipeline commit 2d30ff3).
const FIXTURE = JSON.parse(readFileSync(new URL("./fixtures/dashboard.json", import.meta.url), "utf8"));
const URL_ = "https://example.org/v1/dashboard.json";

const REFERENCE = Object.fromEntries(
  LOCALES.map((l) => [l, readFileSync(new URL(`./golden/reference/${l}.js`, import.meta.url), "utf8")]),
) as Record<Locale, string>;

// The page's <html lang>, as the extractor recorded it from the page.
const htmlLang = (l: Locale) => {
  const m = REFERENCE[l].match(/^\/\/ html-lang: (.+)$/m);
  if (!m) throw new Error(`reference/${l}.js has no html-lang line`);
  return m[1];
};

type Switch = "SHOW_PROGRESS" | "SHOW_LATE" | "YARD_COMPARE";

interface Scenario {
  name: string;
  /** the page's switches turned on, by their names on the page */
  on: Switch[];
  /** "today": the dataset date the old page counts to; the new code is given only its year */
  lastUpdated?: string;
  /** a change to the data, made on both sides */
  data?: (d: LaunchData) => void;
}

// The switches are inputs too: off, as shipped, yardstick() is always null,
// so its port would go untested. The other two years for "today" fall before
// and after every date in the data.
const SCENARIOS: Scenario[] = [
  { name: "as shipped", on: [] },
  { name: "yardstick comparison on", on: ["YARD_COMPARE"] },
  { name: "every switch on", on: ["SHOW_PROGRESS", "SHOW_LATE", "YARD_COMPARE"] },
  { name: "yardstick on, today in 2020", on: ["YARD_COMPARE"], lastUpdated: "2020-06-30" },
  { name: "yardstick on, today in 2033", on: ["YARD_COMPARE"], lastUpdated: "2033-01-15" },
  {
    name: "no stageColumns, no yardstick",
    on: ["YARD_COMPARE"],
    data: (d) => {
      delete d.stageColumns;
      delete d.yardstick;
    },
  },
];

const input = (locale: Locale, sc: Scenario): Localized => {
  const ds = localize(FIXTURE, locale, URL_);
  sc.data?.(ds.data);
  return ds;
};

const instantOf = (lastUpdated: string) => Date.parse(lastUpdated + "T00:00:00Z");

type Fn = (...args: unknown[]) => unknown;

// Every top-level name the test reads from a reference.
const OLD_NAMES = [
  "STAGES", "PRODUCTS", "STAGE_COLUMNS", "LABEL", "SHOW_PROGRESS", "PROGRESS_KEPT", "SHOW_LATE",
  "statusShown", "DATE_LANG", "esc", "citeLinks", "citeHtml", "readableDate", "shortDate", "fmtFig",
  "firstClause", "peekLine", "peekLineFor", "stageYear", "ASOF_YEAR", "yrsText", "firstYear",
  "phaseReached", "reachedText", "soFarText", "accessParts", "accessLine", "sinceFrom", "sinceFor",
  "YARD", "YARD_COMPARE", "varianceText", "ACCESS_SPLIT", "PHASES", "phaseOf", "sinceYearOf",
  "yardstick", "yardResult",
];

/**
 * One language's page, loaded with these products and switches. Its Date is
 * pinned to `today` and counts every read of the clock: none is expected, as
 * the page's "today" is the dataset's date.
 */
function oldPage(locale: Locale, sc: Scenario, products: Product[], today: number) {
  let src = REFERENCE[locale];
  for (const name of sc.on) {
    const off = `const ${name} = false;`;
    expect(src.split(off).length - 1, `reference/${locale}.js: ${off}`).toBe(1);
    src = src.replace(off, `const ${name} = true;`);
  }
  const ds = input(locale, sc);
  ds.data.products = structuredClone(products);
  if (sc.lastUpdated) ds.data.meta.lastUpdated = sc.lastUpdated;
  const ctx = createContext({
    window: {
      LAUNCH_DATA: ds.data,
      LAUNCH_SOURCES: ds.sources,
      LAUNCH_TREATMENT_POLICY: ds.treatmentPolicy,
      LAUNCH_DATASET: ds.dataset,
    },
    document: { documentElement: { lang: htmlLang(locale) } },
  });
  runInContext(
    `var __clockReads = 0;
    (function (RealDate, now) {
      class PinnedDate extends RealDate {
        constructor(...a) { if (a.length) super(...a); else { __clockReads++; super(now); } }
        static now() { __clockReads++; return now; }
      }
      globalThis.Date = PinnedDate;
    })(Date, ${today});`,
    ctx,
  );
  runInContext(src, ctx, { filename: `tests/golden/reference/${locale}.js` });
  const o = runInContext(`({ ${OLD_NAMES.join(", ")} })`, ctx) as Record<string, unknown>;
  return {
    fn: (name: string) => o[name] as Fn,
    value: (name: string) => o[name],
    clockReads: () => runInContext("__clockReads", ctx) as number,
  };
}

// ---- counting and comparing ---------------------------------------------------

const perLocale: Record<Locale, number> = { en: 0, fr: 0, pt: 0 };
const perFunction = new Map<string, number>();
let clockReads = 0;

interface Diff {
  fn: string;
  input: string;
  old: unknown;
  new: unknown;
}

function comparer(locale: Locale) {
  const diffs: Diff[] = [];
  /** `fn` is the new name; `want` comes from the old page and is copied out of its context first. */
  const same = (fn: string, input: string, got: unknown, want: unknown) => {
    perLocale[locale]++;
    perFunction.set(fn, (perFunction.get(fn) || 0) + 1);
    const w = structuredClone(want);
    if (!isDeepStrictEqual(got, w)) diffs.push({ fn, input, old: w, new: got });
  };
  const check = () => expect(diffs.slice(0, 20), `${diffs.length} differences`).toEqual([]);
  return { same, check };
}

// The page's citation markup, drawn from the new values with the page's own
// esc, so old and new can be compared. The components will draw the same.
const drawCites = (cites: format.Citation[], esc: Fn) =>
  cites
    .map((c) =>
      c.url
        ? `<a class="cite" href="${esc(c.url)}" target="_blank" rel="noopener noreferrer">${esc(c.label)}<span class="ext" aria-hidden="true">↗</span></a>`
        : esc(c.label),
    )
    .join(" · ");

// ---- inputs -------------------------------------------------------------------

const STATUSES: Status[] = ["done", "prog", "late", "idle"];

const DATE_TEXTS = [
  undefined, "", "2022", "Since 2018", "Ghana 2022; WHO policy table 2024", "  Rolling ; 2025 ",
  "2015–2023; requal. 20 Jan 2025", ";2020",
];
const NEXT_DATES = [undefined, "", "TBC", "tbc", " TBC ; maybe 2027", "Q4 2026", "2027; subject to funding", "TBC 2027"];

// free-text stage dates: where a year is and is not read
const YEAR_TEXTS = [
  "", "1989", "1990", "2100", "2101", "x2020", "2020s", "20201", "c. 2015", "2015–2023", "FY2019/20",
  "1999 and 2001", "Since 2018", "since 2018", "SINCE 1999", "Depuis 2008", "desde 2010", "Since2018",
  "Since  2018", "Since 2101", "Since 20201", "Rolling", "Q4 2026", "12 Nov 2025",
];

const NUMBERS = [-3, -1, -0.5, 0, 0.5, 1, 1.5, 2, 2.5, 3, 5, 10, 21, 40];
const YEARS = [null, 1990, 2012, 2026, 2100];

const FIGURES: (string | number | null | undefined)[] = [
  "1,234", "12,345", "999,999", "1,000", "1,000,000", "940,000 treatments", "US$14.5m", "US$14m",
  "US$14.5million", "US$1,234.50", "0,125 mg", "1,2345", "12,34", "2,023", "a1,234b", "1,234,5",
  "US$11.6m in 2025", "11,6 millions", null, undefined, 0, 1234567, 1.5,
];

const DATES = [
  ...Array.from({ length: 12 }, (_, m) => `2026-${String(m + 1).padStart(2, "0")}-15`),
  "", "2026", "2026-02", "2026-02-29", "2026-02-30", "2026-13-01", "not a date", "2026-10-27T08:38:13.617Z",
  " 2026-01-01", "2026-1-5",
];

const CITE_TEXTS = [undefined, "", 'Free text <b>&</b> "quoted"'];

/** Every string, citation list and cited claim in one language of the dataset. */
function collect(ds: Localized) {
  const strings = new Set<string>();
  const idLists: string[][] = [];
  const claims: [string[] | undefined, string | undefined][] = [];
  const visit = (v: unknown, claimsHere: boolean): void => {
    if (typeof v === "string") strings.add(v);
    else if (Array.isArray(v)) v.forEach((x) => visit(x, claimsHere));
    else if (v && typeof v === "object") {
      const o = v as Record<string, unknown>;
      if (claimsHere && ("sources" in o || "source" in o)) {
        const ids =
          Array.isArray(o.sources) && o.sources.every((x) => typeof x === "string") ? (o.sources as string[]) : undefined;
        if (ids) idLists.push(ids);
        claims.push([ids, typeof o.source === "string" ? o.source : undefined]);
      }
      for (const x of Object.values(o)) visit(x, claimsHere);
    }
  };
  visit(ds.data, true);
  visit(ds.treatmentPolicy, true);
  visit(ds.sources, false);
  visit(ds.dataset, false);
  return { strings: [...strings], idLists, claims, dates: [...strings].filter((s) => /^\d{4}-\d{2}/.test(s)) };
}

/**
 * The four products, and variations of each that reach the branches they do
 * not: every number of stages done, every current stage, every unfinished
 * stage late, and no journey. Ids are kept, so PROGRESS_KEPT still applies.
 */
function variants(products: Product[]): { name: string; p: Product }[] {
  const out: { name: string; p: Product }[] = [];
  for (const p of products) {
    out.push({ name: p.id, p: structuredClone(p) });
    for (let k = 0; k <= p.stages.length; k++) {
      const v = structuredClone(p);
      v.stages.forEach((st, j) => (st.status = j < k ? "done" : j === k ? "prog" : "idle"));
      v.currentStage = Math.min(k, v.stages.length - 1);
      out.push({ name: `${p.id}, ${k} stages done`, p: v });
    }
    for (let cur = 0; cur < p.stages.length; cur++) {
      const v = structuredClone(p);
      v.currentStage = cur;
      out.push({ name: `${p.id}, current stage ${cur}`, p: v });
    }
    const late = structuredClone(p);
    for (const s of [...late.stages, ...(late.detail.milestones || [])]) if (s.status !== "done") s.status = "late";
    out.push({ name: `${p.id}, every unfinished step late`, p: late });
    const noJourney = structuredClone(p);
    delete noJourney.detail.journey;
    out.push({ name: `${p.id}, no journey`, p: noJourney });
  }
  const noDetail: Partial<Product> = structuredClone(products[0]);
  delete noDetail.detail;
  out.push({ name: `${products[0].id}, no detail`, p: noDetail as Product });
  return out;
}

// ---- the comparisons ----------------------------------------------------------

for (const locale of LOCALES) {
  describe(`golden: ${locale}`, () => {
    it("formatting, text and constants", () => {
      const sc = SCENARIOS[0];
      const ds = input(locale, sc);
      const today = instantOf(ds.data.meta.lastUpdated);
      vi.setSystemTime(today);
      expect(Date.now(), "the test's own clock").toBe(today);
      const old = oldPage(locale, sc, ds.data.products, today);
      const { same, check } = comparer(locale);
      const esc = old.fn("esc");
      const t = PAGE_TEXT[locale];
      const sources = ds.sources.sources;
      const all = collect(ds);

      // the page's constants and switches, as shipped
      same("DATE_LOCALE", locale, format.DATE_LOCALE[locale], old.value("DATE_LANG"));
      same("PAGE_TEXT.status", locale, t.status, old.value("LABEL"));
      same("PAGE_TEXT.phases", locale, t.phases, (old.value("PHASES") as { name: string }[]).map((p) => p.name));
      same("ACCESS_SPLIT", locale, stages.ACCESS_SPLIT, old.value("ACCESS_SPLIT"));
      same("DISPLAY", "as shipped", stages.DISPLAY, {
        showProgress: old.value("SHOW_PROGRESS"),
        progressKept: old.value("PROGRESS_KEPT"),
        showLate: old.value("SHOW_LATE"),
        yardCompare: old.value("YARD_COMPARE"),
      });

      for (const s of [...all.strings, ...FIGURES]) same("fmtFig", String(s), format.fmtFig(s), old.fn("fmtFig")(s));
      for (const s of [...all.strings, ...DATE_TEXTS, null]) {
        same("firstClause", String(s), format.firstClause(s), old.fn("firstClause")(s));
      }
      for (const d of [...all.dates, ...DATES]) {
        same("readableDate", d, format.readableDate(d, locale), old.fn("readableDate")(d));
        same("shortDate", d, format.shortDate(d, locale), old.fn("shortDate")(d));
      }

      const ids = sources.map((s) => s.id);
      const idLists: (string[] | undefined)[] = [
        ...all.idLists, ...ids.map((id) => [id]), undefined, [], ["no-such-source"], ["constructor"],
        ["toString", ids[0]], [ids[0], ids[0]], [ids[0], "no-such-source", ids[1]], ["manufacturer"],
        ["manufacturer", "pmi"],
      ];
      for (const list of idLists) {
        same("citeLinks", JSON.stringify(list), drawCites(format.citeLinks(list, sources), esc), old.fn("citeLinks")(list));
      }
      const claims: [string[] | undefined, string | undefined][] = [
        ...all.claims,
        ...idLists.flatMap((list) => CITE_TEXTS.map((text): [string[] | undefined, string | undefined] => [list, text])),
      ];
      for (const [list, text] of claims) {
        same(
          "citeOrText",
          JSON.stringify([list, text]),
          drawCites(format.citeOrText(list, text, sources), esc),
          old.fn("citeHtml")(list, text),
        );
      }

      for (const status of STATUSES) {
        for (const date of DATE_TEXTS) {
          for (const next of NEXT_DATES) {
            for (const shown of [true, false]) {
              same(
                "peekLine",
                JSON.stringify([status, date, next, shown]),
                stages.peekLine(status, date, next, shown, locale),
                old.fn("peekLine")(status, date, next, shown),
              );
            }
          }
        }
      }

      const entries: (StageEntry | null | undefined)[] = [
        null, undefined, { status: "done" },
        ...STATUSES.flatMap((status) => YEAR_TEXTS.map((date): StageEntry => ({ status, date }))),
      ];
      for (const st of entries) {
        same("stageYear", JSON.stringify(st), stages.stageYear(st), old.fn("stageYear")(st));
        same("sinceYearOf", JSON.stringify(st), stages.sinceYearOf(st), old.fn("sinceYearOf")(st));
      }

      for (const n of NUMBERS) {
        same("yrsText", String(n), stages.yrsText(n, locale), old.fn("yrsText")(n));
        same("varianceText", String(n), stages.varianceText(n, locale), old.fn("varianceText")(n));
        same("soFarText", String(n), stages.soFarText(n, locale), old.fn("soFarText")(n));
      }
      for (const y of YEARS) same("reachedText", String(y), stages.reachedText(y, locale), old.fn("reachedText")(y));
      for (let i = -1; i <= 9; i++) same("phaseOf", String(i), stages.phaseOf(i), old.fn("phaseOf")(i));

      const kinds = ["done", "nodate", "idle", "nostart", "going"] as const;
      for (const kind of kinds) {
        for (const late of [undefined, 0, 0.5, 1, 3]) {
          const s: stages.YardStep = { i: 2, exp: 2, basis: "estimate", kind, ...(late != null ? { took: late + 2, late } : {}) };
          same("yardResult", JSON.stringify(s), stages.yardResult(s, locale), old.fn("yardResult")(s));
        }
      }
      for (const kind of ["done", "going"] as const) {
        for (const late of [0, 2]) {
          const w: stages.YardWhole = { kind, exp: 8, took: 8 + late, late };
          same("yardResult", JSON.stringify(w), stages.yardResult(w, locale), old.fn("yardResult")(w));
        }
      }

      clockReads += old.clockReads();
      expect(old.clockReads(), "clock reads by the old page").toBe(0);
      check();
    });

    for (const sc of SCENARIOS) {
      it(`stage rules, ${sc.name}`, () => {
        const ds = input(locale, sc);
        const lastUpdated = sc.lastUpdated ?? ds.data.meta.lastUpdated;
        const today = instantOf(lastUpdated);
        vi.setSystemTime(today);
        expect(Date.now(), "the test's own clock").toBe(today);
        const display: stages.Display = {
          ...stages.DISPLAY,
          showProgress: sc.on.includes("SHOW_PROGRESS"),
          showLate: sc.on.includes("SHOW_LATE"),
          yardCompare: sc.on.includes("YARD_COMPARE"),
        };
        // the new side keeps the fixture's date and is given only the year
        const ctx = stages.stageContext(ds.data, locale, {
          display,
          asOfYear: sc.lastUpdated ? stages.asOfYear(sc.lastUpdated) : undefined,
        });
        const list = variants(ds.data.products);
        const raw = list.map((v) => v.p);
        const before = JSON.stringify(raw);
        const products = stages.applyShowLate(raw, display);
        expect(JSON.stringify(raw), "applyShowLate changed its input").toBe(before);

        const old = oldPage(locale, sc, raw, today);
        const { same, check } = comparer(locale);
        const f = old.fn;
        const esc = f("esc");

        same("stageContext", "stages", ctx.stages, old.value("STAGES"));
        same("stageContext", "stageColumns", ctx.stageColumns, old.value("STAGE_COLUMNS"));
        same("stageContext", "yardstick", ctx.yardstick, old.value("YARD"));
        same("stageContext", "asOfYear", ctx.asOfYear, old.value("ASOF_YEAR"));
        same("stageContext", "display", ctx.display, {
          showProgress: old.value("SHOW_PROGRESS"),
          progressKept: old.value("PROGRESS_KEPT"),
          showLate: old.value("SHOW_LATE"),
          yardCompare: old.value("YARD_COMPARE"),
        });
        same("asOfYear", lastUpdated, stages.asOfYear(lastUpdated), old.value("ASOF_YEAR"));

        const oldProducts = old.value("PRODUCTS") as Product[];
        list.forEach(({ name }, n) => {
          const p = products[n];
          const op = oldProducts[n];
          same("applyShowLate", name, p, op);

          p.stages.forEach((st, i) => {
            const at = `${name}, stage ${i}`;
            same("stageYear", at, stages.stageYear(st), f("stageYear")(op.stages[i]));
            same("sinceYearOf", at, stages.sinceYearOf(st), f("sinceYearOf")(op.stages[i]));
            const ost = op.stages[i];
            same(
              "peekLineFor",
              at,
              stages.peekLineFor(p, ctx)(st.status, st.date, st.nextDate),
              (f("peekLineFor")(op) as Fn)(ost.status, ost.date, ost.nextDate),
            );
          });
          (p.detail?.milestones || []).forEach((m, i) => {
            const om = op.detail.milestones![i];
            same("stageYear", `${name}, milestone ${i}`, stages.stageYear(m as StageEntry), f("stageYear")(om));
            same("sinceYearOf", `${name}, milestone ${i}`, stages.sinceYearOf(m as StageEntry), f("sinceYearOf")(om));
          });
          for (const status of STATUSES) {
            same("statusShown", `${name}, ${status}`, stages.statusShown(p, status, ctx.display), f("statusShown")(op, status));
          }
          same("firstYear", name, stages.firstYear(p), f("firstYear")(op));
          for (const k of [0, 1]) same("phaseReached", `${name}, phase ${k}`, stages.phaseReached(p, k), f("phaseReached")(op, k));
          same("accessParts", name, stages.accessParts(p, ctx), f("accessParts")(op));
          // the page escaped the line for markup; React will escape it instead
          same("accessLine", name, esc(stages.accessLine(p, ctx)), f("accessLine")(op));
          same("sinceFrom", name, stages.sinceFrom(p, ctx), f("sinceFrom")(op));
          same("sinceFor", name, stages.sinceFor(p, ctx), f("sinceFor")(op));

          const ny = stages.yardstick(p, ctx);
          const oy = f("yardstick")(op) as stages.Yard | null;
          same("yardstick", name, ny, oy);
          if (ny?.approved && oy?.approved && ny.steps.length === oy.steps.length) {
            ny.steps.forEach((s, j) => {
              same("yardResult", `${name}, step ${s.i}`, stages.yardResult(s, locale), f("yardResult")(oy.steps[j]));
            });
            same("yardResult", `${name}, whole`, stages.yardResult(ny.whole, locale), f("yardResult")(oy.whole));
          }
        });

        clockReads += old.clockReads();
        expect(old.clockReads(), "clock reads by the old page").toBe(0);
        check();
      });
    }
  });
}

// Every function and constant the two files export is compared above, so a
// new one cannot arrive without a golden check (or a reason it has none).
it("compares everything lib/format.ts and lib/stages.ts export", () => {
  const exported = [...Object.keys(format), ...Object.keys(stages)].sort();
  expect(exported.filter((name) => !perFunction.has(name))).toEqual([]);
});

afterAll(() => {
  vi.useRealTimers();
  const total = LOCALES.reduce((n, l) => n + perLocale[l], 0);
  const byFn = [...perFunction].map(([fn, n]) => `${fn} ${n}`).join(", ");
  console.log(
    `golden: ${total} comparisons (${LOCALES.map((l) => `${l} ${perLocale[l]}`).join(", ")}); ` +
      `clock reads by the old pages: ${clockReads}\n  by function: ${byFn}`,
  );
});
