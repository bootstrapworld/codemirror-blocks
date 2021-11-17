import wescheme from "../src/languages/wescheme";

import {
  cmd_ctrl,
  teardown,
  mouseDown,
  keyDown,
  mountCMB,
} from "../src/toolkit/test-utils";
import { API } from "../src/CodeMirrorBlocks";
import { ASTNode } from "../src/ast";
import { fireEvent } from "@testing-library/react";

let cmb: API;

const currentFirstRoot = () => cmb.getAst().rootNodes[0];
const undo = (node?: ASTNode) => keyDown("Z", cmd_ctrl, node);
const redo = (node?: ASTNode) => keyDown("Y", { ctrlKey: true }, node);

beforeEach(async () => {
  cmb = mountCMB(wescheme).cmb;
});

afterEach(teardown);

// https://github.com/bootstrapworld/codemirror-blocks/issues/315
it("make sure edits can be properly undone/redone from an active block", () => {
  // initialize state
  cmb.setValue(`A\nB\n`);
  cmb.clearHistory();
  expect(cmb.historySize()).toEqual({ undo: 0, redo: 0 });

  // change (1): cut first root
  mouseDown(currentFirstRoot()); // focus on the 1st root
  keyDown(" ", {}, currentFirstRoot());
  keyDown("X", cmd_ctrl, currentFirstRoot());
  expect(cmb.getValue()).toEqual("\nB\n");
  expect(cmb.historySize()).toEqual({ undo: 1, redo: 0 });

  // change (2): insert empty line
  cmb.setCursor({ line: 2, ch: 0 });
  keyDown("Enter");
  expect(cmb.getValue()).toEqual("\nB\n\n");
  expect(cmb.historySize()).toEqual({ undo: 2, redo: 0 });

  // change (3): insert C at the end
  fireEvent.keyPress(document.activeElement!, {
    key: "C",
    code: "KeyC",
    charCode: 67,
  });
  keyDown("Enter");

  expect(cmb.getValue()).toEqual("\nB\n\nC");
  expect(cmb.historySize()).toEqual({ undo: 3, redo: 0 });

  // undo (3), leaving \nB\n\n
  undo(currentFirstRoot());
  expect(cmb.getValue()).toEqual("\nB\n\n");
  expect(cmb.historySize()).toEqual({ undo: 2, redo: 1 });

  // undo (2), leaving \nB\n\n
  undo(currentFirstRoot());
  expect(cmb.getValue()).toEqual("\nB\n");
  expect(cmb.historySize()).toEqual({ undo: 1, redo: 2 });

  // undo (1), leaving A\nB\n
  undo(currentFirstRoot());
  expect(cmb.getValue()).toEqual("A\nB\n");
  expect(cmb.historySize()).toEqual({ undo: 0, redo: 3 });

  // redo (1), leaving \nB\n
  redo(currentFirstRoot());
  expect(cmb.getValue()).toEqual("\nB\n");
  expect(cmb.historySize()).toEqual({ undo: 1, redo: 2 });

  // redo (2), leaving \nB\n\n
  redo(currentFirstRoot());
  expect(cmb.getValue()).toEqual("\nB\n\n");
  expect(cmb.historySize()).toEqual({ undo: 2, redo: 1 });

  // redo (3), leaving \nB\n\nC
  redo(currentFirstRoot());
  expect(cmb.getValue()).toEqual("\nB\n\nC");
  expect(cmb.historySize()).toEqual({ undo: 3, redo: 0 });
});

it("make sure edits can be properly undone/redone from the top level", () => {
  // initialize the document
  cmb.setValue(`A\nB\n`);
  cmb.clearHistory();
  expect(cmb.historySize()).toEqual({ undo: 0, redo: 0 });

  // change (1): cut first root
  mouseDown(currentFirstRoot()); // focus on the 1st root
  keyDown(" ", {}, currentFirstRoot());
  keyDown("X", cmd_ctrl, currentFirstRoot());
  expect(cmb.getValue()).toEqual("\nB\n");
  expect(cmb.historySize()).toEqual({ undo: 1, redo: 0 });

  // initiate undo from the top-level
  cmb.setCursor({ line: 1, ch: 0 });
  undo();
  expect(cmb.getValue()).toEqual("A\nB\n");
  expect(cmb.historySize()).toEqual({ undo: 0, redo: 1 });

  // initiate redo from the top-level
  cmb.setCursor({ line: 1, ch: 0 });
  redo();
  expect(cmb.getValue()).toEqual("\nB\n");
  expect(cmb.historySize()).toEqual({ undo: 1, redo: 0 });
});
