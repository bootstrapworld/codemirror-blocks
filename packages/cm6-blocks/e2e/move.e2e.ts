// Fourth round, step 4 in real Chromium: copy, cut and paste with the keyboard, and a real mouse drag, in each language.
import { test, expect } from "@playwright/test";

/* eslint-disable @typescript-eslint/no-explicit-any */
const SMALL: Record<string, string> = {
  scheme: "(f 1 (g 2) 3)\n(h 4)\n",
  javascript: "f(1, g(2), 3);\nh(4);\n",
  python: "f(1, g(2), 3)\nh(4)\n",
};

for (const lang of Object.keys(SMALL)) {
  test.describe(`moving blocks: ${lang}`, () => {
    test.beforeEach(async ({ page, context }) => {
      await context
        .grantPermissions(["clipboard-read", "clipboard-write"])
        .catch(() => undefined);
      await page.goto(`/index.html?lang=${lang}`);
      await page.waitForSelector(".cm-content .blocks-node");
      await page.evaluate((t) => {
        const d = (window as any).demo;
        d.ed.view.dispatch({
          changes: { from: 0, to: d.ed.view.state.doc.length, insert: t },
        });
      }, SMALL[lang]);
    });
    const text = (page: any) =>
      page.evaluate(() => (window as any).demo.ed.view.state.doc.toString());
    const focusedText = (page: any) =>
      page.evaluate(() => {
        const a = document.activeElement as HTMLElement | null;
        const n = (window as any).demo.ed.renderer.nodeOf(a);
        return n
          ? (window as any).demo.ed.view.state.doc.sliceString(n.from, n.to)
          : null;
      });

    test("ControlOrMeta+c, +x, +v", async ({ page }) => {
      await page
        .locator(".cm-content .blocks-literal", { hasText: /^3$/ })
        .first()
        .click({ modifiers: ["Shift"] });
      await page.keyboard.press("ControlOrMeta+c");
      expect(await text(page)).toBe(SMALL[lang]); // copy changes nothing
      expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
        "3"
      );
      // cut with nothing selected does nothing (thirteenth round: it beeps and says so)
      await page.keyboard.press("ControlOrMeta+x");
      expect(await text(page)).toBe(SMALL[lang]);
      // select it (Space), cut it, then paste after the 1
      await page.keyboard.press("Space");
      await page.keyboard.press("ControlOrMeta+x");
      expect(await text(page)).not.toMatch(/3/);
      await page
        .locator(".cm-content .blocks-literal", { hasText: /^1$/ })
        .first()
        .click({ modifiers: ["Shift"] });
      await page.keyboard.press("ControlOrMeta+v");
      expect(await text(page)).toMatch(/1[, ]+3/);
      expect(await focusedText(page)).toBe("3");
      // one undo takes the paste back, the next the cut
      await page.keyboard.press("ControlOrMeta+z");
      expect(await text(page)).not.toMatch(/3/);
      await page.keyboard.press("ControlOrMeta+z");
      expect(await text(page)).toBe(SMALL[lang]);
    });

    test("paste over a selected block replaces it (thirteenth round), one undo step brings it back", async ({
      page,
    }) => {
      const lit = (t: string) =>
        page
          .locator(".cm-content .blocks-literal", {
            hasText: new RegExp(`^${t}$`),
          })
          .first();
      await lit("3").click({ modifiers: ["Shift"] });
      await page.keyboard.press("ControlOrMeta+c");
      await lit("1").click({ modifiers: ["Shift"] });
      await page.keyboard.press("Space");
      await page.keyboard.press("ControlOrMeta+v");
      expect(await text(page)).toBe(SMALL[lang].replace("1", "3"));
      expect(await focusedText(page)).toBe("3");
      expect(
        await page.evaluate(
          () => (window as any).demo.ed.selectedBlocks().length
        )
      ).toBe(0);
      await page.keyboard.press("ControlOrMeta+z");
      expect(await text(page)).toBe(SMALL[lang]);
    });

    test("a real mouse drag moves a block onto a gap", async ({ page }) => {
      const three = page
        .locator(".cm-content .blocks-literal", { hasText: /^3$/ })
        .first();
      const box = (await three.boundingBox())!;
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(
        box.x + box.width / 2 + 12,
        box.y + box.height / 2 + 3,
        { steps: 3 }
      );
      await page.waitForSelector(".blocks-dragging"); // (the gaps widen when the drag starts: measure after that)
      const gap = page
        .locator(
          `.cm-content .blocks-args[data-slot="args"] > .blocks-gap[data-index="0"]`
        )
        .first();
      const g = (await gap.boundingBox())!;
      await page.mouse.move(g.x + g.width / 2, g.y + g.height / 2, {
        steps: 8,
      });
      expect(await page.locator(".blocks-drop-target").count()).toBe(1);
      await page.mouse.up();
      expect((await text(page)).split("\n")[0]).toMatch(/3[, ]+1/);
      expect(await page.locator(".blocks-dragging").count()).toBe(0);
      expect(await focusedText(page)).toBe("3");
      expect(
        await page.evaluate(() => (window as any).demo.ed.lastError)
      ).toBeNull();
      await page.keyboard.press("ControlOrMeta+z");
      expect(await text(page)).toBe(SMALL[lang]);
    });
  });
}
