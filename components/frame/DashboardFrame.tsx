"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import { formsEndpoints } from "@/lib/frame";
import { Banner } from "./Banner";
import { FeedbackForm } from "./FeedbackForm";
import { Footer, flashDisclaimer } from "./Footer";
import { Header } from "./Header";
import type { FrameText } from "./text";
import type { FrameView } from "./view";

/**
 * The dashboard's frame and its root element: `.launch-dashboard`, the one
 * element styles/launch-dashboard.css is fenced under, standing in for the
 * static page's <body>. Inside it, in the page's order:
 *
 *   .wrap > header, #banner, {children}, footer
 *   {outside}
 *   the feedback dialog and its pill
 *
 * `children` are the other areas (pathway, gate panel, board, map section);
 * `outside` is what sat directly under <body> on the page (#tip, .stat-tip).
 *
 * The root carries `sub-open` while the Subscribe panel is open (the page put
 * it on <html>). Nothing here touches <html> or <body>.
 */
export function DashboardFrame({
  text,
  view,
  formsUrl,
  logoSrc,
  children,
  outside,
}: {
  /** this language's FrameText: frameText(locale), from the message files */
  text: FrameText;
  /** frameView(dataset, locale, text), worked out on the server */
  view: FrameView;
  /** NEXT_PUBLIC_LAUNCH_FORMS_URL; empty or missing: Subscribe hidden, Send feedback not connected */
  formsUrl?: string;
  /** where the host serves assets/unitaid-logo.svg */
  logoSrc: string;
  children?: ReactNode;
  outside?: ReactNode;
}) {
  const [subOpen, setSubOpen] = useState(false);
  const onSubOpenChange = useCallback((open: boolean) => setSubOpen(open), []);
  const disclaimer = useRef<HTMLDivElement>(null);
  const forms = formsEndpoints(formsUrl);

  return (
    <div className={subOpen ? "launch-dashboard sub-open" : "launch-dashboard"}>
      <div className="wrap">
        <Header
          text={text.header}
          subscribeText={text.subscribe}
          logoSrc={logoSrc}
          updated={view.updated}
          csv={view.csv}
          subscribe={forms ? { endpoint: forms.subscribe, open: subOpen, onOpenChange: onSubOpenChange } : null}
        />
        <Banner
          kind={view.banner}
          text={text.banner}
          // The link is followed even when the address already ends in
          // #disclaimer, which fires no hashchange, so the glow is started
          // here too, just after the jump.
          onDisclaimerLink={() => setTimeout(() => flashDisclaimer(disclaimer.current), 60)}
        />
        {children}
        <Footer
          text={text.footer}
          sources={view.sources}
          countryChecks={view.countryChecks}
          glossary={view.glossary}
          disclaimerRef={disclaimer}
        />
      </div>
      {outside}
      <FeedbackForm
        text={text.feedback}
        endpoint={forms ? forms.feedback : null}
        products={view.feedback.products}
        lastUpdated={view.feedback.lastUpdated}
        dataStatus={view.feedback.dataStatus}
      />
    </div>
  );
}
