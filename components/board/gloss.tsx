// Glossary terms in a medicine's row: the first time a term appears in the
// row, it becomes a focusable span that shows its definition. The page did
// this after building the rows, with a DOM tree walk over each row's text
// nodes; changing text React has rendered behind its back breaks the next
// render, so here the same walk runs over the row's element tree before React
// renders it, in the same document order, with the page's own rules:
//
// - text inside .exp, .swg, .more or .smark is left alone (a focusable span
//   inside a button nests interactive content), and so is a term already
//   marked (.gloss);
// - the stage panel (.gatepanel) is left alone too: on the page it was empty
//   when the walk ran and filled later, so its text was never marked.
//
// This needs the row's text to be in the tree it walks, which is why the
// builders are functions the row calls, not components it mounts: a mounted
// component's output is not in the tree until React renders it.
import { Fragment, cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { glossSplit } from "@/lib/board";

const SKIP = ["exp", "swg", "more", "smark", "gloss", "gatepanel"];

const skipped = (className: unknown) =>
  typeof className === "string" && className.split(/\s+/).some((c) => SKIP.includes(c));

/**
 * Marks the first occurrence of each term in `node`. `seen` is the row's
 * record of terms already marked: one Set per row, per render. `term` draws a
 * marked term, given a key unique among its siblings.
 */
export function glossTree(
  node: ReactNode,
  re: RegExp,
  seen: Set<string>,
  term: (t: string, key: string) => ReactElement,
): ReactNode {
  const walk = (n: ReactNode): ReactNode => {
    if (typeof n === "string") {
      const parts = glossSplit(n, re, seen);
      return parts ? parts.map((part, k) => (typeof part === "string" ? part : term(part.term, `gloss${k}`))) : n;
    }
    if (Array.isArray(n)) return n.map(walk);
    if (!isValidElement(n)) return n;
    // a component's output is not here to walk; the board mounts none inside a row
    if (typeof n.type !== "string" && n.type !== Fragment) return n;
    const props = n.props as { className?: unknown; children?: ReactNode };
    if (skipped(props.className) || props.children === undefined) return n;
    // Children written side by side in JSX arrive as an array that needs no
    // keys; passing them back one by one keeps it that way.
    return Array.isArray(props.children)
      ? cloneElement(n, undefined, ...props.children.map(walk))
      : cloneElement(n, undefined, walk(props.children));
  };
  return walk(node);
}
