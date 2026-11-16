// Sixth round, step 3 in real Chromium: a click on a literal opens its edit box; a drag does not; a click on a compound block only focuses it.
import { test, expect } from "@playwright/test";

/* eslint-disable @typescript-eslint/no-explicit-any */
const SMALL: Record<string, string> = {
  scheme: "(f 1 (g 2) 3)\n(h 4)\n",
  javascript: "f(1, g(2), 3);\nh(4);\n",
  python: "f(1, g(2), 3)\nh(4)\n",
};
for (const lang of Object.keys(SMALL)) {
  test(`click edits a literal: ${lang}`, async ({ page }) => {
    await page.goto(`/index.html?lang=${lang}`);
    await page.waitForSelector(".cm-content .blocks-node");
    await page.evaluate((t: string) => {
      const d = (window as any).demo;
      d.ed.view.dispatch({ changes: { from: 0, to: d.ed.view.state.doc.length, insert: t } });
    }, SMALL[lang]);
    const lit = (t: string) => page.locator(".cm-content .blocks-literal", { hasText: new RegExp(`^${t}$`) }).first();
    await lit("2").click();
    await expect(page.locator(".cm-content input.blocks-edit")).toHaveCount(1);
    await page.keyboard.type("25");
    await page.keyboard.press("Enter");
    expect(await page.evaluate(() => (window as any).demo.ed.view.state.doc.toString())).toContain("25");
    // the box is closed; a click on the focused literal opens it again; Escape closes it
    await lit("25").click();
    await expect(page.locator(".cm-content input.blocks-edit")).toHaveCount(1);
    await page.keyboard.press("Escape");
    await expect(page.locator(".cm-content input.blocks-edit")).toHaveCount(0);
    // a real mouse drag is not an edit
    const a = (await lit("3").boundingBox())!;
    await page.mouse.move(a.x + 2, a.y + 2);
    await page.mouse.down();
    await page.mouse.move(a.x + 60, a.y + 2, { steps: 5 });
    await page.mouse.up();
    await expect(page.locator(".cm-content input.blocks-edit")).toHaveCount(0);
    expect(await page.evaluate(() => (window as any).demo.check?.() ?? [])).toEqual([]);
  });
}

// Sixth round, step 4 in real Chromium: Shift-Ctrl-] edits the comment of the focused block.
const PRE: Record<string, string> = { scheme: ";", javascript: "//", python: "#" };
for (const lang of Object.keys(SMALL)) {
  test(`comment of a block: ${lang}`, async ({ page }) => {
    await page.goto(`/index.html?lang=${lang}`);
    await page.waitForSelector(".cm-content .blocks-node");
    await page.evaluate((t: string) => {
      const d = (window as any).demo;
      d.ed.view.dispatch({ changes: { from: 0, to: d.ed.view.state.doc.length, insert: t } });
    }, SMALL[lang]);
    await page.locator(".cm-content .blocks-literal", { hasText: /^4$/ }).first().click({ modifiers: ["Shift"] });
    await page.keyboard.press("Control+Shift+BracketRight");
    await expect(page.locator(".cm-content input.blocks-edit")).toHaveCount(1);
    await page.keyboard.type("the h call");
    await page.keyboard.press("Enter");
    const t = await page.evaluate(() => (window as any).demo.ed.view.state.doc.toString());
    expect(t).toContain(`${PRE[lang]} the h call\n`);
    await expect(page.locator('.cm-content [data-comment="the h call"]')).toHaveCount(1);
    expect(await page.locator('.cm-content [data-comment="the h call"]').first().getAttribute("aria-label")).toContain("with comment: the h call");
    expect(await page.evaluate(() => (window as any).demo.check?.() ?? [])).toEqual([]);
  });
}
