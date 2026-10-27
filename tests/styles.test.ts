// styles/launch-dashboard.css and styles/feedback.css: every rule stays
// inside the .launch-dashboard fence, so the dashboard's CSS cannot restyle
// RBM's page around it. feedback.css is also checked against the feedback
// widget's own stylesheet, rule for rule.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const ROOT = ".launch-dashboard";
const CSS = readFileSync(new URL("../styles/launch-dashboard.css", import.meta.url), "utf8");
const FEEDBACK_CSS = readFileSync(new URL("../styles/feedback.css", import.meta.url), "utf8");

// ---------- a small CSS tokenizer, enough for this file ----------
// It reads style rules, block at-rules (@media, @supports, @keyframes,
// @font-face …) and statement at-rules (@import …). Anything else stops it:
// CSS nesting (a "{" inside a rule's declarations) and unknown block at-rules
// throw, so a construct it cannot read fails the test instead of slipping
// past the checks.

// `media` is the chain of grouping at-rules around the rule ("" at top level).
type StyleRule = { selectors: string[]; declarations: { property: string; value: string }[]; line: number; media: string };
type Parsed = { rules: StyleRule[]; keyframes: string[]; statements: string[] };

// Comments and the inside of strings become spaces (newlines kept), so a "{"
// or "," inside them cannot be mistaken for structure. Same length as the
// input, so positions carry over.
function mask(css: string): string {
  let out = "";
  let i = 0;
  while (i < css.length) {
    if (css.startsWith("/*", i)) {
      const end = css.indexOf("*/", i + 2);
      if (end < 0) throw new Error("unclosed comment");
      out += css.slice(i, end + 2).replace(/[^\n]/g, " ");
      i = end + 2;
    } else if (css[i] === '"' || css[i] === "'") {
      const quote = css[i];
      let j = i + 1;
      while (j < css.length && css[j] !== quote) j += css[j] === "\\" ? 2 : 1;
      if (j >= css.length) throw new Error("unclosed string");
      out += quote + " ".repeat(j - i - 1) + quote;
      i = j + 1;
    } else {
      out += css[i];
      i++;
    }
  }
  return out;
}

// Splits at sep outside (), [].
function splitTop(text: string, sep: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let last = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === "(" || c === "[") depth++;
    else if (c === ")" || c === "]") depth--;
    else if (c === sep && depth === 0) {
      parts.push(text.slice(last, i));
      last = i + 1;
    }
  }
  parts.push(text.slice(last));
  return parts;
}

const GROUPING = new Set(["media", "supports", "container", "layer"]);
const OPAQUE = new Set(["keyframes", "-webkit-keyframes", "font-face"]);

function parse(css: string): Parsed {
  const m = mask(css);
  const parsed: Parsed = { rules: [], keyframes: [], statements: [] };
  const lineAt = (i: number) => m.slice(0, i).split("\n").length;

  const matching = (open: number): number => {
    let depth = 0;
    for (let i = open; i < m.length; i++) {
      if (m[i] === "{") depth++;
      else if (m[i] === "}" && --depth === 0) return i;
    }
    throw new Error(`line ${lineAt(open)}: no closing brace`);
  };

  const blockList = (start: number, end: number, media = ""): void => {
    let i = start;
    while (i < end) {
      if (/\s/.test(m[i])) {
        i++;
        continue;
      }
      let j = i;
      while (j < end && m[j] !== "{" && m[j] !== ";" && m[j] !== "}") j++;
      if (j >= end || m[j] === "}") throw new Error(`line ${lineAt(i)}: text outside any rule`);
      const prelude = m.slice(i, j).trim();
      if (m[j] === ";") {
        if (!prelude.startsWith("@")) throw new Error(`line ${lineAt(i)}: declaration outside a rule`);
        parsed.statements.push(prelude);
        i = j + 1;
        continue;
      }
      const close = matching(j);
      if (close >= end) throw new Error(`line ${lineAt(i)}: block runs past its parent`);
      if (prelude.startsWith("@")) {
        const name = /^@([\w-]+)/.exec(prelude)?.[1].toLowerCase() ?? "";
        if (GROUPING.has(name)) blockList(j + 1, close, (media ? media + " " : "") + prelude.replace(/\s+/g, " "));
        else if (OPAQUE.has(name)) {
          if (name !== "font-face") parsed.keyframes.push(prelude.split(/\s+/)[1] ?? "");
        } else throw new Error(`line ${lineAt(i)}: @${name} is not read by this tokenizer`);
      } else {
        const body = m.slice(j + 1, close);
        if (body.includes("{")) throw new Error(`line ${lineAt(i)}: a rule inside a rule (CSS nesting) is not read by this tokenizer`);
        parsed.rules.push({
          selectors: splitTop(prelude, ",").map((s) => s.trim()),
          declarations: splitTop(body, ";")
            .map((d) => d.trim())
            .filter(Boolean)
            .map((d) => {
              const colon = d.indexOf(":");
              return { property: d.slice(0, colon).trim().toLowerCase(), value: d.slice(colon + 1).trim() };
            }),
          line: lineAt(i),
          media,
        });
      }
      i = close + 1;
    }
  };

  blockList(0, m.length);
  return parsed;
}

