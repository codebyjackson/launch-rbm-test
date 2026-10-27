// Just enough HTML and DOM for the board tests, with no dependency: a parser
// for the markup both sides produce, a small DOM the page's own code can run
// on (the glossary walk, highlightStep), and a normal form for comparing.
//
// The parser expects well-formed markup, as both the page's templates and
// React produce: every element closed, or void, or written <x/>. Anything
// else throws, so a surprise in either side's markup is not hidden.

const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);

const ENTITIES: { [name: string]: string } = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

export function decode(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") return String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : +e.slice(1));
    const v = ENTITIES[e.toLowerCase()];
    if (v == null) throw new Error(`unknown entity ${m}`);
    return v;
  });
}

export type Node = El | Text;
type Parent = El | Frag;

export class Text {
  readonly nodeType = 3;
  parentNode: Parent | null = null;
  constructor(public nodeValue: string) {}
  get parentElement(): El | null {
    return this.parentNode instanceof El ? this.parentNode : null;
  }
}

class Container {
  childNodes: Node[] = [];
  appendChild<T extends Node | Frag>(n: T): T {
    if (n instanceof Frag) {
      for (const c of n.childNodes) this.appendChild(c);
      n.childNodes = [];
      return n;
    }
    if (n.parentNode) n.parentNode.childNodes.splice(n.parentNode.childNodes.indexOf(n), 1);
    n.parentNode = this as unknown as Parent;
    this.childNodes.push(n);
    return n;
  }
  get firstChild(): Node | null {
    return this.childNodes[0] || null;
  }
}

export class Frag extends Container {}

export class El extends Container {
  readonly nodeType = 1;
  parentNode: Parent | null = null;
  /** in the order written */
  attrs: [string, string][] = [];
  constructor(public tag: string) {
    super();
  }
  getAttribute(name: string): string | null {
    const a = this.attrs.find(([k]) => k === name);
    return a ? a[1] : null;
  }
  setAttribute(name: string, value: string) {
    const a = this.attrs.find(([k]) => k === name);
    if (a) a[1] = String(value);
    else this.attrs.push([name, String(value)]);
  }
  removeAttribute(name: string) {
    this.attrs = this.attrs.filter(([k]) => k !== name);
  }
  get id() {
    return this.getAttribute("id") || "";
  }
  get className() {
    return this.getAttribute("class") || "";
  }
  set className(v: string) {
    this.setAttribute("class", v);
  }
  set tabIndex(v: number) {
    this.setAttribute("tabindex", String(v));
  }
  set hidden(v: boolean) {
    if (v) this.setAttribute("hidden", "");
    else this.removeAttribute("hidden");
  }
  set textContent(v: string) {
    this.childNodes = [];
    this.appendChild(new Text(v));
  }
  set innerHTML(html: string) {
    this.childNodes = [];
    for (const n of parse(html)) this.appendChild(n);
  }
  insertAdjacentHTML(where: string, html: string) {
    const nodes = parse(html);
    if (where !== "afterbegin") throw new Error(`insertAdjacentHTML ${where}`);
    for (const n of nodes) n.parentNode = this;
    this.childNodes.unshift(...nodes);
  }
  replaceChild(n: Node | Frag, old: Node) {
    const at = this.childNodes.indexOf(old);
    const added = n instanceof Frag ? n.childNodes : [n];
    for (const c of added) c.parentNode = this;
    this.childNodes.splice(at, 1, ...added);
    old.parentNode = null;
    if (n instanceof Frag) n.childNodes = [];
  }
  get classList() {
    const get = () => this.className.split(/\s+/).filter(Boolean);
    return {
      contains: (c: string) => get().includes(c),
      add: (c: string) => {
        if (!get().includes(c)) this.className = [...get(), c].join(" ");
      },
      remove: (c: string) => {
        this.className = get().filter((x) => x !== c).join(" ");
      },
      toggle: (c: string, on?: boolean) => {
        const has = get().includes(c);
        const want = on === undefined ? !has : on;
        if (want && !has) this.className = [...get(), c].join(" ");
        if (!want && has) this.className = get().filter((x) => x !== c).join(" ");
        return want;
      },
    };
  }
  get dataset(): { [k: string]: string } {
    const key = (p: string) => "data-" + p.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase());
    return new Proxy({} as { [k: string]: string }, {
      get: (_, p: string) => this.getAttribute(key(p)) ?? undefined,
      set: (_, p: string, v) => {
        this.setAttribute(key(p), String(v));
        return true;
      },
    });
  }
  addEventListener() {}
  matches(sel: string): boolean {
    return sel.split(",").some((part) => matchChain(this, part.trim().split(/\s+/)));
  }
  closest(sel: string): El | null {
    for (let e: Parent | null = this; e instanceof El; e = e.parentNode) if (e.matches(sel)) return e;
    return null;
  }
  querySelectorAll(sel: string): El[] {
    const out: El[] = [];
    const visit = (n: Node) => {
      if (!(n instanceof El)) return;
      if (n.matches(sel)) out.push(n);
      n.childNodes.forEach(visit);
    };
    this.childNodes.forEach(visit);
    return out;
  }
  querySelector(sel: string): El | null {
    return this.querySelectorAll(sel)[0] || null;
  }
}

// one compound selector: tag, #id, .class and [attr="value"], in any mix
function matchCompound(e: El, sel: string): boolean {
  const re = /([a-z][\w-]*)|#([\w-]+)|\.([\w-]+)|\[([\w-]+)(?:="([^"]*)")?\]|(.)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sel))) {
    if (m[6]) throw new Error(`selector not supported: ${sel}`);
    if (m[1] && e.tag !== m[1].toLowerCase()) return false;
    if (m[2] && e.id !== m[2]) return false;
    if (m[3] && !e.classList.contains(m[3])) return false;
    if (m[4] && (m[5] === undefined ? e.getAttribute(m[4]) == null : e.getAttribute(m[4]) !== m[5])) return false;
  }
  return true;
}

