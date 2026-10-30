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

const paste = (node: ASTNode) => keyDown("V", cmd_ctrl, node);
const pasteBefore = (node: ASTNode) =>
  keyDown("V", { ...cmd_ctrl, shiftKey: true }, node);
const select = (node: ASTNode) => {
  mouseDown(node);
  keyDown(" ", {}, node);
};
const root = (i: number) => cmb.getAst().rootNodes[i];
const argsOf = (node: ASTNode) =>
  (node as unknown as { fields: { args: ASTNode[] } }).fields.args;

describe("copy", () => {
  it("copies the focused node when nothing is selected", () => {
    cmb.setValue("(+ 1 2) 99");
    mouseDown(root(0));
    keyDown("C", cmd_ctrl, root(0));
    expect(clipboard.text).toBe("(+ 1 2)");
    expect(cmb.getValue()).toBe("(+ 1 2) 99"); // copying never edits
  });

  it("copies every selected node, in document order", () => {
    cmb.setValue("a b c");
    select(root(2));
    keyDown(" ", {}, root(0)); // select a second node, earlier in the text
    keyDown("C", cmd_ctrl, root(0));
    expect(clipboard.text).toBe("a c");
  });

  it("separates a commented node from its neighbours with newlines", () => {
    cmb.setValue("a\n;note\nb\nc");
    select(root(0));
    keyDown(" ", {}, root(1));
    keyDown("C", cmd_ctrl, root(1));
    expect(clipboard.text.split("\n").length).toBeGreaterThan(1);
    expect(clipboard.text).toContain("a");
    expect(clipboard.text).toContain("b");
  });

  it("doesn't change the selection", () => {
    cmb.setValue("a b");
    select(root(0));
    keyDown("C", cmd_ctrl, root(0));
    expect(cmb.getSelectedNodes().map((n) => n.toString())).toEqual(["a"]);
  });
});

describe("paste onto a selected node", () => {
  it("replaces a selected root", () => {
    cmb.setValue("a b");
    clipboard.text = "zzz";
    select(root(0));
    paste(root(0));
    expect(cmb.getValue()).toBe("zzz b");
  });

  it("replaces a selected child", () => {
    cmb.setValue("(f x y)");
    clipboard.text = "z";
    const x = argsOf(root(0))[0];
    select(x);
    paste(x);
    expect(cmb.getValue()).toBe("(f z y)");
  });

  it("clears the selection afterwards", () => {
    cmb.setValue("a b");
    clipboard.text = "zzz";
    select(root(0));
    paste(root(0));
    expect(cmb.getSelectedNodes()).toEqual([]);
  });

  it("can paste a whole expression over a node", () => {
    cmb.setValue("(f x y)");
    clipboard.text = "(g 1 2)";
    const y = argsOf(root(0))[1];
    select(y);
    paste(y);
    expect(cmb.getValue()).toBe("(f x (g 1 2))");
  });
});

describe("paste beside a root that isn't selected", () => {
  it("inserts after the root", () => {
    cmb.setValue("a b");
    clipboard.text = "zzz";
    mouseDown(root(0));
    paste(root(0));
    // roots are kept on separate lines
    expect(cmb.getValue()).toBe("a\nzzz\n b");
  });

  it("inserts before the root with Paste Before", () => {
    cmb.setValue("a b");
    clipboard.text = "zzz";
    mouseDown(root(1));
    pasteBefore(root(1));
    expect(cmb.getValue()).toBe("a \nzzz\nb");
  });
});

describe("paste beside a child that isn't selected", () => {
  it("inserts after the child, in the same field", () => {
    cmb.setValue("(f x y)");
    clipboard.text = "z";
    const x = argsOf(root(0))[0];
    mouseDown(x);
    paste(x);
    expect(cmb.getValue()).toBe("(f x z y)");
  });

  it("inserts before the child with Paste Before", () => {
    cmb.setValue("(f x y)");
    clipboard.text = "z";
    const y = argsOf(root(0))[1];
    mouseDown(y);
    pasteBefore(y);
    expect(cmb.getValue()).toBe("(f x z y)");
  });

  it("can paste several expressions at once", () => {
    cmb.setValue("(f x)");
    clipboard.text = "1 2 3";
    const x = argsOf(root(0))[0];
    mouseDown(x);
    paste(x);
    expect(cmb.getValue()).toBe("(f x 1 2 3)");
  });

  it("inserts as the first argument when pasting after the operator", () => {
    cmb.setValue("(f x)");
    clipboard.text = "z";
    const func = (root(0) as unknown as { fields: { func: ASTNode } }).fields
      .func;
    mouseDown(func);
    paste(func);
    expect(cmb.getValue()).toBe("(f z x)");
  });
});

describe("paste that can't be parsed", () => {
  it("leaves the document and the AST alone", () => {
    cmb.setValue("(f x y)");
    clipboard.text = "(((";
    const y = argsOf(root(0))[1];
    mouseDown(y);
    paste(y);
    expect(cmb.getValue()).toBe("(f x y)");
  });

  it("does nothing for an empty clipboard", () => {
    cmb.setValue("(f x y)");
    clipboard.text = "";
    const y = argsOf(root(0))[1];
    mouseDown(y);
    paste(y);
    expect(cmb.getValue()).toBe("(f x y)");
  });
});

describe("cut", () => {
  it("puts the selected nodes on the clipboard and deletes them", () => {
    cmb.setValue("(f x y)");
    const x = argsOf(root(0))[0];
    select(x);
    keyDown("X", cmd_ctrl, x);
    expect(clipboard.text).toBe("x");
    expect(cmb.getValue()).toBe("(f y)");
  });

  it("cut then paste moves a node", () => {
    cmb.setValue("(f x y)");
    const x = argsOf(root(0))[0];
    select(x);
    keyDown("X", cmd_ctrl, x);
    const y = argsOf(root(0))[0];
    mouseDown(y);
    paste(y);
    expect(cmb.getValue()).toBe("(f y x)");
  });

  it("does nothing when nothing is selected", () => {
    cmb.setValue("(f x y)");
    const x = argsOf(root(0))[0];
    mouseDown(x);
    keyDown("X", cmd_ctrl, x);
    expect(cmb.getValue()).toBe("(f x y)");
    expect(clipboard.text).toBe("");
  });
});
