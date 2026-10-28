// The board's slots (BoardSlots), filled with the pathway area's components:
// what the Dashboard hands the board so a medicine's row shows the same stage
// icons, Country access rows, citations and stage panel as today's page.
//
// A plain function, not part of Dashboard.tsx, so tests/markup-dashboard.test.ts
// can render the board with exactly these slots and compare it with today's.
import type { BoardSlots } from "@/components/board";
import { Cites, CountryAccessKv, GatePanelContent, StageIcon, type PathwayText } from "@/components/pathway";
import type { Source } from "@/lib/dataset";
import type { StageContext } from "@/lib/stages";

export interface BoardSlotsInput {
  ctx: StageContext;
  /** every source: citations and the national-register count read them */
  sources: readonly Source[];
  text: PathwayText;
  whoEmblemSrc?: string;
}

export function boardSlots({ ctx, sources, text, whoEmblemSrc }: BoardSlotsInput): Required<BoardSlots> {
  return {
    // The icon, the Country access rows and the citations are called as
    // functions, not mounted as <StageIcon/> and so on: the board marks
    // glossary terms by walking the elements a row is built from, and a
    // mounted component's output is not in that tree yet (decision 37). All
    // three are hook-free, so calling them is safe; "MFT" in "In MFT plans"
    // and a term in a source's name are then marked as on today's page.
    renderStageIcon: (i, className) => StageIcon({ i, className, whoEmblemSrc }),
    renderCountryAccess: (detail) => CountryAccessKv({ detail, sources, text }),
    renderCites: (cites) => Cites({ cites }),
    // Mounted: the walk skips the stage panel (it was empty when the page
    // walked), and this keeps its Close button a component of its own.
    renderGatePanel: (product, stage, close) => (
      <GatePanelContent product={product} stage={stage} ctx={ctx} sources={sources} text={text} onClose={close} />
    ),
  };
}
