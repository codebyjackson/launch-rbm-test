"use client";

// The map's tooltip (old: #tip with showTipAt, showTipAtPoint and hideTip),
// and what it says for a country on the map or in the keyboard list
// (old: the map's mousemove handler and countryTip).
//
// Shown through a ref, not props: the pointer moves often, and only the
// tooltip should redraw when it does. What it says is fixed when it is
// shown, as on the old page.
import { useImperativeHandle, useLayoutEffect, useRef, useState, type ReactNode, type Ref } from "react";
import type { listTip, mapTip, tipPolicyLine } from "@/lib/map";
import { stageLabel, type TipAt } from "./parts";
import { fill, type MapText } from "./text";

export interface TooltipHandle {
  show(content: ReactNode, at: TipAt): void;
  hide(): void;
}

// The id is the old page's: its stylesheet styles #tip. The board will want
// a tooltip too; when it is ported, the two should become one.
export function MapTooltip({ ref }: { ref?: Ref<TooltipHandle> }) {
  const [tip, setTip] = useState<{ content: ReactNode; at: TipAt } | null>(null);
  const el = useRef<HTMLDivElement>(null);
  useImperativeHandle(ref, () => ({ show: (content, at) => setTip({ content, at }), hide: () => setTip(null) }), []);
  // placed once its size is known (old: showTipAt, showTipAtPoint)
  useLayoutEffect(() => {
    const t = el.current;
    if (!t || !tip) return;
    const tw = t.offsetWidth, th = t.offsetHeight;
    let x: number, y: number;
    if ("el" in tip.at) {
      const r = tip.at.el.getBoundingClientRect();
      x = Math.max(8, Math.min(r.left + r.width / 2 - tw / 2, window.innerWidth - tw - 8));
      y = r.top - th - 10;
      if (y < 8) y = r.bottom + 10;
    } else {
      x = Math.max(8, Math.min(tip.at.x - tw / 2, window.innerWidth - tw - 8));
      const above = tip.at.y - th - 14;
      y = above < 8 ? tip.at.y + 18 : above;
    }
    t.style.left = x + "px";
    t.style.top = y + "px";
  }, [tip]);
  return (
    <div id="tip" role="tooltip" ref={el} style={{ display: tip ? "block" : "none" }}>
      {tip && tip.content}
    </div>
  );
}

function PolicyLine({ line, text }: { line: ReturnType<typeof tipPolicyLine>; text: MapText }) {
  if (!line) return null;
  return (
    <div className="tprod">
      {text.use} · {line.product}: {line.groups.length ? line.groups.map((g) => text.groups[g].short).join(", ") : text.notListed}
    </div>
  );
}

/** A tracked country hovered on the map. */
export function MapTipBody({ tip, text }: { tip: NonNullable<ReturnType<typeof mapTip>>; text: MapText }) {
  return (
    <>
      <b>{tip.name}</b>
      <div className="tlvl">
        <span className={`mapsw ${tip.stage}`} />
        {stageLabel(text, tip.stage)}
      </div>
      <PolicyLine line={tip.policy} text={text} />
      <div className="tprod det-cta">{text.clickForDetails}</div>
    </>
  );
}

/** A button of the keyboard country list, hovered or focused: every stage, ticked up to the one reached. */
export function ListTipBody({ tip, text }: { tip: ReturnType<typeof listTip>; text: MapText }) {
  return (
    <>
      <b>{tip.name}</b>
      {tip.rows ? (
        tip.rows.map((r) => (
          <div key={r.key} className={r.on ? "tlvl" : "tlvl off"}>
            <span className="tmark">{r.on ? "✓" : "·"}</span>
            <span className={`mapsw ${r.key}`} />
            {text.stage[r.key]}
          </div>
        ))
      ) : (
        <div className="tlvl">
          <span className="tmark">–</span>
          <span className="mapsw none" />
          {text.stage.none}
        </div>
      )}
      <PolicyLine line={tip.policy} text={text} />
      {tip.product && (
        <div className="tprod">
          {tip.product.name}
          {tip.product.status ? fill(text.tipStatus, { status: tip.product.status }) : ""}
        </div>
      )}
    </>
  );
}
