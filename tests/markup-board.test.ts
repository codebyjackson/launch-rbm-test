// Markup parity for components/board/: the board rendered with
// renderToStaticMarkup against the board the static page built, in each
// language and scenario, row by row.
//
// The old side is the page's own code (tests/golden-board/reference/), run on
// a small DOM: its statements build the header, every row and the placeholder
// rows, then its glossary pass marks terms in them, as on load. The new side
// is <Board>, one medicine per render, with the pathway area's slots stubbed
// in today's markup (tests/markup-board/slots.tsx); the stage panel's content
// is the pathway area's and is not drawn on load, so it is left out. Both
// sides are parsed and compared in a normal form (html.ts normal()):
// attributes sorted, white space folded, white-space-only text dropped,
// entities decoded, boolean attributes as name="".
//
// This is the markup at load. What the reader's clicks change (open rows,
// views, panels) is DOM work on the page and React state here; only the
// pathway strip's lit column (highlightStep) is compared after a change.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, describe, expect, it } from "vitest";
import { Board, type BoardProps } from "@/components/board";
import { BOARD_TEXT } from "./fixtures/text/board-text";
import { tracked } from "@/lib/pathway";
import type { ProductDetail } from "@/lib/dataset";
import { LOCALES, type Locale } from "@/lib/locales";
import { asOfYear } from "@/lib/stages";
import { El, normal, parse } from "./golden-board/html";
import { SCENARIOS, input, oldPage, switches, variants, type Scenario } from "./golden-board/page";
import { oldSlots } from "./markup-board/slots";

const counts: Record<Locale, number> = { en: 0, fr: 0, pt: 0 };
let rows = 0;

const elements = (nodes: ReturnType<typeof parse>) => nodes.filter((n): n is El => n instanceof El);
const form = (e: El) => normal([e]).join("\n");
const shell = (e: El) => normal([Object.assign(new El(e.tag), { attrs: e.attrs })]).join("\n");

// React 19 puts a <link rel="preload" as="image"> before the markup for each
// <img> it renders on the server (the WHO emblem, from the icon stand-in); in
// a Next.js page it goes to <head>. It is not the board's markup.
function newBoard(props: BoardProps) {
  const root = elements(parse(renderToStaticMarkup(createElement(Board, props)))).find((e) => e.id === "board");
  if (!root) throw new Error("no #board");
  return { root, children: elements(root.childNodes) };
}

function setup(locale: Locale, sc: Scenario) {
  const ds = input(locale, sc);
  const raw = variants(ds.data.products).map((v) => v.p);
  const old = oldPage(locale, sc, raw);
  const base: BoardProps = {
    data: ds.data,
    sources: ds.sources.sources,
    locale,
    text: BOARD_TEXT[locale],
    ...switches(sc),
    asOfYear: sc.lastUpdated ? asOfYear(sc.lastUpdated) : undefined,
    ...oldSlots(old.fn("countryAccessKv") as (d: ProductDetail) => unknown),
  };
  return { ds, raw, old, base };
}

function comparer(locale: Locale) {
  const diffs: { at: string; old: string; new: string }[] = [];
  const same = (at: string, got: string, want: string) => {
    counts[locale]++;
    if (got !== want) diffs.push({ at, old: want, new: got });
  };
  // the first difference, as the lines around where the two forms part; the rest by name
  const check = () => {
    if (!diffs.length) return;
    const [d] = diffs;
    const a = d.old.split("\n");
    const b = d.new.split("\n");
    let k = 0;
    while (k < a.length && a[k] === b[k]) k++;
    const around = (lines: string[]) => lines.slice(Math.max(0, k - 6), k + 4).join("\n");
    expect.fail(
      `${diffs.length} differences; first at ${d.at}, line ${k}:\n--- old\n${around(a)}\n--- new\n${around(b)}\n` +
        `all: ${diffs.map((x) => x.at).join(" | ")}`,
    );
  };
  return { same, check };
}

for (const locale of LOCALES) {
  describe(`markup-board: ${locale}`, () => {
    for (const sc of SCENARIOS) {
      it(`every row, ${sc.name}`, () => {
        const { ds, raw, old, base } = setup(locale, sc);
        const { same, check } = comparer(locale);
        const oldAll = elements(old.board.childNodes);
        const [oldHeader, ...oldRows] = oldAll;

        // the board itself and its header row, from a board of the four medicines
        const four = newBoard(base);
        same("#board", shell(four.root), shell(old.board));
        same("header", form(four.children[0]), form(oldHeader));

        // one medicine per board: each variant keeps its own id, as on the page
        const order = tracked(raw);
        const oldTracked = oldRows.filter((e) => !e.classList.contains("future"));
        expect(oldTracked.length).toBe(order.length);
        order.forEach((p, n) => {
          const b = newBoard({ ...base, data: { ...ds.data, products: [p] } });
          expect(b.children.length).toBe(2);
          same(`${p.id} #${n} (${p.name})`, form(b.children[1]), form(oldTracked[n]));
          rows++;
        });

        // the rows not yet tracked, in the data's order
        const placeholders = raw.filter((p) => p.placeholder);
        const b = newBoard({ ...base, data: { ...ds.data, products: placeholders } });
        const oldFuture = oldRows.filter((e) => e.classList.contains("future"));
        expect(b.children.length - 1).toBe(oldFuture.length);
        oldFuture.forEach((e, n) => same(`placeholder ${n}`, form(b.children[n + 1]), form(e)));

        expect(old.clockReads(), "clock reads by the old page").toBe(0);
        check();
      }, 120_000);
    }

    it("the pathway strip's open step, lit in every row (highlightStep)", () => {
      const sc = SCENARIOS[0];
      const ds = input(locale, sc);
      const old = oldPage(locale, sc, ds.data.products);
      const { base } = setup(locale, sc);
      const { same, check } = comparer(locale);
      for (const step of [null, ...ds.data.stages.map((_, i) => i), 99]) {
        old.fn("highlightStep")(step === 99 ? null : step);
        const b = newBoard({ ...base, openStep: step === 99 ? null : step });
        same(`step ${step}`, b.children.map(form).join("\n"), elements(old.board.childNodes).map(form).join("\n"));
      }
      check();
    });
  });
}

afterAll(() => {
  const total = LOCALES.reduce((n, l) => n + counts[l], 0);
  console.log(
    `markup-board: ${total} comparisons (${LOCALES.map((l) => `${l} ${counts[l]}`).join(", ")}), ` +
      `${rows} rows across ${SCENARIOS.length} scenarios`,
  );
});
