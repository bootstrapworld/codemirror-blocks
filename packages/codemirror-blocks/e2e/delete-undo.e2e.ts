import { expect, test } from "@playwright/test";
import {
  MOD,
  block,
  expectConsistent,
  openInBlockMode,
  snapshot,
} from "./helpers";

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
    const first = block(page, /show expression/);
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
    await expect(block(page, /show expression/)).toBeVisible();
  });

  test("keeps working for several deletes and undos in a row", async ({
    page,
  }) => {
    for (let i = 0; i < 3; i++) {
      await block(page, /show expression/).click({ position: { x: 4, y: 4 } });
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
    await block(page, /show expression/).click({ position: { x: 4, y: 4 } });
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
    const first = block(page, /show expression/);
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
    await page.goto("/");
    await page.waitForFunction(() => !!(window as { cmb?: unknown }).cmb);
    await page.getByRole("button", { name: /switch to blocks mode/i }).click();
    await block(page, /print expression/).waitFor();
  });

  test("Cmd-Z brings a deleted top-level block back, in place, with focus", async ({
    page,
  }) => {
    const original = (await snapshot(page)).text;
    await block(page, /print expression/).click({ position: { x: 6, y: 6 } });
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
    await expect(block(page, /print expression/)).toBeInViewport();
  });
});
