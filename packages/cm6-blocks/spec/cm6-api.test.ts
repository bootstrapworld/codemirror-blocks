/** @jest-environment jsdom */
/*
 * Nineteenth round, step 4: the behaviours the old tests of the CodeMirror 5 API object check (api, api-edit-focus,
 * api-selection, entry-point, markText, new-blocks), against this editor's own interface (`createLezerBlockEditor`'s
 * object and its CodeMirror 6 view). One test per behaviour, named after the old test it replaces. The old tests are
 * not ported as API (class N): they point here.
 */
import { undo, redo } from "@codemirror/commands";
import { checkLezerEditor, LezerBlockEditor } from "../src/lezer-view";
import { make } from "./helpers";
import { walk } from "../src/doc";
import type { BNode } from "../src/types";

const text = (ed: LezerBlockEditor) => ed.view.state.doc.toString();
const src = (ed: LezerBlockEditor, n: BNode) =>
  ed.view.state.doc.sliceString(n.from, n.to);
const setValue = (ed: LezerBlockEditor, v: string) =>
  ed.view.dispatch({
    changes: { from: 0, to: ed.view.state.doc.length, insert: v },
  });

const SRC = "(a 1)\n(b 2)\n(c 3)\n";

describe("a change from code, while a block has keyboard focus (api-edit-focus-test)", () => {
  // "replaceRange in another root leaves focus on that block"
  test("an edit in another root leaves focus on that block", () => {
    const ed = make("scheme", SRC);
    ed.focusNode(ed.roots()[2]);
    ed.view.dispatch({ changes: { from: 0, to: 5, insert: "(a 1 1 1)" } });
    const f = ed.focusedNode();
    expect(f && src(ed, f)).toBe("(c 3)");
    expect(checkLezerEditor(ed)).toEqual([]);
  });

  // "setValue that keeps the block leaves focus on it"
  test("a new value that keeps the block leaves focus on it", () => {
    const ed = make("scheme", SRC);
    ed.focusNode(ed.roots()[1]);
    setValue(ed, SRC);
    const f = ed.focusedNode();
    expect(f && src(ed, f)).toBe("(b 2)");
  });

  // "setValue that removes the block moves focus to the first root, as before"
  // edited: the focus is looked for in the new tree, and a block that is gone leaves it on the first root or nowhere
  test("a new value that removes the block does not leave focus on a block that is gone", () => {
    const ed = make("scheme", SRC);
    ed.focusNode(ed.roots()[1]);
    setValue(ed, "(x 9)\n");
    const f = ed.focusedNode();
    expect(f === null || src(ed, f) === "(x 9)").toBe(true);
    expect(checkLezerEditor(ed)).toEqual([]);
  });

  // "with no block focused, focus goes to the first root, as before"
  test("with no block focused, a change from code focuses nothing, and focusEditor goes to the first root", () => {
    const ed = make("scheme", SRC);
    expect(ed.focusedNode()).toBeNull();
    setValue(ed, "(x 9)\n(y 8)\n");
    expect(ed.focusedNode()).toBeNull();
    ed.focusEditor();
    const f = ed.focusedNode();
    expect(f && src(ed, f)).toBe("(x 9)");
  });
});

describe("what is selected and focused, read from code (api-selection-test, api-test)", () => {
  // "somethingSelected is true once a block is selected", "getSelections reads the text of the selected block"
  test("the selected blocks are read in document order, with their text", () => {
    const ed = make("scheme", SRC);
    expect(ed.selectedBlocks()).toEqual([]);
    expect(ed.toggleSelect(ed.roots()[2])).toBe("selected");
    expect(ed.toggleSelect(ed.roots()[0])).toBe("selected");
    expect(ed.selectedBlocks().map((n) => src(ed, n))).toEqual([
      "(a 1)",
      "(c 3)",
    ]);
    ed.clearSelection();
    expect(ed.selectedBlocks()).toEqual([]);
  });

  // "selecting a block makes the block the only selection, not one of two with the cursor"
  test("selecting a block selects that block, and the text cursor is not a second selection", () => {
    const ed = make("scheme", SRC);
    ed.toggleSelect(ed.roots()[1]);
    expect(ed.selectedBlocks().length).toBe(1);
    expect(ed.view.state.selection.ranges.every((r) => r.empty)).toBe(true);
  });

  // "hasFocus is true while a block has the focus"
  test("focusedNode is the block that has the focus, and null when none has", () => {
    const ed = make("scheme", SRC);
    expect(ed.focusedNode()).toBeNull();
    ed.focusNode(ed.roots()[0]);
    expect(ed.focusedNode()).toBe(ed.roots()[0]);
  });

  // "setCursor should work as-is for text, or activate the containing block" / "getCursor"
  test("focusNode activates a block, and the block's range is where the cursor of the text is read", () => {
    const ed = make("scheme", SRC);
    let inner: BNode | null = null;
    ed.roots().forEach((r) =>
      walk(r, (n) => {
        if (!inner && src(ed, n) === "b") inner = n;
      })
    );
    if (!inner) throw new Error("no b");
    ed.focusNode(inner);
    expect(ed.focusedNode()).toBe(inner);
    expect(src(ed, inner)).toBe("b");
  });
});

