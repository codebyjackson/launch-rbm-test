// The rows of a medicine's Country access card (in the board's "More detail").
// countryAccessKv(d), ported from launch-rbm-test ef0bd8c (en/index.html).
// Where the medicine has a country list (the one the map is painted from),
// every figure comes from it: countries on the map, then how many have a
// source for each access stage (countryStages), the numbers the map's three
// views show; a country can count at more than one (partner feedback, 3 Nov
// 2026). Without a list, the summary figures in detail.country.
//
// No state and no handlers, so it renders on the server too. The board puts
// it inside its card, before its own Forecast demand row.
import type { ProductDetail, Source } from "@/lib/dataset";
import { countryAccessCounts, countryList } from "@/lib/pathway";
import type { PathwayText } from "./text";

export function CountryAccessKv({
  detail,
  sources,
  text,
}: {
  detail: ProductDetail;
  /** every source (Localized.sources.sources): their categories mark registers and guidelines */
  sources: readonly Source[];
  text: PathwayText;
}) {
  const list = countryList(detail);
  if (!list) {
    // As on the page, a medicine with neither a list nor a summary breaks the card.
    const s = detail.country!;
    return (
      <>
        <div className="kv">
          <span>{text.levels.registered}</span>
          <span>{s.registered}</span>
        </div>
        <div className="kv">
          <span>{text.levels.guidelines}</span>
          <span>{s.inGuidelines}</span>
        </div>
        <div className="kv">
          <span>{text.levels.mft}</span>
          <span>{s.inMft}</span>
        </div>
      </>
    );
  }
  const n = countryAccessCounts(list, sources);
  return (
    <>
      <div className="kv">
        <span>{text.onMap}</span>
        <span>{n.onMap}</span>
      </div>
      <div className="kv sub">
        <span>{text.confirmed}</span>
        <span>{n.stages.registered}</span>
      </div>
      <div className="kv sub">
        <span>{text.levels.guidelines}</span>
        <span>{n.stages.guidelines}</span>
      </div>
      <div className="kv sub">
        <span>{text.levels.mft}</span>
        <span>{n.stages.mft}</span>
      </div>
      <p style={{ margin: "4px 0 2px 14px", fontSize: "13px", color: "var(--ink-3)" }}>{text.moreThanOneStage}</p>
    </>
  );
}
