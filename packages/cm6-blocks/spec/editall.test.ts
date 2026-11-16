/** @jest-environment jsdom */
/* Fifth round, step 1b: Cmd-Enter (Mac) / Ctrl-Enter (elsewhere) edits a whole block as text. */
import { checkLezerEditor, LezerBlockEditor } from "../src/lezer-view";
import { walk } from "../src/doc";
import { make } from "./helpers";
import type { BNode } from "../src/types";

const LANGS = ["scheme", "javascript", "python"];
const text = (ed: LezerBlockEditor) => ed.view.state.doc.toString();
const ok = (ed: LezerBlockEditor) => expect(checkLezerEditor(ed)).toEqual([]);
const all = (ed: LezerBlockEditor): BNode[] => {
  const o: BNode[] = [];
  ed.roots().forEach((r) => walk(r, (n) => o.push(n)));
  return o;
};
const withText = (ed: LezerBlockEditor, re: RegExp, kind?: string): BNode => all(ed).filter((n) => re.test(text(ed).slice(n.from, n.to)) && n.slots.length > 0 && (!kind || n.kind === kind))[0];
const key = (el: Element, k: string, mods: Partial<KeyboardEventInit> = {}) => el.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true, ...mods }));
const box = (ed: LezerBlockEditor) => ed.view.dom.querySelector("textarea.blocks-edit") as HTMLTextAreaElement | null;
const setPlatform = (p: string) => Object.defineProperty(navigator, "platform", { value: p, configurable: true });
afterEach(() => setPlatform(""));

const MULTI: Record<string, string> = {
  scheme: "(define (f x)\n  (+ x 1))\n(f 2)\n",
  javascript: "function f(x) {\n  return x + 1;\n}\nf(2);\n",
  python: "def f(x):\n    y = x + 1\n    return y\nf(2)\n",
};
const REPLACEMENT: Record<string, string> = {
  scheme: "(define (f x)\n  (* x 2))",
  javascript: "function f(x) {\n  return x * 2;\n}",
  python: "def f(x):\n    y = x * 2\n    return y",
};

