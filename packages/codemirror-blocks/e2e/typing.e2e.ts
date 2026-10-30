import { expect, test } from "@playwright/test";
import { block, expectConsistent, openInBlockMode, snapshot } from "./helpers";

/** Click the blank space to the right of the block that is on this line. */
const clickBesideBlock = async (
  page: import("@playwright/test").Page,
  label: RegExp
) => {
  const box = (await block(page, label).boundingBox())!;
  await page.mouse.click(box.x + box.width + 60, box.y + box.height / 2);
};

test.describe("typing at the top level", () => {
  test("a new block is made from what is typed, on Enter", async ({ page }) => {
    await openInBlockMode(page, "42\n11");
    await clickBesideBlock(page, /^42,/);
    await page.keyboard.type("9");
    await page.keyboard.press("Enter");
    const s = await expectConsistent(page);
    expect(s.roots).toEqual(["42", "9", "11"]);
  });

  test("Escape throws it away", async ({ page }) => {
    await openInBlockMode(page, "42\n11");
    await clickBesideBlock(page, /^42,/);
    await page.keyboard.type("9");
    await page.keyboard.press("Escape");
    const s = await expectConsistent(page);
    expect(s.roots).toEqual(["42", "11"]);
  });

  test("a whole expression can be typed", async ({ page }) => {
    await openInBlockMode(page, "42\n11");
    await clickBesideBlock(page, /^11,/);
    await page.keyboard.type("(f x y)");
    await page.keyboard.press("Enter");
    const s = await expectConsistent(page);
    expect(s.roots).toEqual(["42", "11", "(f x y)"]);
  });

  test("text that won't parse is refused, and nothing changes", async ({
    page,
  }) => {
    await openInBlockMode(page, "42\n11");
    await clickBesideBlock(page, /^42,/);
    await page.keyboard.type("(((");
    await page.keyboard.press("Enter");
    expect((await snapshot(page)).roots).toEqual(["42", "11"]);
  });

  test("typing over a selected block replaces it", async ({ page }) => {
    // this was an it.todo in jsdom, where the selection was already collapsed
    // by the time the key handler ran
    await openInBlockMode(page, "42\n11");
    await clickBesideBlock(page, /^42,/);
    await page.keyboard.press("Home");
    await page.keyboard.press("Shift+End");
    await page.keyboard.type("7");
    await page.keyboard.press("Enter");
    const s = await expectConsistent(page);
    expect(s.roots).toEqual(["7", "11"]);
  });
});
