// Golden test: the map section's new code (lib/map.ts, components/map/)
// against the static pages' own code (tests/golden-map/reference/, copied
// verbatim from en/, fr/ and pt/index.html by tests/golden-map/extract.mjs).
//
// Both run on the same input: localize() of the published dataset for the
// language, and the language's map files. The old code runs in node:vm
// against a fake DOM and a fake MapLibre that record what it does
// (tests/golden-map/old-page.ts). Then:
//
//   A. every medicine x every Location choice the pickers allow x every
//      combination of the Filters' boxes: the counts, lists and map layers;
//   B. random click sequences, the same clicks on both: after each one the
//      state, every part of the section the old code wrote (as markup
//      trees), the map's layers and camera, and now and then every tooltip.
//
// Nothing here reads the clock: no map function does.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MapSectionView } from "@/components/map/MapSection";
import { ListTipBody, MapTipBody } from "@/components/map/MapTooltip";
import { NO_ACTIONS, NO_TIPS } from "@/components/map/parts";
import type { MapText } from "@/components/map/text";
import { mapTextEn } from "./fixtures/text/map-text";
import { localize } from "@/lib/dataset";
import type { Locale } from "@/lib/locales";
import {
  DEFAULT_TOKENS,
  GROUPS,
  POLICY_LAYERS,
  REGIONS,
  STAGE_ROWS,
  WHO_REGION,
  availableGroups,
  cameraFit,
  closeCountry,
  countryOptions,
  detail,
  drawnIsos,
  featureLevels,
  fillColor,
  fillOpacity,
  filterTable,
  finder,
  groupCountries,
  initialState,
  listTip,
  listed,
  locationFilter,
  mapContext,
  mapInput,
  mapOptions,
  mapTip,
  openTab,
  policyLayers,
  policyName,
  policyOn,
  readMapColors,
  regionCountries,
  resetFilters,
  scope,
  selectCountry,
  selectProduct,
  selectionFilter,
  setAll,
  setCountry,
  setGroup,
  setRegion,
  setStage,
  stageCounts,
  stageOf,
  stepCountry,
  undrawnInPolicy,
  withDefaults,
  type MapContext,
  type MapState,
  type Region,
  type Shapes,
} from "@/lib/map";
import { mapCountries } from "@/lib/map-countries";
import { byId, canon, findAll, parseHtml, textOf, type HElement, type HNode } from "./golden-map/html";
import { FakeEl, oldMapData, runOldPage, type OldPage, type OldState } from "./golden-map/old-page";
import { deriveText } from "./golden-map/translate";

const FIXTURE = JSON.parse(readFileSync(new URL("./fixtures/dashboard.json", import.meta.url), "utf8"));
const SHAPES = JSON.parse(readFileSync(new URL("../public/launch-map/world-shapes.json", import.meta.url), "utf8")) as Shapes;
const URL_ = "https://example.org/v1/dashboard.json";
const LANGS: Locale[] = ["en", "fr", "pt"];
// The exhaustive and click tests take about 5 s each on a laptop, Vitest's
// default limit: without this they fail as timeouts on a slower run.
const SLOW = 120_000;
// what getComputedStyle reports to the old code; the new code reads the same
const token = withDefaults((n) => DEFAULT_TOKENS[n] ?? "");

// Cross-realm values (the vm's arrays) and Sets compare as plain JSON.
const plain = (v: unknown): unknown => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
const sorted = (a: readonly string[]) => [...a].sort();

// Where two values first differ, as a path, for a readable failure.
function firstDiff(a: unknown, b: unknown, path = ""): string {
  if (isDeepStrictEqual(a, b)) return "";
  if (a && b && typeof a === "object" && typeof b === "object") {
    const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])];
    for (const k of keys) {
      const d = firstDiff((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], `${path}/${k}`);
      if (d) return d;
    }
  }
  return `${path || "/"}\n      old: ${JSON.stringify(a)?.slice(0, 400)}\n      new: ${JSON.stringify(b)?.slice(0, 400)}`;
}

