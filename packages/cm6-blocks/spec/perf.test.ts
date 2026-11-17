/** @jest-environment jsdom */
/* Seventh round, step 4: an edit is paid for by the roots near it; the fast paths (skipRoots, fastErrors) give the same tree as the slow ones. */
import { checkLezerEditor, createLezerBlockEditor, LezerBlockEditor, LezerOptions } from "../src/lezer-view";
import { OPTS } from "./helpers";

const LANGS = ["scheme", "javascript", "python"];
const LINE: Record<string, (i: number) => string> = {
  scheme: (i) => `(define (f${i} x) (+ x ${i}))`,
  javascript: (i) => `function f${i}(x) { return x + ${i}; }`,
  python: (i) => `def f${i}(x):\n    return x + ${i}`,
};
const build = (l: string, flags: Partial<LezerOptions>): LezerBlockEditor => {
  const parent = document.createElement("div");
  document.body.appendChild(parent);
  const text = Array.from({ length: 600 }, (_, i) => LINE[l](i)).join("\n") + "\n";
  return createLezerBlockEditor(parent, text, { ...OPTS[l], ...flags });
};

describe.each(LANGS)("per-edit cost: %s", (l) => {
  test("one character in a name rebuilds the roots next to it only, and the checker agrees; the same with the fast paths off", () => {
    const texts: string[] = [];
    for (const flags of [{}, { skipRoots: false, fastErrors: false }]) {
      const ed = build(l, flags);
      const before = ed.stats();
      const at = ed.view.state.doc.toString().indexOf("f300") + 1;
      ed.view.dispatch({ changes: { from: at, to: at, insert: "x" }, userEvent: "input.block" });
      ed.view.dispatch({ changes: { from: at + 40, to: at + 40, insert: " " }, userEvent: "input.block" });
      const s = ed.stats();
      expect(s.rootsKept - before.rootsKept).toBeGreaterThan(1000);
      expect(s.rootsRebuilt - before.rootsRebuilt + (s.rootsReconciled - before.rootsReconciled)).toBeLessThan(12);
      expect(checkLezerEditor(ed)).toEqual([]);
      texts.push(ed.view.state.doc.toString());
      // an unclosed bracket makes errors: the slow path takes over, and the tree is still the fresh parse
      const p = ed.view.state.doc.toString().indexOf("f10") + 1;
      ed.view.dispatch({ changes: { from: p, to: p, insert: l === "scheme" ? "(" : l === "javascript" ? "{" : "(" }, userEvent: "input.block" });
      expect(checkLezerEditor(ed)).toEqual([]);
      ed.view.dispatch({ changes: { from: p, to: p + 1, insert: "" }, userEvent: "input.block" });
      expect(checkLezerEditor(ed)).toEqual([]);
      ed.destroy();
    }
    expect(texts[0]).toBe(texts[1]);
  });
});
