// Inputs shared by tests/golden-pathway.test.ts and tests/markup-pathway.test.ts:
// the published dataset, the page's switches as scenarios, and variations of
// the four medicines that reach the branches today's data does not.
import { readFileSync } from "node:fs";
import { localize, type LaunchData, type Localized, type Product } from "@/lib/dataset";
import type { Locale } from "@/lib/locales";
import { DISPLAY, asOfYear, stageContext, type Display, type StageContext } from "@/lib/stages";
import type { PathwayDisplay } from "@/lib/pathway";

// The published file on 27 Oct 2026 (pipeline commit 2d30ff3).
export const FIXTURE = JSON.parse(readFileSync(new URL("../fixtures/dashboard.json", import.meta.url), "utf8"));
const URL_ = "https://example.org/v1/dashboard.json";

/** The page's switches the pathway reads, by their names on the page. */
export type Switch = "SHOW_PROGRESS" | "SHOW_LATE" | "SHOW_BARRIERS" | "SHOW_STAGE_EXPECTED";
const ALL: Switch[] = ["SHOW_PROGRESS", "SHOW_LATE", "SHOW_BARRIERS", "SHOW_STAGE_EXPECTED"];

export interface Scenario {
  name: string;
  /** the switches turned on */
  on: Switch[];
  /** "today": the dataset date the old page counts to; the new code is given only its year */
  lastUpdated?: string;
  /** a change to the data, made on both sides */
  data?: (d: LaunchData) => void;
}

// As shipped, every switch is off and no stage is late, so the delayed
// counts, the tally chips, the barrier line and the expected-time tags would
// never be compared. The other "today"s put the waits under a year and long.
export const SCENARIOS: Scenario[] = [
  { name: "as shipped", on: [] },
  { name: "every switch on", on: ALL },
  // late stages exist, but only the kept medicines may say "Delayed"
  { name: "late kept, status words hidden", on: ["SHOW_LATE"] },
  { name: "every switch on, today in 2020", on: ALL, lastUpdated: "2020-06-30" },
  { name: "as shipped, today in 2033", on: [], lastUpdated: "2033-01-15" },
  {
    name: "no stageColumns, yardstick or stageInfo, every switch on",
    on: ALL,
    data: (d) => {
      delete d.stageColumns;
      delete d.yardstick;
      delete d.stageInfo;
    },
  },
];

export const input = (locale: Locale, sc: Scenario): Localized => {
  const ds = localize(FIXTURE, locale, URL_);
  sc.data?.(ds.data);
  return ds;
};

/** The new side's switches and context for a scenario. */
export function newSide(ds: Localized, locale: Locale, sc: Scenario): { ctx: StageContext; pathway: PathwayDisplay } {
  const display: Display = {
    ...DISPLAY,
    showProgress: sc.on.includes("SHOW_PROGRESS"),
    showLate: sc.on.includes("SHOW_LATE"),
  };
  const ctx = stageContext(ds.data, locale, {
    display,
    asOfYear: sc.lastUpdated ? asOfYear(sc.lastUpdated) : undefined,
  });
  return {
    ctx,
    pathway: { showBarriers: sc.on.includes("SHOW_BARRIERS"), showStageExpected: sc.on.includes("SHOW_STAGE_EXPECTED") },
  };
}

const clone = <T>(v: T): T => structuredClone(v);

/**
 * The medicines, and variations of each: every number of stages done, every
 * current stage, every unfinished stage late, journeys that do and do not
 * end in a pending ("TBC") milestone, country surveys in each state, odd
 * country levels, no adoption list, a barrier, stages with nothing but a
 * status, unknown sources; one placeholder, and one medicine with no detail
 * at all. Ids are kept, so PROGRESS_KEPT still applies.
 */
