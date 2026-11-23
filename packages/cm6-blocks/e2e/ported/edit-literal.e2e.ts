// PORTED from packages/codemirror-blocks/e2e/edit-literal.e2e.ts: only the import changed (to ../compat/helpers); see doc/experiments/cm6-direct-tree.md, thirteenth round.
// EDITED (documented, second round D): the labels `f expression`, `g,` are the table's `a f expression `, `symbol g`
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { openInBlockMode } from "../compat/helpers";

/** What the editing box holds, and what is selected in it */
const editing = (page: Page) =>
  // edited: the box is an input (or a textarea), not a contenteditable
  page.evaluate(() => {
    const a = document.activeElement as HTMLInputElement | null;
    const box = !!a && /^(INPUT|TEXTAREA)$/.test(a.tagName);
    return {
      editable: box ? "true" : "false",
      text: box ? a.value : undefined,
      selected: box ? a.value.slice(a.selectionStart!, a.selectionEnd!) : "",
    };
  });

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
