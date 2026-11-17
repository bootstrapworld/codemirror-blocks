/** @jest-environment jsdom */
/* Fourth round, step 4: cut, copy, paste and drag of blocks, as text changes. */
import { checkLezerEditor, LezerBlockEditor } from "../src/lezer-view";
import { walk } from "../src/doc";
import { make, TEXT } from "./helpers";
import type { BNode } from "../src/types";

const LANGS = ["scheme", "javascript", "python"];
const text = (ed: LezerBlockEditor) => ed.view.state.doc.toString();
const ok = (ed: LezerBlockEditor) => expect(checkLezerEditor(ed)).toEqual([]);
const all = (ed: LezerBlockEditor): BNode[] => {
  const o: BNode[] = [];
  ed.roots().forEach((r) => walk(r, (n) => o.push(n)));
  return o;
};
const lit = (ed: LezerBlockEditor, src: string, nth = 0): BNode => all(ed).filter((n) => n.kind === "literal" && text(ed).slice(n.from, n.to) === src)[nth];
const argsOf = (ed: LezerBlockEditor, head: string) => {
  const call = all(ed).find((n) => n.slots.some((s) => s.name === "args") && text(ed).slice(n.from, n.to).startsWith(head.replace("(", "")))!;
  return call.slots.find((s) => s.name === "args")!;
};

function clipboardEvent(type: string, data: { v: string }): Event {
  const e = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(e, "clipboardData", { value: { setData: (_t: string, v: string) => (data.v = v), getData: () => data.v } });
  return e;
}

describe.each(LANGS)("moving blocks: %s", (l) => {
  test("copy puts the source text of the focused block on the clipboard, and changes nothing", () => {
    const ed = make(l);
    const n = lit(ed, "3");
    ed.focusNode(n);
    const data = { v: "" };
    const ev = clipboardEvent("copy", data);
    ed.renderer.element(n).dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
    expect(data.v).toBe("3");
    expect(text(ed)).toBe(TEXT[l]);
    ok(ed);
  });

  test("cut removes it (one undo step), paste puts it after another block", () => {
    const ed = make(l);
    const data = { v: "" };
    const three = lit(ed, "3");
    ed.focusNode(three);
    ed.renderer.setSelected(three, true); // (cut takes only what is selected)
    ed.renderer.element(three).dispatchEvent(clipboardEvent("cut", data));
    expect(data.v).toBe("3");
    expect(text(ed)).not.toMatch(/3/);
    ok(ed);
    const one = lit(ed, "1");
    ed.focusNode(one);
    ed.renderer.element(one).dispatchEvent(clipboardEvent("paste", data));
    expect(text(ed)).toMatch(/1[, ]+3/);
    ok(ed);
    // the pasted block has the focus
    expect(ed.focusedNode()).not.toBeNull();
    expect(text(ed).slice(ed.focusedNode()!.from, ed.focusedNode()!.to)).toBe("3");
  });

  test("paste on a blank replaces it", () => {
    const ed = make(l);
    ed.removeNode(lit(ed, "h")); // the head of a call is a "one" slot: a blank takes its place
    const blank = all(ed).find((n) => ed.isBlank(n))!;
    expect(blank).toBeDefined();
    ed.pasteText(blank, "zz");
    expect(text(ed)).toContain("zz(4)".replace("(4)", l === "scheme" ? " 4" : "(4)").replace(" 4", ""));
    expect(all(ed).filter((n) => ed.isBlank(n)).length).toBe(0);
    ok(ed);
  });

  test("moving an argument to the front of its list is one text change and one undo step", () => {
    const ed = make(l);
    const args = ed.roots()[0].slots.length ? all(ed).find((n) => n.slots.some((s) => s.name === "args"))!.slots.find((s) => s.name === "args")! : null!;
    const three = args.nodes[2];
    const before = text(ed);
    ed.moveNode(three, { slot: args, index: 0 });
    const after = text(ed);
    expect(after).not.toBe(before);
    expect(after.split("\n")[0]).toMatch(/3[, ]+1[, ]+(\(?g|g)/);
    ok(ed);
    // a move onto the place it is in does nothing
    const args2 = all(ed).find((n) => n.slots.some((s) => s.name === "args"))!.slots.find((s) => s.name === "args")!;
    const t = text(ed);
    ed.moveNode(args2.nodes[1], { slot: args2, index: 1 });
    ed.moveNode(args2.nodes[1], { slot: args2, index: 2 });
    expect(text(ed)).toBe(t);
  });

  test("a block cannot be moved into itself", () => {
    const ed = make(l);
    const call = all(ed).find((n) => n.kind === "call" && n.slots.some((s) => s.name === "args" && s.nodes.length))!;
    const inner = call.slots.find((s) => s.name === "args")!;
    expect(() => ed.moveNode(call, { slot: inner, index: 0 })).toThrow(/inside itself/);
    expect(text(ed)).toBe(TEXT[l]);
  });

  test("a stale node is refused", () => {
    const ed = make(l);
    const n = lit(ed, "4");
    const slot = n.slot!;
    ed.view.dispatch({ changes: { from: n.parent!.from, to: n.parent!.to, insert: "x" } });
    expect(() => ed.moveNode(n, { slot, index: 0 })).toThrow(/no longer in the tree/);
  });

  test("dragging a block with the pointer onto a gap moves it; a short move is a click", () => {
    const ed = make(l);
    const args = all(ed).find((n) => n.slots.some((s) => s.name === "args"))!.slots.find((s) => s.name === "args")!;
    const three = args.nodes[2];
    const gap = ed.renderer.element(args.owner).querySelector(`.blocks-args[data-slot="args"] > .blocks-gap[data-index="0"]`) as HTMLElement;
    expect(gap).not.toBeNull();
    const at = { x: 0, y: 0 };
    document.elementFromPoint = () => (at.x === 100 ? gap : ed.renderer.element(three));
    const fire = (el: Element, type: string, x: number, y: number) => el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientX: x, clientY: y }));
    const el = ed.renderer.element(three);
    // a click without movement
    fire(el, "pointerdown", 10, 10);
    fire(document.body, "pointerup", 10, 10);
    expect(text(ed)).toBe(TEXT[l]);
    // a drag
    fire(el, "pointerdown", 10, 10);
    at.x = 100;
    fire(document.body, "pointermove", 100, 10);
    expect(ed.view.dom.classList.contains("blocks-dragging")).toBe(true);
    expect(gap.classList.contains("blocks-drop-target")).toBe(true);
    fire(document.body, "pointerup", 100, 10);
    expect(ed.view.dom.classList.contains("blocks-dragging")).toBe(false);
    expect(text(ed).split("\n")[0]).toMatch(/3[, ]+1/);
    ok(ed);
    expect(ed.lastError).toBeNull();
  });
});

