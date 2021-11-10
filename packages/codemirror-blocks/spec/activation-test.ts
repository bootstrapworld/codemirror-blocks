import wescheme from "../src/languages/wescheme";
import "codemirror/addon/search/searchcursor.js";

import {
  cmd_ctrl,
  teardown,
  mouseDown,
  keyDown,
  insertText,
  finishRender,
  mountCMB,
} from "../src/toolkit/test-utils";
import { API } from "../src/CodeMirrorBlocks";
import { ASTNode } from "../src/ast";
import { FunctionAppNode } from "../src/nodes";

const activeAriaId = (cmb: API) =>
  cmb.getScrollerElement().getAttribute("aria-activedescendent");

// TODO(pcardune): replace the element property on an ASTNode with this function
const elementForNode = (node: ASTNode) =>
  document.getElementById(`block-node-${node.id}`);

describe("when dealing with node activation,", () => {
  let cmb!: API;
  let literal1!: ASTNode;
  let literal2!: ASTNode;
  beforeEach(async () => {
    cmb = await mountCMB(wescheme);
    cmb.setValue("11\n54");
    await finishRender();
    const ast = cmb.getAst();
    literal1 = ast.rootNodes[0];
    literal2 = ast.rootNodes[1];
  });

  afterEach(teardown);

  it("should only allow one node to be active at a time", async () => {
    mouseDown(literal1);
    await finishRender();
    mouseDown(literal2);
    await finishRender();
    expect(cmb.getFocusedNode()).not.toBe(literal1);
    expect(cmb.getFocusedNode()).toBe(literal2);
  });

  it("should put focus on the active node", async () => {
    mouseDown(literal1);
    await finishRender();
    expect(document.activeElement).toBe(literal1.element);
    expect(activeAriaId(cmb)).toBe(literal1.element!.id);
  });

  it("should not delete active nodes when the delete key is pressed", async () => {
    expect(cmb.getValue()).toBe("11\n54");
    mouseDown(literal1);
    await finishRender();
    expect(cmb.getFocusedNode()).toBe(literal1);

    keyDown("Delete");
    await finishRender();
    expect(cmb.getValue()).toBe("11\n54");
  });

  it("should activate the first node when down is pressed", async () => {
    mouseDown(literal1.element!);
    await finishRender();
    keyDown("[", { ctrlKey: true }, literal1.element!); // set cursor to the left
    await finishRender();
    keyDown("ArrowDown");
    await finishRender();
    expect(cmb.getFocusedNode()).toBe(literal1);
    expect(cmb.getScrollerElement().getAttribute("aria-activedescendent")).toBe(
      "block-node-" + literal1.id
    );
  });

  it("should activate the next node when down is pressed", async () => {
    mouseDown(literal1.element!);
    await finishRender();
    keyDown("ArrowDown");
    await finishRender();
    expect(cmb.getFocusedNode()).not.toBe(literal1);
    expect(cmb.getFocusedNode()).toBe(literal2);
    expect(activeAriaId(cmb)).toBe(literal2.element!.id);
  });

  it("should activate the node after the cursor when down is pressed", async () => {
    cmb.setCursor({ line: 0, ch: 2 });
    keyDown("ArrowDown");
    await finishRender();
    expect(cmb.getFocusedNode()).not.toBe(literal1);
    expect(cmb.getFocusedNode()).toBe(literal2);
    expect(activeAriaId(cmb)).toBe(literal2.element!.id);
  });

  it("should activate the node before the cursor when up is pressed", async () => {
    cmb.setCursor({ line: 0, ch: 2 });
    keyDown("ArrowUp");
    await finishRender();
    expect(cmb.getFocusedNode()).not.toBe(literal2);
    expect(cmb.getFocusedNode()).toBe(literal1);
    expect(activeAriaId(cmb)).toBe(literal1.element!.id);
  });

  it("should toggle the editability of activated node when Enter is pressed", async () => {
    mouseDown(literal1);
    await finishRender();
    expect(cmb.getFocusedNode()).toBe(literal1);
    expect(literal1.isEditable!()).toBe(false);

    keyDown("Enter");
    await finishRender();
    expect(literal1.isEditable!()).toBe(true);
  });

  it("should cancel the editability of activated node when Esc is pressed", async () => {
    mouseDown(literal1);
    await finishRender();
    expect(cmb.getFocusedNode()).toBe(literal1);

    keyDown("Enter");
    await finishRender();
    expect(document.activeElement).toBe(elementForNode(literal1));
    expect(elementForNode(literal1)).toHaveAttribute("contenteditable", "true");

    insertText("sugarPlums");
    expect(elementForNode(literal1)).toHaveTextContent("sugarPlums");

    keyDown("Escape");
    await finishRender();
    expect(elementForNode(literal1)).not.toHaveAttribute(
      "contenteditable",
      "true"
    );
    expect(cmb.getValue()).toBe("11\n54");
  });

  it("should cancel the editability of activated node when Alt-Q is pressed", async () => {
    mouseDown(literal1);
    await finishRender();
    expect(cmb.getFocusedNode()).toBe(literal1);

    keyDown("Enter");
    await finishRender();
    expect(literal1.isEditable!()).toBe(true);
    insertText("sugarPlums");

    keyDown("Q", { altKey: true });
    await finishRender();
    expect(literal1.isEditable!()).toBe(false);
    expect(cmb.getValue()).toBe("11\n54");
  });
});

