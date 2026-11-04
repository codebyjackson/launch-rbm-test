// Markup in a canonical form, so the page's HTML strings and React's
// renderToStaticMarkup output can be compared for what a browser builds from
// them, not for how each happens to write it. One token per line:
//
//   - a start tag with its attributes sorted by name, each value decoded
//     ("&amp;" and "&" are the same text) and re-quoted; an attribute with no
//     value ("hidden") reads as an empty one (React writes hidden="");
//   - class values with their whitespace collapsed (the page wrote
//     class=" whoemb" when the extra class was empty);
//   - "<x/>" read as a start and an end tag, as an HTML parser does inside
//     SVG; void elements (<img>) have no end tag either way;
//   - text decoded, runs of whitespace collapsed to one space, and text that
//     is only whitespace dropped (the page's template literals put newlines
//     and indentation between block and flex children, where they draw
//     nothing).
//
// Comments are dropped. It is enough for the markup these tests compare: no
// <script>, <style> or <textarea>, and no ">" inside an attribute value.
const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);

const NAMED: { [entity: string]: string } = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

export function decode(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") return String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : +e.slice(1));
    return NAMED[e.toLowerCase()] ?? m;
  });
}

export function canon(html: string): string[] {
  const out: string[] = [];
  let text = "";
  const flush = () => {
    const t = decode(text).replace(/\s+/g, " ");
    if (t.trim()) out.push(JSON.stringify(t));
    text = "";
  };
  let i = 0;
  while (i < html.length) {
    if (html[i] !== "<") {
      text += html[i++];
      continue;
    }
    if (html.startsWith("<!--", i)) {
      const end = html.indexOf("-->", i);
      if (end < 0) throw new Error("unclosed comment");
      i = end + 3;
      continue;
    }
    flush();
    const closing = html[i + 1] === "/";
    let j = i + (closing ? 2 : 1);
    const name = /^[A-Za-z][\w:-]*/.exec(html.slice(j));
    if (!name) throw new Error(`not a tag at ${i}: ${html.slice(i, i + 30)}`);
    const tag = name[0].toLowerCase();
    j += name[0].length;
    if (closing) {
      const end = html.indexOf(">", j);
      if (end < 0) throw new Error(`unclosed </${tag}>`);
      out.push(`</${tag}>`);
      i = end + 1;
      continue;
    }
    const attrs: [string, string][] = [];
    let selfClosing = false;
    for (;;) {
      while (/\s/.test(html[j] ?? "")) j++;
      if (j >= html.length) throw new Error(`unclosed <${tag}>`);
      if (html[j] === ">") {
        j++;
        break;
      }
      if (html.startsWith("/>", j)) {
        selfClosing = true;
        j += 2;
        break;
      }
      const an = /^[^\s=/>]+/.exec(html.slice(j));
      if (!an) throw new Error(`bad attribute in <${tag}> at ${j}`);
      j += an[0].length;
      let value = "";
      if (html[j] === "=") {
        j++;
        const q = html[j];
        if (q === '"' || q === "'") {
          const end = html.indexOf(q, j + 1);
          if (end < 0) throw new Error(`unclosed attribute value in <${tag}>`);
          value = html.slice(j + 1, end);
          j = end + 1;
        } else {
          const v = /^[^\s>]+/.exec(html.slice(j));
          value = v ? v[0] : "";
          j += value.length;
        }
      }
      value = decode(value);
      if (an[0] === "class") value = value.replace(/\s+/g, " ").trim();
      attrs.push([an[0], value]);
    }
    attrs.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
    out.push(`<${tag}${attrs.map(([k, v]) => ` ${k}=${JSON.stringify(v)}`).join("")}>`);
    if (selfClosing && !VOID.has(tag)) out.push(`</${tag}>`);
    i = j;
  }
  flush();
  return out;
}

/**
 * React 19 preloads the images it server-renders: before an <img src="x"> it
 * writes <link rel="preload" as="image" href="x">, which in a real page goes
 * into <head>. It is React's, not the component's markup, so it is dropped
 * from React's side, and only where the same markup has that <img>.
 */
export function withoutImagePreloads(tokens: string[]): string[] {
  const srcs = new Set(
    tokens.filter((t) => t.startsWith("<img ")).map((t) => (/ src=("(?:[^"\\]|\\.)*")/.exec(t) || [])[1]),
  );
  return tokens.filter((t) => {
    const m = /^<link as="image" href=("(?:[^"\\]|\\.)*") rel="preload">$/.exec(t);
    return !(m && srcs.has(m[1]));
  });
}

/** The first place two canonical forms differ, with a little context, or null. */
export function firstDifference(want: string[], got: string[]): string | null {
  const n = Math.max(want.length, got.length);
  for (let k = 0; k < n; k++) {
    if (want[k] !== got[k]) {
      const ctx = (a: string[]) => a.slice(Math.max(0, k - 2), k + 3).join("\n      ");
      return `token ${k}:\n  old: ${ctx(want)}\n  new: ${ctx(got)}`;
    }
  }
  return null;
}

/** An attribute value as the page's esc() wrote it, for markup the tests put together. */
export const attr = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
