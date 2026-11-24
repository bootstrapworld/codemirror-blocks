/** @jest-environment jsdom */
// Top-level typing writes the text AT the cursor when its line holds no block text (a blank line, an end of the document), as one
// change with no added line break; next to a block on its line it stays a new root with a separator as needed.
import { make } from "./helpers";
import type { LezerBlockEditor } from "../src/lezer-view";

const A: Record<string, string> = {
  scheme: "(a)",
  javascript: "a();",
  python: "a()",
};
const B: Record<string, string> = {
  scheme: "(b)",
  javascript: "b();",
  python: "b()",
};
const C: Record<string, string> = {
  scheme: "(c)",
  javascript: "c();",
  python: "c()",
};
const docText = (ed: LezerBlockEditor) => ed.view.state.doc.toString();
const boxOf = (ed: LezerBlockEditor) =>
  ed.view.dom.querySelector(".blocks-pending .blocks-edit") as
    HTMLInputElement | HTMLTextAreaElement | null;
const key = (el: Element, k: string) =>
  el.dispatchEvent(
    new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true })
  );
const undo = (ed: LezerBlockEditor) =>
  jest.requireActual("@codemirror/commands").undo(ed.view);
/** type `text` at `pos` (as a box would hold it), commit with Enter */
const typeCommit = async (ed: LezerBlockEditor, pos: number, text: string) => {
  ed.view.dispatch({
    changes: { from: pos, insert: text[0] },
    userEvent: "input.type",
  });
  await Promise.resolve();
  const b = boxOf(ed)!;
  b.value = text;
  key(b, "Enter");
};

describe.each(["scheme", "javascript", "python"])(
  "typing at the cursor: %s",
  (l) => {
    const a = A[l],
      b = B[l],
      c = C[l];
    test("on a blank line between two blocks: written there, one undo step, focus on it", async () => {
      const src = `${a}\n\n\n\n${b}\n`;
      const ed = make(l, src);
      await typeCommit(ed, a.length + 2, c);
      expect(docText(ed)).toBe(`${a}\n\n${c}\n\n${b}\n`);
      expect(ed.roots().length).toBe(3);
      expect(ed.focusedNode()).toBe(ed.roots()[1]);
      undo(ed);
      expect(docText(ed)).toBe(src);
    });
    test("on the last blank line: not moved next to the block before", async () => {
      const ed = make(l, `${a}\n\n\n`);
      await typeCommit(ed, a.length + 1, c);
      expect(docText(ed)).toBe(`${a}\n${c}\n\n`);
      expect(ed.roots().length).toBe(2);
    });
    test("at the start of a document that begins with blank lines", async () => {
      const ed = make(l, `\n\n${a}\n`);
      await typeCommit(ed, 0, c);
      expect(docText(ed)).toBe(`${c}\n\n${a}\n`);
    });
    test("two blocks typed at once go there, as typed", async () => {
      const ed = make(l, `${a}\n\n${b}\n`);
      const two = l === "python" ? `${c}; ${c}` : `${c} ${c}`;
      await typeCommit(ed, a.length + 1, two);
      expect(docText(ed)).toBe(`${a}\n${two}\n${b}\n`);
      expect(ed.roots().length).toBe(4);
      expect(ed.focusedNode()).toBe(ed.roots()[2]); // (the last of the two)
    });
    test("text that does not parse is refused at the cursor, the box stays", async () => {
      const src = `${a}\n\n${b}\n`;
      const ed = make(l, src);
      const bad = l === "scheme" ? "(c" : l === "javascript" ? "c(;" : "c(";
      await typeCommit(ed, a.length + 1, bad);
      expect(docText(ed)).toBe(src);
      expect(boxOf(ed)).not.toBeNull();
    });
    test("at the end of a block's line: a separator is still added", async () => {
      const ed = make(l, `${a}\n${b}`);
      await typeCommit(ed, a.length, c);
      const t = docText(ed);
      expect(ed.roots().length).toBe(3);
      expect(t.indexOf(c)).toBeGreaterThan(t.indexOf(a));
      expect(t.indexOf(c)).toBeLessThan(t.indexOf(b));
    });
    test("at the end of the document, after the last line", async () => {
      const ed = make(l, `${a}\n`);
      await typeCommit(ed, a.length + 1, c);
      expect(docText(ed)).toBe(`${a}\n${c}`);
    });
  }
);
