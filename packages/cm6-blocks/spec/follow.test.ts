/** @jest-environment jsdom */
/* Sixth round, step 1: focus and selection follow the block that an edit rebuilds ("the node now at this place"). */
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
const lit = (ed: LezerBlockEditor, s: string): BNode => all(ed).filter((n) => n.kind === "literal" && src(ed, n) === s)[0];
const g = (ed: LezerBlockEditor): BNode => all(ed).filter((n) => n.slots.length > 0 && /^[(]?g[( ]2/.test(src(ed, n)))[0];
const key = (el: Element, k: string, mods: Partial<KeyboardEventInit> = {}) => el.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true, ...mods }));
/** select the block (Space), then Delete: the old editor deletes only what is selected */
const del = (el: Element, k = "Delete") => {
  key(el, " ");
  key(el, k);
};
const focusOn = (ed: LezerBlockEditor, n: BNode) => {
  ed.focusNode(n);
  return ed.renderer.element(n);
};
const space = (ed: LezerBlockEditor, n: BNode) => key(focusOn(ed, n), " ");
const selected = (ed: LezerBlockEditor, n: BNode) => ed.renderer.isSelected(n);
const editLeaf = (ed: LezerBlockEditor, n: BNode, v: string) => {
  key(focusOn(ed, n), "Enter");
  const input = ed.view.dom.querySelector("input.blocks-edit") as HTMLInputElement;
  input.value = v;
  key(input, "Enter");
};
const editAsText = (ed: LezerBlockEditor, n: BNode, v: string) => {
  key(focusOn(ed, n), "Enter", { ctrlKey: true });
  const b = ed.view.dom.querySelector("textarea.blocks-edit") as HTMLTextAreaElement;
  b.value = v;
  key(b, "Enter");
};
const SEVERAL: Record<string, string> = { scheme: "7 8", javascript: "7, 8", python: "7, 8" };
const CALL: Record<string, string> = { scheme: "(g 2 3 4)", javascript: "g(2, 3, 4)", python: "g(2, 3, 4)" };

describe.each(LANGS)("focus follows a rebuilt block: %s", (l) => {
  test("edit a leaf: focus is on the new node in the same slot and index", () => {
    const ed = make(l);
    const two = lit(ed, "2");
    const { slot } = two;
    const idx = slot!.nodes.indexOf(two);
    editLeaf(ed, two, "27");
    const f = ed.focusedNode()!;
    expect(f).not.toBeNull();
    expect(src(ed, f)).toBe("27");
    expect(f.slot!.nodes.indexOf(f)).toBe(idx);
    expect(f.parent).toBe(g(ed));
    ok(ed);
  });
  test("edit a leaf into a call: focus is on the new block", () => {
    const ed = make(l);
    editLeaf(ed, lit(ed, "2"), l === "scheme" ? "(m 1)" : "m(1)");
    const f = ed.focusedNode()!;
    expect(src(ed, f)).toBe(l === "scheme" ? "(m 1)" : "m(1)");
    ok(ed);
  });
  test("edit as text: focus on the new call; one block into several: the first", () => {
    const ed = make(l);
    editAsText(ed, g(ed), CALL[l]);
    expect(src(ed, ed.focusedNode()!)).toBe(CALL[l]);
    const three = lit(ed, "3");
    editAsText(ed, three, SEVERAL[l]);
    const f = ed.focusedNode()!;
    expect(src(ed, f)).toBe("7");
    ok(ed);
  });
  test("edit as text of a top-level block", () => {
    const ed = make(l);
    const h = ed.roots()[1];
    editAsText(ed, h, l === "scheme" ? "(hh 4 5)" : "hh(4, 5)");
    expect(src(ed, ed.focusedNode()!)).toBe(l === "scheme" ? "(hh 4 5)" : "hh(4, 5)");
    ok(ed);
  });
  test("text that does not parse: focus lands on a nearby block", () => {
    const ed = make(l);
    editAsText(ed, lit(ed, "2"), l === "scheme" ? "(((" : "(((");
    expect(ed.focusedNode()).not.toBeNull();
    ok(ed);
  });
  test("a blank filled in: focus on the new block", () => {
    const ed = make(l);
    del(focusOn(ed, lit(ed, "2")), "Delete");
    const blank = ed.focusedNode()!;
    ed.replaceText(blank, "5");
    const f = ed.focusedNode()!;
    expect(f).not.toBeNull();
    expect(src(ed, f)).toBe("5");
    ok(ed);
  });
  test("undo and redo of an edit: focus on the block at that place", () => {
    const ed = make(l);
    const two = lit(ed, "2");
    editLeaf(ed, two, "27");
    key(ed.focusedNode() ? ed.renderer.element(ed.focusedNode()!) : ed.view.contentDOM, "z", { ctrlKey: true });
    expect(text(ed)).toContain("2");
    expect(text(ed)).not.toContain("27");
    expect(src(ed, ed.focusedNode()!)).toBe("2");
    key(ed.renderer.element(ed.focusedNode()!), "z", { ctrlKey: true, shiftKey: true });
    expect(src(ed, ed.focusedNode()!)).toBe("27");
    ok(ed);
  });
});

describe.each(LANGS)("selection follows a rebuilt block: %s", (l) => {
  test("a selected leaf that an edit replaces stays selected (the new node)", () => {
    const ed = make(l);
    const two = lit(ed, "2");
    space(ed, two);
    expect(selected(ed, two)).toBe(true);
    ed.replaceText(two, "27");
    const n = lit(ed, "27");
    expect(n).not.toBe(two);
    expect(selected(ed, n)).toBe(true);
    expect(ed.selectedBlocks()).toEqual([n]);
    expect(ed.renderer.element(n).getAttribute("aria-selected")).toBe("true");
    ok(ed);
  });
  test("a selected ancestor stays selected and so does the new descendant", () => {
    const ed = make(l);
    const call = g(ed);
    space(ed, call);
    ed.replaceText(lit(ed, "2"), "27");
    expect(selected(ed, g(ed))).toBe(true);
    expect(selected(ed, lit(ed, "27"))).toBe(true);
    ok(ed);
  });
  // (opening an edit box clears the selection, as in the old editor: these edits go through the API, a paste or the history)
  test("selected block replaced by text (replaced by a new node) stays selected", () => {
    const ed = make(l);
    space(ed, g(ed));
    ed.replaceText(g(ed), CALL[l]);
    const n = all(ed).find((x) => src(ed, x) === CALL[l])!;
    expect(selected(ed, n)).toBe(true);
    expect(selected(ed, lit(ed, "4"))).toBe(true);
    ok(ed);
  });
  test("a block that was really removed leaves the selection", () => {
    const ed = make(l);
    const three = lit(ed, "3");
    space(ed, three);
    del(focusOn(ed, three), "Delete");
    expect(ed.renderer.selected().filter((n) => ed.doc.byId.get(n.id) !== n)).toEqual([]);
    expect(ed.selectedBlocks().map((n) => src(ed, n))).not.toContain("3");
    ok(ed);
  });
  test("undo of an edit keeps the selection on the block at that place", () => {
    const ed = make(l);
    space(ed, lit(ed, "2"));
    ed.replaceText(lit(ed, "2"), "27");
    key(ed.renderer.element(ed.focusedNode()!), "z", { ctrlKey: true });
    expect(selected(ed, lit(ed, "2"))).toBe(true);
    ok(ed);
  });
});
