// Freezes the static pages' own frame code and markup into
// tests/golden-frame/reference/, which tests/golden-frame.test.ts and
// tests/markup-frame.test.ts run and compare against:
//
//   {lang}.page.js      the main script's frame logic: the header date, the
//                       banner, `tracked`, the CSV, Subscribe's request and
//                       submit handler, the Sources list, the disclaimer's
//                       country line, the Definitions list; and the loader's
//                       two messages (MSG)
//   {lang}.markup.html  the page's <header>, #banner and <footer>, as served
//   {lang}.feedback.js  the page's LAUNCH_FEEDBACK_COPY script, then the
//                       feedback widget (assets/report-issue.js), both verbatim
//
//   node tests/golden-frame/extract.mjs           write the files
//   node tests/golden-frame/extract.mjs --check   exit 1 if any file would change
//
// Read through git at COMMIT, not from the working tree, so this still works
// once the static pages are deleted from the branch. Whole top-level
// statements only, each verbatim with the comments above it; nothing is
// rewritten. Same approach as tests/golden/extract.mjs.
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as acorn from "acorn";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const OUT = fileURLToPath(new URL("./reference/", import.meta.url));
const COMMIT = "7c1bf11";
const LOCALES = ["en", "fr", "pt"];

// Top-level declarations of the main script the tests run, and every one
// those read. openSub/closeSub and the other Subscribe listeners are not
// here: they only show, hide and focus, which the markup test covers.
const NAMES = [
  "banner", "DATA", "STAGES", "PRODUCTS", "LABEL", "SHOW_PROGRESS", "PROGRESS_KEPT", "SHOW_LATE",
  "statusShown", "PAGE_LANG", "DATE_LANG", "dt", "status", "BANNERS", "tracked", "esc",
  "GLOSS", "terms", "csvCell", "subscribeEmail", "subForm", "subFirst", "subLast", "subMail",
  "subOrg", "subMsg", "subGo", "subBusy", "subSay", "CSV_COL", "CSV_REC",
];

