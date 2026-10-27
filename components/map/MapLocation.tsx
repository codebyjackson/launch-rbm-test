"use client";

// The left rail's Location: a WHO region, then a country or area in it
// (old: fillRegionList, fillCountryList and their change handlers).
import { REGIONS, countryOptions, type MapContext, type MapState, type Region } from "@/lib/map";
import type { MapActions } from "./parts";
import type { MapText } from "./text";

export function MapLocation({ ctx, st, text, actions }: { ctx: MapContext; st: MapState; text: MapText; actions: MapActions }) {
  return (
    <div className="dock-section" id="loc-controls">
      <h3>{text.location}</h3>
      <label className="res-pick">
        {text.region}{" "}
        <select
          id="loc-region"
          aria-label={text.regionLabel}
          value={st.region}
          onChange={(e) => actions.region(e.currentTarget.value as Region | "")}
        >
          <option value="">{text.allRegions}</option>
          {REGIONS.map((r) => (
            <option key={r} value={r}>
              {text.regions[r]}
            </option>
          ))}
        </select>
      </label>
      <label className="res-pick">
        {text.country}{" "}
        <select id="loc-country" aria-label={text.countryLabel} value={st.country} onChange={(e) => actions.country(e.currentTarget.value)}>
          <option value="">{text.allCountries}</option>
          {countryOptions(ctx, st.region).map((c) => (
            <option key={c.iso3} value={c.iso3}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
