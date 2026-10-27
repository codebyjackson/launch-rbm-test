"use client";

// The country access map section (old: #mapsec): medicine tabs, filters and
// location on the left, the map and its legends in the middle, the Detail
// panel on the right.
//
// MapSection holds the reader's choices (lib/map.ts MapState) and the page's
// colours; MapSectionView draws them and keeps nothing, so a test can render
// it for any state. Same ids, classes and structure as the static page, so
// its stylesheet applies.
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import {
  DEFAULT_TOKENS,
  closeCountry,
  initialState,
  listTip,
  mapContext,
  mapTip,
  openTab,
  resetFilters,
  selectCountry,
  selectProduct,
  setAll,
  setCountry,
  setGroup,
  setRegion,
  setStage,
  stepCountry,
  withDefaults,
  type MapContext,
  type MapInput,
  type MapState,
  type TokenReader,
} from "@/lib/map";
import { CountryMap } from "./CountryMap";
import { CountryPanel } from "./CountryPanel";
import { MapFilters } from "./MapFilters";
import { MapLegend } from "./MapLegend";
import { MapLocation } from "./MapLocation";
import { MapTabs } from "./MapTabs";
import { ListTipBody, MapTipBody, MapTooltip, type TooltipHandle } from "./MapTooltip";
import type { MapActions, MapTips } from "./parts";
import type { MapText } from "./text";

export interface MapSectionProps {
  /** lib/map.ts mapInput(): one language of the dataset, cut down to what the map reads */
  input: MapInput;
  text: MapText;
  /** where the browser fetches public/launch-map/world-shapes.json from */
  shapesUrl: string;
  /** where it fetches public/launch-map/maplibre-gl-worker.mjs from */
  workerUrl: string;
}

// every colour the section reads, the old fallbacks (--map1..3) included
const TOKEN_NAMES = [...Object.keys(DEFAULT_TOKENS), "--map1", "--map2", "--map3"];

