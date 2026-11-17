import { createEvent, fireEvent, screen } from "@testing-library/dom";

type Point = { x: number; y: number };
export const LONG_PRESS_MS = 350;

/** a pointer event; jsdom has no layout, so what is under the pointer is whatever `under` says */
export const firePointer = (type: "pointerDown" | "pointerMove" | "pointerUp" | "pointerCancel", el: Element, point: Point, under: Element = el, pointerType: "mouse" | "touch" = "mouse"): void => {
  document.elementFromPoint = jest.fn(() => under);
  const event = createEvent[type](el);
  Object.defineProperties(event, { clientX: { value: point.x }, clientY: { value: point.y }, pointerId: { value: 1 }, pointerType: { value: pointerType }, button: { value: 0 } });
  fireEvent(el, event);
};
export type DragMode = "mouse" | "touch" | "early-touch";
const START: Point = { x: 10, y: 10 };
const AWAY: Point = { x: 30, y: 30 };

export const pressFocus = (el: Element) => {
  let t: Element | null = el;
  while (t && !t.hasAttribute("tabindex") && !t.matches("a[href], button, input, textarea, select")) t = t.parentElement;
  if (t instanceof HTMLElement) t.focus();
  else if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
};

/** the old helper, unchanged in how it is used: `drag(src).dropOnto(target, point)` */
export const drag = (srcNode: Element, mode: DragMode = "mouse") => {
  const touch = mode !== "mouse";
  const kind = touch ? "touch" : "mouse";
  const fire = (type: Parameters<typeof firePointer>[0], el: Element, point: Point, under?: Element) => firePointer(type, el, point, under, kind);
  const held: (() => void)[] = [];
  if (touch) {
    const real = global.setTimeout;
    jest.spyOn(global, "setTimeout").mockImplementation(((fn: () => void, ms?: number, ...args: unknown[]) => {
      if (ms === LONG_PRESS_MS) {
        held.push(fn);
        return 0;
      }
      return real(fn, ms, ...(args as []));
    }) as unknown as typeof setTimeout);
  }
  fire("pointerDown", srcNode, START);
  if (!touch && fireEvent.mouseDown(srcNode)) pressFocus(srcNode);
  if (touch) {
    jest.mocked(global.setTimeout).mockRestore();
    if (mode === "touch") held.forEach((fn) => fn());
  }
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
    dropOnto: (ontoNode: Element, point?: Point, under?: Element) => {
      next.dragOver(ontoNode, point);
      fire("pointerUp", ontoNode, at, under);
    },
    cancel: () => {
      fire("pointerCancel", srcNode, at);
    },
  };
  return next;
};
export const getNodeLabeled = (label: string | RegExp) => screen.getByRole("treeitem", { name: label });
