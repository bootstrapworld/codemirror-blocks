import { act, createEvent, fireEvent, screen } from "@testing-library/react";

type Point = { x: number; y: number };

/**
 * jsdom has no DragEvent, so the pointer position has to be attached by hand
 * for react-dnd to see it.
 */
const fireDragEvent = (
  type: "dragEnter" | "dragOver" | "drop",
  el: Element,
  point?: Point
) => {
  const event = createEvent[type](el);
  if (point) {
    Object.defineProperty(event, "clientX", { value: point.x });
    Object.defineProperty(event, "clientY", { value: point.y });
  }
  fireEvent(el, event);
};

/**
 * What a real press does to keyboard focus, which `fireEvent.mouseDown` alone
 * does not do in jsdom: the pressed element, or its nearest focusable ancestor,
 * takes focus (so an open editing box loses it and closes); with no focusable
 * element, focus goes to the page.
 */
export const pressFocus = (el: Element) => {
  const focusable =
    "a[href], button, input, textarea, select, [contenteditable='true']";
  let target: Element | null = el;
  while (
    target &&
    !target.hasAttribute("tabindex") &&
    !target.matches(focusable)
  ) {
    target = target.parentElement;
  }
  // (focus handlers update state, as when the toolbar selects what it focuses)
  act(() => {
    if (target instanceof HTMLElement) {
      target.focus();
    } else if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  });
};

/**
 * Helper function to simulate dragging an element onto another element.
 *
 * @param srcNode the element to start dragging
 * @returns additional functions you can call to simulate dragging/dropping the element
 * over/onto another element. Pass `point` to say where the pointer is.
 */
export const drag = (srcNode: Element) => {
  // (focus moves as the default action of the press, unless a handler stops it)
  if (fireEvent.mouseDown(srcNode)) {
    pressFocus(srcNode);
  }
  fireEvent.dragStart(srcNode);
  const next = {
    dragOver: (overNode: Element, point?: Point) => {
      fireDragEvent("dragEnter", overNode, point);
      fireEvent.mouseOver(overNode);
      return {
        dragLeave: () => {
          fireEvent.dragLeave(overNode);
          fireEvent.mouseOut(overNode);
        },
      };
    },
    dropOnto: (ontoNode: Element, point?: Point) => {
      next.dragOver(ontoNode, point);
      fireDragEvent("drop", ontoNode, point);
    },
    /** release the drag without dropping on anything */
    cancel: () => {
      fireEvent.dragEnd(srcNode);
    },
  };
  return next;
};

/**
 * Get the element for a given ast node using it's aria-label
 * @param label string or regex to match the aria label
 * @returns the node, or throws if there is none.
 */
export const getNodeLabeled = (label: string | RegExp) =>
  screen.getByRole("treeitem", { name: label });
