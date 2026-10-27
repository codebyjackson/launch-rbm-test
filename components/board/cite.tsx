// A claim's "Source: " line, and the one rule every builder here keeps for
// text: where the page wrote several pieces of text side by side, they are
// one string here too. The page built HTML strings, so "Source: WHO · " was a
// single text node; React would make three. That matters beyond tidiness: the
// glossary walk (gloss.tsx) matches whole words inside one text at a time, as
// the page's tree walk did, so the texts must be cut where the page's were.
import type { ReactNode } from "react";
import type { Citation } from "@/lib/format";
import type { Scope } from "./types";

/** Joins neighbouring strings into one; elements keep their place. */
export function mergeText(parts: readonly ReactNode[]): ReactNode[] {
  const out: ReactNode[] = [];
  for (const part of parts) {
    if (part == null || part === false || part === "") continue;
    const prev = out[out.length - 1];
    if (typeof part === "string" && typeof prev === "string") out[out.length - 1] = prev + part;
    else out.push(part);
  }
  return out;
}

/**
 * "Source: " and the citations, drawn by the pathway area's renderCites.
 * Without it, their names as plain text, joined as the page joined them.
 */
export function sourceLine(s: Scope, cites: readonly Citation[]): ReactNode[] {
  const drawn = s.slots.renderCites ? s.slots.renderCites(cites) : cites.map((c) => c.label).join(" · ");
  return mergeText([s.text.source + " ", ...(Array.isArray(drawn) ? drawn : [drawn])]);
}
