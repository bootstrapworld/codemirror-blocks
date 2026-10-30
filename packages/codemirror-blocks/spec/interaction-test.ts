import wescheme from "../src/languages/wescheme";
import { act, fireEvent, screen } from "@testing-library/react";
import {
  cmd_ctrl,
  click,
  doubleClick,
  elementForNode,
  isNodeEditable,
  keyDown,
  mountCMB,
  mouseDown,
  teardown,
} from "../src/toolkit/test-utils";
import { API } from "../src/CodeMirrorBlocks";
import { ASTNode } from "../src/ast";
import { AppStore } from "../src/state/store";
import { setEditableText } from "./helpers/editing";

let cmb: API;
let store: AppStore;
beforeEach(() => {
  ({ cmb, store } = mountCMB(wescheme));
});
afterEach(teardown);

const root = (i = 0) => cmb.getAst().rootNodes[i];
const kids = (node: ASTNode) => [...node.children()];
const expanded = (node: ASTNode) =>
  elementForNode(node)?.getAttribute("aria-expanded");

describe("clicking", () => {
  beforeEach(() => {
    cmb.setValue("(f x y)\n42");
  });

  it("a literal starts editing it", () => {
    click(root(1));
    expect(isNodeEditable(root(1))).toBe(true);
  });

  it("an expression does not", () => {
    click(root(0));
    expect(isNodeEditable(root(0))).toBe(false);
  });

  it("a block in the toolbar neither edits it nor touches the document", () => {
    const sqrt = [...document.querySelectorAll(".Primitive")].find(
      (el) => el.textContent === "sqrt"
    )!;
    click(sqrt);
    expect(cmb.getValue()).toBe("(f x y)\n42");
    expect(cmb.getSelectedNodes()).toEqual([]);
  });

  it("empty editor space leaves the editor usable", () => {
    click(cmb.getWrapperElement());
    mouseDown(root(0));
    expect(cmb.getFocusedNode()?.id).toBe(root(0).id);
  });

  it("another block while editing saves the edit and focuses that block", () => {
    mouseDown(root(1));
    keyDown("Enter");
    setEditableText("7");
    mouseDown(root(0));
    expect(cmb.getValue()).toBe("(f x y)\n7");
    expect(cmb.getFocusedNode()?.toString()).toBe("(f x y)");
  });
});

describe("double-clicking", () => {
  beforeEach(() => {
    cmb.setValue("(f x y)");
  });

  it("collapses an expression, then expands it again", () => {
    expect(expanded(root())).toBe("true");
    doubleClick(root());
    expect(expanded(root())).toBe("false");
    doubleClick(root());
    expect(expanded(root())).toBe("true");
  });

  it("never changes the document", () => {
    doubleClick(root());
    doubleClick(root());
    expect(cmb.getValue()).toBe("(f x y)");
  });
});

describe("collapsing", () => {
  it("is remembered while other nodes are edited", () => {
    cmb.setValue("(f x)\n(g y)");
    doubleClick(root(0));
    expect(expanded(root(0))).toBe("false");
    const y = kids(root(1))[1];
    mouseDown(y);
    keyDown("Enter");
    setEditableText("zzz");
    keyDown("Enter");
    expect(cmb.getValue()).toBe("(f x)\n(g zzz)");
    expect(expanded(cmb.getAst().rootNodes[0])).toBe("false");
  });

  it("is forgotten for a node that is deleted", () => {
    cmb.setValue("(f x)\n(g y)");
    doubleClick(root(0));
    const id = root(0).id;
    expect(store.getState().collapsedList).toContain(id);
    mouseDown(root(0));
    keyDown(" ", {}, root(0));
    keyDown("Delete", {}, root(0));
    expect(store.getState().collapsedList).not.toContain(id);
  });

  it("applies to every root with Shift-Left, and is undone with Shift-Right", () => {
    cmb.setValue("(f x)\n(g y)");
    mouseDown(root(0));
    keyDown("ArrowLeft", { shiftKey: true }, root(0));
    expect(expanded(root(0))).toBe("false");
    expect(expanded(root(1))).toBe("false");
    keyDown("ArrowRight", { shiftKey: true });
    expect(expanded(root(0))).toBe("true");
    expect(expanded(root(1))).toBe("true");
  });

  it("doesn't stop a collapsed block being deleted, and undo brings it back", () => {
    cmb.setValue("(f x)\n(g y)");
    cmb.clearHistory();
    mouseDown(root(0));
    keyDown("ArrowLeft", {}, root(0));
    keyDown(" ", {}, root(0));
    keyDown("Delete", {}, root(0));
    expect(cmb.getAst().rootNodes).toHaveLength(1);
    keyDown("Z", cmd_ctrl);
    expect(cmb.getAst().rootNodes).toHaveLength(2);
  });
});

