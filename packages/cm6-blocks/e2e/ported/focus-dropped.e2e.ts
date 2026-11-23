// PORTED from packages/codemirror-blocks/e2e/focus-dropped.e2e.ts: only the import changed (to ../compat/helpers); see doc/experiments/cm6-direct-tree.md, thirteenth round.
// EDITED (documented, second round D): the labels `f expression`, `g,` are the table's `call to f `, `symbol g`
import { expect, test } from "@playwright/test";
import { block, openInBlockMode } from "../compat/helpers";

// The block with keyboard focus can be taken off the page by CodeMirror before
// the block that should have focus next is on it. The browser then drops focus
// to the body, and nothing re-renders to notice (soak seeds 15405 and 18940).
test("focus goes to the focused block once it is back on the page", async ({
  page,
}) => {
  await openInBlockMode(page, "(f x y)\n(g z)");
  await block(page, /call to f /).click({ position: { x: 4, y: 4 } });
  const dropped = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement;
    (window as { dropped?: { el: HTMLElement; parent: Node } }).dropped = {
      el,
      parent: el.parentNode as Node,
    };
    el.remove();
    return document.activeElement === document.body;
  });
  expect(dropped).toBe(true);

  // CodeMirror draws the block again, and then redraws its display
  await page.evaluate(() => {
    const { el, parent } = (
      window as unknown as { dropped: { el: HTMLElement; parent: Node } }
    ).dropped;
    parent.appendChild(el.cloneNode(true)); // as CodeMirror makes a new one
    (window as unknown as { cmb: { getCM(): { refresh(): void } } }).cmb
      .getCM()
      .refresh();
  });
  await expect
    .poll(() =>
      page.evaluate(() => document.activeElement?.getAttribute("role"))
    )
    .toBe("treeitem");
});

// FIXME-BEGIN (thirty-third round, a question: the test takes the focused block's element out of the page and puts a clone back, then asks CodeMirror 5 to `refresh`; CM6 has no refresh (`requestMeasure` did not give focus back), and the renderer owns the block elements, so a clone is not its block. Whether the editor should take focus back to the focused block when the view drops its element (a viewport change) is a decision)
const FIXME = new Set<string>([
  "focus goes to the focused block once it is back on the page",
]);
test.beforeEach(({}, ti) => {
  test.fixme(
    FIXME.has(ti.titlePath.slice(1).join(" › ")),
    "Q: the test drops the focused element and puts a clone back, then calls the CM5 refresh; whether focus should come back is a decision (see above)"
  );
});
// FIXME-END
