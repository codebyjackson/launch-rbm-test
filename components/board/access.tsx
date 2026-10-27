// The access figures and the two i buttons: accessCell, accessInfo and
// lateInfo on the page. Builders, not components: they return elements and are
// called, so the glossary pass (gloss.tsx) can read their text.
import type { ReactElement } from "react";
import type { Product } from "@/lib/dataset";
import { accessParts } from "@/lib/stages";
import { fill } from "@/lib/strings";
import type { Scope } from "./types";

/**
 * An i button. Its definition travels in data-tip: the board's hint handler
 * reads it from whichever i the pointer or focus is on, as the page did.
 */
function infoButton(tip: string, key?: string): ReactElement {
  return (
    <button key={key} type="button" className="info" data-tip={tip} aria-label={tip}>
      i
    </button>
  );
}

/** What the two access figures mean. */
export function accessInfo(s: Scope, key?: string): ReactElement {
  return infoButton(s.text.accessDef, key);
}

/** What "Delayed" means: the hand-set status, not a measured comparison. */
export function lateInfo(s: Scope, key?: string): ReactElement {
  return infoButton(fill(s.text.lateTip, { status: s.t.status.late, definition: s.text.lateDef }), key);
}

/** The medicines table's Access cell: each phase's name above its figure. */
export function accessCell(p: Product, s: Scope): ReactElement {
  return (
    <span className="acc">
      {accessParts(p, s.ctx).map(([name, figure, tone], n) => [
        <small key={`n${n}`}>{name}</small>,
        tone === "none" ? (
          <span key={`f${n}`} className="none">
            {figure}
          </span>
        ) : (
          <b key={`f${n}`} className={tone || undefined}>
            {figure}
          </b>
        ),
      ])}
    </span>
  );
}
