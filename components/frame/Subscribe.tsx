"use client";

import { useEffect, useRef, useState, type FocusEvent, type FormEvent, type RefObject } from "react";
import { flushSync } from "react-dom";
import { checkSubscribe, sendSubscribe, type SubscribeField } from "@/lib/frame";
import { MailIcon } from "./icons";
import type { SubscribeText } from "./text";

/** The line under the form: hidden when empty; "ok" or "bad" colours it. */
export interface SubscribeMessage {
  text: string;
  tone: "" | "ok" | "bad";
}

export type SubscribeInvalid = Partial<Record<SubscribeField, boolean>>;

/** The line under the form for each outcome of a submit, as on the page. */
export function subscribeMessage(
  outcome: "names" | "email" | "subscribed" | "already" | "failed",
  text: SubscribeText,
): SubscribeMessage {
  switch (outcome) {
    case "names":
      return { text: text.needNames, tone: "bad" };
    case "email":
      return { text: text.needEmail, tone: "bad" };
    case "already":
      return { text: text.already, tone: "ok" };
    case "subscribed":
      return { text: text.subscribed, tone: "ok" };
    case "failed":
      return { text: text.failed, tone: "bad" };
  }
}

interface PanelRefs {
  button: RefObject<HTMLButtonElement | null>;
  panel: RefObject<HTMLElement | null>;
  title: RefObject<HTMLHeadingElement | null>;
  form: RefObject<HTMLFormElement | null>;
  firstName: RefObject<HTMLInputElement | null>;
  lastName: RefObject<HTMLInputElement | null>;
  email: RefObject<HTMLInputElement | null>;
  organisation: RefObject<HTMLInputElement | null>;
}

/**
 * The Subscribe button and its panel, drawn from plain values: open or not,
 * the message, the fields marked invalid, and whether a request is pending.
 * The fields are uncontrolled, as on the page, so a reset clears them.
 */
export function SubscribePanel({
  text,
  open,
  busy = false,
  msg = { text: "", tone: "" },
  invalid = {},
  refs,
  onToggle,
  onSubmit,
  onPanelBlur,
}: {
  text: SubscribeText;
  open: boolean;
  busy?: boolean;
  msg?: SubscribeMessage;
  invalid?: SubscribeInvalid;
  refs?: PanelRefs;
  onToggle?: () => void;
  onSubmit?: (e: FormEvent<HTMLFormElement>) => void;
  onPanelBlur?: (e: FocusEvent<HTMLElement>) => void;
}) {
  const bad = (k: SubscribeField) => (invalid[k] ? "true" : undefined);
  return (
    <>
      <button
        className="sub-btn"
        id="sub-open"
        type="button"
        aria-expanded={open ? "true" : "false"}
        aria-controls="subwrap"
        ref={refs?.button}
        onClick={onToggle}
      >
        <MailIcon /> {text.open}
      </button>
      <section
        className="subwrap"
        id="subwrap"
        hidden={!open}
        aria-labelledby="sub-title"
        ref={refs?.panel}
        onBlur={onPanelBlur}
      >
        <h2 id="sub-title" tabIndex={-1} ref={refs?.title}>
          {text.title}
        </h2>
        <p>{text.intro}</p>
        <form className="subrow subform" id="sub-form" noValidate ref={refs?.form} onSubmit={onSubmit}>
          <div className="subgrid">
            <div className="subfield">
              <label htmlFor="sub-first">{text.firstName}</label>
              <input
                id="sub-first" name="firstName" type="text" autoComplete="given-name" maxLength={100}
                aria-describedby="sub-msg" aria-invalid={bad("firstName")} ref={refs?.firstName}
              />
            </div>
            <div className="subfield">
              <label htmlFor="sub-last">{text.lastName}</label>
              <input
                id="sub-last" name="lastName" type="text" autoComplete="family-name" maxLength={100}
                aria-describedby="sub-msg" aria-invalid={bad("lastName")} ref={refs?.lastName}
              />
            </div>
            <div className="subfield subfield-wide">
              <label htmlFor="sub-email">{text.email}</label>
              <input
                id="sub-email" name="email" type="email" autoComplete="email" maxLength={254}
                placeholder={text.emailPlaceholder} aria-describedby="sub-msg" aria-invalid={bad("email")} ref={refs?.email}
              />
            </div>
            <div className="subfield subfield-wide">
              <label htmlFor="sub-org">
                {text.organisation} <span className="sub-opt">{text.optional}</span>
              </label>
              <input
                id="sub-org" name="organisation" type="text" autoComplete="organization" maxLength={200}
                ref={refs?.organisation}
              />
            </div>
          </div>
          <button className="sub-go" type="submit" disabled={busy}>
            {busy ? text.sending : text.submit}
          </button>
        </form>
        <p className={msg.tone ? `sub-msg ${msg.tone}` : "sub-msg"} id="sub-msg" role="status" hidden={!msg.text}>
          {msg.text}
        </p>
        <p className="sub-note">{text.note}</p>
      </section>
    </>
  );
}

