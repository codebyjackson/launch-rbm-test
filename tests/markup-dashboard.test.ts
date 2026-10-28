// The Dashboard's wiring, as far as markup can show it.
//
// 1. The board with the slots the Dashboard gives it (components/boardSlots.tsx:
//    the pathway area's StageIcon, CountryAccessKv and Cites, called as
//    functions) draws the same rows as the board with today's markup stubbed
//    in (tests/markup-board/slots.tsx, which tests/markup-board.test.ts proves
//    against today's page), glossary terms included. Mounting a slot as a
//    component instead loses the terms inside it; this is what catches that.
// 2. The whole Dashboard, rendered on the server: one .launch-dashboard root,
//    one #tip and one .stat-tip, the areas in today's order, no id twice, and
//    the page's language in every area (the map was English everywhere).
//
// What needs a browser (opening, Escape, hints, the map drawing) is checked
// by scripts/smoke.mjs.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Board, type BoardProps } from "@/components/board";
import { boardText } from "@/components/board/text";
import { boardSlots } from "@/components/boardSlots";
import { Dashboard } from "@/components/Dashboard";
import { frameText } from "@/components/frame/text";
import { frameView } from "@/components/frame/view";
import { mapText } from "@/components/map/text";
import { pathwayText } from "@/components/pathway/text";
import type { ProductDetail } from "@/lib/dataset";
import { LOCALES, type Locale } from "@/lib/locales";
import { mapInput } from "@/lib/map";
import { mapCountries } from "@/lib/map-countries";
import { asOfYear, stageContext } from "@/lib/stages";
import { El, normal, parse, type Node } from "./golden-board/html";
import { SCENARIOS, input, oldPage, switches, variants } from "./golden-board/page";
import { oldSlots } from "./markup-board/slots";

const elements = (nodes: Node[]) => nodes.filter((n): n is El => n instanceof El);

function all(nodes: Node[], keep: (e: El) => boolean, out: El[] = []): El[] {
  for (const e of elements(nodes)) {
    if (keep(e)) out.push(e);
    all(e.childNodes, keep, out);
  }
  return out;
}

const hasClass = (e: El, c: string) => (e.getAttribute("class") || "").split(/\s+/).includes(c);

/** An element's text, all of it, in order. */
const textOf = (nodes: Node[]): string => nodes.map((n) => (n instanceof El ? textOf(n.childNodes) : n.nodeValue)).join("");

function boardOf(props: BoardProps): string {
  const root = all(parse(renderToStaticMarkup(createElement(Board, props))), (e) => e.id === "board")[0];
  if (!root) throw new Error("no #board");
  return normal([root]).join("\n");
}

