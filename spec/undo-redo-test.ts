import wescheme from "../src/languages/wescheme";
import "codemirror/addon/search/searchcursor.js";

import {
  mac,
  cmd_ctrl,
  teardown,
  activationSetup,
  mouseDown,
  keyDown,
  insertText,
  finishRender,
  mountCMB,
} from "../src/toolkit/test-utils";
import { API } from "../src/CodeMirrorBlocks";
import { ASTNode } from "../src/ast";
import { debugLog } from "../src/utils";

debugLog("Doing undo-redo-test.js");

describe("when testing undo/redo,", () => {
  let cmb!: API;

  const currentFirstRoot = () => cmb.getAst().rootNodes[0];
  const undo = (node?: ASTNode) => keyDown("Z", cmd_ctrl, node);
  const redo = (node?: ASTNode) => {
    if (mac) {
      keyDown("Z", { metaKey: true, shiftKey: true }, node);
    } else {
      keyDown("Y", { ctrlKey: true }, node);
    }
  };

  beforeEach(async () => {
    cmb = await mountCMB(wescheme);
  });

  afterEach(teardown);

  // https://github.com/bootstrapworld/codemirror-blocks/issues/315
  it("make sure edits can be properly undone/redone from an active block", async () => {
    cmb.setValue(`A\nB\n`);
    cmb.clearHistory();
    await finishRender();
    expect(cmb.historySize()).toEqual({ undo: 0, redo: 0 });
    mouseDown(currentFirstRoot()); // focus on the 1st root
    keyDown(" ", {}, currentFirstRoot());
    await finishRender();
    keyDown("X", cmd_ctrl, currentFirstRoot()); // change (1): cut first root
    await finishRender();
    expect(cmb.getValue()).toEqual("\nB\n");
    expect(cmb.historySize()).toEqual({ undo: 1, redo: 0 });
    cmb.setCursor({ line: 2, ch: 0 });
    keyDown("Enter"); // change (2): insert empty line
    await finishRender();
    expect(cmb.getValue()).toEqual("\nB\n\n");
    expect(cmb.historySize()).toEqual({ undo: 2, redo: 0 });
    insertText("C"); // change (3): insert C at the end
    await finishRender();
    expect(cmb.getValue()).toEqual("\nB\n\nC");
    expect(cmb.historySize()).toEqual({ undo: 3, redo: 0 });
    undo(currentFirstRoot()); // undo (3), leaving \nB\n\n
    await finishRender();
    expect(cmb.getValue()).toEqual("\nB\n\n");
    expect(cmb.historySize()).toEqual({ undo: 2, redo: 1 });
    undo(currentFirstRoot()); // undo (2), leaving \nB\n\n
    await finishRender();
    expect(cmb.getValue()).toEqual("\nB\n");
    expect(cmb.historySize()).toEqual({ undo: 1, redo: 2 });
    undo(currentFirstRoot()); // undo (1), leaving A\nB\n
    await finishRender();
    expect(cmb.getValue()).toEqual("A\nB\n");
    expect(cmb.historySize()).toEqual({ undo: 0, redo: 3 });
    redo(currentFirstRoot()); // redo (1), leaving \nB\n
    await finishRender();
    expect(cmb.getValue()).toEqual("\nB\n");
    expect(cmb.historySize()).toEqual({ undo: 1, redo: 2 });
    redo(currentFirstRoot()); // redo (2), leaving \nB\n\n
    await finishRender();
    expect(cmb.getValue()).toEqual("\nB\n\n");
    expect(cmb.historySize()).toEqual({ undo: 2, redo: 1 });
    redo(currentFirstRoot()); // redo (3), leaving \nB\n\nC
    await finishRender();
    expect(cmb.getValue()).toEqual("\nB\n\nC");
    expect(cmb.historySize()).toEqual({ undo: 3, redo: 0 });
  });

  it("make sure edits can be properly undone/redone from the top level", async () => {
    cmb.setValue(`A\nB\n`);
    cmb.clearHistory();
    await finishRender();
    expect(cmb.historySize()).toEqual({ undo: 0, redo: 0 });

    mouseDown(currentFirstRoot()); // focus on the 1st root
    keyDown(" ", {}, currentFirstRoot());
    await finishRender();
    keyDown("X", cmd_ctrl, currentFirstRoot()); // change (1): cut first root
    await finishRender();
    expect(cmb.getValue()).toEqual("\nB\n");
    expect(cmb.historySize()).toEqual({ undo: 1, redo: 0 });
    cmb.setCursor({ line: 1, ch: 0 });
    undo(); // initiate undo from the top-level
    await finishRender();
    expect(cmb.getValue()).toEqual("A\nB\n");
    expect(cmb.historySize()).toEqual({ undo: 0, redo: 1 });
    redo(); // initiate redo from the top-level
    expect(cmb.getValue()).toEqual("\nB\n");
    expect(cmb.historySize()).toEqual({ undo: 1, redo: 0 });
  });
});
