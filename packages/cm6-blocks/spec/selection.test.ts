/** @jest-environment jsdom */
/* Fifth round, step 1a: Space selects blocks (the old editor's selection), and Delete, cut, copy and drag use the selection. */
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
const key = (el: Element, k: string, mods: Partial<KeyboardEventInit> = {}) => el.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true, ...mods }));
const space = (ed: LezerBlockEditor, n: BNode) => {
  ed.focusNode(n);
  key(ed.renderer.element(n), " ");
};
const sel = (ed: LezerBlockEditor, n: BNode) => ed.renderer.element(n).getAttribute("aria-selected");
/** the first call (a block with an `args` list) */
const firstCall = (ed: LezerBlockEditor): BNode => all(ed).find((n) => n.slots.some((q) => q.name === "args"))!;
const g = (ed: LezerBlockEditor): BNode => all(ed).filter((n) => n.slots.length > 0 && /^[(]?g[( ]2/.test(text(ed).slice(n.from, n.to)))[0];

function clipboardEvent(type: string, data: { v: string }): Event {
  const e = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(e, "clipboardData", { value: { setData: (_t: string, v: string) => (data.v = v), getData: () => data.v } });
  return e;
}

describe.each(LANGS)("selection: %s", (l) => {
  test("every block says aria-selected=false, the tree is multiselectable; Space toggles aria-selected and the class", () => {
    const ed = make(l);
    expect(ed.view.contentDOM.getAttribute("aria-multiselectable")).toBe("true");
    const els = Array.from(ed.view.dom.querySelectorAll(".blocks-node"));
    expect(els.length).toBeGreaterThan(8);
    expect(els.every((e) => e.getAttribute("aria-selected") === "false")).toBe(true);
    const two = lit(ed, "2");
    space(ed, two);
    expect(sel(ed, two)).toBe("true");
    expect(ed.renderer.element(two).classList.contains("blocks-selected")).toBe(true);
    expect(ed.selectedBlocks()).toEqual([two]);
    expect(ed.said[ed.said.length - 1]).toMatch(/^selected /);
    ok(ed);
    space(ed, two);
    expect(sel(ed, two)).toBe("false");
    expect(ed.renderer.element(two).classList.contains("blocks-selected")).toBe(false);
    expect(ed.said[ed.said.length - 1]).toMatch(/^unselected /);
    ok(ed);
  });

  test("selecting a block selects what is inside it; unselecting a block inside it unselects it and its ancestors, not its siblings", () => {
    const ed = make(l);
    const call = ed.roots()[0];
    const gg = g(ed);
    const two = lit(ed, "2");
    space(ed, gg);
    expect(sel(ed, gg)).toBe("true");
    expect(sel(ed, two)).toBe("true"); // the descendants are selected with it
    expect(sel(ed, call)).toBe("false");
    expect(ed.selectedBlocks()).toEqual([gg]); // the outermost one only
    space(ed, two); // `2` is selected: Space unselects it and its ancestors (the old editor's rule)
    expect(sel(ed, two)).toBe("false");
    expect(sel(ed, gg)).toBe("false");
    const head = gg.slots[0].nodes[0];
    expect(sel(ed, head)).toBe("true"); // `g` stays selected
    expect(ed.selectedBlocks()).toEqual([head]);
    ok(ed);
  });

  test("a refused select: a block under a selected block that is itself not selected", () => {
    const ed = make(l);
    const call = ed.roots()[0];
    space(ed, call);
    // make one child look unselected without touching the ancestor, as can happen after an edit (a new block inside a selected one)
    const one = lit(ed, "1");
    ed.renderer.setSelected(one, false);
    expect(ed.toggleSelect(one)).toBe("refused");
    expect(ed.said[ed.said.length - 1]).toBe("This node already has a selected ancestor");
    expect(sel(ed, one)).toBe("false");
  });

  test("selecting a block that holds selected ones takes them over; several blocks can be selected", () => {
    const ed = make(l);
    const gg = g(ed);
    const two = lit(ed, "2");
    const four = lit(ed, "4");
    space(ed, two);
    space(ed, four);
    expect(ed.selectedBlocks()).toEqual([two, four]);
    space(ed, gg);
    expect(ed.selectedBlocks()).toEqual([gg, four]); // `2` is inside the call `g(2)`
    expect(sel(ed, two)).toBe("true");
    ok(ed);
  });

  test("Escape, Ctrl-Escape and Alt-Q clear the selection", () => {
    const ed = make(l);
    for (const how of [{ k: "Escape" }, { k: "Escape", m: { ctrlKey: true } }, { k: "q", m: { altKey: true, code: "KeyQ" } }]) {
      space(ed, lit(ed, "1"));
      space(ed, lit(ed, "3"));
      expect(ed.selection().length).toBe(2);
      key(ed.renderer.element(lit(ed, "3")), how.k, how.m);
      expect(ed.selection()).toEqual([]);
      expect(ed.view.dom.querySelectorAll('[aria-selected="true"]').length).toBe(0);
    }
    ok(ed);
  });

  test("a click does not change the selection; focus can move on", () => {
    const ed = make(l);
    space(ed, lit(ed, "1"));
    ed.renderer.element(lit(ed, "3")).dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(ed.focusedNode()).toBe(lit(ed, "3"));
    expect(ed.selectedBlocks()).toEqual([lit(ed, "1")]);
  });

  test("Delete removes the selected blocks in one undo step; with none selected it removes the focused block", () => {
    const ed = make(l);
    space(ed, lit(ed, "1"));
    space(ed, lit(ed, "3"));
    const f = lit(ed, "2");
    ed.focusNode(f);
    key(ed.renderer.element(f), "Delete");
    expect(text(ed).split("\n")[0]).not.toMatch(/[13]/);
    expect(text(ed).split("\n")[0]).toMatch(/g\(?\s?2/);
    expect(ed.selection()).toEqual([]);
    expect(ed.said.some((s) => s.startsWith("deleted "))).toBe(true);
    ok(ed);
    // one undo brings both back
    const { undo } = jest.requireActual("@codemirror/commands");
    undo(ed.view);
    expect(text(ed)).toBe(TEXT[l]);
    ok(ed);
    // nothing selected: the focused block goes
    const four = lit(ed, "4");
    ed.focusNode(four);
    key(ed.renderer.element(four), "Delete");
    expect(text(ed)).not.toMatch(/4/);
    ok(ed);
  });

  test("Delete of neighbours and of everything in a list", () => {
    const ed = make(l);
    const call = firstCall(ed);
    const args = call.slots.find((s) => s.name === "args")!;
    for (const a of args.nodes) space(ed, a);
    expect(ed.selectedBlocks().length).toBe(3);
    key(ed.renderer.element(args.nodes[0]), "Backspace");
    expect(text(ed).split("\n")[0].replace(/\s/g, "")).toMatch(l === "scheme" ? /^\(f\)$/ : l === "javascript" ? /^f\(\);$/ : /^f\(\)$/);
    ok(ed);
  });

  test("copy and cut take the selection in document order; the clipboard holds the blocks, and paste puts each in as its own element", () => {
    const ed = make(l);
    const data = { v: "" };
    const three = lit(ed, "3");
    const one = lit(ed, "1");
    space(ed, three); // (selected in the reverse of document order)
    space(ed, one);
    const f = lit(ed, "2");
    ed.focusNode(f);
    ed.renderer.element(f).dispatchEvent(clipboardEvent("copy", data));
    expect(data.v).toBe("1\n3");
    expect(text(ed)).toBe(TEXT[l]);
    expect(ed.selectedBlocks().length).toBe(2); // copy leaves the selection
    // cut
    ed.renderer.element(f).dispatchEvent(clipboardEvent("cut", data));
    expect(data.v).toBe("1\n3");
    expect(text(ed).split("\n")[0]).not.toMatch(/[13]/);
    expect(ed.selection()).toEqual([]);
    ok(ed);
    // paste after the call h(4)'s 4: two separate arguments
    const four = lit(ed, "4");
    ed.focusNode(four);
    ed.renderer.element(four).dispatchEvent(clipboardEvent("paste", data));
    const line = text(ed).split("\n")[1];
    expect(line.replace(/[\s,;]+/g, " ")).toMatch(/4 1 3/);
    ok(ed);
    expect(ed.lastError).toBeNull();
  });

  test("a selection survives an edit elsewhere; a selected block that is removed leaves the selection", () => {
    const ed = make(l);
    const nine = lit(ed, "5");
    space(ed, nine);
    const one = lit(ed, "1");
    space(ed, one);
    expect(ed.selection().length).toBe(2);
    // an edit in another root (insert) and one typed in the same root, away from the selected block
    ed.replaceText(lit(ed, "4"), "44");
    expect(ed.selection()).toContain(nine);
    expect(ed.doc.byId.get(nine.id)).toBe(nine);
    expect(sel(ed, nine)).toBe("true");
    ok(ed);
    expect(ed.selection().includes(one)).toBe(true);
    // remove a selected block by hand: it leaves
    ed.removeNode(one);
    expect(ed.selection().includes(one)).toBe(false);
    expect(ed.selection().length).toBe(1);
    ok(ed);
    // its parent edited as text: everything inside is new, nothing stale stays
    ed.replaceText(ed.roots()[0], l === "scheme" ? "(q 1)" : l === "javascript" ? "q(1);" : "q(1)");
    ok(ed);
    for (const n of ed.selection()) expect(ed.doc.byId.get(n.id)).toBe(n);
  });

  test("new blocks inside a selected block are selected with it", () => {
    const ed = make(l);
    const call = firstCall(ed);
    space(ed, call);
    expect(sel(ed, call)).toBe("true");
    const args = call.slots.find((s) => s.name === "args")!;
    ed.insertText(args, 1, "77");
    const added = lit(ed, "77");
    expect(sel(ed, added)).toBe("true");
    ok(ed);
  });

  test("dragging a selected block moves all the selected blocks; dragging an unselected one moves only it", () => {
    const ed = make(l);
    const call = firstCall(ed);
    const args = call.slots.find((s) => s.name === "args")!;
    const [one, , three] = args.nodes;
    space(ed, one);
    space(ed, three);
    // drop onto the gap before the 4's call: the gap after `h`'s arguments, i.e. into h(4) at index 1
    const h = ed.roots()[1];
    const gap = ed.renderer.element(h).querySelector(`.blocks-args[data-slot="args"] > .blocks-gap[data-index="1"]`) as HTMLElement;
    const at = { x: 0 };
    document.elementFromPoint = () => (at.x === 100 ? gap : ed.renderer.element(three));
    const fire = (el: Element, type: string, x: number) => el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientX: x, clientY: 10 }));
    fire(ed.renderer.element(three), "pointerdown", 10);
    at.x = 100;
    fire(document.body, "pointermove", 100);
    expect(ed.renderer.element(one).classList.contains("blocks-drag-source")).toBe(true); // all of them
    expect(ed.renderer.element(three).classList.contains("blocks-drag-source")).toBe(true);
    fire(document.body, "pointerup", 100);
    expect(ed.lastError).toBeNull();
    const t = text(ed).split("\n");
    expect(t[0].replace(/[\s,;()]+/g, " ")).toMatch(/f g 2/);
    expect(t[0]).not.toMatch(/[13]/);
    expect(t[1].replace(/[\s,;()]+/g, " ")).toMatch(/h 4 1 3/);
    ok(ed);
    const { undo } = jest.requireActual("@codemirror/commands");
    undo(ed.view);
    expect(text(ed)).toBe(TEXT[l]);
    ok(ed);
  });

  test("moveNodes refuses a target inside one of the blocks", () => {
    const ed = make(l);
    const call = ed.roots()[0];
    const gg = g(ed);
    const two = lit(ed, "2");
    expect(() => ed.moveNodes([gg, lit(ed, "1")], { blank: two })).toThrow(/inside itself|one block/);
    expect(() => ed.moveNodes([gg], { slot: gg.slots.find((s) => s.name === "args")!, index: 0 })).toThrow(/inside itself/);
    expect(call).toBeDefined();
    expect(text(ed)).toBe(TEXT[l]);
  });
});

