// What tests/golden-board.test.ts and tests/markup-board.test.ts share: the
// old page loaded from its frozen reference, the scenarios, and the product
// variants both sides are given.
//
// The old page runs in its own node:vm context, as in tests/golden.test.ts,
// with the globals set from localize() exactly as the new code gets them. In
// place of its DOM it gets html.ts's small one: the board element its
// statements fill (header, rows, placeholders, then the glossary walk over
// the rows), and el(), which parses a row's markup as the page's <template>
// did. Any other DOM access throws there.
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { expect } from "vitest";
import { localize, type LaunchData, type Localized, type Product } from "@/lib/dataset";
import { LOCALES, type Locale } from "@/lib/locales";
import { DISPLAY, type Display } from "@/lib/stages";
import { BOARD_DISPLAY, type BoardDisplay } from "@/lib/board";
import { El, miniDocument, parse } from "./html";
import { PAGE_LANG } from "@/lib/frame";

export const FIXTURE = JSON.parse(
  readFileSync(new URL("../fixtures/dashboard.json", import.meta.url), "utf8"),
);
const URL_ = "https://example.org/v1/dashboard.json";

export const REFERENCE = Object.fromEntries(
  LOCALES.map((l) => [l, readFileSync(new URL(`./reference/${l}.js`, import.meta.url), "utf8")]),
) as Record<Locale, string>;

const htmlLang = (l: Locale) => {
  const m = REFERENCE[l].match(/^\/\/ html-lang: (.+)$/m);
  if (!m) throw new Error(`reference/${l}.js has no html-lang line`);
  // The language the new code declares (lib/frame.ts PAGE_LANG), not the page's
  // own pt-PT: Portuguese is Brazilian since 28 Oct 2026, and old and new must
  // format dates and numbers alike for the comparison to test the logic.
  return PAGE_LANG[l];
};

export type Switch = "SHOW_PROGRESS" | "SHOW_LATE" | "YARD_COMPARE" | "SHOW_BARRIERS" | "SHOW_STAGE_NOTE";

export interface Scenario {
  name: string;
  on: Switch[];
  /** "today" for the old page; the new side is given its year */
  lastUpdated?: string;
  data?: (d: LaunchData) => void;
}

// As in tests/golden.test.ts, plus the board's own two switches, and a case
// with no glossary.
export const SCENARIOS: Scenario[] = [
  { name: "as shipped", on: [] },
  { name: "yardstick comparison on", on: ["YARD_COMPARE"] },
  { name: "every switch on", on: ["SHOW_PROGRESS", "SHOW_LATE", "YARD_COMPARE", "SHOW_BARRIERS", "SHOW_STAGE_NOTE"] },
  { name: "yardstick on, today in 2020", on: ["YARD_COMPARE"], lastUpdated: "2020-06-30" },
  { name: "yardstick on, today in 2033", on: ["YARD_COMPARE", "SHOW_BARRIERS"], lastUpdated: "2033-01-15" },
  {
    name: "no stageColumns, no yardstick, no glossary",
    on: ["YARD_COMPARE"],
    data: (d) => {
      delete d.stageColumns;
      delete d.yardstick;
      d.glossary = undefined;
    },
  },
];

export const input = (locale: Locale, sc: Scenario): Localized => {
  const ds = localize(FIXTURE, locale, URL_);
  sc.data?.(ds.data);
  return ds;
};

/** The new side's switches for a scenario. */
export function switches(sc: Scenario): { display: Display; boardDisplay: BoardDisplay } {
  return {
    display: {
      ...DISPLAY,
      showProgress: sc.on.includes("SHOW_PROGRESS"),
      showLate: sc.on.includes("SHOW_LATE"),
      yardCompare: sc.on.includes("YARD_COMPARE"),
    },
    boardDisplay: {
      ...BOARD_DISPLAY,
      showBarriers: sc.on.includes("SHOW_BARRIERS"),
      showStageNote: sc.on.includes("SHOW_STAGE_NOTE"),
    },
  };
}

/**
 * The four products, and variations that reach the branches they do not:
 * every number of stages done, every current stage, every unfinished step
 * late, no journey, a journey pending for under a year; names that test the
 * sort; procurement with five channels (the colours cycle) and a survey that
 * is not verified; and placeholder rows whose note holds glossary terms in
 * awkward places. Ids are kept, so PROGRESS_KEPT still applies.
 */