// descendant combinators only
function matchChain(e: El, chain: string[]): boolean {
  if (!matchCompound(e, chain[chain.length - 1])) return false;
  let rest = chain.slice(0, -1);
  for (let a = e.parentNode; rest.length && a instanceof El; a = a.parentNode) {
    if (matchCompound(a, rest[rest.length - 1])) rest = rest.slice(0, -1);
  }
  return !rest.length;
}

/** Parses markup into nodes; throws on anything not well formed. */
export function parse(html: string): Node[] {
  const root = new El("#root");
  const stack: El[] = [root];
  const top = () => stack[stack.length - 1];
  const tag = /<!--[\s\S]*?-->|<\/([a-zA-Z][\w-]*)\s*>|<([a-zA-Z][\w-]*)((?:\s+[^\s=/>]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>"']+))?)*)\s*(\/?)>/g;
  let at = 0;
  let m: RegExpExecArray | null;
  const text = (s: string) => {
    if (s.includes("<")) throw new Error(`stray "<" in text: ${JSON.stringify(s.slice(0, 80))}`);
    if (s) top().appendChild(new Text(decode(s)));
  };
  while ((m = tag.exec(html))) {
    text(html.slice(at, m.index));
    at = tag.lastIndex;
    if (m[0].startsWith("<!--")) continue;
    if (m[1]) {
      const name = m[1].toLowerCase();
      if (top().tag !== name) throw new Error(`</${name}> closes <${top().tag}> at ${m.index}`);
      stack.pop();
      continue;
    }
    const el = new El(m[2].toLowerCase());
    const attr = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>"']+)))?/g;
    let a: RegExpExecArray | null;
    while ((a = attr.exec(m[3]))) el.setAttribute(a[1].toLowerCase(), decode(a[2] ?? a[3] ?? a[4] ?? ""));
    top().appendChild(el);
    if (!m[4] && !VOID.has(el.tag)) stack.push(el);
  }
  text(html.slice(at));
  if (stack.length !== 1) throw new Error(`<${top().tag}> not closed`);
  const nodes = root.childNodes;
  for (const n of nodes) n.parentNode = null;
  return nodes;
}

/** A minimal document for the page's code: the parts the board's statements use. */
export function miniDocument(lang: string, root: El) {
  const NodeFilter = { SHOW_TEXT: 4, FILTER_ACCEPT: 1, FILTER_REJECT: 2, FILTER_SKIP: 3 };
  const stub = () => new El("div");
  const doc = {
    documentElement: { lang },
    /** a test may answer some selectors itself (fake layout boxes) */
    override: null as null | ((sel: string) => unknown[] | undefined),
    getElementById: (id: string) => root.querySelectorAll(`#${id}`)[0] || stub(),
    querySelectorAll: (sel: string) => (doc.override && doc.override(sel)) || root.querySelectorAll(sel),
    createDocumentFragment: () => new Frag(),
    createTextNode: (s: string) => new Text(s),
    createElement: (t: string) => new El(t),
    createTreeWalker(start: El, what: number, filter: { acceptNode(n: Text): number }) {
      if (what !== NodeFilter.SHOW_TEXT) throw new Error("only SHOW_TEXT");
      const texts: Text[] = [];
      const visit = (n: Node) => (n instanceof Text ? texts.push(n) : n.childNodes.forEach(visit));
      start.childNodes.forEach(visit);
      const accepted = texts.filter((t) => filter.acceptNode(t) === NodeFilter.FILTER_ACCEPT);
      let k = -1;
      return {
        currentNode: start as El | Text,
        nextNode() {
          k++;
          this.currentNode = accepted[k];
          return accepted[k] || null;
        },
      };
    },
  };
  return { doc, NodeFilter };
}

// ---- the normal form ------------------------------------------------------------

const normStyle = (v: string) =>
  v
    .split(";")
    .map((d) => d.trim())
    .filter(Boolean)
    .map((d) => {
      const i = d.indexOf(":");
      return d.slice(0, i).trim() + ":" + d.slice(i + 1).trim();
    })
    .join(";");

/**
 * One node per line, indented by depth: attributes sorted, class and style
 * values with their white space folded, text with each run of white space
 * folded to one space, neighbouring texts joined, white-space-only texts
 * dropped, and entities decoded (both sides are parsed first). Boolean
 * attributes come out as name="" either way.
 */
export function normal(nodes: readonly Node[], depth = 0): string[] {
  const out: string[] = [];
  const pad = "  ".repeat(depth);
  let pending = "";
  const flush = () => {
    const t = pending.replace(/\s+/g, " ");
    if (t.trim()) out.push(pad + JSON.stringify(t));
    pending = "";
  };
  for (const n of nodes) {
    if (n instanceof Text) {
      pending += n.nodeValue;
      continue;
    }
    flush();
    const attrs = [...n.attrs]
      .map(([k, v]): [string, string] => [k, k === "class" ? v.split(/\s+/).filter(Boolean).join(" ") : k === "style" ? normStyle(v) : v])
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => ` ${k}=${JSON.stringify(v)}`)
      .join("");
    out.push(`${pad}<${n.tag}${attrs}>`);
    out.push(...normal(n.childNodes, depth + 1));
  }
  flush();
  return out;
}

export const normalHtml = (html: string) => normal(parse(html)).join("\n");