// ---------- the checks: each returns what is wrong, empty when nothing is ----------

// In the fence: the selector starts with the root class, and the first
// combinator after the root's own compound goes down (" " or ">"). "+" or "~"
// would reach RBM's elements beside the root.
function fencedIn(selector: string): boolean {
  if (!new RegExp(`^${ROOT.replace(".", "\\.")}(?![\\w-])`).test(selector)) return false;
  let depth = 0;
  for (let i = ROOT.length; i < selector.length; i++) {
    const c = selector[i];
    if (c === "(" || c === "[") depth++;
    else if (c === ")" || c === "]") depth--;
    else if (depth === 0 && /[\s>+~]/.test(c)) {
      const combinator = selector.slice(i).trimStart()[0];
      return combinator !== "+" && combinator !== "~";
    }
  }
  return true;
}

const unscoped = (p: Parsed) =>
  p.rules.flatMap((r) => r.selectors.filter((s) => !fencedIn(s)).map((s) => `line ${r.line}: ${s}`));

const rootSelectors = (p: Parsed) =>
  p.rules.flatMap((r) =>
    r.selectors
      .filter((s) => /:root(?![\w-])/i.test(s) || /(^|[\s>+~(,])(html|body)(?![\w-])/i.test(s))
      .map((s) => `line ${r.line}: ${s}`),
  );

// Words in an animation value that are not a name: keywords, times, counts.
const NOT_A_NAME = new Set([
  "none", "initial", "inherit", "unset", "revert", "revert-layer", "infinite",
  "normal", "reverse", "alternate", "alternate-reverse", "forwards", "backwards", "both",
  "running", "paused", "ease", "ease-in", "ease-out", "ease-in-out", "linear", "step-start", "step-end",
]);

function animationRefs(p: Parsed): { name: string; line: number }[] {
  return p.rules.flatMap((r) =>
    r.declarations
      .filter((d) => d.property === "animation" || d.property === "animation-name")
      .flatMap((d) =>
        splitTop(d.value, ",").flatMap((item) =>
          item
            .replace(/[\w-]+\([^)]*\)/g, " ") // cubic-bezier(), steps()
            .trim()
            .split(/\s+/)
            .filter((t) => t && !NOT_A_NAME.has(t.toLowerCase()) && !/^[\d.]+(m?s)?$/i.test(t)),
        ),
      )
      .map((name) => ({ name, line: r.line })),
  );
}

const badAnimations = (p: Parsed) =>
  animationRefs(p)
    .filter((a) => !a.name.startsWith("ld-") || !p.keyframes.includes(a.name))
    .map((a) => `line ${a.line}: ${a.name}`);

// ---------- tests ----------

describe("the checks themselves", () => {
  // A checker that finds nothing passes forever, so prove each one can fail.
  const sample = parse(`
    /* a comment with { braces, commas } and body */
    body { margin: 0 }
    .x, ${ROOT} .y { color: red }
    ${ROOT} + p, ${ROOT}-other .z { color: red }
    @media print { html .w, ${ROOT}.on .v { color: red } }
    ${ROOT} .a[title="html, body"] { animation: spin 1s linear infinite }
    ${ROOT} .b { animation: ld-gone 2s }
    @keyframes spin { from { opacity: 0 } to { opacity: 1 } }
  `);

  it("finds unscoped selectors, including inside @media", () => {
    expect(unscoped(sample).map((s) => s.replace(/^line \d+: /, ""))).toEqual([
      "body", ".x", `${ROOT} + p`, `${ROOT}-other .z`, "html .w",
    ]);
  });

  it("finds :root, html and body, but not inside an attribute value", () => {
    expect(rootSelectors(sample).map((s) => s.replace(/^line \d+: /, ""))).toEqual(["body", "html .w"]);
  });

  it("finds animations without an ld- keyframe, or with one that does not exist", () => {
    expect(badAnimations(sample).map((s) => s.replace(/^line \d+: /, ""))).toEqual(["spin", "ld-gone"]);
  });

  it("refuses CSS nesting rather than reading past it", () => {
    expect(() => parse(`${ROOT} .a { color: red; .b { color: blue } }`)).toThrow(/nesting/);
  });
});

