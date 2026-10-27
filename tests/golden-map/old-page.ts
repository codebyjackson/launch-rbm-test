// Runs the static page's own map code (tests/golden-map/reference/*.js) in
// node:vm, against a fake DOM and a fake MapLibre that only record what the
// code does to them. Just enough of each for the map section; anything else
// it touched would throw, and the test would say so.
import { existsSync, readFileSync } from "node:fs";
import vm from "node:vm";
import { isElement, parseHtml, textOf, type HElement } from "./html";

type Listener = (ev: unknown) => void;
const ROOT = new URL("../../", import.meta.url);

/** A DOM element, as far as the map code uses one. */
export class FakeEl {
  id: string;
  tagName: string;
  lang = "";
  dataset: Record<string, string> = {};
  attrs: Record<string, string> = {};
  hidden = false;
  value = "";
  checked = false;
  indeterminate = false;
  scrollTop = 0;
  tabIndex = 0;
  offsetWidth = 120;
  offsetHeight = 40;
  style: Record<string, string> = {};
  textContent = "";
  classes = new Set<string>();
  kids: FakeEl[] = [];
  listeners: Record<string, Listener[]> = {};
  private html = "";
  classList = {
    toggle: (c: string, force?: boolean) => {
      const on = force === undefined ? !this.classes.has(c) : force;
      if (on) this.classes.add(c);
      else this.classes.delete(c);
      return on;
    },
    add: (c: string) => void this.classes.add(c),
    remove: (c: string) => void this.classes.delete(c),
    contains: (c: string) => this.classes.has(c),
  };

  constructor(tag: string, id = "") {
    this.tagName = tag;
    this.id = id;
  }
  get innerHTML(): string {
    return this.html;
  }
  set innerHTML(h: string) {
    this.html = h;
    this.kids = parseHtml(h).filter(isElement).map(fromNode);
  }
  addEventListener(type: string, fn: Listener): void {
    (this.listeners[type] ||= []).push(fn);
  }
  dispatch(type: string, ev: unknown): void {
    for (const fn of this.listeners[type] || []) fn(ev);
  }
  click(): void {
    this.dispatch("click", { target: this });
  }
  setAttribute(k: string, v: unknown): void {
    this.attrs[k] = String(v);
  }
  getAttribute(k: string): string | null {
    return k in this.attrs ? this.attrs[k] : null;
  }
  hasAttribute(k: string): boolean {
    return k in this.attrs;
  }
  /** "tag" or ".class" only */
  querySelectorAll(sel: string): FakeEl[] {
    const all: FakeEl[] = [];
    const walk = (e: FakeEl) => e.kids.forEach((k) => (all.push(k), walk(k)));
    walk(this);
    return sel.startsWith(".") ? all.filter((e) => e.classes.has(sel.slice(1))) : all.filter((e) => e.tagName === sel);
  }
  querySelector(sel: string): FakeEl | null {
    return this.querySelectorAll(sel)[0] ?? null;
  }
  contains(): boolean {
    return false;
  }
  focus(): void {}
  closest(): FakeEl {
    return this;
  }
  getBoundingClientRect() {
    return { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 };
  }
}

const camel = (s: string) => s.replace(/-(\w)/g, (_, c: string) => c.toUpperCase());

function fromNode(n: HElement): FakeEl {
  const el = new FakeEl(n.tag, n.attrs.id ?? "");
  el.attrs = { ...n.attrs };
  for (const [k, v] of Object.entries(n.attrs)) if (k.startsWith("data-")) el.dataset[camel(k.slice(5))] = v;
  for (const c of (n.attrs.class ?? "").split(/\s+/)) if (c) el.classes.add(c);
  el.kids = n.children.filter(isElement).map(fromNode);
  el.textContent = textOf(n.children);
  return el;
}

interface Handler {
  type: string;
  layer: string | null;
  fn: Listener;
}
interface StyleLayer {
  id: string;
  paint?: Record<string, unknown>;
  layout?: Record<string, unknown>;
  filter?: unknown;
}

