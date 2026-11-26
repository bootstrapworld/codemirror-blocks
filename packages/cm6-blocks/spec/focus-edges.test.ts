/** @jest-environment jsdom */
// Focus follows a replaced block (user decision 2026-11-23): the edges. See spec/focus-api.test.ts for the rule itself.
import { make } from "./helpers";
import type { LezerBlockEditor } from "../src/lezer-view";
import type { BNode } from "../src/types";
import { walk } from "../src/doc";

const SRC: Record<string, string> = {
  scheme: "(f 1 (g 2) 3)\n(h 4)\n(k 5)",
  javascript: "f(1, g(2), 3);\nh(4);\nk(5);",
  python: "f(1, g(2), 3)\nh(4)\nk(5)",
};
const TWO: Record<string, string> = {
  scheme: "(a 1)\n(b 2)",
  javascript: "a(1);\nb(2);",
  python: "a(1)\nb(2)",
};
const roots = (ed: LezerBlockEditor): BNode[] =>
  ed.roots().filter((r) => r.kind !== "error");
const all = (ed: LezerBlockEditor): BNode[] => {
  const o: BNode[] = [];
  ed.roots().forEach((r) => walk(r, (n) => o.push(n)));
  return o.filter((n) => n.kind !== "error");
};
const text = (ed: LezerBlockEditor) => ed.view.state.doc.toString();
const active = () => document.activeElement as HTMLElement;

describe.each(["scheme", "javascript", "python"])(
  "focus follows an API edit, edge cases: %s",
  (l) => {
    test("the focused root replaced by several blocks: the first of them has the focus", () => {
      const ed = make(l, SRC[l]);
      const r = roots(ed)[1];
      ed.focusNode(r);
      ed.view.dispatch({ changes: { from: r.from, to: r.to, insert: TWO[l] } });
      expect(roots(ed).length).toBe(4);
      expect(ed.focusedNode()).toBe(roots(ed)[1]);
      expect(active()).toBe(ed.renderer.element(roots(ed)[1]));
    });

    test("the focused root deleted by a dispatch: the block that took its place (the next) has the focus", () => {
      const ed = make(l, SRC[l]);
      const r = roots(ed)[1];
      ed.focusNode(r);
      ed.view.dispatch({ changes: { from: r.from, to: r.to, insert: "" } });
      expect(roots(ed).length).toBe(2);
      expect(ed.focusedNode()).toBe(roots(ed)[1]);
      expect(active()).toBe(ed.renderer.element(roots(ed)[1]));
    });

    test("the last root deleted: the previous block has the focus", () => {
      const ed = make(l, SRC[l]);
      const r = roots(ed)[2];
      ed.focusNode(r);
      ed.view.dispatch({ changes: { from: r.from - 1, to: r.to, insert: "" } });
      expect(roots(ed).length).toBe(2);
      expect(ed.focusedNode()).toBe(roots(ed)[1]);
    });

    test("an edit inside a collapsed root that has the focus: the collapsed root keeps it", () => {
      const ed = make(l, SRC[l]);
      ed.collapseRoot(roots(ed)[0], true);
      ed.focusNode(roots(ed)[0]);
      const at = text(ed).indexOf("2");
      ed.view.dispatch({ changes: { from: at, to: at + 1, insert: "77" } });
      expect(active()).not.toBe(document.body);
      expect(ed.focusedNode()).toBe(roots(ed)[0]);
      expect(ed.renderer.isCollapsed(roots(ed)[0])).toBe(true);
    });

    test("the focused block is inside a root that is replaced whole: the block at the same place has the focus", () => {
      const ed = make(l, SRC[l]);
      const leaf = all(ed).find(
        (n) => n.kind === "literal" && n.value === "2"
      )!;
      ed.focusNode(leaf);
      const r = roots(ed)[0];
      const s = text(ed).slice(r.from, r.to);
      ed.view.dispatch({
        changes: { from: r.from, to: r.to, insert: s.replace("2", "9") },
      });
      expect(ed.focusedNode()!.value).toBe("9");
      expect(active()).toBe(ed.renderer.element(ed.focusedNode()!));
    });
  }
);
