/** @jest-environment jsdom */
import { walk } from "../src/doc";
import { checkLezerEditor, LezerBlockEditor } from "../src/lezer-view";
import { hasError } from "../src/lezer";
import { make, OPTS } from "./helpers";
import type { BNode } from "../src/types";

const CONTEXTS: Record<string, { top: string; fn: [string, string]; iff: [string, string] }> = {
  scheme: { top: "(f 1)\n(g 2)", fn: ["(define (f x) (g 1 2))", "1"], iff: ["(if (> x 1) (g 1 2) 0)", "1"] },
  javascript: { top: "f(1);\ng(2);", fn: ["function f(a) {\n  return a;\n}", "return a;"], iff: ["if (x) {\n  y();\n}", "y();"] },
  python: { top: "f(1)\ng(2)", fn: ["def f(a):\n    return a\n", "return a"], iff: ["if x:\n    y()\n", "y()"] },
};
const all = (ed: LezerBlockEditor): BNode[] => {
  const o: BNode[] = [];
  ed.roots().forEach((r) => walk(r, (n) => o.push(n)));
  return o;
};
const textOf = (ed: LezerBlockEditor) => ed.view.state.doc.toString();

describe.each(Object.keys(CONTEXTS))("templates: %s", (l) => {
  const names = Object.keys(OPTS[l].table.templates ?? {});
  test("there are templates", () => expect(names.length).toBeGreaterThanOrEqual(8));
  const where: [string, string, string | null][] = [
    ["top level", CONTEXTS[l].top, null],
    ["a function body", CONTEXTS[l].fn[0], CONTEXTS[l].fn[1]],
    ["an if body", CONTEXTS[l].iff[0], CONTEXTS[l].iff[1]],
  ];
  describe.each(where)("into %s", (_w, text, anchorText) => {
    test.each(names)("%s", (name) => {
      const ed = make(l, text);
      const t = OPTS[l].table.templates![name];
      const before = all(ed).filter((n) => n.kind === t.kind).length;
      const anchor = anchorText ? all(ed).find((n) => textOf(ed).slice(n.from, n.to) === anchorText) ?? null : null;
      expect(anchorText ? anchor : true).toBeTruthy();
      const hole = ed.insertTemplate(name, anchor);
      expect(ed.roots().filter((r) => r.kind === "error" || hasError(r))).toEqual([]);
      expect(all(ed).filter((n) => n.kind === t.kind).length).toBeGreaterThan(before);
      expect(hole).not.toBeNull();
      // the first hole is focused with its edit box open; cancel it to compare the page with a fresh drawing
      let input = ed.view.dom.querySelector("input.blocks-edit") as HTMLInputElement;
      expect(input).not.toBeNull();
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
      expect(checkLezerEditor(ed)).toEqual([]);
      if (t.text.includes("${")) {
        // typing into the hole replaces it
        ed.focusNode(hole!);
        const isBlank = hole!.value === (OPTS[l].table.blank ?? "...");
        ed.renderer.element(hole!).dispatchEvent(new KeyboardEvent("keydown", { key: isBlank ? "z" : "Enter", bubbles: true, cancelable: true }));
        input = ed.view.dom.querySelector("input.blocks-edit") as HTMLInputElement;
        expect(input.value).toBe(isBlank ? "z" : hole!.value);
        input.value = "zz";
        input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
        expect(textOf(ed)).toContain("zz");
        expect(checkLezerEditor(ed)).toEqual([]);
      }
    });
  });
  test("the toolbar list", () => {
    const ed = make(l, CONTEXTS[l].top);
    expect(ed.templates().map((t) => t.name)).toEqual(names);
  });
});

// found by the corpus run (cow-game.rkt): a template written far from the viewport opened its box in a
// detached element, which then showed up as a stray <input> and made the page differ from a fresh drawing
test("a template inserted outside the viewport leaves no edit box behind", () => {
  const text = Array.from({ length: 600 }, (_, i) => `(f ${i} 2)`).join("\n");
  const ed = make("scheme", text);
  const lit = all(ed).filter((n) => n.kind === "literal").pop()!;
  const found = ed.insertTemplate("boolean", lit)!;
  expect(found).not.toBeNull();
  expect(ed.renderer.element(found).querySelector("input")).toBeNull();
  expect(ed.view.dom.querySelector("input.blocks-edit")).toBeNull();
  expect(checkLezerEditor(ed)).toEqual([]);
});
