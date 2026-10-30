import wescheme from "../src/languages/wescheme";
import { fireEvent } from "@testing-library/react";
import {
  cmd_ctrl,
  keyDown,
  mountCMB,
  mouseDown,
  teardown,
} from "../src/toolkit/test-utils";
import { API } from "../src/CodeMirrorBlocks";
import { ASTNode } from "../src/ast";
import { drag, getNodeLabeled } from "./helpers/dnd";
import { installFakeClipboard } from "./helpers/clipboard";
import { setEditableText } from "./helpers/editing";

/**
 * Every way of changing the document, each checked for the same things:
 * undo restores the text and AST, redo reapplies them, a new edit after an
 * undo clears the redo stack, and undo works from the keyboard and the API.
 * (The invariants checked after every test cover the rest.)
 */

let cmb: API;
let clipboard: ReturnType<typeof installFakeClipboard>;
beforeEach(() => {
  cmb = mountCMB(wescheme).cmb;
  clipboard = installFakeClipboard();
});
afterEach(() => {
  clipboard.restore();
  jest.restoreAllMocks();
  teardown();
});

const root = (i = 0) => cmb.getAst().rootNodes[i];
const kids = (node: ASTNode) => [...node.children()];
const select = (node: ASTNode) => {
  mouseDown(node);
  keyDown(" ", {}, node);
};
const dropTargets = (within: Element) => [
  ...within.querySelectorAll(".blocks-drop-target"),
];
const toolbarPrimitive = (name: string) =>
  [...document.querySelectorAll(".Primitive")].find(
    (el) => el.textContent === name
  )!;
const typeChar = (char: string) =>
  fireEvent.keyPress(cmb.getCM().getInputField(), {
    key: char,
    code: `Key${char.toUpperCase()}`,
    charCode: char.charCodeAt(0),
  });
const dropOnWhitespace = (src: Element, loc: { line: number; ch: number }) => {
  const wrapper = cmb.getCM().getWrapperElement();
  document.elementFromPoint = jest.fn(() => wrapper);
  jest.spyOn(cmb.getCM(), "coordsChar").mockReturnValue(loc as never);
  drag(src).dropOnto(wrapper, { x: 20, y: 20 });
};

type Operation = { name: string; code: string; run: () => void };
const operations: Operation[] = [
  {
    name: "Delete on a selected root",
    code: "a b c",
    run: () => {
      select(root(1));
      keyDown("Delete", {}, root(1));
    },
  },
  {
    name: "Delete on a selected child",
    code: "(f x y)",
    run: () => {
      const x = kids(root())[1];
      select(x);
      keyDown("Delete", {}, x);
    },
  },
  {
    name: "Cut",
    code: "(f x y)",
    run: () => {
      const x = kids(root())[1];
      select(x);
      keyDown("X", cmd_ctrl, x);
    },
  },
  {
    name: "Paste over a selection",
    code: "(f x y)",
    run: () => {
      clipboard.text = "zzz";
      const x = kids(root())[1];
      select(x);
      keyDown("V", cmd_ctrl, x);
    },
  },
  {
    name: "Paste beside a root",
    code: "a b",
    run: () => {
      clipboard.text = "zzz";
      mouseDown(root(0));
      keyDown("V", cmd_ctrl, root(0));
    },
  },
  {
    name: "Paste beside a child",
    code: "(f x y)",
    run: () => {
      clipboard.text = "zzz";
      const x = kids(root())[1];
      mouseDown(x);
      keyDown("V", cmd_ctrl, x);
    },
  },
  {
    name: "editing a node in place",
    code: "42\n(f x)",
    run: () => {
      mouseDown(root(0));
      keyDown("Enter");
      setEditableText("7");
      keyDown("Enter");
    },
  },
  {
    name: "inserting beside a child",
    code: "(f x y)",
    run: () => {
      const x = kids(root())[1];
      mouseDown(x);
      keyDown("]", { ctrlKey: true }, x);
      setEditableText("zzz");
      keyDown("Enter");
    },
  },
  {
    name: "typing at the top level",
    code: "42\n11",
    run: () => {
      cmb.setCursor({ line: 0, ch: 2 });
      typeChar("9");
      keyDown("Enter");
    },
  },
  {
    name: "pasting at the top level",
    code: "42\n11",
    run: () => {
      cmb.setCursor({ line: 0, ch: 2 });
      fireEvent.paste(cmb.getCM().getInputField(), {
        clipboardData: { getData: () => "(f x)" },
      });
      keyDown("Enter");
    },
  },
  {
    name: "dragging a node onto a node",
    code: "(add a b) (sub c d)",
    run: () => {
      drag(getNodeLabeled(/^a,/)).dropOnto(getNodeLabeled(/^d,/));
    },
  },
  {
    name: "dragging a node onto a drop target",
    code: "(add a b) (sub c d)",
    run: () => {
      const target = dropTargets(getNodeLabeled(/sub expression/))[0];
      drag(getNodeLabeled(/^a,/)).dropOnto(target);
    },
  },
  {
    name: "dragging a node onto whitespace",
    code: "a\n\n\nb",
    run: () => dropOnWhitespace(getNodeLabeled(/^a,/), { line: 2, ch: 0 }),
  },
  {
    name: "dragging from the toolbar onto a node",
    code: "(f x y)",
    run: () => {
      drag(toolbarPrimitive("sqrt")).dropOnto(getNodeLabeled(/^x,/));
    },
  },
  {
    name: "dragging from the toolbar onto whitespace",
    code: "a\n\n\nb",
    run: () => dropOnWhitespace(toolbarPrimitive("sqrt"), { line: 2, ch: 0 }),
  },
  {
    name: "dragging a node to the trash can",
    code: "(f x y)\n(g z)",
    run: () => {
      drag(getNodeLabeled(/f expression/)).dropOnto(
        document.querySelector(".TrashCan")!
      );
    },
  },
];

