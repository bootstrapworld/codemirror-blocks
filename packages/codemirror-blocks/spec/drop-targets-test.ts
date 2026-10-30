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
import { drag, getNodeLabeled } from "./helpers/dnd";

let cmb: API;
beforeEach(() => {
  cmb = mountCMB(wescheme).cmb;
});
afterEach(() => {
  jest.restoreAllMocks();
  teardown();
});

const dropTargets = (within?: Element) =>
  [...(within ?? document).querySelectorAll(".blocks-drop-target")].filter(
    (el) => !el.closest(".toolbar-pane")
  );
const trashCan = () => document.querySelector(".TrashCan")!;
const toolbarPrimitive = (name: string) => {
  const el = [...document.querySelectorAll(".Primitive")].find(
    (e) => e.textContent === name
  );
  if (!el) {
    throw new Error(`no toolbar primitive named ${name}`);
  }
  return el;
};
const undo = () => keyDown("Z", cmd_ctrl);

/**
 * Pretend the pointer is over bare editor whitespace at `loc`: jsdom has no
 * layout, so the drop handler's hit-testing has to be faked.
 */
const dropOnWhitespace = (src: Element, loc: { line: number; ch: number }) => {
  const wrapper = cmb.getCM().getWrapperElement();
  document.elementFromPoint = jest.fn(() => wrapper);
  jest.spyOn(cmb.getCM(), "coordsChar").mockReturnValue(loc as never);
  drag(src).dropOnto(wrapper, { x: 20, y: 20 });
};

describe("dropping a node onto bare editor whitespace", () => {
  it("moves a root to that spot", () => {
    cmb.setValue("a\n\n\nb");
    dropOnWhitespace(getNodeLabeled(/^a,/), { line: 2, ch: 0 });
    expect(cmb.getAst().rootNodes.map((n) => n.toString())).toEqual(["a", "b"]);
    expect(cmb.getValue()).toBe("\n\na\nb");
  });

  it("moves a child out of its parent to the top level", () => {
    cmb.setValue("(f x y)\n\n");
    dropOnWhitespace(getNodeLabeled(/^x,/), { line: 2, ch: 0 });
    expect(cmb.getAst().rootNodes.map((n) => n.toString())).toEqual([
      "(f y)",
      "x",
    ]);
  });

  it("can be undone", () => {
    cmb.setValue("a\n\n\nb");
    dropOnWhitespace(getNodeLabeled(/^a,/), { line: 2, ch: 0 });
    undo();
    expect(cmb.getValue()).toBe("a\n\n\nb");
  });

  it("beeps and changes nothing when the drop lands on a block", () => {
    cmb.setValue("a\n\n\nb");
    const wrapper = cmb.getCM().getWrapperElement();
    // the point under the pointer is *inside* the block for `b`
    const onB = getNodeLabeled(/^b,/);
    document.elementFromPoint = jest.fn(() => onB);
    drag(getNodeLabeled(/^a,/)).dropOnto(wrapper, { x: 20, y: 20 });
    expect(cmb.getValue()).toBe("a\n\n\nb");
  });
});

describe("dragging from the toolbar", () => {
  it("replaces the node it's dropped onto", () => {
    cmb.setValue("(f x y)");
    drag(toolbarPrimitive("sqrt")).dropOnto(getNodeLabeled(/^x,/));
    expect(cmb.getValue()).toBe("(f sqrt y)");
  });

  it("inserts into the field at a drop target", () => {
    cmb.setValue("(f x y)");
    const target = dropTargets(getNodeLabeled(/f expression/))[0];
    drag(toolbarPrimitive("sqrt")).dropOnto(target);
    expect(cmb.getValue()).toBe("(f sqrt x y)");
  });

  it("inserts at the top level when dropped on whitespace", () => {
    cmb.setValue("a\n\n\nb");
    dropOnWhitespace(toolbarPrimitive("sqrt"), { line: 2, ch: 0 });
    expect(cmb.getAst().rootNodes.map((n) => n.toString())).toEqual([
      "a",
      "sqrt",
      "b",
    ]);
  });

  it("does nothing when dropped on the trash can", () => {
    cmb.setValue("(f x y)");
    drag(toolbarPrimitive("sqrt")).dropOnto(trashCan());
    expect(cmb.getValue()).toBe("(f x y)");
  });

  it("can be undone", () => {
    cmb.setValue("(f x y)");
    drag(toolbarPrimitive("sqrt")).dropOnto(getNodeLabeled(/^x,/));
    undo();
    expect(cmb.getValue()).toBe("(f x y)");
  });
});

describe("drops that should do nothing", () => {
  let parent: ASTNode;
  beforeEach(() => {
    cmb.setValue("(f (g x) y)");
    parent = cmb.getAst().rootNodes[0];
  });

  it("a node dropped onto itself", () => {
    const el = getNodeLabeled(/f expression/);
    drag(el).dropOnto(el);
    expect(cmb.getValue()).toBe("(f (g x) y)");
  });

  it("a node dropped onto a drop target inside itself", () => {
    const inside = dropTargets(getNodeLabeled(/g expression/))[0];
    drag(getNodeLabeled(/f expression/)).dropOnto(inside);
    expect(cmb.getValue()).toBe("(f (g x) y)");
    expect(cmb.getAst().rootNodes[0].id).toBe(parent.id);
  });

  it("a node dropped onto one of its own descendants", () => {
    drag(getNodeLabeled(/f expression/)).dropOnto(getNodeLabeled(/^x,/));
    expect(cmb.getValue()).toBe("(f (g x) y)");
  });

  it("a drag that is released without dropping", () => {
    const x = getNodeLabeled(/^x,/);
    const d = drag(x);
    d.dragOver(getNodeLabeled(/^y,/));
    d.cancel();
    expect(cmb.getValue()).toBe("(f (g x) y)");
    expect(document.querySelector(".blocks-over-target")).toBeNull();
  });
});

describe("dragging nodes that carry extra state", () => {
  it("a node with a comment moves together with its comment", () => {
    cmb.setValue(";note\n(f x)\n(g y)");
    const target = dropTargets(getNodeLabeled(/g expression/))[0];
    drag(getNodeLabeled(/f expression/)).dropOnto(target);
    // the comment travels with its node, into (g ...)
    expect(cmb.getAst().rootNodes.map((n) => n.toString())).toHaveLength(1);
    const text = cmb.getValue();
    expect(text).toContain("#| note |#");
    expect(text.indexOf("#| note |#")).toBeLessThan(text.indexOf("(f x)"));
    expect(text.indexOf("(f x)")).toBeLessThan(text.indexOf("y"));
  });

  it("keeps focus on a block after a drop", () => {
    cmb.setValue("(f x y)");
    mouseDown(cmb.getAst().rootNodes[0]);
    drag(getNodeLabeled(/^x,/)).dropOnto(getNodeLabeled(/^y,/));
    expect(document.activeElement).toHaveAttribute("role", "treeitem");
  });
});
