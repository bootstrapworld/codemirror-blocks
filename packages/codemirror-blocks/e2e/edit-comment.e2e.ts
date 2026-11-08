import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import {
  dragWithMouse,
  expectConsistent,
  openInBlockMode,
  trashCan,
} from "./helpers";

const COMMENT_KEY = "Shift+Control+]";

type Win = { cmb: { getValue(): string } };
const source = (page: Page) =>
  page.evaluate(() => (window as unknown as Win).cmb.getValue());

const editing = (page: Page) =>
  page.evaluate(() => ({
    editable: document.activeElement?.getAttribute("contenteditable"),
    text: document.activeElement?.textContent,
    selected: window.getSelection()?.toString(),
  }));

test.describe("editing a comment from the keyboard", () => {
  test("adds a comment to a block that has none", async ({ page }) => {
    await openInBlockMode(page, "(f x)\n(g y)");
    await page.getByRole("treeitem", { name: /g expression/ }).click({
      position: { x: 4, y: 4 },
    });
    await page.keyboard.press(COMMENT_KEY);
    await expect.poll(() => editing(page)).toMatchObject({ editable: "true" });
    await page.keyboard.type("the second one");
    await page.keyboard.press("Enter");
    await expect
      .poll(() => source(page))
      .toBe("(f x)\n#| the second one |#\n(g y)");
    await expect(
      page.getByRole("treeitem", { name: /g expression/ })
    ).toBeFocused();
  });

  test("opens the text of an existing comment, selected, and replaces it", async ({
    page,
  }) => {
    await openInBlockMode(page, "#| old words |#\n(f x)");
    await page.getByRole("treeitem", { name: /f expression/ }).click({
      position: { x: 4, y: 4 },
    });
    await page.keyboard.press(COMMENT_KEY);
    await expect
      .poll(() => editing(page))
      .toEqual({
        editable: "true",
        text: "old words",
        selected: "old words",
      });
    await page.keyboard.type("new words");
    await page.keyboard.press("Enter");
    await expect.poll(() => source(page)).toBe("#| new words |#\n(f x)");
  });

  test("Escape leaves the comment alone", async ({ page }) => {
    await openInBlockMode(page, "#| old words |#\n(f x)");
    await page.getByRole("treeitem", { name: /f expression/ }).click({
      position: { x: 4, y: 4 },
    });
    await page.keyboard.press(COMMENT_KEY);
    await page.keyboard.type("nope");
    await page.keyboard.press("Escape");
    await expect.poll(() => source(page)).toBe("#| old words |#\n(f x)");
  });

  test("works on a block inside another", async ({ page }) => {
    await openInBlockMode(page, "(f x y)");
    await page.getByRole("treeitem", { name: /^y/ }).click({
      position: { x: 4, y: 4 },
    });
    await page.keyboard.press("Escape"); // (a click on a literal opens its text)
    await page.keyboard.press(COMMENT_KEY);
    await page.keyboard.type("last");
    await page.keyboard.press("Enter");
    // (the comment goes with y, and the rest is as it was)
    await expect
      .poll(async () => (await source(page)).replace(/\s+/g, " "))
      .toBe("(f x #| last |# y)");
  });
});

