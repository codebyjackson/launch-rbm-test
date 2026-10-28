// Shared by tests/golden-frame.test.ts, tests/markup-frame.test.ts and
// tests/forms-frame.test.ts: the frozen reference files, a runner for each
// (the page's frame code, the feedback widget), and an HTML normaliser.
//
// No DOM library is installed, so each runner gives the old code a small
// stub of the few DOM members it touches and records what it does with them.
// The stubs are deliberately thin: any member they lack throws, which is
// also how we know the old code did nothing else.
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import type { Locale } from "@/lib/locales";
import { PAGE_LANG } from "@/lib/frame";

const ref = (name: string) => readFileSync(new URL(`./reference/${name}`, import.meta.url), "utf8");

export const REFERENCE = {
  page: (l: Locale) => ref(`${l}.page.js`),
  markup: (l: Locale) => ref(`${l}.markup.html`),
  feedback: (l: Locale) => ref(`${l}.feedback.js`),
};

/** The page's <html lang>, as the extractor recorded it. */
export function htmlLang(l: Locale): string {
  const m = REFERENCE.page(l).match(/^\/\/ html-lang: (.+)$/m);
  if (!m) throw new Error(`reference/${l}.page.js has no html-lang line`);
  // The language the new code declares (lib/frame.ts PAGE_LANG), not the page's
  // own pt-PT: Portuguese is Brazilian since 28 Oct 2026, and old and new must
  // format dates and numbers alike for the comparison to test the logic.
  return PAGE_LANG[l];
}

/** One part of {lang}.markup.html: "header", "banner" or "footer". */
export function markupPart(l: Locale, part: string): string {
  const text = REFERENCE.markup(l);
  const at = text.indexOf(`<!--@@ ${part} @@-->`);
  if (at < 0) throw new Error(`no ${part} in reference/${l}.markup.html`);
  const next = text.indexOf("<!--@@ ", at + 1);
  return text.slice(text.indexOf("\n", at) + 1, next < 0 ? text.length : next);
}

/** A recorded fetch call. */
export interface FetchCall {
  url: string;
  method: string | undefined;
  headers: unknown;
  body: string | undefined;
}

/**
 * A fetch stub answering every call with one reply: { status, body } (body
 * undefined: not JSON), or "reject" for a network failure. Records each call.
 */
export function stubFetch(reply: { status: number; body?: unknown } | "reject") {
  const calls: FetchCall[] = [];
  const fn = async (url: string, init?: { method?: string; headers?: unknown; body?: string }) => {
    calls.push({ url: String(url), method: init?.method, headers: init?.headers, body: init?.body });
    if (reply === "reject") throw new TypeError("Failed to fetch");
    return {
      ok: reply.status >= 200 && reply.status < 300,
      status: reply.status,
      json: async () => {
        if (reply.body === undefined) throw new SyntaxError("Unexpected token < in JSON");
        return structuredClone(reply.body);
      },
    };
  };
  return { fetch: fn as unknown as typeof fetch, calls };
}

// ---- a thin element stub -------------------------------------------------------

type Listener = (e: unknown) => unknown;

export class StubEl {
  readonly key: string;
  attrs = new Map<string, string>();
  classes: string[] = [];
  listeners = new Map<string, Listener[]>();
  hidden: boolean;
  textContent = "";
  outerHTML = "";
  disabled = false;
  open = false;
  scrollTop = 0;
  resets = 0;
  id = "";
  type = "";
  download = "";
  href = "";
  private inner = "";
  private kids = new Map<string, StubEl>();
  // a <select>'s options, from its innerHTML
  options: { value: string; text: string }[] = [];
  selectedIndex = -1;
  private plainValue = "";

