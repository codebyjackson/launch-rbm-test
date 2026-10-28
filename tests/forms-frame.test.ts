// The two forms, with fetch stubbed: the exact request each sends, what the
// reader then sees, and that nothing is sent without a forms address.
//
// No DOM is installed, so the forms are tested as their components run them:
// the logic as functions (lib/frame.ts: checkSubscribe and sendSubscribe;
// prepareFeedback and sendFeedback), then the view (SubscribePanel,
// FeedbackDialog) rendered with the state that logic produced. The page's own
// handlers are compared with these in tests/golden-frame.test.ts.
//
// What the server reads, from launch-development main at 89b2011:
//   api/subscribe.js  body.firstName, body.lastName, body.organisation, body.email
//                     (`page` is sent, as by the page, and not read)
//   api/feedback.js   body.message, body.email, body.type, body.productName,
//                     body.name, body.organisation, body.page.url,
//                     body.data.lastUpdated, body.data.dataStatus, body.userAgent
//   api/_mail.js      Content-Type application/json only; EMAIL_RE as below
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DashboardFrame } from "@/components/frame/DashboardFrame";
import { FEEDBACK_START, FeedbackDialog, feedbackErrorText } from "@/components/frame/FeedbackForm";
import { SubscribePanel, subscribeMessage } from "@/components/frame/Subscribe";
import { FRAME_TEXT } from "./fixtures/text/frame-text";
import { frameView } from "@/components/frame/view";
import { localize } from "@/lib/dataset";
import * as frame from "@/lib/frame";
import { stubFetch } from "./golden-frame/harness";

const FIXTURE = JSON.parse(readFileSync(new URL("./fixtures/dashboard.json", import.meta.url), "utf8"));
const t = FRAME_TEXT.en;
const FORMS = "https://forms.example.org";
const ends = frame.formsEndpoints(FORMS)!;

const SERVER_EMAIL_RE = "^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$"; // api/_mail.js EMAIL_RE
const JSON_POST = { method: "POST", headers: { "Content-Type": "application/json" } };

describe("the forms address", () => {
  it("builds both endpoints from the one setting, without a doubled slash", () => {
    expect(ends).toEqual({ subscribe: `${FORMS}/api/subscribe`, feedback: `${FORMS}/api/feedback` });
    expect(frame.formsEndpoints(`${FORMS}//`)).toEqual(ends);
    expect(frame.formsEndpoints(`  ${FORMS}  `)).toEqual(ends);
  });

  it("is off when empty or missing", () => {
    for (const v of ["", "   ", undefined]) expect(frame.formsEndpoints(v), JSON.stringify(v)).toBe(null);
  });

  it("checks addresses with the server's own test", () => {
    expect(frame.EMAIL_RE.source).toBe(SERVER_EMAIL_RE);
  });
});