describe("cut/copy/paste", () => {
  let cmb!: API;
  let literal1!: ASTNode;
  let literal2!: ASTNode;

  beforeEach(async () => {
    cmb = await mountCMB(wescheme);

    cmb.setValue("11\n54");
    await finishRender();
    const ast = cmb.getAst();
    literal1 = ast.rootNodes[0];
    literal2 = ast.rootNodes[1];
  });

  afterEach(teardown);

  it("should remove selected nodes on cut", async () => {
    mouseDown(literal1);
    await finishRender();
    keyDown(" ", {}, literal1);
    await finishRender();

    keyDown("X", cmd_ctrl, literal1);
    await finishRender();
    expect(cmb.getValue()).toBe("\n54");
    expect(cmb.getFocusedNode()!.id).toBe(literal2.id);
    expect(cmb.getFocusedNode()!.hash).toBe(literal2.hash);
  });

  it("should remove multiple selected nodes on cut", async () => {
    mouseDown(literal1);
    keyDown(" ", {}, literal1);
    await finishRender();
    keyDown("ArrowDown");
    keyDown(" ", {}, literal2);
    await finishRender();
    expect(cmb.getSelectedNodes().length).toBe(2);

    keyDown("X", cmd_ctrl, literal2);
    await finishRender();
    expect(cmb.getSelectedNodes().length).toBe(0);
    expect(cmb.getValue()).toBe("\n");
    expect(cmb.getFocusedNode()).toBe(undefined);
  });
});

