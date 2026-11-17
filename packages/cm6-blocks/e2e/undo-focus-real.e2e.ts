// Eleventh round, difference 4: undo and redo put real keyboard focus where the old history does. Real keys in Chromium.
import { test, expect } from "@playwright/test";

/* eslint-disable @typescript-eslint/no-explicit-any */
const DOC: Record<string, string> = {
  scheme: "(f x y z)\n(g 1)",
  javascript: "f(x, y, z);\ng(1);",
  python: "f(x, y, z)\ng(1)",
};

for (const lang of Object.keys(DOC)) {
  test(`undo goes to the block that had focus before the edit, redo to where the edit left it: ${lang}`, async ({
    page,
  }) => {
    await page.goto(`/index.html?lang=${lang}`);
    await page.waitForSelector(".cm-content .blocks-node");
    await page.evaluate((t) => {
      const d = (window as any).demo;
      d.ed.view.dispatch({
        changes: { from: 0, to: d.ed.view.state.doc.length, insert: t },
      });
    }, DOC[lang]);
    const text = () =>
      page.evaluate(() => (window as any).demo.ed.view.state.doc.toString());
    const focused = () =>
      page.evaluate(() => {
        const d = (window as any).demo;
        const n = d.ed.focusedNode();
        return n
          ? d.ed.view.state.doc.sliceString(n.from, n.to)
          : document.activeElement?.tagName;
      });
    // focus z (the last argument of the first call), select x, delete x
    await page.evaluate(() => {
      const d = (window as any).demo;
      const args = d.ed
        .roots()[0]
        .slots.flatMap((s: any) => s.nodes)
        .flatMap((n: any) =>
          n.slots.length ? n.slots.flatMap((s: any) => s.nodes) : [n]
        );
      const x = args.find(
        (n: any) => d.ed.view.state.doc.sliceString(n.from, n.to) === "x"
      );
      d.ed.focusNode(x);
    });
    await page.keyboard.press("Space");
    await page.evaluate(() => {
      const d = (window as any).demo;
      const args = d.ed
        .roots()[0]
        .slots.flatMap((s: any) => s.nodes)
        .flatMap((n: any) =>
          n.slots.length ? n.slots.flatMap((s: any) => s.nodes) : [n]
        );
      d.ed.focusNode(
        args.find(
          (n: any) => d.ed.view.state.doc.sliceString(n.from, n.to) === "z"
        )
      );
    });
    const before = await text();
    await page.keyboard.press("Delete");
    expect(await text()).not.toBe(before);
    const left = await focused();
    await page.keyboard.press("ControlOrMeta+z");
    expect(await text()).toBe(before);
    expect(await focused()).toBe("z");
    await page.keyboard.press("ControlOrMeta+Shift+z");
    expect(await text()).not.toBe(before);
    expect(await focused()).toBe(left);
    await page.keyboard.press("ControlOrMeta+z");
    expect(await focused()).toBe("z");
    expect(
      await page.evaluate(() => document.activeElement === document.body)
    ).toBe(false);
  });
}
