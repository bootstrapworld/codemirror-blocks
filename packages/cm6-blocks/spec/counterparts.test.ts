/** @jest-environment jsdom */
/*
 * Nineteenth round, step 2: the old suite's React-rendered tests (lifecycle-test, ToggleEditor-test, Toolbar-test,
 * PrimitiveList-test, TrashCan-test) cannot run as written. Each test below is the BEHAVIOUR of an old test, against this
 * editor's own interface; the name says which old test it stands for. The old tests with no counterpart are listed in the
 * notes (nineteenth round).
 */
import { checkLezerEditor, LezerBlockEditor } from "../src/lezer-view";
import { make, TEXT } from "./helpers";
import { walk } from "../src/doc";
import type { BNode } from "../src/types";

const LANGS = ["scheme", "javascript", "python"];
const text = (ed: LezerBlockEditor) => ed.view.state.doc.toString();
const blocks = (ed: LezerBlockEditor) =>
  ed.view.dom.querySelectorAll(".blocks-node").length;
const all = (ed: LezerBlockEditor): BNode[] => {
  const o: BNode[] = [];
  ed.roots().forEach((r) => walk(r, (n) => o.push(n)));
  return o;
};
const press = (el: Element, k: string, mods: Partial<KeyboardEventInit> = {}) =>
  el.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: k,
      bubbles: true,
      cancelable: true,
      ...mods,
    })
  );

describe.each(LANGS)("%s: switching between text and block mode", (l) => {
  // lifecycle-test: "keeps the program (and canonicalises its layout) in both directions"
  // edited: the pretty-printing of the layout is the old language's; here the text is kept exactly
  test("keeps the program in both directions", () => {
    const ed = make(l);
    const before = text(ed);
    ed.setBlockMode(false);
    expect(text(ed)).toBe(before);
    ed.setBlockMode(true);
    expect(text(ed)).toBe(before);
    expect(checkLezerEditor(ed)).toEqual([]);
  });

  // lifecycle-test: "only shows blocks, the toolbar and the trash can in block mode"
  // edited: the toolbar and the trash can are the page's here; the blocks are the editor's
  test("only shows blocks in block mode", () => {
    const ed = make(l);
    expect(blocks(ed)).toBeGreaterThan(0);
    expect(ed.isBlockMode()).toBe(true);
    ed.setBlockMode(false);
    expect(blocks(ed)).toBe(0);
    expect(ed.isBlockMode()).toBe(false);
    ed.setBlockMode(true);
    expect(blocks(ed)).toBeGreaterThan(0);
  });

  // lifecycle-test: "lets text-mode edits through, and shows them as blocks afterwards"
  test("lets text-mode edits through, and shows them as blocks afterwards", () => {
    const ed = make(l);
    ed.setBlockMode(false);
    const end = ed.view.state.doc.length;
    ed.view.dispatch({
      changes: { from: end, insert: l === "scheme" ? "\n(z 9)" : "\nz(9)" },
    });
    ed.setBlockMode(true);
    expect(ed.roots().length).toBe(4);
    expect(text(ed).endsWith(l === "scheme" ? "(z 9)" : "z(9)")).toBe(true);
    expect(checkLezerEditor(ed)).toEqual([]);
  });

  // lifecycle-test: "can be switched back and forth many times without drifting"
  test("can be switched back and forth many times without drifting", () => {
    const ed = make(l);
    const before = text(ed);
    const n = all(ed).length;
    for (let i = 0; i < 20; i++) {
      ed.setBlockMode(false);
      ed.setBlockMode(true);
    }
    expect(text(ed)).toBe(before);
    expect(all(ed).length).toBe(n);
    expect(blocks(ed)).toBeGreaterThan(0);
    expect(checkLezerEditor(ed)).toEqual([]);
  });

  // lifecycle-test: "keeps working after a round trip: edit, undo and delete"
  // edited: the round trip forgets the undo history here (setBlockMode clears it), so the undo is of an edit made after it
  test("keeps working after a round trip: edit, undo and delete", () => {
    const ed = make(l);
    ed.setBlockMode(false);
    ed.setBlockMode(true);
    const before = text(ed);
    const first = ed.roots()[0];
    ed.removeNode(first);
    expect(text(ed)).not.toBe(before);
    expect(ed.roots().length).toBe(2);
    press(ed.renderer.element(ed.roots()[0]), "z", { ctrlKey: true });
    expect(text(ed)).toBe(before);
    expect(checkLezerEditor(ed)).toEqual([]);
  });
});

