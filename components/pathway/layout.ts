// The strip's two measured layout passes, ported from fitPathway() and
// alignPathGroup() in launch-rbm-test 7c1bf11 (en/index.html). They read the
// DOM, so they are not in lib/. Both set what React does not render (the
// "stack" class and the --pg-lift property), so a re-render never undoes them.

/**
 * fitPathway: the two phase cards side by side when both fit, stacked when
 * they do not. Measured with the class off, so a wider box can go back to
 * side by side.
 */
export function fitPathway(pathway: HTMLElement): void {
  pathway.classList.remove("stack");
  if (pathway.scrollWidth > pathway.clientWidth + 1) pathway.classList.add("stack");
}

/**
 * alignPathGroup: lift the parallel pair onto every other icon's line.
 * The pair's box stretches to the row's height, but stretch does not centre
 * its two icons and caption inside it, so the pair (and the arrows either
 * side, which point at a single icon's centre) sits lower than every other
 * step. Measure the gap between the pair's midpoint and a single icon's
 * centre and publish it as --pg-lift, which the CSS applies as a transform.
 * Measured, not a constant: it depends on how the two labels wrap. Reset
 * first, so the reading is against the strip's untransformed position.
 */
export function alignPathGroup(pathway: HTMLElement): void {
  pathway.style.setProperty("--pg-lift", "0px");
  const group = pathway.querySelector(".pathgroup");
  const single = pathway.querySelector(".pathnode:not(.pathnode-sm) .pill");
  if (!group || !single) return;
  const pills = group.querySelectorAll(".pill");
  if (pills.length < 2) return;
  const first = pills[0].getBoundingClientRect();
  const last = pills[pills.length - 1].getBoundingClientRect();
  const sr = single.getBoundingClientRect();
  if (!first.height || !sr.height) return; // not laid out yet
  const mid = (first.top + first.height / 2 + last.top + last.height / 2) / 2;
  const singleCentre = sr.top + sr.height / 2;
  // not rounded: a half-pixel here shows as the pair sitting 1px off every other icon's line
  const lift = Math.max(0, mid - singleCentre);
  pathway.style.setProperty("--pg-lift", lift.toFixed(2) + "px");
}

/** The strip's part of layoutJourney(), in its order: fit first, then align. */
export function layoutStrip(pathway: HTMLElement): void {
  fitPathway(pathway);
  alignPathGroup(pathway);
}
