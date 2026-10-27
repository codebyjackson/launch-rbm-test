// Freezes the static pages' own pathway code into
// tests/golden-pathway/reference/{en,fr,pt}.js, plus the page's icon set as
// reference/icons-solid.js. tests/golden-pathway.test.ts runs them as the
// reference for lib/pathway.ts, and tests/markup-pathway.test.ts as the
// reference for the markup of components/pathway/.
//
//   node tests/golden-pathway/extract.mjs           write the files
//   node tests/golden-pathway/extract.mjs --check   exit 1 if any file would change
//
// Each page is read as it was at COMMIT through git, not from the working
// tree, so this still works once the static pages are deleted from the
// branch. Only whole top-level statements of the page's main script are
// copied, each verbatim with the comments above it; nothing is rewritten.
// Same method as tests/golden/extract.mjs, which freezes the stage rules.
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
// markup builders come with the helpers and switches they use; showTipAt is
// left out on purpose, so the test can catch what showStageTip passes it.
const NAMES = [
  "board", "DATA", "STAGES", "PRODUCTS", "STAGE_COLUMNS", "colIndexOf", "LABEL",
  "SHOW_PROGRESS", "PROGRESS_KEPT", "SHOW_BARRIERS", "SHOW_LATE", "statusShown",
  "JI", "WHO_STAGES", "stageIconImg", "PAGE_LANG", "DATE_LANG", "tracked",
  "esc", "SRC_BY_ID", "citeLinks", "citeHtml", "shortDate", "pathway", "firstClause", "peekLine",
  "yrsText", "YARD", "SHOW_STAGE_EXPECTED", "ACCESS_SPLIT", "PHASES", "phaseOf", "pathExpHtml",
  "countryAccessKv", "highlightStep", "lateAt", "stepNo", "pathNodeHtml", "stepColumnHtml",
  "nowYear", "stalledSince", "gatePanelHTML", "openGate", "closeGate", "STATUS_NOUN",
  "openGatePanel", "showStageTip",
];

// The two statements copied that declare nothing. At start-up the page
// rewrites every "late" status as "prog" (SHOW_LATE) before any function
// runs; and one statement fills #pathway with the strip.
const isShowLate = (st) =>
  st.type === "IfStatement" &&
  st.test.type === "UnaryExpression" &&
  st.test.operator === "!" &&
  st.test.argument.type === "Identifier" &&
  st.test.argument.name === "SHOW_LATE";
const isStripFill = (st) =>
  st.type === "ExpressionStatement" &&
  st.expression.type === "AssignmentExpression" &&
  st.expression.left.type === "MemberExpression" &&
  st.expression.left.object.type === "Identifier" &&
  st.expression.left.object.name === "pathway" &&
  st.expression.left.property.name === "innerHTML";

// The page's own markup for the three elements, as the HTML has them before
// the script runs, one line each.
const STATIC = [
  /<div class="pathway" id="pathway"[^>]*><\/div>/,
  /<div class="gatewrap" id="gatewrap"[^>]*><\/div>/,
  /<div id="tip"[^>]*><\/div>/,
];

const fail = (msg) => {
  console.error(`extract.mjs: ${msg}`);
  process.exit(1);
};

const declared = (st) =>
  st.type === "FunctionDeclaration" ? [st.id.name]
  : st.type === "VariableDeclaration" ? st.declarations.map((d) => d.id.name)
  : [];

const show = (path) =>
  execFileSync("git", ["-C", ROOT, "show", `${COMMIT}:${path}`], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

function reference(lang) {
  const html = show(`${lang}/index.html`);
  const htmlLang = (html.match(/<html\s+lang="([^"]+)"/) || [])[1];
  if (!htmlLang) fail(`${lang}/index.html has no <html lang>`);
  const statics = STATIC.map((re) => {
    const all = html.match(new RegExp(re.source, "g")) || [];
    if (all.length !== 1) fail(`${lang}/index.html: expected one ${re.source}, found ${all.length}`);
    return all[0];
  });

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
  const special = { showLate: 0, stripFill: 0 };
  const parts = [];
  body.forEach((st, k) => {
    const names = declared(st);
    const wanted = names.filter((n) => NAMES.includes(n));
    const showLate = isShowLate(st);
    const stripFill = isStripFill(st);
    if (!wanted.length && !showLate && !stripFill) return;
    if (wanted.length !== names.length) fail(`${lang}: ${names.join(", ")} share one statement; copy all or none`);
    for (const n of wanted) {
      if (found.has(n)) fail(`${lang}: ${n} is declared twice`);
      found.set(n, st);
    }
    if (showLate) special.showLate++;
    if (stripFill) special.stripFill++;
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
  if (special.showLate !== 1) fail(`${lang}: the SHOW_LATE statement is not there exactly once`);
  if (special.stripFill !== 1) fail(`${lang}: the pathway.innerHTML statement is not there exactly once`);

  return `// GENERATED by tests/golden-pathway/extract.mjs. Do not edit; regenerate instead.
//
// The reference for tests/golden-pathway.test.ts and tests/markup-pathway.test.ts:
// the static page's own pathway code, frozen. Source: launch-rbm-test commit
// ${COMMIT}, ${lang}/index.html, the <script type="text/x-launch-app"> block.
// Every top-level declaration the tests call, and every one those read,
// copied verbatim with the comments above it, in page order, with the two
// statements that declare nothing (the SHOW_LATE rewrite and the one that
// fills #pathway); each "@@" line gives its line in the page.
//
// It reads window.LAUNCH_DATA, window.LAUNCH_SOURCES and
// window.LaunchJourneyIconsSolid (reference/icons-solid.js), the page's
// <html lang>, document.getElementById for #board, #pathway and #gatewrap,
// and showTipAt, all of which the tests supply:
// html-lang: ${htmlLang}
//
// The three elements as the page's HTML has them before the script runs:
${statics.map((s) => `// static-markup: ${s}`).join("\n")}

${parts.join("\n")}`;
}

function icons() {
  return `// GENERATED by tests/golden-pathway/extract.mjs. Do not edit; regenerate instead.
//
// The page's icon set, frozen: launch-rbm-test commit ${COMMIT}, ${ICONS}, verbatim.
// It sets window.LaunchJourneyIconsSolid, which the page's stageIconImg reads.

${show(ICONS)}`;
}

const check = process.argv.includes("--check");
mkdirSync(OUT, { recursive: true });
let stale = 0;
const files = [...LOCALES.map((l) => [`${l}.js`, () => reference(l)]), ["icons-solid.js", icons]];
for (const [name, make] of files) {
  const file = `${OUT}${name}`;
  const text = make();
  if (check) {
    let old = "";
    try {
      old = readFileSync(file, "utf8");
    } catch {}
    if (old !== text) {
      console.error(`stale: tests/golden-pathway/reference/${name}`);
      stale++;
    }
  } else {
    writeFileSync(file, text);
    console.log(`wrote tests/golden-pathway/reference/${name} (${text.split("\n").length} lines)`);
  }
}
if (check) {
  if (stale) process.exit(1);
  console.log("tests/golden-pathway/reference/ matches the pages at " + COMMIT);
}
