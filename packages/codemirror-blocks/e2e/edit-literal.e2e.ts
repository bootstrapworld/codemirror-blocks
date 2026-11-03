import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { openInBlockMode } from "./helpers";

/** What the editing box holds, and what is selected in it */
const editing = (page: Page) =>
  page.evaluate(() => ({
    editable: document.activeElement?.getAttribute("contenteditable"),
    text: document.activeElement?.textContent,
    selected: window.getSelection()?.toString(),
  }));

test.describe("editing a literal", () => {
  test("a click opens its text, selected, the first time", async ({ page }) => {
    await openInBlockMode(page, '(f 12 "hi")');
    await page.getByRole("treeitem", { name: /^12/ }).click();
    await expect
      .poll(() => editing(page))
      .toEqual({
        editable: "true",
        text: "12",
        selected: "12",
      });
  });

  test("Enter on a selected literal opens its text, selected", async ({
    page,
  }) => {
    await openInBlockMode(page, '(f 12 "hi")');
    await page.getByRole("treeitem", { name: /hi/ }).focus();
    await page.keyboard.press("Enter");
    await expect
      .poll(() => editing(page))
      .toEqual({
        editable: "true",
        text: '"hi"',
        selected: '"hi"',
      });
  });
});
