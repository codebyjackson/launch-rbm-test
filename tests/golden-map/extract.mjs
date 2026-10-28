// Copies the static pages' own map code into tests/golden-map/reference/, so
// tests/golden-map.test.ts can run it beside lib/map.ts and compare.
//
// From each of en/, fr/ and pt/index.html it takes the app script (the
// <script type="text/x-launch-app"> block) and keeps, verbatim and in order:
// the map section (`if (window.LAUNCH_MAP && ...) { ... }`) and the
// top-level declarations it reads (esc, tracked, LEVEL_LABEL, the tooltip,
// shortDate, fmtFig, ...). Everything else on the page is dropped. One thing
// is added, at the end of the map block and marked as such: a hook that lets
// the test read and set the block's private state.
//
// French and Portuguese pages differ from the English one only in their
// string literals (the translation build substitutes them), which is why
// all three are kept: names sort differently in each language.
//
// Usage:
//   node tests/golden-map/extract.mjs           write the reference files
//   node tests/golden-map/extract.mjs --check   exit 1 if they are out of date
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "acorn";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "../..");
const OUT = join(HERE, "reference");
const LANGS = ["en", "fr", "pt"];
const COMMIT = "7c1bf11";
const SOURCE = `launch-rbm-test commit ${COMMIT}`;

// The top-level names the map block reads, besides browser globals. The
// extraction fails if one is missing or the block reads another.
const WANT = [
  "DATA", "STAGES", "PRODUCTS", "SHOW_BARRIERS", "PAGE_LANG", "DATE_LANG", "tracked",
  "esc", "shortDate", "COMPACT", "fmtFig", "tip", "showTipAt", "showTipAtPoint", "hideTip", "LEVEL_LABEL",
];

// The hook. Getters and setters for the block's `let` state, and the
// functions the test calls directly.
const HOOK = `
    // ---- added by tests/golden-map/extract.mjs, not part of the page ------
    globalThis.__oldMap = {
      map, countryListEls,
      state: () => ({ locRegion, locCountry, mftOn, mftSel, mftProductId, detTab, cameFrom, mapProduct, mapStatus,
        stageOff: [...stageOff], mftTick: [...mftTick] }),
      // as the page's own handlers leave it: selectMap for the medicine, then
      // the rest, then mftSync for mftOn
      setState: (s) => {
        if (s.mftProductId !== mftProductId) selectMap(s.mftProductId);
        locRegion = s.locRegion; locCountry = s.locCountry; mftSel = s.mftSel;
        detTab = s.detTab; cameFrom = s.cameFrom;
        stageOff.clear(); s.stageOff.forEach((k) => stageOff.add(k));
        mftTick.clear(); s.mftTick.forEach((k) => mftTick.add(k));
        mftSync();
      },
      fn: { regionCountries, mftScope, mftStage, mftName, mftCounts, mftUndrawn, mftAvail, mftSync, stageCounts,
        mftMatches, mftListed, drawnIsos, bboxOfFeatures, fillCountryList, applyLocationFilter, mftPaint,
        paintStageFilter, paintSelection, mftRender },
    };
`;

