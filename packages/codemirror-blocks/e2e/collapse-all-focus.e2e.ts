import { expect, test, Page } from "@playwright/test";
import { openInBlockMode } from "./helpers";

// Shift-Left collapses every block and puts focus on the root of the block that
// had it. When that root was well down the page, the shorter document left it
// off the screen: CodeMirror took it off the page, the browser dropped focus to
// <body>, and nothing brought the block back, so further keys did nothing.
const form = (i: number) =>
  [
    `; function ${i}`,
    `(define (f${i} x y)`,
    `  (cond`,
    `    [(< x ${i}) (let ([a (+ x ${i})] [b (* y 2)]) (+ a b))]`,
    `    [(> y ${i}) (string-append "big" (number->string (+ x y)))]`,
    `    [else (let* ([d (* x ${i + 1})] [e (+ d y)]) (max d e ${i}))]))`,
    ``,
  ].join("\n");

const focus = (page: Page) =>
  page.evaluate(() => {
    const el = document.activeElement as HTMLElement;
    return {
      tag: el.tagName,
      level: el.getAttribute("aria-level"),
      label: el.getAttribute("aria-label"),
    };
  });

for (const [name, forms, downs] of [
  ["small", 4, 20],
  ["medium", 30, 150],
  ["large", 310, 80],
] as const) {
  test(`collapse all keeps keyboard focus on a root (${name} document)`, async ({
    page,
  }) => {
    test.setTimeout(120_000); // (a key press in a large document takes a while)
    await openInBlockMode(
      page,
      Array.from({ length: forms }, (_, i) => form(i)).join("\n")
    );
    await page.getByRole("treeitem").first().click();
    for (let i = 0; i < downs; i++) await page.keyboard.press("ArrowDown");
    const before = await focus(page);
    expect(before.level).not.toBe("1"); // deep inside a later root
    await page.keyboard.press("Shift+ArrowLeft");

    await expect
      .poll(() => focus(page))
      .toMatchObject({
        tag: "SPAN",
        level: "1",
      });
    // and keys still work
    const root = (await focus(page)).label;
    await page.keyboard.press(
      root?.startsWith(`f${forms - 1}:`) ? "ArrowUp" : "ArrowDown"
    );
    await expect.poll(async () => (await focus(page)).label).not.toBe(root);
    expect((await focus(page)).tag).toBe("SPAN");
  });
}
