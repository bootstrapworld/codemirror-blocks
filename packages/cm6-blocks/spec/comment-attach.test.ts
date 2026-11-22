/** @jest-environment jsdom */
// The optional `attach` rule of a language table: a test table that attaches a comment to the block BEFORE it (the generic rule: the one after).
import { redo, undo } from "@codemirror/commands";
import { schemeParser, schemeTable } from "../src/lang-scheme";
import type { BlockTable } from "../src/lezer";
import type { LezerBlockEditor } from "../src/lezer-view";
import { make } from "./helpers";

const before: BlockTable = {
  ...schemeTable,
  attach: ({ before }) => before,
};
const mk = (src: string, table: BlockTable = before) =>
  make("scheme", src, { parser: schemeParser as never, table });
const text = (ed: LezerBlockEditor) => ed.view.state.doc.toString();
const calls = (ed: LezerBlockEditor) =>
  ed.roots().filter((r) => r.kind !== "comment");
const key = (el: Element, k: string, o: KeyboardEventInit = {}) =>
  el.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: k,
      bubbles: true,
      cancelable: true,
      ...o,
    })
  );
const clip = (el: Element, type: "copy" | "cut") => {
  const e = new Event(type, { bubbles: true, cancelable: true }) as Event & {
    clipboardData: unknown;
  };
  let out = "";
  e.clipboardData = {
    getData: () => "",
    setData: (_: string, v: string) => (out = v),
  };
  el.dispatchEvent(e);
  return out;
};
const SRC = "(a 1)\n; about a\n(b 2)\n(c 3)\n";

describe("table.attach", () => {
  test("default: the comment goes with the block below; the rule moves it to the block above", () => {
    const g = mk(SRC, schemeTable);
    expect(g.commentOf(calls(g)[1])?.value).toBe("; about a");
    const ed = mk(SRC);
    expect(ed.commentOf(calls(ed)[0])?.value).toBe("; about a");
    expect(ed.commentOf(calls(ed)[1])).toBeNull();
  });
  test("'default' and a missing rule give the generic result", () => {
    const ed = mk(SRC, { ...schemeTable, attach: () => "default" });
    expect(ed.commentOf(calls(ed)[1])?.value).toBe("; about a");
  });
  test("null attaches to none", () => {
    const ed = mk(SRC, { ...schemeTable, attach: () => null });
    expect(calls(ed).every((n) => !ed.commentOf(n))).toBe(true);
  });
  test("drawn: marker, title and label", () => {
    const ed = mk(SRC);
    const [a, b] = calls(ed).map((n) => ed.renderer.element(n));
    expect(a.getAttribute("data-comment")).toBe("about a");
    expect(a.getAttribute("aria-label")).toContain("with comment: about a");
    expect(a.classList.contains("blocks-has-comment")).toBe(true);
    expect(b.classList.contains("blocks-has-comment")).toBe(false);
    expect(b.getAttribute("aria-label")).not.toContain("with comment");
  });
  test("Shift-Ctrl-] on the block edits the comment under it", () => {
    const ed = mk(SRC);
    const a = calls(ed)[0];
    ed.focusNode(a);
    key(ed.renderer.element(a), "}", {
      ctrlKey: true,
      shiftKey: true,
      code: "BracketRight",
    });
    const box = ed.view.dom.querySelector(
      "input.blocks-edit, textarea.blocks-edit"
    ) as HTMLInputElement;
    expect(box.value).toContain("about a");
  });
  test("moving the owner takes the comment (one undo restores)", () => {
    const ed = mk(SRC);
    ed.moveNode(calls(ed)[0], { slot: ed.doc.program.slots[0], index: 4 });
    expect(text(ed)).toBe("\n(b 2)\n(c 3)\n(a 1)\n; about a\n");
    undo(ed.view);
    expect(text(ed)).toBe(SRC);
    redo(ed.view);
    expect(text(ed)).toBe("\n(b 2)\n(c 3)\n(a 1)\n; about a\n");
  });
  test("delete leaves the comment as the generic rule does; cut takes it; copy has it", () => {
    const ed = mk(SRC);
    const a = calls(ed)[0];
    expect(ed.copyText(a, true)).toContain("; about a");
    ed.removeNodes([a]);
    expect(text(ed)).toContain("; about a");
    undo(ed.view);
    const ed2 = mk(SRC);
    ed2.focusNode(calls(ed2)[0]);
    ed2.renderer.setSelected(calls(ed2)[0], true);
    const out = clip(ed2.renderer.element(calls(ed2)[0]), "cut");
    expect(out).toContain("; about a");
    expect(text(ed2)).not.toContain("about a");
    undo(ed2.view);
    expect(text(ed2)).toBe(SRC);
  });
  test("paste before the owner goes above it, after the owner goes below its comment", () => {
    const ed = mk(SRC);
    ed.pasteText(calls(ed)[0], "(z 9)", true);
    expect(text(ed)).toBe("(z 9)\n(a 1)\n; about a\n(b 2)\n(c 3)\n");
    const e2 = mk(SRC);
    e2.pasteText(calls(e2)[0], "(z 9)", false);
    expect(text(e2)).toBe("(a 1)\n; about a\n(z 9)\n(b 2)\n(c 3)\n");
  });
});