for (const locale of LOCALES) {
  describe(`markup-dashboard: ${locale}`, () => {
    for (const sc of SCENARIOS) {
      it(`the board with the Dashboard's slots is today's board, ${sc.name}`, () => {
        const ds = input(locale, sc);
        const raw = variants(ds.data.products).map((v) => v.p);
        const old = oldPage(locale, sc, raw);
        const sw = switches(sc);
        const asOf = sc.lastUpdated ? asOfYear(sc.lastUpdated) : undefined;
        const base: BoardProps = {
          data: ds.data,
          sources: ds.sources.sources,
          locale,
          text: boardText(locale),
          ...sw,
          asOfYear: asOf,
        };
        const today = oldSlots(old.fn("countryAccessKv") as (d: ProductDetail) => unknown);
        const wired = boardSlots({
          ctx: stageContext(ds.data, locale, { display: sw.display, asOfYear: asOf }),
          sources: ds.sources.sources,
          text: pathwayText(locale),
          // the address today's page used, so the emblem's markup is comparable
          whoEmblemSrc: "../assets/who-emblem.svg",
        });
        const differ: string[] = [];
        // one medicine per board, as tests/markup-board.test.ts does: variants share ids
        for (const p of raw) {
          const data = { ...ds.data, products: [p] };
          if (boardOf({ ...base, data, ...wired }) !== boardOf({ ...base, data, ...today })) differ.push(`${p.id} (${p.name})`);
        }
        expect(differ).toEqual([]);
      }, 120_000);
    }

    // On today's data every term in the Country access rows has already
    // appeared earlier in its row, and only a first occurrence is marked, so
    // the cases above cannot tell a called slot from a mounted one there. A
    // glossary whose one term is the card's "Countries on the map" can.
    it("marks a term that only the Country access rows hold", () => {
      const sc = SCENARIOS[0];
      const ds = input(locale, sc);
      const term = pathwayText(locale).onMap;
      const data = { ...ds.data, glossary: { [term]: "a definition" } };
      const old = oldPage(locale, sc, ds.data.products);
      const base: BoardProps = { data, sources: ds.sources.sources, locale, text: boardText(locale), ...switches(sc) };
      const today = oldSlots(old.fn("countryAccessKv") as (d: ProductDetail) => unknown);
      const wired = boardSlots({ ctx: stageContext(data, locale), sources: ds.sources.sources, text: pathwayText(locale) });
      const withList = ds.data.products.find((p) => p.detail.countries && Array.isArray(p.detail.countries.list));
      expect(withList, "a medicine with a country list").toBeDefined();
      const one = { ...data, products: [withList!] };
      const html = boardOf({ ...base, data: one, ...wired, renderStageIcon: today.renderStageIcon });
      expect(html).toContain(`data-term="${term}"`);
      expect(html).toBe(boardOf({ ...base, data: one, ...today }));
    });

    it("renders one root, one #tip, the areas in today's order, in its language", () => {
      const ds = input(locale, SCENARIOS[0]);
      const html = renderToStaticMarkup(
        createElement(Dashboard, {
          locale,
          data: ds.data,
          sources: ds.sources.sources,
          frameView: frameView(ds, locale, frameText(locale)),
          mapInput: mapInput(ds, mapCountries(locale), locale),
          formsUrl: "https://forms.example.org",
          assets: { logo: "/logo.svg", mapShapes: "/shapes.json", mapWorker: "/worker.js" },
        }),
      );
      const nodes = parse(html);
      const roots = all(nodes, (e) => hasClass(e, "launch-dashboard"));
      expect(roots.length).toBe(1);
      const [root] = roots;

      // no id twice anywhere (the map's own #tip used to be the second)
      const ids = all(nodes, (e) => !!e.id).map((e) => e.id);
      expect(ids.filter((id, n) => ids.indexOf(id) !== n)).toEqual([]);
      expect(all(nodes, (e) => hasClass(e, "stat-tip")).length).toBe(1);
      expect(all(nodes, (e) => e.tag === "svg" && all(e.childNodes, (s) => s.tag === "symbol").length > 0).length).toBe(1);

      // .wrap: header, banner, the three areas, footer, as on the page
      const kids = elements(root.childNodes);
      expect(hasClass(kids[0], "wrap")).toBe(true);
      const order = elements(kids[0].childNodes).map((e) => e.id || e.tag);
      expect(order).toEqual(["header", "banner", "pathway", "gatewrap", "board", "mapsec", "footer"]);
      // after .wrap, where the page had #tip: the hints and the sprite, then the feedback widget
      const after = kids.slice(1).map((e) => e.id || (e.getAttribute("class") || e.tag).split(" ")[0]);
      expect(after.slice(0, 3)).toEqual(["tip", "stat-tip", "svg"]);

      // every area speaks the page's language
      const text = (id: string) => textOf(all(nodes, (e) => e.id === id)[0].childNodes);
      expect(text("mapsec")).toContain(mapText(locale).heading);
      expect(text("board")).toContain(boardText(locale).colMedicine);
      expect(all(nodes, (e) => e.id === "pathway")[0].getAttribute("aria-label")).toBe(pathwayText(locale).pathwayLabel);
      expect(html).toContain(frameText(locale).header.title.replace(/'/g, "&#x27;"));
      if (locale !== "en") expect(text("mapsec")).not.toContain("Country access map");
    });
  });
}

// the map's text is the locale's: a check that does not depend on the fixture
it("the map's text follows the locale", () => {
  const heads = (l: Locale) => mapText(l).heading;
  expect(new Set(LOCALES.map(heads)).size).toBe(LOCALES.length);
});
