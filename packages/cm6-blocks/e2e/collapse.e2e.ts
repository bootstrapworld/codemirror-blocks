// Sixth round, step 2 in real Chromium: collapse and expand with real keys; the inside of a collapsed block is not drawn and not reachable.
import { test, expect } from "@playwright/test";

/* eslint-disable @typescript-eslint/no-explicit-any */
const SMALL: Record<string, string> = {
  scheme: "(f 1 (g 2) 3)\n(h 4)\n",
  javascript: "f(1, g(2), 3);\nh(4);\n",
  python: "f(1, g(2), 3)\nh(4)\n",
};
for (const lang of Object.keys(SMALL)) {
  test(`collapse and expand: ${lang}`, async ({ page }) => {
    await page.goto(`/index.html?lang=${lang}`);
    await page.waitForSelector(".cm-content .blocks-node");
    await page.evaluate((t: string) => {
      const d = (window as any).demo;
      d.ed.view.dispatch({ changes: { from: 0, to: d.ed.view.state.doc.length, insert: t } });
    }, SMALL[lang]);
    const two = page.locator(".cm-content .blocks-literal", { hasText: /^2$/ }).first();
    const lit1 = page.locator(".cm-content .blocks-literal", { hasText: /^1$/ }).first();
    const lit3 = page.locator(".cm-content .blocks-literal", { hasText: /^3$/ }).first();
    await two.click({ modifiers: ["Shift"] });
    await page.keyboard.press("ArrowLeft"); // the 2 is a leaf: focus goes to the call g(2)
    await page.keyboard.press("ArrowLeft"); // collapses it
    const call = page.locator('.cm-content [aria-expanded="false"]');
    await expect(call).toHaveCount(1);
    expect(await two.isVisible()).toBe(false);
    expect(await page.evaluate(() => (window as any).demo.ed.view.state.doc.toString())).toBe(SMALL[lang]);
    // Up from 3 lands on the collapsed block, not on 2
    await lit3.click({ modifiers: ["Shift"] });
    await page.keyboard.press("ArrowUp");
    expect(await page.evaluate(() => document.activeElement?.getAttribute("aria-expanded"))).toBe("false");
    await page.keyboard.press("ArrowRight"); // expands
    await expect(page.locator('.cm-content [aria-expanded="false"]')).toHaveCount(0);
    expect(await two.isVisible()).toBe(true);
    // Shift-ArrowLeft collapses everything; Shift-ArrowRight expands everything
    await lit1.click({ modifiers: ["Shift"] });
    await page.keyboard.press("Shift+ArrowLeft");
    expect(await page.locator('.cm-content [aria-expanded="false"]').count()).toBeGreaterThan(2);
    expect(await lit1.isVisible()).toBe(false);
    await page.keyboard.press("Shift+ArrowRight");
    await expect(page.locator('.cm-content [aria-expanded="false"]')).toHaveCount(0);
    expect(await lit1.isVisible()).toBe(true);
    expect(await page.evaluate(() => (window as any).demo.check?.() ?? [])).toEqual([]);
  });
}
