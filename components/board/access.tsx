// The access figures and the two i buttons: marketCell, countryCell (with
// accessFig), accessInfo and lateInfo on the page. Builders, not components:
// they return elements and are called, so the glossary pass (gloss.tsx) can
// read their text.
import type { ReactElement } from "react";
import type { Product } from "@/lib/dataset";
import { accessParts, type AccessTone } from "@/lib/stages";
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

/**
 * What "Delayed" means: the hand-set status, not a measured comparison. Not
 * shown since 3 Nov 2026: the medicines table's Status column, which carried
 * it, became Market Access (partner feedback). Kept, as on the page, for when
 * the status words return.
 */
export function lateInfo(s: Scope, key?: string): ReactElement {
  return infoButton(fill(s.text.lateTip, { status: s.t.status.late, definition: s.text.lateDef }), key);
}

// The medicines table gives each phase its own column (partner feedback,
// 21 Oct 2026, "Market, Country & Population Access Headings"): the Status
// column became Market Access and the Access column Country Access, one
// figure each. The phase name above a figure shows only where the header
// row is hidden (phones; the stylesheet's .srow .acc small).
function accessFig(name: string, figure: string, tone: AccessTone): ReactElement {
  return (
    <span className="acc">
      <small>{name}</small>
      {tone === "none" ? <span className="none">{figure}</span> : <b className={tone || undefined}>{figure}</b>}
    </span>
  );
}

/** The Market Access cell. */
export function marketCell(p: Product, s: Scope): ReactElement {
  return accessFig(...accessParts(p, s.ctx)[0]);
}

/** The Country Access cell: "Not yet reached" before Market Access is. */
export function countryCell(p: Product, s: Scope): ReactElement {
  const c = accessParts(p, s.ctx)[1];
  return c ? accessFig(...c) : accessFig(s.t.phases[1], s.t.notYetReached, "none");
}
