import { Fragment } from "react";
import type { Citation } from "@/lib/format";

/**
 * A claim's citations as the page drew them (citeLinks): each source's short
 * name, linked when it has an address, joined by " · ". Takes the values
 * citeLinks() or citeOrText() in lib/format.ts return.
 */
export function Cites({ cites }: { cites: readonly Citation[] }) {
  return (
    <>
      {cites.map((c, n) => (
        <Fragment key={n}>
          {n ? " · " : null}
          {c.url ? (
            <a className="cite" href={c.url} target="_blank" rel="noopener noreferrer">
              {c.label}
              <span className="ext" aria-hidden="true">
                ↗
              </span>
            </a>
          ) : (
            c.label
          )}
        </Fragment>
      ))}
    </>
  );
}