describe("selection", () => {
  beforeEach(() => {
    cmb.setValue("(f x y)\n42");
  });
  const select = (node: ASTNode) => {
    mouseDown(node);
    keyDown(" ", {}, node);
  };

  it("is dropped for a node that an edit removes", () => {
    select(root(1));
    expect(cmb.getSelectedNodes()).toHaveLength(1);
    cmb.replaceRange("", { line: 1, ch: 0 }, { line: 1, ch: 2 });
    expect(cmb.getSelectedNodes()).toEqual([]);
    expect(store.getState().selections).toEqual([]);
  });

  it("is kept for nodes an edit leaves alone", () => {
    select(root(0));
    const before = cmb.getSelectedNodes().map((n) => n.toString());
    expect(before).toContain("(f x y)");
    cmb.replaceRange(" 99", { line: 1, ch: 2 });
    expect(cmb.getSelectedNodes().map((n) => n.toString())).toContain(
      "(f x y)"
    );
  });

  it("is cleared when editing begins", () => {
    select(root(1));
    keyDown("Enter");
    expect(cmb.getSelectedNodes()).toEqual([]);
  });

  it("is empty after undoing an edit that removed the selected node", () => {
    cmb.clearHistory();
    select(root(1));
    keyDown("Delete", {}, root(1));
    keyDown("Z", cmd_ctrl);
    expect(cmb.getSelectedNodes()).toEqual([]);
  });
});

describe("moving focus between the editor and the toolbar", () => {
  const search = () =>
    screen.getByPlaceholderText("Search functions") as HTMLInputElement;
  const primitive = (name: string) =>
    [...document.querySelectorAll(".Primitive")].find(
      (el) => el.textContent === name
    ) as HTMLElement;

  beforeEach(() => {
    cmb.setValue("(f x)");
  });

  it("Shift-Tab goes to the search box", () => {
    mouseDown(root());
    keyDown("Tab", { shiftKey: true }, root());
    expect(document.activeElement).toBe(search());
  });

  it("Down from the search box focuses the first block, and Down again moves on", () => {
    act(() => search().focus());
    fireEvent.keyDown(search(), { key: "ArrowDown", keyCode: 40 });
    const [first, second] = [...document.querySelectorAll(".Primitive")];
    expect(document.activeElement).toBe(first);
    keyDown("ArrowDown", {}, first);
    expect(document.activeElement).toBe(second);
    keyDown("ArrowUp", {}, second);
    expect(document.activeElement).toBe(first);
  });

  it("Escape in the list returns to the search box", () => {
    act(() => primitive("sqrt").focus());
    keyDown("Escape", {}, primitive("sqrt"));
    expect(document.activeElement).toBe(search());
  });

  it("typing in the search box filters the blocks", () => {
    fireEvent.change(search(), { target: { value: "sqr" } });
    const names = [...document.querySelectorAll(".Primitive")].map(
      (el) => el.textContent
    );
    expect(names.length).toBeGreaterThan(0);
    expect(names.every((n) => n!.includes("sqr"))).toBe(true);
  });

  it("the toolbar is not reachable in text mode", () => {
    cmb.setBlockMode(false);
    expect(search()).toBeDisabled();
  });
});
