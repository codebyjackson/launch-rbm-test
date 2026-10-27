import { CsvButton } from "./CsvButton";
import { Subscribe } from "./Subscribe";
import type { HeaderText, SubscribeText } from "./text";

/**
 * The header: title, "Powered by" Unitaid, the description, the "Last
 * updated" line, Download CSV and Subscribe for updates. Subscribe is left
 * out when there is no forms address (`subscribe` null), as the static build
 * hides it with `--api-url none`.
 */
export function Header({
  text,
  subscribeText,
  logoSrc,
  updated,
  csv,
  subscribe,
}: {
  text: HeaderText;
  subscribeText: SubscribeText;
  /** where the host serves assets/unitaid-logo.svg */
  logoSrc: string;
  /** "Last updated 19 Oct 2026" (frameView) */
  updated: string;
  /** the download; null hides the button, as the page did when it had no data */
  csv: { text: string; fileName: string } | null;
  subscribe: { endpoint: string; open: boolean; onOpenChange: (open: boolean) => void } | null;
}) {
  return (
    <header>
      <div className="hd-top">
        <h1 className="hd-title">{text.title}</h1>
        <div className="attrib">
          <a href="https://unitaid.org" target="_blank" rel="noopener noreferrer">
            <span className="ptxt">{text.poweredBy}</span>
            <img src={logoSrc} alt={text.logoAlt} width="1200" height="418" />
          </a>
        </div>
      </div>
      <div className="hd-bar">
        <div className="hd-text">
          <p className="hd-desc">{text.subtitle}</p>
          <div className="hd-status">
            <span id="updated">{updated}</span>
          </div>
        </div>
        <div className="hdr-actions">
          {csv && <CsvButton label={text.downloadCsv} csv={csv.text} fileName={csv.fileName} />}
          {subscribe && (
            <Subscribe
              text={subscribeText}
              endpoint={subscribe.endpoint}
              open={subscribe.open}
              onOpenChange={subscribe.onOpenChange}
            />
          )}
        </div>
      </div>
    </header>
  );
}
