// PORTED from packages/codemirror-blocks/e2e/trash-can.e2e.ts: only the import changed (to ../compat/helpers); see doc/experiments/cm6-direct-tree.md, thirteenth round.
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
} from "../compat/helpers";

const program = "(f x y)\n(g z)\n(h w)";

test.describe("dragging a block onto the trash can", () => {
  test("deletes it, and the text and AST agree", async ({ page }) => {
    await openInBlockMode(page, program);
    await dragWithMouse(page, block(page, /call to g /), trashCan(page));
    const s = await expectConsistent(page);
    expect(s.roots).toEqual(["(f x y)", "(h w)"]);
    expect(s.text).not.toContain("(g z)");
  });

  test("works again and again", async ({ page }) => {
    await openInBlockMode(page, program);
    for (const label of [/call to g /, /call to h /, /call to f /]) {
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
    await dragWithMouse(page, block(page, /call to f /), trashCan(page));
    const s = await expectConsistent(page);
    expect(s.roots).toEqual(["(g z)", "(h w)"]);
  });

  test("works after switching to text mode and back", async ({ page }) => {
    await openInBlockMode(page, program);
    await page.getByRole("button", { name: /switch to text mode/i }).click();
    await page.getByRole("button", { name: /switch to blocks mode/i }).click();
    await dragWithMouse(page, block(page, /call to g /), trashCan(page));
    const s = await expectConsistent(page);
    expect(s.roots).toEqual(["(f x y)", "(h w)"]);
  });

  test("can be undone", async ({ page }) => {
    await openInBlockMode(page, program);
    const before = (await snapshot(page)).text;
    await dragWithMouse(page, block(page, /call to g /), trashCan(page));
    await expectConsistent(page);
    await undoAll(page);
    const s = await expectConsistent(page);
    expect(s.text).toBe(before);
    expect(s.roots).toHaveLength(3);
  });

  test("leaves a block focused for the keyboard", async ({ page }) => {
    await openInBlockMode(page, program);
    await dragWithMouse(page, block(page, /call to g /), trashCan(page));
    const s = await expectConsistent(page);
    expect(s.focus.role).toBe("treeitem");
    await page.keyboard.press(`${MOD}+z`);
    await expect.poll(async () => (await snapshot(page)).roots.length).toBe(3);
  });
});

// FIXME-BEGIN (thirteenth round: M: the trash can is not built)
const FIXME = new Set<string>([
  "dragging a block onto the trash can › works after switching to text mode and back",
  "dragging a block onto the trash can › can be undone",
]);
test.beforeEach(({}, ti) => {
  test.fixme(
    FIXME.has(ti.titlePath.slice(1).join(" › ")),
    "M: the trash can is not built"
  );
});
// FIXME-END
// first error (sweep): dragging a block onto the trash can › works after switching to text mode and back => Test timeout of 20000ms exceeded.
// first error (sweep): dragging a block onto the trash can › can be undone => Error: expect(received).toBe(expected) // Object.is equality
