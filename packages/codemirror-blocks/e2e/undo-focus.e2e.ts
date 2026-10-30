import { expect, Page, test } from "@playwright/test";
import { MOD, expectConsistent, openInBlockMode, snapshot } from "./helpers";

/**
 * Which block has keyboard focus after an undo or a redo, in a real browser.
 * (spec/undo-focus-test.ts checks the same choices in jsdom, which has no real
 * text selection: in Chromium, an undo that removed a line threw
 * "IndexSizeError" from CodeMirror's restoreSelection when the page's selection
 * was anchored on the lines and a block had focus, which left the dev server's
 * error overlay with keyboard focus.)
 */

const PROGRAM = "(f x y)\n(g z)\nw";

/** What a screenreader would read out for the block with keyboard focus */
const focusedLabel = (page: Page) =>
  page.evaluate(() => document.activeElement?.getAttribute("aria-label") ?? "");

/** Wait for the document to become `text` (a paste or an undo lands a moment after the key) */
const expectText = (page: Page, text: string) =>
  expect.poll(async () => (await snapshot(page)).text).toBe(text);

const pageErrors = (page: Page) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error.stack)));
  return errors;
};

/** Click the first block, expand everything under it, and walk down to `x`. */
const selectX = async (page: Page) => {
  await page
    .getByRole("treeitem")
    .first()
    .click({ position: { x: 4, y: 4 } });
  await page.keyboard.press("Shift+ArrowRight");
  await page.keyboard.press("ArrowRight"); // f
  await page.keyboard.press("ArrowDown"); // x
  await expect.poll(() => focusedLabel(page)).toMatch(/^x\b/);
};

test.describe("undoing and redoing a delete", () => {
  test("undo focuses the deleted block again, redo the one before it", async ({
    page,
  }) => {
    const errors = pageErrors(page);
    await openInBlockMode(page, PROGRAM);
    await selectX(page);
    await page.keyboard.press("Space");
    await page.keyboard.press("Delete");
    await expectText(page, "(f y)\n(g z)\nw");
    await expectConsistent(page);
    expect(await focusedLabel(page)).toMatch(/^f\b/);

    await page.keyboard.press(`${MOD}+z`);
    await expectText(page, PROGRAM);
    await expectConsistent(page);
    await expect.poll(() => focusedLabel(page)).toMatch(/^x\b/);

    await page.keyboard.press(`${MOD}+y`);
    await expectText(page, "(f y)\n(g z)\nw");
    await expectConsistent(page);
    // (it used to be y, which took over x's position in the shorter document)
    await expect.poll(() => focusedLabel(page)).toMatch(/^f\b/);
    expect(errors).toEqual([]);
  });
});

test.describe("undoing and redoing typing at the top level", () => {
  test("undo goes back to the first block, redo to the typed one, without errors", async ({
    page,
  }) => {
    const errors = pageErrors(page);
    await openInBlockMode(page, "(f x)\n(g y)");
    const box = (await page.getByRole("treeitem").first().boundingBox())!;
    await page.mouse.click(box.x + box.width + 60, box.y + box.height / 2);
    await page.keyboard.type("9");
    await page.keyboard.press("Enter");
    await expectText(page, "(f x)\n9\n(g y)");
    await expect.poll(() => focusedLabel(page)).toMatch(/^9\b/);

    await page.keyboard.press(`${MOD}+z`);
    await expectText(page, "(f x)\n(g y)");
    await expectConsistent(page);
    await expect.poll(() => focusedLabel(page)).toMatch(/^f expression\b/);

    await page.keyboard.press(`${MOD}+y`);
    await expectText(page, "(f x)\n9\n(g y)");
    await expectConsistent(page);
    await expect.poll(() => focusedLabel(page)).toMatch(/^9\b/);
    expect(errors).toEqual([]);
  });
});

test.describe("undoing and redoing an edit made on the first block", () => {
  test("undo focuses that first block, not the one at the pasted position", async ({
    page,
  }) => {
    const errors = pageErrors(page);
    await openInBlockMode(page, PROGRAM);
    await page.evaluate(() => navigator.clipboard.writeText("zzz"));
    await page
      .getByRole("treeitem")
      .first()
      .click({ position: { x: 4, y: 4 } });
    const first = await focusedLabel(page);
    await page.keyboard.press(`${MOD}+v`);
    await expectText(page, "(f x y)\nzzz\n(g z)\nw");
    await expect.poll(() => focusedLabel(page)).toMatch(/^zzz\b/);

    await page.keyboard.press(`${MOD}+z`);
    await expectText(page, PROGRAM);
    await expectConsistent(page);
    await expect.poll(() => focusedLabel(page)).toBe(first);

    await page.keyboard.press(`${MOD}+y`);
    await expectText(page, "(f x y)\nzzz\n(g z)\nw");
    await expectConsistent(page);
    await expect.poll(() => focusedLabel(page)).toMatch(/^zzz\b/);
    expect(errors).toEqual([]);
  });
});
