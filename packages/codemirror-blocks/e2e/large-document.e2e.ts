import { expect, test, type Page } from "@playwright/test";
import { MOD, expectConsistent, openInBlockMode, snapshot } from "./helpers";

/**
 * A program of hundreds of top-level forms: only the blocks near the visible
 * part of the editor are drawn at first (see `virtualRendering`), the rest when
 * they come into view or are needed. Everything must work on the others too.
 */

const FORMS = 400;
const code = Array.from(
  { length: FORMS },
  (_, i) => `(define (f${i} x)\n  (if (< x ${i}) (+ x ${i}) (- x 1)))`
).join("\n\n");

// (the middle of a block can be a name or a number: clicking it starts an edit)
const CORNER = { position: { x: 2, y: 2 } };

const treeitems = (page: Page) => page.getByRole("treeitem");

/**
 * Scroll until form `n` is on screen. (Blocks are as tall as the source until
 * they are drawn, so the position CodeMirror scrolls to moves a little as the
 * blocks come in; a person scrolling would just carry on.)
 */
const showForm = async (page: Page, n: number) => {
  const target = page.getByRole("treeitem", { name: new RegExp(`^f${n}:`) });
  await expect(async () => {
    await scrollToForm(page, n);
    await expect(target.first()).toBeVisible({ timeout: 500 });
  }).toPass({ timeout: 10_000 });
};

/** Scroll so that form `n` is at the top */
const scrollToForm = (page: Page, n: number) =>
  page.evaluate((n) => {
    const cmb = (
      window as unknown as {
        cmb: {
          getAst(): { rootNodes: { from: { line: number } }[] };
          getCM(): {
            heightAtLine(l: number, mode: string): number;
            scrollTo(x: number | null, y: number): void;
          };
        };
      }
    ).cmb;
    const cm = cmb.getCM();
    cm.scrollTo(
      null,
      cm.heightAtLine(cmb.getAst().rootNodes[n].from.line, "local")
    );
  }, n);

test.beforeEach(async ({ page }) => {
  await openInBlockMode(page, code);
});

test("only the blocks near the top are drawn at first", async ({ page }) => {
  const drawn = await page.evaluate(
    () => document.querySelectorAll(".react-container [role=treeitem]").length
  );
  // (400 forms of about 16 blocks each)
  expect(drawn).toBeLessThan(2000);
  const roots = await page.evaluate(
    () =>
      (
        window as unknown as { cmb: { getAst(): { rootNodes: unknown[] } } }
      ).cmb.getAst().rootNodes.length
  );
  expect(roots).toBe(FORMS);
});

test("blocks far down are drawn when scrolled to", async ({ page }) => {
  await showForm(page, 250);
  await showForm(page, 399);
});

test("a block far down can be edited, and undone", async ({ page }) => {
  await showForm(page, 300);
  // a number on screen (the first in the page may be scrolled out of view)
  const literalOnScreen = () =>
    page.evaluate(() => {
      for (const el of document.querySelectorAll("[role=treeitem]")) {
        if (!/^\d+,?$/.test(el.textContent ?? "")) continue;
        const r = el.getBoundingClientRect();
        if (r.top > 150 && r.bottom < 600) {
          return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
        }
      }
      return null;
    });
  // (and once the blocks coming in have stopped moving it)
  await expect
    .poll(async () => {
      const before = await literalOnScreen();
      await page.waitForTimeout(400);
      const after = await literalOnScreen();
      return before && after && before.x === after.x && before.y === after.y;
    })
    .toBe(true);
  const { x, y } = (await literalOnScreen())!;
  await page.mouse.click(x, y);
  // (a click on a number may already have opened its edit box)
  const editing = () =>
    page.evaluate(
      () => document.activeElement?.getAttribute("role") === "textbox"
    );
  if (!(await editing())) await page.keyboard.press("Enter");
  await expect.poll(editing).toBe(true);
  await page.keyboard.press(`${MOD}+a`);
  await page.keyboard.type("4242");
  await page.keyboard.press("Enter");
  await expect.poll(async () => (await snapshot(page)).text).toContain("4242");
  await expectConsistent(page);
  await page.keyboard.press(`${MOD}+z`);
  await expect
    .poll(async () => (await snapshot(page)).text)
    .not.toContain("4242");
  await expectConsistent(page);
});

test("keyboard navigation goes on into blocks that were not drawn", async ({
  page,
}) => {
  await treeitems(page).first().click(CORNER);
  await page.keyboard.press("Shift+ArrowLeft"); // collapse all: one stop per form
  await treeitems(page).first().click(CORNER);
  const seen = new Set<string>();
  for (let i = 0; i < 60; i++) {
    await page.keyboard.press("ArrowDown");
    seen.add(
      (await page.evaluate(() =>
        document.activeElement?.getAttribute("aria-label")
      )) ?? ""
    );
  }
  // (each form is its own stop, and focus never fell to the page)
  expect(seen.size).toBeGreaterThan(40);
  expect(seen.has("")).toBe(false);
  await expectConsistent(page);
});

test("collapse all and expand all work on the blocks not drawn", async ({
  page,
}) => {
  await treeitems(page).first().click(CORNER);
  await page.keyboard.press("Shift+ArrowLeft");
  await showForm(page, 399);
  await expect(
    page.getByRole("treeitem", { name: /f399:/ }).first()
  ).toHaveAttribute("aria-expanded", "false");
  await treeitems(page).first().click(CORNER);
  await page.keyboard.press("Shift+ArrowRight");
  await showForm(page, 399);
  await expect(
    page.getByRole("treeitem", { name: /f399:/ }).first()
  ).not.toHaveAttribute("aria-expanded", "false");
  // (collapsing doesn't touch the text; where focus goes afterwards is a
  // separate matter)
  const after = await snapshot(page);
  expect(after.reparsed).toEqual(after.roots);
});
