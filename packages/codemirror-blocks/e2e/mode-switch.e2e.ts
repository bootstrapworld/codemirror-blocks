import { expect, test } from "@playwright/test";
import { openInBlockMode } from "./helpers";

type Win = { cmb: { getCM(): { getScrollInfo(): { top: number } } } };
const scrollTop = (page: import("@playwright/test").Page) =>
  page.evaluate(
    () => (window as unknown as Win).cmb.getCM().getScrollInfo().top
  );

test.describe("switching modes", () => {
  test("keeps the scroll position of the editor", async ({ page }) => {
    const code = Array.from({ length: 200 }, (_, i) => `(f ${i})`).join("\n");
    await openInBlockMode(page, code);
    await page.evaluate(() =>
      (
        window as unknown as {
          cmb: { getCM(): { scrollTo(x: number, y: number): void } };
        }
      ).cmb
        .getCM()
        .scrollTo(0, 1500)
    );
    const before = await scrollTop(page);
    expect(before).toBeGreaterThan(500);
    await page.getByRole("button", { name: /switch to text mode/i }).click();
    await expect.poll(() => scrollTop(page)).toBeGreaterThan(before - 200);
    await page.getByRole("button", { name: /switch to blocks mode/i }).click();
    await expect(page.getByRole("treeitem").first()).toBeVisible();
    await expect.poll(() => scrollTop(page)).toBeGreaterThan(before - 200);
  });
});
