import wescheme from "../src/languages/wescheme";
import {
  cmd_ctrl,
  elementForNode,
  keyDown,
  mountCMB,
  mouseDown,
  teardown,
  blur,
} from "../src/toolkit/test-utils";
import { API } from "../src/CodeMirrorBlocks";
import { ASTNode } from "../src/ast";
import { AppStore } from "../src/state/store";
import { fireEvent, screen } from "@testing-library/react";
import { allowConsoleErrors } from "./globalSetup";
import { setEditableText } from "./helpers/editing";

let cmb: API;
let store: AppStore;
beforeEach(() => {
  ({ cmb, store } = mountCMB(wescheme));
});
afterEach(teardown);

const root = (i = 0) => cmb.getAst().rootNodes[i];
const argsOf = (node: ASTNode) =>
  (node as unknown as { fields: { args: ASTNode[] } }).fields.args;
const editing = (node: ASTNode) => elementForNode(node);
const startEditing = (node: ASTNode) => {
  mouseDown(node);
  keyDown("Enter");
};
const undoSteps = () => cmb.historySize().undo;

describe("editing an existing node in place", () => {
  beforeEach(() => {
    cmb.setValue("42\n(f x y)");
    cmb.clearHistory();
  });

  it("saves a valid value on Enter", () => {
    startEditing(root());
    setEditableText("7");
    keyDown("Enter");
    expect(cmb.getValue()).toBe("7\n(f x y)");
  });

  it("saves a valid value when focus leaves (blur)", () => {
    startEditing(root());
    setEditableText("7");
    blur(document.activeElement!);
    expect(cmb.getValue()).toBe("7\n(f x y)");
  });

  it("can replace a literal with an expression", () => {
    startEditing(root());
    setEditableText("(g 1)");
    keyDown("Enter");
    expect(cmb.getValue()).toBe("(g 1)\n(f x y)");
  });

  it("splits into two roots when given two expressions", () => {
    startEditing(root());
    setEditableText("1 2");
    keyDown("Enter");
    expect(cmb.getAst().rootNodes.map((n) => n.toString())).toEqual([
      "1",
      "2",
      "(f x y)",
    ]);
  });

  it("edits a child in place", () => {
    const x = argsOf(root(1))[0];
    startEditing(x);
    setEditableText("zzz");
    keyDown("Enter");
    expect(cmb.getValue()).toBe("42\n(f zzz y)");
  });

  it("is one undo step", () => {
    startEditing(root());
    setEditableText("7");
    keyDown("Enter");
    expect(undoSteps()).toBe(1);
    keyDown("Z", cmd_ctrl);
    expect(cmb.getValue()).toBe("42\n(f x y)");
  });

  it("does nothing if the value is unchanged", () => {
    startEditing(root());
    keyDown("Enter");
    expect(cmb.getValue()).toBe("42\n(f x y)");
    expect(undoSteps()).toBe(0);
  });

  it("does nothing if the value is emptied", () => {
    startEditing(root());
    setEditableText("");
    keyDown("Enter");
    expect(cmb.getValue()).toBe("42\n(f x y)");
    expect(undoSteps()).toBe(0);
  });

  it("restores focus to a block afterwards", () => {
    startEditing(root());
    setEditableText("7");
    keyDown("Enter");
    expect(document.activeElement).toHaveAttribute("role", "treeitem");
  });
});

describe("editing a block whose parent is rebuilt as another kind of block", () => {
  // The edit itself works; what used to go wrong was only picking the block to
  // focus afterwards, which looked in the old parent for the replaced child.
  // That threw, after the text had changed, so the editor showed an error for
  // an edit that had in fact been made.
  const replaceChild = (code: string, index: number, text: string) => {
    cmb.setValue(code);
    cmb.clearHistory();
    const node = [...root().children()][index];
    mouseDown(node);
    keyDown("Enter", {}, node);
    setEditableText(text);
    keyDown("Enter");
  };

  it("takes the only block of an expression, a placeholder, for two blocks", () => {
    replaceChild("(...)", 0, "foo bar");
    expect(cmb.getValue()).toBe("(foo bar)");
    expect(store.getState().errorId).toBe("");
    expect(cmb.getFocusedNode()?.toString()).toBe("foo");
  });

  it("takes the operator of an expression that wasn't a valid call", () => {
    // an `if` with four arguments is not an `if`; without it, it is a call
    replaceChild("(if foo bar a b) c", 0, '"hi"');
    expect(cmb.getValue()).toBe('("hi" foo bar a b) c');
    expect(store.getState().errorId).toBe("");
    expect(root().type).toBe("functionApp");
  });
});