test.describe("a comment that goes with no block", () => {
  const apart = (page: Page) =>
    page.getByRole("treeitem", { name: /comment: apart/ });

  test("is a block of its own that can be focused and read", async ({
    page,
  }) => {
    await openInBlockMode(page, "(f x)\n\n#| apart |#\n\n(g y)");
    await apart(page).click({ position: { x: 4, y: 4 } });
    await expect(apart(page)).toBeFocused();
    // (it is a block like the others: its place among them is checked in the
    // jest tests of navigation)
    await expect(apart(page)).toHaveAttribute("aria-posinset", "2");
    await expect(apart(page)).toHaveAttribute("aria-setsize", "3");
  });

  test("is edited with Enter, not with the comment shortcut", async ({
    page,
  }) => {
    await openInBlockMode(page, "(f x)\n\n#| apart |#\n\n(g y)");
    await apart(page).click({ position: { x: 4, y: 4 } });
    await page.keyboard.press(COMMENT_KEY);
    await expect
      .poll(async () => (await editing(page)).editable)
      .not.toBe("true");
    await page.keyboard.press("Enter");
    await expect.poll(() => editing(page)).toMatchObject({ editable: "true" });
    await page.keyboard.type("#| elsewhere |#");
    await page.keyboard.press("Enter");
    await expect
      .poll(() => source(page))
      .toBe("(f x)\n\n#| elsewhere |#\n\n(g y)");
    await expect(
      page.getByRole("treeitem", { name: /comment: elsewhere/ })
    ).toBeFocused();
  });

  test("is deleted like any other block", async ({ page }) => {
    await openInBlockMode(page, "(f x)\n\n#| apart |#\n\n(g y)");
    await apart(page).click({ position: { x: 4, y: 4 } });
    await page.keyboard.press("Space");
    await page.keyboard.press("Delete");
    await expect.poll(() => source(page)).not.toContain("apart");
    await expect(page.getByRole("treeitem", { name: /comment/ })).toHaveCount(
      0
    );
  });

  test("a block's own comment is a popup while it is active, not a stop of its own", async ({
    page,
  }) => {
    await openInBlockMode(page, "#| mine |#\n(g y)");
    const g = page.getByRole("treeitem", {
      name: /g expression.*with comment/,
    });
    await expect(g).toBeVisible();
    await expect(
      page.getByRole("treeitem", { name: /^comment: / })
    ).toHaveCount(0);
    const popup = g.locator("> .blocks-comment");
    await expect(popup).toHaveAttribute("aria-hidden", "true");
    await expect(popup).toBeHidden();
    await g.click({ position: { x: 4, y: 4 } });
    await expect(popup).toBeVisible();
    await expect(popup).toContainText("mine");
  });

  test("a collapsed comment block hides its words and keeps its emoji", async ({
    page,
  }) => {
    await openInBlockMode(page, "#| apart words |#\n\n(g y)");
    const c = page.getByRole("treeitem", { name: /^comment: / });
    await c.click();
    await page.keyboard.press("ArrowLeft");
    await expect(c).toHaveAttribute("aria-expanded", "false");
    await expect(c.locator(".blocks-comment-text")).toBeHidden();
    const emoji = await c.evaluate(
      (el) => getComputedStyle(el, "::before").content
    );
    expect(emoji).toContain("\u{1F4AC}");
    expect(
      await c.evaluate((el) => getComputedStyle(el, "::before").display)
    ).not.toBe("none");
  });

  test("a comment popup that would go off the bottom of the editor grows upwards", async ({
    page,
  }) => {
    const words = Array.from({ length: 30 }, (_, i) => `word${i}`).join(" ");
    const filler = Array.from({ length: 40 }, (_, i) => `(h ${i})`).join("\n");
    await openInBlockMode(page, `${filler}\n#| ${words} |#\n(g y)`);
    const edge = (selector: string, side: "top" | "bottom") =>
      page.evaluate(
        ([sel, s]) =>
          document.querySelector(sel)?.getBoundingClientRect()[
            s as "top" | "bottom"
          ] ?? NaN,
        [selector, side]
      );
    const g = page.getByRole("treeitem", { name: /g expression/ });
    const popup = g.locator("> .blocks-comment");
    // (CodeMirror draws only the lines in view: go to the end, where g is)
    await page.evaluate(() => {
      const cm = (
        document.querySelector(".CodeMirror") as unknown as {
          CodeMirror: { scrollTo(x: number, y: number): void };
        }
      ).CodeMirror;
      cm.scrollTo(0, 1e6);
    });
    await g.click({ position: { x: 4, y: 4 } });
    await expect(popup).toBeVisible();
    await expect(popup).toHaveClass(/blocks-comment-above/);
    // (it is all in the editor)
    expect(await edge(".blocks-comment", "bottom")).toBeLessThanOrEqual(
      await edge(".CodeMirror", "bottom")
    );
    expect(await edge(".blocks-comment", "top")).toBeGreaterThanOrEqual(
      await edge(".CodeMirror", "top")
    );
  });

  test("the box a comment is typed in grows upwards when its text would take it below the editor", async ({
    page,
  }) => {
    const filler = Array.from({ length: 40 }, (_, i) => `(h ${i})`).join("\n");
    await openInBlockMode(page, `${filler}\n(g y)`);
    await page.evaluate(() => {
      const cm = (
        document.querySelector(".CodeMirror") as unknown as {
          CodeMirror: { scrollTo(x: number, y: number): void };
        }
      ).CodeMirror;
      cm.scrollTo(0, 1e6);
    });
    const g = page.getByRole("treeitem", { name: /g expression/ });
    await g.click({ position: { x: 4, y: 4 } });
    await page.keyboard.press(COMMENT_KEY);
    const box = page.locator(".blocks-comment-editing");
    await expect(box).toBeVisible();
    await expect(box).not.toHaveClass(/blocks-comment-above/);
    // (a few words fit below the block: many wrap onto lines that do not)
    await page.keyboard.type(
      Array.from({ length: 40 }, (_, i) => `word${i}`).join(" ")
    );
    await expect(box).toHaveClass(/blocks-comment-above/);
    const edge = (selector: string, side: "top" | "bottom") =>
      page.evaluate(
        ([sel, s]) =>
          document.querySelector(sel)?.getBoundingClientRect()[
            s as "top" | "bottom"
          ] ?? NaN,
        [selector, side]
      );
    // (the editor follows the caret, and then the box: it settles in a moment)
    const editorBottom = await edge(".CodeMirror", "bottom");
    await expect
      .poll(() => edge(".blocks-comment-editing", "bottom"))
      .toBeLessThanOrEqual(editorBottom + 1);
  });

  test("pasting into the box a comment is typed in leaves the caret after the text", async ({
    page,
  }) => {
    await openInBlockMode(page, "(f x)");
    const f = page.getByRole("treeitem", { name: /f expression/ });
    await f.click({ position: { x: 4, y: 4 } });
    await page.keyboard.press(COMMENT_KEY);
    const box = page.locator(".blocks-comment-editing");
    await expect(box).toBeVisible();
    await page.keyboard.type("one ");
    await page.evaluate(() => {
      const el = document.querySelector(".blocks-comment-editing")!;
      const data = new DataTransfer();
      data.setData("text", "pasted");
      el.dispatchEvent(
        new ClipboardEvent("paste", {
          clipboardData: data,
          bubbles: true,
          cancelable: true,
        })
      );
    });
    // (nothing is selected: the caret is a point, at the end of what was pasted)
    expect(await page.evaluate(() => window.getSelection()?.isCollapsed)).toBe(
      true
    );
    await page.keyboard.type("!");
    await expect(box).toHaveText("one pasted!");
  });

  test("a comment popup that has room below hangs from the top of its block", async ({
    page,
  }) => {
    await openInBlockMode(page, "; short\n(f x)\n(g y)");
    const f = page.getByRole("treeitem", { name: /f expression/ });
    await f.click({ position: { x: 4, y: 4 } });
    const popup = f.locator("> .blocks-comment");
    await expect(popup).toBeVisible();
    await expect(popup).not.toHaveClass(/blocks-comment-above/);
  });

  test("is left behind when the block it was above is deleted", async ({
    page,
  }) => {
    await openInBlockMode(page, "#| mine |#\n(g y)\n(h z)");
    await page.getByRole("treeitem", { name: /g expression/ }).click({
      position: { x: 4, y: 4 },
    });
    await page.keyboard.press("Space");
    await page.keyboard.press("Delete");
    await expect(
      page.getByRole("treeitem", { name: /comment: mine/ })
    ).toBeVisible();
    await expect.poll(() => source(page)).toContain("#| mine |#");
    await expect.poll(() => source(page)).not.toContain("(g y)");
  });
});

