import { expect, test } from "@playwright/test";
import { block, openInBlockMode } from "./helpers";

// The block with keyboard focus can be taken off the page by CodeMirror before
// the block that should have focus next is on it. The browser then drops focus
// to the body, and nothing re-renders to notice (soak seeds 15405 and 18940).
test("focus goes to the focused block once it is back on the page", async ({
  page,
}) => {
  await openInBlockMode(page, "(f x y)\n(g z)");
  await block(page, /f expression/).click({ position: { x: 4, y: 4 } });
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
