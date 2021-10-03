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
import { FunctionApp } from "../src/nodes";

console.log("Doing activation-test.js");

const activeAriaId = (cmb: API) =>
  cmb.getScrollerElement().getAttribute("aria-activedescendent");

describe("when dealing with node activation,", () => {
  let cmb!: API;
  let literal1!: ASTNode;
  let literal2!: ASTNode;
  beforeEach(async () => {
    cmb = await mountCMB(wescheme);
    cmb.setValue("11\n54");
    await finishRender(cmb);
    let ast = cmb.getAst();
    literal1 = ast.rootNodes[0];
    literal2 = ast.rootNodes[1];
  });

  afterEach(() => {
    teardown();
  });

  it("should only allow one node to be active at a time", async () => {
    mouseDown(literal1);
    await finishRender(cmb);
    mouseDown(literal2);
    await finishRender(cmb);
    expect(cmb.getFocusedNode()).not.toBe(literal1);
    expect(cmb.getFocusedNode()).toBe(literal2);
  });

  it("should put focus on the active node", async () => {
    mouseDown(literal1);
    await finishRender(cmb);
    expect(document.activeElement).toBe(literal1.element);
    expect(activeAriaId(cmb)).toBe(literal1.element.id);
  });

  it("should not delete active nodes when the delete key is pressed", async () => {
    expect(cmb.getValue()).toBe("11\n54");
    mouseDown(literal1);
    await finishRender(cmb);
    expect(cmb.getFocusedNode()).toBe(literal1);

    keyDown("Delete");
    await finishRender(cmb);
    expect(cmb.getValue()).toBe("11\n54");
  });

  it("should activate the first node when down is pressed", async () => {
    mouseDown(literal1.element);
    keyDown("[", { ctrlKey: true }, literal1.element); // set cursor to the left
    await finishRender(cmb);
    keyDown("ArrowDown");
    await finishRender(cmb);
    expect(cmb.getFocusedNode()).toBe(literal1);
    expect(cmb.getScrollerElement().getAttribute("aria-activedescendent")).toBe(
      "block-node-" + literal1.id
    );
  });

  it("should activate the next node when down is pressed", async () => {
    keyDown("ArrowDown");
    keyDown("ArrowDown");
    await finishRender(cmb);
    expect(cmb.getFocusedNode()).not.toBe(literal1);
    expect(cmb.getFocusedNode()).toBe(literal2);
    expect(activeAriaId(cmb)).toBe(literal2.element.id);
  });

  it("should activate the node after the cursor when down is pressed", async () => {
    cmb.setCursor({ line: 0, ch: 2 });
    keyDown("ArrowDown");
    await finishRender(cmb);
    expect(cmb.getFocusedNode()).not.toBe(literal1);
    expect(cmb.getFocusedNode()).toBe(literal2);
    expect(activeAriaId(cmb)).toBe(literal2.element.id);
  });

  it("should activate the node before the cursor when up is pressed", async () => {
    cmb.setCursor({ line: 0, ch: 2 });
    keyDown("ArrowUp");
    await finishRender(cmb);
    expect(cmb.getFocusedNode()).not.toBe(literal2);
    expect(cmb.getFocusedNode()).toBe(literal1);
    expect(activeAriaId(cmb)).toBe(literal1.element.id);
  });

  it("should toggle the editability of activated node when Enter is pressed", async () => {
    mouseDown(literal1);
    await finishRender(cmb);
    expect(cmb.getFocusedNode()).toBe(literal1);
    expect(literal1.isEditable()).toBe(false);

    keyDown("Enter");
    await finishRender(cmb);
    expect(literal1.isEditable()).toBe(true);
  });

  it("should cancel the editability of activated node when Esc is pressed", async () => {
    mouseDown(literal1);
    await finishRender(cmb);
    expect(cmb.getFocusedNode()).toBe(literal1);

    keyDown("Enter");
    await finishRender(cmb);
    expect(literal1.isEditable()).toBe(true);
    insertText("sugarPlums");

    keyDown("Escape");
    await finishRender(cmb);
    expect(literal1.isEditable()).toBe(false);
    expect(cmb.getValue()).toBe("11\n54");
  });

  it("should cancel the editability of activated node when Alt-Q is pressed", async () => {
    mouseDown(literal1);
    await finishRender(cmb);
    expect(cmb.getFocusedNode()).toBe(literal1);

    keyDown("Enter");
    await finishRender(cmb);
    expect(literal1.isEditable()).toBe(true);
    insertText("sugarPlums");

    keyDown("Q", { altKey: true });
    await finishRender(cmb);
    expect(literal1.isEditable()).toBe(false);
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
    await finishRender(cmb);
    let ast = cmb.getAst();
    literal1 = ast.rootNodes[0];
    literal2 = ast.rootNodes[1];
  });

  afterEach(() => {
    teardown();
  });

  it("should remove selected nodes on cut", async () => {
    mouseDown(literal1);
    await finishRender(cmb);
    keyDown(" ", {}, literal1);
    await finishRender(cmb);

    keyDown("X", cmd_ctrl, literal1);
    await finishRender(cmb);
    expect(cmb.getValue()).toBe("\n54");
    expect(cmb.getFocusedNode().id).toBe(literal2.id);
    expect(cmb.getFocusedNode().hash).toBe(literal2.hash);
  });

  it("should remove multiple selected nodes on cut", async () => {
    mouseDown(literal1);
    keyDown(" ", {}, literal1);
    await finishRender(cmb);
    keyDown("ArrowDown");
    keyDown(" ", {}, literal2);
    await finishRender(cmb);
    expect(cmb.getSelectedNodes().length).toBe(2);

    keyDown("X", cmd_ctrl, literal2);
    await finishRender(cmb);
    expect(cmb.getSelectedNodes().length).toBe(0);
    expect(cmb.getValue()).toBe("\n");
    expect(cmb.getFocusedNode()).toBe(undefined);
  });
});

