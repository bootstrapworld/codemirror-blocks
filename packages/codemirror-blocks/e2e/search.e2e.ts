import { expect, Page, test } from "@playwright/test";
import { block, expectConsistent, openInBlockMode } from "./helpers";

/**
 * Search, in a real browser: F3 opens the Search Settings dialog, Enter closes
 * it and goes to the first match, PageDown and PageUp go to the next and
 * previous one, and past the last one the search goes on from the first.
 */
const PROGRAM = "(f x)\n(g xy x)\nx";

/** The aria-label of the block that has keyboard focus */
const focusedLabel = (page: Page) =>
  page.evaluate(() => document.activeElement?.getAttribute("aria-label"));
/** Where on the page the focused block is (lines run down the page) */
const focusedTop = (page: Page) =>
  page.evaluate(
    () => document.activeElement?.getBoundingClientRect().top ?? -1
  );

test.beforeEach(async ({ page }) => {
  await openInBlockMode(page, PROGRAM);
  await block(page, /^f expression/).click({ position: { x: 4, y: 4 } });
});

/** The dialog's title (the dialog element itself has no size of its own) */
const heading = (page: Page) =>
  page.getByRole("heading", { name: "Search Settings" });

const searchFor = async (page: Page, text: string) => {
  await page.keyboard.press("F3");
  const input = page.getByLabel("Search String");
  await expect(input).toBeVisible();
  await input.fill(text);
  await page.keyboard.press("Enter");
  await expect(input).toBeHidden();
};

test("F3 opens the dialog, and Escape closes it without moving", async ({
  page,
}) => {
  const before = await focusedLabel(page);
  await page.keyboard.press("F3");
  await expect(heading(page)).toBeVisible();
  await expect(
    page.getByRole("tab", { name: "Search by string" })
  ).toBeVisible();
  await expect(
    page.getByRole("tab", { name: "Search by block" })
  ).toBeVisible();
  await page.getByLabel("Search String").fill("x");
  await page.keyboard.press("Escape");
  await expect(heading(page)).toBeHidden();
  expect(await focusedLabel(page)).toBe(before);
});

test("Enter goes to the first match, and PageDown and PageUp step through them", async ({
  page,
}) => {
  await searchFor(page, "x");
  expect(await focusedLabel(page)).toBe("x,");
  const lines: number[] = [await focusedTop(page)];
  await page.keyboard.press("PageDown");
  lines.push(await focusedTop(page));
  await page.keyboard.press("PageDown");
  lines.push(await focusedTop(page));
  await page.keyboard.press("PageDown");
  lines.push(await focusedTop(page));
  // x in the first call, x in xy then the x after it on the second line, then
  // the x on the third: going down the page
  expect(lines[1]).toBeGreaterThan(lines[0]);
  expect(lines[2]).toBe(lines[1]);
  expect(lines[3]).toBeGreaterThan(lines[2]);
  await page.keyboard.press("PageUp");
  expect(await focusedTop(page)).toBe(lines[2]);
  await expectConsistent(page);
});

test("past the last match, the search goes on from the first", async ({
  page,
}) => {
  await searchFor(page, "x");
  const first = await focusedTop(page);
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press("PageDown");
  }
  expect(await focusedTop(page)).toBeGreaterThan(first);
  await page.keyboard.press("PageDown");
  expect(await focusedTop(page)).toBe(first);
});

test("search by block type finds the next call", async ({ page }) => {
  await page.keyboard.press("F3");
  await page.getByRole("tab", { name: "Search by block" }).click();
  await page.getByRole("combobox").selectOption("functionApp");
  await page.keyboard.press("Enter");
  await expect(heading(page)).toBeHidden();
  expect(await focusedLabel(page)).toMatch(/^g expression/);
  await page.keyboard.press("PageDown"); // the only other call: back to the first
  expect(await focusedLabel(page)).toMatch(/^f expression/);
});

test("Control+F3 picks the block type PageDown searches for", async ({
  page,
}) => {
  await page.keyboard.press("Control+F3"); // the first type: function calls
  await page.keyboard.press("PageDown");
  expect(await focusedLabel(page)).toMatch(/^g expression/);
});

test("the editor still works after a search", async ({ page }) => {
  await searchFor(page, "xy");
  expect(await focusedLabel(page)).toBe("xy,");
  await page.keyboard.press("Space");
  await page.keyboard.press("Delete");
  const s = await expectConsistent(page);
  expect(s.text).not.toContain("xy");
  expect(s.roots).toContain("(f x)");
});
