// Runs one language's frozen pathway code (reference/{en,fr,pt}.js, from
// extract.mjs) in its own node:vm context, given only what the page gave it:
// the globals from localize(), its icon set, its <html lang>, three elements
// to write into, and a showTipAt that records what it was asked to show.
// Anything else the code reached for would throw there.
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { expect } from "vitest";
import type { Localized, Product } from "@/lib/dataset";
import { LOCALES, type Locale } from "@/lib/locales";
import type { Switch } from "./inputs";
import { PAGE_LANG } from "@/lib/frame";

const REFERENCE = Object.fromEntries(
  LOCALES.map((l) => [l, readFileSync(new URL(`./reference/${l}.js`, import.meta.url), "utf8")]),
) as Record<Locale, string>;
const ICONS = readFileSync(new URL("./reference/icons-solid.js", import.meta.url), "utf8");

// The page's <html lang>, as the extractor recorded it.
const htmlLang = (l: Locale) => {
  const m = REFERENCE[l].match(/^\/\/ html-lang: (.+)$/m);
  if (!m) throw new Error(`reference/${l}.js has no html-lang line`);
  // The language the new code declares (lib/frame.ts PAGE_LANG), not the page's
  // own pt-PT: Portuguese is Brazilian since 28 Oct 2026, and old and new must
  // format dates and numbers alike for the comparison to test the logic.
  return PAGE_LANG[l];
};

/** #pathway, #gatewrap and #tip as the page's HTML has them before its script runs. */
export function staticMarkup(l: Locale): { pathway: string; gatewrap: string; tip: string } {
  const all = [...REFERENCE[l].matchAll(/^\/\/ static-markup: (.+)$/gm)].map((m) => m[1]);
  const find = (re: RegExp) => {
    const s = all.find((x) => re.test(x));
    if (!s) throw new Error(`reference/${l}.js: no static markup for ${re}`);
    return s;
  };
  return { pathway: find(/id="pathway"/), gatewrap: find(/id="gatewrap"/), tip: find(/id="tip"/) };
}

/** An element the page writes into, with just what its code touches. */
export interface FakeElement {
  innerHTML: string;
  hidden: boolean;
  attributes: { [name: string]: string };
  setAttribute(name: string, value: unknown): void;
  querySelectorAll(selector: string): never[];
  classList: { add(): void; remove(): void; toggle(): void };
  style: { setProperty(): void };
}

const fakeElement = (): FakeElement => ({
  innerHTML: "",
  hidden: true,
  attributes: {},
  setAttribute(name, value) {
    this.attributes[name] = String(value);
  },
  // highlightStep lights the board's columns; there is no board here
  querySelectorAll: () => [],
  classList: { add() {}, remove() {}, toggle() {} },
  style: { setProperty() {} },
});

// Every top-level name the tests read from a reference.
const OLD_NAMES = [
  "STAGES", "STAGE_COLUMNS", "LABEL", "SHOW_PROGRESS", "SHOW_BARRIERS", "SHOW_LATE", "SHOW_STAGE_EXPECTED",
  "statusShown", "JI", "stageIconImg", "tracked", "esc", "colIndexOf", "stepNo", "lateAt", "nowYear",
  "stalledSince", "pathExpHtml", "pathNodeHtml", "stepColumnHtml", "countryAccessKv", "gatePanelHTML",
  "openGatePanel", "closeGate", "showStageTip",
];

type Fn = (...args: unknown[]) => unknown;

/**
 * One language's page, loaded with these products and switches. The data is
 * cloned first: the page rewrites "late" in place.
 */
export function oldPage(locale: Locale, on: Switch[], ds: Localized, products: Product[], lastUpdated?: string) {
  let src = REFERENCE[locale];
  for (const name of on) {
    const off = `const ${name} = false;`;
    expect(src.split(off).length - 1, `reference/${locale}.js: ${off}`).toBe(1);
    src = src.replace(off, `const ${name} = true;`);
  }
  const data = structuredClone(ds.data);
  data.products = structuredClone(products);
  if (lastUpdated) data.meta.lastUpdated = lastUpdated;
  const elements = new Map<string, FakeElement>();
  const element = (id: string) => {
    if (!elements.has(id)) elements.set(id, fakeElement());
    return elements.get(id)!;
  };
  let lastTip: string | null = null;
  const window = {
    LAUNCH_DATA: data,
    LAUNCH_SOURCES: structuredClone(ds.sources),
    LAUNCH_TREATMENT_POLICY: ds.treatmentPolicy,
    LAUNCH_DATASET: ds.dataset,
  } as { [name: string]: unknown };
  const ctx = createContext({
    window,
    document: { documentElement: { lang: htmlLang(locale) }, getElementById: element },
    showTipAt: (_el: unknown, html: string) => {
      lastTip = html;
    },
  });
  runInContext(ICONS, ctx, { filename: "tests/golden-pathway/reference/icons-solid.js" });
  runInContext(src, ctx, { filename: `tests/golden-pathway/reference/${locale}.js` });
  const o = runInContext(`({ ${OLD_NAMES.join(", ")} })`, ctx) as Record<string, unknown>;
  return {
    fn: (name: string) => o[name] as Fn,
    value: (name: string) => o[name],
    element,
    /** what showStageTip last passed to showTipAt */
    lastTip: () => lastTip,
    /** the page's window, to swap LAUNCH_SOURCES for one call */
    window,
  };
}
