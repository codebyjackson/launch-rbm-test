// Freezes the static pages' own board code into
// tests/golden-board/reference/{en,fr,pt}.js, which tests/golden-board.test.ts
// (lib/board.ts) and tests/markup-board.test.ts (components/board/) run as
// the reference.
//
//   node tests/golden-board/extract.mjs           write the three files
//   node tests/golden-board/extract.mjs --check   exit 1 if any file would change
//
// Each page is read as it was at COMMIT through git, not from the working
// tree, so this still works once the static pages are deleted from the branch.
// Only whole top-level statements of the page's main script are copied, each
// verbatim with the comments above it; nothing is rewritten. The page's stage
// icons (assets/journey-icons/icons-solid.js) come first, verbatim, since the
// markup draws them.
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as acorn from "acorn";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const OUT = fileURLToPath(new URL("./reference/", import.meta.url));
const COMMIT = "7c1bf11";
const LOCALES = ["en", "fr", "pt"];
const ICONS = "assets/journey-icons/icons-solid.js";

// The functions the tests call, and every top-level name they read. The
// display switches are copied as the page ships them.
const NAMES = [
  "DATA", "STAGES", "PRODUCTS", "STAGE_COLUMNS", "colIndexOf", "preBoundaryDone", "ICON", "LABEL",
  "LATE_DEF", "lateInfo", "SHOW_PROGRESS", "PROGRESS_KEPT", "SHOW_BARRIERS", "SHOW_STAGE_NOTE",
  "SHOW_LATE", "statusShown", "JI", "WHO_STAGES", "stageIconImg", "PAGE_LANG", "DATE_LANG", "tracked",
  "esc", "SRC_BY_ID", "citeLinks", "citeHtml", "shortDate", "COMPACT", "fmtFig",
  "firstClause", "peekLine", "peekLineFor", "stageYear", "ASOF_YEAR", "yrsText", "firstYear",
  "phaseReached", "reachedText", "soFarText", "accessParts", "ACCESS_DEF", "accessInfo", "accessCell",
  "accessLine", "sinceFrom", "sinceFor", "YARD", "YARD_COMPARE", "varianceText", "ACCESS_SPLIT",
  "PHASES", "phaseOf", "sinceYearOf", "yardstick", "yardResult", "yardPill", "yardNote", "yardBadge",
  "yardBox", "yardTable", "countryAccessKv", "miniJourney", "highlightStep", "stageMarkHtml",
  "journeyTime", "fitTimeline", "lateAt", "alignStageForks", "FORK_R", "FORK_NODE", "drawStageForks",
  "nowYear", "stalledSince", "gatePanelHTML", "GLOSS", "terms",
];

// The statements copied that declare nothing, each found by how it starts:
// the start-up rewrite of "late" as "prog", the board's header row and its
// nobar class, the row loop, the placeholder rows, and the glossary pass over
// the rows.
const STATEMENTS = [
  "if (!SHOW_LATE) PRODUCTS.forEach(",
  'board.insertAdjacentHTML("afterbegin",',
  'if (!SHOW_BARRIERS) board.classList.add("nobar");',
  "tracked.forEach(p => {",
  "PRODUCTS.filter(p => p.placeholder).forEach(",
  "if (terms.length) {",
];

const fail = (msg) => {
  console.error(`extract.mjs: ${msg}`);
  process.exit(1);
};

const declared = (st) =>
  st.type === "FunctionDeclaration" ? [st.id.name]
  : st.type === "VariableDeclaration" ? st.declarations.map((d) => d.id.name)
  : [];

const git = (path) =>
  execFileSync("git", ["-C", ROOT, "show", `${COMMIT}:${path}`], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

function reference(lang) {
  const html = git(`${lang}/index.html`);
  const htmlLang = (html.match(/<html\s+lang="([^"]+)"/) || [])[1];
  if (!htmlLang) fail(`${lang}/index.html has no <html lang>`);

  const OPEN = '<script type="text/x-launch-app">';
  const at = html.indexOf(OPEN);
  if (at < 0 || html.indexOf(OPEN, at + 1) >= 0) fail(`${lang}/index.html: expected one ${OPEN} block`);
  const start = at + OPEN.length;
  const src = html.slice(start, html.indexOf("</script>", start));
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
  const statements = new Map();
  const parts = [];
  body.forEach((st, k) => {
    const names = declared(st);
    const wanted = names.filter((n) => NAMES.includes(n));
    const stmt = names.length ? null : STATEMENTS.find((p) => src.startsWith(p, st.start));
    if (!wanted.length && !stmt) return;
    if (wanted.length && wanted.length !== names.length) fail(`${lang}: ${names.join(", ")} share one statement; copy all or none`);
    for (const n of wanted) {
      if (found.has(n)) fail(`${lang}: ${n} is declared twice`);
      found.set(n, st);
    }
    if (stmt) {
      if (statements.has(stmt)) fail(`${lang}: "${stmt}" appears twice`);
      statements.set(stmt, st);
    }
    // the comments above it, back to the statement before
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
  const absent = STATEMENTS.filter((p) => !statements.has(p));
  if (absent.length) fail(`${lang}: statements not found: ${absent.join(" | ")}`);

  return `// GENERATED by tests/golden-board/extract.mjs. Do not edit; regenerate instead.
//
// The reference for tests/golden-board.test.ts and tests/markup-board.test.ts:
// the static page's own board code, frozen. Source: launch-rbm-test commit
// ${COMMIT}: first ${ICONS} whole, then from ${lang}/index.html, the
// <script type="text/x-launch-app"> block, every top-level declaration the
// tests call and every one those read, and the statements that build the
// board, copied verbatim with the comments above them, in page order; each
// "@@" line gives its line in the page. Everything else (events, MapLibre,
// the pathway strip) is left out.
//
// It reads window.LAUNCH_DATA and window.LAUNCH_SOURCES, the page's <html
// lang> as document.documentElement.lang, and the names the tests supply in
// place of the page's DOM: board, el, timelineFit, document, NodeFilter.
// html-lang: ${htmlLang}

// @@ ${ICONS}
${git(ICONS)}
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
      console.error(`stale: tests/golden-board/reference/${lang}.js`);
      stale++;
    }
  } else {
    writeFileSync(file, text);
    console.log(`wrote tests/golden-board/reference/${lang}.js (${text.split("\n").length} lines)`);
  }
}
if (check) {
  if (stale) process.exit(1);
  console.log("tests/golden-board/reference/ matches the pages at " + COMMIT);
}
