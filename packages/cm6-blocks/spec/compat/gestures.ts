import { fireEvent } from "@testing-library/dom";
import { keyDown, mouseDown, ASTNode, API } from "./test-utils";
import { drag, type DragMode } from "./dnd";

export const kids = (node: ASTNode) => [...node.children()];
/** Click a block, then press Space to select it. */
export const select = (node: ASTNode) => {
  mouseDown(node);
  keyDown(" ", {}, node);
};
/** The drop targets (the gaps between children) inside an element. (the old ones are `.blocks-drop-target`; here a gap is `.blocks-gap`) */
export const dropTargets = (within: Element) => [
  ...within.querySelectorAll(".blocks-gap"),
];
/** An entry in the toolbar, by its name: this editor draws no toolbar of its own (the page does), so there is none to find */
export const toolbarPrimitive = (name: string) =>
  [...document.querySelectorAll(".Primitive, .blocks-toolbar-item")].find(
    (el) => el.textContent === name
  )!;
export const typeChar = (cmb: API, char: string) =>
  fireEvent.keyPress(cmb.getCM().getInputField(), {
    key: char,
    code: `Key${char.toUpperCase()}`,
    charCode: char.charCodeAt(0),
  });
export const pasteAtCursor = (cmb: API, text: string) =>
  fireEvent.paste(cmb.getCM().getInputField(), {
    clipboardData: { getData: () => text },
  });
export const dragOnto = (
  src: Element,
  target: Element,
  point?: { x: number; y: number },
  mode?: DragMode
) => {
  drag(src, mode).dropOnto(target, point);
};
/** Drag `src` onto the editor's whitespace at `loc` (this editor has no whitespace target: the drop is over the editor and takes nowhere, or at a root's edge) */
export const dropOnWhitespace = (
  cmb: API,
  src: Element,
  _loc: { line: number; ch: number },
  mode?: DragMode
) => {
  const wrapper = cmb.getCM().getWrapperElement();
  document.elementFromPoint = jest.fn(() => wrapper);
  dragOnto(src, wrapper, { x: 20, y: 20 }, mode);
};