const pageScript = (lang) => {
  // from git: the static pages left this branch on 28 Oct 2026
  const html = execFileSync("git", ["-C", ROOT, "show", `${COMMIT}:${lang}/index.html`], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  const m = /<script type="text\/x-launch-app">([\s\S]*?)<\/script>/.exec(html);
  if (!m) throw new Error(`${lang}/index.html: no x-launch-app script`);
  return m[1];
};

// Names declared by a top-level statement of the app's IIFE.
const declared = (node) =>
  node.type === "FunctionDeclaration" ? [node.id.name]
    : node.type === "VariableDeclaration" ? node.declarations.flatMap((d) => (d.id.type === "Identifier" ? [d.id.name] : []))
      : [];

// Identifiers the map block reads but does not declare: a cheap free-variable
// scan (every Identifier, minus every name bound anywhere inside the block).
function freeNames(node) {
  const used = new Set(), bound = new Set();
  const walk = (n, parent, key) => {
    if (!n || typeof n.type !== "string") return;
    if (n.type === "Identifier") {
      const isProp = parent && ((parent.type === "MemberExpression" && key === "property" && !parent.computed) ||
        (parent.type === "Property" && key === "key" && !parent.computed));
      if (!isProp) used.add(n.name);
    }
    if (n.type === "VariableDeclarator" && n.id.type === "Identifier") bound.add(n.id.name);
    if (n.type === "VariableDeclarator" && n.id.type === "ArrayPattern") n.id.elements.forEach((e) => e && e.type === "Identifier" && bound.add(e.name));
    if ((n.type === "FunctionDeclaration" || n.type === "FunctionExpression") && n.id) bound.add(n.id.name);
    if (/Function/.test(n.type)) n.params.forEach((p) => p.type === "Identifier" && bound.add(p.name));
    for (const k of Object.keys(n)) {
      const v = n[k];
      if (Array.isArray(v)) v.forEach((c) => walk(c, n, k));
      else if (v && typeof v.type === "string") walk(v, n, k);
    }
  };
  walk(node, null, null);
  return [...used].filter((x) => !bound.has(x));
}

const BROWSER = new Set([
  "window", "document", "getComputedStyle", "matchMedia", "MutationObserver", "maplibregl", "Math", "Object",
  "Number", "String", "Set", "Infinity", "undefined", "globalThis", "ResizeObserver", "Date", "Boolean",
]);

export function extract(lang) {
  const code = pageScript(lang);
  const ast = parse(code, { ecmaVersion: "latest", sourceType: "script" });
  const call = ast.body[0].expression;
  const body = (call.callee.type === "FunctionExpression" ? call.callee : call.callee.expression).body.body;

  const keep = [];
  const found = new Set();
  let block = null;
  for (const st of body) {
    const names = declared(st).filter((n) => WANT.includes(n));
    if (names.length) {
      names.forEach((n) => {
        if (found.has(n)) throw new Error(`${lang}: ${n} declared twice`);
        found.add(n);
      });
      keep.push(st);
    } else if (st.type === "IfStatement" && code.slice(st.test.start, st.test.end).startsWith("window.LAUNCH_MAP &&")) {
      if (block) throw new Error(`${lang}: two map blocks`);
      block = st;
      keep.push(st);
    }
  }
  const missing = WANT.filter((n) => !found.has(n));
  if (missing.length) throw new Error(`${lang}: not found: ${missing.join(", ")}`);
  if (!block) throw new Error(`${lang}: no map block`);
  const stray = freeNames(block.consequent).filter((n) => !WANT.includes(n) && !BROWSER.has(n));
  if (stray.length) throw new Error(`${lang}: the map block also reads ${stray.join(", ")}`);

  const text = keep.map((st) => {
    if (st !== block) return "  " + code.slice(st.start, st.end);
    const end = st.consequent.end - 1; // before the block's closing brace
    return "  " + code.slice(st.start, end) + HOOK + code.slice(end, st.end);
  });
  return (
    `// GENERATED by tests/golden-map/extract.mjs from ${lang}/index.html (${SOURCE}).\n` +
    `// The static page's map code, verbatim: its map section and the top-level\n` +
    `// declarations it reads, from the <script type="text/x-launch-app"> block.\n` +
    `// Only the hook marked "added by tests/golden-map/extract.mjs" is new.\n` +
    `// Do not edit by hand; rerun the extractor instead.\n` +
    `(function () {\n${text.join("\n\n")}\n})();\n`
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes("--check");
  let stale = 0;
  mkdirSync(OUT, { recursive: true });
  for (const lang of LANGS) {
    const out = join(OUT, `${lang}.js`);
    const next = extract(lang);
    if (check) {
      // a Windows checkout (core.autocrlf) has CRLF on disk; git stores LF
      if (!existsSync(out) || readFileSync(out, "utf8").replace(/\r\n/g, "\n") !== next) {
        console.error(`extract: ${out} is out of date`);
        stale++;
      }
    } else {
      writeFileSync(out, next);
      console.log(`extract: wrote ${out} (${next.length} bytes)`);
    }
  }
  if (stale) process.exit(1);
}