// Top-level statements that declare nothing, by how they begin. Each must be
// found exactly once.
const STATEMENTS = [
  "if (!SHOW_LATE)", // late reads as in progress, applied once at start-up
  'document.getElementById("updated").textContent', // the header's date line
  "if (BANNERS[status])", // the banner
  "if (terms.length)", // the Definitions list (and the board's inline terms, which find no board here)
  'subForm.addEventListener("submit"', // Subscribe's submit handler
  'document.getElementById("dl-csv").addEventListener("click"', // the CSV download
  "(function renderSources()", // the Sources list
  "(function renderDisclaimer()", // the disclaimer's country line
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

// Copies the wanted statements of an IIFE's body, each with its comments.
function excerpts(src, lineBase, lang, wantName, wantStatement) {
  const comments = [];
  const ast = acorn.parse(src, { ecmaVersion: "latest", sourceType: "script", locations: true, onComment: comments });
  const call = ast.body.find((st) => st.type === "ExpressionStatement" && st.expression.type === "CallExpression");
  const fn = call && call.expression.callee;
  if (!fn || fn.type !== "FunctionExpression") fail(`${lang}: the script is not an IIFE`);
  const body = fn.body.body;
  const lineStart = (pos) => src.lastIndexOf("\n", pos - 1) + 1;
  const lineEnd = (pos) => {
    const n = src.indexOf("\n", pos);
    return n < 0 ? src.length : n;
  };
  const parts = [];
  const hits = new Map();
  body.forEach((st, k) => {
    const names = declared(st);
    const wanted = names.filter(wantName);
    const sig = names.length ? null : wantStatement(src.slice(st.start, st.end));
    if (!wanted.length && !sig) return;
    if (wanted.length && wanted.length !== names.length) fail(`${lang}: ${names.join(", ")} share one statement; copy all or none`);
    for (const key of sig ? [sig] : wanted) {
      if (hits.has(key)) fail(`${lang}: ${key} found twice`);
      hits.set(key, true);
    }
    const prevEnd = k ? body[k - 1].end : fn.body.start + 1;
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
  return { parts, hits };
}

function scriptAt(html, open, lang) {
  const at = html.indexOf(open);
  if (at < 0 || html.indexOf(open, at + 1) >= 0) fail(`${lang}/index.html: expected one ${open}`);
  const start = at + open.length;
  return { src: html.slice(start, html.indexOf("</script>", start)), lineBase: html.slice(0, start).split("\n").length };
}

function page(lang, html) {
  const htmlLang = (html.match(/<html\s+lang="([^"]+)"/) || [])[1];
  if (!htmlLang) fail(`${lang}/index.html has no <html lang>`);

  const app = scriptAt(html, '<script type="text/x-launch-app">', lang);
  const { parts, hits } = excerpts(app.src, app.lineBase, lang, (n) => NAMES.includes(n), (text) =>
    STATEMENTS.find((s) => text.startsWith(s)),
  );
  const missing = [...NAMES, ...STATEMENTS].filter((n) => !hits.has(n));
  if (missing.length) fail(`${lang}: not found at top level: ${missing.join(", ")}`);

  // the loader: a plain <script> that starts with its own comment
  const loaderOpen = "<script>\n/* Loads the LAUNCH dataset";
  const loader = scriptAt(html, loaderOpen, lang);
  const loaderSrc = loader.src.replace(/^\n?/, "/* Loads the LAUNCH dataset");
  const msg = excerpts(loaderSrc, loader.lineBase, lang, (n) => n === "MSG", () => null);
  if (msg.parts.length !== 1) fail(`${lang}: the loader's MSG not found once`);

  return `// GENERATED by tests/golden-frame/extract.mjs. Do not edit; regenerate instead.
//
// The reference for tests/golden-frame.test.ts: the static page's own frame
// code, frozen. Source: launch-rbm-test commit ${COMMIT}, ${lang}/index.html.
// First the loader's messages, then every top-level statement of the
// <script type="text/x-launch-app"> block the test runs, and every one those
// read, verbatim with the comments above it, in page order; each "@@" line
// gives its line in the page. Everything else (the board, the map, the
// journey, the structured data) is left out.
//
// It reads window.LAUNCH_DATA and window.LAUNCH_SOURCES, and the page's
// <html lang> as document.documentElement.lang, which the test supplies:
// html-lang: ${htmlLang}

${msg.parts.join("\n")}
${parts.join("\n")}`;
}

function markup(lang, html) {
  const cut = (open, close) => {
    const a = html.indexOf(open);
    if (a < 0 || html.indexOf(open, a + 1) >= 0) fail(`${lang}/index.html: expected one ${open}`);
    const b = html.indexOf(close, a);
    if (b < 0) fail(`${lang}/index.html: no ${close} after ${open}`);
    return html.slice(a, b + close.length);
  };
  const sections = [
    ["header", cut("<header>", "</header>")],
    ["banner", cut('<div class="demo-banner" id="banner"', "</div>")],
    ["footer", cut("<footer>", "</footer>")],
  ];
  return `<!-- GENERATED by tests/golden-frame/extract.mjs. Do not edit; regenerate instead.
     The frame's markup as launch-rbm-test ${COMMIT} serves ${lang}/index.html, before
     its script fills it in. Each part starts at a "@@" line. -->
${sections.map(([name, text]) => `<!--@@ ${name} @@-->\n${text}\n`).join("")}`;
}

function feedback(lang, html) {
  // one comment at most before the assignment, and a comment cannot run past its own "*/"
  const settings = [
    ...html.matchAll(/<script>\s*(\/\*(?:(?!\*\/)[\s\S])*\*\/\s*)?window\.LAUNCH_FEEDBACK_COPY\s*=[\s\S]*?<\/script>/g),
  ];
  if (settings.length !== 1) fail(`${lang}/index.html: expected one LAUNCH_FEEDBACK_COPY script`);
  const body = settings[0][0].replace(/^<script>\n?/, "").replace(/<\/script>$/, "");
  const widget = show(`${lang}/assets/report-issue.js`);
  return `// GENERATED by tests/golden-frame/extract.mjs. Do not edit; regenerate instead.
//
// The reference for the feedback widget: launch-rbm-test ${COMMIT}, the page's
// own settings script from ${lang}/index.html, then ${lang}/assets/report-issue.js,
// both verbatim. The tests run them in that order, as the page did.

// @@ ${lang}/index.html: the LAUNCH_FEEDBACK_COPY script
${body}
// @@ ${lang}/assets/report-issue.js
${widget}`;
}

const check = process.argv.includes("--check");
mkdirSync(OUT, { recursive: true });
let stale = 0;
for (const lang of LOCALES) {
  const html = show(`${lang}/index.html`);
  const files = {
    [`${lang}.page.js`]: page(lang, html),
    [`${lang}.markup.html`]: markup(lang, html),
    [`${lang}.feedback.js`]: feedback(lang, html),
  };
  for (const [name, text] of Object.entries(files)) {
    const file = `${OUT}${name}`;
    if (check) {
      let old = "";
      try {
        old = readFileSync(file, "utf8");
      } catch {}
      if (old !== text) {
        console.error(`stale: tests/golden-frame/reference/${name}`);
        stale++;
      }
    } else {
      writeFileSync(file, text);
      console.log(`wrote tests/golden-frame/reference/${name} (${text.split("\n").length} lines)`);
    }
  }
}
if (check) {
  if (stale) process.exit(1);
  console.log("tests/golden-frame/reference/ matches the pages at " + COMMIT);
}
