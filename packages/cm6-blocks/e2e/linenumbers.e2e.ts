// Line numbers (CodeMirror 6's own `lineNumbers()`, on in the demo): each gutter element must sit beside the first block of its line, in block mode and in text mode, for a multi-line block, a collapsed block, a comment and an open top-level edit.
import { test, expect, Page } from "@playwright/test";
import * as path from "path";

/* eslint-disable @typescript-eslint/no-explicit-any */
const DOCS: Record<string, string> = {
  scheme:
    "(f 1\n   (g 2\n      3)\n   4)\n; a comment\n(h (i 5\n      6))\n(k 7)\n",
  javascript:
    "f(1,\n  g(2,\n    3),\n  4);\n// a comment\nh(i(5,\n    6));\nk(7);\n",
  python: "f(1,\n  g(2,\n    3),\n  4)\n# a comment\nh(i(5,\n    6))\nk(7)\n",
};

/** per document line: the gutter element's vertical box and the box of what is drawn on the line (the line's first block, else the line) */
const measure = (page: Page) =>
  page.evaluate(() => {
    const ed = (window as any).demo.ed;
    const view = ed.view;
    const els = Array.from(
      view.dom.querySelectorAll(".cm-lineNumbers .cm-gutterElement")
    ) as HTMLElement[];
    const rows = els
      .filter((e) => /^\d+$/.test(e.textContent ?? "") && e.offsetHeight > 0)
      .map((e) => {
        const n = Number(e.textContent);
        const g = e.getBoundingClientRect();
        const line = view.state.doc.line(n);
        const dom = view.domAtPos(line.from);
        const lineEl = (
          dom.node.nodeType === 3 ? dom.node.parentElement : dom.node
        ).closest(".cm-line") as HTMLElement | null;
        const first = lineEl?.querySelector(
          ".blocks-node, .blocks-comment, .blocks-edit"
        ) as HTMLElement | null;
        const box = (first ?? lineEl)?.getBoundingClientRect();
        return {
          n,
          gutterTop: g.top,
          gutterH: g.height,
          topOfLine: box?.top ?? null,
          h: box?.height ?? null,
        };
      });
    return { rows, gutters: !!view.dom.querySelector(".cm-gutters") };
  });

async function check(page: Page, what: string) {
  const m = await measure(page);
  expect(m.gutters, `${what}: gutter shown`).toBe(true);
  expect(m.rows.length, `${what}: some numbers`).toBeGreaterThan(0);
  for (const r of m.rows) {
    if (r.topOfLine === null) continue;
    // the number's text sits at the top of its element, like the first block's top (an element is as tall as its line)
    expect(
      Math.abs(r.gutterTop - r.topOfLine),
      `${what}: line ${r.n} gutter ${r.gutterTop} vs first block ${r.topOfLine}`
    ).toBeLessThanOrEqual(2);
  }
  return m;
}

for (const lang of Object.keys(DOCS)) {
  test(`line numbers line up: ${lang}`, async ({ page }) => {
    await page.goto(`/index.html?lang=${lang}`);
    await page.waitForSelector(".cm-content .blocks-node");
    await page.evaluate((t: string) => {
      const d = (window as any).demo;
      d.ed.view.dispatch({
        changes: { from: 0, to: d.ed.view.state.doc.length, insert: t },
      });
    }, DOCS[lang]);
    await page.waitForTimeout(100);
    await page.screenshot({
      path: path.join(__dirname, "screens", `linenumbers-${lang}.png`),
    });
    await check(page, "blocks, multi-line");

    // a collapsed block: the inner call g(2 3) (focus the 2, go to its call, collapse it with ArrowLeft)
    await page
      .locator(".cm-content .blocks-literal", { hasText: /^2$/ })
      .first()
      .click({ modifiers: ["Shift"] });
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowLeft");
    await page.waitForTimeout(100);
    expect(
      await page.locator(".cm-content .blocks-collapsed").count()
    ).toBeGreaterThan(0);
    await check(page, "blocks, one block collapsed");
    // everything collapsed: one line shown per block, the others hidden
    await page.keyboard.press("Shift+ArrowLeft");
    await page.waitForTimeout(100);
    await check(page, "blocks, all collapsed");
    await page.screenshot({
      path: path.join(
        __dirname,
        "screens",
        `linenumbers-${lang}-collapsed.png`
      ),
    });
    await page.keyboard.press("Shift+ArrowRight");
    await page.waitForTimeout(100);

    // a pending top-level edit box at the end of the program
    await page.evaluate(() => {
      const d = (window as any).demo;
      d.ed.view.dispatch({
        selection: { anchor: d.ed.view.state.doc.length },
      });
      d.ed.view.focus();
    });
    await page.keyboard.type("x");
    await expect(page.locator(".blocks-pending .blocks-edit")).toBeFocused();
    await check(page, "blocks, pending edit box");
    await page.screenshot({
      path: path.join(__dirname, "screens", `linenumbers-${lang}-pending.png`),
    });
    await page.keyboard.press("Escape");

    // the mode switch both ways
    await page.evaluate(() => (window as any).demo.ed.setMode("text"));
    await page.waitForTimeout(100);
    await check(page, "text mode");
    expect(
      await page.evaluate(() => (window as any).demo.ed.view.state.doc.lines)
    ).toBeGreaterThan(5);
    await page.evaluate(() => (window as any).demo.ed.setMode("blocks"));
    await page.waitForSelector(".cm-content .blocks-node");
    await page.waitForTimeout(100);
    await check(page, "back in block mode");
  });
}
