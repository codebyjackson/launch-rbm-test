// A small HTML reader for the golden test: enough for the markup the map
// section writes (the old page's strings, React's renderToStaticMarkup), so
// the two can be compared as trees rather than as text. Escaping, attribute
// order, `checked` vs `checked=""`, `<path/>` vs `<path></path>` and spacing
// inside style="" then make no difference. Not a general HTML parser.

export type HNode = string | HElement;
export interface HElement {
  tag: string;
  attrs: Record<string, string>;
  children: HNode[];
}

const VOID = new Set(["input", "col", "br", "img", "hr", "meta", "link", "source", "wbr"]);
const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

export const decode = (s: string): string =>
  s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e: string) =>
    e[0] === "#"
      ? String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10))
      : ENTITIES[e] ?? m,
  );

const TOKEN = /<!--[\s\S]*?-->|<\/([a-zA-Z][\w-]*)\s*>|<([a-zA-Z][\w-]*)((?:\s+[^\s=/>]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>"']+))?)*)\s*(\/?)>|[^<]+|</g;
const ATTR = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>"']+)))?/g;

export function parseHtml(html: string): HNode[] {
  const root: HElement = { tag: "#root", attrs: {}, children: [] };
  const stack: HElement[] = [root];
  for (const m of html.matchAll(TOKEN)) {
    const top = stack[stack.length - 1];
    if (m[0].startsWith("<!--")) continue;
    if (m[1]) {
      const tag = m[1].toLowerCase();
      for (let i = stack.length - 1; i > 0; i--) {
        if (stack[i].tag === tag) {
          stack.length = i;
          break;
        }
      }
    } else if (m[2]) {
      const el: HElement = { tag: m[2].toLowerCase(), attrs: {}, children: [] };
      for (const a of m[3].matchAll(ATTR)) el.attrs[a[1]] = decode(a[2] ?? a[3] ?? a[4] ?? "");
      top.children.push(el);
      if (!m[4] && !VOID.has(el.tag)) stack.push(el);
    } else {
      top.children.push(decode(m[0]));
    }
  }
  return root.children;
}

export const isElement = (n: HNode): n is HElement => typeof n !== "string";

/** All text inside some nodes. */
export const textOf = (nodes: HNode[]): string => nodes.map((n) => (typeof n === "string" ? n : textOf(n.children))).join("");

/**
 * Nodes in a form where equal markup is deep-equal: adjacent text merged,
 * attribute names lowercased and sorted, an empty class dropped (the old page left class="" on
 * rows it had toggled), style declarations trimmed, and an <option>'s
 * `selected` dropped (React marks the chosen option; the old page set the
 * select's value instead, which the test compares on its own).
 */
export function canon(nodes: HNode[]): unknown[] {
  const out: unknown[] = [];
  for (const n of nodes) {
    if (typeof n === "string") {
      if (typeof out[out.length - 1] === "string") out[out.length - 1] += n;
      else if (n) out.push(n);
      continue;
    }
    const attrs: [string, string][] = [];
    for (const [name, raw] of Object.entries(n.attrs)) {
      // HTML attribute names are case-insensitive: React writes colSpan
      const k = name.toLowerCase();
      let v = raw;
      if (k === "class") {
        v = v.split(/\s+/).filter(Boolean).join(" ");
        if (!v) continue;
      }
      if (k === "style") {
        v = v
          .split(";")
          .map((d) => d.trim())
          .filter(Boolean)
          .map((d) => {
            const i = d.indexOf(":");
            return d.slice(0, i).trim() + ":" + d.slice(i + 1).trim();
          })
          .join(";");
      }
      if (n.tag === "option" && k === "selected") continue;
      attrs.push([k, v]);
    }
    attrs.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
    out.push({ tag: n.tag, attrs: Object.fromEntries(attrs), children: canon(n.children) });
  }
  return out;
}

/** The element with an id, anywhere below some nodes. */
export function byId(nodes: HNode[], id: string): HElement | null {
  for (const n of nodes) {
    if (typeof n === "string") continue;
    if (n.attrs.id === id) return n;
    const found = byId(n.children, id);
    if (found) return found;
  }
  return null;
}

/** Every element matching a test, below some nodes, in document order. */
export function findAll(nodes: HNode[], test: (e: HElement) => boolean, out: HElement[] = []): HElement[] {
  for (const n of nodes) {
    if (typeof n === "string") continue;
    if (test(n)) out.push(n);
    findAll(n.children, test, out);
  }
  return out;
}
