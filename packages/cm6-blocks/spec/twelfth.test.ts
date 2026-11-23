/** @jest-environment jsdom */
// Twelfth round: difference 8 (paste beside a root, paste after the operator), difference 10 (native keys with no block focused)
import { undo } from "@codemirror/commands";
import { checkLezerEditor, LezerBlockEditor } from "../src/lezer-view";
import { make } from "./helpers";

const textOf = (ed: LezerBlockEditor) => ed.view.state.doc.toString();
const ok = (ed: LezerBlockEditor) => expect(checkLezerEditor(ed)).toEqual([]);
const kids = (n: { slots: { nodes: unknown[] }[] }) =>
  n.slots.flatMap((s) => s.nodes) as ReturnType<LezerBlockEditor["roots"]>;
const descend = (
  n: ReturnType<LezerBlockEditor["roots"]>[number]
): ReturnType<LezerBlockEditor["roots"]> => [n, ...kids(n).flatMap(descend)];

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
  ] as const)(
    "%s %j root %i before=%j paste %j",
    (lang, text, which, before, pasted, result) => {
      const ed = make(lang, text);
      const root = ed.roots()[which];
      ed.pasteText(root, pasted, before);
      expect(textOf(ed)).toBe(result);
      ok(ed);
      // one undo step
      undo(ed.view);
      expect(textOf(ed)).toBe(text);
      ok(ed);
    }
  );
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
    const callee = descend(ed.roots()[0]).find(
      (n) => textOf(ed).slice(n.from, n.to) === "f"
    )!;
    ed.pasteText(callee, "z");
    expect(textOf(ed)).toBe("f(z, x);");
    undo(ed.view);
    expect(textOf(ed)).toBe("f(x);");
    ok(ed);
  });
  test("python: after the callee is the first argument", () => {
    const ed = make("python", "f(x)\n");
    const callee = descend(ed.roots()[0]).find(
      (n) => textOf(ed).slice(n.from, n.to) === "f"
    )!;
    ed.pasteText(callee, "z");
    expect(textOf(ed)).toBe("f(z, x)\n");
    ok(ed);
  });
});

describe("10. native keys with no block focused", () => {
  const SRC = {
    scheme: "(f x y)\n\n99",
    javascript: "f(x, y);\n\n99;",
    python: "f(x, y)\n\n99\n",
  } as const;
  const key = (ed: LezerBlockEditor, k: string, mods: KeyboardEventInit) => {
    const ev = new KeyboardEvent("keydown", {
      key: k,
      bubbles: true,
      cancelable: true,
      ...mods,
    });
    ed.view.contentDOM.dispatchEvent(ev);
    return ev;
  };
  test.each(Object.keys(SRC) as (keyof typeof SRC)[])(
    "%s: Mod-Enter in the text does nothing (CodeMirror 6's blank line is not inserted)",
    (lang) => {
      const ed = make(lang, SRC[lang]);
      ed.view.contentDOM.focus();
      expect(ed.focusedNode()).toBeFalsy();
      for (const mods of [{ ctrlKey: true }]) {
        // (Mod is Ctrl here, Cmd on a Mac: the key table decides)
        const ev = key(ed, "Enter", mods);
        expect(ev.defaultPrevented).toBe(true);
        expect(textOf(ed)).toBe(SRC[lang]);
      }
      // a plain Enter is still the text's own
      ed.view.dispatch({ selection: { anchor: 0 } });
      key(ed, "Enter", {});
      ok(ed);
    }
  );
  test("Ctrl-X with no block focused is left to the native cut: the blocks layer does not touch the key", () => {
    const ed = make("scheme", SRC.scheme);
    ed.view.contentDOM.focus();
    const ev = key(ed, "x", { ctrlKey: true });
    expect(ev.defaultPrevented).toBe(false);
    expect(textOf(ed)).toBe(SRC.scheme); // (only the cut event the browser sends next does something: CodeMirror's, of the line)
  });
});

