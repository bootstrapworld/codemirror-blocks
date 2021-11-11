import { ASTNode } from "../src/ast";
import { API } from "../src/CodeMirrorBlocks";
import wescheme from "../src/languages/wescheme";
import type { FunctionAppNode, LiteralNode } from "../src/nodes";

import {
  teardown,
  mouseDown,
  keyDown,
  insertText,
  mountCMB,
} from "../src/toolkit/test-utils";

describe("focusing,", () => {
  let cmb!: API;

  let expression!: FunctionAppNode;
  let func!: ASTNode;
  let literal1!: ASTNode;
  let literal2!: ASTNode;
  let literal3!: ASTNode;

  beforeEach(async () => {
    cmb = mountCMB(wescheme).cmb;
    cmb.setValue("(+ 1 2 3)");
    expression = cmb.getAst().rootNodes[0] as FunctionAppNode;
    func = expression.fields.func;
    literal1 = expression.fields.args[0];
    literal2 = expression.fields.args[1];
    literal3 = expression.fields.args[2];
  });

  afterEach(teardown);

  it("tabbing to the editor for the first time should activate node 0", async () => {
    cmb.focus();
    expect(cmb.getFocusedNode()!.nid).toBe(0);
  });

  it("deleting the last node should shift focus to the next-to-last", async () => {
    mouseDown(literal3);
    expect(document.activeElement).toBe(literal3.element);
    keyDown(" ");
    keyDown("Delete");
    expect(cmb.getValue()).toBe("(+ 1 2)");
    expect(cmb.getFocusedNode()!.id).toBe(literal2.id);
  });

  it("deleting the first node should shift focus to the parent", async () => {
    mouseDown(literal1);
    expect(document.activeElement).toBe(literal1.element);
    keyDown(" ");
    keyDown("Delete");
    expect(cmb.getValue()).toBe("(+ 2 3)");
    expect(cmb.getFocusedNode()!.id).toBe(func.id);
  });

  it("deleting the nth node should shift focus to n-1", async () => {
    mouseDown(literal2);
    expect(document.activeElement).toBe(literal2.element);
    keyDown(" ");
    keyDown("Delete");
    expect(cmb.getValue()).toBe("(+ 1 3)");
    expect(cmb.getFocusedNode()!.id).toBe(literal1.id);
  });

  it("deleting multiple nodes should shift focus to the one before", async () => {
    mouseDown(literal2);
    keyDown(" ");
    keyDown("ArrowDown");
    keyDown(" ", {}, literal3);
    expect(cmb.getSelectedNodes().length).toBe(2);
    keyDown("Delete");
    expect(cmb.getValue()).toBe("(+ 1)");
    expect(cmb.getFocusedNode()!.id).toBe(literal1.id);
  });

  it("inserting a node should put focus on the new node", async () => {
    mouseDown(literal1);
    keyDown("]", { ctrlKey: true });
    insertText("99"); // in place of 2x keydown
    keyDown("Enter");
    // extra WS is removed when we switch back to text, but in blockmode
    // there's an extra space inserted after 99
    expect(cmb.getValue()).toBe("(+ 1 99 2 3)");
    // TODO(Emmanuel): does getFocusedNode().value always return strings?
    expect((cmb.getFocusedNode() as LiteralNode).fields.value).toBe("99");
  });

  it("inserting multiple nodes should put focus on the last of the new nodes", async () => {
    mouseDown(literal1);
    keyDown("]", { ctrlKey: true });
    insertText("99 88 77");
    keyDown("Enter");
    expect(cmb.getValue()).toBe("(+ 1 99 88 77 2 3)");
    // TODO(Emmanuel): does getFocusedNode().value always return strings?
    expect((cmb.getFocusedNode() as LiteralNode).fields.value).toBe("77");
  });
});
