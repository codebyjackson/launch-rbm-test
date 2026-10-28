#!/usr/bin/env node
// Browser smoke test for the wired Dashboard: what the markup tests cannot
// show (hydration, clicks, Escape, hints, deep links, the forms, the map
// drawing) checked in headless Chrome against a running production build.
//
//   NEXT_PUBLIC_LAUNCH_FORMS_URL=https://forms.example.org npx next build
//   npx next start -p 3124 &
//   node scripts/smoke.mjs
//
// The forms address is read when the pages are built: without it Subscribe
// is not rendered and that check fails. Settings (environment):
//   SMOKE_BASE     the server (http://localhost:3124)
//   SMOKE_LOCALES  comma-separated (en,fr)
//   SMOKE_OUT      where screenshots go (a temporary folder)
//   CHROME         the browser (Google Chrome on macOS)
//
// Raw Chrome DevTools Protocol over Node's own WebSocket (Node 22+): no new
// dependency. MapLibre needs a GL backend headless, so Chrome runs with
// SwiftShader (software) and without --disable-gpu, or the map never starts.
// Exit code 1 if any check fails; every check is printed, passed or not.
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = process.env.SMOKE_BASE || "http://localhost:3124";
const LOCALES = (process.env.SMOKE_LOCALES || "en,fr").split(",").filter(Boolean);
const OUT = process.env.SMOKE_OUT || join(tmpdir(), "launch-smoke");
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const WIDTH = 1440;
const HEIGHT = 1000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
function check(locale, name, ok, detail = "") {
  results.push({ locale, name, ok: !!ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  [${locale}] ${name}${detail ? ` — ${detail}` : ""}`);
}

// ---- Chrome and the protocol ------------------------------------------------

async function launchChrome() {
  const profile = mkdtempSync(join(tmpdir(), "launch-smoke-chrome-"));
  const proc = spawn(
    CHROME,
    [
      "--headless=new",
      "--remote-debugging-port=0",
      `--user-data-dir=${profile}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--enable-unsafe-swiftshader",
      "--use-gl=angle",
      "--use-angle=swiftshader",
      `--window-size=${WIDTH},${HEIGHT}`,
      "about:blank",
    ],
    { stdio: ["ignore", "ignore", "pipe"] },
  );
  const url = await new Promise((resolve, reject) => {
    let err = "";
    const timer = setTimeout(() => reject(new Error("Chrome gave no DevTools address in 20 s")), 20_000);
    proc.stderr.on("data", (d) => {
      err += d;
      const m = err.match(/DevTools listening on (ws:\/\/\S+)/);
      if (m) {
        clearTimeout(timer);
        resolve(m[1]);
      }
    });
    proc.on("exit", (code) => reject(new Error(`Chrome exited (${code}): ${err.slice(-500)}`)));
  });
  return { proc, profile, url };
}

class Cdp {
  constructor(url) {
    this.ws = new WebSocket(url);
    this.n = 0;
    this.pending = new Map();
    this.listeners = new Set();
  }
  open() {
    return new Promise((resolve, reject) => {
      this.ws.onopen = () => resolve();
      this.ws.onerror = (e) => reject(e.error || new Error("WebSocket error"));
      this.ws.onmessage = (ev) => {
        const msg = JSON.parse(String(ev.data));
        if (msg.id && this.pending.has(msg.id)) {
          const p = this.pending.get(msg.id);
          this.pending.delete(msg.id);
          if (msg.error) p.reject(new Error(`${p.method}: ${msg.error.message}`));
          else p.resolve(msg.result);
        } else if (msg.method) {
          for (const l of this.listeners) l(msg);
        }
      };
    });
  }
  send(method, params = {}, sessionId) {
    const id = ++this.n;
    this.ws.send(JSON.stringify({ id, method, params, sessionId }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject, method }));
  }
}