describe("12. the search keys work from the text, with no block focused (the old handlers need no block)", () => {
  const SRC = {
    scheme: "(f x)\n(g xy x)\nx",
    javascript: "f(x);\ng(xy, x);\nx;",
    python: "f(x)\ng(xy, x)\nx",
  } as const;
  const press = (
    ed: LezerBlockEditor,
    k: string,
    mods: KeyboardEventInit = {}
  ) => {
    const ev = new KeyboardEvent("keydown", {
      key: k,
      bubbles: true,
      cancelable: true,
      ...mods,
    });
    ed.view.contentDOM.dispatchEvent(ev);
    return ev;
  };
  const label = (ed: LezerBlockEditor) => {
    const n = ed.focusedNode();
    return n ? textOf(ed).slice(n.from, n.to) : null;
  };
  test.each(Object.keys(SRC) as (keyof typeof SRC)[])(
    "%s: PageDown goes to the first match after the cursor, PageUp to the one before it, wrapping",
    (lang) => {
      const ed = make(lang, SRC[lang]);
      ed.search.set({ mode: "text", searchString: "xy" });
      const toText = (pos: number) => {
        ed.view.contentDOM.focus();
        ed.view.dispatch({ selection: { anchor: pos } });
        expect(ed.focusedNode()).toBeFalsy();
      };
      toText(0);
      const ev = press(ed, "PageDown");
      expect(ev.defaultPrevented).toBe(true);
      expect(label(ed)).toBe("xy");
      ed.search.set({ mode: "text", searchString: "x" });
      const text = textOf(ed);
      const second = text.indexOf("x", text.indexOf("xy") + 2); // the x after xy
      toText(second + 1); // after it: PageDown wraps to the first x, PageUp goes back to xy's x
      press(ed, "PageUp");
      expect(label(ed)).toBe("x");
      expect(ed.focusedNode()!.from).toBe(second);
      toText(text.indexOf("xy") + 1); // inside xy
      press(ed, "PageDown");
      expect(ed.focusedNode()!.from).toBeGreaterThanOrEqual(
        text.indexOf("xy") + 1
      );
      ok(ed);
    }
  );
  test("the rotor says so when there is nothing to search for, and PageDown that no settings were chosen", () => {
    const ed = make("scheme", "");
    const said: string[] = [];
    const orig = ed.say.bind(ed);
    ed.say = (t: string) => {
      said.push(t);
      orig(t);
    };
    ed.view.contentDOM.focus();
    press(ed, "F3", { ctrlKey: true });
    expect(said).toEqual(["No search types available"]);
    press(ed, "PageDown");
    expect(said.pop()).toBe("No search settings have been selected");
  });
  test("F3 from the text opens the dialog and Escape gives the focus back to the text; Enter goes to the first match after the cursor", () => {
    const ed = make("scheme", SRC.scheme);
    ed.view.contentDOM.focus();
    ed.view.dispatch({ selection: { anchor: textOf(ed).indexOf("(g") } });
    const ev = press(ed, "F3");
    expect(ev.defaultPrevented).toBe(true);
    expect(ed.search.isOpen()).toBe(true);
    ed.search.close(false);
    expect(ed.search.isOpen()).toBe(false);
    expect(ed.focusedNode()).toBeFalsy();
    press(ed, "F3");
    ed.search.set({ mode: "text", searchString: "x" });
    ed.search.close(true);
    const n = ed.focusedNode()!;
    expect(textOf(ed).slice(n.from, n.to)).toBe("xy"); // (the first "x" at or after the cursor, innermost block)
  });
});

describe("twenty-fifth round: after several blocks go in, focus is on the last", () => {
  test("pasteTexts, and one text of several forms, focus the last block", () => {
    const ed = make("scheme", "a b");
    ed.pasteTexts(ed.roots()[0], ["x", "y", "z"]);
    expect(textOf(ed).slice(ed.focusedNode()!.from, ed.focusedNode()!.to)).toBe(
      "z"
    );
    const ed2 = make("scheme", "a b");
    ed2.pasteText(ed2.roots()[0], "x\ny");
    const f = ed2.focusedNode()!;
    expect(textOf(ed2).slice(f.from, f.to)).toBe("y");
    ok(ed2);
  });
  test("moving several blocks focuses the last of them", () => {
    const ed = make("scheme", "a b c d");
    const [a, b, , d] = ed.roots();
    ed.moveNodes([a, b], { slot: d.slot!, index: 4 });
    const f = ed.focusedNode()!;
    expect(textOf(ed).slice(f.from, f.to)).toBe("b");
    ok(ed);
  });
});

describe("twenty-fifth round: a moved collapsed block stays collapsed", () => {
  test("a dragged collapsed call, and a collapsed call inside a moved one", () => {
    const ed = make("scheme", "(f 1 2) (g (h 3) 4) x");
    const [f, g, x] = ed.roots();
    const h = kids(g)[1];
    ed.collapse(f, true);
    ed.collapse(h, true);
    ed.moveNode(f, { slot: x.slot!, index: 3 });
    const [g2, x2, f2] = ed.roots();
    expect(ed.renderer.isCollapsed(f2)).toBe(true);
    expect(ed.renderer.isCollapsed(kids(g2)[1])).toBe(true);
    expect(ed.renderer.isCollapsed(x2)).toBe(false);
    ed.moveNode(g2, { slot: x2.slot!, index: 3 });
    const g3 = ed.roots()[2];
    expect(ed.renderer.isCollapsed(kids(g3)[1])).toBe(true);
    expect(ed.renderer.isCollapsed(g3)).toBe(false);
    ok(ed);
  });
});