describe("tree navigation", () => {
  let cmb!: API;
  let firstRoot: FunctionAppNode;
  let secondRoot: ASTNode;
  let thirdRoot: FunctionAppNode;
  let funcSymbol: ASTNode;
  let thirdArg: ASTNode;
  let nestedExpr: FunctionAppNode;
  let lastNode: ASTNode;

  beforeEach(async () => {
    cmb = await mountCMB(wescheme);

    cmb.setValue("(+ 1 2 3) 99 (* 7 (* 1 2))");
    const ast = cmb.getAst();
    firstRoot = ast.rootNodes[0] as FunctionAppNode;
    secondRoot = ast.rootNodes[1];
    thirdRoot = ast.rootNodes[2] as FunctionAppNode;
    funcSymbol = firstRoot.fields.func;
    thirdArg = firstRoot.fields.args[2];
    nestedExpr = thirdRoot.fields.args[1] as FunctionAppNode;
    lastNode = nestedExpr.fields.args[1];
    await finishRender();
  });

  afterEach(teardown);

  it("up-arrow should navigate to the previous visible node, but not beyond the tree", async () => {
    mouseDown(firstRoot);
    keyDown("ArrowLeft", {}, firstRoot); // collapse that root
    mouseDown(secondRoot);
    await finishRender();
    expect(cmb.getFocusedNode()).toBe(secondRoot);
    expect(activeAriaId(cmb)).toBe(secondRoot.element!.id);

    keyDown("ArrowUp");
    await finishRender();
    expect(cmb.getFocusedNode()).toBe(firstRoot);
    expect(activeAriaId(cmb)).toBe(firstRoot.element!.id);

    keyDown("ArrowUp");
    await finishRender();
    expect(cmb.getFocusedNode()).toBe(firstRoot);
    expect(activeAriaId(cmb)).toBe(firstRoot.element!.id);
  });

  it("down-arrow should navigate to the next sibling, but not beyond the tree", async () => {
    mouseDown(firstRoot);
    keyDown("ArrowLeft", {}, firstRoot); // collapse that root
    mouseDown(nestedExpr.fields.args[0]);
    await finishRender();
    expect(cmb.getFocusedNode()).toBe(nestedExpr.fields.args[0]);

    keyDown("ArrowDown");
    await finishRender();
    expect(cmb.getFocusedNode()).toBe(nestedExpr.fields.args[1]);
    expect(activeAriaId(cmb)).toBe(nestedExpr.fields.args[1].element!.id);

    keyDown("ArrowDown");
    await finishRender();
    expect(cmb.getFocusedNode()).toBe(nestedExpr.fields.args[1]);
    expect(activeAriaId(cmb)).toBe(nestedExpr.fields.args[1].element!.id);
  });

  it("left-arrow should collapse a block, if it can be", async () => {
    mouseDown(firstRoot);
    keyDown("ArrowLeft", {}, firstRoot); // collapse that root
    mouseDown(firstRoot);
    keyDown("ArrowLeft", {}, firstRoot); // collapse that root *again*
    await finishRender();
    expect(firstRoot.element!.getAttribute("aria-expanded")).toBe("false");

    mouseDown(secondRoot);
    keyDown("ArrowLeft", {}, secondRoot); // collapse that root
    await finishRender();
    expect(secondRoot.element!.getAttribute("aria-expanded")).toBe(null);
  });

  it("shift-left-arrow should collapse all blocks", async () => {
    mouseDown(firstRoot);
    keyDown("ArrowLeft", { shiftKey: true }, firstRoot);
    await finishRender();
    expect(firstRoot.element!.getAttribute("aria-expanded")).toBe("false");
    expect(secondRoot.element!.getAttribute("aria-expanded")).toBe(null);
    expect(thirdRoot.element!.getAttribute("aria-expanded")).toBe("false");
    expect(thirdArg.element!.getAttribute("aria-expanded")).toBe(null);
  });

  it("shift-right-arrow should expand all blocks", async () => {
    mouseDown(firstRoot);
    keyDown("ArrowLeft", { shiftKey: true }, firstRoot);
    await finishRender();
    keyDown("ArrowRight", { shiftKey: true }, firstRoot);
    expect(firstRoot.element!.getAttribute("aria-expanded")).toBe("true");
    expect(secondRoot.element!.getAttribute("aria-expanded")).toBe(null);
    expect(thirdRoot.element!.getAttribute("aria-expanded")).toBe("true");
    expect(nestedExpr.element!.getAttribute("aria-expanded")).toBe("true");
  });

  it("shift-alt-left-arrow should collapse only the currently-active root", async () => {
    mouseDown(lastNode);
    keyDown("ArrowLeft", { shiftKey: true }, firstRoot); // collapse all
    await finishRender();
    expect(firstRoot.element!.getAttribute("aria-expanded")).toBe("false");
    expect(secondRoot.element!.getAttribute("aria-expanded")).toBe(null);
    expect(thirdRoot.element!.getAttribute("aria-expanded")).toBe("false");
    expect(thirdArg.element!.getAttribute("aria-expanded")).toBe(null);
    keyDown("ArrowRight", { shiftKey: true, altKey: true }, lastNode);
    expect(firstRoot.element!.getAttribute("aria-expanded")).toBe("false");
    expect(secondRoot.element!.getAttribute("aria-expanded")).toBe(null);
    expect(thirdRoot.element!.getAttribute("aria-expanded")).toBe("true");
    expect(nestedExpr.element!.getAttribute("aria-expanded")).toBe("true");
  });

  it("shift-alt-right-arrow should expand only the currently-active root", async () => {
    mouseDown(lastNode);
    await finishRender();
    keyDown("ArrowLeft", { shiftKey: true, altKey: true }, lastNode);
    expect(firstRoot.element!.getAttribute("aria-expanded")).toBe("true");
    expect(secondRoot.element!.getAttribute("aria-expanded")).toBe(null);
    expect(thirdRoot.element!.getAttribute("aria-expanded")).toBe("false");
    expect(nestedExpr.element!.getAttribute("aria-expanded")).toBe("false");
  });

  it("less-than should activate root without collapsing", async () => {
    mouseDown(nestedExpr.fields.args[1]);
    keyDown("<", { shiftKey: true }, nestedExpr.fields.args[1]);
    await finishRender();
    expect(thirdRoot.element!.getAttribute("aria-expanded")).toBe("true");
    expect(cmb.getFocusedNode()).toBe(thirdRoot);
  });

  it("right-arrow should expand a block, or shift focus to 1st child", async () => {
    mouseDown(firstRoot);
    keyDown("ArrowLeft", {}, firstRoot);
    await finishRender();
    expect(firstRoot.element!.getAttribute("aria-expanded")).toBe("false");

    keyDown("ArrowRight");
    await finishRender();
    expect(cmb.getFocusedNode()).toBe(firstRoot);
    expect(firstRoot.element!.getAttribute("aria-expanded")).toBe("true");

    keyDown("ArrowRight");
    await finishRender();
    expect(cmb.getFocusedNode()).toBe(funcSymbol);
    expect(firstRoot.element!.getAttribute("aria-expanded")).toBe("true");
  });

  it("home should activate the first visible node", async () => {
    mouseDown(firstRoot);
    keyDown("ArrowLeft", {}, firstRoot);
    await finishRender();
    mouseDown(secondRoot);
    keyDown("Home");
    await finishRender();
    expect(cmb.getFocusedNode()).toBe(firstRoot);
    expect(activeAriaId(cmb)).toBe(firstRoot.element!.id);
  });

  // TODO: this test legitimately fails
  it("end should activate the last visible node", async () => {
    mouseDown(secondRoot);
    await finishRender();
    keyDown("End");
    await finishRender();
    expect(cmb.getFocusedNode()).toBe(lastNode);
    expect(activeAriaId(cmb)).toBe(lastNode.element!.id);
    mouseDown(nestedExpr);
    keyDown("ArrowLeft", {}, nestedExpr);
    await finishRender();
    mouseDown(secondRoot);
    keyDown("End");
    await finishRender();
    expect(cmb.getFocusedNode()).toBe(nestedExpr);
    expect(activeAriaId(cmb)).toBe(nestedExpr.element!.id);
  });
});