/** Counts comparisons; keeps the first few differences for the failure message. */
class Tally {
  n = 0;
  bad: string[] = [];
  eq(oldV: unknown, newV: unknown, what: string): void {
    this.n++;
    const a = plain(oldV), b = plain(newV);
    if (!isDeepStrictEqual(a, b) && this.bad.length < 8) this.bad.push(`${what} at ${firstDiff(a, b)}`);
  }
}
const totals: Record<string, number> = {};
// how often each kind of click ran, all languages: proof the sequences reach
// country pages, Previous/Next, search and the rest
const kinds: Record<string, number> = {};

// ---- one language's old page and new code, side by side -------------------------

interface Side {
  lang: Locale;
  old: OldPage;
  ctx: MapContext;
  text: MapText;
}

function setup(lang: Locale): Side {
  const ds = localize(FIXTURE, lang, URL_);
  const old = runOldPage(lang, ds, oldMapData(lang), DEFAULT_TOKENS);
  old.load();
  const ctx = mapContext(mapInput(ds, mapCountries(lang), lang));
  const text = lang === "en" ? mapTextEn : deriveText(lang).text;
  return { lang, old, ctx, text };
}

const toOld = (st: MapState): OldState => ({
  locRegion: st.region,
  locCountry: st.country,
  mftSel: st.selected,
  mftProductId: st.productId,
  detTab: st.tab,
  cameFrom: st.cameFrom,
  stageOff: sorted(st.stageOff),
  mftTick: sorted(st.ticked),
});
const oldState = (o: OldPage): OldState => {
  const s = o.state();
  return { locRegion: s.locRegion, locCountry: s.locCountry, mftSel: s.mftSel, mftProductId: s.mftProductId, detTab: s.detTab, cameFrom: s.cameFrom, stageOff: sorted(s.stageOff), mftTick: sorted(s.mftTick) };
};

/** Every Location choice the two pickers allow (a country without a WHO region keeps "All regions"). */
function locations(ctx: MapContext): { region: Region | ""; country: string }[] {
  const out: { region: Region | ""; country: string }[] = [{ region: "", country: "" }];
  for (const c of countryOptions(ctx, "")) if (!WHO_REGION[c.iso3]) out.push({ region: "", country: c.iso3 });
  for (const r of REGIONS) {
    out.push({ region: r, country: "" });
    for (const c of countryOptions(ctx, r)) out.push({ region: r, country: c.iso3 });
  }
  return out;
}

const subsets = <T,>(xs: readonly T[]): T[][] => xs.reduce<T[][]>((acc, x) => acc.concat(acc.map((s) => [...s, x])), [[]]);

// ---- the section as both sides draw it ----------------------------------------

const html = (nodes: HNode[]) => canon(nodes);
const oldHtml = (el: FakeEl) => canon(parseHtml(el.innerHTML));

function renderNew(side: Side, st: MapState, q: string): HNode[] {
  return parseHtml(
    renderToStaticMarkup(
      createElement(MapSectionView, {
        ctx: side.ctx, st, q, seq: 0, text: side.text, token, shapesUrl: "", workerUrl: "", actions: NO_ACTIONS, tips: NO_TIPS,
      }),
    ),
  );
}

const need = (nodes: HNode[], id: string): HElement => {
  const e = byId(nodes, id);
  if (!e) throw new Error(`the new section has no #${id}`);
  return e;
};
const isHidden = (e: HElement) => "hidden" in e.attrs;

