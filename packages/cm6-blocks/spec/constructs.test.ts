/** @jest-environment jsdom */
/* Fourth round, step 3: constructs that needed more than a row. Each case: the words that must be drawn, and the oracle. */
import { parser as jp } from "@lezer/javascript";
import { parser as pp } from "@lezer/python";
import { javascriptTable } from "../src/lang-javascript";
import { pythonTable } from "../src/lang-python";
import { createLezerBlockEditor, checkLezerEditor, LezerBlockEditor } from "../src/lezer-view";

const zeroRect = { x: 0, y: 0, width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0, toJSON: () => ({}) };
if (!Range.prototype.getClientRects) Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
if (!Range.prototype.getBoundingClientRect) Range.prototype.getBoundingClientRect = () => zeroRect as DOMRect;

const OPTS = {
  javascript: { parser: jp as never, table: javascriptTable },
  python: { parser: pp as never, table: pythonTable },
};
const made: LezerBlockEditor[] = [];
function drawn(lang: keyof typeof OPTS, text: string): { ed: LezerBlockEditor; words: string } {
  const parent = document.createElement("div");
  document.body.appendChild(parent);
  const ed = createLezerBlockEditor(parent, text, OPTS[lang]);
  made.push(ed);
  expect(checkLezerEditor(ed)).toEqual([]);
  const words = ed.roots().filter((r) => r.kind !== "error").map((r) => ed.renderer.element(r).textContent ?? "").join(" | ").replace(/\s+/g, " ");
  return { ed, words };
}
afterEach(() => {
  while (made.length) made.pop()!.destroy();
});

const cases: [keyof typeof OPTS, string, string[]][] = [
  ["javascript", "async function f(a) { return a; }", ["async", "function"]],
  ["javascript", "class C { static m() {} get x() { return 1; } async n() {} }", ["static", "get", "async"]],
  ["javascript", "let f = async (x) => x;", ["async"]],
  ["javascript", "let h = function k(a) { return a; };", ["function", "k"]],
  ["javascript", "export default function g() {}", ["export default", "function"]],
  ["javascript", 'import a, { b as c, d } from "x";', ["import", "a", "{ b as c, d }", "from", '"x"']],
  ["javascript", 'import * as ns from "y";', ["import", "*", "as", "ns", "from", '"y"']],
  ["javascript", 'import "z";', ["import", '"z"']],
  ["javascript", 'export * from "m";', ["export", "*", "from", '"m"']],
  ["python", "async def f(a):\n    async for x in y:\n        pass\n", ["async", "def", "for"]],
];
test.each(cases)("%s %j draws its words", (lang, text, words) => {
  const d = drawn(lang, text);
  for (const w of words) expect(d.words).toContain(w);
});

describe("paired clauses and entries (Python)", () => {
  const kinds = (ed: LezerBlockEditor): string[] => {
    const out: string[] = [];
    const w = (n: import("../src/types").BNode): void => { out.push(n.kind + (n.keyword ? ":" + n.keyword : "")); n.slots.forEach((s) => s.nodes.forEach(w)); };
    ed.roots().forEach(w);
    return out;
  };
  test("elif and else are branches with a test and a body", () => {
    const { ed } = drawn("python", "if x:\n    a\nelif y:\n    b\nelse:\n    c\n");
    const k = kinds(ed);
    expect(k.filter((x) => x === "branch:elif").length).toBe(1);
    expect(k.filter((x) => x === "branch:else").length).toBe(1);
    expect(k.filter((x) => x === "keyword").length).toBe(0);
    const branches = ed.roots()[0].slots.find((s) => s.name === "rest")!.nodes;
    expect(branches.map((b) => b.slots.map((s) => s.nodes.length))).toEqual([[1, 1], [0, 1]]);
  });
  test("try, except with a name, finally", () => {
    const { ed } = drawn("python", "try:\n    a\nexcept E as e:\n    b\nfinally:\n    c\n");
    const branches = ed.roots()[0].slots.find((s) => s.name === "rest")!.nodes;
    expect(branches.map((b) => b.keyword)).toEqual(["except", "finally"]);
  });
  test("a dict is a list of entries, key and value", () => {
    const { ed } = drawn("python", 'd = {"a": 1, "b": f(2)}\n');
    expect(kinds(ed).filter((x) => x === "entry").length).toBe(2);
    expect(ed.renderer.element(ed.roots()[0]).textContent).toContain(":");
  });
  test("deleting and inserting a branch keeps the text a program", () => {
    const { ed } = drawn("python", "if x:\n    a\nelif y:\n    b\nelse:\n    c\n");
    const rest = ed.roots()[0].slots.find((s) => s.name === "rest")!;
    ed.removeNode(rest.nodes[0]);
    expect(ed.view.state.doc.toString()).toBe("if x:\n    a\nelse:\n    c\n");
    expect(checkLezerEditor(ed)).toEqual([]);
    ed.insertText(ed.roots()[0].slots.find((s) => s.name === "rest")!, 1, "elif z:\n    d");
    expect(checkLezerEditor(ed)).toEqual([]);
  });
});
