/** @jest-environment jsdom */
import { walk } from "../src/doc";
import { createLezerBlockEditor, checkLezerEditor, LezerBlockEditor, LezerOptions } from "../src/lezer-view";
import { nextBlock, prevBlock } from "../src/interact";
import { schemeParser, schemeTable } from "../src/lang-scheme";
import { javascriptParser, javascriptTable } from "../src/lang-javascript";
import { pythonParser, pythonTable } from "../src/lang-python";
import type { BNode } from "../src/types";

const zeroRect = { x: 0, y: 0, width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0, toJSON: () => ({}) };
if (!Range.prototype.getClientRects) Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
if (!Range.prototype.getBoundingClientRect) Range.prototype.getBoundingClientRect = () => zeroRect as DOMRect;

const LANGS: Record<string, { opts: LezerOptions; text: string; blank: string; sib: string }> = {
  scheme: { opts: { parser: schemeParser as never, table: schemeTable }, text: "(f 1 (g 2) 3)\n(h 4)", blank: "...", sib: "9" },
  javascript: { opts: { parser: javascriptParser as never, table: javascriptTable }, text: "f(1, g(2), 3);\nh(4);", blank: "undefined", sib: "9" },
  python: { opts: { parser: pythonParser as never, table: pythonTable }, text: "f(1, g(2), 3)\nh(4)", blank: "...", sib: "9" },
};

const made: LezerBlockEditor[] = [];
function make(l: string, text?: string): LezerBlockEditor {
  const parent = document.createElement("div");
  document.body.appendChild(parent);
  const ed = createLezerBlockEditor(parent, text ?? LANGS[l].text, LANGS[l].opts);
  made.push(ed);
  return ed;
}
afterEach(() => {
  while (made.length) {
    const ed = made.pop() as LezerBlockEditor;
    const parent = ed.view.dom.parentElement;
    ed.destroy();
    parent?.remove();
  }
});
const textOf = (ed: LezerBlockEditor) => ed.view.state.doc.toString();
const all = (ed: LezerBlockEditor): BNode[] => {
  const o: BNode[] = [];
  ed.roots().forEach((r) => walk(r, (n) => o.push(n)));
  return o;
};
const withText = (ed: LezerBlockEditor, t: string, nth = 0): BNode => {
  const m = all(ed).filter((n) => textOf(ed).slice(n.from, n.to) === t && n.kind !== "statement");
  if (!m[nth]) throw new Error(`no node ${t}`);
  return m[nth];
};
const key = (el: Element, k: string, mods: Partial<KeyboardEventInit> = {}) =>
  el.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true, ...mods }));
const focusOn = (ed: LezerBlockEditor, n: BNode) => {
  ed.focusNode(n);
  expect(ed.focusedNode()).toBe(n);
  return ed.renderer.element(n);
};
const ok = (ed: LezerBlockEditor) => expect(checkLezerEditor(ed)).toEqual([]);