describe("when dealing with node selection, ", () => {
  let cmb!: API;
  let literal1!: ASTNode;
  let literal2!: ASTNode;
  let expr!: FunctionAppNode;
  beforeEach(async () => {
    cmb = await mountCMB(wescheme);

    cmb.setValue("11\n54\n(+ 1 2)");
    const ast = cmb.getAst();
    literal1 = ast.rootNodes[0];
    literal2 = ast.rootNodes[1];
    expr = ast.rootNodes[2] as FunctionAppNode;
    await finishRender();
  });

  afterEach(teardown);

  it("space key toggles selection on and off", async () => {
    mouseDown(literal1);
    keyDown(" ", {}, literal1);
    await finishRender();
    expect(literal1.element!.getAttribute("aria-selected")).toBe("true");
    expect(cmb.getSelectedNodes().length).toBe(1);

    keyDown(" ", {}, literal1);
    await finishRender();
    expect(literal1.element!.getAttribute("aria-selected")).toBe("false");
    expect(cmb.getSelectedNodes().length).toBe(0);
  });

  it("esc key clears selection", async () => {
    mouseDown(literal1);
    keyDown(" ", {}, literal1);
    await finishRender();
    expect(literal1.element!.getAttribute("aria-selected")).toBe("true");
    expect(cmb.getSelectedNodes().length).toBe(1);
    mouseDown(literal2);
    keyDown(" ", {}, literal2);
    await finishRender();
    expect(literal2.element!.getAttribute("aria-selected")).toBe("true");
    expect(cmb.getSelectedNodes().length).toBe(2);
    keyDown("Escape", {}, literal2);
    await finishRender();
    expect(cmb.getSelectedNodes().length).toBe(0);
  });

  it("Alt-Q key clears selection", async () => {
    mouseDown(literal1);
    keyDown(" ", {}, literal1);
    await finishRender();
    expect(literal1.element!.getAttribute("aria-selected")).toBe("true");
    expect(cmb.getSelectedNodes().length).toBe(1);
    mouseDown(literal2);
    keyDown(" ", {}, literal2);
    await finishRender();
    expect(literal2.element!.getAttribute("aria-selected")).toBe("true");
    expect(cmb.getSelectedNodes().length).toBe(2);
    keyDown("Q", { altKey: true }, literal2);
    await finishRender();
    expect(cmb.getSelectedNodes().length).toBe(0);
  });

  it("arrow preserves selection & changes active ", async () => {
    mouseDown(literal1);
    keyDown(" ", {}, literal1);
    await finishRender();
    keyDown("ArrowDown");
    await finishRender();
    expect(literal1.element!.getAttribute("aria-selected")).toBe("true");
    expect(literal2.element!.getAttribute("aria-selected")).toBe("false");
    expect(cmb.getFocusedNode()).toBe(literal2);
    expect(cmb.getSelectedNodes().length).toBe(1);
  });

  it("allow multiple, non-contiguous selection ", async () => {
    mouseDown(literal1);
    keyDown(" ", {}, literal1);
    await finishRender();
    keyDown("ArrowDown");
    await finishRender();
    keyDown("ArrowDown"); // skip over literal2
    await finishRender();
    keyDown(" ", {}, expr);
    await finishRender();
    expect(literal1.element!.getAttribute("aria-selected")).toBe("true");
    expect(literal2.element!.getAttribute("aria-selected")).toBe("false");
    expect(expr.element!.getAttribute("aria-selected")).toBe("true");
    expect(cmb.getFocusedNode()).toBe(expr);
    expect(cmb.getSelectedNodes().length).toBe(5);
  });

  it("selecting a parent, then deselecting a child should deselect the parent ", async () => {
    mouseDown(expr);
    keyDown(" ", {}, expr);
    await finishRender();
    keyDown("ArrowDown");
    await finishRender();
    keyDown(" ", {}, expr.fields.func);
    await finishRender();
    expect(expr.element!.getAttribute("aria-selected")).toBe("false");
    expect(expr.fields.func.element!.getAttribute("aria-selected")).toBe(
      "false"
    );
    expect(expr.fields.args[0].element!.getAttribute("aria-selected")).toBe(
      "true"
    );
    expect(expr.fields.args[1].element!.getAttribute("aria-selected")).toBe(
      "true"
    );
    expect(cmb.getFocusedNode()).toBe(expr.fields.func);
    expect(cmb.getSelectedNodes().length).toBe(2);
    expect(cmb.getSelectedNodes()[0]).toBe(expr.fields.args[0]);
  });

  it("selecting a child, then parent should select all children as well ", async () => {
    mouseDown(expr.fields.func);
    keyDown(" ", {}, expr.fields.func);
    await finishRender();
    keyDown("ArrowUp");
    await finishRender();
    keyDown(" ", {}, expr);
    await finishRender();
    expect(expr.element!.getAttribute("aria-selected")).toBe("true");
    expect(expr.fields.func.element!.getAttribute("aria-selected")).toBe(
      "true"
    );
    expect(cmb.getFocusedNode()).toBe(expr);
    expect(cmb.getSelectedNodes().length).toBe(4);
    expect(cmb.getSelectedNodes()[0]).toBe(expr);
  });
});
