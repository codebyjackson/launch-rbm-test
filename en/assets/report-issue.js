/*! LAUNCH Transparency Dashboard — "Report an issue" / contact form.  DEV-04
 *
 *  This file owns the whole interaction: it injects its own styles, the
 *  floating "Report an issue" pill and the modal dialog. It sends nothing
 *  unless the page sets `connected` (below), and only the illustrated journey
 *  page does. A page includes it with one line, after its own scripts:
 *
 *      <script src="assets/report-issue.js" defer></script>
 *
 *  Openers, all equivalent:
 *    · the floating pill (added automatically)
 *    · any element with [data-report-issue]  — the footer link uses this
 *    · any link to #report-issue
 *    · #report-issue in the URL on load, so "here's what's wrong" can be
 *      shared as a link:  index.html#report-issue
 *    · LAUNCH_REPORT_ISSUE.open() from the console or other code
 *
 *  A trigger may carry data-product="<product id>" to preselect the product —
 *  that is how a per-row "report an issue with this product" link would hook
 *  in later, with no change to this file.
 *
 *  Every page runs it as "Send feedback". A page gives it wording that fits
 *  what it shows by setting window.LAUNCH_FEEDBACK_COPY to an object of
 *  overrides BEFORE this script tag; only the keys given change, see the COPY
 *  block below. Two further keys are not wording: `view` (a short id such as
 *  "pipeline", sent as page.view so a report says which view it came from) and
 *  `connected`. Without `connected: true` the Send button is disabled and the
 *  dialog says so in red.
 *
 *  ── SENDING FOR REAL ────────────────────────────────────────────────────
 *  With `connected: true`, submitIssueReport() immediately below POSTs the
 *  payload as JSON to /api/feedback (api/feedback.js, which emails the team
 *  through Resend), and the note and done screen default to wording that
 *  says it was sent. The endpoint answers { ok: true, ref: "<reference shown
 *  to the reporter>" }; anything else shows the dialog's failure message. The
 *  dialog already renders the pending, success and failure states around the
 *  seam, and validation happens before it is called. The endpoint exists only
 *  on the LAUNCH Vercel project, so a page served anywhere else must not set
 *  `connected` (scripts/build-rbm-pages.js turns it off for RBM's copies).
 *
 *  Payload it receives:
 *    { type, productId, productName, message, name, email, organisation,
 *      page: { url, path, title, view },
 *      data: { lastUpdated, dataStatus },
 *      submittedAt, userAgent }
 */
