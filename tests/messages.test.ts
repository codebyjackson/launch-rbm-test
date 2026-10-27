// messages/*.json are generated elsewhere and copied in. These checks catch a
// partial copy or a hand edit that drifts one language from the others.
import { describe, expect, it } from "vitest";
import { messagesFor } from "@/lib/messages";
import { LOCALES } from "@/lib/locales";

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
});