/** MapLibre's Map, recording the state the code leaves it in. */
export class FakeMap {
  options: { style: { layers: StyleLayer[] } } & Record<string, unknown>;
  handlers: Handler[] = [];
  canvas = new FakeEl("canvas");
  loaded = false;
  zoom = 0;
  layerIds: Set<string>;
  featureState: Record<string, unknown> = {};
  paint: Record<string, Record<string, unknown>> = {};
  layout: Record<string, Record<string, unknown>> = {};
  filter: Record<string, unknown> = {};
  fits: unknown[][] = [];

  constructor(options: FakeMap["options"]) {
    this.options = options;
    this.layerIds = new Set(options.style.layers.map((l) => l.id));
    for (const l of options.style.layers) {
      this.paint[l.id] = { ...(l.paint || {}) };
      this.layout[l.id] = { ...(l.layout || {}) };
      this.filter[l.id] = l.filter ?? null;
    }
  }
  getCanvas(): FakeEl {
    return this.canvas;
  }
  addControl(): void {}
  on(type: string, a: string | Listener, b?: Listener): void {
    if (typeof a === "function") this.handlers.push({ type, layer: null, fn: a });
    else if (b) this.handlers.push({ type, layer: a, fn: b });
  }
  fire(type: string, layer: string | null, ev: unknown): void {
    for (const h of this.handlers) if (h.type === type && h.layer === layer) h.fn(ev);
  }
  getZoom(): number {
    return this.zoom;
  }
  isStyleLoaded(): boolean {
    return this.loaded;
  }
  getLayer(id: string): { id: string } | undefined {
    return this.loaded && this.layerIds.has(id) ? { id } : undefined;
  }
  setPaintProperty(l: string, p: string, v: unknown): void {
    this.paint[l][p] = v;
  }
  setLayoutProperty(l: string, p: string, v: unknown): void {
    this.layout[l][p] = v;
  }
  setFilter(l: string, f: unknown): void {
    this.filter[l] = f;
  }
  setFeatureState(f: { id: string }, s: { level: unknown }): void {
    this.featureState[f.id] = s.level;
  }
  fitBounds(b: unknown, o: unknown): void {
    this.fits.push([b, o]);
  }
  panBy(): void {}
}

/** The block's private state, as the extractor's hook reads and sets it. */
export interface OldState {
  locRegion: string;
  locCountry: string;
  mftOn?: boolean;
  mftSel: string | null;
  mftProductId: string | null;
  detTab: string;
  cameFrom: string;
  mapProduct?: string;
  mapStatus?: string;
  stageOff: string[];
  mftTick: string[];
}

export interface OldFns {
  regionCountries(region: string): string[];
  mftScope(): string[];
  mftStage(iso3: string): { lvl: string; label: string };
  mftName(iso3: string): string;
  mftCounts(): Record<string, string[]>;
  mftUndrawn(): string[];
  mftAvail(): Record<string, number>;
  mftSync(): void;
  stageCounts(): Record<string, number>;
  mftMatches(iso3: string): boolean;
  mftListed(): string[];
  drawnIsos(): string[];
  bboxOfFeatures(feats: unknown[]): unknown;
  fillCountryList(): void;
  applyLocationFilter(): void;
  mftPaint(): void;
  paintStageFilter(): void;
  paintSelection(): void;
  mftRender(): void;
}

export interface OldPage {
  map: FakeMap;
  el(id: string): FakeEl;
  legendRows: FakeEl[];
  countryListEls: Record<string, FakeEl>;
  state(): OldState;
  setState(s: OldState): void;
  fn: OldFns;
}

/** window.LAUNCH_MAP and window.LAUNCH_MAP_GEO for one language. */
export interface OldMapData {
  map: { countries: Record<string, { n: string }> };
  geo: { type: "FeatureCollection"; features: { properties: { iso3: string; name: string }; geometry: unknown }[] };
}

// The files set `window.NAME = {json};` after two comment lines.
function readGlobal(file: URL, name: string): unknown {
  const s = readFileSync(file, "utf8");
  const at = s.indexOf(`window.${name} = `);
  return JSON.parse(s.slice(at + `window.${name} = `.length).trim().replace(/;$/, ""));
}

/**
 * The static page's map data. Read from the page's own files while they are
 * on this branch; after that, rebuilt from the assets the port made of them
 * (scripts/build-map-assets.mjs checked that the two agree).
 */
