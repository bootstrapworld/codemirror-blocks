/** @jest-environment jsdom */
// Eleventh round: differences 4 (undo and redo focus), 7 (removing several arguments), 9 (dialogs hide the page)
import { redo, undo } from "@codemirror/commands";
import { checkLezerEditor, LezerBlockEditor } from "../src/lezer-view";
import { make } from "./helpers";

const textOf = (ed: LezerBlockEditor) => ed.view.state.doc.toString();
const ok = (ed: LezerBlockEditor) => expect(checkLezerEditor(ed)).toEqual([]);
const label = (ed: LezerBlockEditor) => {
  const n = ed.focusedNode();
  return n ? textOf(ed).slice(n.from, n.to) : null;
};
const kids = (n: { slots: { nodes: unknown[] }[] }) => n.slots.flatMap((s) => s.nodes) as ReturnType<LezerBlockEditor["roots"]>;
/** what a key or a click does before anything else: the history learns where focus ended up */
const nextEvent = (ed: LezerBlockEditor) => ed.view.dom.dispatchEvent(new KeyboardEvent("keydown", { key: "Shift", bubbles: true }));

describe("4. undo and redo put focus where the old history does", () => {
  test("undo of a delete: the block that had focus before the edit; redo: where the edit left it", () => {
    const ed = make("scheme", "(f x y)\n(g z)");
    const [call] = ed.roots();
    const [, x, y] = kids(call);
    ed.focusNode(y); // focus is on y, x is deleted
    ed.removeNode(x);
    expect(textOf(ed)).toBe("(f y)\n(g z)");
    const after = label(ed);
    nextEvent(ed);
    undo(ed.view);
    expect(textOf(ed)).toBe("(f x y)\n(g z)");
    expect(label(ed)).toBe("y");
    redo(ed.view);
    expect(textOf(ed)).toBe("(f y)\n(g z)");
    expect(label(ed)).toBe(after);
    undo(ed.view);
    expect(label(ed)).toBe("y");
    ok(ed);
  });
  test("undo goes to the block that had focus when the edit began, even if focus is somewhere else now", () => {
    const ed = make("scheme", "a b c d");
    const [a, , , d] = ed.roots();
    ed.focusNode(d);
    ed.removeNode(a);
    nextEvent(ed);
    ed.focusNode(ed.roots()[0]);
    undo(ed.view);
    expect(textOf(ed)).toBe("a b c d");
    expect(label(ed)).toBe("d");
  });
  test("redo goes to where the edit left focus, not where the user went after it", () => {
    const ed = make("scheme", "a b c d");
    const [a, , , d] = ed.roots();
    ed.focusNode(d);
    ed.removeNode(a);
    const left = label(ed);
    nextEvent(ed); // the user's next key settles it
    ed.focusNode(ed.roots()[2]);
    undo(ed.view);
    redo(ed.view);
    expect(label(ed)).toBe(left);
  });
  test("two edits: each undo goes to its own place", () => {
    const ed = make("scheme", "(f x y z)");
    const [call] = ed.roots();
    const [, x, y, z] = kids(call);
    ed.focusNode(z);
    ed.removeNode(x);
    nextEvent(ed);
    ed.focusNode(kids(ed.roots()[0])[1]); // y
    ed.removeNode(kids(ed.roots()[0])[2]); // z
    expect(textOf(ed)).toBe("(f y)");
    nextEvent(ed);
    undo(ed.view);
    expect(label(ed)).toBe("y");
    undo(ed.view);
    expect(textOf(ed)).toBe("(f x y z)");
    expect(label(ed)).toBe("z");
    redo(ed.view);
    redo(ed.view);
    expect(textOf(ed)).toBe("(f y)");
    void y;
  });
  test("a new edit clears what redo remembered", () => {
    const ed = make("scheme", "a b c");
    const [a, b, c] = ed.roots();
    ed.focusNode(c);
    ed.removeNode(a);
    nextEvent(ed);
    undo(ed.view);
    ed.focusNode(ed.roots()[1]);
    ed.removeNode(b);
    expect(textOf(ed)).toBe("a c");
    nextEvent(ed);
    undo(ed.view);
    expect(label(ed)).toBe("b");
    redo(ed.view);
    expect(textOf(ed)).toBe("a c");
  });
  test.each([
    ["paste", (ed: LezerBlockEditor) => ed.pasteText(kids(ed.roots()[0])[1], "zzz")],
    ["cut of several", (ed: LezerBlockEditor) => ed.removeNodes(kids(ed.roots()[0]).slice(1, 3))],
    ["replace text", (ed: LezerBlockEditor) => ed.replaceText(kids(ed.roots()[0])[2], "q")],
    ["insert text", (ed: LezerBlockEditor) => ed.insertText(ed.roots()[0].slots[0], 1, "w")],
    ["move", (ed: LezerBlockEditor) => ed.moveNode(kids(ed.roots()[0])[3], { slot: ed.roots()[0].slots[0], index: 1 })],
    ["template", (ed: LezerBlockEditor) => ed.insertTemplate("number", kids(ed.roots()[0])[1])],
    ["a change of the text", (ed: LezerBlockEditor) => ed.change({ from: 0, to: 0, insert: "k " })],
  ])("%s: undo goes back to the focused block, redo comes back", (_name, edit) => {
    const ed = make("scheme", "(f x y z)\n(g 1)");
    const target = kids(ed.roots()[0])[3]; // z
    ed.focusNode(target);
    const before = textOf(ed);
    edit(ed);
    const edited = textOf(ed);
    expect(edited).not.toBe(before);
    const left = label(ed);
    nextEvent(ed);
    ed.focusNode(ed.roots()[ed.roots().length - 1]);
    undo(ed.view);
    expect(textOf(ed)).toBe(before);
    expect(label(ed)).toBe("z");
    redo(ed.view);
    expect(textOf(ed)).toBe(edited);
    expect(label(ed)).toBe(left);
    ok(ed);
  });
  test("an edit made with no block focused: undo leaves focus alone (the text keeps it)", () => {
    const ed = make("scheme", "(f x)");
    ed.view.dispatch({ changes: { from: 0, insert: "a " }, userEvent: "input.type" });
    undo(ed.view);
    expect(textOf(ed)).toBe("(f x)");
    expect(ed.focusedNode()).toBeNull();
  });
  test.each([
    ["Ctrl-Z / Ctrl-Y", { key: "z", ctrlKey: true }, { key: "y", ctrlKey: true }],
    ["Ctrl-Z / Shift-Ctrl-Z", { key: "z", ctrlKey: true }, { key: "Z", ctrlKey: true, shiftKey: true }],
    ["Ctrl-Z / Shift-Ctrl-z", { key: "z", ctrlKey: true }, { key: "z", ctrlKey: true, shiftKey: true }],
  ])("by the keys of a block, %s", (_n, u, r) => {
    const ed = make("scheme", "a b c d");
    const [a, , , d] = ed.roots();
    ed.focusNode(d);
    ed.removeNode(a);
    const left = label(ed);
    const press = (init: KeyboardEventInit) => ed.focusedNode() && ed.view.dom.ownerDocument.activeElement!.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init }));
    press(u);
    expect(textOf(ed)).toBe("a b c d");
    expect(label(ed)).toBe("d");
    press(r);
    expect(textOf(ed)).toBe("b c d");
    expect(label(ed)).toBe(left);
  });
  test.each(["javascript", "python"])("%s: removing an argument and undoing it", (l) => {
    const ed = make(l, l === "python" ? "f(a, b, c)" : "f(a, b, c);");
    const args = () => ed.roots()[0].slots.flatMap((s) => s.nodes).flatMap((n) => (n.slots.length ? n.slots.flatMap((s) => s.nodes) : [n]));
    const list = args();
    const c = list[list.length - 1];
    const text = c ? textOf(ed).slice(c.from, c.to) : "";
    ed.focusNode(c);
    ed.removeNode(list[list.length - 2]);
    nextEvent(ed);
    undo(ed.view);
    expect(label(ed)).toBe(text);
    ok(ed);
  });
});
