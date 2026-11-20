import {
  keyDown,
  mouseDown,
  getMountedCMB,
  typeAtCursor,
  ASTNode,
  API,
} from "./test-utils";
import { schemeTable } from "../../src/lang-scheme";
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
/**
 * An entry in the old toolbar of primitives, by its name. This editor's toolbar lists templates (a page draws it), so the entry is a button that
 * a pointer press turns into a template drag; the template is the primitive's name as a symbol, added to the Scheme table for the test.
 */
export const toolbarPrimitive = (name: string): Element => {
  const mounted = getMountedCMB();
  if (!mounted)
    throw new Error("mount an editor before asking for a toolbar entry");
  const { ed } = mounted;
  const templates = (schemeTable.templates ??= {});
  templates[name] ??= { text: name, kind: "literal" };
  const button = document.createElement("button");
  button.className = "Primitive blocks-toolbar-item";
  button.textContent = name;
  button.addEventListener("pointerdown", (e) => {
    ed.beginTemplateDrag(e as PointerEvent, name);
    // (the old drop just puts the block in; here a dropped template opens its first hole for typing: close that box, as Escape does)
    document.addEventListener(
      "pointerup",
      () =>
        ed.view.dom
          .querySelector("input.blocks-edit")
          ?.dispatchEvent(
            new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
          ),
      { once: true }
    );
  });
  document.body.appendChild(button);
  return button;
};
export const typeChar = (cmb: API, char: string) =>
  typeAtCursor(cmb, char, "input.type");
export const pasteAtCursor = (cmb: API, text: string) =>
  typeAtCursor(cmb, text, "input.paste");
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
