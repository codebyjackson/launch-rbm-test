"use client";

// The right rail's Detail panel (old: renderDetail and the panel's click
// handler): the selected medicine's overview, the Find a country tab, or one
// country's page.
import { Fragment, useEffect, useRef, type ReactNode } from "react";
import {
  DONUT_R,
  DONUT_W,
  LEVELS,
  PEER_CHIPS,
  countryPage,
  detail,
  groupColor,
  overview,
  stageVar,
  type MapContext,
  type MapState,
  type TokenReader,
  type donut,
} from "@/lib/map";
import { CountryFinder } from "./CountryFinder";
import { LineSwatch, StageBar, StageLegend, stageLabel, type MapActions } from "./parts";
import { fill, type MapText } from "./text";

interface Props {
  ctx: MapContext;
  st: MapState;
  /** the Countries tab's search */
  q: string;
  /** changes after every choice but typing; remounts the search box, emptying it */
  seq: number;
  text: MapText;
  token: TokenReader;
  actions: MapActions;
}

/** Runs an action; `focus` names the control to put focus back on afterwards. */
type Run = (focus: string | null, f: () => void) => void;

export function CountryPanel({ ctx, st, q, seq, text, token, actions }: Props) {
  const view = detail(ctx, st);
  const panel = useRef<HTMLDivElement>(null);

  // The old page rebuilt the panel on every click, so the control just
  // pressed was gone. A keyboard user kept their place: the same tab or
  // Previous/Next button, else the country heading, else the selected tab.
  // React keeps most elements, but a tab or a country page replaces them.
  const pending = useRef<string | null | undefined>(undefined);
  const run: Run = (focus, f) => {
    if (panel.current && panel.current.contains(document.activeElement)) pending.current = focus;
    f();
  };
  useEffect(() => {
    const key = pending.current;
    if (key === undefined || !panel.current) return;
    pending.current = undefined;
    const p = panel.current;
    const next =
      (key && p.querySelector<HTMLElement>(key)) ||
      p.querySelector<HTMLElement>(".det-cname") ||
      p.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
    if (next) next.focus();
  });
  // old: renderDetail put a country page back at the top on every redraw
  const isCountry = view.kind === "country";
  useEffect(() => {
    if (isCountry && panel.current) panel.current.scrollTop = 0;
  }, [st, isCountry]);

  let body: ReactNode;
  if (view.kind === "country") {
    body = <CountryPage page={view.page} text={text} token={token} actions={actions} run={run} />;
  } else {
    body = (
      <>
        <div className="det-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={view.tab === "overview"}
            data-det-tab="overview"
            onClick={() => run('[data-det-tab="overview"]', () => actions.tab("overview"))}
          >
            {text.overviewTab}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view.tab === "countries"}
            data-det-tab="countries"
            onClick={() => run('[data-det-tab="countries"]', () => actions.tab("countries"))}
          >
            {text.countriesTab} <span className="det-n">{`${view.count.listed} ${text.find.of} ${view.count.total}`}</span>
          </button>
        </div>
        {view.tab === "countries" ? (
          <CountryFinder
            key={seq}
            ctx={ctx}
            st={st}
            q={q}
            text={text}
            token={token}
            actions={actions}
            onSelect={(iso3) => run(null, () => actions.select(iso3))}
            onReset={() => run(null, actions.reset)}
          />
        ) : (
          <Overview ctx={ctx} st={st} text={text} token={token} />
        )}
      </>
    );
  }
  return (
    <div className="mft-panel" id="mft-panel" ref={panel}>
      {body}
    </div>
  );
}