describe.each(Object.keys(LANGS))("keys and mouse: %s", (l) => {
  test("click focuses a block", () => {
    const ed = make(l);
    const n = withText(ed, "2");
    ed.renderer.element(n).dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(ed.focusedNode()).toBe(n);
  });

  test("ArrowDown / ArrowUp walk the blocks in document order", () => {
    const ed = make(l);
    const order: BNode[] = [];
    for (let n: BNode | null = ed.roots()[0]; n; n = nextBlock(n)) order.push(n);
    expect(order.length).toBeGreaterThan(8);
    expect(order.map((n) => n.from)).toEqual([...order.map((n) => n.from)].sort((a, b) => a - b));
    let el = focusOn(ed, order[0]);
    for (let i = 1; i < order.length; i++) {
      key(el, "ArrowDown");
      expect(ed.focusedNode()).toBe(order[i]);
      el = ed.renderer.element(order[i]);
    }
    key(el, "ArrowDown"); // the last: stays
    expect(ed.focusedNode()).toBe(order[order.length - 1]);
    for (let i = order.length - 2; i >= 0; i--) {
      key(el, "ArrowUp");
      expect(ed.focusedNode()).toBe(order[i]);
      el = ed.renderer.element(order[i]);
    }
    expect(prevBlock(order[0])).toBeNull();
  });

  test("ArrowRight goes to the first child, ArrowLeft to the parent", () => {
    const ed = make(l);
    const g = ed.roots()[0];
    let el = focusOn(ed, g);
    key(el, "ArrowRight");
    const child = g.slots.flatMap((s) => s.nodes)[0];
    expect(ed.focusedNode()).toBe(child);
    el = ed.renderer.element(child);
    key(el, "ArrowLeft");
    expect(ed.focusedNode()).toBe(g);
    key(ed.renderer.element(g), "ArrowLeft"); // a root has no parent: stays
    expect(ed.focusedNode()).toBe(g);
  });

  test("Delete and Backspace remove a list element", () => {
    const ed = make(l);
    const t0 = textOf(ed);
    const el = focusOn(ed, withText(ed, "2"));
    key(el, "Delete");
    expect(textOf(ed)).not.toBe(t0);
    ok(ed);
    const el2 = focusOn(ed, withText(ed, "3"));
    const t1 = textOf(ed);
    key(el2, "Backspace");
    expect(textOf(ed).length).toBeLessThan(t1.length);
    ok(ed);
  });

  test("Delete in a 'one' slot puts the language's blank there", () => {
    const ed = make(l);
    // a node that is in a "one" slot and is a leaf
    const leaf = all(ed).find((n) => n.slot?.kind === "one" && n.slots.length === 0 && n.parent?.kind !== "program")!;
    expect(leaf).toBeDefined();
    const src = textOf(ed).slice(leaf.from, leaf.to);
    const el = focusOn(ed, leaf);
    key(el, "Delete");
    expect(textOf(ed)).toContain(LANGS[l].blank);
    expect(textOf(ed).slice(leaf.from, leaf.from + LANGS[l].blank.length)).toBe(LANGS[l].blank);
    expect(src).not.toBe(LANGS[l].blank);
    ok(ed);
  });

  test("Enter edits a leaf in place; Enter commits, Escape cancels", () => {
    const ed = make(l);
    const n = withText(ed, "2");
    const el = focusOn(ed, n);
    key(el, "Enter");
    let input = ed.view.dom.querySelector("input.blocks-edit") as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(input.value).toBe("2");
    input.value = "27";
    key(input, "Enter");
    expect(ed.view.dom.querySelector("input.blocks-edit")).toBeNull();
    expect(textOf(ed)).toContain("27");
    ok(ed);
    // cancel
    const m = withText(ed, "27");
    key(focusOn(ed, m), "Enter");
    input = ed.view.dom.querySelector("input.blocks-edit") as HTMLInputElement;
    input.value = "zzz";
    key(input, "Escape");
    expect(ed.view.dom.querySelector("input.blocks-edit")).toBeNull();
    expect(textOf(ed)).not.toContain("zzz");
    ok(ed);
    expect(ed.focusedNode()).not.toBeNull();
  });

  test("Enter with text that does not parse cleanly is accepted", () => {
    const ed = make(l);
    const n = withText(ed, "2");
    key(focusOn(ed, n), "Enter");
    const input = ed.view.dom.querySelector("input.blocks-edit") as HTMLInputElement;
    input.value = l === "scheme" ? "(((" : "2 +* (";
    key(input, "Enter");
    expect(textOf(ed)).toContain(input.value);
    ok(ed);
  });

  test("Ctrl-] / Ctrl-[ open a box for a sibling after / before", () => {
    const ed = make(l);
    const two = withText(ed, "2");
    key(focusOn(ed, two), "]", { ctrlKey: true });
    let input = ed.view.dom.querySelector("input.blocks-edit") as HTMLInputElement;
    expect(input).not.toBeNull();
    input.value = "88";
    key(input, "Enter");
    expect(textOf(ed)).toMatch(/2\W+88/);
    ok(ed);
    const two2 = withText(ed, "2");
    key(focusOn(ed, two2), "[", { ctrlKey: true });
    input = ed.view.dom.querySelector("input.blocks-edit") as HTMLInputElement;
    input.value = "77";
    key(input, "Enter");
    expect(textOf(ed)).toMatch(/77\W+2/);
    ok(ed);
  });

  test("a click on a gap opens a box there", () => {
    const ed = make(l);
    const g = all(ed).find((n) => n.kind === "call")!;
    const gaps = Array.from(ed.renderer.element(g).querySelectorAll(":scope > .blocks-args > .blocks-gap"));
    const gap = gaps[1] as HTMLElement; // between the first and second argument
    gap.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    const input = ed.view.dom.querySelector("input.blocks-edit") as HTMLInputElement;
    expect(input).not.toBeNull();
    input.value = "55";
    key(input, "Enter");
    expect(textOf(ed)).toMatch(/1\W+55\W+/);
    ok(ed);
  });

  test("Ctrl-Z and Ctrl-Shift-Z undo and redo", () => {
    const ed = make(l);
    const t0 = textOf(ed);
    key(focusOn(ed, withText(ed, "2")), "Delete");
    const t1 = textOf(ed);
    expect(t1).not.toBe(t0);
    key(focusOn(ed, ed.roots()[ed.roots().length - 1]), "z", { ctrlKey: true });
    expect(textOf(ed)).toBe(t0);
    ok(ed);
    key(focusOn(ed, ed.roots()[0]), "z", { ctrlKey: true, shiftKey: true });
    expect(textOf(ed)).toBe(t1);
    ok(ed);
  });

  test("focus survives a delete: it lands on a block", () => {
    const ed = make(l);
    key(focusOn(ed, withText(ed, "2")), "Delete");
    expect(ed.focusedNode()).not.toBeNull();
  });
});
