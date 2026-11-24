/** @jest-environment jsdom */
// A paste that parses is committed and drawn; one that does not opens a red box holding it, with the message visible.
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
const boxOf = (ed: LezerBlockEditor) =>
  ed.view.dom.querySelector("input.blocks-edit, textarea.blocks-edit") as
    HTMLInputElement | HTMLTextAreaElement | null;
const key = (el: Element, k: string) =>
  el.dispatchEvent(
    new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true })
  );
const undo = (ed: LezerBlockEditor) =>
  jest.requireActual("@codemirror/commands").undo(ed.view);
const pasteOn = (el: Element, text: string) => {
  const ev = new Event("paste", {
    bubbles: true,
    cancelable: true,
  }) as Event & {
    clipboardData: unknown;
  };
  ev.clipboardData = { getData: () => text, setData: () => undefined };
  el.dispatchEvent(ev);
};
const topPaste = async (ed: LezerBlockEditor, pos: number, text: string) => {
  ed.view.dispatch({
    changes: { from: pos, insert: text },
    userEvent: "input.paste",
  });
  await Promise.resolve();
};
const red = (ed: LezerBlockEditor, b: HTMLElement) => {
  expect(b.classList.contains("blocks-error")).toBe(true);
  expect(b.title).not.toBe("");
  expect(b.getAttribute("aria-invalid")).toBe("true");
  const m = ed.view.dom.querySelector(".blocks-error-message") as HTMLElement;
  expect(m.textContent).toBe(b.title);
  expect(m.getAttribute("aria-hidden")).toBe("true");
};

describe.each(["scheme", "javascript", "python"])("paste: %s", (l) => {
  test("top level: a paste that parses is committed, drawn, one undo step, focus on the last block pasted", async () => {
    const ed = make(l, START[l]);
    const before = docText(ed);
    await topPaste(ed, before.length, "\n" + NEW[l] + "\n" + NEW[l]);
    expect(boxOf(ed)).toBeNull();
    expect(ed.roots().length).toBe(4);
    expect(ed.view.dom.querySelectorAll(".blocks-node").length).toBeGreaterThan(
      0
    );
    expect(ed.focusedNode()).toBe(ed.roots()[3]);
    undo(ed);
    expect(docText(ed)).toBe(before);
  });
  test("top level: a paste that does not parse shows the red box; Enter commits the fixed text, Escape discards", async () => {
    const ed = make(l, START[l]);
    const before = docText(ed);
    await topPaste(ed, before.length, BAD[l]);
    const b = boxOf(ed)!;
    expect(b.value).toBe(BAD[l]);
    red(ed, b);
    expect(docText(ed)).toBe(before);
    b.value = NEW[l];
    b.dispatchEvent(new Event("input"));
    expect(ed.view.dom.querySelector(".blocks-error-message")).toBeNull();
    key(b, "Enter");
    expect(ed.roots().length).toBe(3);
    const ed2 = make(l, START[l]);
    await topPaste(ed2, before.length, BAD[l]);
    key(boxOf(ed2)!, "Escape");
    expect(boxOf(ed2)).toBeNull();
    expect(docText(ed2)).toBe(before);
  });
  test("after a block: parseable commits; not parseable opens a red insertion box (Enter fixes, Escape cancels)", () => {
    const ed = make(l, START[l]);
    const before = docText(ed);
    const first = ed.roots()[0];
    ed.focusNode(first);
    pasteOn(ed.renderer.element(first), NEW[l]);
    expect(ed.roots().length).toBe(3);
    undo(ed);
    expect(docText(ed)).toBe(before);
    ed.focusNode(ed.roots()[0]);
    pasteOn(ed.renderer.element(ed.roots()[0]), BAD[l]);
    const b = boxOf(ed)!;
    expect(b.value).toBe(BAD[l]);
    red(ed, b);
    expect(docText(ed)).toBe(before);
    expect(ed.said.some((s) => /Cannot paste/.test(s))).toBe(false);
    b.value = NEW[l];
    b.dispatchEvent(new Event("input"));
    key(b, "Enter");
    expect(ed.roots().length).toBe(3);
    undo(ed);
    ed.focusNode(ed.roots()[0]);
    pasteOn(ed.renderer.element(ed.roots()[0]), BAD[l]);
    key(boxOf(ed)!, "Escape");
    expect(boxOf(ed)).toBeNull();
    expect(docText(ed)).toBe(before);
  });
  test("over a selected block: not parseable opens a red box; Escape leaves the block untouched, Enter replaces it", () => {
    const ed = make(l, START[l]);
    const before = docText(ed);
    const first = ed.roots()[0];
    ed.focusNode(first);
    ed.toggleSelect(first);
    pasteOn(ed.renderer.element(first), BAD[l]);
    const b = boxOf(ed)!;
    expect(b.value).toBe(BAD[l]);
    red(ed, b);
    key(b, "Escape");
    expect(boxOf(ed)).toBeNull();
    expect(docText(ed)).toBe(before);
    ed.focusNode(ed.roots()[0]);
    ed.toggleSelect(ed.roots()[0]);
    pasteOn(ed.renderer.element(ed.roots()[0]), BAD[l]);
    const c = boxOf(ed)!;
    c.value = NEW[l];
    c.dispatchEvent(new Event("input"));
    key(c, "Enter");
    expect(docText(ed)).toContain(NEW[l]);
    expect(docText(ed)).not.toContain(START[l].split("\n")[0]);
    expect(ed.roots().length).toBe(2);
  });
});