/** The selected medicine at a glance (old: detFacts and detOverview). */
function Overview({ ctx, st, text, token }: { ctx: MapContext; st: MapState; text: MapText; token: TokenReader }) {
  const o = overview(ctx, st);
  if (!o) return null;
  const { facts: f, mix, policy } = o;
  return (
    <>
      <div className="det-banner">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M9 3 21 12l-6 1.5L12 21z" />
        </svg>
        <span>{text.banner}</span>
      </div>
      <div className="det-card">
        <h4>{fill(text.factsTitle, { name: f.name })}</h4>
        <div className="det-small">{f.inn}</div>
        <div className="det-k">{text.currentStage}</div>
        <div className="det-v">{f.stage}</div>
        {f.volume && (
          <>
            <div className="det-k">{text.procurement}</div>
            <div className="det-v">{f.volume}</div>
          </>
        )}
        {f.flag && <p className="det-small det-flag">{f.flag}</p>}
      </div>
      {!mix || !policy ? (
        <div className="det-card">
          <p className="det-empty">{fill(text.overviewPre, { name: f.name })}</p>
        </div>
      ) : (
        <>
          <div className="det-card">
            <h4>{fill(text.mixTitle, { name: f.name })}</h4>
            <div className="det-big">
              {mix.withStage}
              <span className="det-small">{fill(text.mixOf, { n: mix.total })}</span>
            </div>
            <StageBar counts={mix.counts} total={mix.total} text={text} />
          </div>
          <div className="det-card">
            <h4>
              {text.use} · {f.name}
            </h4>
            {policy.kind === "none" && <p className="det-empty">{fill(text.overviewNoPolicy, { name: f.name })}</p>}
            {policy.kind === "tickLeft" && <p className="det-empty">{text.tickLeft}</p>}
            {policy.kind === "donut" && (
              <>
                <Donut d={policy.donut} text={text} token={token} />
                {policy.undrawn.length > 0 && <p className="mft-note">{fill(text.undrawn, { list: policy.undrawn.join(", ") })}</p>}
                <p className="mft-note">{fill(text.policySource, { edition: policy.source.edition, year: policy.source.year })}</p>
              </>
            )}
          </div>
        </>
      )}
    </>
  );
}

