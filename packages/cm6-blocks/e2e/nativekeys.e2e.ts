// Twelfth round, difference 10: Ctrl-Enter and Ctrl-X with the focus in the text and no block focused. The old editor's handler returns for both
// (CodeMirror 5 has no binding for Ctrl-Enter; Ctrl-X is its native cut, of the line when nothing is selected); here the same, with real keys.
import { test, expect } from "@playwright/test";

/* eslint-disable @typescript-eslint/no-explicit-any */
const SRC: Record<string, string> = {
  scheme: "(f x y)\n\n99\n",
  javascript: "f(x, y);\n\n99;\n",
  python: "f(x, y)\n\n99\n",
};
const MOD = process.platform === "darwin" ? "Meta" : "Control";

for (const lang of Object.keys(SRC)) {
  test.describe(`native keys in the text: ${lang}`, () => {
    test.beforeEach(async ({ page, context }) => {
      await context
        .grantPermissions(["clipboard-read", "clipboard-write"])
        .catch(() => {});
      await page.goto(`/index.html?lang=${lang}`);
      await page.waitForSelector(".cm-content .blocks-node");
      await page.evaluate((t) => {
        const d = (window as any).demo;
        d.ed.view.dispatch({
          changes: { from: 0, to: d.ed.view.state.doc.length, insert: t },
        });
        d.ed.view.dispatch({
          selection: { anchor: d.ed.view.state.doc.length },
        });
        d.ed.view.contentDOM.focus();
      }, SRC[lang]);
    });
    const text = (page: any) =>
      page.evaluate(() => (window as any).demo.ed.view.state.doc.toString());
    test("Mod-Enter does nothing, plain Enter still inserts a line", async ({
      page,
    }) => {
      expect(
        await page.evaluate(() => (window as any).demo.ed.focusedNode())
      ).toBeFalsy();
      await page.keyboard.press(`${MOD}+Enter`);
      expect(await text(page)).toBe(SRC[lang]);
      await page.keyboard.press("Enter");
      expect(await text(page)).toBe(SRC[lang] + "\n");
    });
    test("Mod-X cuts the line, as the native cut does (the blocks layer leaves it alone); one undo brings it back", async ({
      page,
    }) => {
      await page.evaluate(() =>
        (window as any).demo.ed.view.dispatch({ selection: { anchor: 0 } })
      );
      await page.keyboard.press(`${MOD}+x`);
      expect(await text(page)).toBe(SRC[lang].split("\n").slice(1).join("\n"));
      await page.keyboard.press(`${MOD}+z`);
      expect(await text(page)).toBe(SRC[lang]);
    });
    test("F3 from the text opens the search dialog; Escape gives the focus back to the text, PageDown from the text goes to a match", async ({
      page,
    }) => {
      await page.evaluate(() =>
        (window as any).demo.ed.view.dispatch({ selection: { anchor: 0 } })
      );
      await page.keyboard.press("F3");
      await expect(page.locator(".blocks-search")).toBeVisible();
      await page.keyboard.type("99");
      await page.keyboard.press("Escape");
      await expect(page.locator(".blocks-search")).toHaveCount(0);
      expect(
        await page.evaluate(
          () =>
            !!document.activeElement?.closest(".cm-content") &&
            !document.activeElement?.classList.contains("blocks-node")
        )
      ).toBe(true);
      await page.keyboard.press("PageDown");
      expect(
        await page.evaluate(() => {
          const d = (window as any).demo.ed;
          const n = d.focusedNode();
          return n && d.view.state.doc.sliceString(n.from, n.to);
        })
      ).toBe("99");
    });
  });
}
