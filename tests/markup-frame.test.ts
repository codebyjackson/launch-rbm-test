// Markup parity for the page frame: each component, rendered with
// renderToStaticMarkup, against the static page's own markup, in en, fr and
// pt. The old side is the page as served (tests/golden-frame/reference/
// {lang}.markup.html) with what its script wrote into it, taken from the
// page's own code run in node:vm (tests/golden-frame/harness.ts); the
// feedback dialog is the one the widget built. Both are normalised
// (harness normalise(): attribute order, entity forms, insignificant
// whitespace) and compared line by line, so the text table
// (components/frame/text.ts) is checked here too, word for word.
import { readFileSync } from "node:fs";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Banner } from "@/components/frame/Banner";
import { DashboardFrame } from "@/components/frame/DashboardFrame";
import { FEEDBACK_START, FeedbackDialog, type FeedbackState } from "@/components/frame/FeedbackForm";
import { Footer } from "@/components/frame/Footer";
import { Header } from "@/components/frame/Header";
import { SubscribePanel, subscribeMessage } from "@/components/frame/Subscribe";
import { FRAME_TEXT } from "@/components/frame/text";
import { frameView } from "@/components/frame/view";
import { localize } from "@/lib/dataset";
import { checkFeedback, feedbackProducts } from "@/lib/frame";
import { LOCALES, type Locale } from "@/lib/locales";
import { fill } from "@/lib/strings";
import {
  attr,
  byId,
  fillId,
  markupPart,
  normalise,
  runOldPage,
  runOldWidget,
  setAttr,
  stubFetch,
  subtree,
  tokenize,
  type StubEl,
  type Tok,
} from "./golden-frame/harness";

const FIXTURE = JSON.parse(readFileSync(new URL("./fixtures/dashboard.json", import.meta.url), "utf8"));
const LOGO = "../assets/unitaid-logo.svg"; // what the page's <img> points at
const FORMS = "https://launch-development-test.vercel.app";
const noop = () => {};

// React 19 writes a <link rel="preload" as="image"> for every <img> it
// renders on the server. In a real page it goes into <head>, not into the
// component, so it is dropped here before comparing.
const withoutPreload = (toks: Tok[]) =>
  toks.filter((tk) => !(tk.t === "open" && tk.name === "link" && attr(tk, "rel") === "preload"));
const html = (el: ReactElement) => withoutPreload(tokenize(renderToStaticMarkup(el)));
const render = (el: ReactElement) => normalise(html(el));

/** Adds classes to every start tag that has class `cls` (what classList.add did). */
const addClass = (toks: Tok[], cls: string, more: string[]): Tok[] =>
  toks.map((t) => {
    if (t.t !== "open" || !(attr(t, "class") || "").split(/\s+/).includes(cls) || !more.length) return t;
    return { ...t, attrs: t.attrs.map(([k, v]): [string, string] => (k === "class" ? [k, [v, ...more].join(" ")] : [k, v])) };
  });

