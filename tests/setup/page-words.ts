// Every test file starts with the pages' own words for the few French and
// Portuguese messages that differ from them (fixtures/messages/page-words.json:
// message key → the page's words), handed over as RBM's page hands over its
// own copy (lib/messages.ts provideMessages).
//
// Why: the golden and markup tests compare the port with the pages at
// launch-rbm-test 565cec0, built with the professional translators' text.
// Those messages carry {placeholders} and have their own memory entries,
// still Google's until the translators' follow-up file comes back, so their
// words differ from the page's. Fed the same words, the comparison tests the
// logic. The shipped words themselves are checked by tests/text-parity.test.ts
// (which resets this and lists every difference in CHANGED) and by
// tests/messages.test.ts.
import { provideMessages } from "@/lib/messages";
import fr from "../../messages/fr.json";
import pt from "../../messages/pt.json";
import pageWords from "../fixtures/messages/page-words.json";

type Tree = { [key: string]: string | Tree };

function withPageWords(messages: Tree, words: Record<string, string>): Tree {
  const tree = structuredClone(messages);
  for (const [key, text] of Object.entries(words)) {
    const path = key.split(".");
    const last = path.pop() as string;
    const node = path.reduce((n, k) => n[k] as Tree, tree);
    node[last] = text;
  }
  return tree;
}

provideMessages("fr", withPageWords(fr.Unitaid as Tree, pageWords.fr));
provideMessages("pt", withPageWords(pt.Unitaid as Tree, pageWords.pt));