/** Everything on the page the old code wrote, against the new markup. */
function compareView(side: Side, st: MapState, q: string, t: Tally, at: string, searched: boolean): void {
  const { old, ctx } = side;
  const tree = renderNew(side, st, q);
  if (searched) {
    // typing redraws the list only, on the old page as here
    t.eq(oldHtml(old.el("det-list")), html(need(tree, "det-list").children), `${at}: #det-list`);
    return;
  }
  // medicine tabs: built once, then aria-selected set on each
  const tabs = old.el("maptabs").querySelectorAll(".tab").map((b) => ({ id: b.dataset.id, sel: b.attrs["aria-selected"], name: b.textContent }));
  const newTabs = findAll(need(tree, "maptabs").children, (e) => e.tag === "button").map((b) => ({ id: b.attrs["data-id"], sel: b.attrs["aria-selected"], name: textOf(b.children) }));
  t.eq(tabs, newTabs, `${at}: medicine tabs`);
  // Filters
  t.eq(oldHtml(old.el("flt-table")), html(need(tree, "flt-table").children), `${at}: #flt-table`);
  t.eq(old.el("flt-all").indeterminate, filterTable(ctx, st).indeterminate, `${at}: #flt-all indeterminate`);
  const act = need(tree, "flt-act"), hint = need(tree, "mft-hint");
  t.eq({ hidden: old.el("flt-act").hidden, text: String(old.el("flt-act").textContent) }, { hidden: isHidden(act), text: textOf(act.children) }, `${at}: #flt-act`);
  t.eq({ hidden: old.el("mft-hint").hidden, text: String(old.el("mft-hint").textContent) }, { hidden: isHidden(hint), text: textOf(hint.children) }, `${at}: #mft-hint`);
  // Location
  for (const id of ["loc-region", "loc-country"]) {
    const sel = need(tree, id);
    const chosen = findAll(sel.children, (e) => e.tag === "option" && "selected" in e.attrs)[0];
    t.eq({ options: oldHtml(old.el(id)), value: old.el(id).value }, { options: html(sel.children), value: chosen ? chosen.attrs.value : "" }, `${at}: #${id}`);
  }
  // legend: dimmed rows, counts, the recommended-use table
  const rows = findAll(tree, (e) => e.tag === "tr" && "data-lvl" in e.attrs);
  t.eq(old.legendRows.map((r) => r.classes.has("dim")), rows.map((r) => (r.attrs.class || "").split(" ").includes("dim")), `${at}: legend rows dimmed`);
  for (const k of STAGE_ROWS) {
    const ct = need(tree, `mapct-${k}`);
    t.eq({ text: String(old.el(`mapct-${k}`).textContent), zero: old.el(`mapct-${k}`).classes.has("zero") }, { text: textOf(ct.children), zero: (ct.attrs.class || "").split(" ").includes("zero") }, `${at}: #mapct-${k}`);
  }
  const lg = need(tree, "mft-legend");
  t.eq(old.el("mft-legend").hidden, isHidden(lg), `${at}: #mft-legend hidden`);
  if (!isHidden(lg)) t.eq(oldHtml(old.el("mft-legend")), html(lg.children), `${at}: #mft-legend`);
  // Detail panel
  const panel = need(tree, "mft-panel");
  t.eq(old.el("mft-panel").hidden, isHidden(panel), `${at}: #mft-panel hidden`);
  t.eq(oldHtml(old.el("mft-panel")), html(panel.children), `${at}: #mft-panel`);
  // the message over the map
  const empty = need(tree, "map-empty");
  t.eq(old.el("map-empty").hidden, isHidden(empty), `${at}: #map-empty hidden`);
  if (!isHidden(empty)) t.eq(String(old.el("map-empty").textContent), textOf(empty.children), `${at}: #map-empty`);
  // the keyboard country list: each button's level and label
  const oldButtons = old.el("map-country-list").querySelectorAll("button").map((b) => [b.dataset.iso3, b.dataset.name, b.dataset.lvl, b.querySelector(".lvl-label")?.textContent]);
  const newButtons = findAll(need(tree, "map-country-list").children, (e) => e.tag === "button").map((b) => [
    b.attrs["data-iso3"], b.attrs["data-name"], b.attrs["data-lvl"], textOf(findAll(b.children, (e) => (e.attrs.class || "") === "lvl-label")[0]?.children ?? []),
  ]);
  t.eq(oldButtons, newButtons, `${at}: keyboard country list`);
}