describe("Subscribe for updates", () => {
  const fields = { firstName: " Ada ", lastName: "Lovelace", email: " ada@example.org", organisation: " MoH " };
  const pageUrl = "https://rbm.example.org/en/dashboard?x=1#board";

  it("posts exactly the fields api/subscribe.js reads, trimmed, plus the page address", async () => {
    const net = stubFetch({ status: 200, body: { ok: true, status: "subscribed" } });
    const checked = frame.checkSubscribe(fields);
    if (!checked.ok) throw new Error("expected valid");
    await frame.sendSubscribe(checked.details, pageUrl, ends.subscribe, net.fetch);
    expect(net.calls).toEqual([
      {
        url: "https://forms.example.org/api/subscribe",
        ...JSON_POST,
        body: JSON.stringify({ firstName: "Ada", lastName: "Lovelace", email: "ada@example.org", organisation: "MoH", page: pageUrl }),
      },
    ]);
    const sent = JSON.parse(net.calls[0].body!);
    expect(Object.keys(sent)).toEqual(["firstName", "lastName", "email", "organisation", "page"]);
  });

  it("sends an empty organisation as an empty string, as the page did", async () => {
    const net = stubFetch({ status: 200, body: { ok: true, status: "subscribed" } });
    const checked = frame.checkSubscribe({ ...fields, organisation: "" });
    if (!checked.ok) throw new Error("expected valid");
    await frame.sendSubscribe(checked.details, pageUrl, ends.subscribe, net.fetch);
    expect(JSON.parse(net.calls[0].body!).organisation).toBe("");
  });

  it("shows the success and 'already' messages, and the failure message", async () => {
    const cases = [
      { reply: { status: 200, body: { ok: true, status: "subscribed" } }, text: t.subscribe.subscribed, tone: "ok" },
      { reply: { status: 200, body: { ok: true, status: "already" } }, text: t.subscribe.already, tone: "ok" },
      { reply: { status: 502, body: { ok: false, error: "Could not subscribe you just now." } }, text: t.subscribe.failed, tone: "bad" },
      { reply: { status: 200, body: { ok: false } }, text: t.subscribe.failed, tone: "bad" },
      { reply: { status: 200 }, text: t.subscribe.failed, tone: "bad" }, // not JSON
      { reply: "reject" as const, text: t.subscribe.failed, tone: "bad" },
    ];
    for (const c of cases) {
      const net = stubFetch(c.reply);
      const checked = frame.checkSubscribe(fields);
      if (!checked.ok) throw new Error("expected valid");
      const msg = await frame
        .sendSubscribe(checked.details, pageUrl, ends.subscribe, net.fetch)
        .then((answer) => subscribeMessage(answer, t.subscribe))
        .catch(() => subscribeMessage("failed", t.subscribe));
      const html = renderToStaticMarkup(createElement(SubscribePanel, { text: t.subscribe, open: true, msg }));
      expect(html, JSON.stringify(c.reply)).toContain(
        `<p class="sub-msg ${c.tone}" id="sub-msg" role="status">${msg.text.replace(/'/g, "&#x27;")}</p>`,
      );
      expect(msg.text).toBe(c.text);
    }
  });

  it("posts nothing when a check fails, and marks the fields", () => {
    for (const [name, f, invalid, problem] of [
      ["no names", { ...fields, firstName: "", lastName: " " }, ["firstName", "lastName"], "names"],
      ["bad address", { ...fields, email: "ada@example" }, ["email"], "email"],
    ] as const) {
      const checked = frame.checkSubscribe(f);
      expect(checked, name).toEqual({ ok: false, invalid, problem });
      const html = renderToStaticMarkup(
        createElement(SubscribePanel, {
          text: t.subscribe,
          open: true,
          msg: subscribeMessage(problem, t.subscribe),
          invalid: Object.fromEntries(invalid.map((k) => [k, true])),
        }),
      );
      expect(html.match(/aria-invalid="true"/g), name).toHaveLength(invalid.length);
      expect(html).toContain('class="sub-msg bad"');
    }
  });

  it("is not there at all without a forms address", () => {
    const ds = localize(FIXTURE, "en", "https://example.org/v1/dashboard.json");
    const view = frameView(ds, "en", t);
    for (const formsUrl of ["", undefined]) {
      const html = renderToStaticMarkup(createElement(DashboardFrame, { text: t, view, formsUrl, logoSrc: "/l.svg" }));
      expect(html).not.toContain("sub-open");
      expect(html).not.toContain("subwrap");
    }
  });
});

