// PORTED (as a Chromium test) from packages/codemirror-blocks/spec/undo-redo-test.js, "make sure edits can be properly undone/redone from an active block" (https://github.com/bootstrapworld/codemirror-blocks/issues/315).
// The jsdom port (spec/ported/undo-redo.test.ts) is skipped: a keydown has no default action there, so Enter inserts no line break. Here the keys are real.
// EDITED: the page cannot read the history's depth, so only the text is checked; the cursor is put at the end of the document with the editor's own view.
import { expect, test } from "@playwright/test";
import {
  MOD,
  expectConsistent,
  openInBlockMode,
  snapshot,
} from "../compat/helpers";

const expectText = (page: import("@playwright/test").Page, text: string) =>
  expect.poll(async () => (await snapshot(page)).text).toBe(text);

test("edits can be properly undone and redone from an active block", async ({
  page,
}) => {
  await openInBlockMode(page, "A\nB\n");

  // change (1): cut the first root
  await page
    .getByRole("treeitem")
    .first()
    .click({ position: { x: 4, y: 4 } });
  await page.keyboard.press("Alt+q"); // (a click on a one-letter symbol opens its edit box: leave it, the block keeps the focus)
  await page.keyboard.press("Space");
  await page.keyboard.press(`${MOD}+x`);
  await expectText(page, "\nB\n");

  // change (2): an empty line, with the cursor in the text on the last line
  await page.evaluate(() => {
    const v = (
      window as unknown as {
        demo: { ed: { view: import("@codemirror/view").EditorView } };
      }
    ).demo.ed.view;
    v.focus();
    v.dispatch({ selection: { anchor: v.state.doc.length } });
  });
  await page.keyboard.press("Enter");
  await expectText(page, "\nB\n\n");

  // change (3): C, committed with Enter
  await page.keyboard.type("C");
  await page.keyboard.press("Enter");
  await expectText(page, "\nB\n\nC");
  await expectConsistent(page);

  // undo (3), (2), (1)
  await page.keyboard.press(`${MOD}+z`);
  await expectText(page, "\nB\n\n");
  await page.keyboard.press(`${MOD}+z`);
  await expectText(page, "\nB\n");
  await page.keyboard.press(`${MOD}+z`);
  await expectText(page, "A\nB\n");

  // redo (1), (2), (3)
  await page.keyboard.press(`${MOD}+Shift+z`);
  await expectText(page, "\nB\n");
  await page.keyboard.press(`${MOD}+Shift+z`);
  await expectText(page, "\nB\n\n");
  await page.keyboard.press(`${MOD}+Shift+z`);
  await expectText(page, "\nB\n\nC");
  await expectConsistent(page);
});
