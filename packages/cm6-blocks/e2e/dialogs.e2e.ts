// Eleventh round, difference 9: a dialog hides the rest of the page from screen readers and the keyboard, keeps focus inside, and puts
// everything back. Checked with Chromium's accessibility tree (Playwright's aria snapshot): with a dialog open the editor's blocks are not
// in the tree and the dialog is; after it closes the tree equals the one from before.
import { test, expect } from "@playwright/test";

/* eslint-disable @typescript-eslint/no-explicit-any */
const SRC: Record<string, string> = { scheme: "(f x)\n(g xy x)\n", javascript: "f(x);\ng(xy, x);\n", python: "f(x)\ng(xy, x)\n" };

for (const lang of Object.keys(SRC)) {
  test.describe(`dialogs hide the page: ${lang}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(`/index.html?lang=${lang}`);
      await page.waitForSelector(".cm-content .blocks-node");
      await page.evaluate((t) => {
        const d = (window as any).demo;
        d.ed.view.dispatch({ changes: { from: 0, to: d.ed.view.state.doc.length, insert: t } });
      }, SRC[lang]);
      await page.locator(".cm-content .blocks-literal", { hasText: /^f$/ }).first().click({ modifiers: ["Shift"] });
    });
    const tree = (page: any) => page.locator("body").ariaSnapshot();
    const attrs = (page: any) =>
      page.evaluate(() => [...document.querySelectorAll("body *")].map((e) => `${e.tagName}.${e.className}:${e.getAttribute("aria-hidden")}:${e.getAttribute("inert")}`).join("\n"));
    const focusedText = (page: any) =>
      page.evaluate(() => {
        const d = (window as any).demo;
        const n = d.ed.focusedNode();
        return n ? d.ed.view.state.doc.sliceString(n.from, n.to) : document.activeElement?.tagName;
      });

    for (const [name, open, title] of [
      ["search", "F3", "Search Settings"],
      ["help", "Control+Shift+/", "Keyboard Shortcuts"],
    ] as const) {
      test(`${name}: blocks leave the accessibility tree, the dialog is in it, closing restores it exactly`, async ({ page }) => {
        const before = await tree(page);
        const domBefore = await attrs(page);
        expect(before).toMatch(/treeitem/); // the blocks are there
        await page.keyboard.press(open);
        await expect(page.locator(".blocks-help")).toBeVisible();
        const during = await tree(page);
        expect(during).toContain(title);
        expect(during).not.toMatch(/treeitem/);
        expect(during).not.toMatch(/symbol x|call to f/);
        expect(await page.locator(".cm-editor").getAttribute("aria-hidden")).toBe("true");
        expect(await page.locator(".blocks-help").getAttribute("aria-modal")).toBe("true");
        // focus is trapped: many Tabs and it is still in the dialog
        for (let i = 0; i < 12; i++) await page.keyboard.press("Tab");
        expect(await page.evaluate(() => !!document.activeElement?.closest(".blocks-help"))).toBe(true);
        for (let i = 0; i < 5; i++) await page.keyboard.press("Shift+Tab");
        expect(await page.evaluate(() => !!document.activeElement?.closest(".blocks-help"))).toBe(true);
        // a click on the hidden editor does not take the focus out either
        await page.locator(".cm-content").click({ position: { x: 5, y: 5 }, force: true }).catch(() => {});
        await page.waitForTimeout(100); // (the focus is put back a tick after the click took it)
        expect(await page.evaluate(() => !!document.activeElement?.closest(".blocks-help"))).toBe(true);
        await page.keyboard.press("Escape");
        await expect(page.locator(".blocks-help")).toHaveCount(0);
        expect(await tree(page)).toBe(before);
        expect(await attrs(page)).toBe(domBefore);
        expect(await focusedText(page)).toBe("f");
        expect(await page.evaluate(() => document.activeElement?.classList.contains("blocks-node"))).toBe(true);
      });
      test(`${name}: opened and closed twice, and closed by its Close button`, async ({ page }) => {
        const before = await tree(page);
        const domBefore = await attrs(page);
        for (let i = 0; i < 2; i++) {
          await page.keyboard.press(open);
          await expect(page.locator(".blocks-help")).toBeVisible();
          if (i === 0) await page.keyboard.press("Escape");
          else await page.locator(".blocks-help .closeDialog").click();
          await expect(page.locator(".blocks-help")).toHaveCount(0);
          expect(await attrs(page)).toBe(domBefore);
        }
        expect(await tree(page)).toBe(before);
        expect(await focusedText(page)).toBe("f");
      });
    }
  });
}