const texts = () => cmb.getAst().rootNodes.map((n) => n.toString());
const undoKey = () => keyDown("Z", cmd_ctrl);
const redoKey = () => keyDown("Y", { ctrlKey: true });
const untilEmpty = (which: "undo" | "redo", step: () => void) => {
  for (let i = 0; i < 10 && cmb.historySize()[which] > 0; i++) {
    step();
  }
};

describe.each(operations)("$name", ({ code, run }) => {
  let before: { text: string; roots: string[] };
  let after: { text: string; roots: string[] };
  beforeEach(() => {
    cmb.setValue(code);
    cmb.clearHistory();
    before = { text: cmb.getValue(), roots: texts() };
    run();
    after = { text: cmb.getValue(), roots: texts() };
  });

  it("changes the document", () => {
    expect(after.text).not.toBe(before.text);
    expect(cmb.historySize().undo).toBeGreaterThan(0);
  });

  it("leaves keyboard focus somewhere the editor can hear it", () => {
    const active = document.activeElement;
    expect(active && active !== document.body).toBe(true);
    expect(cmb.getWrapperElement().contains(active)).toBe(true);
  });

  it("is undone by Ctrl/Cmd-Z, text and AST both", () => {
    untilEmpty("undo", undoKey);
    expect(cmb.getValue()).toBe(before.text);
    expect(texts()).toEqual(before.roots);
  });

  it("leaves keyboard focus in the editor after the undo", () => {
    untilEmpty("undo", undoKey);
    const active = document.activeElement;
    expect(active && active !== document.body).toBe(true);
    expect(cmb.getWrapperElement().contains(active)).toBe(true);
  });

  it("is redone by Ctrl-Y, text and AST both", () => {
    untilEmpty("undo", undoKey);
    untilEmpty("redo", redoKey);
    expect(cmb.getValue()).toBe(after.text);
    expect(texts()).toEqual(after.roots);
  });

  it("can be undone and redone through the API too", () => {
    untilEmpty("undo", () => cmb.undo());
    expect(cmb.getValue()).toBe(before.text);
    expect(texts()).toEqual(before.roots);
    untilEmpty("redo", () => cmb.redo());
    expect(cmb.getValue()).toBe(after.text);
    expect(texts()).toEqual(after.roots);
  });

  it("clears the redo stack when something new is done after an undo", () => {
    untilEmpty("undo", undoKey);
    expect(cmb.historySize().redo).toBeGreaterThan(0);
    cmb.replaceRange(" extra", {
      line: cmb.lastLine(),
      ch: cmb.getLine(cmb.lastLine()).length,
    });
    expect(cmb.historySize().redo).toBe(0);
  });

  it("keeps undo and redo working after a round trip", () => {
    for (let i = 0; i < 2; i++) {
      untilEmpty("undo", undoKey);
      untilEmpty("redo", redoKey);
    }
    expect(cmb.getValue()).toBe(after.text);
  });
});

describe("undo and redo with nothing to undo or redo", () => {
  it("do nothing, and don't throw", () => {
    cmb.setValue("(f x)");
    cmb.clearHistory();
    mouseDown(root());
    undoKey();
    redoKey();
    expect(cmb.getValue()).toBe("(f x)");
  });
});

describe("several different edits in a row", () => {
  it("undo all the way back, then redo all the way forward", () => {
    cmb.setValue("(f x y)\n(g z)\nw");
    cmb.clearHistory();
    const start = cmb.getValue();
    const states: string[] = [start];

    // 1: delete a child
    const x = kids(root(0))[1];
    select(x);
    keyDown("Delete", {}, x);
    states.push(cmb.getValue());

    // 2: edit a literal in place
    const w = root(cmb.getAst().rootNodes.length - 1);
    mouseDown(w);
    keyDown("Enter");
    setEditableText("v");
    keyDown("Enter");
    states.push(cmb.getValue());

    // 3: drag a node onto another
    drag(getNodeLabeled(/^z,/)).dropOnto(getNodeLabeled(/^y,/));
    states.push(cmb.getValue());

    // walk back through every state
    for (let i = states.length - 2; i >= 0; i--) {
      untilEmpty("undo", () => {
        if (cmb.getValue() !== states[i]) {
          undoKey();
        }
      });
      expect(cmb.getValue()).toBe(states[i]);
    }
    expect(cmb.getValue()).toBe(start);

    // and forward again
    for (let i = 1; i < states.length; i++) {
      untilEmpty("redo", () => {
        if (cmb.getValue() !== states[i]) {
          redoKey();
        }
      });
      expect(cmb.getValue()).toBe(states[i]);
    }
  });
});