export function variants(products: Product[]): { name: string; p: Product }[] {
  const out: { name: string; p: Product }[] = [];
  const add = (name: string, p: Product) => out.push({ name, p });
  for (const p of products) {
    add(p.id, clone(p));
    for (let k = 0; k <= p.stages.length; k++) {
      const v = clone(p);
      v.stages.forEach((st, j) => (st.status = j < k ? "done" : j === k ? "prog" : "idle"));
      v.currentStage = Math.min(k, v.stages.length - 1);
      add(`${p.id}, ${k} stages done`, v);
    }
    for (let cur = 0; cur < p.stages.length; cur++) {
      const v = clone(p);
      v.currentStage = cur;
      add(`${p.id}, current stage ${cur}`, v);
    }
    const late = clone(p);
    for (const s of [...late.stages, ...(late.detail.milestones || [])]) if (s.status !== "done") s.status = "late";
    add(`${p.id}, every unfinished step late`, late);

    const journeys: [string, Product["detail"]["journey"]][] = [
      ["no journey", undefined],
      ["journey dated to the end", [{ label: "A", year: 2012 }, { label: "B", year: 2024 }]],
      ["journey of one pending milestone", [{ label: "Only", year: "TBC" }]],
      ["journey all pending", [{ label: "A", year: "TBC" }, { label: "B", year: "TBC" }]],
      ["journey pending after this year", [{ label: "A", year: 2026 }, { label: "B", year: "TBC" }]],
      ["journey pending after 2019", [{ label: "A & <b>", year: 2019 }, { label: "Next", year: "TBC" }]],
    ];
    for (const [name, j] of journeys) {
      // each at every current stage, as the wait shows only at the current one
      for (const cur of [p.currentStage, 4, 5]) {
        const v = clone(p);
        v.currentStage = cur;
        if (j) v.detail.journey = clone(j);
        else delete v.detail.journey;
        add(`${p.id}, ${name}, current ${cur}`, v);
      }
    }

    const survey = (name: string, edit: (v: Product) => void) => {
      const v = clone(p);
      edit(v);
      add(`${p.id}, ${name}`, v);
    };
    const list = [
      { iso3: "AAA", level: "mft", sources: ["no-such-source"] },
      { iso3: "BBB", level: "toString" },
      { iso3: "CCC", level: "constructor", sources: [] },
      { iso3: "DDD", level: "none" },
      { iso3: "EEE", level: "registered" },
    ];
    survey("survey illustrative", (v) => (v.detail.countries = { status: "illustrative", list: clone(list) }));
    survey("survey draft", (v) => (v.detail.countries = { status: "draft & <unchecked>", list: clone(list) }));
    survey("survey with no status", (v) => (v.detail.countries = { list: [] }));
    survey("survey with no list", (v) => (v.detail.countries = { status: "verified" }));
    survey("survey with no list, illustrative", (v) => (v.detail.countries = { status: "illustrative" }));
    survey("no survey", (v) => delete v.detail.countries);
    survey("no adoption", (v) => delete v.detail.adoption);
    survey("empty adoption", (v) => (v.detail.adoption = []));
    survey("adoption with markup", (v) => (v.detail.adoption = ['"Quoted" & <b>bold</b>', "Second"]));
    survey("a barrier", (v) => (v.flag = "Barrier text & <markup>"));
    survey("bare stages", (v) => {
      v.stages = v.stages.map((s) => ({ status: s.status }));
    });
    survey("unknown and missing sources", (v) => {
      v.stages.forEach((s, j) => {
        s.sources = j % 2 ? ["no-such-source"] : [];
        if (j % 3 === 0) delete s.source;
        s.asOf = j % 2 ? "not a date" : "2026-02-29";
      });
    });
  }
  const placeholder = clone(products[0]);
  placeholder.placeholder = true;
  placeholder.name = "AAA placeholder";
  add("a placeholder", placeholder);
  // names equal but for case and accents: the A–Z order ignores both
  // (sensitivity "base"), so these keep their input order among their twins
  for (const [name, edit] of [
    ["lower case", (s: string) => s.toLowerCase()],
    ["accented", (s: string) => s.replace(/A/g, "Á").replace(/a/g, "á")],
  ] as const) {
    const v = clone(products[1]);
    v.name = edit(v.name);
    add(`${products[1].id}, name in ${name}`, v);
  }
  const noDetail: Partial<Product> = clone(products[0]);
  delete noDetail.detail;
  add(`${products[0].id}, no detail`, noDetail as Product);
  return out;
}

/** A call's result, or the name of what it threw: the page throws in places, and must still agree. */
export function attempt<T>(f: () => T): { value: T } | { threw: string } {
  try {
    return { value: f() };
  } catch (e) {
    return { threw: (e as Error).name };
  }
}
