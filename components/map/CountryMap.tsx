"use client";

// The map itself (old: #mapwrap and everything that drew on MapLibre), with
// its "no country data" message, zoom readout and keyboard country list.
//
// MapLibre runs only in the browser: it is imported inside an effect, so the
// server renders the empty frame and never touches `window`. Two static files
// come with it, from wherever the host serves them: the country shapes
// (public/launch-map/world-shapes.json) and MapLibre's worker
// (public/launch-map/maplibre-gl-csp-worker.js). Nothing else is loaded: the
// style has no tiles, fonts or sprites.
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import type { FilterSpecification, Map as MapLibreMap, MapLayerMouseEvent, MapOptions } from "maplibre-gl";
import {
  POLICY_LAYERS,
  cameraFit,
  emptyNotice,
  featureLevels,
  fillColor,
  fillOpacity,
  locationFilter,
  mapOptions,
  panFor,
  policyLayers,
  readMapColors,
  selectionFilter,
  withDefaults,
  zoomReadout,
  type MapContext,
  type MapState,
  type Shapes,
  type TokenReader,
} from "@/lib/map";
import { stageLabel, type MapActions, type MapTips } from "./parts";
import { fill, type MapText } from "./text";

type MapLibre = typeof import("maplibre-gl");

// MapLibre's CSP build, not its main file. The main file makes its web
// worker at run time from its own functions' source text, and a bundler that
// re-minifies it breaks that: in this app's production build only a corner
// of the map drew (the development build, not minified, drew it all). The
// CSP build loads the worker from a file instead, which no bundler touches,
// and so needs only `worker-src 'self'` in a content security policy, not
// `blob:`. Same version, same API.
//
// Its file is a UMD bundle. Depending on how the bundler reads that,
// import() hands back its exports, a `default` holding them, or nothing but
// the window.maplibregl global the bundle sets as a last resort. Take
// whichever has the Map class.
async function loadMapLibre(workerUrl: string): Promise<MapLibre> {
  // its shape depends on the bundler, so it is checked below, not trusted
  const mod = (await import("maplibre-gl/dist/maplibre-gl-csp.js")) as unknown as MapLibre & { default?: MapLibre };
  let ml: MapLibre | undefined;
  if (typeof mod.Map === "function") ml = mod;
  else if (mod.default && typeof mod.default.Map === "function") ml = mod.default;
  else {
    const g = (globalThis as { maplibregl?: MapLibre }).maplibregl;
    if (g && typeof g.Map === "function") ml = g;
  }
  if (!ml) throw new Error("maplibre-gl loaded without its Map class");
  // before the first map: the workers start with it
  ml.setWorkerUrl(workerUrl);
  return ml;
}

async function loadShapes(url: string): Promise<Shapes> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
  return (await res.json()) as Shapes;
}

// The page's colours, read where the map sits, so a stylesheet scoped under
// a root class (.launch-dashboard) is seen. The old page read <html>'s.
const cssTokens = (el: Element): TokenReader => withDefaults((name) => getComputedStyle(el).getPropertyValue(name).trim());

interface Props {
  ctx: MapContext;
  st: MapState;
  text: MapText;
  /** changes when the page's colours do (a theme switch); the canvas then repaints */
  token: TokenReader;
  /** where the browser fetches public/launch-map/world-shapes.json from */
  shapesUrl: string;
  /** where it fetches public/launch-map/maplibre-gl-csp-worker.js from */
  workerUrl: string;
  actions: MapActions;
  tips: MapTips;
}