describe("tree navigation", () => {
  let cmb!: API;
  let firstRoot: FunctionApp;
  let secondRoot: ASTNode;
  let thirdRoot: FunctionApp;
  let funcSymbol: ASTNode;
  let firstArg: ASTNode;
  let secondArg: ASTNode;
  let thirdArg: ASTNode;
  let nestedExpr: FunctionApp;
  let lastNode: ASTNode;

  beforeEach(async () => {
    cmb = await mountCMB(wescheme);

    cmb.setValue("(+ 1 2 3) 99 (* 7 (* 1 2))");
    let ast = cmb.getAst();
    firstRoot = ast.rootNodes[0] as FunctionApp;
    secondRoot = ast.rootNodes[1];
    thirdRoot = ast.rootNodes[2] as FunctionApp;
    funcSymbol = firstRoot.func;
    firstArg = firstRoot.args[0];
    secondArg = firstRoot.args[1];
    thirdArg = firstRoot.args[2];
    nestedExpr = thirdRoot.args[1] as FunctionApp;
    lastNode = nestedExpr.args[1];
    await finishRender(cmb);
  });

  afterEach(() => {
    teardown();
  });

  it("up-arrow should navigate to the previous visible node, but not beyond the tree", async () => {
    mouseDown(firstRoot);
    keyDown("ArrowLeft", {}, firstRoot); // collapse that root
    mouseDown(secondRoot);
    await finishRender(cmb);
    expect(cmb.getFocusedNode()).toBe(secondRoot);
    expect(activeAriaId(cmb)).toBe(secondRoot.element.id);

    keyDown("ArrowUp");
    await finishRender(cmb);
    expect(cmb.getFocusedNode()).toBe(firstRoot);
    expect(activeAriaId(cmb)).toBe(firstRoot.element.id);

    keyDown("ArrowUp");
    await finishRender(cmb);
    expect(cmb.getFocusedNode()).toBe(firstRoot);
    expect(activeAriaId(cmb)).toBe(firstRoot.element.id);
  });

  it("down-arrow should navigate to the next sibling, but not beyond the tree", async () => {
    mouseDown(firstRoot);
    keyDown("ArrowLeft", {}, firstRoot); // collapse that root
    mouseDown(nestedExpr.args[0]);
    await finishRender(cmb);
    expect(cmb.getFocusedNode()).toBe(nestedExpr.args[0]);

    keyDown("ArrowDown");
    await finishRender(cmb);
    expect(cmb.getFocusedNode()).toBe(nestedExpr.args[1]);
    expect(activeAriaId(cmb)).toBe(nestedExpr.args[1].element.id);

    keyDown("ArrowDown");
    await finishRender(cmb);
    expect(cmb.getFocusedNode()).toBe(nestedExpr.args[1]);
    expect(activeAriaId(cmb)).toBe(nestedExpr.args[1].element.id);
  });

  it("left-arrow should collapse a block, if it can be", async () => {
    mouseDown(firstRoot);
    keyDown("ArrowLeft", {}, firstRoot); // collapse that root
    mouseDown(firstRoot);
    keyDown("ArrowLeft", {}, firstRoot); // collapse that root *again*
    await finishRender(cmb);
    expect(firstRoot.element.getAttribute("aria-expanded")).toBe("false");

    mouseDown(secondRoot);
    keyDown("ArrowLeft", {}, secondRoot); // collapse that root
    await finishRender(cmb);
    expect(secondRoot.element.getAttribute("aria-expanded")).toBe(null);
  });

  it("shift-left-arrow should collapse all blocks", async () => {
    mouseDown(firstRoot);
    keyDown("ArrowLeft", { shiftKey: true }, firstRoot);
    await finishRender(cmb);
    expect(firstRoot.element.getAttribute("aria-expanded")).toBe("false");
    expect(secondRoot.element.getAttribute("aria-expanded")).toBe(null);
    expect(thirdRoot.element.getAttribute("aria-expanded")).toBe("false");
    expect(thirdArg.element.getAttribute("aria-expanded")).toBe(null);
  });

  it("shift-right-arrow should expand all blocks", async () => {
    mouseDown(firstRoot);
    keyDown("ArrowLeft", { shiftKey: true }, firstRoot);
    await finishRender(cmb);
    keyDown("ArrowRight", { shiftKey: true }, firstRoot);
    expect(firstRoot.element.getAttribute("aria-expanded")).toBe("true");
    expect(secondRoot.element.getAttribute("aria-expanded")).toBe(null);
    expect(thirdRoot.element.getAttribute("aria-expanded")).toBe("true");
    expect(nestedExpr.element.getAttribute("aria-expanded")).toBe("true");
  });

  it("shift-alt-left-arrow should collapse only the currently-active root", async () => {
    mouseDown(lastNode);
    keyDown("ArrowLeft", { shiftKey: true }, firstRoot); // collapse all
    await finishRender(cmb);
    expect(firstRoot.element.getAttribute("aria-expanded")).toBe("false");
    expect(secondRoot.element.getAttribute("aria-expanded")).toBe(null);
    expect(thirdRoot.element.getAttribute("aria-expanded")).toBe("false");
    expect(thirdArg.element.getAttribute("aria-expanded")).toBe(null);
    keyDown("ArrowRight", { shiftKey: true, altKey: true }, lastNode);
    expect(firstRoot.element.getAttribute("aria-expanded")).toBe("false");
    expect(secondRoot.element.getAttribute("aria-expanded")).toBe(null);
    expect(thirdRoot.element.getAttribute("aria-expanded")).toBe("true");
    expect(nestedExpr.element.getAttribute("aria-expanded")).toBe("true");
  });

  it("shift-alt-right-arrow should expand only the currently-active root", async () => {
    mouseDown(lastNode);
    await finishRender(cmb);
    keyDown("ArrowLeft", { shiftKey: true, altKey: true }, lastNode);
    expect(firstRoot.element.getAttribute("aria-expanded")).toBe("true");
    expect(secondRoot.element.getAttribute("aria-expanded")).toBe(null);
    expect(thirdRoot.element.getAttribute("aria-expanded")).toBe("false");
    expect(nestedExpr.element.getAttribute("aria-expanded")).toBe("false");
  });

  it("less-than should activate root without collapsing", async () => {
    mouseDown(nestedExpr.args[1]);
    keyDown("<", { shiftKey: true }, nestedExpr.args[1]);
    await finishRender(cmb);
    expect(thirdRoot.element.getAttribute("aria-expanded")).toBe("true");
    expect(cmb.getFocusedNode()).toBe(thirdRoot);
  });

  it("right-arrow should expand a block, or shift focus to 1st child", async () => {
    mouseDown(firstRoot);
    keyDown("ArrowLeft", {}, firstRoot);
    await finishRender(cmb);
    expect(firstRoot.element.getAttribute("aria-expanded")).toBe("false");

    keyDown("ArrowRight");
    await finishRender(cmb);
    expect(cmb.getFocusedNode()).toBe(firstRoot);
    expect(firstRoot.element.getAttribute("aria-expanded")).toBe("true");

    keyDown("ArrowRight");
    await finishRender(cmb);
    expect(cmb.getFocusedNode()).toBe(funcSymbol);
    expect(firstRoot.element.getAttribute("aria-expanded")).toBe("true");
  });

  it("home should activate the first visible node", async () => {
    mouseDown(firstRoot);
    keyDown("ArrowLeft", {}, firstRoot);
    await finishRender(cmb);
    mouseDown(secondRoot);
    keyDown("Home");
    await finishRender(cmb);
    expect(cmb.getFocusedNode()).toBe(firstRoot);
    expect(activeAriaId(cmb)).toBe(firstRoot.element.id);
  });

  // TODO: this test legitimately fails
  it("end should activate the last visible node", async () => {
    mouseDown(secondRoot);
    await finishRender(cmb);
    keyDown("End");
    await finishRender(cmb);
    expect(cmb.getFocusedNode()).toBe(lastNode);
    expect(activeAriaId(cmb)).toBe(lastNode.element.id);
    mouseDown(nestedExpr);
    keyDown("ArrowLeft", {}, nestedExpr);
    await finishRender(cmb);
    mouseDown(secondRoot);
    keyDown("End");
    await finishRender(cmb);
    expect(cmb.getFocusedNode()).toBe(nestedExpr);
    expect(activeAriaId(cmb)).toBe(nestedExpr.element.id);
  });
});