describe("moving statements (Python): indentation follows the target", () => {
  test("a top-level statement into a body, and back", () => {
    const ed = make("python", "def f():\n    a = 1\n    b = 2\nc = 3\n");
    const fn = ed.roots()[0];
    const body = fn.slots.find((s) => s.name === "body")!.nodes[0].slots[0];
    const c = ed.roots()[1];
    ed.moveNode(c, { slot: body, index: 1 });
    // (the statement's line stays, blank, where it was: the old editor leaves the line of a root that goes)
    expect(text(ed)).toBe("def f():\n    a = 1\n    c = 3\n    b = 2\n\n");
    ok(ed);
    const fn2 = ed.roots()[0];
    const body2 = fn2.slots.find((s) => s.name === "body")!.nodes[0].slots[0];
    ed.moveNode(body2.nodes[1], { slot: ed.roots()[0].slot!, index: 1 });
    expect(text(ed).trimEnd()).toBe("def f():\n    a = 1\n    b = 2\nc = 3");
    ok(ed);
  });
  test("a block statement with a body keeps its relative indentation", () => {
    const ed = make("python", "def f():\n    a = 1\nif x:\n    y = 1\n    z = 2\n");
    const body = ed.roots()[0].slots.find((s) => s.name === "body")!.nodes[0].slots[0];
    ed.moveNode(ed.roots()[1], { slot: body, index: 1 });
    expect(text(ed)).toBe("def f():\n    a = 1\n    if x:\n        y = 1\n        z = 2\n\n");
    ok(ed);
  });
});
