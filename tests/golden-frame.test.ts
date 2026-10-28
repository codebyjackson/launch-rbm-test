// The golden test for the page frame: lib/frame.ts (and the two small
// outcome-to-words functions in components/frame) against the static pages'
// own code, frozen in tests/golden-frame/reference/ by
// tests/golden-frame/extract.mjs (launch-rbm-test 7c1bf11).
//
// The old code runs in node:vm with only the DOM members it touches stubbed
// (tests/golden-frame/harness.ts). Where it wrote markup, the new values are
// drawn into the same markup with the page's own esc() and compared as
// strings, as tests/golden.test.ts does for citations; the components'
// own markup is compared in tests/markup-frame.test.ts.
import { readFileSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";
import { afterAll, describe, expect, it } from "vitest";
import { feedbackErrorText } from "@/components/frame/FeedbackForm";
import { subscribeMessage } from "@/components/frame/Subscribe";
import { FRAME_TEXT } from "./fixtures/text/frame-text";
import { localize, type Product, type Source } from "@/lib/dataset";
import * as frame from "@/lib/frame";
import * as pathway from "@/lib/pathway";
import { LOCALES, type Locale } from "@/lib/locales";
import { DISPLAY, applyShowLate, type Display } from "@/lib/stages";
import { fill } from "@/lib/strings";
import { runOldPage, runOldWidget, stubFetch, type FetchCall, type StubEl } from "./golden-frame/harness";

// The published file on 27 Oct 2026 (pipeline commit 2d30ff3).
const FIXTURE = JSON.parse(readFileSync(new URL("./fixtures/dashboard.json", import.meta.url), "utf8"));
const URL_ = "https://example.org/v1/dashboard.json";
// The address RBM's static copies post to; the new code is given it as the setting.
const FORMS = "https://launch-development-test.vercel.app";
const ENDPOINTS = frame.formsEndpoints(FORMS)!;

type Fn = (...args: unknown[]) => unknown;

const perLocale: Record<Locale, number> = { en: 0, fr: 0, pt: 0 };
const perFunction = new Map<string, number>();

function comparer(locale: Locale) {
  const diffs: { fn: string; input: string; old: unknown; new: unknown }[] = [];
  const same = (fn: string, input: string, got: unknown, want: unknown) => {
    perLocale[locale]++;
    perFunction.set(fn, (perFunction.get(fn) || 0) + 1);
    const w = structuredClone(want);
    if (!isDeepStrictEqual(got, w)) diffs.push({ fn, input, old: w, new: got });
  };
  const check = () => expect(diffs.slice(0, 10), `${diffs.length} differences`).toEqual([]);
  return { same, check };
}

const input = (locale: Locale) => localize(FIXTURE, locale, URL_);

/** The same thing happened on both sides: a value, or a throw (by error type). */
const outcome = (f: () => unknown): unknown => {
  try {
    return { value: f() };
  } catch (e) {
    return { threw: (e as Error).constructor.name };
  }
};

const DATES = [
  "2026-10-19", "2026-01-05", "2026-12-31", "2026-02-29", "2026-13-01", "", "2026", "2026-02",
  "not a date", "2026-10-27T08:38:13.617Z", " 2026-01-01", "2026-1-5",
];

const STATUSES = ["draft", "illustrative", "verified", "", "Illustrative", "published"];

const CELLS: unknown[] = [
  "", "plain", "a,b", 'say "hi"', "line\nbreak", "cr\ronly", "crlf\r\nend", " lead", "trail ", '"', ",",
  "\n", "é – ’ ↗", null, undefined, 0, 12.5, true, false, [1, 2], { a: 1 },
];

/** The products, and variants that reach what the data does not. */
function csvVariants(products: Product[]): { name: string; products: Product[] }[] {
  const clone = () => structuredClone(products);
  const late = clone();
  for (const p of late) for (const s of [...p.stages, ...(p.detail.milestones || [])]) if (s.status !== "done") s.status = "late";
  const placeholder = clone();
  placeholder[0].placeholder = true;
  const awkward = clone();
  awkward[0].name = 'Name, with "comma"';
  awkward[1].name = awkward[2].name.toLowerCase(); // same name, other case: the sort keeps data order
  awkward[0].stages[0].note = 'He said "yes", then\nleft';
  awkward[0].stages[1].date = "2020;\r\n2021";
  awkward[0].stages[2].next = "a,b";
  if (awkward[1].detail.milestones?.[0]) awkward[1].detail.milestones[0].label = 'Label "q"';
  awkward[2].stages[0].source = undefined;
  const noMilestones = clone();
  delete noMilestones[3].detail.milestones;
  return [
    { name: "as published", products: clone() },
    { name: "every unfinished step late", products: late },
    { name: "one placeholder", products: placeholder },
    { name: "awkward cells and names", products: awkward },
    { name: "a medicine without milestones", products: noMilestones },
  ];
}

const SWITCHES: { name: string; on: ("SHOW_PROGRESS" | "SHOW_LATE")[] }[] = [
  { name: "as shipped", on: [] },
  { name: "SHOW_PROGRESS on", on: ["SHOW_PROGRESS"] },
  { name: "SHOW_LATE on", on: ["SHOW_LATE"] },
  { name: "both on", on: ["SHOW_PROGRESS", "SHOW_LATE"] },
];

/** Sources the published file does not have, for the sort and the markup. */
const EDGE_SOURCES = [
  { id: "a", public: true, label: "Item 10", url: "https://x.org/10", plain: "Ten.", group: "data" },
  { id: "b", public: true, label: "item 2", plain: "Two & <three>", group: "data", dataUrl: "https://x.org/raw?a=1&b=2" },
  {
    id: "c", public: true, title: "Éclair", url: "https://x.org/e", plain: "E.", group: "document",
    alsoSee: [{ label: "More", url: "https://x.org/m" }, { label: "Bare" }],
  },
  { id: "d", public: true, label: "", title: "Eclair", plain: "", group: "document" },
  { id: "e", public: true, label: "Zeta", url: "", plain: "No address." },
  { id: "f", public: false, label: "Hidden", url: "https://x.org/h", plain: "Not public." },
  { id: "g", public: true, label: "Ångström", url: 'https://x.org/"q"', plain: 'Quote "x".', alsoSee: [] },
] as unknown as Source[];

// the page's Sources markup, drawn from the new values with the page's own esc
function drawSources(items: frame.SourceItem[], esc: Fn, rawData: string): string {
  const EXT = '<span class="ext" aria-hidden="true">↗</span>';
  const link = (url: string, text: string) =>
    `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(text)}${EXT}</a>`;
  return items
    .map((s) => {
      const name = s.cite.url ? link(s.cite.url, s.cite.label) : `<span class="srcname">${esc(s.cite.label)}</span>`;
      const also = s.alsoSee.map((a) => " " + link(a.url, a.label) + ".").join("");
      const raw = s.dataUrl ? ` <span class="srcraw">${rawData} <code>${esc(s.dataUrl)}</code></span>` : "";
      return `<li>${name}<span>${esc(s.plain)}${also}${raw}</span></li>`;
    })
    .join("");
}

const PAGE_URL = "https://example.org/en/";

/** What a Subscribe submit did, as both sides can report it. */
interface SubscribeSeen {
  calls: FetchCall[];
  msg: { text: string; className: string; hidden: boolean };
  invalid: string[];
  focused: string[];
  resets: number;
}

const SUB_FIELDS = { firstName: "#sub-first", lastName: "#sub-last", email: "#sub-email" } as const;

for (const locale of LOCALES) {
  describe(`golden frame: ${locale}`, () => {
    const t = FRAME_TEXT[locale];

    it("the header's date line, the banner, `tracked` and csvCell", () => {
      const { same, check } = comparer(locale);
      for (const d of DATES) {
        const ds = input(locale);
        ds.data.meta.lastUpdated = d;
        const old = runOldPage(locale, { data: ds.data, sources: ds.sources });
        expect(old.threw, `start-up with lastUpdated ${JSON.stringify(d)}`).toBe(null);
        same("lastUpdatedText", d, frame.lastUpdatedText(d, locale, t.header.lastUpdated), old.el("updated").textContent);
      }
      for (const s of STATUSES) {
        const ds = input(locale);
        ds.data.meta.dataStatus = s;
        const old = runOldPage(locale, { data: ds.data, sources: ds.sources });
        const banner = old.el("banner");
        same("statusBanner", s, frame.statusBanner(s), banner.hidden ? null : banner.classes[0]);
      }

      const ds = input(locale);
      const old = runOldPage(locale, { data: ds.data, sources: ds.sources });
      same("tracked", "published", pathway.tracked(applyShowLate(ds.data.products, DISPLAY)), old.get("tracked"));
      const csvCell = old.get("csvCell") as Fn;
      const strings = new Set<string>();
      const visit = (v: unknown): void => {
        if (typeof v === "string") strings.add(v);
        else if (v && typeof v === "object") Object.values(v).forEach(visit);
      };
      visit(ds.data);
      for (const v of [...CELLS, ...strings]) same("csvCell", JSON.stringify(v) ?? "undefined", frame.csvCell(v), csvCell(v));
      check();
    });

    it("keeps one difference on purpose: a status named like an Object.prototype member", () => {
      // The page looked the status up on a plain object: "constructor" found
      // Object's constructor and wrote its source into the banner. The port
      // shows no banner (docs/react-port-notes.md, decision 16).
      const ds = input(locale);
      ds.data.meta.dataStatus = "constructor";
      const banner = runOldPage(locale, { data: ds.data, sources: ds.sources }).el("banner");
      expect(banner.hidden).toBe(false);
      expect(banner.innerHTML).toMatch(/function Object\(\)/);
      expect(frame.statusBanner("constructor")).toBe(null);
    });

    for (const sw of SWITCHES) {
      it(`the CSV download, ${sw.name}`, async () => {
        const { same, check } = comparer(locale);
        const display: Display = {
          ...DISPLAY,
          showProgress: sw.on.includes("SHOW_PROGRESS"),
          showLate: sw.on.includes("SHOW_LATE"),
        };
        const ds = input(locale);
        for (const v of csvVariants(ds.data.products)) {
          const data = { ...ds.data, products: v.products };
          const old = runOldPage(locale, { data: structuredClone(data), sources: ds.sources, on: sw.on });
          expect(old.threw, v.name).toBe(null);
          let oldThrew: unknown = null;
          await old.el("dl-csv").fire("click").catch((e: unknown) => (oldThrew = (e as Error).constructor.name));
          const now = outcome(() => frame.csvText(frame.csvRows(v.products, ds.data.stages, locale, t.csv, display)));
          if (oldThrew) {
            same("csvRows", `${v.name}: throws`, now, { threw: oldThrew });
            continue;
          }
          expect(old.blobs, v.name).toHaveLength(1);
          const text = (now as { value: string }).value;
          same("csvText", v.name, [frame.CSV_BOM + text], old.blobs[0].parts);
          same("CSV_TYPE", v.name, frame.CSV_TYPE, old.blobs[0].type);
          same("csvFileName", v.name, frame.csvFileName(data.meta.lastUpdated), old.anchors[0].download);
        }
        check();
      });
    }

    it("the Sources list", () => {
      const { same, check } = comparer(locale);
      const ds = input(locale);
      const cases: { name: string; sources: Source[] }[] = [
        { name: "published", sources: ds.sources.sources },
        { name: "edge cases", sources: EDGE_SOURCES },
        { name: "published and edge cases", sources: [...ds.sources.sources, ...EDGE_SOURCES] },
        { name: "none", sources: [] },
        { name: "one with no name at all", sources: [{ id: "x", public: true } as Source] },
        { name: "two with no name at all", sources: [{ id: "x", public: true }, { id: "y", public: true }] as Source[] },
      ];
      for (const c of cases) {
        const old = runOldPage(locale, { data: ds.data, sources: { sources: structuredClone(c.sources) } });
        const now = outcome(() => frame.sourceLists(c.sources, locale));
        if (old.threw) {
          same("sourceLists", `${c.name}: throws`, now, { threw: (old.threw as Error).constructor.name });
          continue;
        }
        const lists = (now as { value: frame.SourceLists }).value;
        const esc = old.get("esc") as Fn;
        same("sourceLists", `${c.name}: registers`, drawSources(lists.data, esc, t.footer.rawData), old.el("srclist").innerHTML);
        same("sourceLists", `${c.name}: documents`, drawSources(lists.docs, esc, t.footer.rawData), old.el("srcdocs").innerHTML);
        same("sourceLists", `${c.name}: documents hidden`, !lists.docs.length, old.el("srcdocs-wrap").hidden);
      }
      check();
    });

    it("the disclaimer's country line and the Definitions list", () => {
      const { same, check } = comparer(locale);
      const ds = input(locale);
      const products = ds.data.products;
      const variant = (f: (ps: Product[]) => void) => {
        const ps = structuredClone(products);
        f(ps);
        return ps;
      };
      const productCases: { name: string; products: Product[] }[] = [
        { name: "published", products },
        { name: "one pending", products: variant((ps) => (ps[0].detail.countries = { status: "pending" })) },
        // malformed on purpose: the type rules this out, the page must survive it
        { name: "a list that is not an object", products: variant((ps) => ((ps[1].detail as Record<string, unknown>).countries = "yes")) },
        { name: "no detail", products: variant((ps) => delete (ps[2] as Partial<Product>).detail) },
        { name: "none verified", products: variant((ps) => ps.forEach((p) => (p.detail.countries = { status: "draft" }))) },
        { name: "no medicines", products: [] },
      ];
      for (const c of productCases) {
        const old = runOldPage(locale, { data: { ...ds.data, products: structuredClone(c.products) }, sources: ds.sources });
        expect(old.threw, c.name).toBe(null);
        const esc = old.get("esc") as Fn;
        same("countryCheckText", c.name, esc(frame.countryCheckText(c.products, t.footer)), old.el("disc-countries").innerHTML);
      }
      const glossaries: { name: string; glossary: unknown }[] = [
        { name: "published", glossary: ds.data.glossary },
        { name: "empty", glossary: {} },
        { name: "missing", glossary: undefined },
        { name: "order and escaping", glossary: { b: "x", B: "y", a: "<z> & 'q'", Ä: "umlaut", "10": "ten", "9": "nine" } },
      ];
      for (const g of glossaries) {
        const old = runOldPage(locale, { data: { ...ds.data, glossary: structuredClone(g.glossary) }, sources: ds.sources });
        const esc = old.get("esc") as Fn;
        const entries = frame.glossaryEntries(g.glossary);
        same("glossaryEntries", `${g.name}: hidden`, !entries.length, old.el("glossary").hidden);
        same(
          "glossaryEntries",
          g.name,
          entries.map(([term, def]) => `<li><span class="gt">${esc(term)}</span><span>${esc(def)}</span></li>`).join(""),
          old.el("glossary-list").innerHTML,
        );
      }
      check();
    });

    it("Subscribe for updates: checks, request and messages", async () => {
      const { same, check } = comparer(locale);
      const ds = input(locale);
      const good = { firstName: "Ada", lastName: "Lovelace", email: "ada@example.org", organisation: "" };
      const fieldCases: { name: string; fields: frame.SubscribeFields }[] = [
        { name: "complete", fields: good },
        { name: "padded, with organisation", fields: { firstName: "  Ada ", lastName: " Lovelace", email: " ada@example.org ", organisation: "  MoH  " } },
        { name: "no names", fields: { ...good, firstName: " ", lastName: "" } },
        { name: "no last name", fields: { ...good, lastName: "  " } },
        { name: "address without a dot", fields: { ...good, email: "ada@example" } },
        { name: "address with a short ending", fields: { ...good, email: "ada@example.o" } },
        { name: "no address", fields: { ...good, email: "" } },
      ];
      const replies: { name: string; reply: Parameters<typeof stubFetch>[0] }[] = [
        { name: "subscribed", reply: { status: 200, body: { ok: true, status: "subscribed" } } },
        { name: "already", reply: { status: 200, body: { ok: true, status: "already" } } },
        { name: "refused", reply: { status: 400, body: { ok: false, error: "Please enter your first and last name." } } },
        { name: "server error", reply: { status: 502, body: { ok: false } } },
        { name: "not JSON", reply: { status: 200 } },
        { name: "ok false", reply: { status: 200, body: { ok: false } } },
        { name: "network failure", reply: "reject" },
      ];
      for (const fc of fieldCases) {
        for (const rc of replies) {
          const label = `${fc.name}, ${rc.name}`;
          // old: the page's own submit handler
          const oldNet = stubFetch(rc.reply);
          const old = runOldPage(locale, { data: ds.data, sources: ds.sources, fetch: oldNet.fetch, pageUrl: PAGE_URL });
          old.el("sub-first").value = fc.fields.firstName;
          old.el("sub-last").value = fc.fields.lastName;
          old.el("sub-email").value = fc.fields.email;
          old.el("sub-org").value = fc.fields.organisation;
          await old.el("sub-form").fire("submit");
          const msgEl: StubEl = old.el("sub-msg");
          const oldSeen: SubscribeSeen = {
            calls: oldNet.calls,
            msg: { text: msgEl.textContent, className: msgEl.className, hidden: msgEl.hidden },
            invalid: Object.values(SUB_FIELDS).filter((id) => old.el(id.slice(1)).getAttribute("aria-invalid") === "true"),
            focused: old.world.focused,
            resets: old.el("sub-form").resets,
          };
          // new: lib/frame.ts and the component's words
          const newNet = stubFetch(rc.reply);
          const checked = frame.checkSubscribe(fc.fields);
          let msg: ReturnType<typeof subscribeMessage>;
          let resets = 0;
          if (!checked.ok) msg = subscribeMessage(checked.problem, t.subscribe);
          else {
            try {
              msg = subscribeMessage(await frame.sendSubscribe(checked.details, PAGE_URL, ENDPOINTS.subscribe, newNet.fetch), t.subscribe);
              resets = 1;
            } catch {
              msg = subscribeMessage("failed", t.subscribe);
            }
          }
          const invalid = checked.ok ? [] : checked.invalid.map((k) => SUB_FIELDS[k]);
          const newSeen: SubscribeSeen = {
            calls: newNet.calls,
            msg: { text: msg.text, className: msg.tone ? `sub-msg ${msg.tone}` : "sub-msg", hidden: !msg.text },
            invalid,
            focused: invalid.slice(0, 1),
            resets,
          };
          same("subscribe", label, newSeen, oldSeen);
        }
      }
      check();
    });

    it("Send feedback: checks, report and request", async () => {
      const { same, check } = comparer(locale);
      const ds = input(locale);
      const products = structuredClone(ds.data.products);
      products.push({ ...structuredClone(products[0]), id: "planned-one", name: " Planned\tone ", placeholder: true });
      const env = {
        url: `https://example.org/${locale}/#board`,
        path: `/${locale}/`,
        title: "The host page's own title",
        userAgent: "TestAgent/1.0",
        now: new Date("2026-10-27T10:11:12.345Z"),
      };
      const meta = { lastUpdated: ds.data.meta.lastUpdated, dataStatus: ds.data.meta.dataStatus };
      const options = frame.feedbackProducts(products, t.feedback.planned);
      const base: frame.FeedbackFields = {
        type: "correction", productId: "", message: "The date for Ghana looks wrong.", name: "", email: "", organisation: "",
      };
      const fieldCases: { name: string; fields: frame.FeedbackFields }[] = [
        { name: "general", fields: base },
        { name: "a medicine, every field", fields: { ...base, type: "source", productId: products[1].id, name: " Ada ", email: " ada@example.org ", organisation: " MoH " } },
        { name: "a planned medicine", fields: { ...base, type: "other", productId: "planned-one" } },
        { name: "no message", fields: { ...base, message: "   " } },
        { name: "nine characters", fields: { ...base, message: "  123456789  " } },
        { name: "ten characters", fields: { ...base, message: "1234567890" } },
        { name: "bad address", fields: { ...base, email: "ada@example" } },
        { name: "no message and a bad address", fields: { ...base, message: "", email: "nope" } },
        { name: "line breaks kept", fields: { ...base, message: "First line\nsecond line\r\nthird" } },
      ];
      const replies: { name: string; reply: Parameters<typeof stubFetch>[0] }[] = [
        { name: "sent", reply: { status: 200, body: { ok: true, ref: "LAUNCH-0A1B2C3D" } } },
        { name: "sent, no reference", reply: { status: 200, body: { ok: true } } },
        { name: "server error", reply: { status: 502, body: { ok: false, error: "Could not send just now." } } },
        { name: "not JSON", reply: { status: 500 } },
        { name: "network failure", reply: "reject" },
      ];
      for (const fc of fieldCases) {
        for (const rc of replies) {
          const label = `${fc.name}, ${rc.name}`;
          // old: the widget's own submit handler, connected
          const oldNet = stubFetch(rc.reply);
          const old = runOldWidget(locale, { products, meta, connected: true, fetch: oldNet.fetch, env });
          old.api.open();
          old.q("#ri-type").value = fc.fields.type;
          old.q("#ri-product").value = fc.fields.productId;
          old.q("#ri-message").value = fc.fields.message;
          old.q("#ri-name").value = fc.fields.name;
          old.q("#ri-email").value = fc.fields.email;
          old.q("#ri-org").value = fc.fields.organisation;
          const focusedBefore = old.world.focused.length;
          await old.q(".ri-form").fire("submit");
          await new Promise((r) => setTimeout(r, 0)); // the widget's promise chain
          const oldSeen = {
            calls: oldNet.calls,
            errors: { message: old.q("#ri-e-message").textContent, email: old.q("#ri-e-email").textContent },
            done: !old.q("#ri-done").hidden && old.q(".ri-form").hidden === true,
            reference: old.q("#ri-ref").textContent,
            alert: { on: old.q("#ri-alert").classList.contains("is-on"), text: old.q("#ri-alert").textContent },
            focused: old.world.focused.slice(focusedBefore),
          };
          // new: lib/frame.ts and the component's words
          const newNet = stubFetch(rc.reply);
          const prepared = frame.prepareFeedback(fc.fields, { endpoint: ENDPOINTS.feedback, products: options, meta, env });
          const newSeen = {
            calls: newNet.calls,
            errors: feedbackErrorText(prepared.kind === "invalid" ? prepared.errors : { message: "", email: "" }, t.feedback),
            done: false,
            reference: "",
            alert: { on: false, text: "" },
            focused: [] as string[],
          };
          if (prepared.kind === "invalid") newSeen.focused = [prepared.errors.message ? "<dialog> #ri-message" : "<dialog> #ri-email"];
          if (prepared.kind === "ready") {
            try {
              const ref = await frame.sendFeedback(prepared.payload, prepared.endpoint, newNet.fetch);
              newSeen.done = true;
              newSeen.reference = fill(t.feedback.reference, { ref: ref || "—" });
              newSeen.focused = ["<dialog> #ri-again"];
            } catch {
              newSeen.alert = { on: true, text: t.feedback.failed };
            }
          }
          same("feedback", label, newSeen, oldSeen);
        }
      }
      check();
    });
  });
}

// Every function and constant lib/frame.ts exports is compared above or in
// tests/forms-frame.test.ts, so a new one cannot arrive unchecked.
it("compares everything lib/frame.ts exports", () => {
  const covered = new Set([
    ...perFunction.keys(),
    // inside the comparisons above, under the name of what they build
    "PAGE_LANG", "csvRows", "checkSubscribe", "sendSubscribe", "EMAIL_RE", "formsEndpoints", "FEEDBACK_TYPES",
    "FEEDBACK_VIEW", "feedbackProducts", "optionText", "checkFeedback", "feedbackPayload", "prepareFeedback",
    "sendFeedback", "CSV_BOM",
  ]);
  expect(Object.keys(frame).filter((name) => !covered.has(name))).toEqual([]);
});

afterAll(() => {
  const total = LOCALES.reduce((n, l) => n + perLocale[l], 0);
  const byFn = [...perFunction].map(([fn, n]) => `${fn} ${n}`).join(", ");
  console.log(
    `golden frame: ${total} comparisons (${LOCALES.map((l) => `${l} ${perLocale[l]}`).join(", ")})\n  by function: ${byFn}`,
  );
});
