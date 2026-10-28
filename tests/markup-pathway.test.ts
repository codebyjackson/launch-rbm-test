// Markup parity for components/pathway/: each component rendered with
// renderToStaticMarkup, against the markup the page's own code builds for the
// same input (tests/golden-pathway/reference/, launch-rbm-test 7c1bf11), in
// all three languages, for every step, every medicine variant and every
// stage. Both sides are put in canonical form first (tests/golden-pathway/
// html.ts): attribute order, boolean attributes, entity encoding and
// whitespace between blocks are how each side writes the same thing.
//
// Where the page set something with the DOM rather than in a string (the
// strip shown, a step's aria-expanded, #gatewrap's label, the .gatepanel
// container), the expected markup is put together here from the page's own
// strings, as its code would have changed them; each place says which.
import { createElement, type ComponentType, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, describe, expect, it } from "vitest";
import { CountryAccessKv } from "@/components/pathway/CountryAccessKv";
import { GatePanel, GatePanelContent } from "@/components/pathway/GatePanel";
import { JourneyIconSprite, StageIcon } from "@/components/pathway/icons";
import { PathwayStrip } from "@/components/pathway/PathwayStrip";
import { StatTip } from "@/components/pathway/StatTip";
import { StepPanel } from "@/components/pathway/StepPanel";
import { pathwayText } from "./fixtures/text/pathway-text";
import { StagePeek, Tip } from "@/components/pathway/Tip";
import type { Product, Source } from "@/lib/dataset";
import { LOCALES, type Locale } from "@/lib/locales";
import { tracked } from "@/lib/pathway";
import { applyShowLate } from "@/lib/stages";
import { attr, canon, firstDifference, withoutImagePreloads } from "./golden-pathway/html";
import { SCENARIOS, attempt, input, newSide, variants } from "./golden-pathway/inputs";
import { oldPage, staticMarkup } from "./golden-pathway/old-page";

// The page's path to the emblem, given to the components so the markup is
// comparable; the components' own default is WHO_EMBLEM_SRC.
const OLD_EMBLEM = "../assets/who-emblem.svg";

const perLocale: Record<Locale, number> = { en: 0, fr: 0, pt: 0 };
const perPiece = new Map<string, number>();

const render = <P extends object>(c: ComponentType<P>, props: P) =>
  renderToStaticMarkup(createElement(c, props) as ReactElement);

type Outcome = { value: string } | { threw: string };

function comparer(locale: Locale) {
  const diffs: string[] = [];
  /** compares canonical forms; a throw on one side must be the same throw on the other */
  const same = (piece: string, input: string, got: Outcome, want: Outcome) => {
    perLocale[locale]++;
    perPiece.set(piece, (perPiece.get(piece) || 0) + 1);
    if ("threw" in got || "threw" in want) {
      if (JSON.stringify(got) !== JSON.stringify(want)) {
        diffs.push(`${piece} (${input}): old ${JSON.stringify(want)}, new ${JSON.stringify(got)}`);
      }
      return;
    }
    const d = firstDifference(canon(want.value), withoutImagePreloads(canon(got.value)));
    if (d) diffs.push(`${piece} (${input}) ${d}`);
  };
  const check = () => expect(diffs.slice(0, 10), `${diffs.length} differences`).toEqual([]);
  return { same, check };
}

/** Markup the page put together by hand: the closing ` hidden></div>` of a static element, filled. */
const opened = (staticHtml: string, inner: string, extraAttrs = "") => {
  expect(staticHtml.endsWith(" hidden></div>"), staticHtml).toBe(true);
  return staticHtml.slice(0, -" hidden></div>".length) + extraAttrs + ">" + inner + "</div>";
};