/** The map's layers as the old code left them, against what lib/map.ts says. */
function compareMap(side: Side, st: MapState, t: Tally, at: string): void {
  const { old, ctx } = side;
  const m = old.map;
  const lv = featureLevels(ctx, st.productId);
  t.eq(ctx.shapes.map((s) => m.featureState[s.iso3] ?? null), ctx.shapes.map((s) => lv[s.iso3]), `${at}: fill levels`);
  t.eq(m.paint["country-fill"]["fill-color"], fillColor(readMapColors(token)), `${at}: fill colours`);
  t.eq(m.paint["country-fill"]["fill-opacity"], fillOpacity(st), `${at}: fill opacity`);
  t.eq([m.filter["sel-halo"], m.filter["sel-line"]], [selectionFilter(st), selectionFilter(st)], `${at}: selection outline`);
  t.eq([m.filter["country-fill"], m.filter["country-line"]], [locationFilter(ctx, st), locationFilter(ctx, st)], `${at}: location filter`);
  if (ctx.policy) {
    const pl = policyLayers(ctx, st);
    t.eq(POLICY_LAYERS.map((id) => m.layout[id].visibility), POLICY_LAYERS.map(() => (pl.visible ? "visible" : "none")), `${at}: policy borders shown`);
    if (pl.filters) t.eq(POLICY_LAYERS.map((id) => m.filter[id]), POLICY_LAYERS.map((id) => pl.filters![id]), `${at}: policy borders`);
  }
}

/** Every tooltip: each keyboard-list button, focused, and each shape hovered on the map. */
function compareTips(side: Side, st: MapState, t: Tally, at: string): void {
  const { old, ctx, text } = side;
  const tip = old.el("tip");
  const lv = featureLevels(ctx, st.productId);
  const buttons = old.el("map-country-list").querySelectorAll("button");
  buttons.forEach((b, i) => {
    b.dispatch("focus", {});
    const s = ctx.shapes[i];
    const mine = renderToStaticMarkup(createElement(ListTipBody, { tip: listTip(ctx, st, s, lv[s.iso3]), text }));
    t.eq(oldHtml(tip), html(parseHtml(mine)), `${at}: list tooltip ${s.iso3}`);
  });
  for (const s of ctx.shapes) {
    tip.style.display = "";
    old.map.fire("mousemove", "country-fill", { originalEvent: { target: old.map.canvas, clientX: 5, clientY: 5 }, features: [{ properties: { iso3: s.iso3 } }] });
    const mt = mapTip(ctx, st, s.iso3);
    if (!mt) t.eq(tip.style.display, "none", `${at}: no map tooltip on ${s.iso3}`);
    else t.eq(oldHtml(tip), html(parseHtml(renderToStaticMarkup(createElement(MapTipBody, { tip: mt, text })))), `${at}: map tooltip ${s.iso3}`);
  }
}

// ---- clicks, on both sides ----------------------------------------------------------

/** A seeded random source (mulberry32), so a failure can be replayed. */
function random(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = Math.imul(a ^ (a >>> 15), 1 | a);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
  return { next, pick: <T,>(xs: readonly T[]): T => xs[Math.floor(next() * xs.length)] };
}

const target = (dataset: Record<string, string>, attrs: Record<string, string> = {}, extra: Partial<FakeEl> = {}) => {
  const e = new FakeEl("button");
  Object.assign(e.dataset, dataset);
  Object.assign(e.attrs, attrs);
  Object.assign(e, extra);
  return { target: e };
};

interface Step {
  name: string;
  /** what the old page's handlers receive */
  old(o: OldPage): void;
  /** the same choice in lib/map.ts; null leaves the state as it is (typing) */
  next(st: MapState): MapState;
  q?: string;
  /** the Location filter moved: compare the camera */
  moved?: boolean;
}

