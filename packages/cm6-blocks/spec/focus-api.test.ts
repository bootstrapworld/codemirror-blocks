/** @jest-environment jsdom */
// Focus rule (user decision 2026-11-23): when a block has the focus and an API call changes its contents, the block that replaces it (at its place) gets the focus.
import { make } from "./helpers";
import type { LezerBlockEditor } from "../src/lezer-view";
import type { BNode } from "../src/types";
import { walk } from "../src/doc";

const SRC: Record<string, string> = {
  scheme: "(f 1 (g 2) 3)\n(h 4)\n(k 5)",
  javascript: "f(1, g(2), 3);\nh(4);\nk(5);",
  python: "f(1, g(2), 3)\nh(4)\nk(5)",
};
const all = (ed: LezerBlockEditor): BNode[] => {
  const o: BNode[] = [];
  ed.roots().forEach((r) => walk(r, (n) => o.push(n)));
  return o.filter((n) => n.kind !== "error");
};
const text = (ed: LezerBlockEditor) => ed.view.state.doc.toString();
const active = () => document.activeElement as HTMLElement;

describe.each(["scheme", "javascript", "python"])(
  "focus follows an API edit: %s",
  (l) => {
    test("a dispatch inside the focused block: its replacement has the focus", () => {
      const ed = make(l, SRC[l]);
      const leaf = all(ed).find(
        (n) => n.kind === "literal" && n.value === "2"
      )!;
      ed.focusNode(leaf);
      const at = text(ed).indexOf("2");
      ed.view.dispatch({ changes: { from: at, to: at + 1, insert: "77" } });
      const now = ed.focusedNode()!;
      expect(now).not.toBeNull();
      expect(now.value).toBe("77");
      expect(active()).toBe(ed.renderer.element(now));
    });

    test("replacing the text of the focused block through the API", () => {
      const ed = make(l, SRC[l]);
      const leaf = all(ed).find(
        (n) => n.kind === "literal" && n.value === "4"
      )!;
      ed.focusNode(leaf);
      ed.replaceText(leaf, "88");
      expect(ed.focusedNode()!.value).toBe("88");
      expect(active()).toBe(ed.renderer.element(ed.focusedNode()!));
    });

    test("removing the focused block: the focus goes to a block that is there, not the body", () => {
      const ed = make(l, SRC[l]);
      const leaf = all(ed).find(
        (n) => n.kind === "literal" && n.value === "2"
      )!;
      ed.focusNode(leaf);
      ed.removeNode(leaf);
      expect(active()).not.toBe(document.body);
      expect(ed.view.dom.contains(active())).toBe(true);
      expect(ed.focusedNode()).not.toBeNull();
    });

    test("a replaced document: the block at the same place has the focus", () => {
      const ed = make(l, SRC[l]);
      const roots = ed.roots().filter((r) => r.kind !== "error");
      ed.focusNode(roots[1]);
      const other = SRC[l].replace("h(4)", "h(40)").replace("(h 4)", "(h 40)");
      ed.view.dispatch({
        changes: { from: 0, to: text(ed).length, insert: other },
      });
      const now = ed.focusedNode()!;
      expect(now).not.toBeNull();
      expect(now).toBe(ed.roots().filter((r) => r.kind !== "error")[1]);
      expect(active()).toBe(ed.renderer.element(now));
    });

    test("a replaced document with fewer blocks: the nearest block has the focus", () => {
      const ed = make(l, SRC[l]);
      ed.focusNode(ed.roots().filter((r) => r.kind !== "error")[2]);
      const short =
        l === "scheme" ? "(a)" : l === "javascript" ? "a();" : "a()";
      ed.view.dispatch({
        changes: { from: 0, to: text(ed).length, insert: short },
      });
      expect(ed.view.dom.contains(active())).toBe(true);
      expect(active()).not.toBe(document.body);
      expect(ed.focusedNode()).toBe(
        ed.roots().filter((r) => r.kind !== "error")[0]
      );
    });

    test("an edit outside the focused block leaves the focus alone", () => {
      const ed = make(l, SRC[l]);
      const leaf = all(ed).find(
        (n) => n.kind === "literal" && n.value === "2"
      )!;
      ed.focusNode(leaf);
      const el = ed.renderer.element(leaf);
      const before = ed.stats().focusRestores;
      const at = text(ed).indexOf("5");
      ed.view.dispatch({ changes: { from: at, to: at + 1, insert: "6" } });
      expect(ed.focusedNode()).toBe(leaf);
      expect(active()).toBe(el);
      expect(ed.stats().focusRestores).toBe(before);
    });

    test("a pending box (top-level typing) that a replaced document removes: a block of the new text has the focus", async () => {
      const ed = make(l, SRC[l]);
      const len = text(ed).length;
      ed.view.dispatch({
        changes: { from: len, insert: "\n" },
        userEvent: "input.type",
      });
      ed.view.dispatch({
        changes: { from: len + 1, insert: "x" },
        userEvent: "input.type",
      });
      ed.flushTopLevel();
      const box = ed.view.dom.querySelector(
        ".blocks-pending .blocks-edit"
      ) as HTMLElement | null;
      expect(box).not.toBeNull();
      expect(active()).toBe(box);
      ed.view.dispatch({
        changes: { from: 0, to: text(ed).length, insert: SRC[l] },
      });
      expect(ed.view.dom.contains(active())).toBe(true);
      expect(active()).not.toBe(document.body);
    });

    test("an edit box that a replaced document removes: a block of the new text has the focus", () => {
      const ed = make(l, SRC[l]);
      const leaf = all(ed).find(
        (n) => n.kind === "literal" && n.value === "4"
      )!;
      ed.focusNode(leaf);
      ed.edit(leaf);
      expect(active().classList.contains("blocks-edit")).toBe(true);
      ed.view.dispatch({
        changes: { from: 0, to: text(ed).length, insert: SRC[l] },
      });
      expect(active()).not.toBe(document.body);
      expect(ed.view.dom.contains(active())).toBe(true);
    });
  }
);
