// PORTED from packages/codemirror-blocks/e2e/delete-undo.e2e.ts: only the import changed (to ../compat/helpers); see doc/experiments/cm6-direct-tree.md, thirteenth round.
// edited (thirty-third round): `show expression` is `a show expression ` here
// EDITED (documented, second round D): the labels `f expression`, `g,` are the table's `a f expression `, `symbol g`
import { expect, test } from "@playwright/test";
import {
  MOD,
  block,
  expectConsistent,
  openDemo,
  openInBlockMode,
  snapshot,
} from "../compat/helpers";

// Long enough that CodeMirror only keeps the lines in view in the page, which
// is what made focus fall off a deleted block (and Cmd-Z do nothing).
const longProgram = Array.from(
  { length: 60 },
  (_, i) => `(show ${i} "line ${i}")`
).join("\n");

test.describe("deleting a block, then undoing, in a long document", () => {
  test.beforeEach(async ({ page }) => {
    await openInBlockMode(page, longProgram);
  });

  test("a top-level block comes back, and the view doesn't jump", async ({
    page,
  }) => {
    const first = block(page, /a show expression /);
    await first.click({ position: { x: 4, y: 4 } });
    const { scrollTop: before } = await snapshot(page);
    await page.keyboard.press("Space");
    await page.keyboard.press("Delete");

    const afterDelete = await expectConsistent(page);
    expect(afterDelete.roots).toHaveLength(59);
    expect(Math.abs(afterDelete.scrollTop - before)).toBeLessThan(40);
    expect(afterDelete.focus.role).toBe("treeitem");

    await page.keyboard.press(`${MOD}+z`);

    const afterUndo = await expectConsistent(page);
    expect(afterUndo.roots).toHaveLength(60);
    expect(afterUndo.text).toBe(longProgram);
    expect(Math.abs(afterUndo.scrollTop - before)).toBeLessThan(40);
    await expect(block(page, /a show expression /)).toBeVisible();
  });

  test("keeps working for several deletes and undos in a row", async ({
    page,
  }) => {
    for (let i = 0; i < 3; i++) {
      await block(page, /a show expression /).click({
        position: { x: 4, y: 4 },
      });
      await page.keyboard.press("Space");
      await page.keyboard.press("Delete");
      await expectConsistent(page);
    }
    expect((await snapshot(page)).roots).toHaveLength(57);
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press(`${MOD}+z`);
      await expectConsistent(page);
    }
    expect((await snapshot(page)).text).toBe(longProgram);
  });

  test("redo still works after the undo", async ({ page }) => {
    await block(page, /a show expression /).click({ position: { x: 4, y: 4 } });
    await page.keyboard.press("Space");
    await page.keyboard.press("Delete");
    await expectConsistent(page);
    await page.keyboard.press(`${MOD}+z`);
    await expectConsistent(page);
    await page.keyboard.press(`${MOD}+y`);
    await expect.poll(async () => (await snapshot(page)).roots.length).toBe(59);
    await expectConsistent(page);
  });

  test("a child block comes back too", async ({ page }) => {
    await page
      .getByRole("treeitem", { name: /^0,/ })
      .first()
      .click({ position: { x: 2, y: 2 } })
      .catch(() => undefined); // clicking a literal starts editing it
    await page.keyboard.press("Escape");
    const first = block(page, /a show expression /);
    await first.click({ position: { x: 4, y: 4 } });
    await page.keyboard.press("ArrowRight"); // into the first child
    await page.keyboard.press("Space");
    await page.keyboard.press("Delete");
    await expectConsistent(page);
    await page.keyboard.press(`${MOD}+z`);
    const s = await expectConsistent(page);
    expect(s.text).toBe(longProgram);
  });
});

test.describe("in the example page's own program", () => {
  // This is the document the page loads. Undoing a delete used to leave focus in
  // the hidden text area and scroll the view to the end of the document, so the
  // block that had just come back was out of sight and keys went nowhere.
  test.beforeEach(async ({ page }) => {
    // edited: the demo page opens in blocks mode with its own sample (`window.cmb` is the shim's); the sample has `(fact 5)`, a a fact, expression for the old `print`
    await openDemo(page);
    await block(page, /a fact expression /).waitFor();
  });

  test("Cmd-Z brings a deleted top-level block back, in place, with focus", async ({
    page,
  }) => {
    const original = (await snapshot(page)).text;
    await block(page, /a fact expression /).click({ position: { x: 6, y: 6 } });
    const { scrollTop: before } = await snapshot(page);
    await page.keyboard.press("Space");
    await page.keyboard.press("Delete");
    const afterDelete = await expectConsistent(page);
    expect(afterDelete.text).not.toBe(original);
    expect(Math.abs(afterDelete.scrollTop - before)).toBeLessThan(150);

    await page.keyboard.press(`${MOD}+z`);

    const afterUndo = await expectConsistent(page);
    expect(afterUndo.text).toBe(original);
    expect(afterUndo.focus.role).toBe("treeitem");
    expect(Math.abs(afterUndo.scrollTop - before)).toBeLessThan(150);
    await expect(block(page, /a fact expression /)).toBeInViewport();
  });
});