describe.each(LANGS)("edit a block as text: %s", (l) => {
  const ctrl = { ctrlKey: true };
  test("Ctrl-Enter opens a box with the block's whole text; Enter replaces the block's range, which is parsed again", () => {
    const ed = make(l);
    const call = withText(ed, /^[(]?g[( ]2/);
    ed.focusNode(call);
    key(ed.renderer.element(call), "Enter", ctrl);
    const b = box(ed)!;
    expect(b).not.toBeNull();
    expect(b.value).toMatch(l === "scheme" ? /^\(g 2\)$/ : /^g\(2\)$/);
    expect(ed.renderer.element(call).classList.contains("blocks-editing")).toBe(true);
    expect(ed.renderer.element(call).contains(b)).toBe(true);
    expect(document.activeElement).toBe(b);
    b.value = l === "scheme" ? "(g 2 3 4)" : "g(2, 3, 4)";
    key(b, "Enter");
    expect(box(ed)).toBeNull();
    expect(text(ed).split("\n")[0]).toContain(l === "scheme" ? "(g 2 3 4)" : "g(2, 3, 4)");
    expect(ed.focusedNode()).not.toBeNull();
    // parsed again: the new call has three arguments
    const nw = withText(ed, /^[(]?g[( ]2/);
    expect(nw.slots.find((s) => s.name === "args")!.nodes.length).toBe(3);
    expect(ed.view.dom.querySelector(".blocks-editing")).toBeNull();
    ok(ed);
  });

  test("Escape and Alt-Q cancel; unchanged text changes nothing", () => {
    const ed = make(l);
    const before = text(ed);
    const call = withText(ed, /^[(]?g[( ]2/);
    for (const how of ["escape", "altq", "same"]) {
      ed.focusNode(call);
      key(ed.renderer.element(call), "Enter", ctrl);
      const b = box(ed)!;
      b.value = "zzz";
      if (how === "escape") key(b, "Escape");
      else if (how === "altq") key(b, "q", { altKey: true, code: "KeyQ" });
      else {
        b.value = b.defaultValue;
        b.value = l === "scheme" ? "(g 2)" : "g(2)";
        key(b, "Enter");
      }
      expect(box(ed)).toBeNull();
      expect(text(ed)).toBe(before);
      expect(ed.renderer.element(call).classList.contains("blocks-editing")).toBe(false);
      ok(ed);
    }
  });

  test("blur commits what was typed (as the old editor does); blur with empty or unchanged text changes nothing", () => {
    const ed = make(l);
    const before = text(ed);
    const call = withText(ed, /^[(]?g[( ]2/);
    for (const v of ["", l === "scheme" ? "(g 2)" : "g(2)"]) {
      ed.focusNode(call);
      key(ed.renderer.element(call), "Enter", ctrl);
      const b = box(ed)!;
      b.value = v;
      b.dispatchEvent(new FocusEvent("blur"));
      expect(box(ed)).toBeNull();
      expect(text(ed)).toBe(before);
    }
    ed.focusNode(call);
    key(ed.renderer.element(call), "Enter", ctrl);
    const b = box(ed)!;
    b.value = l === "scheme" ? "(g 22)" : "g(22)";
    b.dispatchEvent(new FocusEvent("blur"));
    expect(box(ed)).toBeNull();
    expect(text(ed)).toContain("22");
    ok(ed);
  });

  test("text that does not parse is accepted and shown as text", () => {
    const ed = make(l);
    const call = withText(ed, /^[(]?g[( ]2/);
    ed.focusNode(call);
    key(ed.renderer.element(call), "Enter", ctrl);
    const b = box(ed)!;
    b.value = l === "scheme" ? "(((" : "g(((";
    key(b, "Enter");
    expect(text(ed).split("\n")[0]).toContain("(((");
    expect(ed.lastError).toBeNull();
    ok(ed);
    const { undo } = jest.requireActual("@codemirror/commands");
    undo(ed.view);
    ok(ed);
  });

  test("a multi-line block gets a multi-line box; Shift-Enter is a newline, Enter commits; later lines keep their indentation", () => {
    const ed = make(l, MULTI[l]);
    const fn = ed.roots()[0];
    ed.focusNode(fn);
    key(ed.renderer.element(fn), "Enter", ctrl);
    const b = box(ed)!;
    expect(b.rows).toBe(b.value.split("\n").length);
    expect(b.rows).toBeGreaterThan(1);
    expect(b.value).toBe(text(ed).slice(fn.from, fn.to).replace(/\s+$/, ""));
    // Shift-Enter does not commit and is not swallowed (the default action adds the newline)
    const ev = new KeyboardEvent("keydown", { key: "Enter", shiftKey: true, bubbles: true, cancelable: true });
    b.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(false);
    expect(box(ed)).toBe(b);
    b.value = REPLACEMENT[l];
    key(b, "Enter");
    expect(text(ed)).toBe(MULTI[l].replace(/\+ x 1|x \+ 1|x \+ 1/, l === "scheme" ? "* x 2" : "x * 2").replace(/return x \* 2;/, "return x * 2;"));
    ok(ed);
  });

  test("a multi-line block that is indented (a method / a nested body) round-trips: no change, then an edit", () => {
    const src: Record<string, string> = {
      scheme: "(define (f x)\n  (define (g y)\n    (+ y 1))\n  (g x))\n",
      javascript: "function f(x) {\n  function g(y) {\n    return y + 1;\n  }\n  return g(x);\n}\n",
      python: "def f(x):\n    def g(y):\n        z = y + 1\n        return z\n    return g(x)\n",
    };
    const ed = make(l, src[l]);
    const inner = all(ed).filter((n) => n.slots.length && /^[(]?(define \(g|function g|def g)/.test(text(ed).slice(n.from, n.to)))[0];
    expect(inner).toBeDefined();
    ed.focusNode(inner);
    key(ed.renderer.element(inner), "Enter", ctrl);
    const b = box(ed)!;
    expect(b.value.split("\n")[1].startsWith(" ")).toBe(true);
    key(b, "Enter"); // unchanged: nothing happens
    expect(text(ed)).toBe(src[l]);
    ed.focusNode(inner);
    key(ed.renderer.element(inner), "Enter", ctrl);
    const b2 = box(ed)!;
    b2.value = b2.value.replace("y + 1", "y * 3").replace("(+ y 1)", "(* y 3)");
    key(b2, "Enter");
    expect(text(ed)).toBe(src[l].replace("y + 1", "y * 3").replace("(+ y 1)", "(* y 3)"));
    ok(ed);
  });

  test("Cmd-Enter on a Mac; Ctrl-Enter does nothing there, and Cmd-Enter nothing elsewhere", () => {
    const ed = make(l);
    const call = withText(ed, /^[(]?g[( ]2/);
    ed.focusNode(call);
    const el = ed.renderer.element(call);
    key(el, "Enter", { metaKey: true }); // not a Mac (platform is empty)
    expect(box(ed)).toBeNull();
    setPlatform("MacIntel");
    key(el, "Enter", ctrl);
    expect(box(ed)).toBeNull();
    key(el, "Enter", { metaKey: true });
    expect(box(ed)).not.toBeNull();
    key(box(ed)!, "Escape");
    expect(box(ed)).toBeNull();
  });

  test("on a literal it edits the same as Enter; plain Enter on a block with children does nothing", () => {
    const ed = make(l);
    const two = all(ed).find((n) => n.kind === "literal" && text(ed).slice(n.from, n.to) === "2")!;
    ed.focusNode(two);
    key(ed.renderer.element(two), "Enter", ctrl);
    const b = box(ed)!;
    expect(b.value).toBe("2");
    b.value = "22";
    key(b, "Enter");
    expect(text(ed)).toContain("22");
    ok(ed);
    const call = withText(ed, /^[(]?g[( ]22/);
    ed.focusNode(call);
    key(ed.renderer.element(call), "Enter");
    expect(box(ed)).toBeNull();
    expect(ed.view.dom.querySelector("input.blocks-edit")).toBeNull();
  });

  test("a block that is not in view (not drawn) is not edited; opening the box clears the selection and announces", () => {
    const ed = make(l);
    const call = withText(ed, /^[(]?g[( ]2/);
    ed.focusNode(call);
    key(ed.renderer.element(call), " ");
    expect(ed.selection().length).toBeGreaterThan(0);
    key(ed.renderer.element(call), "Enter", ctrl);
    expect(ed.selection()).toEqual([]);
    expect(ed.said.some((s) => s.startsWith("editing "))).toBe(true);
    key(box(ed)!, "Escape");
  });
});
