/** @jest-environment jsdom */
/* Eighth round, step 4: a finger dragging a template out of the toolbar (the rule: a long press, then the drag; a swipe is the toolbar's). */
import { checkLezerEditor, LezerBlockEditor } from "../src/lezer-view";
import { walk } from "../src/doc";
import { make, TEXT } from "./helpers";
import type { BNode } from "../src/types";

const LANGS = ["scheme", "javascript", "python"];
const text = (ed: LezerBlockEditor) => ed.view.state.doc.toString();
const all = (ed: LezerBlockEditor): BNode[] => {
  const o: BNode[] = [];
  ed.roots().forEach((r) => walk(r, (n) => o.push(n)));
  return o;
};
const ptr = (
  el: Element | Document,
  type: string,
  x: number,
  pointerType: string,
  y = 10
) => {
  const e = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    button: 0,
    clientX: x,
    clientY: y,
  });
  Object.defineProperty(e, "pointerType", { value: pointerType });
  Object.defineProperty(e, "pointerId", { value: 7 });
  el.dispatchEvent(e);
  return e;
};

describe.each(LANGS)(
  "a finger drags a template out of the toolbar: %s",
  (l) => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    function setup() {
      const ed = make(l);
      const args = all(ed)
        .find((n) => n.slots.some((s) => s.name === "args"))!
        .slots.find((s) => s.name === "args")!;
      const gap = ed.renderer
        .element(args.owner)
        .querySelector(
          `.blocks-args[data-slot="args"] > .blocks-gap[data-index="1"]`
        ) as HTMLElement;
      const button = document.createElement("button");
      document.body.appendChild(button);
      const at = { el: document.body as Element };
      document.elementFromPoint = () => at.el;
      const down = (x = 5, type = "touch") =>
        ed.beginTemplateDrag(
          ptr(button, "pointerdown", x, type) as PointerEvent,
          "number"
        );
      return { ed, gap, button, at, down };
    }
    afterEach(() =>
      document
        .querySelectorAll("button, .blocks-drag-ghost")
        .forEach((e) => e.remove())
    );

    test("a finger that moves before the long press is over is swiping the toolbar: no drag, nothing written", () => {
      const { ed, gap, at, down } = setup();
      down();
      at.el = gap;
      ptr(document, "pointermove", 40, "touch");
      jest.advanceTimersByTime(600);
      expect(ed.view.dom.classList.contains("blocks-dragging")).toBe(false);
      expect(document.querySelector(".blocks-drag-ghost")).toBeNull();
      ptr(document, "pointerup", 40, "touch");
      expect(text(ed)).toBe(TEXT[l]);
    });

    test("a long press starts the drag: gaps grow (a class), a ghost follows, touchmove cannot scroll, the menu and selection are held off; the drop writes the block", () => {
      const { ed, gap, at, down } = setup();
      down();
      expect(ed.view.dom.classList.contains("blocks-dragging")).toBe(false);
      jest.advanceTimersByTime(400);
      expect(ed.view.dom.classList.contains("blocks-dragging")).toBe(true);
      expect(ed.view.dom.classList.contains("blocks-touch-drag")).toBe(true);
      const ghost = document.querySelector(".blocks-drag-ghost") as HTMLElement;
      expect(ghost.textContent).toBe("number");
      for (const [type, held] of [
        ["touchmove", true],
        ["contextmenu", true],
        ["selectstart", true],
      ] as const) {
        const e = new Event(type, { bubbles: true, cancelable: true });
        document.body.dispatchEvent(e);
        expect(e.defaultPrevented).toBe(held);
      }
      at.el = gap;
      ptr(document, "pointermove", 60, "touch", 30);
      expect(gap.classList.contains("blocks-drop-target")).toBe(true);
      expect(ghost.style.left).toBe("60px");
      expect(parseInt(ghost.style.top)).toBeLessThan(30); // (above the finger)
      ptr(document, "pointerup", 60, "touch", 30);
      expect(text(ed).split("\n")[0]).toMatch(/[, ]0[, ]/);
      expect(ed.view.dom.classList.contains("blocks-touch-drag")).toBe(false);
      expect(ed.view.dom.classList.contains("blocks-dragging")).toBe(false);
      expect(document.querySelector(".blocks-drag-ghost")).toBeNull();
      expect(document.querySelector(".blocks-hole")).toBeNull();
      // afterwards the page scrolls again
      const tm = new Event("touchmove", { bubbles: true, cancelable: true });
      document.body.dispatchEvent(tm);
      expect(tm.defaultPrevented).toBe(false);
      expect(
        ed.activityLog().find((e) => e.action === "templateDrop")?.detail
      ).toMatchObject({ name: "number", touch: true });
      ed.view.dom
        .querySelector("input.blocks-edit")
        ?.dispatchEvent(
          new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
        );
      expect(checkLezerEditor(ed)).toEqual([]);
    });

    test("a long press that is let go on the toolbar writes nothing and does not press the button", () => {
      const { ed, button, down } = setup();
      let clicks = 0;
      button.addEventListener("click", () => clicks++);
      down();
      jest.advanceTimersByTime(400);
      ptr(document, "pointerup", 5, "touch");
      button.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true })
      );
      expect(clicks).toBe(0);
      expect(text(ed)).toBe(TEXT[l]);
      expect(document.querySelector(".blocks-drag-ghost")).toBeNull();
    });

    test("a tap (let go before the long press) is left to the button's own click", () => {
      const { ed, button, down } = setup();
      let clicks = 0;
      button.addEventListener("click", () => clicks++);
      down();
      jest.advanceTimersByTime(100);
      ptr(document, "pointerup", 5, "touch");
      button.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true })
      );
      expect(clicks).toBe(1);
      expect(ed.view.dom.classList.contains("blocks-dragging")).toBe(false);
      jest.advanceTimersByTime(600);
      expect(ed.view.dom.classList.contains("blocks-dragging")).toBe(false); // (the timer is gone)
    });

    test("the holes are marked while a finger drags, and unmarked after; a mouse drag has no long press and no growing", () => {
      const { ed, at, down } = setup();
      const x = make(
        l,
        l === "scheme"
          ? "(f ... 2)\n(if x 1 2)\n"
          : l === "javascript"
            ? "f(1, 2);\nif (x) { f(1); } else { f(2); }\n"
            : "f(1, 2)\nif x:\n    f(1)\nelse:\n    f(2)\n"
      );
      x.removeNode(
        all(x).find(
          (n) =>
            n.slot &&
            n.slot.kind === "one" &&
            n.slots.length === 0 &&
            n.parent &&
            n.parent.kind !== "program"
        )!
      );
      x.beginTemplateDrag(
        ptr(document.body, "pointerdown", 5, "touch") as PointerEvent,
        "number"
      );
      jest.advanceTimersByTime(400);
      expect(
        x.view.dom.querySelectorAll(".blocks-hole").length
      ).toBeGreaterThan(0);
      ptr(document, "pointerup", 5, "touch");
      expect(x.view.dom.querySelectorAll(".blocks-hole").length).toBe(0);
      // a mouse
      down(5, "mouse");
      at.el = document.body;
      ptr(document, "pointermove", 20, "mouse");
      expect(ed.view.dom.classList.contains("blocks-dragging")).toBe(true);
      expect(ed.view.dom.classList.contains("blocks-touch-drag")).toBe(false);
      ptr(document, "pointerup", 20, "mouse");
    });
  }
);
