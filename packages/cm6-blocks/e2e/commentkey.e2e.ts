// Twentieth round: Shift-Ctrl-] edits a top-level comment block, and the comment attached to a block.
import { test, expect } from "@playwright/test";

/* eslint-disable @typescript-eslint/no-explicit-any */
const src = async (page: any) =>
  page.evaluate(() => (window as any).demo.ed.view.state.doc.toString());

test("the comment shortcut on a comment block and on a block with a comment", async ({
  page,
}) => {
  await page.goto("/index.html?lang=scheme");
  await page.waitForSelector(".cm-content [role=treeitem]");
  await page.evaluate(() => {
    const d = (window as any).demo;
    d.ed.view.dispatch({
      changes: {
        from: 0,
        to: d.ed.view.state.doc.length,
        insert: "; mine\n(f 1)\n\n; apart\n\n(g 2)\n",
      },
    });
  });
  const apart = page.getByRole("treeitem", { name: /; apart, a comment/ });
  await apart.click({ position: { x: 4, y: 4 } });
  await expect(apart).toBeFocused();
  await page.keyboard.press("Shift+Control+]");
  const box = page.locator("input.blocks-edit");
  await expect(box).toHaveValue("apart");
  await page.keyboard.type("elsewhere");
  await page.keyboard.press("Enter");
  await expect.poll(() => src(page)).toContain("; elsewhere");
  const f = page.getByRole("treeitem", {
    name: /a f expression .*with comment/,
  });
  await f.click({ position: { x: 4, y: 4 } });
  await page.keyboard.press("Shift+Control+]");
  await expect(box).toHaveValue("mine");
  await page.keyboard.press("Escape");
  await expect.poll(() => src(page)).toContain("; mine\n(f 1)");
});
