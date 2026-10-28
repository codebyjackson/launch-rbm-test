// Every test file starts with the Portuguese words of 28 Oct 2026, before the
// switch to Brazilian Portuguese (fixtures/messages/pt-PT.json, the same keys
// as messages/pt.json), handed over as RBM's page hands over its own copy
// (lib/messages.ts provideMessages).
//
// Why: the golden, markup and text-parity tests compare the port with the old
// pages' saved copies, which are European Portuguese. Fed the same words, the
// comparison tests the logic, as it did before the switch; the harnesses also
// give the old code the new code's language tag (lib/frame.ts PAGE_LANG), so
// dates and numbers follow the same locale on both sides. The Brazilian words
// themselves are the translation pipeline's: tests/messages.test.ts checks
// their keys and placeholders (after resetting this), and scripts/smoke.mjs
// checks them in the browser.
import { provideMessages } from "@/lib/messages";
import european from "../fixtures/messages/pt-PT.json";

provideMessages("pt", european.Unitaid);
