import wescheme from "../src/languages/wescheme";
import {
  cmd_ctrl,
  elementForNode,
  isNodeEditable,
  keyDown,
  mountCMB,
  mouseDown,
  teardown,
} from "../src/toolkit/test-utils";
import { API } from "../src/CodeMirrorBlocks";
import { ASTNode } from "../src/ast";
import { screen } from "@testing-library/react";
import * as announcer from "../src/announcer";
import * as utils from "../src/utils";
import { setEditableText } from "./helpers/editing";

let cmb: API;
let say: jest.SpyInstance;
let beep: jest.SpyInstance;

beforeEach(() => {
  cmb = mountCMB(wescheme).cmb;
  say = jest.spyOn(announcer, "say");
  beep = jest.spyOn(utils, "playSound");
});
afterEach(() => {
  jest.restoreAllMocks();
  teardown();
});

const root = (i = 0) => cmb.getAst().rootNodes[i];
const fieldsOf = (node: ASTNode) =>
  (node as unknown as { fields: { func: ASTNode; args: ASTNode[] } }).fields;
const said = () => say.mock.calls.map((c) => String(c[0]));

describe("Delete and Backspace", () => {
  (["Delete", "Backspace"] as const).forEach((key) => {
    describe(key, () => {
      it("deletes the selected node", () => {
        cmb.setValue("(f x y)");
        const x = fieldsOf(root()).args[0];
        mouseDown(x);
        keyDown(" ", {}, x);
        keyDown(key, {}, x);
        expect(cmb.getValue()).toBe("(f y)");
      });

      it("deletes every selected node", () => {
        cmb.setValue("a b c");
        mouseDown(root(0));
        keyDown(" ", {}, root(0));
        keyDown(" ", {}, root(2));
        keyDown(key, {}, root(2));
        expect(cmb.getAst().rootNodes.map((n) => n.toString())).toEqual(["b"]);
      });

      it("does nothing, and says so, when nothing is selected", () => {
        cmb.setValue("(f x y)");
        const x = fieldsOf(root()).args[0];
        mouseDown(x);
        keyDown(key, {}, x);
        expect(cmb.getValue()).toBe("(f x y)");
        expect(said()).toContain("Nothing selected");
      });

      it("can be undone", () => {
        cmb.setValue("(f x y)");
        const x = fieldsOf(root()).args[0];
        mouseDown(x);
        keyDown(" ", {}, x);
        keyDown(key, {}, x);
        keyDown("Z", cmd_ctrl);
        expect(cmb.getValue()).toBe("(f x y)");
      });
    });
  });

  it("deletes a selected parent together with its selected children once", () => {
    cmb.setValue("(f (g x) y)");
    const g = fieldsOf(root()).args[0];
    mouseDown(g);
    keyDown(" ", {}, g); // selecting a node selects its descendants too
    keyDown("Delete", {}, g);
    expect(cmb.getValue()).toBe("(f y)");
  });
});

describe("Enter and Cmd-Enter", () => {
  it("Enter edits a literal in place", () => {
    cmb.setValue("42");
    mouseDown(root());
    keyDown("Enter");
    expect(isNodeEditable(root())).toBe(true);
  });

  it("Enter collapses an expression that can't be edited in place", () => {
    cmb.setValue("(f x y)");
    mouseDown(root());
    expect(elementForNode(root())).toHaveAttribute("aria-expanded", "true");
    keyDown("Enter");
    expect(elementForNode(root())).toHaveAttribute("aria-expanded", "false");
    keyDown("Enter");
    expect(elementForNode(root())).toHaveAttribute("aria-expanded", "true");
  });

  it("Cmd-Enter edits any node, even an expression", () => {
    cmb.setValue("(f x y)");
    mouseDown(root());
    keyDown("Enter", cmd_ctrl);
    expect(isNodeEditable(root())).toBe(true);
  });

  it("Cmd-Enter then Enter saves a new expression over the old one", () => {
    cmb.setValue("(f x y)");
    mouseDown(root());
    keyDown("Enter", cmd_ctrl);
    setEditableText("(g 1)");
    keyDown("Enter");
    expect(cmb.getValue()).toBe("(g 1)");
  });
});

describe("reading aloud", () => {
  it("Read Ancestors lists the enclosing expressions", () => {
    cmb.setValue("(f (g x) y)");
    const x = fieldsOf(fieldsOf(root()).args[0] as ASTNode).args[0];
    mouseDown(x);
    keyDown("\\", {}, x);
    const spoken = said().find((s) => s.includes("inside"));
    expect(spoken).toBeDefined();
    expect(spoken).toMatch(/at level/);
  });

  it("Read Ancestors beeps on a root, which has none", () => {
    cmb.setValue("42");
    mouseDown(root());
    keyDown("\\", {}, root());
    expect(beep).toHaveBeenCalled();
  });

  it("Read Children describes an expression", () => {
    cmb.setValue("(f x y)");
    mouseDown(root());
    say.mockClear();
    keyDown("\\", { shiftKey: true }, root());
    expect(say).toHaveBeenCalledTimes(1);
    expect(said()[0]).toContain("f");
  });
});

