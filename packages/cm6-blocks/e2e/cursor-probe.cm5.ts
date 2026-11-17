// Throwaway (thirteenth round, finding 13): where does the existing editor's TEXT CURSOR sit after block focus moves? Run with cm5-ref.config.ts.
import { test } from "@playwright/test";

const PROG = "(f 1 2)\n(g (h 3) 4)\n(define x 5)\n42";
async function open(page: any) {
  await page.goto("/");
  await page.waitForFunction(() => !!(window as any).cmb, { timeout: 20000 });
  await page.evaluate((c: string) => {
    (window as any).cmb.setValue(c);
    (window as any).cmb.clearHistory();
  }, PROG);
  await page.getByRole("button", { name: /switch to blocks mode/i }).click();
  await page.getByRole("treeitem").first().waitFor();
  await page.waitForTimeout(500);
}
const cur = (page: any) =>
  page.evaluate(() => {
    const cm = (window as any).cmb.getCM();
    const api = (window as any).cmb.getCursor();
    const a = cm.getCursor("anchor"),
      h = cm.getCursor("head");
    const fn = (window as any).cmb.getFocusedNode();
    const sel = window.getSelection();
    return {
      api: `${api.line}:${api.ch}`,
      same: cm === (window as any).cmb.getCM(),
      anchor: `${a.line}:${a.ch}`,
      head: `${h.line}:${h.ch}`,
      focused: fn
        ? `${fn.from.line}:${fn.from.ch}-${fn.to.line}:${fn.to.ch} ${fn.type}`
        : null,
      active: (document.activeElement as HTMLElement)?.className
        ?.toString()
        .slice(0, 40),
      domSel: sel
        ? `${sel.anchorNode?.nodeName}/${sel.anchorOffset}-${sel.focusOffset}`
        : null,
      scroll: cm.getScrollInfo().top,
    };
  });
const log: string[] = [];
const rec = async (page: any, what: string) => {
  const l = `${what.padEnd(34)} ${JSON.stringify(await cur(page))}`;
  log.push(l);
  console.log(l);
};

test("cm5 cursor probe", async ({ page }) => {
  page.setDefaultTimeout(4000);
  await open(page);
  await rec(page, "after open (blocks)");
  // a click on the second line's block (g call)
  const roots = page.locator(".react-container > .blocks-node");
  await roots.nth(1).click({ position: { x: 4, y: 4 } });
  await rec(page, "click root 1");
  await page.keyboard.press("ArrowDown");
  await rec(page, "ArrowDown");
  await page.keyboard.press("ArrowDown");
  await rec(page, "ArrowDown");
  await page.keyboard.press("ArrowRight");
  await rec(page, "ArrowRight (into)");
  await page.keyboard.press("ArrowRight");
  await rec(page, "ArrowRight");
  await page.keyboard.press("ArrowUp");
  await rec(page, "ArrowUp");
  await page.keyboard.press("ArrowLeft");
  await rec(page, "ArrowLeft (to parent)");
  await page.keyboard.press("Space");
  await rec(page, "Space (select)");
  await page.keyboard.press("Delete");
  await rec(page, "Delete selected");
  await page.keyboard.press("ControlOrMeta+z");
  await rec(page, "undo");
  await page.keyboard.press("ControlOrMeta+Shift+z");
  await rec(page, "redo");
  await page.keyboard.press("Home");
  await rec(page, "Home");
  await page.keyboard.press("\\");
  await rec(page, "\\ (read ancestors)");
  // cursor set by hand, then a key on a block
  await page.evaluate(() =>
    (window as any).cmb.getCM().setCursor({ line: 3, ch: 1 })
  );
  await rec(page, "setCursor 3:1 by hand");
  await page.keyboard.press("ArrowDown");
  await rec(page, "ArrowDown after setCursor");
  console.log("\n" + log.join("\n"));
});
