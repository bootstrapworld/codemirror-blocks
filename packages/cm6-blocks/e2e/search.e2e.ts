// Eighth round, step 1: search with real key presses in Chromium, in each language.
import { test, expect } from "@playwright/test";

/* eslint-disable @typescript-eslint/no-explicit-any */
const SRC: Record<string, string> = {
  scheme: "(f x)\n(g xy x)\nx\n",
  javascript: "f(x);\ng(xy, x);\nx;\n",
  python: "f(x)\ng(xy, x)\nx\n",
};

for (const lang of Object.keys(SRC)) {
  test.describe(`search: ${lang}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(`/index.html?lang=${lang}`);
      await page.waitForSelector(".cm-content [role=treeitem]");
      await page.evaluate((t) => {
        const d = (window as any).demo;
        d.ed.view.dispatch({
          changes: { from: 0, to: d.ed.view.state.doc.length, insert: t },
        });
        (window as any).heard = [];
        d.ed.options.playSound = (s: string, e: string) =>
          (window as any).heard.push(s + ":" + e);
      }, SRC[lang]);
      // focus the first block with a click on its function name, then Left to its parent... simply click the first literal
      await page
        .locator(".cm-content .blocks-literal", { hasText: /^f$/ })
        .first()
        .click({ modifiers: ["Shift"] });
    });
    const where = (page: any) =>
      page.evaluate(() => {
        const d = (window as any).demo;
        const n = d.ed.focusedNode();
        return n
          ? d.ed.view.state.doc.sliceString(n.from, n.to) + "@" + n.from
          : null;
      });

    test("F3, type, Enter goes to the first match; PageDown, PageUp, wrap, Escape, and focus returns", async ({
      page,
    }) => {
      const heard = () => page.evaluate(() => (window as any).heard);
      await page.keyboard.press("F3");
      const dlg = page.locator(".blocks-search");
      await expect(dlg).toBeVisible();
      expect(
        await page.evaluate(() =>
          document.activeElement?.getAttribute("aria-label")
        )
      ).toBe("Search String");
      await page.keyboard.type("x");
      await page.keyboard.press("Enter");
      await expect(dlg).toHaveCount(0);
      const xs = [...SRC[lang].matchAll(/x/g)].map((m) => m.index!);
      expect(await where(page)).toMatch(new RegExp(`^x@${xs[0]}$`));
      // the focused element is the block itself (the browser's focus, not just the editor's idea of it)
      expect(
        await page.evaluate(() =>
          document.activeElement?.classList.contains("blocks-node")
        )
      ).toBe(true);
      await page.keyboard.press("PageDown");
      expect(await where(page)).toBe(`xy@${xs[1]}`);
      await page.keyboard.press("PageDown");
      await page.keyboard.press("PageDown");
      expect(await where(page)).toMatch(new RegExp(`@${xs[3]}$`));
      expect(await heard()).toEqual([]);
      await page.keyboard.press("PageDown"); // past the last: the first, with the wrap sound
      expect(await where(page)).toMatch(new RegExp(`^x@${xs[0]}$`));
      expect(await heard()).toEqual(["wrap:wrapped"]);
      await page.keyboard.press("PageUp"); // before the first: the last
      expect(await where(page)).toMatch(new RegExp(`@${xs[3]}$`));
      // Escape closes the dialog and the focus is back on the block
      const before = await where(page);
      await page.keyboard.press("F3");
      await expect(dlg).toBeVisible();
      await page.keyboard.type("zz");
      await page.keyboard.press("Escape");
      await expect(dlg).toHaveCount(0);
      expect(await where(page)).toBe(before);
      expect(
        await page.evaluate(() =>
          document.activeElement?.classList.contains("blocks-node")
        )
      ).toBe(true);
      // nothing to find: beep, and stay
      await page.keyboard.press("F3");
      await page.keyboard.type("nothing like it");
      await page.keyboard.press("Enter");
      expect(await where(page)).toBe(before);
      expect((await heard()).pop()).toBe("beep:no-match");
    });

    test("Ctrl-F opens it too, Tab stays inside, Right changes to the block type list, the rotor (Ctrl-F3) and PageDown by type", async ({
      page,
    }) => {
      await page.keyboard.press("Control+f");
      await expect(page.locator(".blocks-search")).toBeVisible();
      for (let i = 0; i < 9; i++) {
        await page.keyboard.press("Tab");
        expect(
          await page.evaluate(
            () => !!document.activeElement?.closest(".blocks-search")
          )
        ).toBe(true);
      }
      await page.locator(".blocks-search [role=tab]").first().focus();
      await page.keyboard.press("ArrowRight");
      expect(
        await page
          .locator(".blocks-search [role=tab][aria-selected=true]")
          .textContent()
      ).toBe("Search by block");
      const options = await page
        .locator(".blocks-search option")
        .allTextContents();
      expect(options).toContain("call");
      await page.locator(".blocks-search select").selectOption("call");
      await page.keyboard.press("Enter");
      expect(
        await page.evaluate(() => (window as any).demo.ed.focusedNode().kind)
      ).toBe("call");
      const a = await where(page);
      await page.keyboard.press("PageDown");
      expect(await where(page)).not.toBe(a);
      // the rotor: Ctrl-F3 says which search it is now
      await page.keyboard.press("Control+F3");
      const said = await page.evaluate(
        () => (window as any).demo.ed.said.slice(-1)[0]
      );
      expect(said).toMatch(/^Searching by .*, \d+ of \d+$/);
    });
  });
}
