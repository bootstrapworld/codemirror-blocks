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

describe("7. removing several arguments leaves tidy separators", () => {
  /** every block of the document with its source text, in document order */
  const all = (ed: LezerBlockEditor) => {
    const out: { n: ReturnType<LezerBlockEditor["roots"]>[number]; t: string }[] = [];
    const go = (n: ReturnType<LezerBlockEditor["roots"]>[number]) => {
      out.push({ n, t: textOf(ed).slice(n.from, n.to) });
      n.slots.forEach((s) => s.nodes.forEach(go));
    };
    ed.roots().forEach(go);
    return out;
  };
  /** remove the blocks whose source is each of `what` (first one found inside a list), together, as Delete on a selection does */
  const remove = (lang: string, text: string, what: string[]) => {
    const ed = make(lang, text);
    const nodes = what.map((w) => all(ed).find((x) => x.t === w && x.n.slot && x.n.slot.kind === "list" && x.n.slot.owner.kind !== "program")!.n);
    ed.removeNodes(nodes);
    ok(ed);
    const out = textOf(ed);
    undo(ed.view);
    expect(textOf(ed)).toBe(text); // one undo step
    return out;
  };
  test.each([
    ["scheme", "(+ 1 2 3)", ["2", "3"], "(+ 1)"],
    ["scheme", "(+ 1 2 3)", ["1", "2"], "(+ 3)"],
    ["scheme", "(+ 1 2 3)", ["1", "3"], "(+ 2)"],
    ["scheme", "(+ 1 2 3)", ["1", "2", "3"], "(+)"],
    ["scheme", "(+ 1 2 3)", ["3"], "(+ 1 2)"],
    ["scheme", "(+ 1 2 3)", ["1"], "(+ 2 3)"],
    ["scheme", "(+ 1)", ["1"], "(+)"],
    ["scheme", "(define (f x y z) (+ x y))", ["y", "z"], "(define (f x) (+ x y))"],
    ["scheme", "(define (f x y z) (+ x y))", ["x", "y", "z"], "(define (f) (+ x y))"],
    ["scheme", "(f (g 1 2) (h 3 4))", ["2", "4"], "(f (g 1) (h 3))"],
    ["scheme", "(f (g 1 2) 5)", ["(g 1 2)", "5"], "(f)"],
    ["javascript", "f(a, b, c);", ["b", "c"], "f(a);"],
    ["javascript", "f(a, b, c);", ["a", "b"], "f(c);"],
    ["javascript", "f(a, b, c);", ["a", "c"], "f(b);"],
    ["javascript", "f(a, b, c);", ["a", "b", "c"], "f();"],
    ["javascript", "f(a, b, c);", ["c"], "f(a, b);"],
    ["javascript", "f(a, b, c);", ["b"], "f(a, c);"],
    ["javascript", "[1, 2, 3, 4]", ["2", "3"], "[1, 4]"],
    ["javascript", "[1, 2, 3, 4]", ["3", "4"], "[1, 2]"],
    ["javascript", "function g(a, b, c) { return a; }", ["b", "c"], "function g(a) { return a; }"],
    ["javascript", "f(g(1, 2), h(3, 4));", ["2", "4"], "f(g(1), h(3));"],
    ["python", "f(a, b, c)", ["b", "c"], "f(a)"],
    ["python", "f(a, b, c)", ["a", "b", "c"], "f()"],
    ["python", "f(a, b, c)", ["a", "c"], "f(b)"],
    ["python", "x = [1, 2, 3]", ["2", "3"], "x = [1]"],
    ["python", "def g(a, b, c):\n    return a", ["b", "c"], "def g(a):\n    return a"],
    ["python", "f(g(1, 2), h(3, 4))", ["2", "4"], "f(g(1), h(3))"],
  ] as [string, string, string[], string][])("%s: %s minus %j", (lang, text, what, expected) => {
    expect(remove(lang, text, what)).toBe(expected);
  });
  test("a comment that sits against the block before it does not glue the next block to it", () => {
    const ed = make("scheme", "(a b 7; c\nc)");
    const c = all(ed).find((x) => x.n.kind === "comment")!.n;
    ed.removeNode(c);
    expect(textOf(ed)).toBe("(a b 7 c)");
    ok(ed);
  });
  test("a comment before the operator goes alone", () => {
    const ed = make("scheme", "(; c\n 1 7)");
    const c = all(ed).find((x) => x.n.kind === "comment")!.n;
    ed.removeNode(c);
    expect(textOf(ed)).toBe("(1 7)");
    ok(ed);
  });
});
