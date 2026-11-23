// PORTED from packages/codemirror-blocks/e2e/focus-dropped.e2e.ts: only the import changed (to ../compat/helpers); see doc/experiments/cm6-direct-tree.md, thirteenth round.
// EDITED (documented, second round D): the labels `f expression`, `g,` are the table's `a f expression `, `symbol g`
import { expect, test } from "@playwright/test";
import { block, openInBlockMode } from "../compat/helpers";

// The block with keyboard focus can be taken off the page by CodeMirror before
// the block that should have focus next is on it. The browser then drops focus
// to the body, and nothing re-renders to notice (soak seeds 15405 and 18940).
test("focus goes to the focused block once it is back on the page", async ({
  page,
}) => {
  await openInBlockMode(page, "(f x y)\n(g z)");
  await block(page, /a f expression /).click({ position: { x: 4, y: 4 } });
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

// SKIPPED (N): the test takes the focused block's element out of the page by hand and puts a clone back, then calls the CM5 `refresh`: no edit, no API call
// and no transaction happens, so nothing in CM6 could notice (an element that leaves the page fires no event that the editor hears), and the renderer owns the
// block elements, so a clone is not its block. The rule that was decided (2026-11-23) is about edits: when an API call changes the focused block's contents, the
// block that replaces it gets the focus. That rule is tested below (a dispatch inside the focused block, a replaced document) and in spec/focus-api.test.ts.
test("focus goes to the block that replaces the focused one when an API edit changes it", async ({
  page,
}) => {
  // edited: the CM6 form of the test above: the page's own code changes the focused block's text (a dispatch), then replaces the whole document
  await openInBlockMode(page, "(f x y)\n(g z)");
  await block(page, /a f expression /).click({ position: { x: 4, y: 4 } });
  await page.evaluate(() => {
    const v = (window as any).demo.ed.view;
    v.dispatch({ changes: { from: 4, to: 5, insert: "xx" } }); // inside the focused call
  });
  await expect
    .poll(() =>
      page.evaluate(() => document.activeElement?.getAttribute("role"))
    )
    .toBe("treeitem");
  await page.evaluate(() => {
    const v = (window as any).demo.ed.view;
    v.dispatch({
      changes: { from: 0, to: v.state.doc.length, insert: "(f x y)\n(g w)" },
    });
  });
  await expect
    .poll(() =>
      page.evaluate(() => document.activeElement?.getAttribute("role"))
    )
    .toBe("treeitem");
});

const FIXME = new Set<string>([
  "focus goes to the focused block once it is back on the page",
]);
test.beforeEach(({}, ti) => {
  test.fixme(
    FIXME.has(ti.titlePath.slice(1).join(" › ")),
    "N: the test removes the focused element by hand and puts a clone back, then calls the CM5 refresh; no edit happens, so the editor cannot know. The decided rule (focus follows a block that an API edit replaces) is tested by the next test and by spec/focus-api.test.ts"
  );
});
