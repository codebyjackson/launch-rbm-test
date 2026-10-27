"use client";

import "@/styles/feedback.css";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent as ReactMouseEvent,
  type RefObject,
  type SyntheticEvent,
} from "react";
import { flushSync } from "react-dom";
import {
  FEEDBACK_TYPES,
  prepareFeedback,
  sendFeedback,
  type FeedbackErrors,
  type FeedbackOption,
} from "@/lib/frame";
import { fill } from "@/lib/strings";
import type { FeedbackText } from "./text";

interface DialogRefs {
  dialog: RefObject<HTMLDialogElement | null>;
  form: RefObject<HTMLFormElement | null>;
  title: RefObject<HTMLHeadingElement | null>;
  alert: RefObject<HTMLParagraphElement | null>;
  type: RefObject<HTMLSelectElement | null>;
  product: RefObject<HTMLSelectElement | null>;
  message: RefObject<HTMLTextAreaElement | null>;
  name: RefObject<HTMLInputElement | null>;
  email: RefObject<HTMLInputElement | null>;
  organisation: RefObject<HTMLInputElement | null>;
  done: RefObject<HTMLDivElement | null>;
  again: RefObject<HTMLButtonElement | null>;
}

/** What the dialog shows besides its fixed text. */
export interface FeedbackState {
  /** the done screen instead of the form */
  done: boolean;
  /**
   * the last reference the server gave ("" shows "—"); null before the
   * first report. It stays after "Send more feedback", as on the page.
   */
  reference: string | null;
  errors: FeedbackErrors;
  /** the red alert above the fields; its text stays once set, as on the page */
  alert: { on: boolean; text: string };
  busy: boolean;
}

/** The words under the message and email fields for what validate() found ("" for none). */
export function feedbackErrorText(errors: FeedbackErrors, text: FeedbackText): { message: string; email: string } {
  return {
    message: errors.message === "empty" ? text.errEmpty : errors.message === "short" ? text.errShort : "",
    email: errors.email ? text.errEmail : "",
  };
}

export const FEEDBACK_START: FeedbackState = {
  done: false,
  reference: null,
  errors: { message: "", email: "" },
  alert: { on: false, text: "" },
  busy: false,
};

/**
 * The feedback dialog and its floating pill, drawn from plain values.
 * `connected` is false when there is no forms address: Send is then inert
 * (aria-disabled, its click blocked) and the note says so in red, as on the
 * static pages built with `--api-url none`.
 */
