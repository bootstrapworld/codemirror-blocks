import wescheme from "../src/languages/wescheme";
import {
  cmd_ctrl,
  keyDown,
  mountCMB,
  mouseDown,
  teardown,
} from "../src/toolkit/test-utils";
import { API } from "../src/CodeMirrorBlocks";
import { ASTNode } from "../src/ast";
import { installFakeClipboard } from "./helpers/clipboard";
import { setEditableText } from "./helpers/editing";
import { dragOnto, kids, select, typeChar } from "./helpers/gestures";

/**
 * Which block has focus after an undo or a redo.
 *
 * Each history item remembers the number (`nid`) of the block that had focus
 * before the edit and of the one that had it after. A `nid` is a position in
 * the document's list of blocks, so it only means the same block in the
 * document it was taken from. BlockEditor.handleChange looks up
 * `oldFocusNId || newFocusNId` for both an undo and a redo; if that block can't
 * be found, focus goes to the block nearest the change, and to the editor
 * itself when no block is left.
 *
 * KNOWN BUGS, pinned below as they are today:
 * - a redo uses the "before" number, which is a position in the other
 *   document, so focus lands on whatever block now sits there;
 * - `0 ||` treats the first block (position 0) as "no saved focus".
 *
 * The obvious fix (undo by the "before" number, redo by the "after" one, with
 * `??`) is not safe: it makes the redo of a top-level edit throw "IndexSizeError"
 * from inside CodeMirror's restoreSelection in a real browser (the dev server's
 * error overlay then takes keyboard focus; `matrix.e2e.ts` "typing at the top
 * level > is redone by the keyboard" catches it, jsdom does not). Focus moves
 * inside CodeMirror's own undo operation, before it redraws, so a fix needs to
 * move focus after the operation instead.
 */

let cmb: API;
let clipboard: ReturnType<typeof installFakeClipboard>;
beforeEach(() => {
  cmb = mountCMB(wescheme).cmb;
  clipboard = installFakeClipboard();
});
afterEach(() => {
  clipboard.restore();
  teardown();
});

const root = (i = 0) => cmb.getAst().rootNodes[i];
const focused = () => cmb.getFocusedNode()?.toString();
const undo = () => keyDown("Z", cmd_ctrl);
const redo = () => keyDown("Y", { ctrlKey: true });
const deleteSelected = (node: ASTNode) => {
  select(node);
  keyDown("Delete", {}, node);
};

describe("undoing and redoing a delete", () => {
  beforeEach(() => {
    cmb.setValue("(f x y)");
    cmb.clearHistory();
    deleteSelected(kids(root())[1]); // x
  });

  it("starts with focus on the block before the deleted one", () => {
    expect(cmb.getValue()).toBe("(f y)");
    expect(focused()).toBe("f");
  });

  it("undo puts focus back on the block that had it before the delete", () => {
    undo();
    expect(cmb.getValue()).toBe("(f x y)");
    expect(focused()).toBe("x");
  });

  it("KNOWN BUG: redo focuses whatever now has x's position", () => {
    undo();
    redo();
    expect(cmb.getValue()).toBe("(f y)");
    expect(focused()).toBe("y"); // should be "f", where the delete left focus
  });
});

describe("a delete that shifts the positions of the blocks after it", () => {
  beforeEach(() => {
    cmb.setValue("a b c d");
    cmb.clearHistory();
    // select a, then move focus to d (the selection stays), and delete
    select(root(0));
    mouseDown(root(3));
    keyDown("Delete", {}, root(3));
    expect(cmb.getValue()).toBe("b c d");
  });

  it("undo goes back to d, which had focus", () => {
    undo();
    expect(cmb.getValue()).toBe("a b c d");
    expect(focused()).toBe("d");
  });

  it("redo goes to the first block, which took focus after the delete", () => {
    undo();
    redo();
    expect(focused()).toBe("b");
  });
});

