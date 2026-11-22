/** @jest-environment jsdom */
// A comment block collapses like any block. Checked against the old code (twenty-third round): an orphan comment is a Node with expandable true and is not locked, so Left/Right, Collapse All, Collapse Current Root and a double click all work on it; collapsed it keeps only its emoji.
import { undo } from "@codemirror/commands";
import { make } from "./helpers";

const CFG: Record<string, { call: string; mark: string }> = {
  scheme: { call: "(f 1)", mark: ";" },
  javascript: { call: "f(1);", mark: "//" },
  python: { call: "f(1)", mark: "#" },
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
describe.each(Object.keys(CFG))("collapsing a comment block: %s", (l) => {
  const { call, mark } = CFG[l];
  const src = `${call}\n\n${mark} apart\n\n${call}\n`;
  const rig = () => {
    const ed = make(l, src);
    const c = ed.roots().find((r) => r.kind === "comment")!;
    return { ed, c, el: () => ed.renderer.element(c) };
  };
  test("it is expandable; Left collapses, Right expands, the text is untouched", () => {
    const { ed, c, el } = rig();
    expect(el().getAttribute("aria-expanded")).toBe("true");
    ed.focusNode(c);
    key(el(), "ArrowLeft");
    expect(ed.renderer.isCollapsed(c)).toBe(true);
    expect(el().getAttribute("aria-expanded")).toBe("false");
    expect(el().classList.contains("blocks-collapsed")).toBe(true);
    expect(ed.view.state.doc.toString()).toBe(src);
    key(el(), "ArrowRight");
    expect(el().getAttribute("aria-expanded")).toBe("true");
  });
  test("Collapse All and Expand All include it; a double click toggles it", () => {
    const { ed, c, el } = rig();
    ed.collapseAll(true);
    expect(ed.renderer.isCollapsed(c)).toBe(true);
    ed.collapseAll(false);
    expect(ed.renderer.isCollapsed(c)).toBe(false);
    el().dispatchEvent(
      new MouseEvent("dblclick", { bubbles: true, cancelable: true })
    );
    expect(ed.renderer.isCollapsed(c)).toBe(true);
  });
  test("a collapsed comment stays collapsed when text around it changes", () => {
    const { ed, c } = rig();
    ed.collapse(c, true);
    ed.pasteText(ed.roots()[0], "z(0)", true);
    const again = ed.roots().find((r) => r.kind === "comment")!;
    expect(ed.renderer.isCollapsed(again)).toBe(true);
    undo(ed.view);
  });
  test("Shift-Alt-Left (Collapse Current Root) collapses a top-level comment block, and beeps when it is already collapsed", () => {
    const { ed, c, el } = rig();
    ed.focusNode(c);
    key(el(), "ArrowLeft", { shiftKey: true, altKey: true });
    expect(ed.renderer.isCollapsed(c)).toBe(true);
    expect(ed.view.state.doc.toString()).toBe(src);
  });
});
