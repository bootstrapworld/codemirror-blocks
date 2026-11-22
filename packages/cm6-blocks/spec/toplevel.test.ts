/** @jest-environment jsdom */
// Top-level typing (the old editor's quarantine): text typed or pasted where no block is goes into a pending box,
// never into the document, until it parses.
import { make } from "./helpers";
import type { LezerBlockEditor } from "../src/lezer-view";

const START: Record<string, string> = {
  scheme: "(f 1)\n(g 2)",
  javascript: "f(1);\ng(2);",
  python: "f(1)\ng(2)",
};
const NEW: Record<string, string> = {
  scheme: "(h 3)",
  javascript: "h(3);",
  python: "h(3)",
};
const BAD: Record<string, string> = {
  scheme: "(h 3",
  javascript: "h(3;",
  python: "h(3",
};
const docText = (ed: LezerBlockEditor) => ed.view.state.doc.toString();
const typeAt = async (
  ed: LezerBlockEditor,
  pos: number,
  text: string,
  ue = "input.type"
) => {
  ed.view.dispatch({ changes: { from: pos, insert: text }, userEvent: ue });
  await Promise.resolve();
};
const boxOf = (ed: LezerBlockEditor) =>
  ed.view.dom.querySelector(".blocks-pending .blocks-edit") as
    HTMLInputElement | HTMLTextAreaElement | null;
const key = (el: Element, k: string) =>
  el.dispatchEvent(
    new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true })
  );

describe.each(["scheme", "javascript", "python"])(
  "top-level typing: %s",
  (l) => {
    test("a typed character goes into a pending box, not the document; Enter commits it as one undo step", async () => {
      const ed = make(l, START[l]);
      const before = docText(ed);
      await typeAt(ed, before.length, NEW[l][0]);
      expect(docText(ed)).toBe(before);
      const b = boxOf(ed)!;
      expect(b.value).toBe(NEW[l][0]);
      b.value = NEW[l];
      key(b, "Enter");
      expect(boxOf(ed)).toBeNull();
      expect(docText(ed)).toContain(NEW[l]);
      expect(ed.roots().length).toBe(3);
      expect(ed.focusedNode()).toBe(ed.roots()[2]);
      const { undo } = jest.requireActual("@codemirror/commands");
      undo(ed.view);
      expect(docText(ed)).toBe(before);
    });
    test("text that does not parse stays in the box, red; nothing reaches the document", async () => {
      const ed = make(l, START[l]);
      const before = docText(ed);
      await typeAt(ed, 0, BAD[l]);
      const b = boxOf(ed)!;
      key(b, "Enter");
      expect(boxOf(ed)).toBe(b);
      expect(b.classList.contains("blocks-error")).toBe(true);
      expect(b.title).not.toBe("");
      expect(docText(ed)).toBe(before);
      b.value = NEW[l];
      b.dispatchEvent(new Event("input"));
      key(b, "Enter");
      expect(docText(ed)).toBe(NEW[l] + "\n" + before);
      expect(ed.roots()[0].from).toBe(0);
    });
    test("Escape discards; whitespace and typing inside a block's range are left alone", async () => {
      const ed = make(l, START[l]);
      const before = docText(ed);
      await typeAt(ed, before.length, "9");
      key(boxOf(ed)!, "Escape");
      expect(boxOf(ed)).toBeNull();
      expect(docText(ed)).toBe(before);
      await typeAt(ed, before.length, "\n");
      expect(docText(ed)).toBe(before + "\n");
      expect(boxOf(ed)).toBeNull();
    });
    // edited: a paste that parses is committed at once (spec/paste-box.test.ts); only one that does not is held in the box
    test("a paste that does not parse is held in the box; Enter commits it once it parses", async () => {
      const ed = make(l, START[l]);
      await typeAt(ed, 0, BAD[l] + "\n" + NEW[l], "input.paste");
      const b = boxOf(ed)!;
      expect(b.value).toBe(BAD[l] + "\n" + NEW[l]);
      expect(b.classList.contains("blocks-error")).toBe(true);
      b.value = NEW[l] + "\n" + NEW[l];
      key(b, "Enter");
      expect(ed.roots().length).toBe(4);
    });
    test("an empty document", async () => {
      const ed = make(l, "");
      await typeAt(ed, 0, "9");
      key(boxOf(ed)!, "Enter");
      expect(docText(ed).trim()).toBe("9");
    });
  }
);
