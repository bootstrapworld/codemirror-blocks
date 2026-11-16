/** @jest-environment jsdom */
import { walk } from "../src/doc";
import { checkLezerEditor, LezerBlockEditor } from "../src/lezer-view";
import { make } from "./helpers";
import type { BNode } from "../src/types";

const all = (ed: LezerBlockEditor): BNode[] => {
  const o: BNode[] = [];
  ed.roots().forEach((r) => walk(r, (n) => o.push(n)));
  return o;
};
const label = (ed: LezerBlockEditor, kind: string): string =>
  ed.renderer.element(all(ed).find((n) => n.kind === kind && (kind !== "call" || ed.view.state.doc.sliceString(n.from, n.to).includes("g(") || ed.view.state.doc.sliceString(n.from, n.to).startsWith("(g")))!).getAttribute("aria-label")!;

const CASES: Record<string, { text: string; calls: [string, string]; extra: [string, string][] }> = {
  scheme: { text: "(define (f x) (g 1 2 3))", calls: ["call to g with 3 arguments", "call to g with 2 arguments"], extra: [["define", "definition of (f x) as (g 1 2 3)"]] },
  javascript: { text: "function f(a, b) { return g(1, 2, 3); }", calls: ["call to g with 3 arguments", "call to g with 2 arguments"], extra: [["function", "function f with 2 parameters"], ["return", "return g(1, 2, 3)"]] },
  python: { text: "def f(a):\n    return g(1, 2, 3)\n", calls: ["call to g with 3 arguments", "call to g with 2 arguments"], extra: [["function", "function f with 1 parameter"], ["return", "return g(1, 2, 3)"]] },
};

describe.each(Object.keys(CASES))("describe: %s", (l) => {
  test("labels come from the table and follow edits", () => {
    const ed = make(l, CASES[l].text);
    expect(label(ed, "call")).toBe(CASES[l].calls[0]);
    for (const [kind, expected] of CASES[l].extra) expect(label(ed, kind)).toBe(expected);
    const one = all(ed).find((n) => n.kind === "literal" && ed.view.state.doc.sliceString(n.from, n.to) === "1")!;
    ed.removeNode(one);
    expect(checkLezerEditor(ed)).toEqual([]);
    expect(label(ed, "call")).toBe(CASES[l].calls[1]);
    // an ancestor's label (the return, which names its value) follows the change too
    if (l !== "scheme") expect(label(ed, "return")).toBe("return g(2, 3)");
  });
  test("a leaf is named by what it is, not by the first row of its kind", () => {
    const ed = make(l, CASES[l].text);
    const n = all(ed).find((x) => x.kind === "literal" && ed.view.state.doc.sliceString(x.from, x.to) === "f")!;
    expect(ed.renderer.element(n).getAttribute("aria-label")).not.toBe("number f");
  });
});
