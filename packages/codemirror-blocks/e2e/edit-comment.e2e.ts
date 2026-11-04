import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { openInBlockMode } from "./helpers";

const COMMENT_KEY = "Shift+Control+]";

type Win = { cmb: { getValue(): string } };
const source = (page: Page) =>
  page.evaluate(() => (window as unknown as Win).cmb.getValue());

const editing = (page: Page) =>
  page.evaluate(() => ({
    editable: document.activeElement?.getAttribute("contenteditable"),
    text: document.activeElement?.textContent,
    selected: window.getSelection()?.toString(),
  }));

test.describe("editing a comment from the keyboard", () => {
  test("adds a comment to a block that has none", async ({ page }) => {
    await openInBlockMode(page, "(f x)\n(g y)");
    await page.getByRole("treeitem", { name: /g expression/ }).click({
      position: { x: 4, y: 4 },
    });
    await page.keyboard.press(COMMENT_KEY);
    await expect.poll(() => editing(page)).toMatchObject({ editable: "true" });
    await page.keyboard.type("the second one");
    await page.keyboard.press("Enter");
    await expect
      .poll(() => source(page))
      .toBe("(f x)\n#| the second one |#\n(g y)");
    await expect(
      page.getByRole("treeitem", { name: /g expression/ })
    ).toBeFocused();
  });

  test("opens the text of an existing comment, selected, and replaces it", async ({
    page,
  }) => {
    await openInBlockMode(page, "#| old words |#\n(f x)");
    await page.getByRole("treeitem", { name: /f expression/ }).click({
      position: { x: 4, y: 4 },
    });
    await page.keyboard.press(COMMENT_KEY);
    await expect
      .poll(() => editing(page))
      .toEqual({
        editable: "true",
        text: "old words",
        selected: "old words",
      });
    await page.keyboard.type("new words");
    await page.keyboard.press("Enter");
    await expect.poll(() => source(page)).toBe("#| new words |#\n(f x)");
  });

  test("Escape leaves the comment alone", async ({ page }) => {
    await openInBlockMode(page, "#| old words |#\n(f x)");
    await page.getByRole("treeitem", { name: /f expression/ }).click({
      position: { x: 4, y: 4 },
    });
    await page.keyboard.press(COMMENT_KEY);
    await page.keyboard.type("nope");
    await page.keyboard.press("Escape");
    await expect.poll(() => source(page)).toBe("#| old words |#\n(f x)");
  });

  test("works on a block inside another", async ({ page }) => {
    await openInBlockMode(page, "(f x y)");
    await page.getByRole("treeitem", { name: /^y/ }).click({
      position: { x: 4, y: 4 },
    });
    await page.keyboard.press("Escape"); // (a click on a literal opens its text)
    await page.keyboard.press(COMMENT_KEY);
    await page.keyboard.type("last");
    await page.keyboard.press("Enter");
    // (the comment goes with y, and the rest is as it was)
    await expect
      .poll(async () => (await source(page)).replace(/\s+/g, " "))
      .toBe("(f x #| last |# y)");
  });
});