describe("Help (Shift-Ctrl-/)", () => {
  const openHelp = () => {
    cmb.setValue("42");
    mouseDown(root());
    keyDown("/", { shiftKey: true, ctrlKey: true }, root());
  };

  it("opens the keyboard shortcuts dialog", () => {
    openHelp();
    expect(screen.getByText("Keyboard Shortcuts")).toBeInTheDocument();
    // every documented command appears in the table
    for (const command of ["Next Block", "Delete Nodes", "Undo", "Paste"]) {
      expect(screen.getByText(command)).toBeInTheDocument();
    }
  });

  it("hides the editor from screenreaders while it is open", () => {
    const editor = document.querySelector(".Editor")!;
    expect(editor).not.toHaveAttribute("aria-hidden");
    openHelp();
    expect(editor).toHaveAttribute("aria-hidden", "true");
  });

  it("closes on Escape and shows the editor again", () => {
    const editor = document.querySelector(".Editor")!;
    openHelp();
    keyDown("Escape", {}, screen.getByText("Keyboard Shortcuts"));
    expect(screen.queryByText("Keyboard Shortcuts")).toBeNull();
    expect(editor).not.toHaveAttribute("aria-hidden");
  });
});

describe("Shift-Tab", () => {
  it("moves keyboard focus to the toolbar", () => {
    cmb.setValue("42");
    mouseDown(root());
    keyDown("Tab", { shiftKey: true }, root());
    const toolbar = document.querySelector(".toolbar-pane")!;
    expect(toolbar.contains(document.activeElement)).toBe(true);
  });
});

describe("keys that are inert", () => {
  // search is disabled for now (see keymap.tsx), so its keys must do nothing
  ["PageUp", "PageDown", "F3"].forEach((key) => {
    it(`${key} changes nothing`, () => {
      cmb.setValue("(f x y)");
      mouseDown(root());
      const before = cmb.getFocusedNode();
      keyDown(key, {}, root());
      expect(cmb.getFocusedNode()).toBe(before);
      expect(cmb.getValue()).toBe("(f x y)");
    });
  });

  it("Ctrl-F changes nothing", () => {
    cmb.setValue("(f x y)");
    mouseDown(root());
    keyDown("F", { ctrlKey: true }, root());
    expect(cmb.getValue()).toBe("(f x y)");
  });

  it("an unbound letter changes nothing", () => {
    cmb.setValue("(f x y)");
    mouseDown(root());
    keyDown("j", {}, root());
    expect(cmb.getValue()).toBe("(f x y)");
  });
});

describe("commands pressed with no block focused (at the top level)", () => {
  beforeEach(() => {
    cmb.setValue("(f x y)\n\n99");
    cmb.getCM().getInputField().focus();
  });

  // these only make sense for a focused block, so they must be harmless here
  const nodeOnly: [string, object][] = [
    ["Backspace", {}],
    [" ", {}],
    ["Enter", cmd_ctrl],
    ["Home", {}],
    ["End", {}],
    ["ArrowLeft", {}],
    ["ArrowRight", {}],
    ["\\", {}],
    ["X", cmd_ctrl],
    ["C", cmd_ctrl],
    ["V", cmd_ctrl],
  ];
  nodeOnly.forEach(([key, props]) => {
    it(`${JSON.stringify(key)} ${JSON.stringify(props)} does nothing`, () => {
      keyDown(key, props, cmb.getCM().getInputField());
      expect(cmb.getValue()).toBe("(f x y)\n\n99");
      expect(cmb.getSelectedNodes()).toEqual([]);
    });
  });

  it("Down activates the next block", () => {
    cmb.setCursor({ line: 1, ch: 0 });
    cmb.getCM().getInputField().focus();
    keyDown("ArrowDown", {}, cmb.getCM().getInputField());
    expect(cmb.getFocusedNode()).toBeTruthy();
  });
});

describe("text-editing keys at the top level still work", () => {
  let input: HTMLElement;
  beforeEach(() => {
    cmb.setValue("(f x y)\n\n99");
    input = cmb.getCM().getInputField();
    input.focus();
  });

  it("Enter inserts a newline", () => {
    keyDown("Enter", {}, input);
    expect(cmb.getValue()).toBe("\n(f x y)\n\n99");
  });

  it("Delete before a block removes the whole block", () => {
    keyDown("Delete", {}, input);
    expect(cmb.getAst().rootNodes.map((n) => n.toString())).toEqual(["99"]);
  });

  it("Backspace after a block removes the whole block", () => {
    cmb.setCursor({ line: 0, ch: 7 });
    input.focus();
    keyDown("Backspace", {}, input);
    expect(cmb.getAst().rootNodes.map((n) => n.toString())).toEqual(["99"]);
  });

  it("Ctrl-] indents the line", () => {
    keyDown("]", { ctrlKey: true }, input);
    expect(cmb.getValue().startsWith("  (f x y)")).toBe(true);
  });
});