(function () {
  "use strict";

  if (window.LAUNCH_REPORT_ISSUE) return;      // already loaded on this page

  /* ── the one seam ──────────────────────────────────────────────────── */

  async function submitIssueReport(payload) {
    if (CONNECTED) {
      var res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      var body = await res.json().catch(function () { return null; });
      if (!res.ok || !body || !body.ok) throw new Error("HTTP " + res.status);
      return body;                             // → { ok: true, ref: "…" }
    }

    // Every other page: Send is blocked (below), so this runs only when called
    // from the console or other code. The report is kept in memory
    // (LAUNCH_REPORT_ISSUE.submitted) and logged, so a demo can show exactly
    // what would have been sent — nothing leaves the browser.
    await new Promise(function (resolve) { setTimeout(resolve, 600); });
    var ref = "LAUNCH-" + Date.now().toString(36).toUpperCase().slice(-4) +
              Math.random().toString(36).slice(2, 4).toUpperCase();
    API.submitted.push(payload);
    if (window.console && console.info) {
      console.info("[LAUNCH] Issue report captured in the browser only — " +
                   "this page is not connected. Ref " + ref + ":", payload);
    }
    return { ok: true, ref: ref };
  }

  /* ── styles ────────────────────────────────────────────────────────── */

  var CSS = [
    /* floating opener */
    '.ri-pill{position:fixed;right:20px;bottom:20px;z-index:900;display:inline-flex;',
    'align-items:center;padding:12px 22px;border:0;border-radius:999px;',
    'background:var(--accent);color:var(--accent-ink,#fff);font-family:inherit;',
    'font-size:13px;font-weight:650;letter-spacing:.01em;line-height:1;cursor:pointer;',
    'box-shadow:0 4px 14px rgba(0,0,0,.18),0 1px 3px rgba(0,0,0,.12);',
    'transition:transform .15s ease,box-shadow .15s ease}',
    '.ri-pill:hover{transform:translateY(-1px);box-shadow:0 8px 22px rgba(0,0,0,.22),0 2px 5px rgba(0,0,0,.14)}',
    '.ri-pill:focus-visible{outline:2px solid var(--ink);outline-offset:3px}',
    '@media (max-width:560px){.ri-pill{right:12px;bottom:12px;padding:10px 18px;font-size:12px}}',
    /* footer link */
    '.report-link{color:var(--accent);font-weight:650;text-decoration:underline;text-underline-offset:2px;cursor:pointer}',
    /* dialog shell */
    '.ri-dialog{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);margin:0;',
    'z-index:1000;width:min(580px,calc(100vw - 28px));max-height:calc(100vh - 40px);',
    'display:flex;flex-direction:column;padding:0;overflow:hidden;',
    'border:1px solid var(--line);border-radius:14px;background:var(--surface);',
    'color:var(--ink);font-family:inherit;font-size:14px;line-height:1.5;',
    'box-shadow:0 30px 70px rgba(0,0,0,.32)}',
    '.ri-dialog:not([open]){display:none}',
    '.ri-form{flex:1 1 auto;min-height:0;display:flex;flex-direction:column}',
    '.ri-form[hidden],.ri-done[hidden]{display:none}',
    '.ri-dialog::backdrop{background:rgba(12,24,32,.55)}',
    /* header */
    '.ri-head{position:relative;flex:none;padding:17px 52px 14px 22px;',
    'background:var(--accent-soft);border-bottom:1px solid var(--line)}',
    '.ri-head h2{margin:0;font-size:17px;font-weight:700;letter-spacing:-.01em}',
    '.ri-head p{margin:4px 0 0;font-size:12.5px;color:var(--ink-2)}',
    '.ri-x{position:absolute;top:12px;right:12px;width:30px;height:30px;display:grid;',
    'place-items:center;border:0;border-radius:8px;background:transparent;color:var(--ink-2);',
    'font-size:20px;line-height:1;cursor:pointer}',
    '.ri-x:hover{background:var(--surface);color:var(--ink)}',
    '.ri-x:focus-visible{outline:2px solid var(--accent);outline-offset:1px}',
    /* body */
    '.ri-body{flex:1 1 auto;min-height:0;overflow:auto;padding:18px 22px 6px}',
    '.ri-field{margin:0 0 14px}',
    '.ri-field>label{display:block;margin:0 0 5px;font-size:12px;font-weight:650;color:var(--ink-2)}',
    '.ri-opt{font-weight:400;color:var(--ink-3)}',
    '.ri-input,.ri-select,.ri-textarea{width:100%;box-sizing:border-box;padding:9px 11px;',
    'border:1px solid var(--line);border-radius:8px;background:var(--surface);color:var(--ink);',
    'font-family:inherit;font-size:14px;line-height:1.45}',
    '.ri-textarea{min-height:104px;resize:vertical}',
    '.ri-input:focus,.ri-select:focus,.ri-textarea:focus{outline:0;border-color:var(--accent);',
    'box-shadow:0 0 0 3px var(--accent-soft)}',
    '.ri-row{display:grid;grid-template-columns:1fr 1fr;gap:0 12px}',
    '@media (max-width:520px){.ri-row{grid-template-columns:1fr}}',
    '.ri-err{display:none;margin:5px 0 0;font-size:12px;font-weight:600;color:var(--crit)}',
    '.ri-field.is-bad .ri-err{display:block}',
    '.ri-field.is-bad .ri-input,.ri-field.is-bad .ri-textarea{border-color:var(--crit)}',
    '.ri-note{margin:0 0 14px;font-size:11.5px;color:var(--ink-3);line-height:1.5}',
    '.ri-note.ri-mock{color:var(--crit,#C0392B);font-weight:700}',
    '.ri-alert{display:none;margin:0 0 14px;padding:10px 12px;border-radius:8px;',
    'border:1px solid var(--crit);background:var(--crit-soft);color:var(--crit);',
    'font-size:12.5px;font-weight:600}',
    '.ri-alert.is-on{display:block}',
    /* footer */
    '.ri-foot{flex:none;display:flex;align-items:center;justify-content:flex-end;gap:10px;',
    'padding:13px 22px;border-top:1px solid var(--line);background:var(--surface-2)}',
    '.ri-btn{border-radius:8px;padding:8px 15px;font-family:inherit;font-size:13px;',
    'font-weight:650;cursor:pointer}',
    '.ri-btn:focus-visible{outline:2px solid var(--ink);outline-offset:2px}',
    '.ri-primary{border:1px solid transparent;background:var(--accent);color:var(--accent-ink,#fff)}',
    '.ri-ghost{border:1px solid var(--line);background:transparent;color:var(--ink-2)}',
    '.ri-ghost:hover{color:var(--ink);border-color:var(--ink-3)}',
    '.ri-btn[disabled]{opacity:.65;cursor:progress}',
    '.ri-spin{display:inline-block;width:11px;height:11px;margin-right:7px;vertical-align:-1px;',
    'border:2px solid currentColor;border-right-color:transparent;border-radius:50%;',
    'animation:ri-spin .6s linear infinite}',
    '@keyframes ri-spin{to{transform:rotate(360deg)}}',
    /* success */
    '.ri-done{flex:1 1 auto;min-height:0;overflow:auto;padding:32px 26px 28px;text-align:center}',
    '.ri-check{width:46px;height:46px;margin:0 auto 14px;display:grid;place-items:center;',
    'border-radius:50%;background:var(--good-soft,#E2F2EA);color:var(--good,#1E8A5A);',
    'font-size:23px;font-weight:700}',
    '.ri-done h3{margin:0 0 7px;font-size:16px}',
    '.ri-done p{margin:0 auto 15px;max-width:36em;font-size:13px;color:var(--ink-2)}',
    '.ri-ref{display:inline-block;padding:6px 12px;border:1px dashed var(--line);border-radius:8px;',
    'background:var(--surface-2);color:var(--ink);letter-spacing:.05em;font-size:13px;',
    'font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}',
    '.ri-again{background:none;border:0;padding:0;color:var(--accent);font-family:inherit;',
    'font-size:12.5px;font-weight:650;text-decoration:underline;text-underline-offset:2px;cursor:pointer}',
    /* respect the reader */
    '@media (prefers-reduced-motion:reduce){.ri-pill{transition:none}.ri-spin{animation-duration:1.6s}}',
    '@media print{.ri-pill,.ri-dialog{display:none!important}}'
  ].join("");

  var TYPES = [
    ["correction", "Something on the page looks wrong"],
    ["source",     "A source is missing or out of date"],
    ["suggestion", "An idea for making this clearer or more useful"],
    ["other",      "Something else"]
  ];
  // Same four values, relabelled per page via COPY.types below — the value is
  // what a backend keys on, so only the label may be overridden.

  var FB = window.LAUNCH_FEEDBACK_COPY || {};
  var CONNECTED = FB.connected === true;        // only the illustrated journey sets it
  var ENDPOINT = "https://launch-development-test.vercel.app/api/feedback";               // absolute, so /fr/ and /pt/ reach it too
  var VIEW = typeof FB.view === "string" && FB.view ? FB.view : null;

  /* ── wording ───────────────────────────────────────────────────────────
   *  Every visible string lives here so a page can retitle the widget with
   *  no fork of this file: set window.LAUNCH_FEEDBACK_COPY = { … } BEFORE
   *  the <script src="assets/report-issue.js"> tag and only the keys given
   *  are overridden. The illustrated journey page uses it to run the same
   *  widget as "Send feedback".
   */
  var COPY = {
    pill:        "Send feedback",
    title:       "Send feedback",
    intro:       "Something look wrong, out of date, or hard to follow? Tell the LAUNCH team what you're seeing.",
    typeLabel:   "What is your feedback about?",
    messageLabel:"What would you like to tell us?",
    messagePlaceholder:
                 "e.g. A date on this page looks out of date: the source I checked gives a newer one.",
    note:        "Mock only — Send feedback isn't connected yet.",
    submit:      "Send feedback",
    sending:     "Sending…",
    failed:      "Sorry — your feedback could not be sent just now. Please try again in a moment.",
    doneTitle:   "Thanks — though this isn't sent anywhere yet.",
    doneMessage: "This form has no inbox behind it yet, so nothing was actually sent — your note stayed in this browser tab. Once it is connected, the LAUNCH team will read every message, and where you have pointed us to a public source that checks out, we correct the data at the next update.",
    again:       "Send more feedback"
  };
  // A connected page sends, so the three strings that say it does not are
  // replaced. A page's own overrides (below) still win. One literal each, so
  // i18n/reviewed-strings.json can name them for the /fr and /pt copies.
  if (CONNECTED) {
    COPY.note =        "Your email is optional and used only to reply to you. With your message we send the page you are on, the version of the data it shows, and your browser, so the team can see what you saw.";
    COPY.doneTitle =   "Thanks — your feedback has been sent.";
    COPY.doneMessage = "The LAUNCH team reads every message, and where you have pointed us to a public source that checks out, we correct the data at the next update. If you left an email address, any reply from us will quote the reference below.";
  }
  (function (over) {
    if (!over) return;
    Object.keys(COPY).forEach(function (k) {
      if (typeof over[k] === "string" && over[k]) COPY[k] = over[k];
    });
    if (over.types) {
      TYPES.forEach(function (t) {
        if (typeof over.types[t[0]] === "string" && over.types[t[0]]) t[1] = over.types[t[0]];
      });
    }
  })(window.LAUNCH_FEEDBACK_COPY);

  /* ── helpers ───────────────────────────────────────────────────────── */

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function trackedProducts() {
    var d = window.LAUNCH_DATA;
    var list = (d && Array.isArray(d.products)) ? d.products : [];
    return list.filter(function (p) { return p && p.id && p.name; });
  }

  /* ── build once ────────────────────────────────────────────────────── */

  var style = document.createElement("style");
  style.id = "ri-styles";
  style.textContent = CSS;
  document.head.appendChild(style);

  var dlg = document.createElement("dialog");
  dlg.className = "ri-dialog";
  dlg.id = "report-issue-dialog";
  dlg.setAttribute("aria-labelledby", "ri-title");
  dlg.innerHTML =
    '<form class="ri-form" novalidate>' +
      '<div class="ri-head">' +
        '<h2 id="ri-title">' + esc(COPY.title) + '</h2>' +
        '<p>' + esc(COPY.intro) + '</p>' +
        '<button type="button" class="ri-x" data-ri-close aria-label="Close">&times;</button>' +
      '</div>' +
      '<div class="ri-body">' +
        '<p class="ri-alert" id="ri-alert" role="alert"></p>' +
        '<div class="ri-field">' +
          '<label for="ri-type">' + esc(COPY.typeLabel) + '</label>' +
          '<select class="ri-select" id="ri-type" name="type">' +
            TYPES.map(function (t) {
              return '<option value="' + t[0] + '">' + esc(t[1]) + '</option>';
            }).join("") +
          '</select>' +
        '</div>' +
        '<div class="ri-field">' +
          '<label for="ri-product">Which medicine does it concern? <span class="ri-opt">— optional</span></label>' +
          '<select class="ri-select" id="ri-product" name="product"></select>' +
        '</div>' +
        '<div class="ri-field" id="ri-f-message">' +
          '<label for="ri-message">' + esc(COPY.messageLabel) + '</label>' +
          '<textarea class="ri-textarea" id="ri-message" name="message" maxlength="2000" ' +
            'required aria-describedby="ri-e-message" ' +
            'placeholder="' + esc(COPY.messagePlaceholder) + '"></textarea>' +
          '<p class="ri-err" id="ri-e-message"></p>' +
        '</div>' +
        '<div class="ri-row">' +
          '<div class="ri-field">' +
            '<label for="ri-name">Your name <span class="ri-opt">— optional</span></label>' +
            '<input class="ri-input" id="ri-name" name="name" type="text" autocomplete="name">' +
          '</div>' +
          '<div class="ri-field" id="ri-f-email">' +
            '<label for="ri-email">Email <span class="ri-opt">— optional</span></label>' +
            '<input class="ri-input" id="ri-email" name="email" type="email" ' +
              'autocomplete="email" aria-describedby="ri-e-email">' +
            '<p class="ri-err" id="ri-e-email"></p>' +
          '</div>' +
        '</div>' +
        '<div class="ri-field">' +
          '<label for="ri-org">Organisation <span class="ri-opt">— optional</span></label>' +
          '<input class="ri-input" id="ri-org" name="organisation" type="text" ' +
            'autocomplete="organization" placeholder="Ministry of health, manufacturer, partner…">' +
        '</div>' +
        '<p class="ri-note">' + esc(COPY.note) + '</p>' +
      '</div>' +
      '<div class="ri-foot">' +
        '<button type="button" class="ri-btn ri-ghost" data-ri-close>Cancel</button>' +
        '<button type="submit" class="ri-btn ri-primary" id="ri-send">' + esc(COPY.submit) + '</button>' +
      '</div>' +
    '</form>' +
    '<div class="ri-done" id="ri-done" role="status" hidden>' +
      '<div class="ri-check" aria-hidden="true">&#10003;</div>' +
      '<h3>' + esc(COPY.doneTitle) + '</h3>' +
      '<p id="ri-done-msg">' + COPY.doneMessage + '</p>' +
      '<p><span class="ri-ref" id="ri-ref"></span></p>' +
      '<div class="ri-foot" style="justify-content:center;background:none;border:0;padding-top:6px">' +
        '<button type="button" class="ri-again" id="ri-again">' + esc(COPY.again) + '</button>' +
        '<button type="button" class="ri-btn ri-primary" data-ri-close>Close</button>' +
      '</div>' +
    '</div>';

  var pill = document.createElement("button");
  pill.type = "button";
  pill.className = "ri-pill";
  pill.setAttribute("data-report-issue", "");
  pill.setAttribute("aria-haspopup", "dialog");
  pill.setAttribute("aria-label", COPY.pill);
  pill.innerHTML = "<span>" + esc(COPY.pill) + "</span>";

  function mount() {
    document.body.appendChild(dlg);
    document.body.appendChild(pill);
    if (location.hash === "#report-issue") open();   // shareable deep link
  }

  /* ── element handles ───────────────────────────────────────────────── */

  var form    = dlg.querySelector(".ri-form");
  var done    = dlg.querySelector("#ri-done");
  var alertEl = dlg.querySelector("#ri-alert");
  var selType = dlg.querySelector("#ri-type");
  var selProd = dlg.querySelector("#ri-product");
  var txtMsg  = dlg.querySelector("#ri-message");
  var inName  = dlg.querySelector("#ri-name");
  var inMail  = dlg.querySelector("#ri-email");
  var inOrg   = dlg.querySelector("#ri-org");
  var btnSend = dlg.querySelector("#ri-send");
  var lastTrigger = null;
  var busy = false;

  /* ── validation ────────────────────────────────────────────────────── */

  function setErr(fieldId, errId, input, msg) {
    var f = dlg.querySelector(fieldId);
    f.classList.toggle("is-bad", !!msg);
    dlg.querySelector(errId).textContent = msg || "";
    if (msg) input.setAttribute("aria-invalid", "true");
    else input.removeAttribute("aria-invalid");
  }

  function validate() {
    var first = null;
    var msg = txtMsg.value.trim();
    if (!msg) {
      setErr("#ri-f-message", "#ri-e-message", txtMsg, "Please describe the issue.");
      first = first || txtMsg;
    } else if (msg.length < 10) {
      setErr("#ri-f-message", "#ri-e-message", txtMsg,
             "A little more detail, please — at least 10 characters.");
      first = first || txtMsg;
    } else {
      setErr("#ri-f-message", "#ri-e-message", txtMsg, "");
    }

    var mail = inMail.value.trim();
    if (mail && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mail)) {
      setErr("#ri-f-email", "#ri-e-email", inMail, "That email address does not look right.");
      first = first || inMail;
    } else {
      setErr("#ri-f-email", "#ri-e-email", inMail, "");
    }

    if (first) first.focus();
    return !first;
  }

  /* ── open / close ──────────────────────────────────────────────────── */

  function fillProducts(preselect) {
    var opts = ['<option value="">General — the dashboard as a whole</option>'];
    trackedProducts().forEach(function (p) {
      opts.push('<option value="' + esc(p.id) + '">' + esc(p.name) +
                (p.placeholder ? " (planned)" : "") + "</option>");
    });
    selProd.innerHTML = opts.join("");
    if (preselect) selProd.value = preselect;
  }

  function open(trigger) {
    lastTrigger = trigger || null;
    fillProducts(trigger && trigger.getAttribute
                 ? trigger.getAttribute("data-product") : null);
    alertEl.classList.remove("is-on");
    form.hidden = false;
    done.hidden = true;
    if (dlg.showModal) { if (!dlg.open) dlg.showModal(); }
    else dlg.setAttribute("open", "");
    selType.focus();
  }

  function close() {
    if (busy) return;
    if (dlg.close) dlg.close(); else dlg.removeAttribute("open");
  }

  dlg.addEventListener("close", function () {
    if (location.hash === "#report-issue") {
      history.replaceState(null, "", location.pathname + location.search);
    }
    if (lastTrigger && lastTrigger.focus) lastTrigger.focus();
    lastTrigger = null;
  });

  dlg.addEventListener("cancel", function (e) { if (busy) e.preventDefault(); });

  // click on the backdrop = click on the dialog itself
  dlg.addEventListener("click", function (e) { if (e.target === dlg) close(); });

  dlg.addEventListener("click", function (e) {
    var t = e.target.closest ? e.target.closest("[data-ri-close]") : null;
    if (t) close();
  });

  dlg.querySelector("#ri-again").addEventListener("click", function () {
    form.reset();
    setErr("#ri-f-message", "#ri-e-message", txtMsg, "");
    setErr("#ri-f-email", "#ri-e-email", inMail, "");
    fillProducts(null);
    done.hidden = true;
    form.hidden = false;
    selType.focus();
  });

  document.addEventListener("click", function (e) {
    if (!e.target.closest) return;
    var t = e.target.closest('[data-report-issue],a[href="#report-issue"]');
    if (!t) return;
    e.preventDefault();
    open(t);
  });

  // On a page that is not connected the Send button is inert: the click is
  // blocked (not the submit handler) so the button keeps its normal look and
  // the red note is the one explanation.
  if (!CONNECTED) {
    btnSend.setAttribute("aria-disabled", "true");
    btnSend.addEventListener("click", function (e) { e.preventDefault(); });
    dlg.querySelector(".ri-note").classList.add("ri-mock");
  }

  /* ── submit ────────────────────────────────────────────────────────── */

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (busy || !validate()) return;

    var meta = (window.LAUNCH_DATA && window.LAUNCH_DATA.meta) || {};
    var prod = selProd.options[selProd.selectedIndex];
    var payload = {
      type: selType.value,
      productId: selProd.value || null,
      productName: selProd.value ? prod.text : null,
      message: txtMsg.value.trim(),
      name: inName.value.trim() || null,
      email: inMail.value.trim() || null,
      organisation: inOrg.value.trim() || null,
      page: { url: location.href, path: location.pathname, title: document.title, view: VIEW },
      data: { lastUpdated: meta.lastUpdated || null, dataStatus: meta.dataStatus || null },
      submittedAt: new Date().toISOString(),
      userAgent: navigator.userAgent
    };

    busy = true;
    alertEl.classList.remove("is-on");
    btnSend.disabled = true;
    btnSend.innerHTML = '<span class="ri-spin"></span>' + esc(COPY.sending);

    Promise.resolve(API.submit(payload)).then(function (res) {
      dlg.querySelector("#ri-ref").textContent = "Reference " + ((res && res.ref) || "—");
      form.hidden = true;
      done.hidden = false;
      done.scrollTop = 0;
      dlg.querySelector("#ri-again").focus();
    }).catch(function (err) {
      alertEl.textContent = COPY.failed;
      alertEl.classList.add("is-on");
      alertEl.scrollIntoView({ block: "nearest" });
      if (window.console && console.warn) console.warn("[LAUNCH] report failed:", err);
    }).then(function () {
      busy = false;
      btnSend.disabled = false;
      btnSend.textContent = COPY.submit;
    });
  });

  /* ── public surface ────────────────────────────────────────────────── */

  var API = {
    open: open,
    close: close,
    submit: submitIssueReport,   // swap this out to wire a backend at runtime
    submitted: [],               // reports captured on a page that is not connected
    dialog: dlg
  };
  window.LAUNCH_REPORT_ISSUE = API;

  if (document.body) mount();
  else document.addEventListener("DOMContentLoaded", mount);
})();