export function MapSection({ input, text, shapesUrl, workerUrl }: MapSectionProps) {
  const ctx = useMemo(() => mapContext(input), [input]);
  const [st, setSt] = useState<MapState>(() => initialState(ctx));
  const [q, setQ] = useState("");
  const [seq, setSeq] = useState(0);
  const [tokens, setTokens] = useState<Record<string, string>>({});
  const root = useRef<HTMLElement>(null);
  const tip = useRef<TooltipHandle>(null);
  const token = useMemo(() => withDefaults((n) => tokens[n] || ""), [tokens]);

  // Every choice but typing in the search box also empties that box: the
  // old page rebuilt the Detail panel, box included. Filter changes and
  // Reset also hide the tooltip, as they did there.
  const update = useCallback((f: (s: MapState) => MapState, hideTip = false) => {
    setSt(f);
    setQ("");
    setSeq((n) => n + 1);
    if (hideTip) tip.current?.hide();
  }, []);
  const actions = useMemo<MapActions>(
    () => ({
      product: (id) => update((s) => selectProduct(s, id)),
      stage: (k, on) => update((s) => setStage(s, k, on), true),
      group: (g, on) => update((s) => setGroup(s, g, on), true),
      all: (on) => update((s) => setAll(ctx, s, on), true),
      reset: () => update(resetFilters, true),
      region: (r) => update((s) => setRegion(ctx, s, r)),
      country: (c) => update((s) => setCountry(ctx, s, c)),
      tab: (t) => update((s) => openTab(s, t)),
      select: (iso3) => update((s) => selectCountry(s, iso3)),
      back: () => update(closeCountry),
      step: (d) => update((s) => stepCountry(ctx, s, d)),
      search: (v) => setQ(v),
    }),
    [ctx, update],
  );

  // A tooltip says what is true when it opens.
  const now = useRef(st);
  useEffect(() => {
    now.current = st;
  });
  const tips = useMemo<MapTips>(
    () => ({
      showMap: (iso3, at) => {
        const t = mapTip(ctx, now.current, iso3);
        if (t) tip.current?.show(<MapTipBody tip={t} text={text} />, at);
        else tip.current?.hide();
      },
      showList: (shape, level, at) => tip.current?.show(<ListTipBody tip={listTip(ctx, now.current, shape, level)} text={text} />, at),
      hide: () => tip.current?.hide(),
    }),
    [ctx, text],
  );

  // The page's colours: read once in the page, and again when the theme
  // changes (old: repaintTheme's listeners). Today's CSS is light only, so
  // the listeners are insurance for a theme switch coming back.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const read = () => {
      const cs = getComputedStyle(el);
      const next: Record<string, string> = {};
      for (const n of TOKEN_NAMES) next[n] = cs.getPropertyValue(n).trim();
      setTokens((old) => (TOKEN_NAMES.every((n) => old[n] === next[n]) ? old : next));
    };
    read();
    const mq = matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", read);
    const mo = new MutationObserver(read);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => {
      mq.removeEventListener("change", read);
      mo.disconnect();
    };
  }, []);

  // Both rails as tall as the map column between them; CSS cannot match one
  // particular sibling's height. Not when the dock stacks into one column
  // (read from the grid itself, as the old page did).
  useEffect(() => {
    const el = root.current;
    const center = el && el.querySelector<HTMLElement>(".map-dock-center");
    const dock = center && center.parentElement;
    if (!el || !center || !dock || !window.ResizeObserver) return;
    const left = el.querySelector<HTMLElement>(".map-dock-left");
    const right = el.querySelector<HTMLElement>(".map-dock-right");
    const ro = new ResizeObserver(() => {
      const stacked = getComputedStyle(dock).gridTemplateColumns.trim().split(/\s+/).length < 2;
      const h = stacked ? "" : center.offsetHeight + "px";
      if (left) left.style.height = h;
      if (right) right.style.height = h;
    });
    ro.observe(center);
    return () => ro.disconnect();
  }, []);

  if (!ctx.products.length) return null;
  return (
    <>
      <MapSectionView
        rootRef={root}
        ctx={ctx}
        st={st}
        q={q}
        seq={seq}
        text={text}
        token={token}
        shapesUrl={shapesUrl}
        workerUrl={workerUrl}
        actions={actions}
        tips={tips}
      />
      <MapTooltip ref={tip} />
    </>
  );
}

export interface MapSectionViewProps {
  rootRef?: RefObject<HTMLElement | null>;
  ctx: MapContext;
  st: MapState;
  q: string;
  seq: number;
  text: MapText;
  token: TokenReader;
  shapesUrl: string;
  workerUrl: string;
  actions: MapActions;
  tips: MapTips;
}

export function MapSectionView({ rootRef, ctx, st, q, seq, text, token, shapesUrl, workerUrl, actions, tips }: MapSectionViewProps) {
  return (
    <section className="viz" id="mapsec" ref={rootRef}>
      <h2>{text.heading}</h2>
      <p className="viznote" id="mapnote">
        {text.note}
      </p>
      <div className="map-dock">
        <aside className="map-dock-rail map-dock-left">
          <div className="dock-section">
            <h3>{text.medicine}</h3>
            <MapTabs ctx={ctx} st={st} text={text} actions={actions} />
          </div>
          <MapFilters ctx={ctx} st={st} text={text} token={token} actions={actions} />
          <MapLocation ctx={ctx} st={st} text={text} actions={actions} />
        </aside>
        <div className="map-dock-center">
          <CountryMap ctx={ctx} st={st} text={text} token={token} shapesUrl={shapesUrl} workerUrl={workerUrl} actions={actions} tips={tips} />
          <p className="map-hint" id="map-hint">
            {text.mapHint}
          </p>
          <MapLegend ctx={ctx} st={st} text={text} token={token} />
        </div>
        <aside className="map-dock-rail map-dock-right">
          <div className="dock-section dock-detail">
            <h3>{text.detail}</h3>
            <CountryPanel ctx={ctx} st={st} q={q} seq={seq} text={text} token={token} actions={actions} />
          </div>
        </aside>
      </div>
    </section>
  );
}
