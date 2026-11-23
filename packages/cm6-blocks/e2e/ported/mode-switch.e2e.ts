// PORTED from packages/codemirror-blocks/e2e/mode-switch.e2e.ts: only the import changed (to ../compat/helpers); see doc/experiments/cm6-direct-tree.md, thirteenth round.
import { expect, test } from "@playwright/test";
import { openInBlockMode } from "../compat/helpers";

type Win = { cmb: { getCM(): { getScrollInfo(): { top: number } } } };
const scrollTop = (page: import("@playwright/test").Page) =>
  page.evaluate(
    () => (window as unknown as Win).cmb.getCM().getScrollInfo().top
  );

// edited: a line of text is not as tall as a block here, so the same place in the program is a different number of pixels from the top: what is
// kept is the first line in view (`scrollTop` is still far from the top)
const topLine = (page: import("@playwright/test").Page) =>
  page.evaluate(() => {
    const v = (
      window as unknown as {
        demo: {
          ed: {
            view: {
              scrollDOM: { scrollTop: number };
              lineBlockAtHeight(h: number): { from: number };
              state: { doc: { lineAt(p: number): { number: number } } };
            };
          };
        };
      }
    ).demo.ed.view;
    return v.state.doc.lineAt(v.lineBlockAtHeight(v.scrollDOM.scrollTop).from)
      .number;
  });

test.describe("switching modes", () => {
  test("keeps the scroll position of the editor", async ({ page }) => {
    const code = Array.from({ length: 200 }, (_, i) => `(f ${i})`).join("\n");
    await openInBlockMode(page, code);
    await page.evaluate(() =>
      (
        window as unknown as {
          cmb: { getCM(): { scrollTo(x: number, y: number): void } };
        }
      ).cmb
        .getCM()
        .scrollTo(0, 1500)
    );
    const before = await scrollTop(page);
    expect(before).toBeGreaterThan(500);
    const line = await topLine(page);
    expect(line).toBeGreaterThan(20);
    const near = async () => Math.abs((await topLine(page)) - line) <= 2;
    await page.getByRole("button", { name: /switch to text mode/i }).click();
    await expect.poll(near).toBe(true);
    expect(await scrollTop(page)).toBeGreaterThan(300);
    await page.getByRole("button", { name: /switch to blocks mode/i }).click();
    await expect(page.getByRole("treeitem").first()).toBeVisible();
    await expect.poll(near).toBe(true);
    expect(await scrollTop(page)).toBeGreaterThan(300);
  });
});