for (const [file, css] of [["styles/launch-dashboard.css", CSS], ["styles/feedback.css", FEEDBACK_CSS]] as const) {
  describe(file, () => {
    const parsed = parse(css);

    it("scopes every selector under .launch-dashboard", () => {
      expect(parsed.rules.length).toBeGreaterThan(0);
      expect(unscoped(parsed)).toEqual([]);
    });

    it("has no :root, html or body selector left", () => {
      expect(rootSelectors(parsed)).toEqual([]);
    });

    it("names only ld- keyframes in animations, and each one exists", () => {
      expect(parsed.keyframes.filter((k) => !k.startsWith("ld-"))).toEqual([]);
      expect(animationRefs(parsed).length).toBeGreaterThan(0);
      expect(badAnimations(parsed)).toEqual([]);
    });
  });
}

// ---- feedback.css against the widget ----------------------------------------

// The widget's stylesheet as the page injected it: the CSS array in
// assets/report-issue.js at launch-rbm-test 7c1bf11, frozen with the page by
// tests/golden-frame/extract.mjs.
function widgetCss(lang: string): string {
  const js = readFileSync(new URL(`./golden-frame/reference/${lang}.feedback.js`, import.meta.url), "utf8");
  const start = js.indexOf("var CSS = [");
  const end = js.indexOf('].join("")', start);
  if (start < 0 || end < 0) throw new Error(`reference/${lang}.feedback.js: no CSS array`);
  return (new Function(`return [${js.slice(start + "var CSS = [".length, end)}]`)() as string[]).join("");
}

// A rule as compared: where it sits, its selectors, and its declarations.
const shape = (p: Parsed) =>
  p.rules.map((r) => ({
    media: r.media,
    selectors: r.selectors,
    declarations: r.declarations.map((d) => `${d.property}:${d.value}`),
  }));

describe("styles/feedback.css: the widget's stylesheet, fenced", () => {
  const marker = FEEDBACK_CSS.indexOf("---------- 2.");
  const widgetPart = parse(FEEDBACK_CSS.slice(0, FEEDBACK_CSS.lastIndexOf("\n", marker)));
  const skinPart = parse(FEEDBACK_CSS.slice(FEEDBACK_CSS.indexOf("\n", marker)));

  it("is the same in every language", () => {
    expect(widgetCss("fr")).toBe(widgetCss("en"));
    expect(widgetCss("pt")).toBe(widgetCss("en"));
  });

  it("part 1 is the widget's CSS rule for rule, with only the fence and the keyframe name added", () => {
    const old = parse(widgetCss("en"));
    const fenced = shape(old).map((r) => ({
      media: r.media,
      selectors: r.selectors.map((s) => `${ROOT} ${s}`),
      declarations: r.declarations.map((d) => d.replace(/^animation:ri-spin\b/, "animation:ld-ri-spin")),
    }));
    expect(shape(widgetPart)).toEqual(fenced);
    expect(widgetPart.keyframes).toEqual(old.keyframes.map((k) => `ld-${k}`));
  });

  it("part 2 is the skin's five rules for the widget, after it", () => {
    expect(skinPart.rules.map((r) => r.selectors.join(", "))).toEqual([
      `${ROOT} .ri-dialog`,
      `${ROOT} .ri-head`,
      `${ROOT} .ri-dialog::backdrop`,
      `${ROOT} .ri-btn, ${ROOT} .ri-input, ${ROOT} .ri-select, ${ROOT} .ri-textarea`,
      `${ROOT} .ri-primary:hover`,
    ]);
  });

  // Ties between the two files would be decided by load order, which nothing
  // here controls. launch-dashboard.css keeps one .ri- rule, and it sets
  // nothing the widget sets.
  it("leaves launch-dashboard.css no .ri- rule that could tie with it", () => {
    const left = parse(CSS).rules.filter((r) => r.selectors.some((s) => /\.ri-/.test(s)));
    expect(left.map((r) => r.selectors.join(", "))).toEqual([`${ROOT}.sub-open .ri-pill`]);
    const pillProps = new Set(
      widgetPart.rules.filter((r) => r.selectors.includes(`${ROOT} .ri-pill`)).flatMap((r) => r.declarations.map((d) => d.property)),
    );
    expect(left[0].declarations.map((d) => d.property).filter((p) => pillProps.has(p))).toEqual([]);
  });
});