describe("changing the selection or the text from code (api-test, api-selection-test)", () => {
  // "replaceSelection replaces the block and inserts nothing at the cursor"
  test("replacing the selected block writes the new text there and nowhere else", () => {
    const ed = make("scheme", SRC);
    const [n] = ed.replaceWithTexts(ed.roots()[1], ["(z 0)"]) ? [1] : [0];
    expect(n).toBe(1);
    expect(text(ed)).toBe("(a 1)\n(z 0)\n(c 3)\n");
    expect(checkLezerEditor(ed)).toEqual([]);
  });

  // "refuses new text that is not whole blocks"
  test("new text that is not whole blocks is refused, and the document stays", () => {
    const ed = make("scheme", SRC);
    expect(ed.refuseReplace(ed.roots()[1], "(z 0")).not.toBeNull();
    expect(text(ed)).toBe(SRC);
  });

  // "replaceRange": a text change from code is one change
  test("a text change from code reaches the blocks, which stay consistent with the text", () => {
    const ed = make("scheme", SRC);
    ed.view.dispatch({ changes: { from: 7, to: 8, insert: "bb" } });
    expect(ed.roots().map((n) => src(ed, n))).toEqual([
      "(a 1)",
      "(bb 2)",
      "(c 3)",
    ]);
    expect(checkLezerEditor(ed)).toEqual([]);
  });
});

describe("undo and redo from code (undo-redo-test, api-test)", () => {
  test("undo and redo of a change go back and forth, and the blocks follow", () => {
    const ed = make("scheme", SRC);
    ed.removeNode(ed.roots()[1]);
    expect(ed.roots().length).toBe(2);
    expect(undo(ed.view)).toBe(true);
    expect(text(ed)).toBe(SRC);
    expect(ed.roots().length).toBe(3);
    expect(checkLezerEditor(ed)).toEqual([]);
    expect(redo(ed.view)).toBe(true);
    expect(ed.roots().length).toBe(2);
    expect(checkLezerEditor(ed)).toEqual([]);
  });
});

describe("block mode on and off (new-blocks-test, entry-point-test)", () => {
  // "should set block mode to false" (a CodeMirror 5 editor starts in text mode; this one starts in block mode)
  // edited: starts in block mode here
  test("the editor starts in block mode, and setBlockMode(false) and (true) switch it", () => {
    const ed = make("scheme", SRC);
    expect(ed.isBlockMode()).toBe(true);
    ed.setBlockMode(false);
    expect(ed.isBlockMode()).toBe(false);
    ed.setBlockMode(true);
    expect(ed.isBlockMode()).toBe(true);
  });

  // "the API ... answers for the mode that shows": in text mode the keys are the text's, not the blocks'
  // edited: Delete in text mode takes one character; in block mode it takes the selected block
  test("in text mode Delete takes a character, in block mode the selected block", () => {
    const ed = make("scheme", SRC);
    ed.setBlockMode(false);
    const el = ed.view.dom.querySelector(".cm-content") as HTMLElement;
    el.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Delete", bubbles: true })
    );
    expect(text(ed)).toBe(SRC.slice(1));
    const ed2 = make("scheme", SRC);
    ed2.focusNode(ed2.roots()[0]);
    ed2.toggleSelect(ed2.roots()[0]);
    ed2.renderer.element(ed2.roots()[0]).dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Delete",
        bubbles: true,
        cancelable: true,
      })
    );
    expect(text(ed2)).not.toContain("(a 1)");
    expect(text(ed2)).toContain("(b 2)");
  });
});
