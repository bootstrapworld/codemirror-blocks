import { expect, test } from "@playwright/test";
import {
  MOD,
  block,
  dragWithMouse,
  expectConsistent,
  openInBlockMode,
  snapshot,
  trashCan,
  undoAll,
} from "./helpers";

const program = "(f x y)\n(g z)\n(h w)";

test.describe("dragging a block onto the trash can", () => {
  test("deletes it, and the text and AST agree", async ({ page }) => {
    await openInBlockMode(page, program);
    await dragWithMouse(page, block(page, /g expression/), trashCan(page));
    const s = await expectConsistent(page);
    expect(s.roots).toEqual(["(f x y)", "(h w)"]);
    expect(s.text).not.toContain("(g z)");
  });

  test("works again and again", async ({ page }) => {
    await openInBlockMode(page, program);
    for (const label of [/g expression/, /h expression/, /f expression/]) {
      await dragWithMouse(page, block(page, label), trashCan(page));
      await expectConsistent(page);
    }
    expect((await snapshot(page)).roots).toEqual([]);
  });

  test("works right after switching to block mode with the button", async ({
    page,
  }) => {
    // the first drag after a fresh load once edited a stale text-mode editor:
    // the AST lost the block, but the text on screen kept it
    await openInBlockMode(page, program);
    await dragWithMouse(page, block(page, /f expression/), trashCan(page));
    const s = await expectConsistent(page);
    expect(s.roots).toEqual(["(g z)", "(h w)"]);
  });

  test("works after switching to text mode and back", async ({ page }) => {
    await openInBlockMode(page, program);
    await page.getByRole("button", { name: /switch to text mode/i }).click();
    await page.getByRole("button", { name: /switch to blocks mode/i }).click();
    await dragWithMouse(page, block(page, /g expression/), trashCan(page));
    const s = await expectConsistent(page);
    expect(s.roots).toEqual(["(f x y)", "(h w)"]);
  });

  test("can be undone", async ({ page }) => {
    await openInBlockMode(page, program);
    const before = (await snapshot(page)).text;
    await dragWithMouse(page, block(page, /g expression/), trashCan(page));
    await expectConsistent(page);
    await undoAll(page);
    const s = await expectConsistent(page);
    expect(s.text).toBe(before);
    expect(s.roots).toHaveLength(3);
  });

  test("leaves a block focused for the keyboard", async ({ page }) => {
    await openInBlockMode(page, program);
    await dragWithMouse(page, block(page, /g expression/), trashCan(page));
    const s = await expectConsistent(page);
    expect(s.focus.role).toBe("treeitem");
    await page.keyboard.press(`${MOD}+z`);
    await expect.poll(async () => (await snapshot(page)).roots.length).toBe(3);
  });
});