  constructor(key: string, private world: StubWorld, hidden = false) {
    this.key = key;
    this.hidden = hidden;
  }
  get innerHTML() {
    return this.inner;
  }
  set innerHTML(v: string) {
    this.inner = String(v);
    this.kids.clear();
    const opts = [...this.inner.matchAll(/<option value="([^"]*)">([\s\S]*?)<\/option>/g)];
    if (opts.length) {
      this.options = opts.map((m) => ({ value: decode(m[1]), text: optionText(decode(m[2])) }));
      this.selectedIndex = 0;
    }
  }
  get value(): string {
    return this.options.length ? (this.options[this.selectedIndex]?.value ?? "") : this.plainValue;
  }
  set value(v: string) {
    if (this.options.length) this.selectedIndex = this.options.findIndex((o) => o.value === String(v));
    else this.plainValue = String(v);
  }
  get className() {
    return this.classes.join(" ");
  }
  set className(v: string) {
    this.classes = String(v).split(/\s+/).filter(Boolean);
  }
  classList = {
    add: (...c: string[]) => c.forEach((x) => this.classes.includes(x) || this.classes.push(x)),
    remove: (...c: string[]) => (this.classes = this.classes.filter((x) => !c.includes(x))),
    toggle: (c: string, force?: boolean) => {
      const on = force ?? !this.classes.includes(c);
      if (on) this.classList.add(c);
      else this.classList.remove(c);
      return on;
    },
    contains: (c: string) => this.classes.includes(c),
  };
  setAttribute(k: string, v: unknown) {
    this.attrs.set(k, String(v));
  }
  getAttribute(k: string) {
    return this.attrs.has(k) ? this.attrs.get(k)! : null;
  }
  removeAttribute(k: string) {
    this.attrs.delete(k);
  }
  addEventListener(type: string, fn: Listener) {
    this.listeners.set(type, [...(this.listeners.get(type) || []), fn]);
  }
  /** Calls this element's listeners for `type`; resolves when every one has. */
  async fire(type: string, event: object = {}) {
    for (const fn of this.listeners.get(type) || []) await fn({ preventDefault() {}, target: this, ...event });
  }
  querySelector(sel: string): StubEl {
    if (!this.kids.has(sel)) this.kids.set(sel, new StubEl(`${this.key} ${sel}`, this.world));
    return this.kids.get(sel)!;
  }
  focus() {
    this.world.focused.push(this.key);
  }
  reset() {
    this.resets++;
  }
  showModal() {
    this.open = true;
  }
  close() {
    this.open = false;
    void this.fire("close");
  }
  scrollIntoView() {}
  appendChild(child: StubEl) {
    return child;
  }
  remove() {}
  click() {
    this.world.clicks.push(this.key);
  }
  closest() {
    return null;
  }
}

export class StubWorld {
  focused: string[] = [];
  clicks: string[] = [];
}

// ---- the page's frame code -------------------------------------------------------

export interface OldPageInput {
  data: unknown;
  sources: unknown;
  /** the page's switches turned on, by their names on the page */
  on?: ("SHOW_PROGRESS" | "SHOW_LATE")[];
  fetch?: typeof fetch;
  pageUrl?: string;
}

// Elements the page's markup starts hidden.
const STARTS_HIDDEN = new Set(["banner", "srcdocs-wrap", "glossary", "sub-msg"]);

/**
 * Runs one language's frame code, as the page ran it at start-up. Returns
 * the elements it touched (by id), what it recorded, and a way to read its
 * top-level names. `threw` holds the error if start-up threw, as the page's
 * script would have stopped there.
 */
export function runOldPage(l: Locale, input: OldPageInput) {
  let src = REFERENCE.page(l);
  for (const name of input.on || []) {
    const off = `const ${name} = false;`;
    if (src.split(off).length !== 2) throw new Error(`reference/${l}.page.js: ${off} not found once`);
    src = src.replace(off, `const ${name} = true;`);
  }
  const world = new StubWorld();
  const els = new Map<string, StubEl>();
  const byId = (id: string) => {
    if (!els.has(id)) els.set(id, new StubEl(`#${id}`, world, STARTS_HIDDEN.has(id)));
    return els.get(id)!;
  };
  const blobs: { parts: unknown[]; type: string }[] = [];
  const anchors: StubEl[] = [];
  const warnings: unknown[][] = [];
  const errors: unknown[][] = [];
  const logger = { warn: (...a: unknown[]) => warnings.push(a), error: (...a: unknown[]) => errors.push(a) };
  const ctx = createContext({
    window: { LAUNCH_DATA: input.data, LAUNCH_SOURCES: input.sources, console: logger },
    console: logger,
    document: {
      documentElement: { lang: htmlLang(l) },
      getElementById: byId,
      querySelectorAll: () => [],
      createElement: (tag: string) => {
        const a = new StubEl(`<${tag}>`, world);
        anchors.push(a);
        return a;
      },
      body: { appendChild: (c: unknown) => c },
    },
    Blob: class {
      constructor(parts: unknown[], opts: { type: string }) {
        blobs.push({ parts, type: opts.type });
      }
    },
    URL: { createObjectURL: () => `blob:${blobs.length}` },
    location: { href: input.pageUrl ?? "https://example.org/en/" },
    fetch: input.fetch ?? (() => Promise.reject(new Error("no fetch in this test"))),
  });
  let threw: unknown = null;
  try {
    runInContext(src, ctx, { filename: `tests/golden-frame/reference/${l}.page.js` });
  } catch (e) {
    threw = e;
  }
  return {
    threw,
    el: byId,
    els,
    world,
    blobs,
    anchors,
    warnings,
    errors,
    /** a top-level name of the page's script (a function, constant or let) */
    get: (name: string) => runInContext(name, ctx) as unknown,
  };
}

