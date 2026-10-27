"use client";

import { Fragment, useEffect, useRef, type RefObject } from "react";
import type { SourceItem, SourceLists } from "@/lib/frame";
import { ChevronIcon, InfoIcon } from "./icons";
import type { FooterText } from "./text";

/**
 * The disclaimer's brief glow (CSS `.disclaimer.flash`, ld-disc-flash).
 * Removing the class and reading a layout value restarts the animation when
 * it is already running, as on the page. The element's className is fixed in
 * React ("disclaimer"), so React never undoes the class added here.
 */
export function flashDisclaimer(el: HTMLElement | null) {
  if (!el) return;
  el.classList.remove("flash");
  void el.offsetWidth;
  el.classList.add("flash");
}

const Ext = () => (
  <span className="ext" aria-hidden="true">
    ↗
  </span>
);

/** One entry of the Sources list: its name (linked when it has an address), what it is, further links, raw data. */
function SourceEntry({ s, rawData }: { s: SourceItem; rawData: string }) {
  return (
    <li>
      {s.cite.url ? (
        <a href={s.cite.url} target="_blank" rel="noopener noreferrer">
          {s.cite.label}
          <Ext />
        </a>
      ) : (
        <span className="srcname">{s.cite.label}</span>
      )}
      <span>
        {s.plain}
        {s.alsoSee.map((a, i) => (
          <Fragment key={i}>
            {" "}
            <a href={a.url} target="_blank" rel="noopener noreferrer">
              {a.label}
              <Ext />
            </a>
            .
          </Fragment>
        ))}
        {s.dataUrl && (
          <>
            {" "}
            <span className="srcraw">
              {rawData} <code>{s.dataUrl}</code>
            </span>
          </>
        )}
      </span>
    </li>
  );
}

/**
 * The footer. Sources and Definitions start closed; #sources in the address
 * opens Sources (on load and on every hash change), printing opens both, and
 * #disclaimer makes the disclaimer glow.
 */
export function Footer({
  text,
  sources,
  countryChecks,
  glossary,
  disclaimerRef,
}: {
  text: FooterText;
  sources: SourceLists;
  /** the disclaimer's sentence on country data (frameView) */
  countryChecks: string;
  glossary: [term: string, definition: string][];
  /** the disclaimer element, so DashboardFrame can make it glow when the banner's link is followed */
  disclaimerRef?: RefObject<HTMLDivElement | null>;
}) {
  const ownDisc = useRef<HTMLDivElement>(null);
  const disc = disclaimerRef ?? ownDisc;
  const srcBox = useRef<HTMLDetailsElement>(null);
  const glossBox = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const onHash = () => {
      if (location.hash === "#sources" && srcBox.current) {
        srcBox.current.open = true;
        srcBox.current.scrollIntoView();
      }
      if (location.hash === "#disclaimer") flashDisclaimer(disc.current);
    };
    // print: open every panel so the printout is complete
    const onPrint = () => {
      if (glossBox.current) glossBox.current.open = true;
      if (srcBox.current) srcBox.current.open = true;
    };
    onHash();
    window.addEventListener("hashchange", onHash);
    window.addEventListener("beforeprint", onPrint);
    return () => {
      window.removeEventListener("hashchange", onHash);
      window.removeEventListener("beforeprint", onPrint);
    };
  }, [disc]);

  const [p1, p2a, p2b, p3] = text.disclaimer;
  return (
    <footer>
      <div
        className="disclaimer"
        id="disclaimer"
        tabIndex={-1}
        ref={disc}
        onAnimationEnd={(e) => e.currentTarget.classList.remove("flash")}
      >
        <h3>
          <InfoIcon />
          {text.disclaimerTitle}
        </h3>
        <p>{p1}</p>
        <p>
          {p2a} <span id="disc-countries">{countryChecks}</span>
          {p2b}
        </p>
        <p>{p3}</p>
      </div>
      <section className="ft-sec" id="about-launch">
        <h3>{text.aboutTitle}</h3>
        {text.about.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </section>
      <section className="ft-sec">
        <h3>{text.dataTitle}</h3>
        <p>{text.data}</p>
      </section>
      <details className="srcs" id="sources" ref={srcBox}>
        <summary>
          <span className="srcs-title">{text.sourcesTitle}</span>
          <ChevronIcon />
        </summary>
        <p className="srcs-intro">{text.sourcesIntro}</p>
        <ul className="srclist" id="srclist">
          {sources.data.map((s, i) => (
            <SourceEntry key={i} s={s} rawData={text.rawData} />
          ))}
        </ul>
        <div id="srcdocs-wrap" hidden={!sources.docs.length}>
          <b>{text.keyDocsHead}</b> {text.keyDocsBody}
          <ul className="srclist" id="srcdocs">
            {sources.docs.map((s, i) => (
              <SourceEntry key={i} s={s} rawData={text.rawData} />
            ))}
          </ul>
        </div>
      </details>
      <details className="updates srcs glossary-panel" id="glossary" hidden={!glossary.length} ref={glossBox}>
        <summary>
          <span className="srcs-title">{text.definitionsTitle}</span>
          <ChevronIcon />
        </summary>
        <ul id="glossary-list">
          {glossary.map(([term, def], i) => (
            <li key={i}>
              <span className="gt">{term}</span>
              <span>{def}</span>
            </li>
          ))}
        </ul>
      </details>
    </footer>
  );
}
