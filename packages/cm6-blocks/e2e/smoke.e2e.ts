import { test, expect } from "@playwright/test";

for (const lang of ["scheme", "javascript", "python"]) {
  test(`the demo draws blocks: ${lang}`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    await page.goto(`/index.html?lang=${lang}&constructs=1`);
    await page.waitForSelector(".cm-content .blocks-node");
    expect(await page.locator(".cm-content > .cm-line > .blocks-node").count()).toBeGreaterThan(3);
    await page.screenshot({ path: `packages/cm6-blocks/e2e/screens/${lang}.png` });
    expect(errors).toEqual([]);
  });
}
