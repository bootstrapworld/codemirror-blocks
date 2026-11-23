// Seventh round, step 3: drag a template out of the toolbar into the program (real mouse), in each language; Shift-Tab to the toolbar and Tab back.
import { test, expect } from "@playwright/test";

/* eslint-disable @typescript-eslint/no-explicit-any */
const SMALL: Record<string, string> = {
  scheme: "(f 1 (g 2) 3)\n(h 4)\n",
  javascript: "f(1, g(2), 3);\nh(4);\n",
  python: "f(1, g(2), 3)\nh(4)\n",
};
const TEMPLATE: Record<string, string> = {
  scheme: "number",
  javascript: "number",
  python: "number",
};

for (const lang of Object.keys(SMALL)) {
  test.describe(`toolbar: ${lang}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(`/index.html?lang=${lang}`);
      await page.waitForSelector(".cm-content [role=treeitem]");
      await page.evaluate((t) => {
        const d = (window as any).demo;
        d.ed.view.dispatch({
          changes: { from: 0, to: d.ed.view.state.doc.length, insert: t },
        });
      }, SMALL[lang]);
    });
    const text = (page: any) =>
      page.evaluate(() => (window as any).demo.ed.view.state.doc.toString());

    test("a real mouse drag of a template button onto a gap writes the block there, with its first hole open for typing", async ({
      page,
    }) => {
      const btn = page.locator(
        `#templates button[data-template="${TEMPLATE[lang]}"]`
      );
      const b = (await btn.boundingBox())!;
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
      await page.mouse.down();
      await page.mouse.move(b.x + b.width / 2 + 10, b.y + b.height / 2 + 30, {
        steps: 3,
      });
      await page.waitForSelector(".blocks-dragging"); // (the gaps widen when the drag starts: measure after that)
      const gap = page
        .locator(
          `.cm-content .blocks-args[data-slot="args"] > .blocks-gap[data-index="1"]`
        )
        .first();
      const g = (await gap.boundingBox())!;
      await page.mouse.move(g.x + g.width / 2, g.y + g.height / 2, {
        steps: 8,
      });
      expect(await page.locator(".blocks-drop-target").count()).toBe(1);
      await page.mouse.up();
      expect((await text(page)).split("\n")[0]).toMatch(/1[, ]+0[, ]+[(]?g/);
      expect(await page.locator(".blocks-dragging").count()).toBe(0);
      expect(await page.locator("input.blocks-edit").count()).toBe(1); // (the number's box is open: type its value)
      await page.keyboard.type("77");
      await page.keyboard.press("Enter");
      expect((await text(page)).split("\n")[0]).toMatch(/1[, ]+77[, ]+[(]?g/);
      expect(
        await page.evaluate(() => (window as any).demo.ed.lastError)
      ).toBeNull();
      // one undo takes the block (and its edit) back
      await page.keyboard.press("ControlOrMeta+z");
      await page.keyboard.press("ControlOrMeta+z");
      expect(await text(page)).toBe(SMALL[lang]);
    });

    test("a press on a template button that does not move still inserts after the focused block (the click)", async ({
      page,
    }) => {
      await page
        .locator(".cm-content .blocks-literal", { hasText: /^4$/ })
        .first()
        .click({ modifiers: ["Shift"] });
      await page
        .locator(`#templates button[data-template="${TEMPLATE[lang]}"]`)
        .click();
      expect(await page.locator("input.blocks-edit").count()).toBe(1);
      expect((await text(page)).split("\n").length).toBeGreaterThan(2);
    });

    // edited: bare editor whitespace takes a drop now (the old editor's rule), so "not on a gap or a hole" is let go outside the editor, on the toolbar
    test("a drop that is not on a gap or a hole writes nothing", async ({
      page,
    }) => {
      const btn = page.locator(
        `#templates button[data-template="${TEMPLATE[lang]}"]`
      );
      const b = (await btn.boundingBox())!;
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
      await page.mouse.down();
      await page.mouse.move(b.x + b.width / 2 + 30, b.y + b.height / 2, {
        steps: 6,
      });
      await page.mouse.up();
      expect(await text(page)).toBe(SMALL[lang]);
      expect(await page.locator("input.blocks-edit").count()).toBe(0);
    });
  });
}

test.describe("keyboard: Shift-Tab to the toolbar and Tab back", () => {
  for (const lang of Object.keys(SMALL)) {
    test(`${lang}`, async ({ page }) => {
      await page.goto(`/index.html?lang=${lang}`);
      await page.waitForSelector(".cm-content [role=treeitem]");
      await page.evaluate((t) => {
        const d = (window as any).demo;
        d.ed.view.dispatch({
          changes: { from: 0, to: d.ed.view.state.doc.length, insert: t },
        });
      }, SMALL[lang]);
      await page
        .locator(".cm-content .blocks-literal", { hasText: /^4$/ })
        .first()
        .click({ modifiers: ["Shift"] });
      await page.keyboard.press("Shift+Tab");
      expect(
        await page.evaluate(
          () =>
            document.activeElement?.tagName +
            ":" +
            (document.activeElement as HTMLElement).dataset.template
        )
      ).toMatch(/^BUTTON:/);
      const n = await page.locator("#templates button").count();
      for (let i = 1; i < n; i++) await page.keyboard.press("Tab"); // (through the buttons)
      await page.keyboard.press("Tab"); // (past the last: back in the editor, on the block that had the focus)
      expect(
        await page.evaluate(() =>
          (document.activeElement as HTMLElement).getAttribute("aria-label")
        )
      ).toMatch(/4/);
    });
  }
});

test("the help dialog opens with Shift-Ctrl-/ in a real browser, lists the keys, and Escape gives the focus back", async ({
  page,
}) => {
  await page.goto(`/index.html?lang=scheme`);
  await page.waitForSelector(".cm-content [role=treeitem]");
  await page
    .locator(".cm-content .blocks-literal")
    .first()
    .click({ modifiers: ["Shift"] });
  const focused = await page.evaluate(() => document.activeElement?.id);
  await page.keyboard.press("Control+Shift+Slash");
  await expect(page.locator(".blocks-help")).toBeVisible();
  expect(await page.locator(".blocks-help tr").count()).toBeGreaterThan(20);
  expect(
    await page.evaluate(() => document.activeElement?.className)
  ).toContain("closeDialog");
  await page.keyboard.press("Escape");
  await expect(page.locator(".blocks-help")).toHaveCount(0);
  expect(await page.evaluate(() => document.activeElement?.id)).toBe(focused);
  await page.screenshot({ path: "packages/cm6-blocks/e2e/screens/help.png" });
});
