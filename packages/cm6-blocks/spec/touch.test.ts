/** @jest-environment jsdom */
/* Fifth round, step 6: a finger. A long press starts a drag (a quick swipe is the page's), a second tap on the focused block edits it. */
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
const lit = (ed: LezerBlockEditor, src: string): BNode => all(ed).filter((n) => n.kind === "literal" && text(ed).slice(n.from, n.to) === src)[0];
const ptr = (el: Element, type: string, x: number, pointerType: string) => {
  const e = new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientX: x, clientY: 10 });
  Object.defineProperty(e, "pointerType", { value: pointerType });
  el.dispatchEvent(e);
  return e;
};

describe.each(LANGS)("touch: %s", (l) => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  function setup() {
    const ed = make(l);
    const args = all(ed).find((n) => n.slots.some((s) => s.name === "args"))!.slots.find((s) => s.name === "args")!;
    const three = args.nodes[2];
    const gap = ed.renderer.element(args.owner).querySelector(`.blocks-args[data-slot="args"] > .blocks-gap[data-index="0"]`) as HTMLElement;
    const at = { x: 0 };
    document.elementFromPoint = () => (at.x === 100 ? gap : ed.renderer.element(three));
    return { ed, three, at, gap };
  }

  test("a finger that moves before the long press is over scrolls the page: no drag", () => {
    const { ed, three, at } = setup();
    ptr(ed.renderer.element(three), "pointerdown", 10, "touch");
    at.x = 100;
    ptr(document.body, "pointermove", 100, "touch");
    jest.advanceTimersByTime(600);
    expect(ed.view.dom.classList.contains("blocks-dragging")).toBe(false);
    ptr(document.body, "pointerup", 100, "touch");
    expect(text(ed)).toBe(TEXT[l]);
  });

  test("a long press, then moving the finger, drags the block; the page's own scrolling is held off", () => {
    const { ed, three, at, gap } = setup();
    ptr(ed.renderer.element(three), "pointerdown", 10, "touch");
    expect(ed.view.dom.classList.contains("blocks-dragging")).toBe(false);
    jest.advanceTimersByTime(400);
    expect(ed.view.dom.classList.contains("blocks-dragging")).toBe(true);
    // the touchmove of the finger is not allowed to scroll
    const tm = new Event("touchmove", { bubbles: true, cancelable: true });
    document.body.dispatchEvent(tm);
    expect(tm.defaultPrevented).toBe(true);
    at.x = 100;
    ptr(document.body, "pointermove", 100, "touch");
    expect(gap.classList.contains("blocks-drop-target")).toBe(true);
    ptr(document.body, "pointerup", 100, "touch");
    expect(text(ed).split("\n")[0]).toMatch(/3[, ]+1/);
    expect(checkLezerEditor(ed)).toEqual([]);
    // afterwards the page scrolls again
    const tm2 = new Event("touchmove", { bubbles: true, cancelable: true });
    document.body.dispatchEvent(tm2);
    expect(tm2.defaultPrevented).toBe(false);
  });

  test("a tap on a block focuses it; a second tap on the focused one edits it (a leaf: its text, a call: its whole text)", () => {
    const { ed } = setup();
    const two = lit(ed, "2");
    const tap = (n: BNode) => {
      const el = ed.renderer.element(n);
      ptr(el, "pointerdown", 10, "touch");
      ptr(el, "pointerup", 10, "touch");
      const e = new MouseEvent("click", { bubbles: true, cancelable: true });
      Object.defineProperty(e, "pointerType", { value: "touch" });
      ed.renderer.element(n).dispatchEvent(e);
    };
    tap(two);
    expect(ed.focusedNode()).toBe(two);
    expect(ed.view.dom.querySelector(".blocks-edit")).toBeNull();
    tap(two);
    const input = ed.view.dom.querySelector("input.blocks-edit") as HTMLInputElement;
    expect(input.value).toBe("2");
    input.value = "22";
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    expect(text(ed)).toContain("22");
    // a call: the whole text in a textarea
    const call = all(ed).find((n) => n.slots.length > 0 && /^[(]?g[( ]22/.test(text(ed).slice(n.from, n.to)))!;
    tap(call);
    tap(call);
    const ta = ed.view.dom.querySelector("textarea.blocks-edit") as HTMLTextAreaElement;
    expect(ta.value).toMatch(/^\(?g[( ]22\)$/);
    ta.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    // a mouse click on the focused block does not edit
    const e = new MouseEvent("click", { bubbles: true, cancelable: true });
    ed.renderer.element(call).dispatchEvent(e);
    expect(ed.view.dom.querySelector(".blocks-edit")).toBeNull();
    expect(checkLezerEditor(ed)).toEqual([]);
  });
});