/**
 * Subscribe for updates (openSub/closeSub and the submit handler on the
 * page). The open state belongs to DashboardFrame, which puts `sub-open` on
 * the dashboard's root while the panel is open; the CSS uses it to move the
 * Send feedback pill out of the panel's way on phones.
 *
 * It closes on Escape (focus back to the button), on a pointer press outside
 * it, and when focus leaves it, as on the page. Those listeners are on
 * `document`, and only while the panel is open: a press anywhere on the host
 * page, outside the dashboard too, must still close it.
 */
export function Subscribe({
  text,
  endpoint,
  open,
  onOpenChange,
}: {
  text: SubscribeText;
  /** where it posts: `${NEXT_PUBLIC_LAUNCH_FORMS_URL}/api/subscribe` (formsEndpoints) */
  endpoint: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const refs: PanelRefs = {
    button: useRef<HTMLButtonElement>(null),
    panel: useRef<HTMLElement>(null),
    title: useRef<HTMLHeadingElement>(null),
    form: useRef<HTMLFormElement>(null),
    firstName: useRef<HTMLInputElement>(null),
    lastName: useRef<HTMLInputElement>(null),
    email: useRef<HTMLInputElement>(null),
    organisation: useRef<HTMLInputElement>(null),
  };
  const [msg, setMsg] = useState<SubscribeMessage>({ text: "", tone: "" });
  const [invalid, setInvalid] = useState<SubscribeInvalid>({});
  const [busy, setBusy] = useState(false);
  // subBusy: a second submit before the first answer is ignored. A ref, as
  // state would only change on the next render.
  const busyNow = useRef(false);

  const openSub = () => {
    // drawn first, so there is something to focus
    flushSync(() => onOpenChange(true));
    // With a keyboard, straight into the first field. On a touch screen, the
    // panel's title: focusing a field there opens the phone keyboard at once,
    // unasked, and iOS scrolls the page under it.
    const touch = typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
    (touch ? refs.title.current : refs.firstName.current)?.focus();
  };

  const { button, panel } = refs;
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node | null;
      const b = button.current;
      if (panel.current && !panel.current.contains(t) && t !== b && !(b && b.contains(t))) onOpenChange(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      onOpenChange(false);
      button.current?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onOpenChange, button, panel]);

  // Tabbing out of it closes it too: left open, it covered whatever took focus next.
  const onPanelBlur = (e: FocusEvent<HTMLElement>) => {
    const next = e.relatedTarget as Node | null;
    if (next && !e.currentTarget.contains(next) && next !== refs.button.current) onOpenChange(false);
  };

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busyNow.current) return;
    const value = (r: RefObject<HTMLInputElement | null>) => r.current?.value ?? "";
    const check = checkSubscribe({
      firstName: value(refs.firstName),
      lastName: value(refs.lastName),
      email: value(refs.email),
      organisation: value(refs.organisation),
    });
    if (!check.ok) {
      flushSync(() => {
        setInvalid(Object.fromEntries(check.invalid.map((k) => [k, true])));
        setMsg(subscribeMessage(check.problem, text));
      });
      refs[check.invalid[0]].current?.focus();
      return;
    }
    busyNow.current = true;
    setInvalid({});
    setBusy(true);
    setMsg({ text: "", tone: "" });
    // Says what actually happened: success only once the server has the
    // address on the list, and an address already there is told so. On
    // failure the details stay in the fields, so trying again is one click.
    try {
      const answer = await sendSubscribe(check.details, window.location.href, endpoint);
      setMsg(subscribeMessage(answer, text));
      refs.form.current?.reset();
    } catch (err) {
      setMsg(subscribeMessage("failed", text));
      console.warn("[LAUNCH] subscribe failed:", err);
    } finally {
      busyNow.current = false;
      setBusy(false);
    }
  };

  return (
    <SubscribePanel
      text={text}
      open={open}
      busy={busy}
      msg={msg}
      invalid={invalid}
      refs={refs}
      onToggle={() => (open ? onOpenChange(false) : openSub())}
      onSubmit={onSubmit}
      onPanelBlur={onPanelBlur}
    />
  );
}