/** One tab, with what the page logs collected. */
async function openTab(cdp) {
  const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
  const send = (m, p) => cdp.send(m, p, sessionId);
  const log = [];
  cdp.listeners.add((msg) => {
    if (msg.sessionId !== sessionId) return;
    if (msg.method === "Runtime.consoleAPICalled" && ["error", "warning", "assert"].includes(msg.params.type)) {
      log.push({ kind: `console.${msg.params.type}`, text: msg.params.args.map((a) => a.value ?? a.description ?? "").join(" ") });
    } else if (msg.method === "Runtime.exceptionThrown") {
      const d = msg.params.exceptionDetails;
      log.push({ kind: "exception", text: (d.exception && d.exception.description) || d.text });
    } else if (msg.method === "Log.entryAdded" && ["error", "warning"].includes(msg.params.entry.level)) {
      log.push({ kind: `log.${msg.params.entry.level}`, text: `${msg.params.entry.text} ${msg.params.entry.url || ""}`.trim() });
    }
  });
  await send("Runtime.enable");
  await send("Log.enable");
  await send("Page.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: WIDTH, height: HEIGHT, deviceScaleFactor: 1, mobile: false });
  // in front, so it is the tab Chrome draws
  await send("Page.bringToFront");
  const close = () => cdp.send("Target.closeTarget", { targetId });

  const ev = async (expression) => {
    const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(`in page: ${r.exceptionDetails.exception?.description || r.exceptionDetails.text}`);
    return r.result.value;
  };
  const waitFor = async (expression, ms = 5000) => {
    const end = Date.now() + ms;
    for (;;) {
      let v = null;
      try {
        v = await ev(expression);
      } catch {
        v = null;
      }
      if (v) return v;
      if (Date.now() > end) return null;
      await sleep(100);
    }
  };
  /** the n-th match's centre in the viewport, after scrolling it to the middle */
  const centre = (sel, n = 0) =>
    ev(`(() => { const e = document.querySelectorAll(${JSON.stringify(sel)})[${n}]; if (!e) return null;
      e.scrollIntoView({ block: "center", inline: "center" });
      const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  const mouse = (type, x, y, extra = {}) => send("Input.dispatchMouseEvent", { type, x, y, button: "none", ...extra });
  const hover = async (sel, n = 0) => {
    const p = await centre(sel, n);
    if (!p) throw new Error(`no ${sel} [${n}]`);
    await mouse("mouseMoved", p.x, p.y);
    return p;
  };
  const click = async (sel, n = 0) => {
    const p = await hover(sel, n);
    await mouse("mousePressed", p.x, p.y, { button: "left", clickCount: 1 });
    await mouse("mouseReleased", p.x, p.y, { button: "left", clickCount: 1 });
  };
  const away = () => mouse("mouseMoved", 2, 2);
  const key = async (k, code = k, vk = 27) => {
    await send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: k, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk });
    await send("Input.dispatchKeyEvent", { type: "keyUp", key: k, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk });
  };
  const goto = async (url) => {
    await send("Page.navigate", { url });
    await waitFor(`document.readyState === "complete" && location.href === ${JSON.stringify(url)}`, 30_000);
    // hydrated: React has attached its props to the board's element
    return waitFor(
      `(() => { const b = document.getElementById("board"); return !!b && Object.keys(b).some((k) => k.startsWith("__reactProps")); })()`,
      30_000,
    );
  };
  const shot = async (file, clip) => {
    const params = { format: "png", captureBeyondViewport: !!(clip && clip.full) };
    if (clip) params.clip = { x: clip.x, y: clip.y, width: clip.width, height: clip.height, scale: 1 };
    const { data } = await send("Page.captureScreenshot", params);
    const buf = Buffer.from(data, "base64");
    if (file) writeFileSync(join(OUT, file), buf);
    return buf;
  };
  const fullShot = async (file) => {
    const { cssContentSize: s } = await send("Page.getLayoutMetrics");
    return shot(file, { x: 0, y: 0, width: WIDTH, height: Math.ceil(s.height), full: true });
  };
  /** the element, in page coordinates, for a clipped screenshot */
  const boxOf = (sel) =>
    ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null;
      const r = e.getBoundingClientRect(); return { x: r.left + scrollX, y: r.top + scrollY, width: r.width, height: r.height }; })()`);
  return { send, log, ev, waitFor, hover, click, away, key, goto, shot, fullShot, boxOf, mouse, close };
}

// ---- pixels -------------------------------------------------------------------

/** A Chrome screenshot (8-bit RGB or RGBA PNG) as raw pixels. */
function decodePng(buf) {
  let pos = 8;
  let width = 0, height = 0, depth = 0, type = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const name = buf.toString("ascii", pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (name === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      depth = data[8];
      type = data[9];
    } else if (name === "IDAT") idat.push(data);
    else if (name === "IEND") break;
    pos += 12 + len;
  }
  const bpp = type === 6 ? 4 : type === 2 ? 3 : 0;
  if (depth !== 8 || !bpp) throw new Error(`unexpected PNG: depth ${depth}, colour type ${type}`);
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * bpp;
  const px = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? px[y * stride + x - bpp] : 0;
      const b = y ? px[(y - 1) * stride + x] : 0;
      const c = x >= bpp && y ? px[(y - 1) * stride + x - bpp] : 0;
      let v = line[x];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      px[y * stride + x] = v & 255;
    }
  }
  return { width, height, bpp, px };
}

