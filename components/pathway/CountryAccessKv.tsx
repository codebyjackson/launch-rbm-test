// The rows of a medicine's Country access card (in the board's "More detail").
// countryAccessKv(d), ported from launch-rbm-test 7c1bf11 (en/index.html).
// Where the medicine has a country list (the one the map is painted from),
// every figure comes from it: countries on the map, split by the furthest
// level each has reached, and how many a national register confirms.
// Without a list, the summary figures in detail.country.
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
  /** every source (Localized.sources.sources): their categories mark the national registers */
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
        <span>{text.levels.mft}</span>
        <span>{n.levels.mft}</span>
      </div>
      <div className="kv sub">
        <span>{text.levels.guidelines}</span>
        <span>{n.levels.guidelines}</span>
      </div>
      <div className="kv sub">
        <span>{text.levels.registered}</span>
        <span>{n.levels.registered}</span>
      </div>
      {n.confirmed != null ? (
        <div className="kv">
          <span>{text.confirmed}</span>
          <span>{n.confirmed}</span>
        </div>
      ) : null}
    </>
  );
}
