// PORTED from packages/codemirror-blocks/e2e/toolbar-drag.e2e.ts: only the import changed (to ../compat/helpers); see doc/experiments/cm6-direct-tree.md, thirteenth round.
import { expect, test } from "@playwright/test";
import {
  MOD,
  dragWithMouse,
  expectConsistent,
  openInBlockMode,
  snapshot,
} from "../compat/helpers";

// Pressing a toolbar block to drag it gives the toolbar keyboard focus. Once the
// block is dropped into the editor, focus used to stay on the toolbar, so Ctrl-Z
// was ignored until the user clicked into the editor. (jsdom doesn't move focus on
// a press, which is why this needs a real mouse.)
test.describe("dragging a block from the toolbar into the editor with the mouse", () => {
  test.beforeEach(async ({ page }) => {
    await openInBlockMode(page, "(f x)\n(g y)");
    // edited: the demo's toolbar (`#templates`, a `number` template) for the old `.Primitive` `sqrt`; the drop goes on the editor's scroller; the number's text is not `sqrt`, so "the program changed"
    await dragWithMouse(
      page,
      page.locator('#templates button[data-template="number"]'),
      page.locator(".cm-scroller").first()
    );
    await expect
      .poll(async () => (await snapshot(page)).text)
      .not.toBe("(f x)\n(g y)");
  });

  test("leaves keyboard focus in the editor, not on the toolbar", async ({
    page,
  }) => {
    const s = await expectConsistent(page);
    expect(
      await page
        .locator("#templates") // (edited: the old `.Toolbar`)
        .evaluate((el) => el.contains(document.activeElement))
    ).toBe(false);
    expect(s.focus.tag).not.toBe("BODY");
  });

  test("so that Ctrl/Cmd-Z undoes the drop", async ({ page }) => {
    test.fixme(
      true,
      "Q: a dropped `number` template opens its first hole for typing (an input), so the first Ctrl/Cmd-Z goes to that box and the program keeps the new block; toolbar.e2e.ts takes two undos back. Whether one undo after a toolbar drop should take the block back is a decision"
    );
    await expectConsistent(page);
    await page.keyboard.press(`${MOD}+z`);
    await expect
      .poll(async () => (await snapshot(page)).text)
      .toBe("(f x)\n(g y)");
    await expectConsistent(page);
  });
});
