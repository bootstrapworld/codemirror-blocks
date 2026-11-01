import { act, createEvent, fireEvent, screen } from "@testing-library/react";
import { LONG_PRESS_MS } from "../../src/dnd";

type Point = { x: number; y: number };

/**
 * Fire a pointer event the way a mouse would. jsdom has no layout, so what is
 * under the pointer (which `document.elementFromPoint` reports to the drag
 * layer) is whatever `under` says.
 */
export const firePointer = (
  type: "pointerDown" | "pointerMove" | "pointerUp" | "pointerCancel",
  el: Element,
  point: Point,
  under: Element = el,
  pointerType: "mouse" | "touch" = "mouse"
): void => {
  document.elementFromPoint = jest.fn(() => under);
  // jsdom has no PointerEvent, so the fields the drag layer reads are attached
  // by hand to a plain event.
  const event = createEvent[type](el);
  Object.defineProperties(event, {
    clientX: { value: point.x },
    clientY: { value: point.y },
    pointerId: { value: 1 },
    pointerType: { value: pointerType },
    button: { value: 0 },
  });
  fireEvent(el, event);
};

/**
 * "touch" is a finger that pressed long enough to pick the block up;
 * "early-touch" one that moved before the long press was over (a scroll).
 */
export type DragMode = "mouse" | "touch" | "early-touch";

const START: Point = { x: 10, y: 10 };
/** far enough from START to begin a drag, and the default pointer position */
const AWAY: Point = { x: 30, y: 30 };

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
export const drag = (srcNode: Element, mode: DragMode = "mouse") => {
  const touch = mode !== "mouse";
  const kind = touch ? "touch" : "mouse";
  const fire = (
    type: Parameters<typeof firePointer>[0],
    el: Element,
    point: Point,
    under?: Element
  ) => firePointer(type, el, point, under, kind);
  // A touch drag starts after a long press. The press timer is held back and
  // run by hand, so that a sequence never depends on the clock.
  const held: (() => void)[] = [];
  if (touch) {
    const real = global.setTimeout;
    jest.spyOn(global, "setTimeout").mockImplementation(((
      fn: () => void,
      ms?: number,
      ...args: unknown[]
    ) => {
      if (ms === LONG_PRESS_MS) {
        held.push(fn);
        return 0;
      }
      return real(fn, ms, ...(args as []));
    }) as unknown as typeof setTimeout);
  }
  // (focus moves as the default action of the press, unless a handler stops it)
  fire("pointerDown", srcNode, START);
  if (!touch && fireEvent.mouseDown(srcNode)) {
    pressFocus(srcNode);
  }
  if (touch) {
    jest.mocked(global.setTimeout).mockRestore();
    if (mode === "touch") {
      act(() => held.forEach((fn) => fn()));
    }
  }
  // moving a few pixels is what starts a mouse drag (and cancels a touch that
  // moved before the long press was over: it was a scroll)
  fire("pointerMove", srcNode, { x: START.x + 10, y: START.y + 10 });
  let at = AWAY;
  const next = {
    dragOver: (overNode: Element, point?: Point) => {
      at = point ?? AWAY;
      fire("pointerMove", overNode, at);
      fireEvent.mouseOver(overNode);
      return {
        dragLeave: () => {
          fire("pointerMove", document.body, { x: 900, y: 900 });
          fireEvent.mouseOut(overNode);
        },
      };
    },
    /** `under` is what `elementFromPoint` reports, when not `ontoNode` itself */
    dropOnto: (ontoNode: Element, point?: Point, under?: Element) => {
      next.dragOver(ontoNode, point);
      fire("pointerUp", ontoNode, at, under);
    },
    /** release the drag without dropping on anything */
    cancel: () => {
      fire("pointerCancel", srcNode, at);
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