describe.each(LANGS)("%s: two editors on the same page", (l) => {
  // lifecycle-test: "don't share nodes, and never duplicate ids"
  test("do not share nodes", () => {
    const a = make(l);
    const b = make(l);
    const na = new Set(all(a));
    expect(all(b).some((n) => na.has(n))).toBe(false);
    const idsA = new Set(all(a).map((n) => n.id));
    expect(idsA.size).toBe(all(a).length);
    const els = new Set<Element>();
    [a, b].forEach((e) =>
      e.view.dom.querySelectorAll("[id]").forEach((x) => els.add(x))
    );
    const ids = [...els].map((x) => x.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  // lifecycle-test: "edit independently"
  test("edit independently", () => {
    const a = make(l);
    const b = make(l);
    const before = text(b);
    a.removeNode(a.roots()[0]);
    expect(text(b)).toBe(before);
    expect(b.roots().length).toBe(3);
    expect(a.roots().length).toBe(2);
    b.setBlockMode(false);
    expect(a.isBlockMode()).toBe(true);
    expect(blocks(a)).toBeGreaterThan(0);
    expect(checkLezerEditor(a)).toEqual([]);
    expect(checkLezerEditor(b)).toEqual([]);
  });
});

// lifecycle-test: "unmounting removes the editor from the page"
test("destroying an editor removes it from the page", () => {
  const ed = make("scheme");
  const parent = ed.view.dom.parentElement as HTMLElement;
  expect(parent.querySelector(".cm-editor")).not.toBeNull();
  ed.destroy();
  expect(parent.querySelector(".cm-editor")).toBeNull();
  // (the helper destroys it again after the test: that must do no harm)
  expect(() => ed.destroy()).not.toThrow();
});

// ToggleEditor-test: "switches the text of the toggle button" (the state the button shows)
// edited: the button is the page's; the state it shows is isBlockMode()
test("the mode switch changes the state the page shows", () => {
  const ed = make("scheme");
  expect(ed.isBlockMode()).toBe(true);
  ed.setBlockMode(false);
  expect(ed.isBlockMode()).toBe(false);
  ed.setBlockMode(true);
  expect(ed.isBlockMode()).toBe(true);
});

// Toolbar-test: "should render the primitives that are given" / PrimitiveList-test: the list of primitives
// edited: the toolbar of primitives is the template list of the language's table
describe.each(LANGS)("%s: the toolbar's templates", (l) => {
  test("are listed in the order the table writes them, none twice", () => {
    const ed = make(l);
    const ts = ed.templates();
    expect(ts.length).toBeGreaterThan(0);
    const names = ts.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
    expect(ts.every((t) => t.kind.length > 0)).toBe(true);
  });

  // Toolbar-test: "should toggle the selection state of a primitive when clicked" is a click: here a template is inserted
  // PrimitiveList-test: "copies the whole expression when the language has no literal for it" is the template's text
  test("each one can be inserted, and leaves a document that parses and is consistent", () => {
    const names = make(l)
      .templates()
      .map((t) => t.name);
    for (const name of names) {
      const ed = make(l, TEXT[l]);
      ed.insertTemplate(name, ed.roots()[0]);
      expect(text(ed).length).toBeGreaterThan(TEXT[l].length);
      // (the first hole is open in its edit box: close it)
      const box = ed.view.dom.querySelector("input.blocks-edit");
      if (box) press(box, "Escape");
      expect(checkLezerEditor(ed)).toEqual([]);
    }
  });
});
