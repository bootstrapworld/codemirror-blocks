import { test, expect } from "@playwright/test";

for (const lang of ["scheme", "javascript", "python"]) {
  test(`the demo draws blocks: ${lang}`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    await page.goto(`/index.html?lang=${lang}&constructs=1`);
    await page.waitForSelector(".cm-content [role=treeitem]");
    expect(
      await page.locator(".cm-content > .cm-line > .blocks-node").count()
    ).toBeGreaterThan(3);
    await page.screenshot({
      path: `packages/cm6-blocks/e2e/screens/${lang}.png`,
    });
    expect(errors).toEqual([]);
  });
}

// the toolbar with a template just inserted (JavaScript): the new block is in its first hole's edit box
test("screenshot: the toolbar with a template just inserted", async ({
  page,
}) => {
  await page.goto(`/index.html?lang=javascript&constructs=1`);
  await page.waitForSelector(".cm-content [role=treeitem]");
  await page
    .locator(".cm-content [role=treeitem] .blocks-literal")
    .first()
    .click({ modifiers: ["Shift"] });
  await page.locator('#templates button[data-template="if-else"]').click();
  await page.waitForSelector("input.blocks-edit");
  await page.screenshot({
    path: `packages/cm6-blocks/e2e/screens/toolbar-template.png`,
  });
  expect(await page.locator("input.blocks-edit").count()).toBe(1);
});
