// "More detail": the cards and the milestone table under an open row, from
// the page's row loop. A builder, called by the row. The Country access
// card's rows and the citations are the pathway area's, through slots.
//
// detail.price is in the data but not drawn: today's page never showed it.
// Where the page read a field it did not check for (d.access.map), a missing
// field drew an empty list here rather than stopping the whole page.
import type { ReactElement } from "react";
import { ICON, PROCUREMENT_SHADES, procurementGfOnly } from "@/lib/board";
import type { Product, ProductDetail } from "@/lib/dataset";
import { DATE_LOCALE, citeLinks, citeOrText, fmtFig } from "@/lib/format";
import { sourceLine } from "./cite";
import type { Scope } from "./types";

/**
 * Procurement through public channels (partner feedback, 15 Oct 2026). The
 * headline is transactions and value; packs are listed by presentation, with
 * treatment courses only where the build could work them out.
 */
function volumeCard(d: ProductDetail, s: Scope): ReactElement {
  const { text } = s;
  const v = d.volume;
  if (!v) {
    return (
      <div className="card">
        <h3>{text.procurement}</h3>
        <div className="big">—</div>
        <div className="sub">{d.volumeNote || text.dataNotYetAvailable}</div>
      </div>
    );
  }
  const numf = new Intl.NumberFormat(DATE_LOCALE[s.ctx.locale]);
  const byPres = Array.isArray(v.byPresentation) && v.byPresentation.length ? v.byPresentation : null;
  const shade = (n: number) => PROCUREMENT_SHADES[n % PROCUREMENT_SHADES.length];
  return (
    <div className={`card${byPres ? " card-wide" : ""}`}>
      <h3>{text.procurement}</h3>
      <div className="big">{fmtFig(v.total)}</div>
      <div className="sub">{fmtFig(v.period)}</div>
      {procurementGfOnly(v) ? (
        <p className="proc-scope">{text.procScope}</p>
      ) : (
        <>
          <div className="split" aria-hidden="true">
            {v.split.map((ch, n) => (
              <div key={n} style={{ width: `${ch.pct}%`, background: shade(n) }} title={`${ch.channel} ${ch.pct}%`}></div>
            ))}
          </div>
          <div className="split-legend">
            {v.split.map((ch, n) => (
              <span key={n} className="key">
                <span className="sw" style={{ background: shade(n) }}></span>
                {`${ch.channel} ${ch.pct}%`}
              </span>
            ))}
          </div>
        </>
      )}
      {byPres ? (
        <>
          <div className="cscroll">
            <table className="ystable proc-table">
              <thead>
                <tr>
                  <th scope="col">{text.presentation}</th>
                  <th scope="col">{text.transactions}</th>
                  <th scope="col">{text.packs}</th>
                  <th scope="col">{text.courses}</th>
                </tr>
              </thead>
              <tbody>
                {byPres.map((b, n) => (
                  <tr key={n}>
                    <th scope="row">{b.label}</th>
                    <td>
                      <span className="pk">{text.transactions}</span>
                      {numf.format(b.transactions)}
                    </td>
                    <td>
                      <span className="pk">{text.packs}</span>
                      {numf.format(b.packs)}
                    </td>
                    <td>
                      <span className="pk">{text.courses}</span>
                      {b.courses == null ? <i>{text.notEstimated}</i> : numf.format(b.courses)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {v.coursesRule ? <p className="proc-rule">{v.coursesRule}</p> : null}
        </>
      ) : null}
      {v.source || (v.sources || []).length ? (
        <div className="prov">{sourceLine(s, citeOrText(v.sources, v.source, s.sources))}</div>
      ) : null}
    </div>
  );
}

/** The level-2 detail under an open row, by its id `${p.id}-detail`. */
export function productDetail(p: Product, s: Scope): ReactElement {
  const { text } = s;
  const d = p.detail;
  return (
    <div className="detail" id={`${p.id}-detail`}>
      <div className="cards">
        <div className="card">
          <h3>{text.useCase}</h3>
          <p>{d.useCase}</p>
        </div>
        <div className="card">
          <h3>{text.accessCommitments}</h3>
          <ul>
            {(d.access || []).map((a, n) => (
              <li key={n}>{a}</li>
            ))}
          </ul>
        </div>
        <div className="card">
          <h3>{text.adoptionRequirements}</h3>
          <ul>
            {(d.adoption || []).map((a, n) => (
              <li key={n}>{a}</li>
            ))}
          </ul>
        </div>
        <div className="card">
          <h3>{text.countryAccess}</h3>
          {s.slots.renderCountryAccess ? s.slots.renderCountryAccess(d) : null}
          <div className="kv">
            <span>{text.forecastDemand}</span>
            <span>{d.country?.forecastDemand}</span>
          </div>
        </div>
        <div className="card">
          <h3>{text.research}</h3>
          <div className="kv">
            <span>{text.lead}</span>
            <span>{d.research?.lead}</span>
          </div>
          <div className="kv">
            <span>{text.geographies}</span>
            <span>{d.research?.geographies}</span>
          </div>
          <div className="kv">
            <span>{text.timeline}</span>
            <span>{d.research?.timeline}</span>
          </div>
          <p style={{ marginTop: "6px" }}>
            <em>{d.research?.question}</em>
          </p>
        </div>
        {volumeCard(d, s)}
        {p.acknowledgement ? (
          <div className="card" style={{ gridColumn: "1/-1" }}>
            <h3>{text.acknowledgement}</h3>
            <p>{p.acknowledgement}</p>
          </div>
        ) : null}
      </div>
      <div className="mtable-box">
        <table className="mtable">
          <thead>
            <tr>
              <th>{text.msMilestone}</th>
              <th>{text.msStatus}</th>
              <th>{text.msDate}</th>
              <th>{text.msNext}</th>
              <th>{text.msAnticipated}</th>
            </tr>
          </thead>
          <tbody>
            {(d.milestones || []).map((m, n) => (
              <tr key={n}>
                <td>
                  {m.milestone}
                  {(m.sources || []).length ? (
                    <span className="mcite">{sourceLine(s, citeLinks(m.sources, s.sources))}</span>
                  ) : null}
                </td>
                <td>
                  <span className={`pill ${m.status}`}>{(ICON[m.status] ? ICON[m.status] + " " : "") + (m.label ?? "")}</span>
                </td>
                <td>{m.date}</td>
                <td>{m.next}</td>
                <td>{m.anticipated}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