export function variants(products: Product[]): { name: string; p: Product }[] {
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
  const [a, b, c, d] = products;
  const named = (src: Product, name: string, cls?: string) => {
    const v = structuredClone(src);
    v.name = name;
    if (cls) v.class = cls;
    out.push({ name: `${src.id} named ${name}`, p: v });
  };
  named(a, "éclair", "pipeline");
  named(b, "Eclair");
  named(c, "eclair ACT");
  named(d, "Zeta PQ");
  named(a, "alpha");
  // stage years chosen to reach the timeline's edges: two gates 20% of the
  // axis apart (2005 and 2010 on 2005–2026), and spans that need ticks every
  // 2 and every 5 years
  for (const years of [
    [2005, 2010, 2015, 2019, 2020, 2022, 2024],
    [2019, 2020, 2020, 2021, 2023],
    [2013, 2014, 2016, 2019, 2025],
  ]) {
    const v = structuredClone(a);
    v.stages.forEach((st, j) => {
      st.status = j < years.length ? "done" : j === years.length ? "prog" : "idle";
      if (j < years.length) st.date = String(years[j]);
    });
    v.currentStage = Math.min(years.length, v.stages.length - 1);
    out.push({ name: `${a.id}, stages dated ${years.join(" ")}`, p: v });
  }
  const fresh = structuredClone(d);
  fresh.detail.journey = [
    { label: "Something dated", year: 2026 },
    { label: "Pending", year: "TBC" },
  ];
  fresh.currentStage = 5;
  out.push({ name: `${d.id}, journey pending under a year`, p: fresh });
  const channels = structuredClone(d);
  channels.detail.volume = {
    ...channels.detail.volume!,
    source: "Five channels",
    split: [20, 20, 20, 20, 20].map((pct, n) => ({ channel: `Channel ${n + 1} & <co>`, pct })),
    byPresentation: [{ label: "tablets", transactions: 1234567, packs: 0, courses: null }],
  };
  out.push({ name: `${d.id}, five channels`, p: channels });
  for (const status of ["illustrative", "partial"]) {
    const v = structuredClone(c);
    v.detail.countries = { ...v.detail.countries!, status };
    out.push({ name: `${c.id}, survey ${status}`, p: v });
  }
  for (const [n, note] of ["PQR then PQ, ACTs and ACT, EU-M4all; PQ again", "MFT", ""].entries()) {
    const v = structuredClone(b);
    v.id = `future-${n}`;
    v.name = `Future ${n} SRA`;
    v.placeholder = true;
    v.note = note;
    out.push({ name: `placeholder ${n}`, p: v });
  }
  return out;
}

type Fn = (...args: unknown[]) => unknown;

/**
 * One language's old page, loaded with these products and switches; its
 * statements have already built the board. Its Date is pinned to the dataset
 * date and counts every read of the clock: none is expected.
 */
export function oldPage(locale: Locale, sc: Scenario, products: Product[]) {
  let src = REFERENCE[locale];
  for (const name of sc.on) {
    const off = `const ${name} = false;`;
    expect(src.split(off).length - 1, `reference/${locale}.js: ${off}`).toBe(1);
    src = src.replace(off, `const ${name} = true;`);
  }
  const ds = input(locale, sc);
  ds.data.products = structuredClone(products);
  if (sc.lastUpdated) ds.data.meta.lastUpdated = sc.lastUpdated;
  const today = Date.parse(ds.data.meta.lastUpdated + "T00:00:00Z");

  const root = new El("#document");
  const board = root.appendChild(new El("div"));
  board.setAttribute("class", "board");
  board.setAttribute("id", "board");
  const { doc, NodeFilter } = miniDocument(locale, root);
  doc.documentElement.lang = htmlLang(locale);

  const ctx = createContext({
    window: {
      LAUNCH_DATA: ds.data,
      LAUNCH_SOURCES: ds.sources,
      LAUNCH_TREATMENT_POLICY: ds.treatmentPolicy,
      LAUNCH_DATASET: ds.dataset,
    },
    document: doc,
    NodeFilter,
    board,
    // the page's el(): a <template>'s first node
    el: (html: string) => parse(html.trim())[0],
    // the page fits timelines after load; tests compare fitTimeline directly
    timelineFit: null,
    // the tooltip's functions, which the glossary pass hands to listeners
    // that never fire here
    showTipAt: () => {},
    hideTip: () => {},
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
  runInContext(src, ctx, { filename: `tests/golden-board/reference/${locale}.js` });
  return {
    board,
    doc,
    /** a top-level function or value of the page, by name */
    get: (name: string) => runInContext(name, ctx) as unknown,
    fn: (name: string) => runInContext(name, ctx) as Fn,
    clockReads: () => runInContext("__clockReads", ctx) as number,
  };
}
