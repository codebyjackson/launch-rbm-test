// Freezes the static pages' own stage and formatting logic into
// tests/golden/reference/{en,fr,pt}.js, which tests/golden.test.ts runs as the
// reference for lib/format.ts and lib/stages.ts.
//
//   node tests/golden/extract.mjs           write the three files
//   node tests/golden/extract.mjs --check   exit 1 if any file would change
//
// Each page is read as it was at COMMIT through git, not from the working
// tree, so this still works once the static pages are deleted from the branch.
// Only whole top-level declarations of the page's main script are copied, each
// verbatim with the comments above it; nothing is rewritten. The fr and pt
// pages are the same code with the translations written into it, which is why
// each language has its own reference.
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as acorn from "acorn";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const OUT = fileURLToPath(new URL("./reference/", import.meta.url));
const COMMIT = "7c1bf11";
const LOCALES = ["en", "fr", "pt"];

// The functions the golden test calls, and every top-level name they read.
// The page reads its data through these constants, not the globals directly,
// so they come too; the display switches are copied as the page ships them.
const NAMES = [
  "DATA", "STAGES", "PRODUCTS", "STAGE_COLUMNS", "LABEL",
  "SHOW_PROGRESS", "PROGRESS_KEPT", "SHOW_LATE", "statusShown",
  "PAGE_LANG", "DATE_LANG",
  "esc", "SRC_BY_ID", "citeLinks", "citeHtml", "readableDate", "shortDate", "COMPACT", "fmtFig",
  "firstClause", "peekLine", "peekLineFor",
  "stageYear", "ASOF_YEAR", "yrsText", "firstYear", "phaseReached", "reachedText", "soFarText",
  "accessParts", "accessLine", "sinceFrom", "sinceFor",
  "YARD", "YARD_COMPARE", "varianceText", "ACCESS_SPLIT", "PHASES", "phaseOf", "sinceYearOf",
  "yardstick", "yardResult",
];

// The one statement copied that declares nothing: at start-up the page
// rewrites every "late" status as "prog" (SHOW_LATE), before any function
// runs, so every function above only ever sees the rewritten data.
const isShowLate = (st) =>
  st.type === "IfStatement" &&
  st.test.type === "UnaryExpression" &&
  st.test.operator === "!" &&
  st.test.argument.type === "Identifier" &&
  st.test.argument.name === "SHOW_LATE";

const fail = (msg) => {
  console.error(`extract.mjs: ${msg}`);
  process.exit(1);
};

const declared = (st) =>
  st.type === "FunctionDeclaration" ? [st.id.name]
  : st.type === "VariableDeclaration" ? st.declarations.map((d) => d.id.name)
  : [];

function reference(lang) {
  const html = execFileSync("git", ["-C", ROOT, "show", `${COMMIT}:${lang}/index.html`], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  const htmlLang = (html.match(/<html\s+lang="([^"]+)"/) || [])[1];
  if (!htmlLang) fail(`${lang}/index.html has no <html lang>`);

  const OPEN = '<script type="text/x-launch-app">';
  const at = html.indexOf(OPEN);
  if (at < 0 || html.indexOf(OPEN, at + 1) >= 0) fail(`${lang}/index.html: expected one ${OPEN} block`);
  const start = at + OPEN.length;
  const src = html.slice(start, html.indexOf("</script>", start));
  // the page line of the script's first line, for the "@@" markers
  const lineBase = html.slice(0, start).split("\n").length;

  const comments = [];
  const ast = acorn.parse(src, { ecmaVersion: "latest", sourceType: "script", locations: true, onComment: comments });
  const iife = ast.body.length === 1 && ast.body[0].type === "ExpressionStatement" && ast.body[0].expression.callee;
  if (!iife || iife.type !== "FunctionExpression") fail(`${lang}: the app script is not one IIFE`);
  const body = iife.body.body;

  const lineStart = (pos) => src.lastIndexOf("\n", pos - 1) + 1;
  const lineEnd = (pos) => {
    const n = src.indexOf("\n", pos);
    return n < 0 ? src.length : n;
  };

  const found = new Map();
  const parts = [];
  body.forEach((st, k) => {
    const names = declared(st);
    const wanted = names.filter((n) => NAMES.includes(n));
    if (!wanted.length && !isShowLate(st)) return;
    if (wanted.length !== names.length) fail(`${lang}: ${names.join(", ")} share one statement; copy all or none`);
    for (const n of wanted) {
      if (found.has(n)) fail(`${lang}: ${n} is declared twice`);
      found.set(n, st);
    }
    // the comments above it, back to the statement before; a comment on that
    // statement's own last line belongs to it, not to this one
    const prevEnd = k ? body[k - 1].end : iife.body.start + 1;
    const prevLine = src.slice(0, prevEnd).split("\n").length;
    const above = comments.filter(
      (c) => c.start >= prevEnd && c.end <= st.start && src.slice(0, c.start).split("\n").length > prevLine,
    );
    const from = lineStart(above.length ? above[0].start : st.start);
    const to = lineEnd(st.end);
    if (src.slice(from, above.length ? above[0].start : st.start).trim()) fail(`${lang}: code before line ${st.loc.start.line}`);
    const tail = src.slice(st.end, to).trim();
    if (tail && !tail.startsWith("//")) fail(`${lang}: code after line ${st.loc.end.line}`);
    parts.push(`// @@ ${lang}/index.html:${lineBase + st.loc.start.line - 1}\n${src.slice(from, to)}\n`);
  });
  const missing = NAMES.filter((n) => !found.has(n));
  if (missing.length) fail(`${lang}: not found at top level: ${missing.join(", ")}`);
  if (parts.length !== new Set(found.values()).size + 1) fail(`${lang}: the SHOW_LATE statement is not there exactly once`);

  return `// GENERATED by tests/golden/extract.mjs. Do not edit; regenerate instead.
//
// The reference for tests/golden.test.ts: the static page's own code, frozen.
// Source: launch-rbm-test commit ${COMMIT}, ${lang}/index.html, the
// <script type="text/x-launch-app"> block. Every top-level declaration the
// golden test calls, and every one those read, copied verbatim with the
// comments above it, in page order; each "@@" line gives its line in the page.
// Everything else in the script (DOM, events, MapLibre, markup) is left out.
//
// It reads window.LAUNCH_DATA and window.LAUNCH_SOURCES, and the page's
// <html lang> as document.documentElement.lang, which the test supplies:
// html-lang: ${htmlLang}

${parts.join("\n")}`;
}

const check = process.argv.includes("--check");
mkdirSync(OUT, { recursive: true });
let stale = 0;
for (const lang of LOCALES) {
  const file = `${OUT}${lang}.js`;
  const text = reference(lang);
  if (check) {
    let old = "";
    try {
      old = readFileSync(file, "utf8");
    } catch {}
    if (old !== text) {
      console.error(`stale: tests/golden/reference/${lang}.js`);
      stale++;
    }
  } else {
    writeFileSync(file, text);
    console.log(`wrote tests/golden/reference/${lang}.js (${text.split("\n").length} lines)`);
  }
}
if (check) {
  if (stale) process.exit(1);
  console.log("tests/golden/reference/ matches the pages at " + COMMIT);
}
