"use client";

// One tab per tracked medicine (old: the #maptabs buttons and selectMap).
import type { MapContext, MapState } from "@/lib/map";
import type { MapActions } from "./parts";
import type { MapText } from "./text";

export function MapTabs({ ctx, st, text, actions }: { ctx: MapContext; st: MapState; text: MapText; actions: MapActions }) {
  return (
    <div className="tabs" id="maptabs" role="tablist" aria-label={text.tabsLabel}>
      {ctx.products.map((p) => (
        // no type="button", as on the old page: these sit in no form
        <button
          key={p.id}
          className="tab"
          role="tab"
          data-id={p.id}
          aria-selected={p.id === st.productId ? "true" : "false"}
          onClick={() => actions.product(p.id)}
        >
          {p.name}
        </button>
      ))}
    </div>
  );
}
