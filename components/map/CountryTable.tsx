"use client";

// The Find a country list (old: finderRows): every country the left filters
// keep, narrowed by the search box, by name. A row opens the country's page.
import { finder, type MapContext, type MapState, type TokenReader } from "@/lib/map";
import { LineSwatch, stageLabel } from "./parts";
import type { MapText } from "./text";

interface Props {
  ctx: MapContext;
  st: MapState;
  q: string;
  text: MapText;
  token: TokenReader;
  /** a row or its name clicked */
  onSelect(iso3: string): void;
  /** the "Reset filters" button shown when the filters leave no country */
  onReset(): void;
}

export function CountryTable({ ctx, st, q, text, token, onSelect, onReset }: Props) {
  const f = finder(ctx, st, q);
  if (f.kind === "empty") {
    return (
      <div className="det-nomatch">
        <p>{text.find.none}</p>
        <button type="button" className="det-reset" data-reset="" onClick={onReset}>
          {text.find.reset}
        </button>
      </div>
    );
  }
  if (f.kind === "nomatch") {
    return (
      <p className="det-empty" style={{ padding: "8px 10px" }}>
        {text.noMatch}
      </p>
    );
  }
  return (
    <table className="det-table">
      <colgroup>
        <col />
        <col />
        <col style={{ width: "56px" }} />
        <col style={{ width: "16px" }} />
      </colgroup>
      <thead>
        <tr>
          <th scope="col">{text.find.country}</th>
          <th scope="col">{text.find.stage}</th>
          <th scope="col">{text.find.use}</th>
          <th aria-hidden="true" />
        </tr>
      </thead>
      <tbody>
        {f.rows.map((r) => (
          // The row takes the click, the name's button included, as the
          // old page's one listener on the panel did.
          <tr key={r.iso3} className="det-row" data-iso3={r.iso3} onClick={() => onSelect(r.iso3)}>
            <td className="nm">
              <button type="button" className="det-name" data-iso3={r.iso3} title={r.name}>
                {r.name}
              </button>
            </td>
            <td className="stg">
              {f.showStage && (
                <>
                  <span className={`mapsw ${r.stage}`} />
                  {r.stage === "guidelines" ? text.inGuidelines : stageLabel(text, r.stage)}
                </>
              )}
            </td>
            <td className="use">
              {r.groups.map((g) => (
                <LineSwatch key={g} id={g} len={22} token={token} />
              ))}
            </td>
            <td className="go" aria-hidden="true">
              ›
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
