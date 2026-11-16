/** @jest-environment jsdom */
/* Sixth round, step 3: a click on a literal opens its edit box (the old editor's `normallyEditable`); a compound block only gets focus. */
import { checkLezerEditor, LezerBlockEditor } from "../src/lezer-view";
import { walk } from "../src/doc";
import { make } from "./helpers";
import type { BNode } from "../src/types";

const LANGS = ["scheme", "javascript", "python"];
const text = (ed: LezerBlockEditor) => ed.view.state.doc.toString();
const all = (ed: LezerBlockEditor): BNode[] => {
  const o: BNode[] = [];
  ed.roots().forEach((r) => walk(r, (n) => o.push(n)));
  return o;
};
const lit = (ed: LezerBlockEditor, s: string): BNode => all(ed).filter((n) => n.kind === "literal" && text(ed).slice(n.from, n.to) === s)[0];
const g = (ed: LezerBlockEditor): BNode => all(ed).filter((n) => n.slots.length > 0 && /^[(]?g[( ]2/.test(text(ed).slice(n.from, n.to)))[0];
const click = (el: Element, init: MouseEventInit = {}) => el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, ...init }));
const fire = (el: Element, type: string, x: number) => el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientX: x, clientY: 10 }));
const input = (ed: LezerBlockEditor) => ed.view.dom.querySelector("input.blocks-edit") as HTMLInputElement | null;

describe.each(LANGS)("click edits a literal: %s", (l) => {
  test("a click on an unfocused literal focuses it and opens its edit box; Enter commits", () => {
    const ed = make(l);
    click(ed.renderer.element(lit(ed, "2")));
    expect(input(ed)!.value).toBe("2");
    input(ed)!.value = "29";
    input(ed)!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    expect(text(ed)).toContain("29");
    expect(checkLezerEditor(ed)).toEqual([]);
  });
  test("a click on an already focused literal opens the box too", () => {
    const ed = make(l);
    ed.focusNode(lit(ed, "3"));
    click(ed.renderer.element(lit(ed, "3")));
    expect(input(ed)!.value).toBe("3");
  });
  test("a click on a compound block only focuses it", () => {
    const ed = make(l);
    click(ed.renderer.element(g(ed)));
    expect(ed.focusedNode()).toBe(g(ed));
    expect(ed.view.dom.querySelector(".blocks-edit")).toBeNull();
  });
  test("a press that moves is a drag, not an edit; the click that follows a drag is swallowed", () => {
    const ed = make(l);
    const three = lit(ed, "3");
    const el = ed.renderer.element(three);
    document.elementFromPoint = () => el;
    fire(el, "pointerdown", 10);
    fire(document.body, "pointermove", 100);
    fire(document.body, "pointerup", 100);
    click(el);
    expect(ed.view.dom.querySelector(".blocks-edit")).toBeNull();
  });
  test("a click with a modifier, or the second click of a double click, does not edit", () => {
    const ed = make(l);
    click(ed.renderer.element(lit(ed, "2")), { shiftKey: true });
    click(ed.renderer.element(lit(ed, "2")), { detail: 2 });
    expect(ed.view.dom.querySelector(".blocks-edit")).toBeNull();
  });
});
