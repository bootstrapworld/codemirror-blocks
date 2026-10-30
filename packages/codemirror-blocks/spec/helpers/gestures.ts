import { fireEvent } from "@testing-library/react";
import { keyDown, mouseDown } from "../../src/toolkit/test-utils";
import type { API } from "../../src/CodeMirrorBlocks";
import type { ASTNode } from "../../src/ast";
import { drag } from "./dnd";

/**
 * Small user gestures, shared by the specs that drive the whole editor
 * (`undo-matrix-test`, `random-sequences-test`, ...).
 */

export const kids = (node: ASTNode) => [...node.children()];

/** Click a block, then press Space to select it. */
export const select = (node: ASTNode) => {
  mouseDown(node);
  keyDown(" ", {}, node);
};

/** The drop targets (the gaps between children) inside an element. */
export const dropTargets = (within: Element) => [
  ...within.querySelectorAll(".blocks-drop-target"),
];

/** An entry in the toolbar, by its name. */
export const toolbarPrimitive = (name: string) =>
  [...document.querySelectorAll(".Primitive")].find(
    (el) => el.textContent === name
  )!;

/** Type one character at the cursor, which opens a top-level quarantine. */
export const typeChar = (cmb: API, char: string) =>
  fireEvent.keyPress(cmb.getCM().getInputField(), {
    key: char,
    code: `Key${char.toUpperCase()}`,
    charCode: char.charCodeAt(0),
  });

/** Paste text with the text-editor paste event, at the cursor. */
export const pasteAtCursor = (cmb: API, text: string) =>
  fireEvent.paste(cmb.getCM().getInputField(), {
    clipboardData: { getData: () => text },
  });

/** Drag `src` onto `target` and drop it. */
export const dragOnto = (
  src: Element,
  target: Element,
  point?: { x: number; y: number }
) => {
  drag(src).dropOnto(target, point);
};

/**
 * Drag `src` onto the editor's whitespace at `loc`. jsdom has no layout, so
 * where the pointer is (and what is under it) is faked.
 */
export const dropOnWhitespace = (
  cmb: API,
  src: Element,
  loc: { line: number; ch: number }
) => {
  const wrapper = cmb.getCM().getWrapperElement();
  document.elementFromPoint = jest.fn(() => wrapper);
  jest.spyOn(cmb.getCM(), "coordsChar").mockReturnValue(loc as never);
  dragOnto(src, wrapper, { x: 20, y: 20 });
};