for (const locale of LOCALES) {
  const text = pathwayText[locale];

  describe(`markup pathway: ${locale}`, () => {
    it("icons and the empty hints and panels", () => {
      const sc = SCENARIOS[0];
      const ds = input(locale, sc);
      const old = oldPage(locale, sc.on, ds, ds.data.products);
      const { same, check } = comparer(locale);
      const statics = staticMarkup(locale);

      same("JourneyIconSprite", "sprite", { value: render(JourneyIconSprite, {}) }, {
        value: (old.value("JI") as { sprite: () => string }).sprite(),
      });
      for (let i = -1; i <= 9; i++) {
        for (const cls of ["", "sicon"]) {
          same(
            "StageIcon",
            `${i}, "${cls}"`,
            { value: render(StageIcon, { i, className: cls, whoEmblemSrc: OLD_EMBLEM }) },
            { value: old.fn("stageIconImg")(i, cls) as string },
          );
        }
      }
      // #tip as the HTML has it; the page only ever changed its style and content
      same("Tip", "empty", { value: render(Tip, {}) }, { value: statics.tip });
      // .stat-tip as the page made it: createElement("div"), className
      // "stat-tip", role "tooltip", hidden (en/index.html:2477-2479)
      same("StatTip", "empty", { value: render(StatTip, {}) }, { value: '<div class="stat-tip" role="tooltip" hidden></div>' });
      const ctx = newSide(ds, locale, sc).ctx;
      same(
        "StepPanel",
        "closed",
        { value: render(StepPanel, { step: null, ctx, products: [], text }) },
        { value: statics.gatewrap },
      );
      // the .gatepanel container in the board's row markup, before any opens
      for (const p of ds.data.products) {
        same(
          "GatePanel",
          `${p.id}, closed`,
          { value: render(GatePanel, { product: p, stage: null, ctx, sources: ds.sources.sources, text }) },
          { value: `<div class="gatepanel" id="${attr(p.id)}-gate" hidden></div>` },
        );
      }
      check();
    });

    for (const sc of SCENARIOS) {
      it(`strip, panels and peeks, ${sc.name}`, () => {
        const ds = input(locale, sc);
        const { ctx, pathway: display } = newSide(ds, locale, sc);
        const raw = variants(ds.data.products).map((v) => v.p);
        const listed = tracked(applyShowLate(raw, ctx.display));
        const old = oldPage(locale, sc.on, ds, raw, sc.lastUpdated);
        const oldListed = old.value("tracked") as Product[];
        const statics = staticMarkup(locale);
        const sources = ds.sources.sources;
        const { same, check } = comparer(locale);
        const f = old.fn;

        // ---- the strip ----
        // The page filled #pathway once and then un-hid it (pathway.hidden = false).
        const strip = opened(statics.pathway, old.element("pathway").innerHTML);
        const stripProps = { ctx, products: listed, text, display, whoEmblemSrc: OLD_EMBLEM };
        same("PathwayStrip", "nothing open", { value: render(PathwayStrip, { ...stripProps, openStep: null }) }, { value: strip });

        // ---- the step panel, for every step ----
        ds.data.stages.forEach((_, i) => {
          // openGatePanel(btn) set the step's button to expanded; done to the
          // page's strip here, in canonical form
          const want = canon(strip).map((t) =>
            t.startsWith("<button ") && t.includes(` data-gate="${i}"`) ? t.replace(' aria-expanded="false"', ' aria-expanded="true"') : t,
          );
          const got = withoutImagePreloads(canon(render(PathwayStrip, { ...stripProps, openStep: i })));
          perLocale[locale]++;
          perPiece.set("PathwayStrip", (perPiece.get("PathwayStrip") || 0) + 1);
          expect(firstDifference(want, got), `strip with step ${i} open`).toBeNull();

          f("openGatePanel")({ dataset: { gate: String(i) }, setAttribute() {} });
          const wrap = old.element("gatewrap");
          const label = wrap.attributes["aria-label"];
          same(
            "StepPanel",
            `step ${i}`,
            {
              value: render(StepPanel, {
                step: i,
                ctx,
                products: listed,
                stageInfo: ds.data.stageInfo,
                text,
                whoEmblemSrc: OLD_EMBLEM,
              }),
            },
            // wrap.setAttribute("aria-label", …), wrap.innerHTML = …, wrap.hidden = false
            { value: opened(statics.gatewrap, wrap.innerHTML, ` aria-label="${attr(label)}"`) },
          );
        });

        // ---- per medicine: its stage panels, its card's rows, its peeks ----
        const sourceSets: [string, Source[]][] = [
          ["sources", sources],
          ["no sources", []],
          ["no categories", sources.map(({ category: _, ...s }) => s as Source)],
        ];
        listed.forEach((p, n) => {
          const op = oldListed[n];
          const at = `${p.id} #${n}`;
          for (let i = 0; i < p.stages.length; i++) {
            const props = { product: p, stage: i, ctx, sources, text, display };
            const want = attempt(() => f("gatePanelHTML")(op, i) as string);
            same("GatePanelContent", `${at}, stage ${i}`, attempt(() => render(GatePanelContent, props)), want);
            if ("value" in want) {
              // openCellPanel: innerHTML, the late class where "Delayed" shows, hidden = false
              const late = op.stages[i].status === "late" && f("statusShown")(op, "late");
              same("GatePanel", `${at}, stage ${i}`, attempt(() => render(GatePanel, props)), {
                value: `<div class="gatepanel${late ? " late" : ""}" id="${attr(p.id)}-gate">${want.value}</div>`,
              });
            }
            // showStageTip(dot) reads the marker's data attributes, which the
            // page wrote with esc(): undefined became ""
            f("showStageTip")({
              dataset: {
                stage: ds.data.stages[i],
                status: op.stages[i].status,
                date: op.stages[i].date == null ? "" : String(op.stages[i].date),
                nextdate: op.stages[i].nextDate == null ? "" : String(op.stages[i].nextDate),
                pid: op.id,
              },
            });
            same("StagePeek", `${at}, stage ${i}`, { value: render(StagePeek, { product: p, stage: i, ctx, text }) }, {
              value: old.lastTip() ?? "(nothing shown)",
            });
          }
          for (const [name, set] of sourceSets) {
            const saved = old.window.LAUNCH_SOURCES;
            old.window.LAUNCH_SOURCES = { sources: structuredClone(set) };
            const want = attempt(() => f("countryAccessKv")(op.detail) as string);
            old.window.LAUNCH_SOURCES = saved;
            same(
              "CountryAccessKv",
              `${at}, ${name}`,
              attempt(() => render(CountryAccessKv, { detail: p.detail, sources: set, text })),
              want,
            );
          }
        });

        check();
      });
    }
  });
}

afterAll(() => {
  const total = LOCALES.reduce((n, l) => n + perLocale[l], 0);
  const byPiece = [...perPiece].map(([k, n]) => `${k} ${n}`).join(", ");
  console.log(
    `markup pathway: ${total} comparisons (${LOCALES.map((l) => `${l} ${perLocale[l]}`).join(", ")})\n  by component: ${byPiece}`,
  );
});
