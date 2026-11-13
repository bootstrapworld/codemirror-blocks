import { expect, test, type Page } from "@playwright/test";
import { openInBlockMode } from "./helpers";

/**
 * In lambda: a drop target far down a long program opens for typing when it is
 * clicked after scrolling to it (an `if`'s steps, a call's arguments, between
 * statements), and the page does not jump to a block that contains it.
 */
const STATEMENTS = 100;
const head = Array.from({ length: STATEMENTS }, (_, i) => `f${i}(a, b)`);

type Cmb = {
  getCM(): { getScrollInfo(): { top: number } };
  getValue(): string;
};
const scrollTop = (page: Page) =>
  page.evaluate(
    () => (window as unknown as { cmb: Cmb }).cmb.getCM().getScrollInfo().top
  );
const value = (page: Page) =>
  page.evaluate(() =>
    (window as unknown as { cmb: Cmb }).cmb.getValue().slice(-90)
  );
const editable = (page: Page) =>
  page.evaluate(() => document.activeElement?.getAttribute("contenteditable"));

async function scrollDown(page: Page, notches: number) {
  const box = (await page.locator(".CodeMirror-scroll").boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  for (let i = 0; i < notches; i++) {
    await page.mouse.wheel(0, 400);
    await page.waitForTimeout(40);
  }
  await page.waitForTimeout(300);
}

const cases = [
  {
    name: "the first one after then of the last if",
    code: [...head, "if c then a"].join(";\n"),
    target: (page: Page) =>
      page
        .locator(".blocks-if .blocks-conditional-body .blocks-drop-target")
        .first(),
    typed: "z",
    expect: /then \{ z;\s*a/,
    onlyWithIf: true,
  },
  {
    name: "between the arguments of a call near the bottom",
    code: [...head, "g(a, b)"].join(";\n"),
    target: (page: Page) =>
      page
        .locator(".blocks-functionApp")
        .filter({
          has: page.locator(".blocks-operator .blocks-literal", {
            hasText: /^g$/,
          }),
        })
        .first()
        .locator(".blocks-drop-target")
        .nth(1),
    typed: "z",
    // (a gap among the arguments of a call is opened for typing, but lambda's
    // commas make what is typed there a mistake, which is a limit of the insertion
    // and not of this: so the test ends it by cancelling)
    expect: null,
    onlyWithIf: false,
  },
  {
    name: "between the statements of the program",
    code: [...head, "g(a, b)"].join(";\n"),
    target: (page: Page) =>
      page
        .locator(".blocks-prog > .blocks-statements > .blocks-drop-target")
        .nth(95),
    typed: "q(1)",
    expect: /q\(1\)/,
    onlyWithIf: false,
  },
];

for (const c of cases) {
  test(`lambda, after scrolling: a click on a drop target ${c.name} opens it for typing`, async ({
    page,
  }) => {
    await openInBlockMode(page, c.code, "lambda");
    await scrollDown(page, 14);
    const target = c.target(page);
    await target.scrollIntoViewIfNeeded();
    const before = await scrollTop(page);
    expect(before).toBeGreaterThan(500);
    await target.click();
    await expect.poll(() => editable(page)).toBe("true");
    expect(Math.abs((await scrollTop(page)) - before)).toBeLessThan(200);
    await page.keyboard.type(c.typed);
    expect(await editable(page)).toBe("true");
    if (c.expect) {
      await page.keyboard.press("Enter");
      await expect.poll(() => value(page)).toMatch(c.expect);
    } else {
      await page.keyboard.press("Escape");
      await expect.poll(() => editable(page)).not.toBe("true");
    }
    expect(await scrollTop(page)).toBeGreaterThan(300);
  });
}
