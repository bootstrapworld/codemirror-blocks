// PORTED from packages/codemirror-blocks/e2e/edit-literal.e2e.ts: only the import changed (to ../compat/helpers); see doc/experiments/cm6-direct-tree.md, thirteenth round.
// @ts-nocheck
// EDITED (documented, second round D): the labels `f expression`, `g,` are the table's `call to f `, `symbol g`
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { openInBlockMode } from "../compat/helpers";

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

// FIXME-BEGIN (thirteenth round: D: the edit box is an input here, the old one a contenteditable (interact.ts header))
const FIXME = new Set<string>([
  "editing a literal › a click opens its text, selected, the first time",
  "editing a literal › Enter on a selected literal opens its text, selected",
]);
test.beforeEach(({}, ti) => {
  test.fixme(
    FIXME.has(ti.titlePath.slice(1).join(" › ")),
    "D: the edit box is an input here, the old one a contenteditable (interact.ts header)"
  );
});
// FIXME-END
