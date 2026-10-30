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
 * document it was taken from: an undo restores the document from before the
 * edit, so it uses the "before" number, and a redo uses the "after" one. If
 * that block can't be found, focus goes to the block nearest the change, and to
 * the editor itself when no block is left.
 *
 * Focus is moved once CodeMirror has finished the whole undo or redo
 * (BlockEditor.handleChanges), because one history item can hold several
 * changes and CodeMirror reports each of them. The browser specs
 * (`e2e/undo-focus.e2e.ts`, `matrix.e2e.ts`) check what jsdom can't: real
 * focus, and that CodeMirror doesn't throw while redrawing (see
 * dropDomSelection in BlockEditor).
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

  it("redo puts focus where the delete left it, not on whatever now has x's position", () => {
    undo();
    redo();
    expect(cmb.getValue()).toBe("(f y)");
    expect(focused()).toBe("f");
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

  it("undo puts focus back on that first block", () => {
    undo();
    expect(cmb.getValue()).toBe("(f x) b");
    expect(focused()).toBe("(f x)");
  });

  it("redo puts focus on the pasted block", () => {
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

  it("redo goes to the inserted block", () => {
    undo();
    redo();
    expect(cmb.getValue()).toBe("(f x zzz y)");
    expect(focused()).toBe("zzz");
  });
});

describe("two quick edits that CodeMirror undoes as one", () => {
  // Changes whose origin starts with "+" (typing) are merged into one history
  // item when they come close together. Undoing it reverts two changes, which
  // CodeMirror reports one by one; focus has to go back to where it was before
  // the first edit ("d"), and redo to where the last one left it.
  beforeEach(() => {
    cmb.setValue("a b c d");
    cmb.clearHistory();
    mouseDown(root(3));
    cmb.replaceRange("", { line: 0, ch: 0 }, { line: 0, ch: 2 }, "+delete");
    cmb.replaceRange("", { line: 0, ch: 0 }, { line: 0, ch: 2 }, "+delete");
    expect(cmb.getValue()).toBe("c d");
    expect(cmb.historySize().undo).toBe(1);
  });

  it("undo restores the text, and focus goes back to d, which had it before", () => {
    undo();
    expect(cmb.getValue()).toBe("a b c d");
    expect(focused()).toBe("d");
  });

  it("redo restores the text and puts focus where the edits left it", () => {
    undo();
    redo();
    expect(cmb.getValue()).toBe("c d");
    expect(focused()).toBe("c");
  });

  it("undo and redo work again the second time round", () => {
    undo();
    redo();
    undo();
    expect(cmb.getValue()).toBe("a b c d");
    expect(focused()).toBe("d");
    redo();
    expect(focused()).toBe("c");
  });
});

describe("undoing through the API instead of the keyboard", () => {
  // cmb.undo() is CodeMirror's own undo: nothing has told the editor which
  // history item is coming, so there is no saved focus to use. The text and
  // the AST still follow, and focus goes to the block that the change itself
  // points at (computeFocusNodeFromChanges, a heuristic: here the block after
  // the text that changed, which is not the one the keyboard path picks).
  it("still brings the AST back and leaves focus on a block next to the change", () => {
    cmb.setValue("(f x y)");
    cmb.clearHistory();
    deleteSelected(kids(root())[1]); // x
    expect(cmb.getValue()).toBe("(f y)");
    cmb.undo();
    expect(cmb.getValue()).toBe("(f x y)");
    expect(cmb.getAst().rootNodes.map(String)).toEqual(["(f x y)"]);
    expect(focused()).toBe("y");
    cmb.redo();
    expect(cmb.getValue()).toBe("(f y)");
    expect(cmb.getAst().rootNodes.map(String)).toEqual(["(f y)"]);
    expect(focused()).toBe("y");
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
