import { screen } from "@testing-library/react";
import wescheme from "../src/languages/wescheme";
import lambda from "../src/languages/lambda";
import {
  cmd_ctrl,
  elementForNode,
  keyDown,
  mountCMB,
  mouseDown,
  teardown,
} from "../src/toolkit/test-utils";
import { API } from "../src/CodeMirrorBlocks";
import { dragOnto, kids, select, typeChar } from "./helpers/gestures";
import { setEditableText } from "./helpers/editing";

/**
 * Situations the other specs don't reach (see doc/internal/test-plan.md):
 * dragging while something else is going on, undo across a mode switch, and
 * mounting and unmounting the editor in unusual states.
 */

let cmb: API;
afterEach(() => {
  jest.restoreAllMocks();
  teardown();
});

const root = (i = 0) => cmb.getAst().rootNodes[i];
const texts = () => cmb.getAst().rootNodes.map((n) => n.toString());
const undo = () => keyDown("Z", cmd_ctrl);

describe("dragging while a top-level quarantine is open", () => {
  beforeEach(() => {
    cmb = mountCMB(wescheme).cmb;
    cmb.setValue("(add a b) (sub c d)");
    cmb.clearHistory();
    cmb.setCursor({ line: 0, ch: 19 }); // the end of the line
    typeChar(cmb, "9");
    expect(document.activeElement?.getAttribute("contenteditable")).toBe(
      "true"
    );
    const a = kids(root(0))[1];
    const d = kids(root(1))[2];
    dragOnto(elementForNode(a)!, elementForNode(d)!);
  });

  it("commits what was typed first, then does the drop", () => {
    expect(cmb.getValue()).toBe("(add b) (sub c a)\n9");
    expect(texts()).toEqual(["(add b)", "(sub c a)", "9"]);
  });

  it("leaves no quarantine behind", () => {
    expect(document.querySelector('[contenteditable="true"]')).toBeNull();
  });

  it("is two undo steps: the drop, then the typing", () => {
    expect(cmb.historySize().undo).toBe(2);
    undo();
    expect(cmb.getValue()).toBe("(add a b) (sub c d)\n9");
    undo();
    expect(cmb.getValue()).toBe("(add a b) (sub c d)");
  });
});

describe("dragging one of several selected blocks", () => {
  // The drag carries only the block that was grabbed: the rest of the
  // selection is neither moved nor deselected.
  beforeEach(() => {
    cmb = mountCMB(wescheme).cmb;
    cmb.setValue("a b c d");
    cmb.clearHistory();
    select(root(0));
    select(root(1));
    expect(cmb.getSelectedNodes().map(String)).toEqual(["a", "b"]);
    dragOnto(elementForNode(root(0))!, elementForNode(root(3))!);
  });

  it("moves just the block that was grabbed, onto the target", () => {
    expect(cmb.getValue()).toBe("b c a");
  });

  it("leaves the other selected block where it was, still selected", () => {
    expect(cmb.getSelectedNodes().map(String)).toContain("b");
    expect(texts()[0]).toBe("b");
  });

  it("is one undo step", () => {
    undo();
    expect(cmb.getValue()).toBe("a b c d");
  });
});

describe("undo after switching modes", () => {
  beforeEach(() => {
    cmb = mountCMB(wescheme).cmb;
    cmb.setValue("(f x y)\n(g z)");
    cmb.clearHistory();
    const x = kids(root(0))[1];
    select(x);
    keyDown("Delete", {}, x);
    expect(cmb.getValue()).toBe("(f y)\n(g z)");
    expect(cmb.historySize().undo).toBe(1);
  });

  it("finds the history empty: switching replaces the CodeMirror editor", () => {
    cmb.setBlockMode(false);
    expect(cmb.historySize()).toEqual({ undo: 0, redo: 0 });
    cmb.setBlockMode(true);
    expect(cmb.historySize()).toEqual({ undo: 0, redo: 0 });
  });

  it("does nothing, harmlessly, when asked to undo what happened before", () => {
    cmb.setBlockMode(false);
    cmb.setBlockMode(true);
    undo();
    cmb.undo();
    expect(cmb.getValue()).toBe("(f y)\n(g z)");
    expect(texts()).toEqual(["(f y)", "(g z)"]);
  });

  it("undoes in text mode only what was typed in text mode", () => {
    cmb.setBlockMode(false);
    cmb.replaceRange("\n42", { line: 1, ch: 5 });
    expect(cmb.getValue()).toBe("(f y)\n(g z)\n42");
    cmb.undo();
    expect(cmb.getValue()).toBe("(f y)\n(g z)");
    cmb.undo(); // nothing left, and the delete is not undone
    expect(cmb.getValue()).toBe("(f y)\n(g z)");
  });

  it("still undoes what is done after switching back", () => {
    cmb.setBlockMode(false);
    cmb.setBlockMode(true);
    const g = root(1);
    select(g);
    keyDown("Delete", {}, g);
    expect(cmb.getValue()).toBe("(f y)\n");
    undo();
    expect(cmb.getValue()).toBe("(f y)\n(g z)");
    undo();
    expect(cmb.getValue()).toBe("(f y)\n(g z)");
  });
});

