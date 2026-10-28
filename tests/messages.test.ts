// messages/*.json are generated elsewhere and copied in. These checks catch a
// partial copy or a hand edit that drifts one language from the others, and
// prove how the dashboard takes the copy RBM's page hands it.
import { afterEach, describe, expect, it } from "vitest";
import { frameText } from "@/components/frame/text";
import { NAMESPACE, messagesFor, provideMessages } from "@/lib/messages";
import { LOCALES } from "@/lib/locales";
import { pageText } from "@/lib/strings";
import enFile from "@/messages/en.json";
import frFile from "@/messages/fr.json";
import ptFile from "@/messages/pt.json";

type Tree = { [key: string]: string | Tree };

const leaves = (tree: Tree, prefix = ""): [string, string][] =>
  Object.entries(tree).flatMap(([k, v]) =>
    typeof v === "string" ? [[prefix + k, v] as [string, string]] : leaves(v, `${prefix}${k}.`),
  );

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

const byLocale = Object.fromEntries(
  LOCALES.map((l) => [l, new Map(leaves(messagesFor(l) as unknown as Tree))]),
);

describe("messages", () => {
  it("has the same keys in every language", () => {
    const en = [...byLocale.en.keys()].sort();
    for (const l of LOCALES) expect([...byLocale[l].keys()].sort()).toEqual(en);
  });

  it("has no empty text", () => {
    for (const l of LOCALES) {
      const empty = [...byLocale[l]].filter(([, v]) => !v.trim()).map(([k]) => k);
      expect(empty, l).toEqual([]);
    }
  });

  it("has the same placeholders in every language", () => {
    const differ: string[] = [];
    for (const [key, text] of byLocale.en) {
      for (const l of LOCALES) {
        const other = byLocale[l].get(key) ?? "";
        if (placeholders(other).join() !== placeholders(text).join()) differ.push(`${l} ${key}`);
      }
    }
    expect(differ).toEqual([]);
  });

  it("holds every message under one key, launchDashboard", () => {
    expect(NAMESPACE).toBe("launchDashboard");
    for (const file of [enFile, frFile, ptFile]) expect(Object.keys(file)).toEqual([NAMESPACE]);
  });
});

// RBM's page hands over next-intl's messages.launchDashboard (Dashboard `text`)
describe("provideMessages: RBM's copy", () => {
  afterEach(() => {
    for (const l of LOCALES) provideMessages(l, undefined);
  });
  // our own French file, with some messages changed as RBM's copy might be
  const theirs = (change: (m: Tree) => void) => {
    const m = JSON.parse(JSON.stringify(frFile[NAMESPACE])) as Tree;
    change(m);
    return m;
  };
  const at = (m: Tree, path: string): Tree => path.split(".").reduce((o, k) => o[k] as Tree, m);

  it("takes every message of an unchanged copy", () => {
    const report = provideMessages("fr", frFile[NAMESPACE]);
    expect(report).toEqual({ used: byLocale.fr.size, kept: [] });
    expect(messagesFor("fr")).toEqual(frFile[NAMESPACE]);
  });

  it("shows RBM's wording, and the text adapters rebuild with it", () => {
    const ours = pageText("fr");
    provideMessages("fr", theirs((m) => { at(m, "common.status").complete = "Achevé"; at(m, "subscribe").button = "S’abonner"; }));
    expect(pageText("fr").status.done).toBe("Achevé");
    expect(pageText("fr")).not.toBe(ours);
    expect(messagesFor("fr").subscribe.button).toBe("S’abonner");
    expect(frameText("fr")).not.toBe(frameText("en"));
  });

  it("keeps our own message where RBM's is missing, empty, not text, or has other {placeholders}", () => {
    const report = provideMessages("fr", theirs((m) => {
      delete at(m, "subscribe").button;
      at(m, "subscribe").title = "  ";
      at(m, "common").yearsOne = 1 as unknown as string;
      at(m, "header").lastUpdated = "Mis à jour {when}";
    }));
    expect(report.kept.sort()).toEqual(["common.yearsOne", "header.lastUpdated", "subscribe.button", "subscribe.title"]);
    expect(report.used).toBe(byLocale.fr.size - 4);
    expect(messagesFor("fr").header.lastUpdated).toBe(byLocale.fr.get("header.lastUpdated"));
    expect(messagesFor("fr").subscribe.button).toBe(byLocale.fr.get("subscribe.button"));
  });

  it("ignores keys we do not have, and anything that is not messages", () => {
    provideMessages("pt", { ...JSON.parse(JSON.stringify(ptFile[NAMESPACE])), extra: { x: "y" } });
    expect("extra" in messagesFor("pt")).toBe(false);
    const report = provideMessages("pt", "not messages");
    expect(report.used).toBe(0);
    expect(messagesFor("pt")).toEqual(ptFile[NAMESPACE]);
  });

  it("goes back to our own copy when nothing is handed over", () => {
    const ours = pageText("fr");
    provideMessages("fr", theirs((m) => { at(m, "common.status").complete = "Achevé"; }));
    provideMessages("fr", undefined);
    expect(pageText("fr")).toBe(ours);
  });

  it("keeps the same messages object for the same words, so nothing rebuilds on every render", () => {
    const first = theirs((m) => { at(m, "common.status").complete = "Achevé"; });
    provideMessages("fr", first);
    const kept = messagesFor("fr");
    const text = pageText("fr");
    expect(provideMessages("fr", first)).toEqual({ used: byLocale.fr.size, kept: [] });
    provideMessages("fr", theirs((m) => { at(m, "common.status").complete = "Achevé"; }));
    expect(messagesFor("fr")).toBe(kept);
    expect(pageText("fr")).toBe(text);
  });

  it("changes one language only", () => {
    provideMessages("fr", theirs((m) => { at(m, "common.status").complete = "Achevé"; }));
    expect(messagesFor("en")).toEqual(enFile[NAMESPACE]);
    expect(pageText("en").status.done).toBe(byLocale.en.get("common.status.complete"));
  });
});