export function oldMapData(lang: "en" | "fr" | "pt"): OldMapData {
  const map = new URL(`${lang}/data/world-map.js`, ROOT), geo = new URL(`${lang}/data/world-map-geo.js`, ROOT);
  if (existsSync(map) && existsSync(geo)) {
    return { map: readGlobal(map, "LAUNCH_MAP") as OldMapData["map"], geo: readGlobal(geo, "LAUNCH_MAP_GEO") as OldMapData["geo"] };
  }
  const shapes = JSON.parse(readFileSync(new URL("public/launch-map/world-shapes.json", ROOT), "utf8")) as {
    features: { properties: { iso3: string }; geometry: unknown }[];
  };
  const names = JSON.parse(readFileSync(new URL("lib/map-countries.json", ROOT), "utf8")) as {
    drawn: string[];
    names: Record<string, string[]>;
  };
  const features = shapes.features.map((f, i) => ({ properties: { iso3: f.properties.iso3, name: names.names[lang][i] }, geometry: f.geometry }));
  const byIso: Record<string, string> = {};
  for (const f of features) byIso[f.properties.iso3] = f.properties.name;
  return {
    map: { countries: Object.fromEntries(names.drawn.map((iso3) => [iso3, { n: byIso[iso3] }])) },
    geo: { type: "FeatureCollection", features },
  };
}

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/**
 * Runs one language's reference file. `globals` are the four the page's
 * loader sets (lib/dataset.ts localize()), `tokens` the CSS custom
 * properties getComputedStyle reports. The map is created but not loaded:
 * call `load()` to fire MapLibre's load event, as the browser would.
 */
export function runOldPage(
  lang: "en" | "fr" | "pt",
  globals: { data: unknown; sources: unknown; treatmentPolicy: unknown; dataset: unknown },
  mapData: OldMapData,
  tokens: Readonly<Record<string, string>>,
): OldPage & { load(): void } {
  const code = readFileSync(new URL(`tests/golden-map/reference/${lang}.js`, ROOT), "utf8");
  const els = new Map<string, FakeEl>();
  const el = (id: string): FakeEl => {
    let e = els.get(id);
    if (!e) els.set(id, (e = new FakeEl("div", id)));
    return e;
  };
  const legendRows = ["registered", "guidelines", "mft", "none"].map((k) => {
    const r = new FakeEl("tr");
    r.dataset.lvl = k;
    return r;
  });
  const documentElement = new FakeEl("html");
  documentElement.lang = lang === "pt" ? "pt-PT" : lang; // the pages' <html lang>
  const document = {
    documentElement,
    activeElement: null,
    getElementById: el,
    querySelector: () => null,
    querySelectorAll: (sel: string) => (sel === ".map-legend tr[data-lvl]" ? legendRows : []),
  };
  let made: FakeMap | null = null;
  class MapCtor extends FakeMap {
    constructor(o: FakeMap["options"]) {
      super(o);
      made = this;
    }
  }
  const sandbox: Record<string, unknown> = {
    document,
    getComputedStyle: () => ({ getPropertyValue: (n: string) => tokens[n] ?? "", gridTemplateColumns: "" }),
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    MutationObserver: class {
      observe() {}
    },
    maplibregl: { Map: MapCtor, NavigationControl: class {} },
    innerWidth: 1280,
    console,
    LAUNCH_DATA: clone(globals.data),
    LAUNCH_SOURCES: clone(globals.sources),
    LAUNCH_TREATMENT_POLICY: clone(globals.treatmentPolicy),
    LAUNCH_DATASET: clone(globals.dataset),
    LAUNCH_MAP: mapData.map,
    LAUNCH_MAP_GEO: mapData.geo,
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: `reference/${lang}.js` });
  const hook = sandbox.__oldMap as Omit<OldPage, "el" | "legendRows" | "map"> | undefined;
  if (!hook || !made) throw new Error(`reference/${lang}.js did not build the map section`);
  const map: FakeMap = made;
  return {
    ...hook,
    map,
    el,
    legendRows,
    load() {
      map.loaded = true;
      map.fire("load", null, {});
    },
  };
}