describe("unmounting the editor", () => {
  it("is fine while a top-level quarantine is open", () => {
    cmb = mountCMB(wescheme).cmb;
    cmb.setValue("(f x)");
    cmb.setCursor({ line: 0, ch: 5 });
    typeChar(cmb, "a");
    setEditableText("abc");
    expect(document.querySelector('[contenteditable="true"]')).not.toBeNull();
    expect(() => teardown()).not.toThrow();
    expect(document.querySelector(".CodeMirror")).toBeNull();
    expect(document.querySelector('[contenteditable="true"]')).toBeNull();
    // (the afterEach hook calls teardown again, so put the fixture back)
    document.body.insertAdjacentHTML("afterbegin", '<div id="root"></div>');
  });

  it("is fine while a block is being edited in place", () => {
    cmb = mountCMB(wescheme).cmb;
    cmb.setValue("(f x)");
    const x = kids(root())[1];
    mouseDown(x);
    keyDown("Enter", {}, x);
    expect(document.activeElement?.getAttribute("contenteditable")).toBe(
      "true"
    );
    expect(() => teardown()).not.toThrow();
    expect(document.querySelector('[contenteditable="true"]')).toBeNull();
    document.body.insertAdjacentHTML("afterbegin", '<div id="root"></div>');
  });
});

describe("mounting again with a different language", () => {
  it("shows only the new language's blocks and toolbar", () => {
    cmb = mountCMB(wescheme).cmb;
    cmb.setValue("(f x y)");
    expect(document.querySelectorAll(".Primitive").length).toBeGreaterThan(0);
    teardown();

    cmb = mountCMB(lambda).cmb;
    cmb.setValue("1 + 2");
    expect(cmb.getAst().language.id).toBe("lambda");
    expect(texts()).toEqual(["1 + 2"]);
    expect([...cmb.getAst().descendants()].map((n) => n.type)).toEqual([
      "prog",
      "binary",
      "literal",
      "literal",
    ]);
    expect(document.querySelector(".blocks-functionApp")).toBeNull();
    expect(document.querySelectorAll(".Primitive")).toHaveLength(0);
  });

  it("goes back to the first language with nothing left over", () => {
    cmb = mountCMB(lambda).cmb;
    cmb.setValue("1 + 2");
    teardown();
    cmb = mountCMB(wescheme).cmb;
    cmb.setValue("(f x y)");
    expect(cmb.getAst().language.id).toBe("wescheme");
    expect(texts()).toEqual(["(f x y)"]);
    expect(document.querySelector(".blocks-binary")).toBeNull();
    expect(document.querySelectorAll(".Primitive").length).toBeGreaterThan(0);
  });
});

describe("a language with no primitivesFn", () => {
  beforeEach(() => {
    cmb = mountCMB(lambda).cmb;
    cmb.setValue("1 + 2");
  });

  it("has a toolbar, with nothing in it", () => {
    expect(screen.getByPlaceholderText("Search functions")).toBeEnabled();
    expect(document.querySelectorAll(".Primitive")).toHaveLength(0);
  });

  it("can still be searched and navigated without errors", () => {
    const search = screen.getByPlaceholderText("Search functions");
    keyDown("a", {}, search);
    keyDown("Escape", {}, search);
    keyDown("ArrowDown", {}, search);
    expect(cmb.getValue()).toBe("1 + 2");
  });

  it("is disabled in text mode, and back again in block mode", () => {
    cmb.setBlockMode(false);
    expect(screen.getByPlaceholderText("Search functions")).toBeDisabled();
    cmb.setBlockMode(true);
    expect(screen.getByPlaceholderText("Search functions")).toBeEnabled();
  });
});
