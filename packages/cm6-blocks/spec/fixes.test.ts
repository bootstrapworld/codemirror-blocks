/** @jest-environment jsdom */
import { walk } from "../src/doc";
import { createLezerBlockEditor, checkLezerEditor, LezerBlockEditor, LezerOptions } from "../src/lezer-view";
import { schemeParser, schemeTable } from "../src/lang-scheme";
import { javascriptParser, javascriptTable } from "../src/lang-javascript";
import { pythonParser, pythonTable } from "../src/lang-python";
import type { BNode } from "../src/types";

const zeroRect = { x: 0, y: 0, width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0, toJSON: () => ({}) };
if (!Range.prototype.getClientRects) Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
if (!Range.prototype.getBoundingClientRect) Range.prototype.getBoundingClientRect = () => zeroRect as DOMRect;

export const OPTS: Record<string, LezerOptions> = {
  scheme: { parser: schemeParser as never, table: schemeTable },
  javascript: { parser: javascriptParser as never, table: javascriptTable },
  python: { parser: pythonParser as never, table: pythonTable },
};
const TEXT: Record<string, string> = {
  scheme: "(f 1 (g 2) 3)\n(h 4)\n(k 5)",
  javascript: "f(1, g(2), 3);\nh(4);\nk(5);",
  python: "f(1, g(2), 3)\nh(4)\nk(5)",
};
const made: LezerBlockEditor[] = [];
export function make(l: string, text?: string): LezerBlockEditor {
  const parent = document.createElement("div");
  document.body.appendChild(parent);
  const ed = createLezerBlockEditor(parent, text ?? TEXT[l], OPTS[l]);
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
const ok = (ed: LezerBlockEditor) => expect(checkLezerEditor(ed)).toEqual([]);

describe.each(Object.keys(OPTS))("A1: stale nodes are refused: %s", (l) => {
  test("removeNode, replaceText, insertText throw and change nothing", () => {
    const ed = make(l);
    const stale = all(ed).find((n) => n.kind === "literal" && ed.view.state.doc.sliceString(n.from, n.to) === "4")!;
    const slot = stale.slot!;
    ed.view.dispatch({ changes: { from: 0, insert: "zz\n" } }); // rebuilds the neighbours
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