export function FeedbackDialog({
  text,
  connected,
  products,
  state = FEEDBACK_START,
  refs,
  handlers = {},
}: {
  text: FeedbackText;
  connected: boolean;
  products: readonly FeedbackOption[];
  state?: FeedbackState;
  refs?: DialogRefs;
  handlers?: {
    onSubmit?: (e: FormEvent<HTMLFormElement>) => void;
    onDialogClick?: (e: ReactMouseEvent<HTMLDialogElement>) => void;
    onClose?: () => void;
    onCancel?: (e: SyntheticEvent<HTMLDialogElement>) => void;
    onAgain?: () => void;
  };
}) {
  const { message: msgErr, email: mailErr } = feedbackErrorText(state.errors, text);
  const which = connected ? "connected" : "notConnected";
  return (
    <>
      <dialog
        className="ri-dialog"
        id="report-issue-dialog"
        aria-labelledby="ri-title"
        ref={refs?.dialog}
        onClick={handlers.onDialogClick}
        onClose={handlers.onClose}
        onCancel={handlers.onCancel}
      >
        <form className="ri-form" noValidate hidden={state.done} ref={refs?.form} onSubmit={handlers.onSubmit}>
          <div className="ri-head">
            <h2 id="ri-title" tabIndex={-1} ref={refs?.title}>
              {text.title}
            </h2>
            <p>{text.intro}</p>
            <button type="button" className="ri-x" data-ri-close="" aria-label={text.close}>
              ×
            </button>
          </div>
          <div className="ri-body">
            <p className={state.alert.on ? "ri-alert is-on" : "ri-alert"} id="ri-alert" role="alert" ref={refs?.alert}>
              {state.alert.text}
            </p>
            <div className="ri-field">
              <label htmlFor="ri-type">{text.typeLabel}</label>
              <select className="ri-select" id="ri-type" name="type" ref={refs?.type}>
                {FEEDBACK_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {text.types[t]}
                  </option>
                ))}
              </select>
            </div>
            <div className="ri-field">
              <label htmlFor="ri-product">
                {text.productLabel} <span className="ri-opt">{text.optional}</span>
              </label>
              <select className="ri-select" id="ri-product" name="product" ref={refs?.product}>
                <option value="">{text.general}</option>
                {products.map((p, i) => (
                  <option key={i} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div className={msgErr ? "ri-field is-bad" : "ri-field"} id="ri-f-message">
              <label htmlFor="ri-message">{text.messageLabel}</label>
              <textarea
                className="ri-textarea" id="ri-message" name="message" maxLength={2000} required
                aria-describedby="ri-e-message" placeholder={text.messagePlaceholder}
                aria-invalid={msgErr ? "true" : undefined} ref={refs?.message}
              ></textarea>
              <p className="ri-err" id="ri-e-message">
                {msgErr}
              </p>
            </div>
            <div className="ri-row">
              <div className="ri-field">
                <label htmlFor="ri-name">
                  {text.nameLabel} <span className="ri-opt">{text.optional}</span>
                </label>
                <input className="ri-input" id="ri-name" name="name" type="text" autoComplete="name" ref={refs?.name} />
              </div>
              <div className={mailErr ? "ri-field is-bad" : "ri-field"} id="ri-f-email">
                <label htmlFor="ri-email">
                  {text.emailLabel} <span className="ri-opt">{text.optional}</span>
                </label>
                <input
                  className="ri-input" id="ri-email" name="email" type="email" autoComplete="email"
                  aria-describedby="ri-e-email" aria-invalid={mailErr ? "true" : undefined} ref={refs?.email}
                />
                <p className="ri-err" id="ri-e-email">
                  {mailErr}
                </p>
              </div>
            </div>
            <div className="ri-field">
              <label htmlFor="ri-org">
                {text.orgLabel} <span className="ri-opt">{text.optional}</span>
              </label>
              <input
                className="ri-input" id="ri-org" name="organisation" type="text" autoComplete="organization"
                placeholder={text.orgPlaceholder} ref={refs?.organisation}
              />
            </div>
            <p className={connected ? "ri-note" : "ri-note ri-mock"}>{text.note[which]}</p>
          </div>
          <div className="ri-foot">
            <button type="button" className="ri-btn ri-ghost" data-ri-close="">
              {text.cancel}
            </button>
            <button
              type="submit"
              className="ri-btn ri-primary"
              id="ri-send"
              disabled={state.busy}
              aria-disabled={connected ? undefined : "true"}
              // Not connected, the click is blocked rather than the button
              // disabled, so it keeps its normal look and the red note is the
              // one explanation. Enter in a field clicks it too, so that is
              // blocked as well.
              onClick={connected ? undefined : (e) => e.preventDefault()}
            >
              {state.busy ? (
                <>
                  <span className="ri-spin"></span>
                  {text.sending}
                </>
              ) : (
                text.submit
              )}
            </button>
          </div>
        </form>
        <div className="ri-done" id="ri-done" role="status" hidden={!state.done} ref={refs?.done}>
          <div className="ri-check" aria-hidden="true">
            ✓
          </div>
          <h3>{text.doneTitle[which]}</h3>
          <p id="ri-done-msg">{text.doneMessage[which]}</p>
          <p>
            <span className="ri-ref" id="ri-ref">
              {state.reference === null ? "" : fill(text.reference, { ref: state.reference || "—" })}
            </span>
          </p>
          <div
            className="ri-foot"
            style={{ justifyContent: "center", background: "none", border: 0, paddingTop: "6px" }}
          >
            <button type="button" className="ri-again" id="ri-again" ref={refs?.again} onClick={handlers.onAgain}>
              {text.again}
            </button>
            <button type="button" className="ri-btn ri-primary" data-ri-close="">
              {text.close}
            </button>
          </div>
        </div>
      </dialog>
      <button type="button" className="ri-pill" data-report-issue="" aria-haspopup="dialog" aria-label={text.pill}>
        <span>{text.pill}</span>
      </button>
    </>
  );
}

/**
 * Send feedback (assets/report-issue.js). Rendered inside the dashboard's
 * root, not appended to <body>, so its styles (styles/feedback.css, fenced
 * under .launch-dashboard) reach it.
 *
 * Openers, as on the page: the pill; any element with [data-report-issue]
 * or a link to #report-issue (a `data-product="<id>"` on it preselects that
 * medicine); and #report-issue in the address on load. The dialog is a modal
 * <dialog>: the browser keeps focus inside it and Escape closes it (not
 * while sending); focus returns to whatever opened it.
 *
 * Dropped with the port: the window.LAUNCH_REPORT_ISSUE object (open/close
 * from the console, and the in-browser capture of reports on pages that are
 * not connected). No global is set.
 */
export function FeedbackForm({
  text,
  endpoint,
  products,
  lastUpdated,
  dataStatus,
}: {
  text: FeedbackText;
  /** `${NEXT_PUBLIC_LAUNCH_FORMS_URL}/api/feedback`, or null: not connected, nothing is ever posted */
  endpoint: string | null;
  products: readonly FeedbackOption[];
  lastUpdated: string | null;
  dataStatus: string | null;
}) {
  const refs: DialogRefs = {
    dialog: useRef<HTMLDialogElement>(null),
    form: useRef<HTMLFormElement>(null),
    title: useRef<HTMLHeadingElement>(null),
    alert: useRef<HTMLParagraphElement>(null),
    type: useRef<HTMLSelectElement>(null),
    product: useRef<HTMLSelectElement>(null),
    message: useRef<HTMLTextAreaElement>(null),
    name: useRef<HTMLInputElement>(null),
    email: useRef<HTMLInputElement>(null),
    organisation: useRef<HTMLInputElement>(null),
    done: useRef<HTMLDivElement>(null),
    again: useRef<HTMLButtonElement>(null),
  };
  const [state, setState] = useState<FeedbackState>(FEEDBACK_START);
  // the state as last drawn, for open(): see there
  const drawn = useRef(state);
  useEffect(() => {
    drawn.current = state;
  });
  const busyNow = useRef(false);
  const lastTrigger = useRef<HTMLElement | null>(null);
  const { dialog, title, type, product } = refs;

  // Where focus goes when the form appears. With a keyboard, the first
  // field. On a touch screen, the title: focusing a field there opens the
  // phone's picker or keyboard at once, unasked.
  const focusStart = useCallback(() => {
    const touch = typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
    (touch ? title.current : type.current)?.focus();
  }, [title, type]);

  const open = useCallback(
    (trigger: HTMLElement | null) => {
      lastTrigger.current = trigger;
      // fillProducts(): the list starts again on General, or on the trigger's medicine
      const preselect = trigger && trigger.getAttribute ? trigger.getAttribute("data-product") : null;
      if (product.current) product.current.value = preselect || "";
      // Back to the form, drawn before focusing into it. Only when there is
      // something to change: opened from the address on load, this runs in an
      // effect, where flushSync is not allowed, and nothing has changed yet.
      if (drawn.current.done || drawn.current.alert.on) {
        flushSync(() => setState((s) => ({ ...s, done: false, alert: { ...s.alert, on: false } })));
      }
      const d = dialog.current;
      if (!d) return;
      if (typeof d.showModal === "function") {
        if (!d.open) d.showModal();
      } else d.setAttribute("open", "");
      focusStart();
    },
    [dialog, product, focusStart],
  );

  const close = () => {
    if (busyNow.current) return;
    const d = refs.dialog.current;
    if (!d) return;
    if (typeof d.close === "function") d.close();
    else d.removeAttribute("open");
  };

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = e.target as Element | null;
      if (!target || !target.closest) return;
      const t = target.closest('[data-report-issue],a[href="#report-issue"]');
      if (!t) return;
      e.preventDefault();
      open(t as HTMLElement);
    };
    document.addEventListener("click", onClick);
    if (location.hash === "#report-issue") open(null); // shareable deep link
    return () => document.removeEventListener("click", onClick);
  }, [open]);

  const onClose = () => {
    if (location.hash === "#report-issue") history.replaceState(null, "", location.pathname + location.search);
    lastTrigger.current?.focus?.();
    lastTrigger.current = null;
  };

  const onDialogClick = (e: ReactMouseEvent<HTMLDialogElement>) => {
    // a click on the backdrop is a click on the dialog itself
    if (e.target === e.currentTarget) close();
    const t = (e.target as Element).closest ? (e.target as Element).closest("[data-ri-close]") : null;
    if (t) close();
  };

  const onAgain = () => {
    refs.form.current?.reset();
    if (refs.product.current) refs.product.current.value = "";
    flushSync(() => setState((s) => ({ ...s, done: false, errors: { message: "", email: "" } })));
    focusStart();
  };

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busyNow.current) return;
    const v = (r: RefObject<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null>) => r.current?.value ?? "";
    const prepared = prepareFeedback(
      {
        type: v(refs.type),
        productId: v(refs.product),
        message: v(refs.message),
        name: v(refs.name),
        email: v(refs.email),
        organisation: v(refs.organisation),
      },
      {
        endpoint,
        products,
        meta: { lastUpdated, dataStatus },
        env: {
          url: location.href,
          path: location.pathname,
          title: document.title,
          userAgent: navigator.userAgent,
          now: new Date(),
        },
      },
    );
    const errors = prepared.kind === "invalid" ? prepared.errors : { message: "" as const, email: "" as const };
    flushSync(() => setState((s) => ({ ...s, errors })));
    if (prepared.kind === "invalid") {
      (prepared.errors.message ? refs.message : refs.email).current?.focus();
      return;
    }
    if (prepared.kind === "blocked") return;

    busyNow.current = true;
    setState((s) => ({ ...s, busy: true, alert: { ...s.alert, on: false } }));
    try {
      const reference = await sendFeedback(prepared.payload, prepared.endpoint);
      flushSync(() => setState((s) => ({ ...s, done: true, reference })));
      if (refs.done.current) refs.done.current.scrollTop = 0;
      refs.again.current?.focus();
    } catch (err) {
      flushSync(() => setState((s) => ({ ...s, alert: { on: true, text: text.failed } })));
      refs.alert.current?.scrollIntoView({ block: "nearest" });
      console.warn("[LAUNCH] report failed:", err);
    } finally {
      busyNow.current = false;
      setState((s) => ({ ...s, busy: false }));
    }
  };

  return (
    <FeedbackDialog
      text={text}
      connected={!!endpoint}
      products={products}
      state={state}
      refs={refs}
      handlers={{
        onSubmit,
        onDialogClick,
        onClose,
        onCancel: (e) => {
          if (busyNow.current) e.preventDefault();
        },
        onAgain,
      }}
    />
  );
}