/** The choices a reader has in a state, as the new code draws it. */
function choices(side: Side, st: MapState, r: ReturnType<typeof random>): Step[] {
  const { ctx } = side;
  const out: Step[] = [];
  const panelClick = (o: OldPage, ev: unknown) => o.el("mft-panel").dispatch("click", ev);
  const p = r.pick(ctx.products);
  out.push({ name: `tab ${p.id}`, old: (o) => o.el("maptabs").querySelectorAll(".tab").find((b) => b.dataset.id === p.id)!.click(), next: (s) => selectProduct(s, p.id) });
  const ft = filterTable(ctx, st);
  const sk = r.pick(STAGE_ROWS), on = st.stageOff.includes(sk);
  out.push({ name: `stage ${sk} ${on}`, old: (o) => o.el("filters").dispatch("change", target({ stage: sk }, {}, { checked: on, id: `flt-s-${sk}` })), next: (s) => setStage(s, sk, on) });
  const gs = (ft.groups || []).filter((g) => !g.off);
  if (gs.length) {
    const g = r.pick(gs), gon = !g.checked;
    out.push({ name: `group ${g.id} ${gon}`, old: (o) => o.el("filters").dispatch("change", target({ group: g.id }, {}, { checked: gon, id: `flt-g-${g.id}` })), next: (s) => setGroup(s, g.id, gon) });
  }
  const all = !ft.allChecked;
  out.push({ name: `all ${all}`, old: (o) => o.el("filters").dispatch("change", target({}, {}, { checked: all, id: "flt-all" })), next: (s) => setAll(ctx, s, all) });
  out.push({ name: "reset", old: (o) => o.el("flt-reset").click(), next: resetFilters });
  const reg = r.pick(["", ...REGIONS].filter((x) => x !== st.region)) as Region | "";
  out.push({ name: `region ${reg}`, moved: true, old: (o) => { o.el("loc-region").value = reg; o.el("loc-region").dispatch("change", {}); }, next: (s) => setRegion(ctx, s, reg) });
  const cs = ["", ...countryOptions(ctx, st.region).map((c) => c.iso3)].filter((x) => x !== st.country);
  const c = r.pick(cs);
  out.push({ name: `country ${c}`, moved: true, old: (o) => { o.el("loc-country").value = c; o.el("loc-country").dispatch("change", {}); }, next: (s) => setCountry(ctx, s, c) });
  const shape = r.pick(ctx.shapes);
  out.push({
    name: `map click ${shape.iso3}`,
    old: (o) => o.map.fire("click", "country-fill", { originalEvent: { target: o.map.canvas }, features: [{ properties: { iso3: shape.iso3 } }] }),
    next: (s) => (ctx.drawnName.has(shape.iso3) ? selectCountry(s, shape.iso3) : s),
  });
  const i = ctx.shapes.indexOf(shape);
  out.push({ name: `list click ${shape.iso3}`, old: (o) => o.el("map-country-list").querySelectorAll("button")[i].click(), next: (s) => selectCountry(s, shape.iso3) });

  const view = detail(ctx, st);
  if (view.kind === "tabs") {
    const tab = r.pick(["overview", "countries"] as const);
    out.push({ name: `detail tab ${tab}`, old: (o) => panelClick(o, target({ detTab: tab })), next: (s) => openTab(s, tab) });
    if (view.tab === "countries") {
      const f = finder(ctx, st, "");
      if (f.kind === "rows") {
        const row = r.pick(f.rows);
        out.push({ name: `row ${row.iso3}`, old: (o) => panelClick(o, target({ iso3: row.iso3 })), next: (s) => selectCountry(s, row.iso3) });
        const names = f.rows.map((x) => x.name);
        const nm = r.pick(names);
        for (const q of ["", "a", "AN", "ia", "zz", " " + nm.slice(0, 3).toUpperCase() + " ", nm.slice(1, 4)]) {
          out.push({ name: `search "${q}"`, q, old: (o) => o.el("mft-panel").dispatch("input", { target: { id: "det-q", value: q } }), next: (s) => s });
        }
      } else if (f.kind === "empty") {
        out.push({ name: "reset from the list", old: (o) => panelClick(o, target({}, { "data-reset": "" })), next: resetFilters });
      }
    }
  } else {
    const page = view.page;
    if (page.back) out.push({ name: "back", old: (o) => panelClick(o, target({}, { "data-back": "" })), next: closeCountry });
    const dir = r.pick([1, -1] as const);
    out.push({ name: `step ${dir}`, old: (o) => panelClick(o, target({ step: String(dir) })), next: (s) => stepCountry(ctx, s, dir) });
    const peers = page.access ? page.access.peers.slice(0, 24) : [];
    if (peers.length) {
      const x = r.pick(peers);
      out.push({ name: `chip ${x.iso3}`, old: (o) => panelClick(o, target({ iso3: x.iso3 })), next: (s) => selectCountry(s, x.iso3) });
    }
  }
  return out;
}

// ---- the tests ------------------------------------------------------------------------

