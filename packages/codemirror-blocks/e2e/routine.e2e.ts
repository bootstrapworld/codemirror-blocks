import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import { expectConsistent, openInBlockMode } from "./helpers";

type Win = { cmb: { getValue(): string } };

/**
 * Blocks animate into place for about half a second after they are drawn (the
 * editor's style has transitions on them), so a small target is moving when it
 * is first there: wait for it to stop before pressing on it.
 */
const settled = async (target: Locator) => {
  let last = "";
  await expect
    .poll(async () => {
      const now = JSON.stringify(await target.boundingBox());
      const same = now === last;
      last = now;
      return same;
    })
    .toBe(true);
};
const source = (page: Page) =>
  page.evaluate(() => (window as unknown as Win).cmb.getValue());

/**
 * Routine (src/languages/routine), in a browser: the loop keeps the drop
 * target for the end of its steps in its head, above them, and its steps in
 * rows with the targets in a gutter.
 */
const PROGRAM = '(let spare)\n(repeat 2 (show "a") (show "b"))';

test.describe("the Routine language", () => {
  test("lays a loop out with the target for the end above the steps", async ({
    page,
  }) => {
    await openInBlockMode(page, PROGRAM, "routine");
    const head = page.locator(".routine-loop-head .blocks-drop-target");
    const firstStep = page.locator(".routine-step").first();
    await expect(head).toBeVisible();
    const [headBox, stepBox] = await Promise.all([
      head.boundingBox(),
      firstStep.boundingBox(),
    ]);
    expect(headBox!.y).toBeLessThan(stepBox!.y);
  });

  test("typing in the target in the head adds a step at the end", async ({
    page,
  }) => {
    await openInBlockMode(page, PROGRAM, "routine");
    await page.locator(".routine-loop-head .blocks-drop-target").click();
    await page.keyboard.type('(show "c")');
    await page.keyboard.press("Enter");
    await expect
      .poll(() => source(page))
      .toBe(
        '(let spare)\n(repeat 2\n  (show "a")\n  (show "b")\n  (show "c"))'
      );
    await expectConsistent(page);
  });

  test("typing in a gutter adds the step before the one beside it", async ({
    page,
  }) => {
    await openInBlockMode(page, PROGRAM, "routine");
    await page.locator(".routine-gutter .blocks-drop-target").nth(1).click();
    await page.keyboard.type("(show 0)");
    await page.keyboard.press("Enter");
    await expect
      .poll(() => source(page))
      .toBe('(let spare)\n(repeat 2\n  (show "a")\n  (show 0)\n  (show "b"))');
  });

  test("fills an optional part from its target", async ({ page }) => {
    await openInBlockMode(page, PROGRAM, "routine");
    const start = page.locator(".blocks-define .blocks-drop-target");
    await settled(start);
    await start.click();
    await page.keyboard.type("7");
    await page.keyboard.press("Enter");
    await expect.poll(() => source(page)).toContain("(let spare 7)");
    await expect(
      page.locator(".blocks-define .blocks-drop-target")
    ).toHaveCount(0);
  });

  test("a name shows what is defined before it while it has focus", async ({
    page,
  }) => {
    await openInBlockMode(page, "(let a 1)\n(show (+ a 2))", "routine");
    const name = page.locator(".blocks-call .blocks-name").first();
    await name.click();
    await page.keyboard.press("Escape"); // (a click on a name opens its text)
    await expect(page.locator(".routine-hint")).toHaveText("defined: a");
    await page
      .locator(".blocks-define")
      .first()
      .click({ position: { x: 4, y: 4 } });
    await expect(page.locator(".routine-hint")).toHaveCount(0);
  });
});
