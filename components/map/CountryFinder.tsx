"use client";

// The Detail rail's Countries tab: a search box over the Find a country list
// (old: detCountries and the panel's input handler).
//
// The box is uncontrolled and the section remounts it (a new `key`) after
// every choice but typing, which empties it: the old page rebuilt the rail
// then, search box included.
import { listedCount, type MapContext, type MapState, type TokenReader } from "@/lib/map";
import { CountryTable } from "./CountryTable";
import type { MapActions } from "./parts";
import type { MapText } from "./text";

interface Props {
  ctx: MapContext;
  st: MapState;
  q: string;
  text: MapText;
  token: TokenReader;
  actions: MapActions;
  onSelect(iso3: string): void;
  onReset(): void;
}

export function CountryFinder({ ctx, st, q, text, token, actions, onSelect, onReset }: Props) {
  const c = listedCount(ctx, st);
  return (
    <div className="det-card">
      <h4>
        {text.findTitle} <span className="det-n">{`${c.listed} ${text.find.of} ${c.total}`}</span>
      </h4>
      <input
        id="det-q"
        className="det-q"
        type="search"
        placeholder={text.searchPlaceholder}
        aria-label={text.searchLabel}
        autoComplete="off"
        onChange={(e) => actions.search(e.currentTarget.value)}
      />
      <div className="det-list" id="det-list">
        <CountryTable ctx={ctx} st={st} q={q} text={text} token={token} onSelect={onSelect} onReset={onReset} />
      </div>
    </div>
  );
}
