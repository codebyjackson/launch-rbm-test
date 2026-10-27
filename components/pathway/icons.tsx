// The journey's stage glyphs: one per stage, in stage order, drawn once in a
// sprite and referenced by <use>, so each glyph takes its marker's colour.
// The WHO recommendation carries the WHO emblem instead, as an <img>: it is
// the one icon that must keep its own colours, which a sprite symbol drawn
// in currentColor cannot.
//
// Ported from assets/journey-icons/icons-solid.js (the page's own set) and
// stageIconImg() in launch-rbm-test 7c1bf11 en/index.html. The glyph bodies
// are copied as that file's sprite() writes them, whitespace collapsed;
// tests/markup-pathway.test.ts compares the sprite and every icon with it.
//
// The page injected the sprite at the start of <body>. Here it is a
// component, <JourneyIconSprite />, which the dashboard renders once inside
// its root: every <StageIcon> on the page (strip, step panel, the board's
// markers and chips) points at its symbols.
import type { SVGProps } from "react";

/**
 * Where the WHO emblem is served from. The example app serves it from
 * public/launch-icons/; a host that serves it elsewhere passes whoEmblemSrc.
 */
export const WHO_EMBLEM_SRC = "/launch-icons/who-emblem.svg";

/** Stages that show the WHO emblem rather than a glyph: the WHO recommendation. */
const WHO_STAGES: { [i: number]: boolean } = { 2: true };

type GlyphAttrs = Pick<SVGProps<SVGGElement>, "fill" | "stroke" | "strokeWidth" | "strokeLinecap" | "strokeLinejoin" | "fillRule">;

// The shared monoline stroke system (icons-solid.js ATTR).
const ATTR: GlyphAttrs = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "1.7",
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

interface Glyph {
  id: string;
  /** SVG markup inside the symbol's <g>; empty for the stage the WHO emblem takes */
  body: string;
  /** replaces ATTR: national policy stays solid, by request */
  attr?: GlyphAttrs;
}

const ICONS: readonly Glyph[] = [
  {
    id: "01-rnd-clinical",
    body: '<path d="M9.5 3h5"/> <path d="M10 3v5.2L5.6 17.4A1.6 1.6 0 0 0 7.05 19.75h9.9a1.6 1.6 0 0 0 1.45-2.35L14 8.2V3"/> <path d="M7.5 13.6h9"/> <circle cx="10.7" cy="16.5" r=".9" fill="currentColor" stroke="none"/>',
  },
  {
    id: "02-regulatory-approval",
    body: '<path d="M12 2.6 21.3 7.8M12 2.6 2.7 7.8"/> <path d="M2.7 7.8h18.6v1.7H2.7z"/> <path d="M5 11.3v6.4M9.3 11.3v6.4M14.7 11.3v6.4M19 11.3v6.4"/> <path d="M3 19.6h18"/>',
  },
  { id: "03-who-guidelines", body: "" },
  {
    id: "04-who-prequalification",
    body: '<circle cx="12" cy="9" r="6"/> <path d="M9.3 14.4 7.6 21l4.4-2.4 4.4 2.4-1.7-6.6"/> <path d="M9.4 9.4l1.8 1.8 3.4-3.8"/>',
  },
  {
    id: "05-country-registration",
    body: '<rect x="10.5" y="2.3" width="3" height="3.6" rx="1.3"/> <path d="M11.3 5.9v1.9M12.7 5.9v1.9"/> <path d="M8.6 7.9h6.8l1.7 3.7H6.9z"/> <rect x="6.5" y="12.3" width="11" height="3.3" rx="1.1"/> <path d="M3.6 18.1h16.8"/>',
  },
  {
    id: "06-national-policy",
    attr: { fill: "currentColor", stroke: "none", fillRule: "evenodd" },
    body: '<circle cx="12" cy="7.4" r="3.3"/> <path d="M12 11.9c-3.6 0-6.4 2.3-6.4 5.3v1.4h12.8v-1.4c0-3-2.8-5.3-6.4-5.3z"/> <circle cx="4.5" cy="10.4" r="2.5"/> <path d="M4.5 14c-2.4 0-4.2 1.6-4.2 3.6v1h3.5c.1-2.1 1.2-3.9 2.9-4.4-.7-.1-1.4-.2-2.2-.2z"/> <circle cx="19.5" cy="10.4" r="2.5"/> <path d="M19.5 14c2.4 0 4.2 1.6 4.2 3.6v1h-3.5c-.1-2.1-1.2-3.9-2.9-4.4.7-.1 1.4-.2 2.2-.2z"/>',
  },
  {
    id: "07-procurement",
    body: '<path d="M2.4 3h2.3a1 1 0 0 1 1 .78l.5 2.1h13a1 1 0 0 1 .97 1.24l-1.7 6.7a1.8 1.8 0 0 1-1.75 1.36H8.6a1.8 1.8 0 0 1-1.75-1.4L4 4.4H2.4"/> <circle cx="9.3" cy="19.6" r="1.7"/> <circle cx="17" cy="19.6" r="1.7"/>',
  },
  {
    id: "08-in-country-delivery",
    body: '<rect x="2.4" y="6.4" width="11.2" height="9.2" rx="1.2"/> <path d="M13.6 9.8h3.2l3.6 3.4v2.4h-6.8Z"/> <circle cx="7.2" cy="17.8" r="1.95"/> <circle cx="17" cy="17.8" r="1.95"/> <path d="M9.2 17.8h5.85"/>',
  },
];

/**
 * The symbols every <StageIcon> points at. Render it once, inside the
 * dashboard's root; it takes no space.
 */
export function JourneyIconSprite() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
      style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}
    >
      {ICONS.filter((ic) => ic.body).map((ic) => (
        <symbol key={ic.id} id={`jis-${ic.id}`} viewBox="0 0 24 24">
          {/* constant markup compiled into this file, never data */}
          <g {...(ic.attr || ATTR)} dangerouslySetInnerHTML={{ __html: ic.body }} />
        </symbol>
      ))}
    </svg>
  );
}

/**
 * stageIconImg(i, cls): stage i's glyph, or the WHO emblem; nothing for a
 * stage with neither. `className` is written as the page wrote it, so the
 * emblem's class is "<className> whoemb" even when className is empty.
 */
export function StageIcon({
  i,
  className = "",
  whoEmblemSrc = WHO_EMBLEM_SRC,
}: {
  i: number;
  className?: string;
  whoEmblemSrc?: string;
}) {
  if (WHO_STAGES[i]) {
    // a plain <img>, not next/image: a small SVG with nothing to optimise,
    // and the markup stays the page's
    return <img className={`${className} whoemb`} src={whoEmblemSrc} alt="" width="205" height="181" />;
  }
  const ic = ICONS[i];
  if (!ic || !ic.body) return null;
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <use href={`#jis-${ic.id}`} />
    </svg>
  );
}
