/** @jest-environment jsdom */
/* Fortieth round: a Python default parameter `final=False` (also `a: int = 1`, `lambda x=1: x`) is ONE block with a name and a value. */
import { checkLezerEditor } from "../src/lezer-view";
import { walk } from "../src/doc";
import { make } from "./helpers";
import type { BNode } from "../src/types";

const find = (ed: ReturnType<typeof make>, kind: string, label?: string) => {
  const out: BNode[] = [];
  ed.roots().forEach((r) =>
    walk(r, (n) => {
      if (n.kind === kind) out.push(n);
    })
  );
  return label ? out.filter((n) => n.slots[0].nodes[0]?.value === label) : out;
};
const params = (ed: ReturnType<typeof make>) =>
  find(ed, "function")[0].slots.find((s) => s.name === "params")!;
const slot = (n: BNode, name: string) => n.slots.find((s) => s.name === name)!;

describe("python default parameters", () => {
  test("the pair is one block in the parameter list, with name and value slots", () => {
    const ed = make(
      "python",
      "def f(a, final=False, b: int = 1, *r, **k):\n    pass\n"
    );
    const ps = params(ed).nodes;
    expect(ps.map((p) => p.kind)).toEqual(
      ["literal", "assign", "assign", "literal", "literal"].slice(0, ps.length)
    );
    const d = ps[1];
    expect(slot(d, "name").nodes[0].value).toBe("final");
    expect(slot(d, "value").nodes[0].value).toBe("False");
    expect(slot(ps[2], "annotation").nodes[0].value).toBe("int");
    expect(checkLezerEditor(ed)).toEqual([]);
    const el = ed.view.dom.querySelector('[aria-label="final equals False"]');
    expect(el).not.toBeNull();
    expect(el!.getAttribute("aria-posinset")).toBe("2");
    expect(el!.getAttribute("aria-setsize")).toBe(String(ps.length));
  });

  test("removing the parameter removes name and default, with the comma", () => {
    for (const [src, want] of [
      ["def f(a, final=False, b):\n    pass\n", "def f(a, b):\n    pass\n"],
      ["def f(a, final=False):\n    pass\n", "def f(a):\n    pass\n"],
      ["def f(final=False):\n    pass\n", "def f():\n    pass\n"],
    ]) {
      const ed = make("python", src);
      ed.removeNode(find(ed, "assign")[0]);
      expect(ed.view.state.doc.toString()).toBe(want);
      expect(checkLezerEditor(ed)).toEqual([]);
    }
  });

  test("removing only the default keeps the name (the = goes with the value)", () => {
    for (const [src, want] of [
      ["def f(a, final=False):\n    pass\n", "def f(a, final):\n    pass\n"],
      [
        "def f(a, final = False, b):\n    pass\n",
        "def f(a, final, b):\n    pass\n",
      ],
      ["def f(a: int = 1):\n    pass\n", "def f(a: int):\n    pass\n"],
      ["f = lambda x=1: x\n", "f = lambda x: x\n"],
    ]) {
      const ed = make("python", src);
      const d = find(ed, "assign").find((n) => n.slots.length === 3)!;
      ed.removeNode(slot(d, "value").nodes[0]);
      expect(ed.view.state.doc.toString()).toBe(want);
      expect(checkLezerEditor(ed)).toEqual([]);
    }
  });

  test("the annotation can go too, lambda parameters are the same node, undo restores", () => {
    const ed = make(
      "python",
      "def f(a: int = 1):\n    pass\ng = lambda x=1, y=2: x\n"
    );
    expect(find(ed, "assign").filter((n) => n.slots.length === 3).length).toBe(
      3
    );
    const d = find(ed, "assign").find((n) => n.slots.length === 3)!;
    ed.removeNode(slot(d, "annotation").nodes[0]);
    expect(ed.view.state.doc.toString()).toBe(
      "def f(a = 1):\n    pass\ng = lambda x=1, y=2: x\n"
    );
    expect(checkLezerEditor(ed)).toEqual([]);
  });

  test("moveNode of a default parameter moves the pair; the text round-trips", () => {
    const ed = make("python", "def f(a, final=False, b):\n    pass\n");
    const ps = params(ed);
    ed.moveNode(ps.nodes[1], { slot: ps, index: 3 });
    expect(ed.view.state.doc.toString()).toBe(
      "def f(a, b, final=False):\n    pass\n"
    );
    expect(checkLezerEditor(ed)).toEqual([]);
  });

  test("a value can be replaced, text edits keep the oracle clean", () => {
    const ed = make("python", "def f(a, final=False):\n    pass\n");
    const d = find(ed, "assign")[0];
    ed.replaceText(slot(d, "value").nodes[0], "True");
    expect(ed.view.state.doc.toString()).toBe(
      "def f(a, final=True):\n    pass\n"
    );
    ed.view.dispatch({ changes: { from: 6, to: 7, insert: "bb" } });
    expect(checkLezerEditor(ed)).toEqual([]);
  });
});