/** The old dialog and pill, as the widget built them, with open() run: the medicine list filled. */
function oldWidgetTokens(w: ReturnType<typeof runOldWidget>): Tok[] {
  const { dialog, pill } = w;
  const tag = (name: string, el: StubEl) =>
    `<${name} ${[
      el.type && `type="${el.type}"`,
      `class="${el.className}"`,
      el.id && `id="${el.id}"`,
      ...[...el.attrs].map(([k, v]) => `${k}="${v.replace(/"/g, "&quot;")}"`),
    ]
      .filter(Boolean)
      .join(" ")}>`;
  let toks = tokenize(`${tag("dialog", dialog)}${dialog.innerHTML}</dialog>${tag("button", pill)}${pill.innerHTML}</button>`);
  toks = fillId(toks, "ri-product", tokenize(w.q("#ri-product").innerHTML));
  for (const [k, v] of w.q("#ri-send").attrs) toks = setAttr(toks, "ri-send", k, v);
  toks = addClass(toks, "ri-note", w.q(".ri-note").classes);
  return toks;
}

for (const locale of LOCALES) {
  describe(`markup: ${locale}`, () => {
    const t = FRAME_TEXT[locale];
    const ds = localize(FIXTURE, locale, "https://example.org/v1/dashboard.json");
    const view = frameView(ds, locale, t);
    const old = runOldPage(locale, { data: ds.data, sources: ds.sources });
    expect(old.threw).toBe(null);

    const oldHeader = () => fillId(tokenize(markupPart(locale, "header")), "updated", [{ t: "text", text: old.el("updated").textContent }]);
    const header = (subscribe: boolean) =>
      createElement(Header, {
        text: t.header,
        subscribeText: t.subscribe,
        logoSrc: LOGO,
        updated: view.updated,
        csv: view.csv,
        subscribe: subscribe ? { endpoint: `${FORMS}/api/subscribe`, open: false, onOpenChange: noop } : null,
      });

    it("header, with Subscribe (a forms address is set)", () => {
      expect(render(header(true))).toEqual(normalise(oldHeader()));
    });

    it("header, without Subscribe (no forms address): the two elements are left out", () => {
      // The static build kept them and hid them with CSS (--api-url none).
      const without = (toks: Tok[]) => {
        const drop = (id: string, ts: Tok[]) => {
          const part = subtree(ts, byId(id));
          const at = ts.indexOf(part[0]);
          return [...ts.slice(0, at), ...ts.slice(at + part.length)];
        };
        return drop("subwrap", drop("sub-open", toks));
      };
      expect(render(header(false))).toEqual(normalise(without(oldHeader())));
    });

    it("Subscribe's panel after a submit: the page's own handler against SubscribePanel", async () => {
      const cases = [
        { name: "no names", fields: ["", " ", "a@b.org"], reply: { status: 200, body: { ok: true } } },
        { name: "bad address", fields: ["Ada", "L", "nope"], reply: { status: 200, body: { ok: true } } },
        { name: "subscribed", fields: ["Ada", "L", "a@b.org"], reply: { status: 200, body: { ok: true, status: "subscribed" } } },
        { name: "already", fields: ["Ada", "L", "a@b.org"], reply: { status: 200, body: { ok: true, status: "already" } } },
        { name: "failed", fields: ["Ada", "L", "a@b.org"], reply: { status: 502, body: { ok: false } } },
      ] as const;
      for (const c of cases) {
        const net = stubFetch(c.reply);
        const page = runOldPage(locale, { data: ds.data, sources: ds.sources, fetch: net.fetch });
        const ids = ["sub-first", "sub-last", "sub-email"];
        ids.forEach((id, i) => (page.el(id).value = c.fields[i]));
        await page.el("sub-form").fire("submit");
        // the page's elements after its handler ran, written into its markup
        const msgEl = page.el("sub-msg");
        let toks = fillId(oldHeader(), "sub-msg", [{ t: "text", text: msgEl.textContent }]);
        toks = setAttr(toks, "sub-msg", "hidden", msgEl.hidden ? "" : null);
        toks = setAttr(toks, "sub-msg", "class", msgEl.className);
        for (const id of ids) toks = setAttr(toks, id, "aria-invalid", page.el(id).getAttribute("aria-invalid"));

        const outcome = c.name === "no names" ? "names" : c.name === "bad address" ? "email" : c.name;
        const invalid =
          c.name === "no names" ? { firstName: true, lastName: true } : c.name === "bad address" ? { email: true } : {};
        const panel = renderToStaticMarkup(
          createElement(SubscribePanel, { text: t.subscribe, open: false, msg: subscribeMessage(outcome, t.subscribe), invalid }),
        );
        const want = normalise(subtree(toks, byId("sub-open"))).concat(normalise(subtree(toks, byId("subwrap"))));
        expect(normalise(tokenize(panel)), c.name).toEqual(want);
      }
    });

    it("banner: none (draft data), illustrative, and the loader's two messages", () => {
      expect(render(createElement(Banner, { kind: null, text: t.banner }))).toEqual(
        normalise(tokenize(markupPart(locale, "banner"))),
      );
      // illustrative: the page's own banner code, given illustrative data
      const ill = structuredClone(ds.data);
      ill.meta.dataStatus = "illustrative";
      const b = runOldPage(locale, { data: ill, sources: ds.sources }).el("banner");
      expect(b.hidden).toBe(false);
      expect(render(createElement(Banner, { kind: "illustrative", text: t.banner }))).toEqual(
        normalise(tokenize(`<div class="demo-banner ${b.className}" id="banner">${b.innerHTML}</div>`)),
      );
      // fail and schema: the loader's notice(), which adds "error" and writes MSG
      const MSG = old.get("MSG") as { fail: string; schema: string };
      for (const kind of ["fail", "schema"] as const) {
        expect(render(createElement(Banner, { kind, text: t.banner })), kind).toEqual(
          normalise(tokenize(`<div class="demo-banner error" id="banner">${MSG[kind]}</div>`)),
        );
      }
    });

    it("footer: disclaimer, About LAUNCH, About the data, Sources, Definitions", () => {
      let toks = tokenize(markupPart(locale, "footer"));
      toks = fillId(toks, "disc-countries", tokenize(old.el("disc-countries").innerHTML));
      toks = fillId(toks, "srclist", tokenize(old.el("srclist").innerHTML));
      toks = fillId(toks, "srcdocs", tokenize(old.el("srcdocs").innerHTML));
      toks = setAttr(toks, "srcdocs-wrap", "hidden", old.el("srcdocs-wrap").hidden ? "" : null);
      toks = setAttr(toks, "glossary", "hidden", old.el("glossary").hidden ? "" : null);
      toks = fillId(toks, "glossary-list", tokenize(old.el("glossary-list").innerHTML));
      const now = render(
        createElement(Footer, {
          text: t.footer,
          sources: view.sources,
          countryChecks: view.countryChecks,
          glossary: view.glossary,
        }),
      );
      expect(now).toEqual(normalise(toks));
      // the data does fill every part
      expect(old.el("srcdocs-wrap").hidden).toBe(false);
      expect(old.el("glossary").hidden).toBe(false);
      expect(view.countryChecks).not.toBe("");
    });

    for (const connected of [true, false]) {
      it(`feedback dialog and pill, ${connected ? "connected" : "not connected (no forms address)"}`, () => {
        const products = [...ds.data.products, { ...ds.data.products[0], id: "planned", name: "Planned one", placeholder: true }];
        const w = runOldWidget(locale, {
          products,
          meta: ds.data.meta,
          connected,
          env: { url: "", path: "", title: "", userAgent: "", now: new Date(0) },
        });
        w.api.open();
        const now = render(
          createElement(FeedbackDialog, {
            text: t.feedback,
            connected,
            products: feedbackProducts(products, t.feedback.planned),
          }),
        );
        expect(now).toEqual(normalise(oldWidgetTokens(w)));
      });
    }

    it("feedback dialog after a submit: errors, the done screen, the failure alert", async () => {
      const products = ds.data.products;
      const options = feedbackProducts(products, t.feedback.planned);
      const env = { url: "u", path: "p", title: "t", userAgent: "a", now: new Date(0) };
      const cases: { name: string; message: string; email: string; reply: Parameters<typeof stubFetch>[0] }[] = [
        { name: "errors", message: "short", email: "nope", reply: { status: 200, body: { ok: true } } },
        { name: "done", message: "A long enough message.", email: "", reply: { status: 200, body: { ok: true, ref: "LAUNCH-1" } } },
        { name: "failed", message: "A long enough message.", email: "", reply: { status: 502, body: { ok: false } } },
      ];
      for (const c of cases) {
        const net = stubFetch(c.reply);
        const w = runOldWidget(locale, { products, meta: ds.data.meta, connected: true, fetch: net.fetch, env });
        w.api.open();
        w.q("#ri-message").value = c.message;
        w.q("#ri-email").value = c.email;
        await w.q(".ri-form").fire("submit");
        await new Promise((r) => setTimeout(r, 0));
        // the widget's elements after its handler ran, written into its markup
        let toks = oldWidgetTokens(w);
        for (const f of ["ri-f-message", "ri-f-email"]) {
          if (w.q(`#${f}`).classes.includes("is-bad")) {
            toks = toks.map((tk) => (tk.t === "open" && attr(tk, "id") === f ? { ...tk, attrs: tk.attrs.map(([k, v]): [string, string] => (k === "class" ? [k, `${v} is-bad`] : [k, v])) } : tk));
          }
        }
        for (const [sel, id] of [["#ri-e-message", "ri-e-message"], ["#ri-e-email", "ri-e-email"], ["#ri-ref", "ri-ref"], ["#ri-alert", "ri-alert"]]) {
          const text = w.q(sel).textContent;
          if (text) toks = fillId(toks, id, [{ t: "text", text }]);
        }
        for (const [sel, id] of [["#ri-message", "ri-message"], ["#ri-email", "ri-email"]]) {
          toks = setAttr(toks, id, "aria-invalid", w.q(sel).getAttribute("aria-invalid"));
        }
        if (w.q("#ri-alert").classes.includes("is-on")) toks = addClass(toks, "ri-alert", ["is-on"]);
        const formOpen = toks.findIndex((tk) => tk.t === "open" && attr(tk, "class") === "ri-form");
        if (w.q(".ri-form").hidden) toks[formOpen] = { ...(toks[formOpen] as Extract<Tok, { t: "open" }>), attrs: [...(toks[formOpen] as Extract<Tok, { t: "open" }>).attrs, ["hidden", ""]] };
        toks = setAttr(toks, "ri-done", "hidden", w.q("#ri-done").hidden ? "" : null);

        const errors = checkFeedback(c.message, c.email);
        const state: FeedbackState =
          c.name === "errors"
            ? { ...FEEDBACK_START, errors }
            : c.name === "done"
              ? { ...FEEDBACK_START, done: true, reference: "LAUNCH-1" }
              : { ...FEEDBACK_START, alert: { on: true, text: t.feedback.failed } };
        const now = render(createElement(FeedbackDialog, { text: t.feedback, connected: true, products: options, state }));
        expect(now, c.name).toEqual(normalise(toks));
        if (c.name === "done") expect(now).toContain(JSON.stringify(fill(t.feedback.reference, { ref: "LAUNCH-1" })));
      }
    });

    it("the whole frame: root, order, and the parts above", () => {
      const toks = html(
        createElement(
          DashboardFrame,
          {
            text: t,
            view,
            formsUrl: FORMS,
            logoSrc: LOGO,
            outside: createElement("div", { id: "tip", role: "tooltip" }),
          },
          createElement("div", { className: "board", id: "board" }),
        ),
      );
      // the root, then .wrap with header, banner, the areas, footer; then the
      // outside slot, the dialog and the pill, all inside the root
      const top = (ts: Tok[]) => {
        const kids: string[] = [];
        let depth = 0;
        for (const tk of ts) {
          if (tk.t === "open") {
            if (depth === 1) kids.push(`${tk.name}${attr(tk, "id") ? "#" + attr(tk, "id") : ""}.${attr(tk, "class") || ""}`);
            if (!["img", "input"].includes(tk.name)) depth++;
          } else if (tk.t === "close") depth--;
        }
        return kids;
      };
      expect(toks[0]).toEqual({ t: "open", name: "div", attrs: [["class", "launch-dashboard"]] });
      expect(top(toks)).toEqual(["div.wrap", "div#tip.", "dialog#report-issue-dialog.ri-dialog", "button.ri-pill"]);
      const wrap = subtree(toks, (tk) => attr(tk, "class") === "wrap");
      expect(top(wrap)).toEqual(["header.", "div#banner.demo-banner", "div#board.board", "footer."]);
      expect(normalise(subtree(toks, (tk) => tk.name === "header"))).toEqual(render(header(true)));
      expect(normalise(subtree(toks, (tk) => tk.name === "footer"))).toEqual(
        render(createElement(Footer, { text: t.footer, sources: view.sources, countryChecks: view.countryChecks, glossary: view.glossary })),
      );
      // no forms address: no Subscribe, Send feedback blocked
      const off = renderToStaticMarkup(createElement(DashboardFrame, { text: t, view, formsUrl: "", logoSrc: LOGO }));
      expect(off).not.toContain('id="sub-open"');
      expect(off).not.toContain('id="subwrap"');
      expect(off).toContain('aria-disabled="true"');
      expect(off).toContain('class="ri-note ri-mock"');
    });
  });
}
