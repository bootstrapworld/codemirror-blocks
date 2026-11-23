// PORTED from packages/codemirror-blocks/e2e/drop-target-scroll.e2e.ts: only the import changed (to ../compat/helpers); see doc/experiments/cm6-direct-tree.md, thirteenth round.
// EDITED (documented, second round D): the labels `f expression`, `g,` are the table's `a f expression `, `symbol g`
import { expect, test, type Page } from "@playwright/test";
import { block, openInBlockMode } from "../compat/helpers";

/**
 * Clicking a drop target opens it for typing, and the page stays where it is:
 * also after the page has been scrolled away from the block that has focus.
 */
const LINES = 120;
// edited: JavaScript, not Scheme. In this editor a Scheme `begin` runs its calls along one line, so it never gets taller than the window; a JavaScript
// function body stacks its statements, as the old one did
const code = `function tall() {\n${Array.from({ length: LINES }, (_, i) =>
  i % 10 === 9 ? `  g${i}();` : `  f${i}(a, b);`
).join("\n")}\n}`;

// edited: the editor's scroller plus the page's (the demo's editor grows with its content, so the page scrolls); not the old `cmb.getCM().getScrollInfo()`
const scrollTop = (page: Page) =>
  page.evaluate(
    () =>
      (window as unknown as { demo: { ed: { view: { scrollDOM: Element } } } })
        .demo.ed.view.scrollDOM.scrollTop + window.scrollY
  );
const value = (page: Page) =>
  page.evaluate(() =>
    (window as unknown as { cmb: { getValue(): string } }).cmb.getValue()
  );
const active = (page: Page) =>
  page.evaluate(() => {
    const el = document.activeElement;
    return {
      // edited: the edit box is an input (`.blocks-edit`), not a contenteditable; the answer keeps the old "true"
      editable: el?.matches(".blocks-edit") ? "true" : "false",
      id: el?.id ?? "",
      tag: el?.tagName ?? "",
    };
  });

async function scrollDown(page: Page, notches: number) {
  // edited: the wheel turns over a point in the window (the editor is taller than it, so its own middle may be out of sight)
  const box = (await page.locator(".cm-scroller").boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, 300);
  for (let i = 0; i < notches; i++) {
    await page.mouse.wheel(0, 400);
    await page.waitForTimeout(40);
  }
  await page.waitForTimeout(300);
}

/** The drop targets that belong to the tall block itself (between its calls) */
// edited: the places are the block's gaps (`.blocks-gap`), the direct children of the function body's `.blocks-args`
const sequenceTargets = (page: Page) =>
  block(page, /^block with /).locator(":scope > .blocks-args > .blocks-gap");
/** A drop target inside a call near the bottom: between its arguments, or in an empty one */
const callTarget = (page: Page, label: RegExp, index: number) =>
  block(page, label).locator(".blocks-gap").nth(index);

// (near the bottom, to be reached by scrolling; or near the top, to be in view)
const cases = [
  {
    name: "between the calls of a tall block",
    target: (page: Page, scrolled: boolean) =>
      sequenceTargets(page).nth(scrolled ? 95 : 3),
    typed: "z(1)",
    expect: /z\(1\)/,
  },
  {
    name: "between arguments",
    target: (page: Page, scrolled: boolean) =>
      callTarget(
        page,
        scrolled ? /^a f88 expression / : /^a f2 expression /,
        1
      ),
    typed: "z",
    expect: /z/,
  },
  {
    name: "in an empty list",
    target: (page: Page, scrolled: boolean) =>
      callTarget(
        page,
        scrolled ? /^a g89 expression / : /^a g9 expression /,
        0
      ),
    typed: "h(1)",
    expect: /h\(1\)/,
  },
];

for (const scrolled of [false, true]) {
  for (const c of cases) {
    test(`${scrolled ? "after scrolling, " : ""}a click on a drop target ${c.name} opens it for typing`, async ({
      page,
    }) => {
      await openInBlockMode(page, code, "javascript");
      await block(page, /^a f0 expression /).click({
        position: { x: 4, y: 4 },
      });
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
      // (CodeMirror's height drops while the block that holds the new one is drawn
      // again, which takes the page to the top for a moment: wait for it to come
      // back, which a slow machine takes longer to do)
      await expect
        .poll(() => scrollTop(page))
        .toBeGreaterThan(scrolled ? 300 : -1);
    });
  }
}

// Closing the edit box without adding anything (Escape, or leaving it empty)
// does not take the page to the block that has focus, wherever that is.
for (const c of cases) {
  test(`after scrolling, cancelling the box of a drop target ${c.name} leaves the page where it is`, async ({
    page,
  }) => {
    await openInBlockMode(page, code, "javascript");
    await block(page, /^a f0 expression /).click({ position: { x: 4, y: 4 } });
    await scrollDown(page, 12);
    const target = c.target(page, true);
    await target.scrollIntoViewIfNeeded();
    const before = await scrollTop(page);
    await target.click();
    await expect.poll(async () => (await active(page)).editable).toBe("true");
    await page.keyboard.press("Escape");
    await expect
      .poll(async () => (await active(page)).editable)
      .not.toBe("true");
    await page.waitForTimeout(300);
    expect(Math.abs((await scrollTop(page)) - before)).toBeLessThan(200);
  });
}
