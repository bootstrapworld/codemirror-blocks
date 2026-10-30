import { expect, test } from "@playwright/test";
import {
  MOD,
  dragWithMouse,
  expectConsistent,
  openInBlockMode,
  snapshot,
} from "./helpers";

// Pressing a toolbar block to drag it gives the toolbar keyboard focus. Once the
// block is dropped into the editor, focus used to stay on the toolbar, so Ctrl-Z
// was ignored until the user clicked into the editor. (jsdom doesn't move focus on
// a press, which is why this needs a real mouse.)
test.describe("dragging a block from the toolbar into the editor with the mouse", () => {
  test.beforeEach(async ({ page }) => {
    await openInBlockMode(page, "(f x)\n(g y)");
    await dragWithMouse(
      page,
      page.locator(".Primitive", { hasText: /^sqrt$/ }),
      page.locator(".CodeMirror-scroll").first()
    );
    await expect
      .poll(async () => (await snapshot(page)).text)
      .toContain("sqrt");
  });

  test("leaves keyboard focus in the editor, not on the toolbar", async ({
    page,
  }) => {
    const s = await expectConsistent(page);
    expect(
      await page
        .locator(".Toolbar")
        .evaluate((el) => el.contains(document.activeElement))
    ).toBe(false);
    expect(s.focus.tag).not.toBe("BODY");
  });

  test("so that Ctrl/Cmd-Z undoes the drop", async ({ page }) => {
    await expectConsistent(page);
    await page.keyboard.press(`${MOD}+z`);
    await expect
      .poll(async () => (await snapshot(page)).text)
      .toBe("(f x)\n(g y)");
    await expectConsistent(page);
  });
});