describe("editing in place with a value that can't be parsed", () => {
  beforeEach(() => {
    allowConsoleErrors(); // the rejected edit is logged
    cmb.setValue("42\n(f x y)");
    cmb.clearHistory();
    startEditing(root());
    setEditableText("(((");
    keyDown("Enter");
  });

  it("leaves the document alone", () => {
    expect(cmb.getValue()).toBe("42\n(f x y)");
    expect(undoSteps()).toBe(0);
  });

  it("stays in edit mode and flags the error", () => {
    expect(editing(root())).toHaveAttribute("contenteditable", "true");
    expect(editing(root())).toHaveClass("blocks-error");
    expect(store.getState().errorId).toBe(root().id);
  });

  it("clears the error once a valid value is saved", () => {
    setEditableText("8");
    keyDown("Enter");
    expect(cmb.getValue()).toBe("8\n(f x y)");
    expect(store.getState().errorId).toBe("");
  });

  it("clears the error when the edit is cancelled with Escape", () => {
    keyDown("Escape");
    expect(cmb.getValue()).toBe("42\n(f x y)");
    expect(store.getState().errorId).toBe("");
    expect(editing(root())).not.toHaveAttribute("contenteditable", "true");
  });
});

describe("inserting beside a child with Ctrl-] / Ctrl-[", () => {
  beforeEach(() => {
    cmb.setValue("(f x y)");
    cmb.clearHistory();
  });

  it("inserts after the child on Enter", () => {
    const x = argsOf(root())[0];
    mouseDown(x);
    keyDown("]", { ctrlKey: true }, x);
    setEditableText("z");
    keyDown("Enter");
    expect(cmb.getValue()).toBe("(f x z y)");
  });

  it("inserts before the child on Enter", () => {
    const y = argsOf(root())[1];
    mouseDown(y);
    keyDown("[", { ctrlKey: true }, y);
    setEditableText("z");
    keyDown("Enter");
    expect(cmb.getValue()).toBe("(f x z y)");
  });

  it("cancels on Escape", () => {
    const x = argsOf(root())[0];
    mouseDown(x);
    keyDown("]", { ctrlKey: true }, x);
    setEditableText("z");
    keyDown("Escape");
    expect(cmb.getValue()).toBe("(f x y)");
  });

  it("ignores an empty insertion", () => {
    const x = argsOf(root())[0];
    mouseDown(x);
    keyDown("]", { ctrlKey: true }, x);
    keyDown("Enter");
    expect(cmb.getValue()).toBe("(f x y)");
    expect(undoSteps()).toBe(0);
  });

  it("rejects an unparseable insertion and stays open", () => {
    allowConsoleErrors();
    const x = argsOf(root())[0];
    mouseDown(x);
    keyDown("]", { ctrlKey: true }, x);
    setEditableText("(((");
    keyDown("Enter");
    expect(cmb.getValue()).toBe("(f x y)");
    expect(store.getState().errorId).not.toBe("");
  });
});

describe("edits made through the API that would break the document", () => {
  beforeEach(() => {
    cmb.setValue("(f x y)");
    cmb.clearHistory();
  });

  it("replaceRange with unparseable text is rejected", () => {
    allowConsoleErrors();
    expect(() =>
      cmb.replaceRange("(", { line: 0, ch: 0 }, { line: 0, ch: 0 })
    ).toThrow();
    expect(cmb.getValue()).toBe("(f x y)");
    expect(undoSteps()).toBe(0);
  });

  it("replaceRange with parseable text is accepted", () => {
    cmb.replaceRange(" z", { line: 0, ch: 7 });
    expect(cmb.getValue()).toBe("(f x y) z");
    expect(cmb.getAst().rootNodes).toHaveLength(2);
  });

  it("a rejected edit leaves the AST matching the text", () => {
    allowConsoleErrors();
    try {
      cmb.replaceRange("(", { line: 0, ch: 0 }, { line: 0, ch: 0 });
    } catch {
      // expected; the invariants checked after each test cover the rest
    }
  });
});

describe("switching modes with text that can't be converted", () => {
  const toggle = (name: RegExp) =>
    fireEvent.click(screen.getByRole("button", { name }));

  it("stays in text mode and explains why", () => {
    allowConsoleErrors();
    toggle(/switch to text mode/i);
    cmb.setValue("(((");
    toggle(/switch to blocks mode/i);
    expect(screen.getByText("Could not convert to Blocks")).toBeInTheDocument();
    expect(store.getState().blockMode).toBe(false);
    expect(cmb.getValue()).toBe("(((");
  });

  it("switches once the text is fixed", () => {
    allowConsoleErrors();
    toggle(/switch to text mode/i);
    cmb.setValue("(((");
    toggle(/switch to blocks mode/i);
    keyDown("Escape", {}, screen.getByText("Could not convert to Blocks"));
    cmb.setValue("(f x)");
    toggle(/switch to blocks mode/i);
    expect(store.getState().blockMode).toBe(true);
    expect(cmb.getAst().rootNodes).toHaveLength(1);
  });
});
