// Eighteenth round: edit boxes refuse text that does not parse (the old editor's rule), with real keys in Chromium.
import { test, expect } from "@playwright/test";

/* eslint-disable @typescript-eslint/no-explicit-any */
const START: Record<string, string> = {
  scheme: "(f 1)\n(g 2)",
  javascript: "f(1);\ng(2);",
  python: "f(1)\ng(2)",
};
const GOOD: Record<string, string> = {
  scheme: "(h 3)",
  javascript: "h(3);",
  python: "h(3)",
};
const BAD: Record<string, string> = {
  scheme: "(h 3",
  javascript: "h(3;",
  python: "h(3",
};

for (const lang of Object.keys(START)) {
  test(`an insertion box refuses text that does not parse: ${lang}`, async ({
    page,
  }) => {
    await page.goto(`/index.html?lang=${lang}`);
    await page.waitForSelector(".cm-content [role=treeitem]");
    const text = () =>
      page.evaluate(() => (window as any).demo.ed.view.state.doc.toString());
    await page.evaluate((t) => {
      const d = (window as any).demo;
      d.ed.view.dispatch({
        changes: { from: 0, to: d.ed.view.state.doc.length, insert: t },
      });
    }, START[lang]);
    await page.evaluate(() => {
      const d = (window as any).demo;
      d.ed.focusNode(d.ed.roots()[0]);
    });
    await page.keyboard.press("Control+]");
    const box = page.locator("input.blocks-edit");
    await expect(box).toBeFocused();
    await page.keyboard.type(BAD[lang]);
    await page.keyboard.press("Enter");
    await expect(box).toHaveClass(/blocks-error/);
    await expect(box).toHaveAttribute("aria-invalid", "true");
    expect(await box.getAttribute("title")).toBeTruthy();
    await expect(box).toBeFocused();
    expect(await text()).toBe(START[lang]);
    // the red clears when the text is edited; a good text commits
    await box.fill("");
    await page.keyboard.type(GOOD[lang]);
    await expect(box).not.toHaveClass(/blocks-error/);
    await page.keyboard.press("Enter");
    await expect(box).toHaveCount(0);
    expect(await text()).toContain(GOOD[lang]);
  });
}

for (const lang of Object.keys(START)) {
  test(`typing at the top level goes into a pending box: ${lang}`, async ({
    page,
  }) => {
    await page.goto(`/index.html?lang=${lang}`);
    await page.waitForSelector(".cm-content [role=treeitem]");
    const text = () =>
      page.evaluate(() => (window as any).demo.ed.view.state.doc.toString());
    await page.evaluate((t) => {
      const d = (window as any).demo;
      d.ed.view.dispatch({
        changes: { from: 0, to: d.ed.view.state.doc.length, insert: t },
      });
      d.ed.view.dispatch({ selection: { anchor: d.ed.view.state.doc.length } });
      d.ed.view.focus();
    }, START[lang]);
    await page.keyboard.type(BAD[lang][0]);
    const box = page.locator(".blocks-pending .blocks-edit");
    await expect(box).toBeFocused();
    expect(await text()).toBe(START[lang]);
    await page.keyboard.type(BAD[lang].slice(1));
    await page.keyboard.press("Enter");
    await expect(box).toHaveClass(/blocks-error/);
    expect(await box.getAttribute("title")).toBeTruthy();
    expect(await text()).toBe(START[lang]);
    await box.fill("");
    await page.keyboard.type(GOOD[lang]);
    await page.keyboard.press("Enter");
    await expect(box).toHaveCount(0);
    expect(await text()).toContain(GOOD[lang]);
    // one undo step takes it away again
    await page.keyboard.press("Control+z");
    expect(await text()).toBe(START[lang]);
  });
}
