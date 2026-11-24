// Forty-fourth round: an error nobody caught, soon after the editor was used, shows the notice with its report form; the error is NOT swallowed (the page
// still sees it as an uncaught error), the form shows the report to copy, and nothing is sent over the network.
import { test, expect } from "@playwright/test";

for (const lang of ["scheme", "javascript", "python"]) {
  test(`uncaught error notice and report form: ${lang}`, async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (e) => pageErrors.push(e.message));
    const requests: string[] = [];
    page.on("request", (r) => requests.push(r.url()));
    await page.goto(`/index.html?lang=${lang}`);
    await page.waitForSelector(".cm-content [role=treeitem]");
    // (something done to the editor: a key on a block)
    await page.locator(".cm-content [role=treeitem]").first().focus();
    await page.keyboard.press("ArrowDown");
    const before = requests.length;
    await page.evaluate(() => {
      setTimeout(() => {
        throw new Error("late failure");
      }, 0);
    });
    const notice = page.locator(".blocks-error-notice");
    await expect(notice).toBeVisible();
    await expect(notice).toContainText("Something went wrong: late failure");
    expect(pageErrors).toContain("late failure");
    await notice.getByRole("button", { name: "Report this problem" }).click();
    const text = await notice.locator("textarea").inputValue();
    expect(text).toContain("late failure");
    expect(text).toContain("cmb-report");
    await expect(notice.getByRole("button", { name: "Send" })).toHaveCount(0);
    await notice.getByRole("button", { name: "Close" }).click();
    await expect(notice).toHaveCount(0);
    expect(requests.length).toBe(before);
    // (an error long after any use is none of the editor's business)
    await page.waitForTimeout(2200);
    await page.evaluate(() => {
      setTimeout(() => {
        throw new Error("someone else's");
      }, 0);
    });
    await page.waitForTimeout(200);
    await expect(notice).toHaveCount(0);
    expect(pageErrors).toContain("someone else's");
  });
}
