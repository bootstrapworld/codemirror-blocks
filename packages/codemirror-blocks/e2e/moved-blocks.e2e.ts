import { expect, test, type Page } from "@playwright/test";
import { MOD, expectConsistent, openInBlockMode, snapshot } from "./helpers";

/**
 * A block that only moved (a form was inserted or deleted above it) is not
 * drawn again, so it still holds an older node, with older positions. Everything
 * done to such a block must use where it is now.
 */

const FORMS = 12;
const code = Array.from(
  { length: FORMS },
  (_, i) => `(define (f${i} x) (+ x ${i + 100}))`
).join("\n");

const block = (page: Page, label: RegExp) =>
  page.getByRole("treeitem", { name: label }).first();

/** Shift every block down: paste a new form after the first one */
async function insertAtTop(page: Page) {
  await block(page, /^f0:/).click({ position: { x: 2, y: 2 } });
  await page.evaluate(() => navigator.clipboard.writeText("(inserted 1 2)"));
  await page.keyboard.press(`${MOD}+v`);
  await expect
    .poll(async () => (await snapshot(page)).text)
    .toContain("(inserted 1 2)");
  await expectConsistent(page);
}

test.beforeEach(async ({ page }) => {
  await openInBlockMode(page, code);
});

test("a block that moved can be edited, in the right place", async ({
  page,
}) => {
  await insertAtTop(page);
  const number = page.getByRole("treeitem", { name: /^111,?$/ }).first();
  await number.click();
  if (
    (await page.evaluate(() =>
      document.activeElement?.getAttribute("role")
    )) !== "textbox"
  ) {
    await page.keyboard.press("Enter");
  }
  await page.keyboard.press(`${MOD}+a`);
  await page.keyboard.type("4242");
  await page.keyboard.press("Enter");
  const { text } = await snapshot(page);
  expect(text).toContain("(define (f11 x) (+ x 4242))");
  expect(text).toContain("(define (f10 x) (+ x 110))");
  await expectConsistent(page);
});

test("a block that moved can be deleted, and the delete undone", async ({
  page,
}) => {
  await insertAtTop(page);
  await block(page, /^f9:/).click({ position: { x: 2, y: 2 } });
  await page.keyboard.press("Space");
  await page.keyboard.press("Delete");
  await expect
    .poll(async () => (await snapshot(page)).text)
    .not.toContain("(define (f9 x)");
  expect((await snapshot(page)).text).toContain("(define (f8 x)");
  expect((await snapshot(page)).text).toContain("(define (f10 x)");
  await expectConsistent(page);
  await page.keyboard.press(`${MOD}+z`);
  await expect
    .poll(async () => (await snapshot(page)).text)
    .toContain("(define (f9 x)");
  await expectConsistent(page);
});

test("a block that moved can be collapsed and expanded", async ({ page }) => {
  await insertAtTop(page);
  const f7 = block(page, /^f7:/);
  await f7.click({ position: { x: 2, y: 2 } });
  await page.keyboard.press("ArrowLeft");
  await expect(f7).toHaveAttribute("aria-expanded", "false");
  await page.keyboard.press("ArrowRight");
  await expect(f7).not.toHaveAttribute("aria-expanded", "false");
  await expectConsistent(page);
});

test("blocks keep working after several inserts and deletes above them", async ({
  page,
}) => {
  for (let i = 0; i < 3; i++) await insertAtTop(page);
  await block(page, /^f0:/).click({ position: { x: 2, y: 2 } });
  await page.keyboard.press("Space");
  await page.keyboard.press("Delete");
  await expectConsistent(page);
  const after = await snapshot(page);
  expect(after.reparsed).toEqual(after.roots);
  await block(page, /^f11:/).click({ position: { x: 2, y: 2 } });
  await expect
    .poll(() =>
      page.evaluate(() => document.activeElement?.getAttribute("aria-label"))
    )
    .toMatch(/^f11:/);
});
