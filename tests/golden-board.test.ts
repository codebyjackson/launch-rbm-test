// The golden test for lib/board.ts: the board's pure rules against the static
// pages' own code, frozen in tests/golden-board/reference/{en,fr,pt}.js by
// tests/golden-board/extract.mjs (launch-rbm-test 7c1bf11).
//
// Where the page kept a rule inside its markup (the timeline's layout inside
// journeyTime, the procurement card's rules inside the row loop), the old
// side's values are read back out of the markup it built. Where it measured the DOM
// (fitTimeline, alignStageForks, drawStageForks), its own function is run on
// fake boxes with made-up sizes, and what it wrote is compared with what the
// new arithmetic returns. tests/markup-board.test.ts compares the markup.
import { isDeepStrictEqual } from "node:util";
import { afterAll, describe, expect, it } from "vitest";
import * as board from "@/lib/board";
import type { Product } from "@/lib/dataset";
import { LOCALES, type Locale } from "@/lib/locales";
import { applyShowLate, asOfYear, stageContext } from "@/lib/stages";
import { El, parse, type Node } from "./golden-board/html";
import { SCENARIOS, input, oldPage, switches, variants } from "./golden-board/page";

const perLocale: Record<Locale, number> = { en: 0, fr: 0, pt: 0 };
const perName = new Map<string, number>();
let clockReads = 0;

function comparer(locale: Locale) {
  const diffs: { name: string; input: string; old: unknown; new: unknown }[] = [];
  const same = (name: string, input: string, got: unknown, want: unknown) => {
    perLocale[locale]++;
    perName.set(name, (perName.get(name) || 0) + 1);
    const w = structuredClone(want);
    if (!isDeepStrictEqual(got, w)) diffs.push({ name, input, old: w, new: got });
  };
  const check = () => expect(diffs.slice(0, 20), `${diffs.length} differences`).toEqual([]);
  return { same, check };
}

