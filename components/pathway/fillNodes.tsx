import { Fragment, type ReactNode } from "react";

/**
 * fill() (lib/strings.ts) for a value that is markup: "{years} expected" with
 * {years} drawn bold, "Source: {cites}" with links. The template's own text
 * stays text, so React escapes it; a name with no value draws nothing.
 */
export function fillNodes(template: string, values: { [name: string]: ReactNode }): ReactNode {
  // split() with a capture group: even indexes are text, odd ones are names
  return template
    .split(/\{(\w+)\}/)
    .map((part, k) => (k % 2 ? <Fragment key={k}>{values[part]}</Fragment> : part || null));
}
