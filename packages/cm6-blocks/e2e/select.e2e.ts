// Fifth round, step 1 in real Chromium: Space selects, Delete / copy / cut / drag use the selection, Cmd-Enter / Ctrl-Enter edits a block as text.
import { test, expect } from "@playwright/test";

/* eslint-disable @typescript-eslint/no-explicit-any */
const EDIT = process.platform === "darwin" ? "Meta+Enter" : "Control+Enter";
const SMALL: Record<string, string> = {
  scheme: "(f 1 (g 2) 3)\n(h 4)\n",
  javascript: "f(1, g(2), 3);\nh(4);\n",
  python: "f(1, g(2), 3)\nh(4)\n",
};
const MULTI: Record<string, string> = {
  scheme: "(define (f x)\n  (+ x 1))\n(f 2)\n",
  javascript: "function f(x) {\n  return x + 1;\n}\nf(2);\n",
  python: "def f(x):\n    y = x + 1\n    return y\nf(2)\n",
};

for (const lang of Object.keys(SMALL)) {
  test.describe(`selection and edit as text: ${lang}`, () => {
    test.beforeEach(async ({ page, context }) => {
      await context
        .grantPermissions(["clipboard-read", "clipboard-write"])
        .catch(() => undefined);
      await page.goto(`/index.html?lang=${lang}`);
      await page.waitForSelector(".cm-content [role=treeitem]");
    });
    const load = (page: any, t: string) =>
      page.evaluate((t: string) => {
        const d = (window as any).demo;
        d.ed.view.dispatch({
          changes: { from: 0, to: d.ed.view.state.doc.length, insert: t },
        });
      }, t);
    const text = (page: any) =>
      page.evaluate(() => (window as any).demo.ed.view.state.doc.toString());
    const lit = (page: any, t: string) =>
      page
        .locator(".cm-content .blocks-literal", {
          hasText: new RegExp(`^${t}$`),
        })
        .first();
    const check = (page: any) =>
      page.evaluate(() => (window as any).demo.check?.() ?? []);

    test("Space selects with a real key press; Delete removes the selected blocks; undo brings them back", async ({
      page,
    }) => {
      await load(page, SMALL[lang]);
      await lit(page, "1").click({ modifiers: ["Shift"] });
      await page.keyboard.press("Space");
      expect(
        await page.locator('.cm-content [aria-selected="true"]').count()
      ).toBe(1);
      await lit(page, "3").click({ modifiers: ["Shift"] });
      await page.keyboard.press("Space");
      expect(
        await page.locator('.cm-content [aria-selected="true"]').count()
      ).toBe(2);
      expect(await page.locator(".cm-content .blocks-selected").count()).toBe(
        2
      );
      // the focused block is `3`: a click did not clear the selection
      await page.keyboard.press("Delete");
      const t = (await text(page)).split("\n")[0];
      expect(t).not.toMatch(/[13]/);
      expect(t).toMatch(/g/);
      expect(
        await page.locator('.cm-content [aria-selected="true"]').count()
      ).toBe(0);
      expect(
        await page.evaluate(
          () => document.activeElement?.closest(".blocks-node") !== null
        )
      ).toBe(true);
      await page.keyboard.press("ControlOrMeta+z");
      expect(await text(page)).toBe(SMALL[lang]);
      expect(await check(page)).toEqual([]);
    });

    test("Escape clears; copy takes the selection in document order", async ({
      page,
    }) => {
      await load(page, SMALL[lang]);
      await lit(page, "3").click({ modifiers: ["Shift"] });
      await page.keyboard.press("Space");
      await lit(page, "1").click({ modifiers: ["Shift"] });
      await page.keyboard.press("Space");
      await page.keyboard.press("ControlOrMeta+c");
      expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
        "1\n3"
      );
      expect(await text(page)).toBe(SMALL[lang]);
      await page.keyboard.press("Escape");
      expect(
        await page.locator('.cm-content [aria-selected="true"]').count()
      ).toBe(0);
    });

    test("a real mouse drag of a selected block moves the whole selection", async ({
      page,
    }) => {
      await load(page, SMALL[lang]);
      await lit(page, "1").click({ modifiers: ["Shift"] });
      await page.keyboard.press("Space");
      await lit(page, "3").click({ modifiers: ["Shift"] });
      await page.keyboard.press("Space");
      const three = lit(page, "3");
      const box = (await three.boundingBox())!;
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(
        box.x + box.width / 2 + 12,
        box.y + box.height / 2 + 3,
        { steps: 3 }
      );
      await page.waitForSelector(".blocks-dragging"); // (the gaps widen when the drag starts: measure after that)
      // drop into h(4) after the 4
      const gap = page
        .locator(
          `.cm-content .blocks-args[data-slot="args"] > .blocks-gap[data-index="1"]`
        )
        .last();
      const g = (await gap.boundingBox())!;
      await page.mouse.move(g.x + g.width / 2, g.y + g.height / 2, {
        steps: 8,
      });
      await page.mouse.up();
      const lines = (await text(page)).split("\n");
      expect(lines[0]).not.toMatch(/[13]/);
      expect(lines[1].replace(/[\s,;()]+/g, " ")).toMatch(/h 4 1 3/);
      await page.keyboard.press("ControlOrMeta+z");
      expect(await text(page)).toBe(SMALL[lang]);
    });

    test(`${EDIT} edits a block as text; Enter commits, Escape cancels`, async ({
      page,
    }) => {
      await load(page, SMALL[lang]);
      await page
        .locator(".cm-content .blocks-node.blocks-literal", { hasText: /^g$/ })
        .first()
        .click({ modifiers: ["Shift"] });
      await page.keyboard.press("ArrowLeft"); // to the call g(2)
      await page.keyboard.press(EDIT);
      const ta = page.locator("textarea.blocks-edit");
      expect(await ta.count()).toBe(1);
      expect(await page.evaluate(() => document.activeElement?.tagName)).toBe(
        "TEXTAREA"
      );
      expect(await ta.inputValue()).toMatch(/^\(?g[( ]2\)$/);
      await page.keyboard.press("Escape");
      expect(await ta.count()).toBe(0);
      expect(await text(page)).toBe(SMALL[lang]);
      await page.keyboard.press(EDIT);
      await page.keyboard.press("ControlOrMeta+a");
      await page.keyboard.type(lang === "scheme" ? "(g 7 8)" : "g(7, 8)");
      await page.keyboard.press("Enter");
      expect(await ta.count()).toBe(0);
      expect((await text(page)).split("\n")[0]).toContain(
        lang === "scheme" ? "(g 7 8)" : "g(7, 8)"
      );
      expect(
        await page.evaluate(
          () => document.activeElement?.closest(".blocks-node") !== null
        )
      ).toBe(true);
      expect(await check(page)).toEqual([]);
      // edited: text that does not parse is refused; see the next test
    });

    // edited: a drop on bare whitespace between top-level blocks writes the block exactly there (as the old editor's drop on whitespace)
    test("a real mouse drag onto a blank line between top-level blocks moves it there as a top-level block; one undo restores", async ({
      page,
    }) => {
      const doc =
        lang === "scheme"
          ? "(f 1)\n\n\n(h 4)\n"
          : lang === "javascript"
            ? "f(1);\n\n\nh(4);\n"
            : "f(1)\n\n\nh(4)\n";
      await load(page, doc);
      const one = lit(page, "1");
      const box = (await one.boundingBox())!;
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2 + 12, box.y + 8, {
        steps: 3,
      });
      await page.waitForSelector(".blocks-dragging");
      const lines = page.locator(".cm-content > .cm-line");
      const blank = (await lines.nth(2).boundingBox())!;
      await page.mouse.move(blank.x + 300, blank.y + blank.height / 2, {
        steps: 8,
      });
      await page.mouse.up();
      // (the 1 left f and stands alone, on the blank line where it was let go)
      const got = (await text(page)).split("\n");
      expect(got[2]).toMatch(/^1;?$/);
      expect(got.join("\n")).not.toContain("1)");
      expect(await check(page)).toEqual([]);
      await page.keyboard.press("ControlOrMeta+z");
      expect(await text(page)).toBe(doc);
    });

    // edited: an edit box refuses text that does not parse (stays open, red); Escape cancels
    test(`${EDIT} refuses text that does not parse; Escape cancels`, async ({
      page,
    }) => {
      await load(page, SMALL[lang]);
      await page
        .locator(".cm-content .blocks-node.blocks-literal", { hasText: /^g$/ })
        .first()
        .click({ modifiers: ["Shift"] });
      await page.keyboard.press("ArrowLeft");
      await page.keyboard.press(EDIT);
      const ta = page.locator("textarea.blocks-edit");
      await page.keyboard.press("ControlOrMeta+a");
      await page.keyboard.type("(((");
      await page.keyboard.press("Enter");
      expect(await ta.count()).toBe(1);
      await expect(ta).toHaveClass(/blocks-error/);
      expect(await text(page)).toBe(SMALL[lang]);
      await page.keyboard.press("Escape");
      expect(await ta.count()).toBe(0);
      expect(await text(page)).toBe(SMALL[lang]);
      expect(await check(page)).toEqual([]);
    });

    test(`${EDIT} on a multi-line block: a textarea as high as the text, Shift+Enter a newline, Enter commits`, async ({
      page,
    }) => {
      await load(page, MULTI[lang]);
      const first = page.locator(".cm-content > .cm-line .blocks-node").first();
      await first.focus();
      await page.keyboard.press(EDIT);
      const ta = page.locator("textarea.blocks-edit");
      const rows = await ta.evaluate((e: HTMLTextAreaElement) => e.rows);
      expect(rows).toBeGreaterThan(1);
      const h = (await ta.boundingBox())!.height;
      expect(h).toBeGreaterThan(30);
      // Shift+Enter at the end adds a line and does not commit
      await page.keyboard.press("ControlOrMeta+End");
      await page.keyboard.press("Shift+Enter");
      expect(await ta.count()).toBe(1);
      expect(await ta.evaluate((e: HTMLTextAreaElement) => e.rows)).toBe(
        rows + 1
      );
      await page.keyboard.press("Backspace");
      await page.keyboard.press("Enter");
      expect(await ta.count()).toBe(0);
      expect(await text(page)).toBe(MULTI[lang]);
      expect(await check(page)).toEqual([]);
    });
  });
}