// ---- the feedback widget ----------------------------------------------------------

export interface OldWidgetInput {
  products: unknown[];
  meta: { lastUpdated?: string; dataStatus?: string };
  connected: boolean;
  fetch?: typeof fetch;
  env: { url: string; path: string; title: string; userAgent: string; now: Date };
}

/**
 * Runs one language's settings script and feedback widget, as the page did,
 * with `connected` as given (the static build turns it off with
 * --api-url none). The widget builds its markup on load; open() fills the
 * medicine list.
 */
export function runOldWidget(l: Locale, input: OldWidgetInput) {
  let src = REFERENCE.feedback(l);
  if (!input.connected) src = src.replace(/(\bconnected\s*:\s*)true\b/g, "$1false");
  const world = new StubWorld();
  const created: StubEl[] = [];
  const docListeners = new Map<string, Listener[]>();
  const ctx = createContext({
    document: {
      createElement: (tag: string) => {
        const e = new StubEl(`<${tag}>`, world);
        created.push(e);
        return e;
      },
      head: { appendChild: (c: unknown) => c },
      body: { appendChild: (c: unknown) => c },
      addEventListener: (type: string, fn: Listener) => docListeners.set(type, [...(docListeners.get(type) || []), fn]),
      title: input.env.title,
    },
    location: { href: input.env.url, pathname: input.env.path, search: "", hash: "" },
    history: { replaceState() {} },
    navigator: { userAgent: input.env.userAgent },
    fetch: input.fetch ?? (() => Promise.reject(new Error("no fetch in this test"))),
    setTimeout,
    console: { warn() {}, info() {} },
  });
  runInContext(
    `var window = globalThis;
    window.LAUNCH_DATA = ${JSON.stringify({ products: input.products, meta: input.meta })};
    window.matchMedia = function () { return { matches: false }; };
    (function (RealDate, now) {
      class PinnedDate extends RealDate {
        constructor(...a) { if (a.length) super(...a); else super(now); }
        static now() { return now; }
      }
      globalThis.Date = PinnedDate;
    })(Date, ${input.env.now.getTime()});`,
    ctx,
  );
  runInContext(src, ctx, { filename: `tests/golden-frame/reference/${l}.feedback.js` });
  const [style, dialog, pill] = created;
  if (!style || !dialog || !pill) throw new Error("the widget did not create its style, dialog and pill");
  const api = runInContext("window.LAUNCH_REPORT_ISSUE", ctx) as { open: (t?: unknown) => void };
  return { style, dialog, pill, api, world, q: (sel: string) => dialog.querySelector(sel) };
}

// ---- HTML, normalised for comparison --------------------------------------------

export type Tok =
  | { t: "open"; name: string; attrs: [string, string][] }
  | { t: "close"; name: string }
  | { t: "text"; text: string };

const VOID = new Set(["img", "input", "br", "hr", "meta", "link", "source", "wbr"]);
// Whitespace next to these tags never shows; next to inline ones (a, span, b,
// code, svg) it does, so it is kept and compared there.
const BLOCK = new Set([
  "div", "p", "section", "header", "footer", "h1", "h2", "h3", "ul", "li", "form", "details",
  "summary", "dialog", "label", "input", "button", "select", "option", "textarea",
]);

const NAMED: { [k: string]: string } = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", times: "×", nbsp: " " };
export function decode(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (all, e: string) =>
    e[0] === "#"
      ? String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10))
      : (NAMED[e] ?? all),
  );
}

/** HTMLOptionElement.text: ASCII whitespace collapsed and stripped. */
const optionText = (s: string) => s.replace(/[\t\n\f\r ]+/g, " ").replace(/^ | $/g, "");

