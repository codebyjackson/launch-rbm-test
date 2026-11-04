import type { MouseEventHandler } from "react";
import type { BannerKind } from "@/lib/frame";
import type { BannerText } from "./text";

/**
 * #banner, the warning bar under the header. Illustrative (mock-up) data
 * gets its notice and a link to the disclaimer; "fail" and "schema" are the
 * loader's two messages for when there is no data to show. Without a kind
 * it is there but hidden, as on the page.
 *
 * Usable from a server component (no handlers needed); DashboardFrame passes
 * onDisclaimerLink so the disclaimer glows when the link is followed.
 */
export function Banner({
  kind,
  text,
  onDisclaimerLink,
}: {
  kind: BannerKind | null;
  text: BannerText;
  onDisclaimerLink?: MouseEventHandler<HTMLAnchorElement>;
}) {
  if (kind === "illustrative") {
    return (
      <div className="demo-banner illustrative" id="banner">
        <b>{text.illustrativeHead}</b> {text.illustrativeBody}{" "}
        <a className="bl-link" href="#disclaimer" onClick={onDisclaimerLink}>
          {text.disclaimerLink}
        </a>
      </div>
    );
  }
  if (kind === "fail" || kind === "schema") {
    return (
      <div className="demo-banner error" id="banner">
        <b>{kind === "fail" ? text.failHead : text.schemaHead}</b> {kind === "fail" ? text.failBody : text.schemaBody}
      </div>
    );
  }
  return <div className="demo-banner" id="banner" hidden></div>;
}