// a small seeded generator, so a failure can be run again
function random(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const elementsOf = (nodes: Node[]) => nodes.filter((n): n is El => n instanceof El);
const pct = (e: El, prop: string) => {
  const m = (e.getAttribute("style") || "").match(new RegExp(`(?:^|;)\\s*${prop}:\\s*([-\\d.e+]+)`));
  if (!m) throw new Error(`no ${prop} in ${e.getAttribute("style")}`);
  return parseFloat(m[1]);
};
const textOf = (e: El): string =>
  e.childNodes.map((n) => (n instanceof El ? textOf(n) : n.nodeValue)).join("");

/** journeyTime's layout, read back out of the markup the old page built. */
function oldLayout(html: string) {
  const tsa = elementsOf(parse(html))[0].querySelector(".tsa")!;
  const now = tsa.querySelector("span.tk.now")!;
  const run = tsa.querySelector("i.run");
  const ticks = tsa
    .querySelectorAll("span.tk")
    .filter((t) => !t.classList.contains("now"))
    .map((t) => ({ year: +textOf(t), x: pct(t, "left") }));
  return {
    lo: ticks[0].year,
    hi: parseInt(textOf(now), 10),
    ticks,
    nowX: pct(now, "left"),
    run: run ? { left: pct(run, "left"), width: pct(run, "width") } : null,
    items: tsa.querySelectorAll("div.it").map((it) => ({
      i: +it.querySelector(".smark")!.getAttribute("data-stagei")!,
      x: pct(it, "left"),
      cur: it.classList.contains("cur"),
      tier: +it.getAttribute("data-tier")!,
      top: pct(it, "top"),
    })),
    height: pct(tsa, "height"),
  };
}

for (const locale of LOCALES) {
  describe(`golden-board: ${locale}`, () => {
    for (const sc of SCENARIOS) {
      it(`board rules, ${sc.name}`, () => {
        const ds = input(locale, sc);
        const { display, boardDisplay } = switches(sc);
        const ctx = stageContext(ds.data, locale, {
          display,
          asOfYear: sc.lastUpdated ? asOfYear(sc.lastUpdated) : undefined,
        });
        const raw = variants(ds.data.products).map((v) => v.p);
        const products = applyShowLate(raw, display);
        const old = oldPage(locale, sc, raw);
        const { same, check } = comparer(locale);

        same("ICON", locale, board.ICON, old.get("ICON"));
        same("BOARD_DISPLAY", sc.name, boardDisplay, {
          showBarriers: old.get("SHOW_BARRIERS"),
          showStageNote: old.get("SHOW_STAGE_NOTE"),
        });
        same("BOARD_DISPLAY", "as shipped", board.BOARD_DISPLAY, { showBarriers: false, showStageNote: false });
        same("FORK_R", "", board.FORK_R, old.get("FORK_R"));
        same("FORK_NODE", "", board.FORK_NODE, old.get("FORK_NODE"));

        const tracked = board.trackedProducts(products);
        const oldTracked = old.get("tracked") as Product[];
        same("trackedProducts", "order", tracked.map((p) => p.name), oldTracked.map((p) => p.name));
        same("trackedProducts", "products", tracked, oldTracked);

        for (let i = -1; i <= 9; i++) {
          same("colIndexOf", String(i), board.colIndexOf(i, ctx), old.fn("colIndexOf")(i));
        }

        // the old rows, in tracked order after the header
        const sections = elementsOf(old.board.childNodes).filter(
          (e) => e.tag === "section" && !e.classList.contains("future"),
        );
        expect(sections.length).toBe(tracked.length);

        tracked.forEach((p, n) => {
          const op = oldTracked[n];
          const at = `${p.id} #${n}`;
          p.stages.forEach((_, i) => {
            same("preBoundaryDone", `${at}, stage ${i}`, board.preBoundaryDone(p, i, ctx), old.fn("preBoundaryDone")(op, i));
          });
          const L = board.journeyLayout(p, ctx);
          same(
            "journeyLayout",
            at,
            { lo: L.lo, hi: L.hi, ticks: L.ticks, nowX: L.nowX, run: L.run, items: L.items, height: L.height },
            oldLayout(old.fn("journeyTime")(op) as string),
          );
          same(
            "procurementGfOnly",
            at,
            board.procurementGfOnly(p.detail.volume),
            sections[n].querySelector(".proc-scope") != null,
          );
          const bars = sections[n].querySelectorAll(".split div").map((b) => (b.getAttribute("style") || "").replace(/^.*background:\s*/, ""));
          same(
            "PROCUREMENT_SHADES",
            at,
            bars.map((_, k) => board.PROCUREMENT_SHADES[k % board.PROCUREMENT_SHADES.length]),
            bars,
          );
        });

        // the glossary: the same terms, longest first
        const terms = old.get("terms") as string[];
        same("glossaryOf", sc.name, Object.keys(board.glossaryOf(ds.data.glossary)), Object.keys(old.get("GLOSS") as object));
        const re = board.glossPattern(board.glossaryOf(ds.data.glossary));
        same("glossPattern", sc.name, re ? re.source.slice(3, -3).split("|") : [], terms);

        clockReads += old.clockReads();
        expect(old.clockReads(), "clock reads by the old page").toBe(0);
        check();
      }, 60_000);
    }

    it("fitTimeline: tiers spaced by measured blocks", () => {
      const sc = SCENARIOS[0];
      const ds = input(locale, sc);
      const ctx = stageContext(ds.data, locale);
      const products = applyShowLate(variants(ds.data.products).map((v) => v.p), ctx.display);
      const old = oldPage(locale, sc, products);
      const fitOld = old.fn("fitTimeline");
      const { same, check } = comparer(locale);
      const rnd = random(7);
      for (const p of board.trackedProducts(products)) {
        const L = board.journeyLayout(p, ctx);
        // the page's elements, as plain objects with what fitTimeline reads and writes
        const items = L.items.map((it) => ({ dataset: { tier: String(it.tier) }, style: {} as { top?: string }, offsetHeight: 0 }));
        const stems = L.items.map((it) => ({ tier: String(it.tier), style: {} as { height?: string } }));
        const tsa = {
          dataset: {} as { base?: number },
          style: { height: `${L.height}px` },
          querySelectorAll: (sel: string) => {
            if (sel === ".it") return items;
            const m = sel.match(/^\.stem\[data-tier="(\d+)"\]$/);
            if (!m) throw new Error(sel);
            return stems.filter((s) => s.tier === m[1]);
          },
        };
        // twice: the second fit must still grow from the first estimate, not the fitted height
        for (const round of [1, 2]) {
          const heights: number[][] = [];
          items.forEach((it, k) => {
            it.offsetHeight = 40 + Math.floor(rnd() * 220);
            (heights[L.items[k].tier] = heights[L.items[k].tier] || []).push(it.offsetHeight);
          });
          fitOld(tsa);
          const fit = board.fitTiers(heights, L.height);
          same(
            "fitTiers",
            `${p.id} round ${round}`,
            {
              tops: L.items.map((it) => `${fit.tops[it.tier]}px`),
              stems: L.items.map((it) => `${fit.tops[it.tier] - 32}px`),
              height: `${fit.height}px`,
            },
            { tops: items.map((it) => it.style.top), stems: stems.map((s) => s.style.height), height: tsa.style.height },
          );
        }
      }
      same("TIMELINE", "TOP, the first tier's top", board.fitTiers([[0]], 0).tops[0], 46);
      check();
    }, 60_000);

    it("alignStageForks and drawStageForks: the lift and the strokes", () => {
      const sc = SCENARIOS[0];
      const ds = input(locale, sc);
      const old = oldPage(locale, sc, ds.data.products);
      const { same, check } = comparer(locale);
      const rnd = random(11);
      const r = (lo: number, hi: number) => lo + rnd() * (hi - lo);
      const box = (top: number, left: number, width: number, height: number): board.Box => ({
        top,
        left,
        width,
        height,
        bottom: top + height,
        right: left + width,
      });
      for (let n = 0; n < 300; n++) {
        // a group, its caption band, and its two markers, at fractional positions
        const group = box(r(-50, 900), r(-20, 1200), n % 50 === 0 ? 0 : r(20, 160), n % 37 === 0 ? 0 : r(60, 260));
        const note = box(r(group.top, group.bottom), group.left, group.width, r(0, 30));
        const first = box(r(group.top - 10, group.bottom), r(group.left - 10, group.right), r(18, 40), r(18, 40));
        const last = box(r(group.top, group.bottom + 10), first.left, first.width, r(18, 40));
        const markHeight = Math.round(r(10, 60));

        const props: { [k: string]: string } = {};
        const svg = { attrs: {} as { [k: string]: string }, html: "", setAttribute(k: string, v: string) { this.attrs[k] = v; }, set innerHTML(v: string) { this.html = v; } };
        const marks = [first, last].map((b) => ({ getBoundingClientRect: () => b, offsetHeight: markHeight }));
        const fakeGroup = {
          getBoundingClientRect: () => group,
          querySelector: (sel: string) =>
            sel === ".stagegroup-note" ? { getBoundingClientRect: () => note } : sel === ".smark" ? marks[0] : sel === ".forkline" ? svg : null,
          querySelectorAll: (sel: string) => (sel === ".smark" ? marks : []),
        };
        const track = { style: { setProperty: (k: string, v: string) => (props[k] = v) }, querySelector: () => fakeGroup };
        old.doc.override = (sel) => (sel === ".track" ? [track] : sel === ".stagegroup" ? [fakeGroup] : undefined);
        old.fn("alignStageForks")();
        old.fn("drawStageForks")();
        old.doc.override = null;

        same("forkLift", `#${n}`, board.forkLift(note, group.top, markHeight), props["--sg-lift"]);
        const g = board.forkGeometry(group, first, last);
        const drawn = svg.html
          ? (() => {
              const [inArm, outArm, inNode, outNode] = elementsOf(parse(svg.html));
              return {
                viewBox: svg.attrs.viewBox,
                inD: inArm.getAttribute("d"),
                outD: outArm.getAttribute("d"),
                nodes: [inNode, outNode].map((c) => [c.getAttribute("cx"), c.getAttribute("cy"), c.getAttribute("r")]),
              };
            })()
          : null;
        same(
          "forkGeometry",
          `#${n}`,
          g && {
            viewBox: g.viewBox,
            inD: g.inD,
            outD: g.outD,
            nodes: [
              ["0", String(g.spine), String(board.FORK_NODE)],
              [String(g.w), String(g.spine), String(board.FORK_NODE)],
            ],
          },
          drawn,
        );
      }
      check();
    }, 60_000);
  });
}

// Every export of lib/board.ts is compared above, or through the markup it
// builds (tests/markup-board.test.ts), so a new one cannot arrive unchecked.
const THROUGH_MARKUP = ["glossSplit"];

it("compares everything lib/board.ts exports", () => {
  const exported = Object.keys(board).sort();
  expect(exported.filter((name) => !perName.has(name) && !THROUGH_MARKUP.includes(name))).toEqual([]);
});

afterAll(() => {
  const total = LOCALES.reduce((n, l) => n + perLocale[l], 0);
  const byName = [...perName].map(([n, k]) => `${n} ${k}`).join(", ");
  console.log(
    `golden-board: ${total} comparisons (${LOCALES.map((l) => `${l} ${perLocale[l]}`).join(", ")}); ` +
      `clock reads by the old pages: ${clockReads}\n  by name: ${byName}`,
  );
});