/** Tags, attributes and text of a piece of HTML; comments dropped, entities decoded. */
export function tokenize(html: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < html.length) {
    if (html.startsWith("<!--", i)) {
      const end = html.indexOf("-->", i + 4);
      i = end < 0 ? html.length : end + 3;
      continue;
    }
    if (html[i] === "<" && /[a-zA-Z/]/.test(html[i + 1] ?? "")) {
      let j = i + 1;
      let quote = "";
      for (; j < html.length; j++) {
        const c = html[j];
        if (quote) {
          if (c === quote) quote = "";
        } else if (c === '"' || c === "'") quote = c;
        else if (c === ">") break;
      }
      const raw = html.slice(i + 1, j);
      if (raw[0] === "/") out.push({ t: "close", name: raw.slice(1).trim().toLowerCase() });
      else {
        const self = /\/\s*$/.test(raw);
        const body = self ? raw.replace(/\/\s*$/, "") : raw;
        const name = /^[a-zA-Z][\w-]*/.exec(body)![0].toLowerCase();
        const attrs: [string, string][] = [];
        for (const m of body.slice(name.length).matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) {
          attrs.push([m[1].toLowerCase(), decode(m[2] ?? m[3] ?? m[4] ?? "")]);
        }
        out.push({ t: "open", name, attrs });
        if (self && !VOID.has(name)) out.push({ t: "close", name });
      }
      i = j + 1;
      continue;
    }
    const next = html.indexOf("<", i + 1);
    const end = next < 0 ? html.length : next;
    out.push({ t: "text", text: decode(html.slice(i, end)) });
    i = end;
  }
  return out;
}

/** The element whose start tag matches, with everything inside it. */
export function subtree(toks: Tok[], match: (t: Extract<Tok, { t: "open" }>) => boolean): Tok[] {
  const start = toks.findIndex((t) => t.t === "open" && match(t));
  if (start < 0) throw new Error("no such element");
  return toks.slice(start, end(toks, start) + 1);
}

// index of the end tag closing the element that starts at `start`
function end(toks: Tok[], start: number): number {
  const first = toks[start] as Extract<Tok, { t: "open" }>;
  if (VOID.has(first.name)) return start;
  let depth = 0;
  for (let k = start; k < toks.length; k++) {
    const t = toks[k];
    if (t.t === "open" && !VOID.has(t.name)) depth++;
    else if (t.t === "close" && --depth === 0) return k;
  }
  throw new Error(`<${first.name}> is not closed`);
}

export const attr = (t: Tok, name: string) => (t.t === "open" ? t.attrs.find(([k]) => k === name)?.[1] : undefined);
export const byId = (id: string) => (t: Extract<Tok, { t: "open" }>) => attr(t, "id") === id;

/** Replaces what is inside the element with this id (what an innerHTML assignment did). */
export function fillId(toks: Tok[], id: string, inner: Tok[]): Tok[] {
  const start = toks.findIndex((t) => t.t === "open" && attr(t, "id") === id);
  if (start < 0) throw new Error(`no #${id}`);
  return [...toks.slice(0, start + 1), ...inner, ...toks.slice(end(toks, start))];
}

/** Sets (or, with null, removes) an attribute on the element with this id. */
export function setAttr(toks: Tok[], id: string, name: string, value: string | null): Tok[] {
  return toks.map((t) => {
    if (t.t !== "open" || attr(t, "id") !== id) return t;
    const rest = t.attrs.filter(([k]) => k !== name);
    return { ...t, attrs: value === null ? rest : [...rest, [name, value]] };
  });
}

/**
 * One line per tag or text, comparable as arrays: attributes sorted, class
 * and style spacing evened out, runs of whitespace one space, whitespace next
 * to block-level tags trimmed, whitespace-only text dropped (in this markup
 * it sits only where layout ignores it: between blocks, and between the two
 * children of the flex .attrib link).
 */
export function normalise(toks: Tok[]): string[] {
  const merged: Tok[] = [];
  for (const t of toks) {
    const last = merged[merged.length - 1];
    if (t.t === "text" && last && last.t === "text") merged[merged.length - 1] = { t: "text", text: last.text + t.text };
    else merged.push(t);
  }
  const isBlock = (t: Tok | undefined) => !!t && t.t !== "text" && BLOCK.has(t.name);
  const lines: string[] = [];
  merged.forEach((t, k) => {
    if (t.t === "text") {
      let s = t.text.replace(/[\t\n\f\r ]+/g, " ");
      if (isBlock(merged[k - 1])) s = s.replace(/^ /, "");
      if (isBlock(merged[k + 1])) s = s.replace(/ $/, "");
      if (s.trim()) lines.push(JSON.stringify(s));
    } else if (t.t === "close") lines.push(`</${t.name}>`);
    else {
      const attrs = t.attrs
        .map(([k, v]): [string, string] => [
          k,
          k === "class"
            ? v.trim().split(/\s+/).join(" ")
            : k === "style"
              ? v.split(";").map((d) => d.trim().replace(/\s*:\s*/, ":")).filter(Boolean).join(";")
              : v,
        ])
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, v]) => ` ${k}="${v}"`)
        .join("");
      lines.push(`<${t.name}${attrs}>`);
    }
  });
  return lines;
}
