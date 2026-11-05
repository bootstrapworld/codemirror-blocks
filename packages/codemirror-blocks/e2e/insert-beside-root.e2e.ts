import { expect, test } from "@playwright/test";
import { block, openInBlockMode, snapshot } from "./helpers";

// Ctrl-] and Ctrl-[ open an insertion box beside the focused block. A top-level
// block has no parent to hold a drop target, and used to get nothing.
for (const [key, expected] of [
  ["Control+]", ["(f x y)", "q", "(g z)"]],
  ["Control+[", ["q", "(f x y)", "(g z)"]],
] as const) {
  test(`${key} beside a top-level block inserts a new top-level form`, async ({
    page,
  }) => {
    await openInBlockMode(page, "(f x y)\n(g z)");
    await block(page, /f expression/).click({ position: { x: 4, y: 4 } });
    await page.keyboard.press(key);
    await expect(page.locator("[contenteditable=true]")).toBeFocused();
    await page.keyboard.type("q");
    await page.keyboard.press("Enter");
    await expect
      .poll(async () => (await snapshot(page)).roots)
      .toEqual(expected);
    expect((await snapshot(page)).reparsed).toEqual(expected);
  });
}