test("a drop with a comment box that cannot be saved still open leaves focus on a block", async ({
  page,
}) => {
  await openInBlockMode(page, "(f x y)\nw");
  const items = page.getByRole("treeitem");
  await items
    .filter({ hasText: /^y$/ })
    .first()
    .click({
      position: { x: 4, y: 4 },
    });
  await page.keyboard.press(COMMENT_KEY);
  // (a line comment swallows what follows it: this cannot be saved)
  await page.keyboard.type("; note\n(k 1)");
  await page.keyboard.press("Enter");
  await dragWithMouse(page, items.nth(1), trashCan(page));
  await expect.poll(() => source(page)).toBe("(... x y)\nw");
  await expectConsistent(page);
});

test("the comment box of a collapsed block is shown and has focus", async ({
  page,
}) => {
  await openInBlockMode(page, "(f (g 1 2) z)");
  const g = page.getByRole("treeitem", { name: /g expression/ });
  await g.click({ position: { x: 4, y: 4 } });
  await page.keyboard.press("ArrowLeft"); // (collapse it)
  await expect(g).toHaveAttribute("aria-expanded", "false");
  await page.keyboard.press(COMMENT_KEY);
  await expect.poll(() => editing(page)).toMatchObject({ editable: "true" });
  await page.keyboard.type("note");
  await page.keyboard.press("Enter");
  await expect.poll(() => source(page)).toContain("#| note |#");
});
