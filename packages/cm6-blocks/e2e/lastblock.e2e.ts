// Tenth round, difference 5: when the last block goes, focus goes to the editor itself, never to document.body. Real keys in
// Chromium; focusin and focusout events, mutations of the editor and every animation frame are checked for an active element that is the body.
import { test, expect } from "@playwright/test";

/* eslint-disable @typescript-eslint/no-explicit-any */
const ONE: Record<string, string> = {
  scheme: "42",
  javascript: "f(1);",
  python: "f(1)",
};

for (const lang of Object.keys(ONE)) {
  test.describe(`the last block goes: ${lang}`, () => {
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
        // everything that could show a moment without focus: events, mutations of the editor, frames
        const w = window as any;
        w.__bodyMoments = [];
        const check = (where: string) => {
          if (
            document.activeElement === document.body ||
            !document.activeElement
          )
            w.__bodyMoments.push(where);
        };
        w.__lastCheck = check;
        // (a focusout while a block is being removed: the body is active only when the browser has nothing else to give it, so the
        // events that matter are the ones after the edit: focusin, mutations, frames)
        document.addEventListener("focusin", () => check("focusin"), true);
        new MutationObserver(() => check("mutation")).observe(d.ed.view.dom, {
          childList: true,
          subtree: true,
        });
        const tick = () => {
          check("frame");
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
        w.__watch = false;
      }, ONE[lang]);
    });
    const text = (page: any) =>
      page.evaluate(() => (window as any).demo.ed.view.state.doc.toString());
    const noBody = async (page: any) => {
      await page.waitForTimeout(200);
      const r = await page.evaluate(() => ({
        moments: (window as any).__bodyMoments as string[],
        inEditor:
          !!document.activeElement &&
          (window as any).demo.ed.view.dom.contains(document.activeElement),
        active: document.activeElement?.tagName,
      }));
      expect(r.active).not.toBe("BODY");
      expect(r.inEditor).toBe(true);
      return r.moments;
    };
    // (the top-level block gets the focus the way a key does it; what follows is real keys)
    const focusBlock = (page: any) =>
      page.evaluate(() =>
        (window as any).demo.ed.focusNode((window as any).demo.ed.roots()[0])
      );

    test("Delete", async ({ page }) => {
      await focusBlock(page);
      await page.evaluate(() => ((window as any).__bodyMoments = []));
      await page.keyboard.press("Space");
      await page.keyboard.press("Delete");
      expect((await text(page)).trim()).toBe("");
      expect(await noBody(page)).toEqual([]);
    });
    test("cut", async ({ page }) => {
      await focusBlock(page);
      await page.evaluate(() => ((window as any).__bodyMoments = []));
      await page.keyboard.press("Space");
      await page.keyboard.press("ControlOrMeta+x");
      expect((await text(page)).trim()).toBe("");
      expect(await noBody(page)).toEqual([]);
    });
    test("undo of an insert into an empty document", async ({ page }) => {
      await page.evaluate(() => {
        const d = (window as any).demo;
        d.ed.view.dispatch({
          changes: { from: 0, to: d.ed.view.state.doc.length, insert: "" },
        });
      });
      await page.evaluate((t) => {
        const d = (window as any).demo;
        d.ed.insertText(d.ed.doc.program.slots[0], 0, t);
      }, ONE[lang]);
      await focusBlock(page);
      await page.evaluate(() => ((window as any).__bodyMoments = []));
      await page.keyboard.press("ControlOrMeta+z");
      expect((await text(page)).trim()).toBe("");
      expect(await noBody(page)).toEqual([]);
    });
    test("a text change that empties the document under a focused block", async ({
      page,
    }) => {
      await focusBlock(page);
      await page.evaluate(() => ((window as any).__bodyMoments = []));
      await page.evaluate(() => {
        const d = (window as any).demo;
        d.ed.view.dispatch({
          changes: { from: 0, to: d.ed.view.state.doc.length, insert: "" },
        });
      });
      expect(await noBody(page)).toEqual([]);
    });
  });
}
