// Stand-ins for the parts of a row the pathway area draws (BoardSlots), so
// tests/markup-board.test.ts can compare whole rows with the old page's. Each
// draws today's markup, and returns plain elements, as the board's notes ask
// the Dashboard to wire the real ones, so the glossary walk sees their text.
// They are not under test themselves: the pathway area tests its own.
import { createElement, type CSSProperties, type ReactNode } from "react";
import type { BoardSlots } from "@/components/board";
import type { ProductDetail } from "@/lib/dataset";
import type { Citation } from "@/lib/format";
import { El, parse, type Node } from "../golden-board/html";

// the icon set the page used, assets/journey-icons/icons-solid.js at 7c1bf11;
// stage 2 has no glyph (the WHO emblem stands in)
const ICON_IDS = [
  "01-rnd-clinical", "02-regulatory-approval", "", "04-who-prequalification",
  "05-country-registration", "06-national-policy", "07-procurement", "08-in-country-delivery",
];

/** stageIconImg's markup. */
function stageIcon(i: number, cls: string): ReactNode {
  if (i === 2) return <img className={`${cls} whoemb`} src="../assets/who-emblem.svg" alt="" width="205" height="181" />;
  if (!ICON_IDS[i]) return null;
  return (
    <svg className={cls} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <use href={`#jis-${ICON_IDS[i]}`} />
    </svg>
  );
}

/** citeLinks' markup, from the values lib/format.ts returns. */
function cites(list: readonly Citation[]): ReactNode {
  return list.flatMap((c, n) => [
    n ? " · " : null,
    c.url ? (
      <a key={n} className="cite" href={c.url} target="_blank" rel="noopener noreferrer">
        {c.label}
        <span className="ext" aria-hidden="true">
          ↗
        </span>
      </a>
    ) : (
      c.label
    ),
  ]);
}

const ATTR: { [html: string]: string } = { class: "className", tabindex: "tabIndex", colspan: "colSpan", viewbox: "viewBox" };

const styleObject = (css: string): CSSProperties =>
  Object.fromEntries(
    css
      .split(";")
      .filter((d) => d.trim())
      .map((d) => {
        const i = d.indexOf(":");
        return [d.slice(0, i).trim().replace(/-([a-z])/g, (_, c: string) => c.toUpperCase()), d.slice(i + 1).trim()];
      }),
  );

/** Markup as plain React elements. */
export function fromHtml(nodes: Node[]): ReactNode[] {
  return nodes.map((n, k) => {
    if (!(n instanceof El)) return n.nodeValue;
    const props: { [k: string]: unknown } = { key: k };
    for (const [name, v] of n.attrs) props[ATTR[name] || name] = name === "style" ? styleObject(v) : v;
    return createElement(n.tag, props, ...fromHtml(n.childNodes));
  });
}

/**
 * The slots, given the old page's countryAccessKv (the Country access rows
 * are drawn from the page's own function, its markup turned into elements).
 */
export function oldSlots(countryAccessKv: (d: ProductDetail) => unknown): BoardSlots {
  return {
    renderStageIcon: stageIcon,
    renderCountryAccess: (d) => fromHtml(parse(String(countryAccessKv(d)).trim())),
    renderCites: cites,
  };
}
