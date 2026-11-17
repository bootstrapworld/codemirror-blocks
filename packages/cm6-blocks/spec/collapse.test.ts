/** @jest-environment jsdom */
/* Sixth round, step 2: collapse and expand, with the old editor's keys. */
import { checkLezerEditor, LezerBlockEditor } from "../src/lezer-view";
import { walk } from "../src/doc";
import { make } from "./helpers";
import type { BNode } from "../src/types";

const LANGS = ["scheme", "javascript", "python"];
const text = (ed: LezerBlockEditor) => ed.view.state.doc.toString();
const ok = (ed: LezerBlockEditor) => expect(checkLezerEditor(ed)).toEqual([]);
const all = (ed: LezerBlockEditor): BNode[] => {
  const o: BNode[] = [];
  ed.roots().forEach((r) => walk(r, (n) => o.push(n)));
  return o;
};
const src = (ed: LezerBlockEditor, n: BNode) => text(ed).slice(n.from, n.to);
const lit = (ed: LezerBlockEditor, s: string): BNode =>
  all(ed).filter((n) => n.kind === "literal" && src(ed, n) === s)[0];
const g = (ed: LezerBlockEditor): BNode =>
  all(ed).filter(
    (n) => n.slots.length > 0 && /^[(]?g[( ]2/.test(src(ed, n))
  )[0];
const key = (el: Element, k: string, mods: Partial<KeyboardEventInit> = {}) =>
  el.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: k,
      bubbles: true,
      cancelable: true,
      ...mods,
    })
  );
/** select the block (Space), then Delete: the old editor deletes only what is selected */
const del = (el: Element, k = "Delete") => {
  key(el, " ");
  key(el, k);
};
const focusOn = (ed: LezerBlockEditor, n: BNode) => {
  ed.focusNode(n);
  return ed.renderer.element(n);
};
const expanded = (ed: LezerBlockEditor, n: BNode) =>
  ed.renderer.element(n).getAttribute("aria-expanded");

describe.each(LANGS)("collapse and expand: %s", (l) => {
  test("Left collapses an expanded block (its text is untouched), Left again focuses the parent; Right expands, then enters", () => {
    const ed = make(l);
    const t0 = text(ed);
    const call = g(ed);
    key(focusOn(ed, call), "ArrowLeft");
    expect(expanded(ed, call)).toBe("false");
    expect(
      ed.renderer.element(call).classList.contains("blocks-collapsed")
    ).toBe(true);
    expect(text(ed)).toBe(t0);
    expect(ed.focusedNode()).toBe(call);
    key(ed.renderer.element(call), "ArrowLeft");
    expect(ed.focusedNode()).toBe(call.parent);
    key(focusOn(ed, call), "ArrowRight");
    expect(expanded(ed, call)).toBe("true");
    expect(ed.focusedNode()).toBe(call);
    key(ed.renderer.element(call), "ArrowRight");
    expect(ed.focusedNode()).toBe(call.slots.flatMap((s) => s.nodes)[0]);
    ok(ed);
  });
  test("a leaf is not expandable: Left goes to the parent", () => {
    const ed = make(l);
    const two = lit(ed, "2");
    key(focusOn(ed, two), "ArrowLeft");
    expect(ed.focusedNode()).toBe(two.parent);
    expect(ed.renderer.isCollapsed(two)).toBe(false);
  });
  test("Down and Up skip what is inside a collapsed block", () => {
    const ed = make(l);
    const call = g(ed);
    ed.collapse(call, true);
    const two = lit(ed, "2");
    const before = lit(ed, "1");
    key(focusOn(ed, before), "ArrowDown");
    expect(ed.focusedNode()).toBe(call);
    key(ed.renderer.element(call), "ArrowDown");
    expect(ed.focusedNode()).toBe(lit(ed, "3"));
    expect(ed.focusedNode()).not.toBe(two);
    key(ed.renderer.element(lit(ed, "3")), "ArrowUp");
    expect(ed.focusedNode()).toBe(call);
    ok(ed);
  });
  test("collapsed block: the head and an ellipsis are what is drawn; the rest is hidden by class", () => {
    const ed = make(l);
    const call = g(ed);
    ed.collapse(call, true);
    const el = ed.renderer.element(call);
    expect(el.getAttribute("aria-expanded")).toBe("false");
    // (hidden by the stylesheet: the argument list is the only slot that holds the children of a call)
    expect(el.querySelector(":scope > .blocks-args")).not.toBeNull();
    expect(el.classList.contains("blocks-collapsed")).toBe(true);
  });
  test("Shift-Left / Shift-Right collapse / expand all, focus on the root; Shift-Alt does it for the current root", () => {
    const ed = make(l);
    const compound = all(ed).filter((n) => n.slots.length > 0);
    key(focusOn(ed, g(ed)), "ArrowLeft", { shiftKey: true });
    expect(compound.every((n) => ed.renderer.isCollapsed(n))).toBe(true);
    expect(ed.focusedNode()).toBe(ed.roots()[0]);
    key(ed.renderer.element(ed.roots()[0]), "ArrowRight", { shiftKey: true });
    expect(compound.some((n) => ed.renderer.isCollapsed(n))).toBe(false);
    const h = ed.roots()[1];
    key(focusOn(ed, h), "ArrowLeft", { shiftKey: true, altKey: true });
    expect(ed.renderer.isCollapsed(h)).toBe(true);
    expect(ed.renderer.isCollapsed(ed.roots()[0])).toBe(false);
    key(ed.renderer.element(h), "ArrowRight", { shiftKey: true, altKey: true });
    expect(ed.renderer.isCollapsed(h)).toBe(false);
    ok(ed);
  });
  test("double click toggles; Enter on a compound block toggles", () => {
    const ed = make(l);
    const call = g(ed);
    ed.renderer
      .element(call)
      .dispatchEvent(
        new MouseEvent("dblclick", { bubbles: true, cancelable: true })
      );
    expect(ed.renderer.isCollapsed(call)).toBe(true);
    ed.renderer
      .element(call)
      .dispatchEvent(
        new MouseEvent("dblclick", { bubbles: true, cancelable: true })
      );
    expect(ed.renderer.isCollapsed(call)).toBe(false);
    key(focusOn(ed, call), "Enter");
    expect(ed.renderer.isCollapsed(call)).toBe(true);
  });
  test("collapsing while focus is inside moves focus to the collapsed block", () => {
    const ed = make(l);
    const call = g(ed);
    focusOn(ed, lit(ed, "2"));
    ed.collapse(call, true);
    expect(ed.focusedNode()).toBe(call);
  });
  test("collapsed state follows a block an edit rebuilds, and goes with a removed block", () => {
    const ed = make(l);
    const two = lit(ed, "2");
    const call = g(ed);
    ed.collapse(call, true);
    ed.replaceText(call, l === "scheme" ? "(g 2 3)" : "g(2, 3)"); // replaced by a new node
    const nc = g(ed);
    expect(ed.renderer.isCollapsed(nc)).toBe(true);
    expect(ed.renderer.element(nc).getAttribute("aria-expanded")).toBe("false");
    // an edit inside a collapsed block: the block is kept (or rebuilt) and stays collapsed
    ed.replaceText(lit(ed, "3"), "7");
    expect(ed.renderer.isCollapsed(g(ed))).toBe(true);
    // removed
    del(focusOn(ed, g(ed)), "Delete");
    expect(
      ed.renderer.collapsedNodes().filter((n) => ed.doc.byId.get(n.id) !== n)
    ).toEqual([]);
    expect(two).toBeDefined();
    ok(ed);
  });
});
