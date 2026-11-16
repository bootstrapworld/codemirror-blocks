/** @jest-environment jsdom */
import { walk } from "../src/doc";
import { checkLezerEditor, LezerBlockEditor } from "../src/lezer-view";
import { make, OPTS } from "./helpers";
import type { BNode } from "../src/types";

const textOf = (ed: LezerBlockEditor) => ed.view.state.doc.toString();
const all = (ed: LezerBlockEditor): BNode[] => {
  const o: BNode[] = [];
  ed.roots().forEach((r) => walk(r, (n) => o.push(n)));
  return o;
};
const ok = (ed: LezerBlockEditor) => expect(checkLezerEditor(ed)).toEqual([]);

describe.each(Object.keys(OPTS))("A1: stale nodes are refused: %s", (l) => {
  test("removeNode, replaceText, insertText throw and change nothing", () => {
    const ed = make(l);
    const stale = all(ed).find((n) => n.kind === "literal" && ed.view.state.doc.sliceString(n.from, n.to) === "4")!;
    const slot = stale.slot!;
    ed.view.dispatch({ changes: { from: stale.parent!.from, to: stale.parent!.to, insert: "x" } }); // the owner becomes another thing: both nodes are gone
    const before = textOf(ed);
    expect(ed.doc.byId.get(stale.id)).not.toBe(stale);
    expect(() => ed.removeNode(stale)).toThrow(/no longer in the tree/);
    expect(() => ed.replaceText(stale, "x")).toThrow(/no longer in the tree/);
    expect(() => ed.insertText(slot, 0, "x")).toThrow(/no longer in the tree/);
    expect(textOf(ed)).toBe(before);
    ok(ed);
  });
});

describe("A2: a missing 'one' slot (zero-width blank) is filled where it belongs", () => {
  const cases: [string, string, string][] = [
    ["javascript", "function f() { return; }", "function f() { return 5; }"],
    ["javascript", "let x;", "let x = 5;"],
    ["python", "def f():\n    return\n", "def f():\n    return 5\n"],
    ["python", "return", "return 5"],
  ];
  test.each(cases)("%s %j", (l, text, expected) => {
    const ed = make(l, text);
    const blank = all(ed).find((n) => n.kind === "blank")!;
    expect(blank).toBeDefined();
    ed.replaceText(blank, "5");
    expect(textOf(ed)).toBe(expected);
    ok(ed);
  });
  test("a blank is where the missing node would go, not after the owner", () => {
    const ed = make("javascript", "return; f();");
    const blank = all(ed).find((n) => n.kind === "blank")!;
    expect(blank.from).toBeLessThan(6 + 1);
  });
});

describe.each(Object.keys(OPTS))("A3: focus after Delete: %s", (l) => {
  const key = (el: Element, k: string) => el.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));
  const focusedText = (ed: LezerBlockEditor) => {
    const n = ed.focusedNode();
    return n ? ed.view.state.doc.sliceString(n.from, n.to) : null;
  };
  const withText = (ed: LezerBlockEditor, t: string) =>
    all(ed).find((n) => ed.view.state.doc.sliceString(n.from, n.to) === t && n.kind !== "statement")!;
  test("next sibling, else previous sibling, else parent", () => {
    const ed = make(l);
    ed.focusNode(withText(ed, "1"));
    key(ed.renderer.element(ed.focusedNode()!), "Delete");
    expect(focusedText(ed)).toBe(l === "scheme" ? "(g 2)" : "g(2)");
    ed.focusNode(withText(ed, l === "scheme" ? "3" : "3"));
    key(ed.renderer.element(ed.focusedNode()!), "Delete");
    expect(focusedText(ed)).toBe(l === "scheme" ? "(g 2)" : "g(2)");
    ed.focusNode(withText(ed, "4"));
    key(ed.renderer.element(ed.focusedNode()!), "Delete");
    expect(focusedText(ed)).toBe(l === "scheme" ? "(h)" : l === "python" ? "h()" : "h()");
    ok(ed);
  });
});
