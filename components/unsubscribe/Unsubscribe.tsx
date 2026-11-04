"use client";

// The "Unsubscribe?" page's body: a heading, a line or two, the Unsubscribe
// button and a link back. The reader is sent here by the link in the welcome
// email (lib/unsubscribe.ts says how); nothing happens until the button is
// pressed. Drawn inside its own .launch-dashboard root, so it wears the
// dashboard's styles on RBM's page as the dashboard does.
//
// UnsubscribeView draws a state from plain values (the tests render it);
// Unsubscribe holds the state.
import { useEffect, useRef, useState, type Ref } from "react";
import { sendUnsubscribe, tokenFrom } from "@/lib/unsubscribe";
import type { UnsubscribeText } from "./text";

/**
 * "reading" until the page has read its address (the server draws this one,
 * button disabled); "ready" with a token; "sending" while the request is
 * out; then "done", "badLink" (no token, or the service could not read it) or
 * "failed" (anything else; the button stays, to try again).
 */
export type UnsubscribeState = "reading" | "ready" | "sending" | "done" | "badLink" | "failed";

export function UnsubscribeView({
  text,
  state,
  backHref,
  onUnsubscribe,
  headingRef,
}: {
  text: UnsubscribeText;
  state: UnsubscribeState;
  /** the dashboard, in this page's language */
  backHref: string;
  onUnsubscribe?: () => void;
  headingRef?: Ref<HTMLHeadingElement>;
}) {
  const [heading, paras] =
    state === "done"
      ? [text.doneTitle, [text.doneText, text.doneAgain]]
      : state === "badLink"
        ? [text.badLinkTitle, [text.badLinkText]]
        : state === "failed"
          ? [text.failedTitle, [text.failedText]]
          : [text.title, [text.intro]];
  const button = state !== "done" && state !== "badLink";
  return (
    <div className="launch-dashboard">
      <div className="wrap">
        <section className="card unsub" aria-labelledby="unsub-title">
          {/* focusable from script only: it takes focus when the outcome replaces the button */}
          <h1 id="unsub-title" className="unsub-title" tabIndex={-1} ref={headingRef}>
            {heading}
          </h1>
          <div className={state === "failed" || state === "badLink" ? "unsub-msg bad" : "unsub-msg"} role="status" aria-live="polite">
            {paras.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
          {button && (
            <button
              type="button"
              className="sub-go"
              disabled={state === "reading" || state === "sending"}
              onClick={onUnsubscribe}
            >
              {state === "sending" ? text.sending : text.button}
            </button>
          )}
          <p className="unsub-back">
            <a href={backHref}>{text.back}</a>
          </p>
        </section>
      </div>
    </div>
  );
}

export function Unsubscribe({ text, backHref }: { text: UnsubscribeText; backHref: string }) {
  const [state, setState] = useState<UnsubscribeState>("reading");
  const token = useRef("");
  const busy = useRef(false);
  const pressed = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);

  // The address is read in the browser, after hydration, so the page itself
  // is the same for every token and can be built ahead.
  useEffect(() => {
    token.current = tokenFrom(window.location.search);
    setState(token.current ? "ready" : "badLink");
  }, []);

  // When the outcome replaces the button, focus goes to the heading that
  // names it, rather than to the page's start.
  useEffect(() => {
    if (pressed.current && state !== "sending") heading.current?.focus();
  }, [state]);

  const onUnsubscribe = async () => {
    if (busy.current || !token.current) return;
    busy.current = true;
    pressed.current = true;
    setState("sending");
    const outcome = await sendUnsubscribe(token.current);
    busy.current = false;
    setState(outcome);
  };

  return <UnsubscribeView text={text} state={state} backHref={backHref} onUnsubscribe={onUnsubscribe} headingRef={heading} />;
}
