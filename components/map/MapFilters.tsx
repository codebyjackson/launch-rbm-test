"use client";

// The left rail's Filters: access stages and the two recommended-use groups,
// with a count of countries each (old: renderFilters and its handlers).
//
// The old page rebuilt this table on every change and then put focus back
// on the box just clicked. React keeps the same elements, so focus stays
// where it was without help.
import { useEffect, useRef } from "react";
import { filterTable, type MapContext, type MapState, type TokenReader } from "@/lib/map";
import { LineSwatch, type MapActions } from "./parts";
import { fill, type MapText } from "./text";

interface Props {
  ctx: MapContext;
  st: MapState;
  text: MapText;
  token: TokenReader;
  actions: MapActions;
}

export function MapFilters({ ctx, st, text, token, actions }: Props) {
  const ft = filterTable(ctx, st);
  // `indeterminate` is a property only, with no attribute to render
  const all = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (all.current) all.current.indeterminate = ft.indeterminate;
  });
  return (
    <div className="dock-section" id="filters">
      <div className="flt-head">
        <h3>
          {text.filters}{" "}
          <span className="flt-act" id="flt-act" hidden={!ft.active}>
            {ft.active}
          </span>
        </h3>
        <button type="button" className="flt-reset" id="flt-reset" onClick={actions.reset}>
          {text.reset}
        </button>
      </div>
      <div className="flt-list" id="flt-table" role="group" aria-label={text.filtersLabel}>
        <table className="ftab">
          <thead>
            <tr>
              <th colSpan={2}>
                <label className="flt-all">
                  <input
                    ref={all}
                    type="checkbox"
                    id="flt-all"
                    checked={ft.allChecked}
                    // a click on a mixed box ticks everything, as in the browser
                    onChange={() => actions.all(!ft.allChecked)}
                  />{" "}
                  {text.show}
                </label>
              </th>
              <th className="n">{text.count}</th>
            </tr>
          </thead>
          <tbody>
            <tr className="gr">
              <th colSpan={3}>{text.filterStage}</th>
            </tr>
            {ft.stages.map((s) => (
              <tr key={s.key}>
                <td className="cbx">
                  <input
                    type="checkbox"
                    id={`flt-s-${s.key}`}
                    data-stage={s.key}
                    checked={s.checked}
                    onChange={(e) => actions.stage(s.key, e.currentTarget.checked)}
                  />
                </td>
                <td>
                  <label htmlFor={`flt-s-${s.key}`}>
                    <span className={`mapsw ${s.key}`} />
                    {text.stage[s.key]}
                  </label>
                </td>
                <td className={s.count ? "n" : "n zero"}>{s.count}</td>
              </tr>
            ))}
            {ft.groups && (
              <tr className="gr">
                <th colSpan={3}>{text.use}</th>
              </tr>
            )}
            {ft.groups &&
              ft.groups.map((g) => (
                <tr key={g.id} className={g.off ? "dim" : ""}>
                  <td className="cbx">
                    <input
                      type="checkbox"
                      id={`flt-g-${g.id}`}
                      data-group={g.id}
                      checked={g.checked}
                      disabled={g.off}
                      onChange={(e) => actions.group(g.id, e.currentTarget.checked)}
                    />
                  </td>
                  <td>
                    <label htmlFor={`flt-g-${g.id}`}>
                      <LineSwatch id={g.id} token={token} />
                      {text.groups[g.id].short}
                    </label>
                  </td>
                  <td className={g.count ? "n" : "n zero"}>{g.count}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <p className="mft-hint" id="mft-hint" hidden={ft.hint.hidden}>
        {ft.hint.kind === "noPolicy" ? fill(text.noPolicy, { name: ft.hint.product }) : text.tickHint}
      </p>
    </div>
  );
}
