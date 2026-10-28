// French and Portuguese MapText for the golden test, made from the static
// pages themselves.
//
// The translation build made fr/ and pt/ by replacing the English page's
// string literals one by one, so the reference files' strings line up by
// position. Pairing them gives a dictionary English → French (or
// Portuguese); mapTextEn run through it is the text the French page shows,
// which lets the test compare the components with the old French page.
//
// This is not the message files' French: it is the old page's, mistakes
// included, because that is what the old code is compared on.
import { readFileSync } from "node:fs";
import { parse } from "acorn";
import type { MapText } from "@/components/map/text";
import { mapTextEn } from "../fixtures/text/map-text";

type AnyNode = { type: string; [key: string]: unknown };

/** Every string the code writes, in order: literals and template parts. */
function strings(lang: string): string[] {
  const code = readFileSync(new URL(`./reference/${lang}.js`, import.meta.url), "utf8");
  const out: string[] = [];
  const walk = (n: unknown): void => {
    if (Array.isArray(n)) return n.forEach(walk);
    if (!n || typeof n !== "object" || typeof (n as AnyNode).type !== "string") return;
    const node = n as AnyNode;
    if (node.type === "Literal" && typeof node.value === "string") out.push(node.value);
    if (node.type === "TemplateElement") out.push((node.value as { cooked: string }).cooked);
    for (const k of Object.keys(node)) if (k !== "loc") walk(node[k]);
  };
  walk(parse(code, { ecmaVersion: "latest", sourceType: "script" }));
  return out;
}

// A string's reader-facing parts: the text between tags, and the attribute
// values inside them (aria-label, placeholder). A template part can start
// inside a tag (`" data-det-tab="countries">Countries `) or end inside one.
function pieces(s: string): string[] {
  const out: string[] = [];
  let last = 0;
  for (const m of s.matchAll(/<[^>]*>|^[^<]*?>|<[^>]*$/g)) {
    out.push(s.slice(last, m.index));
    for (const a of m[0].matchAll(/="([^"]*)"/g)) out.push(a[1]);
    last = m.index + m[0].length;
  }
  out.push(s.slice(last));
  return out;
}

export interface Derived {
  text: MapText;
  /** English pieces with more than one translation; the first is used */
  conflicts: string[];
}

export function deriveText(lang: "fr" | "pt"): Derived {
  const en = strings("en"), tr = strings(lang);
  if (en.length !== tr.length) throw new Error(`reference/${lang}.js does not line up with en.js (${tr.length} strings, en has ${en.length})`);
  const dict = new Map<string, Set<string>>();
  const add = (a: string, b: string) => {
    if (!dict.has(a)) dict.set(a, new Set());
    dict.get(a)!.add(b);
  };
  en.forEach((s, i) => {
    add(s, tr[i]);
    const pe = pieces(s), pt = pieces(tr[i]);
    if (pe.length === pt.length) pe.forEach((p, j) => add(p, pt[j]));
  });
  // the same keys trimmed, for a text the old code wrote with a space beside it
  const trimmed = new Map<string, Set<string>>();
  for (const [k, v] of dict) {
    const t = k.trim();
    if (t && t !== k && !dict.has(t)) for (const x of v) {
      if (!trimmed.has(t)) trimmed.set(t, new Set());
      trimmed.get(t)!.add(x.trim());
    }
  }
  const conflicts = new Set<string>();
  const one = (k: string, from: Map<string, Set<string>>): string => {
    const v = [...from.get(k)!];
    // a piece the page left in English in one place and translated in
    // another: the translation is the one wanted
    const tx = v.filter((x) => x !== k);
    if (tx.length > 1) conflicts.add(k);
    return tx[0] ?? k;
  };
  const piece = (part: string): string => {
    if (!part || /^\{\w+\}$/.test(part)) return part;
    if (dict.has(part)) return one(part, dict);
    const core = part.trim();
    if (!core) return part;
    const at = part.indexOf(core);
    const swap = dict.has(core) ? one(core, dict) : trimmed.has(core) ? one(core, trimmed) : core;
    return part.slice(0, at) + swap + part.slice(at + core.length);
  };
  const t = (s: string): string => (dict.has(s) ? one(s, dict) : s.split(/(\{\w+\})/).map(piece).join(""));
  const map = (v: unknown): unknown => {
    if (typeof v === "string") return t(v);
    if (Array.isArray(v)) return v.map(map);
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, map(x)]));
    return v;
  };
  const text = map(mapTextEn) as MapText;
  // Two texts the old code built from smaller pieces than MapText has.
  // `${part}: ${lists ? "lists " : "does not list "}${name}.`
  text.partLists = `{part}: ${t("lists ")}{name}.`;
  text.partNotLists = `{part}: ${t("does not list ")}{name}.`;
  return { text, conflicts: [...conflicts] };
}