describe("when dealing with node selection, ", () => {
  let cmb!: API;
  let literal1!: ASTNode;
  let literal2!: ASTNode;
  let expr!: FunctionApp;
  beforeEach(async () => {
    cmb = await mountCMB(wescheme);

    cmb.setValue("11\n54\n(+ 1 2)");
    let ast = cmb.getAst();
    literal1 = ast.rootNodes[0];
    literal2 = ast.rootNodes[1];
    expr = ast.rootNodes[2] as FunctionApp;
    await finishRender(cmb);
  });

  afterEach(() => {
    teardown();
  });

  it("space key toggles selection on and off", async () => {
    mouseDown(literal1);
    keyDown(" ", {}, literal1);
    await finishRender(cmb);
    expect(literal1.element.getAttribute("aria-selected")).toBe("true");
    expect(cmb.getSelectedNodes().length).toBe(1);

    keyDown(" ", {}, literal1);
    await finishRender(cmb);
    expect(literal1.element.getAttribute("aria-selected")).toBe("false");
    expect(cmb.getSelectedNodes().length).toBe(0);
  });

  it("esc key clears selection", async () => {
    mouseDown(literal1);
    keyDown(" ", {}, literal1);
    await finishRender(cmb);
    expect(literal1.element.getAttribute("aria-selected")).toBe("true");
    expect(cmb.getSelectedNodes().length).toBe(1);
    mouseDown(literal2);
    keyDown(" ", {}, literal2);
    await finishRender(cmb);
    expect(literal2.element.getAttribute("aria-selected")).toBe("true");
    expect(cmb.getSelectedNodes().length).toBe(2);
    keyDown("Escape", {}, literal2);
    await finishRender(cmb);
    expect(cmb.getSelectedNodes().length).toBe(0);
  });

  it("Alt-Q key clears selection", async () => {
    mouseDown(literal1);
    keyDown(" ", {}, literal1);
    await finishRender(cmb);
    expect(literal1.element.getAttribute("aria-selected")).toBe("true");
    expect(cmb.getSelectedNodes().length).toBe(1);
    mouseDown(literal2);
    keyDown(" ", {}, literal2);
    await finishRender(cmb);
    expect(literal2.element.getAttribute("aria-selected")).toBe("true");
    expect(cmb.getSelectedNodes().length).toBe(2);
    keyDown("Q", { altKey: true }, literal2);
    await finishRender(cmb);
    expect(cmb.getSelectedNodes().length).toBe(0);
  });

  it("arrow preserves selection & changes active ", async () => {
    mouseDown(literal1);
    keyDown(" ", {}, literal1);
    await finishRender(cmb);
    keyDown("ArrowDown");
    await finishRender(cmb);
    expect(literal1.element.getAttribute("aria-selected")).toBe("true");
    expect(literal2.element.getAttribute("aria-selected")).toBe("false");
    expect(cmb.getFocusedNode()).toBe(literal2);
    expect(cmb.getSelectedNodes().length).toBe(1);
  });

  it("allow multiple, non-contiguous selection ", async () => {
    mouseDown(literal1);
    keyDown(" ", {}, literal1);
    await finishRender(cmb);
    keyDown("ArrowDown");
    await finishRender(cmb);
    keyDown("ArrowDown"); // skip over literal2
    await finishRender(cmb);
    keyDown(" ", {}, expr);
    await finishRender(cmb);
    expect(literal1.element.getAttribute("aria-selected")).toBe("true");
    expect(literal2.element.getAttribute("aria-selected")).toBe("false");
    expect(expr.element.getAttribute("aria-selected")).toBe("true");
    expect(cmb.getFocusedNode()).toBe(expr);
    expect(cmb.getSelectedNodes().length).toBe(5);
  });

  it("selecting a parent, then deselecting a child should deselect the parent ", async () => {
    mouseDown(expr);
    keyDown(" ", {}, expr);
    await finishRender(cmb);
    keyDown("ArrowDown");
    await finishRender(cmb);
    keyDown(" ", {}, expr.func);
    await finishRender(cmb);
    expect(expr.element.getAttribute("aria-selected")).toBe("false");
    expect(expr.func.element.getAttribute("aria-selected")).toBe("false");
    expect(expr.args[0].element.getAttribute("aria-selected")).toBe("true");
    expect(expr.args[1].element.getAttribute("aria-selected")).toBe("true");
    expect(cmb.getFocusedNode()).toBe(expr.func);
    expect(cmb.getSelectedNodes().length).toBe(2);
    expect(cmb.getSelectedNodes()[0]).toBe(expr.args[0]);
  });

  it("selecting a child, then parent should select all children as well ", async () => {
    mouseDown(expr.func);
    keyDown(" ", {}, expr.func);
    await finishRender(cmb);
    keyDown("ArrowUp");
    await finishRender(cmb);
    keyDown(" ", {}, expr);
    await finishRender(cmb);
    expect(expr.element.getAttribute("aria-selected")).toBe("true");
    expect(expr.func.element.getAttribute("aria-selected")).toBe("true");
    expect(cmb.getFocusedNode()).toBe(expr);
    expect(cmb.getSelectedNodes().length).toBe(4);
    expect(cmb.getSelectedNodes()[0]).toBe(expr);
  });
});