/** Countries by ticked group, as a ring and a table (old: mftDonut). */
function Donut({ d, text, token }: { d: ReturnType<typeof donut>; text: MapText; token: TokenReader }) {
  return (
    <div className="mft-donut">
      <svg viewBox="0 0 112 112" width="112" height="112" role="img" aria-label={fill(d.n === 1 ? text.donutLabelOne : text.donutLabelMany, { n: d.n })}>
        <circle cx="56" cy="56" r={DONUT_R} fill="none" stroke="#EDF1F3" strokeWidth={DONUT_W} />
        {d.arcs.map((a) => (
          <circle
            key={a.id}
            cx="56"
            cy="56"
            r={DONUT_R}
            fill="none"
            stroke={groupColor(token, a.id)}
            strokeWidth={DONUT_W}
            strokeDasharray={`${a.dash} ${a.rest}`}
            strokeDashoffset={`${a.offset}`}
            transform="rotate(-90 56 56)"
          />
        ))}
        <text className="ct-n" x="56" y="58" textAnchor="middle">
          {d.n}
        </text>
        <text className="ct-l" x="56" y="74" textAnchor="middle">
          {d.n === 1 ? text.donutOne : text.donutMany}
        </text>
      </svg>
      <div className="rows">
        <table className="ftab">
          <thead>
            <tr>
              <th colSpan={2}>{text.group}</th>
              <th className="n">{text.count}</th>
            </tr>
          </thead>
          <tbody>
            {d.rows.map((r) => (
              <tr key={r.id} className={r.dim ? "dim" : ""}>
                <td className="sw">
                  <span className="mft-sq" style={{ background: groupColor(token, r.id) }} />
                </td>
                <td>{text.groups[r.id].short}</td>
                <td className="n">{r.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type Page = ReturnType<typeof countryPage>;

/** One country for the selected medicine (old: detCountry). */
function CountryPage({ page, text, token, actions, run }: { page: Page; text: MapText; token: TokenReader; actions: MapActions; run: Run }) {
  const region = page.region ? text.regions[page.region] : "";
  const a = page.access;
  return (
    <>
      {page.back && (
        <button type="button" className="det-back" data-back="" onClick={() => run(null, actions.back)}>
          {page.back === "countries" ? text.backCountries : text.backOverview}
        </button>
      )}
      <div className="det-chead">
        <div>
          <h4 className="det-cname" tabIndex={-1}>
            {page.name}
          </h4>
          <span className="det-reg">{region}</span>
        </div>
        <div className="det-nav">
          <button type="button" data-step="-1" aria-label={text.prev} onClick={() => run('[data-step="-1"]', () => actions.step(-1))}>
            ‹
          </button>
          <button type="button" data-step="1" aria-label={text.next} onClick={() => run('[data-step="1"]', () => actions.step(1))}>
            ›
          </button>
        </div>
      </div>
      {!a ? (
        <div className="det-card">
          <h4>{page.product}</h4>
          <p className="det-empty">{fill(text.countryPre, { name: page.product })}</p>
        </div>
      ) : (
        <>
          <div className="det-card">
            <div className="det-top">
              <b>{page.product}</b>
              <span className={`det-pill ${a.stage}`}>{stageLabel(text, a.stage)}</span>
            </div>
            <div className="det-trk">
              {[1, 2, 3].map((n) => (
                <i key={n} style={a.track >= n ? { background: stageVar(LEVELS[a.track - 1]) } : undefined} />
              ))}
            </div>
            <div className="det-trkl">
              {text.track.map((t, i) => (
                <span key={i}>{t}</span>
              ))}
            </div>
            {a.sources && (
              <p className="mft-note">
                {text.sourcesFor}{" "}
                {a.sources.items.map((s, i) => (
                  <Fragment key={i}>
                    {i > 0 && "; "}
                    {s.url ? (
                      <a href={s.url} target="_blank" rel="noopener noreferrer">
                        {s.label}
                      </a>
                    ) : (
                      s.label
                    )}
                  </Fragment>
                ))}
                .{a.sources.checked ? ` ${text.checkedOn} ${a.sources.checked}.` : ""}
              </p>
            )}
            {a.groups.length ? (
              a.groups.map((g) => (
                <div key={g} className="det-gline">
                  <LineSwatch id={g} token={token} />
                  <b>{text.groups[g].short}</b>
                  <span className="det-small">{fill(text.inPolicy, { year: a.policyYear })}</span>
                </div>
              ))
            ) : (
              <div className="det-gline det-small">{text.notInPolicy}</div>
            )}
            {a.groups.length > 0 && (
              <>
                <div className="mft-grp">{text.use}</div>
                <div className="mft-chips">
                  {a.chips.map((c) => (
                    <span key={c.id} className={c.yes ? "mft-pchip yes" : "mft-pchip"}>
                      {c.yes ? "✓ " : ""}
                      {text.groups[c.id].short}
                    </span>
                  ))}
                </div>
              </>
            )}
            {a.parts.length > 0 && (
              <p className="mft-note">
                {a.parts.map((p) => fill(p.lists ? text.partLists : text.partNotLists, { part: p.name, name: page.product })).join(" ")}
              </p>
            )}
            <p className="mft-note">{fill(text.policySource, { edition: a.source.edition, year: a.source.year })}</p>
          </div>
          {a.regionMix && (
            <div className="det-card">
              <h4>{fill(text.among, { country: page.name, n: a.regionMix.count, region, name: page.product })}</h4>
              <div className="det-mkr">
                <StageBar counts={a.regionMix.counts} total={a.regionMix.count} text={text} />
                <span className="pin" style={{ left: `${a.regionMix.pos}%` }} />
              </div>
              <StageLegend counts={a.regionMix.counts} text={text} />
            </div>
          )}
          {a.peers.length > 0 && (
            <div className="det-card">
              <h4>{fill(text.peersTitle, { stage: stageLabel(text, a.stage) })}</h4>
              <div className="det-chips">
                {a.peers.slice(0, PEER_CHIPS).map((x) => (
                  <button key={x.iso3} type="button" className="det-chip" data-iso3={x.iso3} onClick={() => run(null, () => actions.select(x.iso3))}>
                    {x.name}
                  </button>
                ))}
                {a.peers.length > PEER_CHIPS && <span className="det-small">{fill(text.morePeers, { n: a.peers.length - PEER_CHIPS })}</span>}
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
