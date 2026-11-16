// The keyboard of step 3, exercised with real key presses in Chromium. Writes e2e/keys-results.json.
import { test } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

/* eslint-disable @typescript-eslint/no-explicit-any */
const results: Record<string, Record<string, any>> = {};
const SMALL: Record<string, string> = {
  scheme: "(f 1 (g 2) 3)\n(h 4)\n",
  javascript: "f(1, g(2), 3);\nh(4);\n",
  python: "f(1, g(2), 3)\nh(4)\n",
};

for (const lang of Object.keys(SMALL)) {
  test(`keys: ${lang}`, async ({ page }) => {
    await page.goto(`/index.html?lang=${lang}`);
    await page.waitForSelector(".cm-content .blocks-node");
    await page.evaluate((t) => {
      const d = (window as any).demo;
      d.ed.view.dispatch({ changes: { from: 0, to: d.ed.view.state.doc.length, insert: t } });
    }, SMALL[lang]);
    const text = () => page.evaluate(() => (window as any).demo.ed.view.state.doc.toString());
    const active = () =>
      page.evaluate(() => {
        const a = document.activeElement as HTMLElement | null;
        const n = (window as any).demo.ed.renderer.nodeOf(a);
        return n ? { kind: n.kind, text: (window as any).demo.ed.view.state.doc.sliceString(n.from, n.to) } : null;
      });
    const r: Record<string, any> = {};
    const step = async (name: string, f: () => Promise<any>) => {
      try {
        r[name] = await f();
      } catch (e) {
        r[name] = { error: String(e).slice(0, 120) };
      }
    };
    await step("click_focuses_block", async () => {
      await page.locator(".cm-content .blocks-literal", { hasText: /^1$/ }).first().click();
      return { focused: await active() };
    });
    await step("ArrowDown", async () => { await page.keyboard.press("ArrowDown"); return await active(); });
    await step("ArrowUp", async () => { await page.keyboard.press("ArrowUp"); return await active(); });
    await step("ArrowLeft_to_parent", async () => { await page.keyboard.press("ArrowLeft"); return await active(); });
    await step("ArrowRight_to_first_child", async () => { await page.keyboard.press("ArrowRight"); return await active(); });
    await step("Enter_edit_leaf_commit", async () => {
      await page.locator(".cm-content .blocks-literal", { hasText: /^1$/ }).first().click();
      await page.keyboard.press("Enter");
      const box = await page.locator("input.blocks-edit").count();
      await page.keyboard.type("77");
      await page.keyboard.press("Enter");
      return { boxShown: box, text: await text(), boxGone: (await page.locator("input.blocks-edit").count()) === 0, focused: await active() };
    });
    await step("Escape_cancels", async () => {
      await page.locator(".cm-content .blocks-literal", { hasText: /^77$/ }).first().click();
      await page.keyboard.press("Enter");
      await page.keyboard.type("zz");
      await page.keyboard.press("Escape");
      const t = await text();
      return { unchanged: !t.includes("zz"), focused: await active() };
    });
    await step("CtrlBracket_sibling_after", async () => {
      await page.locator(".cm-content .blocks-literal", { hasText: /^77$/ }).first().click();
      await page.keyboard.press("Control+]");
      const box = await page.locator("input.blocks-edit").count();
      await page.keyboard.type("55");
      await page.keyboard.press("Enter");
      return { boxShown: box, text: await text() };
    });
    await step("Delete", async () => {
      const before = await text();
      await page.locator(".cm-content .blocks-literal", { hasText: /^55$/ }).first().click();
      await page.keyboard.press("Delete");
      const t = await text();
      return { shorter: t.length < before.length, text: t, focused: await active() };
    });
    await step("Backspace", async () => {
      const before = await text();
      await page.locator(".cm-content .blocks-literal", { hasText: /^77$/ }).first().click();
      await page.keyboard.press("Backspace");
      return { shorter: (await text()).length < before.length, text: await text() };
    });
    await step("Undo_Ctrl-Z", async () => {
      const before = await text();
      await page.keyboard.press("Control+z");
      const t1 = await text();
      await page.keyboard.press("Control+Shift+z");
      return { undoChanged: t1 !== before, redoRestored: (await text()) === before, focused: await active() };
    });
    await step("template_if_else_then_type_into_hole", async () => {
      await page.locator(".cm-content .blocks-literal", { hasText: /^f$/ }).first().click();
      await page.locator('button[data-template="if-else"]').click();
      const box = await page.locator("input.blocks-edit").count();
      await page.keyboard.type("cond1");
      await page.keyboard.press("Enter");
      const t = await text();
      return { boxShown: box, hasCond1: t.includes("cond1"), text: t.slice(-80), roots: await page.evaluate(() => (window as any).demo.ed.roots().map((r: any) => r.kind).join(",")) };
    });
    await step("gap_click_box", async () => {
      await page.locator(".cm-content .blocks-gap").nth(1).click({ force: true });
      const box = await page.locator("input.blocks-edit").count();
      await page.keyboard.type("88");
      await page.keyboard.press("Enter");
      return { boxShown: box, has88: (await text()).includes("88") };
    });
    results[lang] = r;
    fs.writeFileSync(path.join(__dirname, "keys-results.json"), JSON.stringify(results, null, 2));
    // eslint-disable-next-line no-console
    console.log(lang, JSON.stringify(r));
  });
}
