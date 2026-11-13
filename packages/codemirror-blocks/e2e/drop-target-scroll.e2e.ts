import { expect, test, type Page } from "@playwright/test";
import { block, openInBlockMode } from "./helpers";

/**
 * Clicking a drop target opens it for typing, and the page stays where it is:
 * also after the page has been scrolled away from the block that has focus.
 */
const LINES = 120;
// (one tall block, with calls in it, one on each line; every tenth is empty)
const code = `(begin\n${Array.from({ length: LINES }, (_, i) =>
  i % 10 === 9 ? `  (g${i})` : `  (f${i} a b)`
).join("\n")})`;

const scrollTop = (page: Page) =>
  page.evaluate(
    () =>
      (
        window as unknown as {
          cmb: { getCM(): { getScrollInfo(): { top: number } } };
        }
      ).cmb
        .getCM()
        .getScrollInfo().top
  );
const value = (page: Page) =>
  page.evaluate(() =>
    (window as unknown as { cmb: { getValue(): string } }).cmb.getValue()
  );
const active = (page: Page) =>
  page.evaluate(() => {
    const el = document.activeElement;
    return {
      editable: el?.getAttribute("contenteditable"),
      id: el?.id ?? "",
      tag: el?.tagName ?? "",
    };
  });

async function scrollDown(page: Page, notches: number) {
  const editor = page.locator(".CodeMirror-scroll");
  const box = (await editor.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  for (let i = 0; i < notches; i++) {
    await page.mouse.wheel(0, 400);
    await page.waitForTimeout(40);
  }
  await page.waitForTimeout(300);
}

/** The drop targets that belong to the tall block itself (between its calls) */
const sequenceTargets = (page: Page) =>
  page.locator(
    ".blocks-sequence > .blocks-sequence-exprs > .blocks-drop-target"
  );
/** A drop target inside a call near the bottom: between its arguments, or in an empty one */
const callTarget = (page: Page, label: RegExp, index: number) =>
  block(page, label).locator(".blocks-drop-target").nth(index);

// (near the bottom, to be reached by scrolling; or near the top, to be in view)
const cases = [
  {
    name: "between the calls of a tall block",
    target: (page: Page, scrolled: boolean) =>
      sequenceTargets(page).nth(scrolled ? 95 : 3),
    typed: "(z 1)",
    expect: /\(z 1\)/,
  },
  {
    name: "between arguments",
    target: (page: Page, scrolled: boolean) =>
      callTarget(page, scrolled ? /^f88 expression/ : /^f2 expression/, 1),
    typed: "z",
    expect: /z/,
  },
  {
    name: "in an empty list",
    target: (page: Page, scrolled: boolean) =>
      callTarget(page, scrolled ? /^g89 expression/ : /^g9 expression/, 0),
    typed: "(h 1)",
    expect: /\(h 1\)/,
  },
];

for (const scrolled of [false, true]) {
  for (const c of cases) {
    test(`${scrolled ? "after scrolling, " : ""}a click on a drop target ${c.name} opens it for typing`, async ({
      page,
    }) => {
      await openInBlockMode(page, code);
      await block(page, /^f0 expression/).click({ position: { x: 4, y: 4 } });
      if (scrolled) await scrollDown(page, 12);
      const before = await scrollTop(page);
      if (scrolled) expect(before).toBeGreaterThan(500);
      const target = c.target(page, scrolled);
      await target.scrollIntoViewIfNeeded();
      const scrollBefore = await scrollTop(page);
      await target.click();
      // the box has keyboard focus, and the page did not jump
      await expect.poll(async () => (await active(page)).editable).toBe("true");
      expect(Math.abs((await scrollTop(page)) - scrollBefore)).toBeLessThan(
        200
      );
      await page.keyboard.type(c.typed);
      expect((await active(page)).editable).toBe("true");
      await page.keyboard.press("Enter");
      await expect.poll(() => value(page)).toMatch(c.expect);
      expect(await scrollTop(page)).toBeGreaterThan(scrolled ? 300 : -1);
    });
  }
}
