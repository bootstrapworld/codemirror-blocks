/** @jest-environment jsdom */
// Shift-Ctrl-] edits the comment of the focused block: its attached comment, or itself when it is a top-level comment block.
import { make } from "./helpers";
import type { LezerBlockEditor } from "../src/lezer-view";

const MARK: Record<string, string> = {
  scheme: ";",
  javascript: "//",
  python: "#",
};
const CALL: Record<string, string> = {
  scheme: "(f 1)",
  javascript: "f(1);",
  python: "f(1)",
};
const key = (el: Element, k: string, o: KeyboardEventInit = {}) =>
  el.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: k,
      bubbles: true,
      cancelable: true,
      ...o,
    })
  );
const shortcut = (
  ed: LezerBlockEditor,
  n: Parameters<LezerBlockEditor["focusNode"]>[0]
) => {
  ed.focusNode(n);
  key(ed.renderer.element(n), "}", {
    ctrlKey: true,
    shiftKey: true,
    code: "BracketRight",
  });
};
const boxOf = (ed: LezerBlockEditor) =>
  ed.view.dom.querySelector(
    "input.blocks-edit, textarea.blocks-edit"
  ) as HTMLInputElement | null;
const text = (ed: LezerBlockEditor) => ed.view.state.doc.toString();
const comments = (ed: LezerBlockEditor) =>
  ed.roots().filter((r) => r.kind === "comment");

describe.each(["scheme", "javascript", "python"])(
  "comment shortcut: %s",
  (l) => {
    const src = `${CALL[l]}\n\n${MARK[l]} apart\n\n${CALL[l]}\n`;
    test("on a top-level comment block it edits that comment; Escape leaves it; emptying removes it", () => {
      const ed = make(l, src);
      const c = comments(ed)[0];
      expect(c).toBeDefined();
      shortcut(ed, c);
      const b = boxOf(ed)!;
      expect(b.value).toBe("apart");
      key(b, "Escape");
      expect(text(ed)).toBe(src);
      shortcut(ed, comments(ed)[0]);
      const b2 = boxOf(ed)!;
      b2.value = "elsewhere";
      key(b2, "Enter");
      expect(text(ed)).toContain(`${MARK[l]} elsewhere`);
      expect(text(ed)).not.toContain("apart");
      expect(comments(ed).length).toBe(1);
      shortcut(ed, comments(ed)[0]);
      const b3 = boxOf(ed)!;
      b3.value = "";
      key(b3, "Enter");
      expect(text(ed)).not.toContain("elsewhere");
      expect(comments(ed).length).toBe(0);
    });
    test("on a block with an attached comment it edits that comment; on one with none it adds one", () => {
      const ed = make(l, `${MARK[l]} mine\n${CALL[l]}\n\n${CALL[l]}\n`);
      shortcut(ed, ed.roots()[0]);
      const b = boxOf(ed)!;
      expect(b.value).toBe("mine");
      b.value = "yours";
      key(b, "Enter");
      expect(text(ed)).toContain(`${MARK[l]} yours`);
      shortcut(ed, ed.roots()[ed.roots().length - 1]);
      const c = boxOf(ed)!;
      expect(c.value).toBe("");
      c.value = "new";
      key(c, "Enter");
      expect(text(ed)).toContain(`${MARK[l]} new\n${CALL[l]}`);
    });
  }
);
