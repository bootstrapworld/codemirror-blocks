import wescheme from "../src/languages/wescheme";
import { teardown, keyDown, mountCMB } from "../src/toolkit/test-utils";
import { API } from "../src/CodeMirrorBlocks";
import { ASTNode } from "../src/ast";
import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

let cmb!: API;
beforeEach(() => {
  cmb = mountCMB(wescheme).cmb;
});

afterEach(teardown);

/**
 * Helper function to simulate dragging an element onto another element.
 *
 * @param srcNode the element to start dragging
 * @returns additional functions you can call to simulate dragging/dropping the element
 * over/onto another element.
 */
const drag = (srcNode: Element) => {
  fireEvent.mouseDown(srcNode);
  fireEvent.dragStart(srcNode);
  const next = {
    dragOver: (overNode: Element) => {
      fireEvent.dragEnter(overNode);
      fireEvent.mouseOver(overNode);
      return {
        dragLeave: () => {
          fireEvent.dragLeave(overNode);
          fireEvent.mouseOut(overNode);
        },
      };
    },
    dropOnto: (ontoNode: Element) => {
      next.dragOver(ontoNode);
      fireEvent.drop(ontoNode);
    },
  };
  return next;
};

/**
 * Get the element for a given ast node using it's aria-label
 * @param label string or regex to match the aria label
 * @returns the node, or throws if there is none.
 */
const getNodeLabeled = (label: string | RegExp) =>
  screen.getByRole("treeitem", { name: label });

describe("when dragging a node onto a node in a different subtree", () => {
  it("should replace the node that it's dropped onto and focus on the new node", () => {
    cmb.setValue(`(add firstVar secondVar) (sub fourthVar fifthVar)`);
    drag(getNodeLabeled(/firstVar/)).dropOnto(getNodeLabeled(/fifthVar/));
    expect(cmb.getValue()).toEqual("(add secondVar) (sub fourthVar firstVar)");
    expect(getNodeLabeled(/firstVar/)).toHaveFocus();
  });

  it("should focus the nth child of the node that was just dropped", () => {
    cmb.setValue(
      `(divide 1 2) (add firstVar secondVar) (sub fourthVar fifthVar)`
    );
    drag(getNodeLabeled(/add expression/)).dropOnto(getNodeLabeled(/fifthVar/));
    expect(cmb.getValue()).toEqual(
      `(divide 1 2) (sub fourthVar (add firstVar secondVar))`
    );
    expect(getNodeLabeled(/secondVar/)).toHaveFocus();
  });
});

describe("when dragging a node onto a node that can't be dropped onto", () => {
  let addExprEl: Element;
  beforeEach(() => {
    cmb.setValue(`(add firstVar secondVar) (sub fourthVar fifthVar)`);
    addExprEl = getNodeLabeled(/add expression/);
  });
  it("should not add the blocks-over-target css class", () => {
    drag(getNodeLabeled(/fifthVar/)).dragOver(addExprEl);
    expect(addExprEl).not.toHaveClass("blocks-over-target");
  });

  it("should not change the document when dropped onto a node that can't be dropped onto", () => {
    drag(getNodeLabeled(/fifthVar/)).dropOnto(addExprEl);
    expect(cmb.getValue()).toEqual(
      `(add firstVar secondVar) (sub fourthVar fifthVar)`
    );
  });
});

describe("when dragging a node over a drop target", () => {
  let subDropTargets: NodeListOf<Element>;
  let addDropTargets: NodeListOf<Element>;
  beforeEach(() => {
    cmb.setValue(`(add firstVar secondVar) (sub fourthVar fifthVar)`);
    subDropTargets = screen
      .getByRole("treeitem", { name: /sub expression/ })
      .querySelectorAll(".blocks-drop-target");
    addDropTargets = screen
      .getByRole("treeitem", { name: /add expression/ })
      .querySelectorAll(".blocks-drop-target");
  });

  it("should add the blocks-over-target css class to the drop target", () => {
    expect(subDropTargets[0]).not.toHaveClass("blocks-over-target");
    drag(getNodeLabeled(/firstVar/)).dragOver(subDropTargets[0]);
    expect(subDropTargets[0]).toHaveClass("blocks-over-target");
  });

  it("should remove the blocks-over-target css class when leaving the drop target", () => {
    drag(getNodeLabeled(/firstVar/))
      .dragOver(subDropTargets[0])
      .dragLeave();
    expect(subDropTargets[0]).not.toHaveClass("blocks-over-target");
  });

  it("should insert the node where the drop target was (lower down in the file)", () => {
    drag(getNodeLabeled(/firstVar/)).dropOnto(subDropTargets[0]);
    expect(cmb.getValue()).toEqual(
      `(add secondVar) (sub firstVar fourthVar fifthVar)`
    );
  });

  it("should insert the node where the drop target was (higher up in the file)", () => {
    drag(getNodeLabeled(/fifthVar/)).dropOnto(addDropTargets[0]);
    expect(cmb.getValue()).toEqual(
      `(add fifthVar firstVar secondVar) (sub fourthVar)`
    );
  });
});

it("saves collapsed state when dragging a root node to be the last child of the next root node", () => {
  cmb.setValue("(collapse me)\n(add 1 2)");
  const firstRootEl = getNodeLabeled(/collapse expression/);
  userEvent.click(firstRootEl);
  keyDown("ArrowLeft", {}, firstRootEl); // collapse it
  expect(firstRootEl).toHaveAttribute("aria-expanded", "false");
  drag(firstRootEl).dropOnto(
    document.querySelectorAll(".blocks-drop-target")[4]
  );

  expect(cmb.getValue()).toBe("\n(add 1 2 (collapse me))");
  expect(getNodeLabeled(/add expression/)).toHaveAttribute(
    "aria-expanded",
    "true"
  );
  expect(getNodeLabeled(/collapse expression/)).toHaveAttribute(
    "aria-expanded",
    "false"
  );
});

describe("corner cases", () => {
  let source!: ASTNode;
  let target1!: Element;
  let target2!: Element;

  beforeEach(() => {
    cmb.setValue(";comment\n(a)\n(c)\n(define-struct e ())\ng");
    source = cmb.getAst().rootNodes[0];
    target1 = document.querySelectorAll(".blocks-drop-target")[1];
    target2 = document.querySelectorAll(".blocks-drop-target")[2];
  });

  it("regression test for unstable block IDs", () => {
    drag(source.element!).dropOnto(target1);
  });

  it("regression test for empty identifierLists returning a null location", () => {
    drag(source.element!).dropOnto(target2); // drag to the last droptarget
  });
});