/** How many colours, and the share of the commonest: a blank canvas is one colour. */
function colourStats(png) {
  const counts = new Map();
  const n = png.width * png.height;
  for (let i = 0; i < n; i++) {
    const o = i * png.bpp;
    const k = (png.px[o] << 16) | (png.px[o + 1] << 8) | png.px[o + 2];
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  return { colours: counts.size, top: Math.max(...counts.values()) / n };
}

/** Share of pixels that differ between two screenshots of the same size. */
function changed(a, b) {
  if (a.width !== b.width || a.height !== b.height) return 1;
  let d = 0;
  const n = a.width * a.height;
  for (let i = 0; i < n; i++) {
    const o = i * a.bpp, p = i * b.bpp;
    if (Math.abs(a.px[o] - b.px[p]) + Math.abs(a.px[o + 1] - b.px[p + 1]) + Math.abs(a.px[o + 2] - b.px[p + 2]) > 24) d++;
  }
  return d / n;
}

// ---- the checks ---------------------------------------------------------------

async function smoke(cdp, locale) {
  const m = JSON.parse(readFileSync(join(ROOT, "messages", `${locale}.json`), "utf8")).launchDashboard;
  const t = await openTab(cdp);
  const url = `${BASE}/${locale}`;
  const hydrated = await t.goto(url);
  check(locale, "page loads and hydrates", hydrated, `${url}, ${await t.ev("document.visibilityState")}`);
  if (!hydrated) return t;
  await sleep(1500); // fonts, the strip's measuring, the map's first frame
  // what was logged before this script took any screenshot (see the GL note below)
  const beforeShots = t.log.length;
  await t.fullShot(`${locale}-load.png`);

  // one root, one #tip, one .stat-tip
  const counts = await t.ev(`({
    roots: document.querySelectorAll(".launch-dashboard").length,
    tips: document.querySelectorAll('[id="tip"]').length,
    statTips: document.querySelectorAll(".stat-tip").length,
    sprites: [...document.querySelectorAll("svg")].filter((s) => s.querySelector("symbol")).length,
    order: [...document.querySelector(".launch-dashboard > .wrap").children].map((e) => e.id || e.tagName.toLowerCase()).join(" "),
  })`);
  check(locale, "one .launch-dashboard root", counts.roots === 1, `${counts.roots}`);
  check(locale, "one #tip in the page", counts.tips === 1, `${counts.tips}`);
  check(locale, "one .stat-tip and one icon sprite", counts.statTips === 1 && counts.sprites === 1, `${counts.statTips}, ${counts.sprites}`);
  check(
    locale,
    "areas in today's order",
    counts.order === "header banner pathway gatewrap board mapsec footer",
    counts.order,
  );

  // texts in the page's language
  const words = await t.ev(`({
    lang: document.documentElement.lang,
    title: document.querySelector("header h1")?.textContent.trim(),
    pathway: document.getElementById("pathway").getAttribute("aria-label"),
    medicine: document.querySelector("#board .srow.hd span:nth-child(2)")?.textContent,
    map: document.querySelector("#mapsec h2")?.textContent,
    sources: document.querySelector("#sources summary")?.textContent,
  })`);
  const want = { title: m.header.title, pathway: m.pathway.label, medicine: m.board.columns.medicine, map: m.map.title };
  const wrong = Object.keys(want).filter((k) => words[k] !== want[k]);
  check(locale, `texts in ${locale} (title, strip, board, map)`, words.lang === locale && !wrong.length, wrong.length ? `differ: ${wrong.map((k) => `${k}=${JSON.stringify(words[k])}`).join("; ")}` : `lang=${words.lang}, map "${words.map}"`);

  // a step opens #gatewrap and lights its column in every row
  const gate = 4;
  await t.click(`.pathnode[data-gate="${gate}"]`);
  const step = await t.waitFor(`(() => { const w = document.getElementById("gatewrap"); if (w.hidden) return null;
    const nb = +document.querySelector('.pathnode[data-gate="${gate}"] .nb').textContent;
    const rows = document.querySelectorAll("#board > section.product:not(.future)").length;
    const lit = [...document.querySelectorAll("#board .jcell.on")];
    return { h3: w.querySelector("h3")?.textContent, label: document.querySelector('.pathnode[data-gate="${gate}"] .plabel').textContent,
      rows, lit: lit.length, cols: [...new Set(lit.map((c) => +c.dataset.c))], want: nb - 1,
      expanded: document.querySelector('.pathnode[data-gate="${gate}"]').getAttribute("aria-expanded") }; })()`);
  check(locale, "a step opens #gatewrap", step && step.h3 === step.label && step.expanded === "true", step ? `"${step.h3}"` : "not opened");
  check(
    locale,
    "the step's column lights in every board row",
    step && step.lit === step.rows && step.cols.length === 1 && step.cols[0] === step.want,
    step ? `${step.lit} of ${step.rows} rows, column ${step.cols.join(",")} (want ${step.want})` : "",
  );
  await t.shot(`${locale}-step-open.png`);

  // a medicine's row opens
  const first = await t.ev(`document.querySelector("#board > section.product:not(.future)").id`);
  await t.click(`#${first} .exp`);
  const rowOpen = await t.waitFor(`document.getElementById(${JSON.stringify(first)}).classList.contains("l1-open")`);
  check(locale, "a medicine's row opens", rowOpen, first);

  // a stage marker's hint, on hover and on focus
  const markers = `#${first} .view:not([hidden]) .smark`;
  const nMarks = await t.ev(`document.querySelectorAll(${JSON.stringify(markers)}).length`);
  await t.away();
  await t.hover(markers, 0);
  const peek = await t.waitFor(`(() => { const tip = document.getElementById("tip"); if (getComputedStyle(tip).display === "none") return null;
    const mk = document.querySelector(${JSON.stringify(markers)});
    return { b: tip.querySelector("b")?.textContent, label: mk.getAttribute("aria-label"), hint: tip.querySelector(".thint")?.textContent }; })()`);
  check(
    locale,
    "hover on a stage marker shows its hint in #tip",
    peek && peek.label.startsWith(peek.b + ".") && peek.hint === m.tooltip.clickForDetail,
    peek ? `"${peek.b}" / "${peek.hint}"` : "no hint",
  );
  await t.shot(`${locale}-stage-hint.png`);
  await t.away();
  const hiddenAfterLeave = await t.waitFor(`getComputedStyle(document.getElementById("tip")).display === "none"`, 2000);
  // the last marker in the view (a row early on the pathway may have only one)
  const last = nMarks - 1;
  await t.ev(`document.querySelectorAll(${JSON.stringify(markers)})[${last}].focus()`);
  const focusPeek = await t.waitFor(`(() => { const tip = document.getElementById("tip"); if (getComputedStyle(tip).display === "none") return null;
    const mk = document.querySelectorAll(${JSON.stringify(markers)})[${last}]; return mk.getAttribute("aria-label").startsWith(tip.querySelector("b").textContent + "."); })()`);
  check(locale, "focus on a stage marker shows its hint (and leaving hides it)", hiddenAfterLeave && focusPeek, `${nMarks} markers`);
  await t.ev(`document.activeElement.blur()`);

  // a marker opens its stage panel, with content (the first marker: its hint is showing)
  await t.click(markers, 0);
  const panel = await t.waitFor(`(() => { const g = document.getElementById(${JSON.stringify(first + "-gate")});
    return g && !g.hidden && g.querySelector(".gp-head .gp-stage") && g.querySelector(".gp-close") ? g.querySelector(".gp-stage").textContent : null; })()`);
  const tipAfterOpen = await t.ev(`getComputedStyle(document.getElementById("tip")).display`);
  check(locale, "a stage marker opens its stage panel, with content", !!panel, panel ? `"${panel}"` : "not opened");
  check(locale, "opening the panel hides the marker's hint", tipAfterOpen === "none", tipAfterOpen);
  await t.shot(`${locale}-stage-panel.png`);

  // Escape: the stage panel first, then the step panel
  await t.key("Escape");
  const esc1 = await t.waitFor(`(() => { const g = document.getElementById(${JSON.stringify(first + "-gate")});
    return g.hidden ? { gatewrap: !document.getElementById("gatewrap").hidden, focus: document.activeElement.classList.contains("smark") } : null; })()`, 2000);
  check(locale, "Escape closes the stage panel first (step panel stays, focus to marker)", esc1 && esc1.gatewrap && esc1.focus, JSON.stringify(esc1));
  await t.key("Escape");
  const esc2 = await t.waitFor(`document.getElementById("gatewrap").hidden ? { focus: document.activeElement.dataset.gate, lit: document.querySelectorAll("#board .jcell.on").length } : null`, 2000);
  check(locale, "then Escape closes the step panel (focus to its step, column unlit)", esc2 && esc2.focus === String(gate) && esc2.lit === 0, JSON.stringify(esc2));

  // an i button's hint (.stat-tip), on hover and on focus
  await t.away();
  await t.hover(`#board .srow.hd .info`);
  const stat = await t.waitFor(`(() => { const s = document.querySelector(".stat-tip"); const b = document.querySelector("#board .srow.hd .info");
    return !s.hidden && s.textContent === b.dataset.tip ? s.textContent.slice(0, 40) : null; })()`);
  check(locale, "hover on an .info button shows .stat-tip", !!stat, stat ? `"${stat}…"` : "not shown");
  await t.shot(`${locale}-info-hint.png`);
  await t.away();
  const statGone = await t.waitFor(`document.querySelector(".stat-tip").hidden`, 2000);
  await t.ev(`document.querySelector("#board .srow.hd .info").focus()`);
  const statFocus = await t.waitFor(`!document.querySelector(".stat-tip").hidden`, 2000);
  check(locale, "focus on an .info button shows .stat-tip (and leaving hides it)", statGone && statFocus);
  await t.ev(`document.activeElement.blur()`);

  // a glossary term's hint
  const gloss = await t.ev(`!!document.querySelector("#board .gloss")`);
  if (gloss) {
    await t.ev(`document.querySelector("#board .gloss").focus()`);
    const g = await t.waitFor(`(() => { const tip = document.getElementById("tip"); const term = document.querySelector("#board .gloss").dataset.term;
      return getComputedStyle(tip).display !== "none" && tip.querySelector("b")?.textContent === term ? term : null; })()`, 2000);
    check(locale, "focus on a glossary term shows its definition in #tip", !!g, g || "not shown");
    await t.ev(`document.activeElement.blur()`);
  }

  // opening a row puts it in the address (the example app's ?product=)
  const second = await t.ev(`[...document.querySelectorAll("#board > section.product:not(.future)")][1].id`);
  await t.click(`#${second} .exp`);
  const inAddress = await t.waitFor(`new URLSearchParams(location.search).get("product") === ${JSON.stringify(second)}`, 2000);
  check(locale, "opening a row puts ?product= in the address", inAddress, second);

  // Subscribe
  const sub = await t.ev(`!!document.getElementById("sub-open")`);
  if (sub) {
    await t.click("#sub-open");
    const open = await t.waitFor(`!document.getElementById("subwrap").hidden && document.querySelector(".launch-dashboard").classList.contains("sub-open")`, 2000);
    await t.shot(`${locale}-subscribe.png`);
    await t.key("Escape");
    const closed = await t.waitFor(`document.getElementById("subwrap").hidden`, 2000);
    check(locale, "Subscribe opens (and Escape closes it)", open && closed);
  } else {
    check(locale, "Subscribe opens", false, "no #sub-open: was NEXT_PUBLIC_LAUNCH_FORMS_URL set at next build?");
  }

  // Send feedback: the dialog opens and closes
  await t.click(".ri-pill");
  const dlg = await t.waitFor(`document.querySelector("dialog.ri-dialog").open`, 2000);
  await t.shot(`${locale}-feedback.png`);
  await t.click("dialog.ri-dialog .ri-x");
  const dlgClosed = await t.waitFor(`!document.querySelector("dialog.ri-dialog").open`, 2000);
  check(locale, "the feedback dialog opens and closes", dlg && dlgClosed);

  // What the page logged. Not the app's: the example app has no icon, and
  // Chrome's GL driver reports its own stalls under SwiftShader.
  const gl = (e) => /GL Driver Message/.test(e.text);
  const noise = (e) => /favicon\.ico/.test(e.text) || gl(e);
  const bad = t.log.filter((e) => !noise(e));
  const hydration = bad.filter((e) => /hydrat|#418|#423|#425|did not match/i.test(e.text));
  check(locale, "no hydration warnings", !hydration.length, hydration.map((e) => e.text.slice(0, 160)).join(" | "));
  check(locale, "no console errors or warnings", !bad.length, bad.map((e) => `${e.kind}: ${e.text.slice(0, 160)}`).join(" | "));
  const ignored = t.log.filter(noise);
  if (ignored.length) console.log(`      [${locale}] not counted: ${ignored.map((e) => e.text.slice(0, 140)).join(" | ")}`);
  const glEarly = t.log.slice(0, beforeShots).filter(gl).length;
  const glAll = t.log.filter(gl).length;
  if (glAll) console.log(`      [${locale}] GL driver messages: ${glAll}, of which ${glEarly} before this script's first screenshot`);
  return t;
}

/**
 * The map draws, and a region change re-frames it. In a tab of its own: once
 * an Escape key has been sent over the protocol, headless Chrome stops
 * running requestAnimationFrame in that tab (checked on a plain data: page
 * too: 119 frames in 2 s before, 0 after), and MapLibre's camera moves only
 * on animation frames. The checks above press Escape.
 */
async function mapChecks(cdp, locale) {
  const t = await openTab(cdp);
  const ok = await t.goto(`${BASE}/${locale}`);
  if (!ok) {
    check(locale, "the map's page loads", false);
    return t;
  }
  const canvas = await t.waitFor(`(() => { const c = document.querySelector("#mapwrap canvas"); return c && c.width > 0 && c.height > 0 ? [c.width, c.height] : null; })()`, 30_000);
  check(locale, "the map's canvas is there", !!canvas, canvas ? canvas.join("×") : "no canvas");
  let before = null;
  if (canvas) {
    await t.ev(`document.getElementById("mapwrap").scrollIntoView({ block: "center" })`);
    await t.away();
    let stats = null;
    for (let i = 0; i < 40; i++) {
      const box = await t.boxOf("#mapwrap");
      before = decodePng(await t.shot(null, box));
      stats = colourStats(before);
      if (stats.colours > 20 && stats.top < 0.9) break;
      await sleep(500);
    }
    await t.shot(`${locale}-map.png`, await t.boxOf("#mapwrap"));
    check(locale, "the map draws (not blank)", stats.colours > 20 && stats.top < 0.9, `${stats.colours} colours, commonest ${(stats.top * 100).toFixed(1)}%`);

    // The map's own zoom readout (#mz-lvl, written from MapLibre's zoom
    // events) says whether the camera moved; pixels alone do not, as land and
    // sea are both near white. Hidden at the world view, "2.3×" over Africa.
    const zoomOf = () => t.ev(`(() => { const z = document.getElementById("mz-lvl"); return z && !z.hidden ? z.textContent : "world"; })()`);
    const z0 = await zoomOf();
    const t0 = Date.now();
    await t.ev(`(() => { const s = document.getElementById("loc-region"); s.value = "AFRO"; s.dispatchEvent(new Event("change", { bubbles: true })); })()`);
    const z1 = await t.waitFor(`(() => { const z = document.getElementById("mz-lvl"); return z && !z.hidden && z.textContent !== ${JSON.stringify(z0)} ? z.textContent : null; })()`, 30_000);
    const took = Date.now() - t0;
    await sleep(1500); // the camera's ease to finish
    const after = decodePng(await t.shot(`${locale}-map-africa.png`, await t.boxOf("#mapwrap")));
    check(locale, "a region change (Africa) re-frames the map", !!z1, `zoom ${z0} → ${z1} after ${(took / 1000).toFixed(1)} s; ${(changed(before, after) * 100).toFixed(1)}% of pixels changed`);
  }

  const bad = t.log.filter((e) => !/favicon\.ico|GL Driver Message/.test(e.text));
  check(locale, "no console errors around the map", !bad.length, bad.map((e) => e.text.slice(0, 160)).join(" | "));
  const gl = t.log.filter((e) => /GL Driver Message/.test(e.text)).length;
  if (gl) console.log(`      [${locale}] GL driver messages in the map's tab: ${gl}`);
  return t;
}

/** ?product=<id> opens that medicine on load and brings it to the top. */
async function deepLink(cdp, locale) {
  const t = await openTab(cdp);
  await t.goto(`${BASE}/${locale}`);
  const ids = await t.ev(`[...document.querySelectorAll("#board > section.product:not(.future)")].map((s) => s.id)`);
  const id = ids[ids.length - 1];
  const url = `${BASE}/${locale}?product=${encodeURIComponent(id)}`;
  await t.goto(url);
  const open = await t.waitFor(`document.getElementById(${JSON.stringify(id)}).classList.contains("l1-open")`, 5000);
  await sleep(800);
  // "|| 0": the protocol cannot carry -0 as a plain value
  const top = await t.ev(`Math.round(document.getElementById(${JSON.stringify(id)}).getBoundingClientRect().top) || 0`);
  const others = await t.ev(`document.querySelectorAll("#board > section.product.l1-open").length`);
  await t.shot(`${locale}-product-link.png`);
  check(locale, "?product=<id> opens that medicine on load, scrolled to it", open && others === 1 && Math.abs(top) < 60, `${id}: open ${!!open}, ${others} open, top ${top}px`);
  const bad = t.log.filter((e) => !/favicon\.ico|GL Driver Message/.test(e.text));
  check(locale, "no console errors on the deep link", !bad.length, bad.map((e) => e.text.slice(0, 160)).join(" | "));
  return t;
}

// ---- run ------------------------------------------------------------------------

mkdirSync(OUT, { recursive: true });
const chrome = await launchChrome();
const cdp = new Cdp(chrome.url);
let failed = true;
try {
  await cdp.open();
  for (const locale of LOCALES) {
    await (await smoke(cdp, locale)).close();
    await (await deepLink(cdp, locale)).close();
    await (await mapChecks(cdp, locale)).close();
  }
  failed = results.some((r) => !r.ok);
} catch (e) {
  console.error(e);
  check("-", "the script ran to the end", false, String(e && e.message ? e.message : e).slice(0, 200));
} finally {
  try {
    await cdp.send("Browser.close");
  } catch {}
  // let Chrome finish writing its profile before it is deleted
  if (chrome.proc.exitCode === null) {
    const exited = new Promise((r) => chrome.proc.once("exit", r));
    chrome.proc.kill();
    await Promise.race([exited, sleep(5000)]);
  }
  rmSync(chrome.profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
const pass = results.filter((r) => r.ok).length;
console.log(`\n${pass} of ${results.length} checks passed; screenshots in ${OUT}`);
process.exit(failed ? 1 : 0);
