// The yardstick comparison's markup: yardPill, yardBadge, yardBox, yardTable
// and yardNote on the page. All of it is hidden as shipped
// (DISPLAY.yardCompare, partners' request of 15 Oct 2026), and returns null
// then; tests/markup-board.test.ts compares it with the switch on.
import type { ReactElement, ReactNode } from "react";
import type { Product } from "@/lib/dataset";
import {
  phaseOf,
  varianceText,
  yardResult,
  yardstick,
  yrsText,
  type YardResult,
  type YardStep,
  type YardWhole,
} from "@/lib/stages";
import { fill } from "@/lib/strings";
import { mergeText } from "./cite";
import type { Scope } from "./types";

/** One step's result as a pill; `sm` is the badge's small form, without "so far". */
export function yardPill(r: YardResult, sm: boolean, s: Scope, key?: string): ReactElement {
  return (
    <span key={key} className={`ysp${sm ? " sm" : ""} ${r.tone}`}>
      {r.going && !sm ? [r.t + " ", <i key="i">{"· " + s.text.soFar}</i>] : r.t}
    </span>
  );
}

/**
 * Which steps use a published timeline and which LAUNCH's own estimate, read
 * from each step's basis, so the note cannot disagree with the data.
 */
export function yardNote(s: Scope, key?: string): ReactElement | null {
  const yard = s.ctx.yardstick;
  if (!yard) return null;
  const by = (b: string) =>
    yard.expected
      .map((e, i) => (e && e.basis === b ? s.ctx.stages[i] : null))
      .filter(Boolean)
      .join(", ");
  // each sentence is followed by a space, as on the page: the two sit in one line
  const line = (template: string, list: string, k: string) =>
    list ? [<span key={k}>{fill(template, { stages: list })}</span>, " "] : null;
  return (
    <p key={key} className="ysnote">
      {line(s.text.notePublished, by("published"), "pub")}
      {line(s.text.noteEstimate, by("estimate"), "est")}
    </p>
  );
}

/** Under the access figures in the medicines table. */
export function yardBadge(p: Product, s: Scope): ReactElement | null {
  const y = yardstick(p, s.ctx);
  if (!y) return null;
  if (!y.approved) return <small className="ysb-none">{s.text.notApprovedYet}</small>;
  return yardPill(yardResult(y.whole, s.ctx.locale), true, s);
}

/** The box at the top of an open row: expected, actual so far, and the variance. */
export function yardBox(p: Product, s: Scope): ReactElement | null {
  const y = yardstick(p, s.ctx);
  if (!y || !y.approved) return null;
  const { text } = s;
  const locale = s.ctx.locale;
  const due = y.start + y.whole.exp;
  const late = y.whole.late;
  const going = y.whole.kind === "going";
  const overdue = going && s.ctx.asOfYear >= due;
  const b = y.biggest;
  return (
    <div className="ysbox">
      <div className="ysfigs">
        <div>
          <small>{text.expected}</small>
          <strong>{yrsText(y.whole.exp, locale)}</strong>
          <span>{fill(text.routineUseBy, { year: due })}</span>
        </div>
        <div>
          <small>{going ? text.actualSoFar : text.actual}</small>
          <strong>{yrsText(y.whole.took, locale)}</strong>
          <span>{fill(overdue ? text.sinceNotRoutine : text.sinceYear, { year: y.start })}</span>
        </div>
        <div className="ysdiff">
          <small>{text.variance}</small>
          <strong>{late > 0 ? varianceText(late, locale) : yrsText(0, locale)}</strong>
          <span>{going ? text.soFar : text.fromExpected}</span>
        </div>
      </div>
      <p>
        {fill(text.boxLine, { due, n: y.whole.exp, start: y.start }) +
          (overdue ? " " + fill(text.stillNotRoutine, { year: s.ctx.asOfYear }) : "")}
      </p>
      {b ? (
        <p>
          {mergeText([
            text.largestVariance + " ",
            <b key="b">{s.ctx.stages[b.i]}</b>,
            " · " + varianceText(b.late!, locale) + (b.kind === "going" ? " " : ""),
            b.kind === "going" ? <i key="i">{"· " + text.soFar}</i> : null,
          ])}
        </p>
      ) : null}
    </div>
  );
}

/** The Time taken view: expected against actual, under the two access phases. */
export function yardTable(p: Product, s: Scope): ReactNode {
  const y = yardstick(p, s.ctx);
  if (!y) return null;
  const { text } = s;
  const locale = s.ctx.locale;
  if (!y.approved) {
    return (
      <div className="ysempty">
        <b>{text.notApprovedTitle}</b>
        {" " + text.notApprovedBody}
      </div>
    );
  }
  // "—", not "n/a": the page's translation build skipped text with no two
  // letters in a row, so "n/a" stayed English
  const actual = (st: YardStep | YardWhole): ReactNode =>
    st.took == null
      ? "—"
      : st.kind === "going"
        ? [yrsText(st.took, locale) + " ", <i key="i">{text.soFar}</i>]
        : yrsText(st.took, locale);
  const row = (name: string, st: YardStep | YardWhole, key: string, foot?: boolean) => (
    <tr key={key} className={foot ? "whole" : undefined}>
      <th scope="row">{name}</th>
      <td>{yrsText(st.exp, locale)}</td>
      <td>{actual(st)}</td>
      <td>{yardPill(yardResult(st, locale), false, s)}</td>
    </tr>
  );
  const head = (ph: number) => (
    <tr key={`h${ph}`} className={`ysgrp ph${ph}`}>
      <th scope="colgroup" colSpan={4}>
        <i className="phn">{ph + 1}</i>
        {s.t.phases[ph]}
      </th>
    </tr>
  );
  let ph = -1;
  const body = y.steps.flatMap((st) => {
    const g = phaseOf(st.i);
    const h = g !== ph ? [head(g)] : [];
    ph = g;
    return [...h, row(s.ctx.stages[st.i], st, `s${st.i}`)];
  });
  return [
    <div key="t" className="cscroll">
      <table className="ystable">
        <thead>
          <tr>
            <th scope="col">{text.stage}</th>
            <th scope="col">{text.expected}</th>
            <th scope="col">{text.actual}</th>
            <th scope="col">{text.variance}</th>
          </tr>
        </thead>
        <tbody>{body}</tbody>
        <tfoot>{row(text.wholeJourney, y.whole, "whole", true)}</tfoot>
      </table>
    </div>,
    yardNote(s, "note"),
  ];
}