export function CountryMap({ ctx, st, text, token, shapesUrl, workerUrl, actions, tips }: Props) {
  const gl = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const shapes = useRef<Shapes | null>(null);
  // the Location filter last applied; null until the first change, as the
  // map opens on its own view and the old page did not fit it on load
  const applied = useRef<string | null>(null);
  const [ready, setReady] = useState(false);
  const [zoom, setZoom] = useState(0);

  // MapLibre's handlers are attached once; they read the newest props here
  const latest = useRef({ ctx, actions, tips });
  useEffect(() => {
    latest.current = { ctx, actions, tips };
  });

  // Create the map once, remove it on unmount. In development React mounts
  // twice; `cancelled` stops the first, slower load from creating a map.
  const labels = text.map;
  useEffect(() => {
    let cancelled = false;
    let m: MapLibreMap | null = null;
    Promise.all([loadMapLibre(workerUrl), loadShapes(shapesUrl)])
      .then(([ml, geo]) => {
        const el = gl.current;
        if (cancelled || !el) return;
        const read = cssTokens(el);
        // mapOptions() is plain JSON; MapLibre's types are stricter about
        // literal layer types than a JSON object can be
        m = new ml.Map({ container: el, ...(mapOptions(readMapColors(read), read, geo, labels) as unknown as Omit<MapOptions, "container">) });
        map.current = m;
        shapes.current = geo;
        const mm = m;
        const canvas = mm.getCanvas();
        canvas.setAttribute("aria-label", labels.canvasLabel);
        mm.addControl(new ml.NavigationControl({ showCompass: false }), "top-right");
        // Arrow keys pan, and nothing else: MapLibre's own keys are off
        // (keyboard: false), Shift+arrows rotating included (D13, D19).
        canvas.tabIndex = 0;
        canvas.addEventListener("keydown", (ev) => {
          const d = panFor(ev.key);
          if (!d) return;
          mm.panBy(d);
          ev.preventDefault();
        });
        mm.on("zoom", () => setZoom(mm.getZoom()));
        // Hover and click on the canvas only: the zoom buttons sit above it.
        const onCanvas = (e: MapLayerMouseEvent) => !!e.originalEvent && e.originalEvent.target === canvas;
        mm.on("mousemove", "country-fill", (e) => {
          if (!onCanvas(e) || !e.features || !e.features.length) return;
          const iso3 = String(e.features[0].properties.iso3);
          if (!latest.current.ctx.drawnName.has(iso3)) {
            latest.current.tips.hide();
            canvas.style.cursor = "";
            return;
          }
          canvas.style.cursor = "pointer";
          latest.current.tips.showMap(iso3, { x: e.originalEvent.clientX, y: e.originalEvent.clientY });
        });
        mm.on("mouseleave", "country-fill", () => {
          latest.current.tips.hide();
          canvas.style.cursor = "";
        });
        mm.on("click", "country-fill", (e) => {
          if (!onCanvas(e) || !e.features || !e.features.length) return;
          const iso3 = String(e.features[0].properties.iso3);
          if (!latest.current.ctx.drawnName.has(iso3)) return;
          latest.current.actions.select(iso3);
        });
        // setFeatureState and setPaintProperty need the style loaded
        mm.on("load", () => {
          if (!cancelled) setReady(true);
        });
      })
      .catch((err: unknown) => {
        if (!cancelled) console.error("[LAUNCH] the map could not start:", err);
      });
    return () => {
      cancelled = true;
      if (m) m.remove();
      map.current = null;
      shapes.current = null;
      applied.current = null;
      setReady(false);
    };
  }, [shapesUrl, workerUrl, labels]);

  // Colours: on load (old: paintCountries), and again when the page's
  // colours change (old: repaintTheme, on a dark-mode or data-theme switch).
  useEffect(() => {
    const m = map.current, el = gl.current;
    if (!ready || !m || !el) return;
    const c = readMapColors(cssTokens(el));
    m.setPaintProperty("bg", "background-color", c.surface2);
    m.setPaintProperty("country-line", "line-color", c.border);
    m.setPaintProperty("country-fill", "fill-color", fillColor(c));
  }, [ready, token]);

  // Each shape's stage for the medicine (old: applyCountryLevels).
  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    const lv = featureLevels(ctx, st.productId);
    for (const s of ctx.shapes) m.setFeatureState({ source: "world", id: s.iso3 }, { level: lv[s.iso3] });
  }, [ready, ctx, st.productId]);

  // Faded stages, the open country's outline and the policy borders
  // (old: paintStageFilter, paintSelection, mftPaint).
  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    m.setPaintProperty("country-fill", "fill-opacity", fillOpacity(st));
    if (m.getLayer("sel-line")) {
      const f = selectionFilter(st) as FilterSpecification;
      m.setFilter("sel-halo", f);
      m.setFilter("sel-line", f);
    }
    if (ctx.policy && m.getLayer("mft-halo")) {
      const pl = policyLayers(ctx, st);
      for (const id of POLICY_LAYERS) m.setLayoutProperty(id, "visibility", pl.visible ? "visible" : "none");
      if (pl.filters) for (const id of POLICY_LAYERS) m.setFilter(id, pl.filters[id] as FilterSpecification);
    }
  }, [ready, ctx, st]);

  // The Location filter: hide everything outside it and frame it
  // (old: applyLocationFilter). Only on a change: the map opens on its own view.
  const { region, country } = st;
  useEffect(() => {
    const m = map.current, geo = shapes.current;
    if (!ready || !m || !geo) return;
    const key = region + "|" + country;
    const last = applied.current ?? "|";
    applied.current = key;
    if (key === last) return;
    const loc = { ...st, region, country };
    const f = locationFilter(ctx, loc) as FilterSpecification | null;
    m.setFilter("country-fill", f);
    m.setFilter("country-line", f);
    const fit = cameraFit(ctx, loc, geo);
    if (fit) m.fitBounds(fit.bounds, fit.maxZoom === undefined ? { padding: fit.padding } : { padding: fit.padding, maxZoom: fit.maxZoom });
    // `st` is read for its location only, which region and country cover:
    // a filter tick must not move the camera
  }, [ready, ctx, region, country]);

  const levels = featureLevels(ctx, st.productId);
  const empty = emptyNotice(ctx, st.productId);
  const zr = zoomReadout(zoom);
  return (
    <div className="mapwrap" id="mapwrap">
      {/* MapLibre fills this one; React leaves its children alone */}
      <div id="mapwrap-gl" ref={gl} />
      <div className="map-empty" id="map-empty" hidden={!empty}>
        {empty && fill(empty.kind === "pipeline" ? text.emptyPipeline : text.emptyNoData, { name: empty.name })}
      </div>
      <span className="map-zoom-lvl" id="mz-lvl" aria-live="polite" hidden={zr.hidden}>
        {zr.text}
      </span>
      {/* A canvas has no element per country to tab to; this list stands in
          for them (DEV-13 D21), with the same tooltip. tabIndex -1 as on the
          old page, which keeps it out of the tab order. */}
      <ul className="map-country-list" id="map-country-list" aria-label={labels.listLabel}>
        {ctx.shapes.map((s, i) => {
          const lvl = levels[s.iso3];
          return (
            <li key={i}>
              <button
                type="button"
                tabIndex={-1}
                data-iso3={s.iso3}
                data-name={s.name}
                data-lvl={lvl || ""}
                onMouseEnter={(e) => tips.showList(s, lvl, { x: e.clientX, y: e.clientY })}
                onMouseMove={(e) => tips.showList(s, lvl, { x: e.clientX, y: e.clientY })}
                onFocus={(e) => tips.showList(s, lvl, { el: e.currentTarget })}
                onMouseLeave={tips.hide}
                onBlur={tips.hide}
                onClick={() => actions.select(s.iso3)}
              >
                {s.name} — <span className="lvl-label">{stageLabel(text, lvl)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