describe("Send feedback", () => {
  const products = frame.feedbackProducts(
    [
      { id: "ganlum", name: "GanLum" },
      { id: "x", name: "  Planned\nthing ", placeholder: true },
    ] as unknown as Parameters<typeof frame.feedbackProducts>[0],
    t.feedback.planned,
  );
  const env = {
    url: "https://rbm.example.org/en/dashboard#board",
    path: "/en/dashboard",
    title: "RBM: the dashboard",
    userAgent: "TestAgent/1.0",
    now: new Date("2026-10-27T10:11:12.345Z"),
  };
  const meta = { lastUpdated: "2026-10-19", dataStatus: "draft" };
  const fields: frame.FeedbackFields = {
    type: "source",
    productId: "ganlum",
    message: "  The source for this date is out of date.  ",
    name: " Ada ",
    email: " ada@example.org ",
    organisation: "",
  };

  it("posts the report the widget sent, with every field api/feedback.js reads", async () => {
    const prepared = frame.prepareFeedback(fields, { endpoint: ends.feedback, products, meta, env });
    if (prepared.kind !== "ready") throw new Error("expected ready");
    const net = stubFetch({ status: 200, body: { ok: true, ref: "LAUNCH-0A1B2C3D" } });
    await frame.sendFeedback(prepared.payload, prepared.endpoint, net.fetch);
    expect(net.calls).toEqual([
      {
        url: "https://forms.example.org/api/feedback",
        ...JSON_POST,
        body: JSON.stringify({
          type: "source",
          productId: "ganlum",
          productName: "GanLum",
          message: "The source for this date is out of date.",
          name: "Ada",
          email: "ada@example.org",
          organisation: null,
          page: { url: env.url, path: env.path, title: env.title, view: "illustrated" },
          data: { lastUpdated: "2026-10-19", dataStatus: "draft" },
          submittedAt: "2026-10-27T10:11:12.345Z",
          userAgent: "TestAgent/1.0",
        }),
      },
    ]);
  });

  it("names a planned medicine as the option reads, and General as no medicine", () => {
    const planned = frame.prepareFeedback({ ...fields, productId: "x" }, { endpoint: ends.feedback, products, meta, env });
    const general = frame.prepareFeedback({ ...fields, productId: "" }, { endpoint: ends.feedback, products, meta, env });
    if (planned.kind !== "ready" || general.kind !== "ready") throw new Error("expected ready");
    expect(planned.payload.productName).toBe("Planned thing (planned)");
    expect([general.payload.productId, general.payload.productName]).toEqual([null, null]);
  });

  it("shows the reference on success, a dash without one, and the alert on failure", async () => {
    const cases = [
      { reply: { status: 200, body: { ok: true, ref: "LAUNCH-0A1B2C3D" } }, ref: "Reference LAUNCH-0A1B2C3D" },
      { reply: { status: 200, body: { ok: true } }, ref: "Reference —" },
      { reply: { status: 502, body: { ok: false, error: "Could not send just now." } }, ref: null },
      { reply: { status: 500 }, ref: null },
      { reply: "reject" as const, ref: null },
    ];
    for (const c of cases) {
      const prepared = frame.prepareFeedback(fields, { endpoint: ends.feedback, products, meta, env });
      if (prepared.kind !== "ready") throw new Error("expected ready");
      const net = stubFetch(c.reply);
      const state = await frame
        .sendFeedback(prepared.payload, prepared.endpoint, net.fetch)
        .then((reference) => ({ ...FEEDBACK_START, done: true, reference }))
        .catch(() => ({ ...FEEDBACK_START, alert: { on: true, text: t.feedback.failed } }));
      const html = renderToStaticMarkup(createElement(FeedbackDialog, { text: t.feedback, connected: true, products, state }));
      if (c.ref) {
        expect(html).toContain(`<span class="ri-ref" id="ri-ref">${c.ref}</span>`);
        // React writes noValidate in camelCase; HTML attribute names ignore case
        expect(html).toMatch(/<form class="ri-form" novalidate="" hidden="">/i);
        expect(html).toContain(`<h3>${t.feedback.doneTitle.connected}</h3>`);
      } else {
        expect(html).toContain(`<p class="ri-alert is-on" id="ri-alert" role="alert">${t.feedback.failed}</p>`);
        expect(html).toContain('<div class="ri-done" id="ri-done" role="status" hidden="">');
      }
    }
  });

  it("posts nothing when a check fails, and shows why under each field", () => {
    const prepared = frame.prepareFeedback({ ...fields, message: "too short", email: "ada@" }, { endpoint: ends.feedback, products, meta, env });
    expect(prepared).toEqual({ kind: "invalid", errors: { message: "short", email: "bad" } });
    if (prepared.kind !== "invalid") return;
    const html = renderToStaticMarkup(
      createElement(FeedbackDialog, { text: t.feedback, connected: true, products, state: { ...FEEDBACK_START, errors: prepared.errors } }),
    );
    const words = feedbackErrorText(prepared.errors, t.feedback);
    expect(html).toContain(`<p class="ri-err" id="ri-e-message">${words.message}</p>`);
    expect(html).toContain(`<p class="ri-err" id="ri-e-email">${words.email}</p>`);
    expect(html.match(/class="ri-field is-bad"/g)).toHaveLength(2);
  });

  it("posts nothing without a forms address: Send is blocked and the note says so", async () => {
    const net = stubFetch({ status: 200, body: { ok: true, ref: "never" } });
    const prepared = frame.prepareFeedback(fields, { endpoint: null, products, meta, env });
    expect(prepared).toEqual({ kind: "blocked" });
    expect(net.calls).toEqual([]);
    const html = renderToStaticMarkup(createElement(FeedbackDialog, { text: t.feedback, connected: false, products }));
    expect(html).toContain('aria-disabled="true"');
    expect(html).toContain(`<p class="ri-note ri-mock">${t.feedback.note.notConnected.replace(/'/g, "&#x27;")}</p>`);
  });
});
