/** @jest-environment jsdom */
/* Seventh round, step 3: a template dropped from the toolbar (the API behind the drag). */
import { checkLezerEditor } from "../src/lezer-view";
import { make } from "./helpers";
import { walk } from "../src/doc";
import type { BNode } from "../src/types";

const find = (
  ed: ReturnType<typeof make>,
  pred: (n: BNode) => boolean
): BNode => {
  let f: BNode | null = null;
  ed.roots().forEach((r) => walk(r, (n) => !f && pred(n) && (f = n)));
  return f!;
};

test("a template onto a blank replaces it; into a gap it goes there; its first hole opens", () => {
  const ed = make("scheme", "(f ... 2)\n(g 1)\n");
  const blank = find(ed, (n) => n.kind === "blank");
  expect(blank).toBeDefined();
  const hole = ed.insertTemplateAt("number", { blank });
  expect(ed.view.state.doc.toString()).toBe("(f 0 2)\n(g 1)\n");
  expect(hole && ed.view.state.doc.sliceString(hole.from, hole.to)).toBe("0");
  expect(ed.view.dom.querySelector("input.blocks-edit")).not.toBeNull();
  (
    ed.view.dom.querySelector("input.blocks-edit") as HTMLInputElement
  ).dispatchEvent(
    new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
  );
  const call = find(
    ed,
    (n) =>
      n.kind === "call" &&
      ed.view.state.doc.sliceString(n.from, n.to) === "(g 1)"
  );
  ed.insertTemplateAt("if-else", {
    slot: call.slots.find((s) => s.name === "args")!,
    index: 1,
  });
  expect(ed.view.state.doc.toString()).toBe(
    "(f 0 2)\n(g 1 (if ... ... ...))\n"
  );
  (
    ed.view.dom.querySelector("input.blocks-edit") as HTMLInputElement
  ).dispatchEvent(
    new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
  );
  expect(checkLezerEditor(ed)).toEqual([]);
});

test("a template does not go where it cannot: onto a block that is not a hole, into a one slot, a statement into an expression list", () => {
  const ed = make("scheme", "(f 1 2)\n");
  const one = find(ed, (n) => n.kind === "literal");
  expect(() => ed.insertTemplateAt("number", { blank: one })).toThrow(/hole/);
  const def = make("scheme", "(define x 5)\n");
  const d = find(def, (n) => n.kind === "define");
  expect(() =>
    def.insertTemplateAt("number", { slot: d.slots[0], index: 0 })
  ).toThrow(/list/);
  const js = make("javascript", "f(1);\n");
  const call = find(js, (n) => n.kind === "call");
  expect(() =>
    js.insertTemplateAt("if-else", {
      slot: call.slots.find((s) => s.name === "args")!,
      index: 0,
    })
  ).toThrow(/statement/);
  expect(ed.view.state.doc.toString()).toBe("(f 1 2)\n");
});
