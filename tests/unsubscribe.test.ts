// The "Unsubscribe?" page: app/[locale]/unsubscribe/page.tsx, its body
// (components/unsubscribe/Unsubscribe.tsx), its text and its logic
// (lib/unsubscribe.ts), with fetch stubbed.
//
// No DOM is installed, so, as for the two forms (tests/forms-frame.test.ts),
// the logic is tested as functions and the view is rendered with each state.
// That the page reads its address only after hydration, and posts nothing
// until the button is pressed, is checked in a real browser: the page as the
// server draws it is "reading", with the button disabled.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import UnsubscribePage, { generateMetadata } from "@/app/[locale]/unsubscribe/page";
import { UnsubscribeView, type UnsubscribeState } from "@/components/unsubscribe/Unsubscribe";
import { unsubscribeText } from "@/components/unsubscribe/text";
import { LOCALES } from "@/lib/locales";
import { messagesFor } from "@/lib/messages";
import { sendUnsubscribe, tokenFrom, UNSUBSCRIBE_ENDPOINT } from "@/lib/unsubscribe";
import { stubFetch } from "./golden-frame/harness";

const t = unsubscribeText("en");
const TOKEN = "HVqwJfNM-GKXFBqQ0-usZztE8ABmtkw5_4jo_BAH2joP4l0pEwLxUpAtoU32iXYf";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the link's token", () => {
  it("is ?t= from the address, or empty", () => {
    expect(tokenFrom(`?t=${TOKEN}`)).toBe(TOKEN);
    expect(tokenFrom(`?x=1&t=${TOKEN}`)).toBe(TOKEN);
    expect(tokenFrom("?t=%20abc%20")).toBe("abc");
    for (const s of ["", "?", "?t=", "?t=%20", "?x=1"]) expect(tokenFrom(s), s).toBe("");
  });
});

describe("pressing Unsubscribe", () => {
  it("posts exactly { t } as JSON to this site's relay", async () => {
    const net = stubFetch({ status: 200, body: { ok: true, status: "unsubscribed" } });
    await sendUnsubscribe(TOKEN, net.fetch);
    expect(UNSUBSCRIBE_ENDPOINT).toBe("/api/unitaid/unsubscribe");
    expect(net.calls).toEqual([
      { url: "/api/unitaid/unsubscribe", method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ t: TOKEN }) },
    ]);
  });

  it("comes to done, a bad link, or a failure, by the answer", async () => {
    const cases: [Parameters<typeof stubFetch>[0], string][] = [
      [{ status: 200, body: { ok: true, status: "unsubscribed" } }, "done"],
      [{ status: 400, body: { ok: false, error: "This link doesn't work." } }, "badLink"],
      [{ status: 400 }, "badLink"],
      [{ status: 200, body: { ok: true } }, "failed"],
      [{ status: 200, body: { ok: false, status: "unsubscribed" } }, "failed"],
      [{ status: 200 }, "failed"],
      [{ status: 502, body: { ok: false } }, "failed"],
      [{ status: 503, body: { ok: false, error: "Not configured." } }, "failed"],
      [{ status: 413, body: { ok: false } }, "failed"],
      ["reject", "failed"],
    ];
    for (const [answer, outcome] of cases) {
      expect(await sendUnsubscribe(TOKEN, stubFetch(answer).fetch), JSON.stringify(answer)).toBe(outcome);
    }
  });
});

describe("the page's text", () => {
  it("is the message file's Unitaid.unsubscribe, in every language", () => {
    for (const locale of LOCALES) {
      expect(unsubscribeText(locale), locale).toEqual(messagesFor(locale).unsubscribe);
      expect(unsubscribeText(locale)).toBe(unsubscribeText(locale)); // built once
    }
  });
});

describe("the page, in each state", () => {
  const draw = (state: UnsubscribeState) => renderToStaticMarkup(createElement(UnsubscribeView, { text: t, state, backHref: "/en" }));

  it("sits in its own .launch-dashboard root, with a link back and a live status line", () => {
    for (const state of ["reading", "ready", "sending", "done", "badLink", "failed"] as const) {
      const html = draw(state);
      expect(html.startsWith('<div class="launch-dashboard"><div class="wrap"><section class="card unsub" aria-labelledby="unsub-title">'), state).toBe(true);
      expect(html).toContain('<h1 id="unsub-title" class="unsub-title" tabindex="-1">');
      expect(html).toContain('role="status" aria-live="polite"');
      expect(html).toContain(`<p class="unsub-back"><a href="/en">${esc(t.back)}</a></p>`);
    }
  });

  it("asks first: the title, the line, and the button, disabled until the address is read", () => {
    const reading = draw("reading");
    expect(reading).toContain(`>${esc(t.title)}</h1>`);
    expect(reading).toContain(`<p>${esc(t.intro)}</p>`);
    expect(reading).toContain(`<button type="button" class="sub-go" disabled="">${esc(t.button)}</button>`);
    expect(draw("ready")).toContain(`<button type="button" class="sub-go">${esc(t.button)}</button>`);
    expect(draw("sending")).toContain(`<button type="button" class="sub-go" disabled="">${esc(t.sending)}</button>`);
  });

  it("says it is done, with no button left", () => {
    const html = draw("done");
    expect(html).toContain(`>${esc(t.doneTitle)}</h1>`);
    expect(html).toContain(`<div class="unsub-msg" role="status" aria-live="polite"><p>${esc(t.doneText)}</p><p>${esc(t.doneAgain)}</p></div>`);
    expect(html).not.toContain("<button");
  });

  it("says the link does not work, with no button", () => {
    const html = draw("badLink");
    expect(html).toContain(`>${esc(t.badLinkTitle)}</h1>`);
    expect(html).toContain(`<div class="unsub-msg bad" role="status" aria-live="polite"><p>${esc(t.badLinkText)}</p></div>`);
    expect(html).not.toContain("<button");
  });

  it("says it failed, and keeps the button to try again", () => {
    const html = draw("failed");
    expect(html).toContain(`>${esc(t.failedTitle)}</h1>`);
    expect(html).toContain(`<div class="unsub-msg bad" role="status" aria-live="polite"><p>${esc(t.failedText)}</p></div>`);
    expect(html).toContain(`<button type="button" class="sub-go">${esc(t.button)}</button>`);
  });
});

describe("the page itself", () => {
  const params = (locale: string) => ({ params: Promise.resolve({ locale }) });

  it("is never indexed, sends no Referer, and is titled in its language", async () => {
    for (const locale of LOCALES) {
      expect(await generateMetadata(params(locale)), locale).toEqual({
        title: unsubscribeText(locale).title,
        robots: { index: false, follow: false },
        referrer: "no-referrer",
      });
    }
    expect(await generateMetadata(params("de"))).toEqual({});
  });

  it("is drawn by the server asking, with the button disabled, and sends nothing", async () => {
    const net = stubFetch({ status: 200, body: { ok: true, status: "unsubscribed" } });
    vi.stubGlobal("fetch", net.fetch);
    for (const locale of LOCALES) {
      const html = renderToStaticMarkup(await UnsubscribePage(params(locale)));
      expect(html).toContain(`>${esc(unsubscribeText(locale).title)}</h1>`);
      expect(html).toContain(`<a href="/${locale}">`);
      expect(html).toContain('class="sub-go" disabled=""');
    }
    expect(net.calls).toEqual([]);
  });
});

/** Text as React escapes it in markup. */
function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/'/g, "&#x27;").replace(/</g, "&lt;");
}
