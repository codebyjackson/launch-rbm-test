"use client";

// The legends under the map: the access stage in view and No data, with
// counts, the recommended-use groups, and where to find drug-resistance data
// (old: the static legend markup, paintView's counts and mftLegend).
import { mapLegend, type MapContext, type MapState, type TokenReader } from "@/lib/map";
import { LineSwatch } from "./parts";
import type { MapText } from "./text";

const THREATS_MAP = "https://apps.who.int/malaria/maps/threats/";

export function MapLegend({ ctx, st, text, token }: { ctx: MapContext; st: MapState; text: MapText; token: TokenReader }) {
  const lg = mapLegend(ctx, st);
  return (
    <div className="map-legend-bar">
      <div className="dock-section">
        <h3>{text.legend}</h3>
        <div className="legend-tables">
          <div className="map-legend">
            <table className="ftab">
              <thead>
                <tr>
                  <th colSpan={2}>{text.legendStage}</th>
                  <th className="n">{text.legendCount}</th>
                </tr>
              </thead>
              <tbody>
                {lg.stages.map((r) => (
                  <tr key={r.key} data-lvl={r.key} hidden={r.hidden}>
                    <td className="sw">
                      <span className={`mapsw ${r.key}`} />
                    </td>
                    <td>{text.legendRows[r.key]}</td>
                    <td className="n">
                      <span className={r.zero ? "ct zero" : "ct"} id={`mapct-${r.key}`}>
                        {r.count}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mft-legend" id="mft-legend" hidden={!lg.policy}>
            {lg.policy && (
              <table className="ftab">
                <thead>
                  <tr>
                    <th colSpan={2}>
                      {text.use} · {lg.policy.product}
                    </th>
                    <th className="n">{text.count}</th>
                  </tr>
                </thead>
                <tbody>
                  {lg.policy.rows.map((r) => (
                    <tr key={r.id} className={r.dim ? "dim" : ""}>
                      <td className="sw">
                        <LineSwatch id={r.id} token={token} />
                      </td>
                      <td>
                        {text.groups[r.id].label}
                        <small>{text.groups[r.id].why}</small>
                      </td>
                      <td className="n">{r.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
        <p className="res-rule" id="mapnote-who">
          {text.resBefore}
          <a href={THREATS_MAP} target="_blank" rel="noopener noreferrer">
            {text.resLink}
            <span className="ext" aria-hidden="true">
              ↗
            </span>
          </a>
          {text.resAfter}
        </p>
      </div>
    </div>
  );
}