describe("an edit made while the first block (position 0) had focus", () => {
  beforeEach(() => {
    cmb.setValue("(f x) b");
    cmb.clearHistory();
    clipboard.text = "zzz";
    mouseDown(root(0));
    keyDown("V", cmd_ctrl, root(0));
    expect(cmb.getValue()).toBe("(f x)\nzzz\n b");
  });

  it("KNOWN BUG: undo skips that first block and focuses whatever is at the pasted block's position", () => {
    undo();
    expect(cmb.getValue()).toBe("(f x) b");
    expect(focused()).toBe("b"); // should be "(f x)", which had focus
  });

  it("redo puts focus on the pasted block (by the same accident: 0 || the new position)", () => {
    undo();
    redo();
    expect(focused()).toBe("zzz");
  });
});

describe("undoing and redoing an insertion beside a block", () => {
  beforeEach(() => {
    cmb.setValue("(f x y)");
    cmb.clearHistory();
    const x = kids(root())[1];
    mouseDown(x);
    keyDown("]", { ctrlKey: true }, x);
    setEditableText("zzz");
    keyDown("Enter");
    expect(cmb.getValue()).toBe("(f x zzz y)");
  });

  it("undo goes back to x", () => {
    undo();
    expect(focused()).toBe("x");
  });

  it("KNOWN BUG: redo goes back to x instead of the inserted block", () => {
    undo();
    redo();
    expect(cmb.getValue()).toBe("(f x zzz y)");
    expect(focused()).toBe("x"); // should be "zzz", where the insert left focus
  });
});

describe("two quick edits that CodeMirror undoes as one (KNOWN BUG)", () => {
  // Changes whose origin starts with "+" (typing) are merged into one history
  // item when they come close together. Undoing it reverts two changes, and
  // each fires its own "undo" event: the first uses (and clears) the saved
  // focus, the second has none and falls back to a guess from the change. So
  // focus ends up by the fallback, on the block at position 0, which is not
  // where it was ("d") before the edits. Fixing it means applying the saved
  // focus once, after the last change of the history item, which is a bigger
  // change to how undo and redo finish than the other focus fixes.
  beforeEach(() => {
    cmb.setValue("a b c d");
    cmb.clearHistory();
    mouseDown(root(3));
    cmb.replaceRange("", { line: 0, ch: 0 }, { line: 0, ch: 2 }, "+delete");
    cmb.replaceRange("", { line: 0, ch: 0 }, { line: 0, ch: 2 }, "+delete");
    expect(cmb.getValue()).toBe("c d");
    expect(cmb.historySize().undo).toBe(1);
  });

  it("undo restores the text, and focus lands on the first block instead of d", () => {
    undo();
    expect(cmb.getValue()).toBe("a b c d");
    expect(focused()).toBe("a"); // should be "d"
  });

  it("redo restores the text and leaves focus on a block", () => {
    undo();
    redo();
    expect(cmb.getValue()).toBe("c d");
    expect(cmb.getFocusedNode()).toBeTruthy();
  });
});

describe("when the saved block can't be found", () => {
  it("undoing the only block added leaves focus in the editor, with no block", () => {
    // nothing has focus before this edit, and nothing is left after the undo
    cmb.setValue("");
    cmb.clearHistory();
    cmb.setCursor({ line: 0, ch: 0 });
    typeChar(cmb, "a");
    keyDown("Enter");
    expect(cmb.getValue()).toBe("a");
    expect(focused()).toBe("a");
    undo();
    expect(cmb.getValue()).toBe("");
    expect(cmb.getFocusedNode()).toBeFalsy();
    expect(cmb.getWrapperElement().contains(document.activeElement)).toBe(true);
  });
});

describe("a block inside a collapsed block", () => {
  it("undo puts focus on the collapsed block that contains it", () => {
    cmb.setValue("(f x y) z");
    cmb.clearHistory();
    const x = kids(root())[1];
    keyDown("ArrowLeft", {}, root()); // collapse the root
    dragOnto(
      document.getElementById(`block-node-${x.id}`)!,
      document.querySelector(".TrashCan")!
    );
    expect(cmb.getValue()).toBe("(f y) z");
    undo();
    expect(cmb.getValue()).toBe("(f x y) z");
    expect(focused()).toBe("(f x y)");
  });
});