describe("golden: the map section against the static pages' own code", () => {
  it("has reference files that match the static pages", () => {
    // fileURLToPath, not .pathname: "/C:/…" is no path to node on Windows
    execFileSync(process.execPath, [fileURLToPath(new URL("./golden-map/extract.mjs", import.meta.url)), "--check"], { stdio: "pipe" });
  });

  for (const lang of LANGS) {
    it(`reads the same countries, shapes and map options (${lang})`, () => {
      const side = setup(lang);
      const t = new Tally();
      const data = oldMapData(lang);
      t.eq(data.geo.features.map((f) => f.properties), side.ctx.shapes, "shape names");
      t.eq(Object.entries(data.map.countries).map(([iso3, c]) => [iso3, c.n]), [...side.ctx.drawnName], "tracked countries");
      t.eq(data.geo.features.length, SHAPES.features.length, "shape count");
      data.geo.features.forEach((f, i) => t.eq(f.geometry, SHAPES.features[i].geometry, `geometry of shape ${i} (${f.properties.iso3})`));
      const { container, style, ...oldRest } = side.old.map.options as unknown as { container: unknown; style: { sources: { world: Record<string, unknown> } } };
      const mine = mapOptions(readMapColors(token), token, "DATA", side.text.map);
      t.eq(container, "mapwrap-gl", "map container");
      t.eq({ ...oldRest, style: { ...style, sources: { world: { ...style.sources.world, data: "DATA" } } } }, mine, "map options");
      t.eq(oldState(side.old), toOld(initialState(side.ctx)), "the state the map opens in");
      t.eq(side.old.state().mapProduct, side.ctx.products.find((p) => p.id === initialState(side.ctx).productId)?.name, "the medicine it opens on");
      totals[`inputs ${lang}`] = t.n;
      expect(t.bad).toEqual([]);
    });

    it(`counts, lists and draws the same for every medicine, location and filter (${lang})`, () => {
      const side = setup(lang);
      const { old, ctx } = side;
      const t = new Tally();
      for (const r of ["", ...REGIONS]) {
        t.eq(old.fn.regionCountries(r), regionCountries(ctx, r), `regionCountries(${r})`);
        old.setState({ ...oldState(old), locRegion: r, locCountry: "" });
        old.fn.fillCountryList();
        const opts = countryOptions(ctx, r).map((c) => [c.iso3, c.name]);
        t.eq(parseHtml(old.el("loc-country").innerHTML).slice(1).map((n) => [(n as HElement).attrs.value, textOf((n as HElement).children)]), opts, `country picker for ${r || "all regions"}`);
      }
      const locs = locations(ctx);
      const offs = subsets(STAGE_ROWS), ticks = subsets(GROUPS);
      for (const p of ctx.products) {
        const base: MapState = { ...initialState(ctx), productId: p.id };
        old.setState(toOld(base));
        t.eq(old.fn.stageCounts(), (({ none, ...c }) => ({ ...c, none }))(stageCounts(ctx, p.id)), `stageCounts ${p.id}`);
        t.eq(old.fn.mftAvail(), availableGroups(ctx, p.id), `mftAvail ${p.id}`);
        t.eq(old.fn.drawnIsos(), drawnIsos(ctx), `drawnIsos ${p.id}`);
        for (const s of ctx.shapes) {
          const o = old.fn.mftStage(s.iso3);
          t.eq(o.lvl, stageOf(ctx, p.id, s.iso3), `mftStage ${p.id} ${s.iso3}`);
          t.eq(old.fn.mftName(s.iso3), policyName(ctx, s.iso3), `mftName ${s.iso3}`);
        }
        for (const loc of locs) {
          const st0: MapState = { ...base, ...loc };
          old.setState(toOld(st0));
          t.eq(old.fn.mftScope(), scope(ctx, st0), `scope ${p.id} ${loc.region}/${loc.country}`);
          t.eq(old.fn.mftUndrawn(), undrawnInPolicy(ctx, st0), `undrawn ${p.id} ${loc.region}/${loc.country}`);
          if (ctx.policy) t.eq(old.fn.mftCounts(), groupCountries(ctx, st0), `group counts ${p.id} ${loc.region}/${loc.country}`);
          old.map.fits.length = 0;
          old.fn.applyLocationFilter();
          t.eq([old.map.filter["country-fill"], old.map.filter["country-line"]], [locationFilter(ctx, st0), locationFilter(ctx, st0)], `location filter ${loc.region}/${loc.country}`);
          const fit = cameraFit(ctx, st0, SHAPES);
          t.eq(old.map.fits, fit ? [[fit.bounds, fit.maxZoom === undefined ? { padding: fit.padding } : { padding: fit.padding, maxZoom: fit.maxZoom }]] : [], `camera ${loc.region}/${loc.country}`);
          for (const off of offs) {
            for (const tick of ticks) {
              const st: MapState = { ...st0, stageOff: off, ticked: tick };
              old.setState(toOld(st));
              t.eq(old.fn.mftListed(), listed(ctx, st), `listed ${p.id} ${loc.region}/${loc.country} off=${off} tick=${tick}`);
              t.eq(old.state().mftOn, policyOn(ctx, st), `policy on ${p.id} off=${off} tick=${tick}`);
              old.fn.paintStageFilter();
              t.eq(old.map.paint["country-fill"]["fill-opacity"], fillOpacity(st), `fill opacity off=${off}`);
              if (ctx.policy) {
                old.fn.mftPaint();
                const pl = policyLayers(ctx, st);
                t.eq(old.map.layout["mft-halo"].visibility, pl.visible ? "visible" : "none", `policy borders shown ${p.id} tick=${tick}`);
                if (pl.filters) t.eq(POLICY_LAYERS.map((id) => old.map.filter[id]), POLICY_LAYERS.map((id) => pl.filters![id]), `policy borders ${p.id} ${loc.region}/${loc.country} tick=${tick}`);
              }
            }
          }
        }
      }
      totals[`exhaustive ${lang}`] = t.n;
      expect(t.bad).toEqual([]);
    }, SLOW);

    it(`answers the same clicks with the same section, map and tooltips (${lang})`, () => {
      const t = new Tally();
      const SEQUENCES = 16, STEPS = 30, TIPS_EVERY = 25;
      for (let seq = 0; seq < SEQUENCES; seq++) {
        const side = setup(lang); // a fresh page for every sequence
        const r = random(1000 * (LANGS.indexOf(lang) + 1) + seq);
        let st = initialState(side.ctx);
        compareView(side, st, "", t, `${lang} seq ${seq} start`, false);
        compareMap(side, st, t, `${lang} seq ${seq} start`);
        for (let n = 0; n < STEPS; n++) {
          const step = r.pick(choices(side, st, r));
          const at = `${lang} seq ${seq} step ${n} (${step.name})`;
          const kind = step.name.replace(/ ("[^"]*"|[A-Z]{3,5}|-?1|true|false)$/, "").replace(/ (true|false)$/, "").trim();
          kinds[kind] = (kinds[kind] || 0) + 1;
          const fits = side.old.map.fits.length;
          step.old(side.old);
          st = step.next(st);
          t.eq(oldState(side.old), toOld(st), `${at}: state`);
          compareView(side, st, step.q ?? "", t, at, step.q !== undefined);
          compareMap(side, st, t, at);
          if (step.moved) {
            const fit = cameraFit(side.ctx, st, SHAPES);
            const want = fit ? [[fit.bounds, fit.maxZoom === undefined ? { padding: fit.padding } : { padding: fit.padding, maxZoom: fit.maxZoom }]] : [];
            t.eq(side.old.map.fits.slice(fits), want, `${at}: camera`);
          }
          if ((seq * STEPS + n) % TIPS_EVERY === 0) compareTips(side, st, t, at);
          if (t.bad.length) break;
        }
        if (t.bad.length) break;
      }
      totals[`clicks ${lang}`] = t.n;
      expect(t.bad).toEqual([]);
    }, SLOW);
  }

  it("reports the number of comparisons", () => {
    const all = Object.values(totals).reduce((a, b) => a + b, 0);
    console.log(`golden-map: ${all} comparisons\n` + Object.entries(totals).map(([k, v]) => `  ${k}: ${v}`).join("\n"));
    console.log("golden-map: clicks by kind\n" + Object.entries(kinds).sort().map(([k, v]) => `  ${k}: ${v}`).join("\n"));
    expect(all).toBeGreaterThan(0);
  });
});

