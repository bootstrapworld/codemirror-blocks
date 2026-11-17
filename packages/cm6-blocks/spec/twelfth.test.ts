/** @jest-environment jsdom */
// Twelfth round: difference 8 (paste beside a root, paste after the operator), difference 10 (native keys with no block focused)
import { undo } from "@codemirror/commands";
import { checkLezerEditor, LezerBlockEditor } from "../src/lezer-view";
import { make } from "./helpers";

const textOf = (ed: LezerBlockEditor) => ed.view.state.doc.toString();
const ok = (ed: LezerBlockEditor) => expect(checkLezerEditor(ed)).toEqual([]);
const kids = (n: { slots: { nodes: unknown[] }[] }) => n.slots.flatMap((s) => s.nodes) as ReturnType<LezerBlockEditor["roots"]>;
const descend = (n: ReturnType<LezerBlockEditor["roots"]>[number]): ReturnType<LezerBlockEditor["roots"]> => [n, ...kids(n).flatMap(descend)];

describe("8. paste beside a root: a line break where something else is on the line (the old OverwriteEdit)", () => {
  test.each([
    // [language, text, which root, before, pasted, result]
    ["scheme", "a b", 0, false, "zzz", "a\nzzz\n b"],
    ["scheme", "a b", 1, true, "zzz", "a \nzzz\nb"],
    ["scheme", "a\nb", 0, false, "zzz", "a\nzzz\nb"],
    ["scheme", "a\nb", 1, true, "zzz", "a\nzzz\nb"],
    ["scheme", "a\nb", 1, false, "zzz", "a\nb\nzzz"],
    ["scheme", "a\nb", 0, true, "zzz", "zzz\na\nb"],
    ["scheme", "a", 0, false, "zzz", "a\nzzz"],
    ["scheme", "a ; note\nb", 0, false, "zzz", "a\nzzz\n ; note\nb"],
    ["scheme", "(f x) (g y)", 0, false, "(h 1)", "(f x)\n(h 1)\n (g y)"],
    ["javascript", "f(x);\ng(y);", 0, false, "z;", "f(x);\nz;\ng(y);"],
    ["javascript", "f(x);\ng(y);", 1, true, "z;", "f(x);\nz;\ng(y);"],
    ["javascript", "f(x); g(y);", 0, false, "z;", "f(x);\nz;\n g(y);"],
    ["javascript", "f(x); g(y);", 1, true, "z;", "f(x); \nz;\ng(y);"],
    ["python", "f(x)\ng(y)\n", 0, false, "z", "f(x)\nz\ng(y)\n"],
    ["python", "f(x)\ng(y)\n", 1, true, "z", "f(x)\nz\ng(y)\n"],
    ["python", "f(x)\ng(y)\n", 1, false, "z", "f(x)\ng(y)\nz\n"],
  ] as const)("%s %j root %i before=%j paste %j", (lang, text, which, before, pasted, result) => {
    const ed = make(lang, text);
    const root = ed.roots()[which];
    ed.pasteText(root, pasted, before);
    expect(textOf(ed)).toBe(result);
    ok(ed);
    // one undo step
    undo(ed.view);
    expect(textOf(ed)).toBe(text);
    ok(ed);
  });
  test("the pasted block gets the focus", () => {
    const ed = make("scheme", "a b");
    ed.pasteText(ed.roots()[0], "zzz");
    const f = ed.focusedNode()!;
    expect(textOf(ed).slice(f.from, f.to)).toBe("zzz");
  });
  test("several blocks at once go in together", () => {
    const ed = make("scheme", "a b");
    ed.pasteTexts(ed.roots()[0], ["x", "y"]);
    expect(textOf(ed)).toBe("a\nx\ny\n b");
    undo(ed.view);
    expect(textOf(ed)).toBe("a b");
  });
});

describe("8. paste after the operator is the first argument; before it is refused", () => {
  test("scheme: (f x) after f is (f z x), one undo step", () => {
    const ed = make("scheme", "(f x)");
    const [call] = ed.roots();
    const [f] = kids(call);
    ed.pasteText(f, "z");
    expect(textOf(ed)).toBe("(f z x)");
    undo(ed.view);
    expect(textOf(ed)).toBe("(f x)");
    ok(ed);
  });
  test("scheme: a call with no arguments takes it as the only argument", () => {
    const ed = make("scheme", "(f)");
    ed.pasteText(kids(ed.roots()[0])[0], "z");
    expect(textOf(ed)).toBe("(f z)");
    ok(ed);
  });
  test("scheme: before the operator there is no place: refused, nothing written", () => {
    const ed = make("scheme", "(f x)");
    expect(() => ed.pasteText(kids(ed.roots()[0])[0], "z", true)).toThrow();
    expect(textOf(ed)).toBe("(f x)");
  });
  test("scheme: pasting several after the operator", () => {
    const ed = make("scheme", "(f x)");
    ed.pasteTexts(kids(ed.roots()[0])[0], ["1", "2"]);
    expect(textOf(ed)).toBe("(f 1 2 x)");
  });
  test("javascript: after the callee is the first argument", () => {
    const ed = make("javascript", "f(x);");
    const callee = descend(ed.roots()[0]).find((n) => textOf(ed).slice(n.from, n.to) === "f")!;
    ed.pasteText(callee, "z");
    expect(textOf(ed)).toBe("f(z, x);");
    undo(ed.view);
    expect(textOf(ed)).toBe("f(x);");
    ok(ed);
  });
  test("python: after the callee is the first argument", () => {
    const ed = make("python", "f(x)\n");
    const callee = descend(ed.roots()[0]).find((n) => textOf(ed).slice(n.from, n.to) === "f")!;
    ed.pasteText(callee, "z");
    expect(textOf(ed)).toBe("f(z, x)\n");
    ok(ed);
  });
});
