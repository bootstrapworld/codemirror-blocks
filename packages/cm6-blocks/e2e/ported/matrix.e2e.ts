// PORTED from packages/codemirror-blocks/e2e/matrix.e2e.ts: only the import changed (to ../compat/helpers); see doc/experiments/cm6-direct-tree.md, thirteenth round.
// EDITED (documented, second round D): the labels `f expression`, `g,` are the table's `call to f `, `symbol g`
import { expect, Page, test } from "@playwright/test";
import {
  MOD,
  block,
  dragWithEvents,
  dragWithMouse,
  expectConsistent,
  openInBlockMode,
  redoAll,
  snapshot,
  trashCan,
  undoAll,
} from "../compat/helpers";

/**
 * The same kinds of edit as spec/undo-matrix-test.ts, but done with real
 * clicks, keystrokes, drags and the real clipboard in a real browser. Each one
 * must change the document, leave the AST matching the text and focus on
 * something that hears the keyboard, and be undone and redone by the keyboard.
 *
 * If one of these fails where its jsdom twin passes, jsdom is hiding a bug.
 */

const setClipboard = (page: Page, text: string) =>
  page.evaluate((t) => navigator.clipboard.writeText(t), text);

/** A click on the block's own padding: selects it without editing its text. */
const pick = (page: Page, label: RegExp) =>
  block(page, label).click({ position: { x: 4, y: 4 } });

const select = async (page: Page, label: RegExp) => {
  await pick(page, label);
  await page.keyboard.press("Space");
};

const clickBeside = async (page: Page, label: RegExp) => {
  const box = (await block(page, label).boundingBox())!;
  await page.mouse.click(box.x + box.width + 60, box.y + box.height / 2);
};

type Operation = {
  name: string;
  program: string;
  run: (page: Page) => Promise<void>;
  /** edited: an extra check on the result (the roots before and after) */
  verify?: (before: string[], after: string[]) => void;
};

const operations: Operation[] = [
  {
    name: "Delete on a selected root",
    program: "(f x)\n(g y)\n(h z)",
    run: async (page) => {
      await select(page, /call to g /);
      await page.keyboard.press("Delete");
    },
  },
  {
    name: "Backspace on a selected child",
    program: "(f x y)",
    run: async (page) => {
      await pick(page, /call to f /);
      await page.keyboard.press("ArrowRight");
      await page.keyboard.press("ArrowRight");
      await page.keyboard.press("Space");
      await page.keyboard.press("Backspace");
    },
  },
  {
    name: "Cut",
    program: "(f x)\n(g y)",
    run: async (page) => {
      await select(page, /call to g /);
      await page.keyboard.press(`${MOD}+x`);
    },
  },
  {
    name: "Paste over a selection",
    program: "(f x)\n(g y)",
    run: async (page) => {
      await setClipboard(page, "(new 1)");
      await select(page, /call to g /);
      await page.keyboard.press(`${MOD}+v`);
    },
  },
  {
    name: "Paste beside a root",
    program: "(f x)\n(g y)",
    run: async (page) => {
      await setClipboard(page, "(new 1)");
      await pick(page, /call to f /);
      await page.keyboard.press(`${MOD}+v`);
    },
  },
  {
    name: "editing a literal in place",
    program: "42\n(f x)",
    run: async (page) => {
      await block(page, /^42,/).click();
      await page.keyboard.type("7");
      await page.keyboard.press("Enter");
    },
  },
  {
    name: "inserting beside a child",
    program: "(f x y)",
    run: async (page) => {
      await pick(page, /call to f /);
      await page.keyboard.press("ArrowRight");
      await page.keyboard.press("ArrowRight");
      await page.keyboard.press("Control+]");
      await page.keyboard.type("zzz");
      await page.keyboard.press("Enter");
    },
  },
  {
    name: "typing at the top level",
    program: "(f x)\n(g y)",
    run: async (page) => {
      await clickBeside(page, /call to f /);
      await page.keyboard.type("9");
      await page.keyboard.press("Enter");
    },
  },
  {
    name: "pasting at the top level",
    program: "(f x)\n(g y)",
    run: async (page) => {
      await setClipboard(page, "(new 1)");
      await clickBeside(page, /call to f /);
      await page.keyboard.press(`${MOD}+v`);
      await page.keyboard.press("Enter");
    },
  },
  {
    name: "dragging a node onto a node",
    program: "(add a b) (sub c d)",
    run: async (page) => {
      await dragWithEvents(page, block(page, /^a, /), block(page, /^d, /));
    },
  },
  {
    name: "dragging a node onto a drop target",
    program: "(add a b) (sub c d)",
    run: async (page) => {
      await dragWithEvents(
        page,
        block(page, /^a, /),
        // edited: the place is the call's first gap (`.blocks-gap`), the old one a `.blocks-drop-target` element
        block(page, /call to sub /)
          .locator(".blocks-gap")
          .first()
      );
    },
  },
  {
    name: "dragging a node onto whitespace",
    program: "(f x)\n(g y)",
    run: async (page) => {
      // edited: the editor is `.cm-editor` here (the old page's was `.CodeMirror`)
      const editor = page.locator(".cm-editor").first();
      const box = (await editor.boundingBox())!;
      // low on the left: the trash can sits in the bottom right corner
      // the bottom of the editor is the end of the text, after the last block
      await dragWithEvents(page, block(page, /call to f /), editor, {
        x: box.x + 120,
        y: box.y + box.height - 40,
      });
    },
  },
  {
    name: "dragging from the toolbar onto a node",
    program: "(f x y)",
    run: async (page) => {
      await dragWithEvents(
        page,
        // edited: the toolbar's item is the demo's template button (`call`), the old one a `.Primitive` named sqrt
        page.locator('#templates button[data-template="call"]'),
        block(page, /^x, /)
      );
    },
    // edited: the value is replaced, not written beside the call as a new root (the root's edge zones do not take it)
    verify: (before, after) => expect(after.length).toBe(before.length),
  },
  {
    name: "dragging a node to the trash can",
    program: "(f x)\n(g y)",
    run: async (page) => {
      await dragWithMouse(page, block(page, /call to g /), trashCan(page));
    },
  },
];

for (const op of operations) {
  test.describe(op.name, () => {
    let before: { text: string; roots: string[] };
    let after: { text: string; roots: string[] };

    test.beforeEach(async ({ page, context }) => {
      await context.grantPermissions(["clipboard-read", "clipboard-write"]);
      await openInBlockMode(page, op.program);
      const s = await snapshot(page);
      before = { text: s.text, roots: s.roots };
      await op.run(page);
      // the page finishes a moment after the last event, so wait for the change
      await expect
        .poll(async () => (await snapshot(page)).text, {
          message: "the operation should have changed the document",
          timeout: 4000,
        })
        .not.toBe(before.text);
      await expectConsistent(page);
      const a = await snapshot(page);
      after = { text: a.text, roots: a.roots };
    });

    test("changes the document and keeps it consistent", async () => {
      expect(after.text).not.toBe(before.text);
      op.verify?.(before.roots, after.roots);
    });

    test("is undone by the keyboard", async ({ page }) => {
      await undoAll(page);
      const s = await expectConsistent(page);
      expect(s.text).toBe(before.text);
      expect(s.roots).toEqual(before.roots);
    });

    test("is redone by the keyboard", async ({ page }) => {
      await undoAll(page);
      await expectConsistent(page);
      await redoAll(page);
      const s = await expectConsistent(page);
      expect(s.text).toBe(after.text);
      expect(s.roots).toEqual(after.roots);
    });
  });
}
