/** @jest-environment jsdom */
import { checkLezerEditor } from "../src/lezer-view";
import { make } from "./helpers";

const CASES: Record<string, { text: string; comment: string; inside: string }> =
  {
    scheme: {
      text: "; first\n(f 1)\n#| block |#\n(g 2)\n",
      comment: "; first",
      inside: "(f ; inside\n 1)\n",
    },
    javascript: {
      text: "// first\nf(1);\n/* block */\ng(2);\n",
      comment: "// first",
      inside: "function f() {\n  // inside\n  return 1;\n}\n",
    },
    python: {
      text: "# first\nf(1)\n# second\ng(2)\n",
      comment: "# first",
      inside: "def f():\n    # inside\n    return 1\n",
    },
  };

describe.each(Object.keys(CASES))("comments: %s", (l) => {
  test("a comment between statements is a block of its own", () => {
    const ed = make(l, CASES[l].text);
    const kinds = ed.roots().map((r) => r.kind);
    expect(kinds.filter((k) => k === "comment").length).toBe(2);
    expect(
      ed.view.state.doc.sliceString(ed.roots()[0].from, ed.roots()[0].to)
    ).toBe(CASES[l].comment);
    expect(checkLezerEditor(ed)).toEqual([]);
  });
  test("it can be edited, removed and written around like any root", () => {
    const ed = make(l, CASES[l].text);
    const c = ed.roots()[0];
    ed.replaceText(c, CASES[l].comment + " more");
    expect(ed.view.state.doc.toString()).toContain("more");
    expect(ed.roots()[0].kind).toBe("comment");
    ed.removeNode(ed.roots()[0]);
    expect(ed.roots()[0].kind).not.toBe("comment");
    expect(checkLezerEditor(ed)).toEqual([]);
  });
  test("a comment inside a block is a block of its own, in the list it sits in (fourth round)", () => {
    const ed = make(l, CASES[l].inside);
    let found = 0;
    const walk = (n: any) => {
      if (n.kind === "comment") found++;
      n.slots.forEach((s: any) => s.nodes.forEach(walk));
    };
    ed.roots().forEach(walk);
    expect(found).toBe(1);
    expect(ed.view.state.doc.toString()).toContain("inside");
    expect(checkLezerEditor(ed)).toEqual([]);
  });
  test("writing at the end of a list that ends in a line comment does not put text inside the comment", () => {
    const ed = make(l, CASES[l].inside);
    let slot: any = null;
    const find = (n: any) => {
      n.slots.forEach((q: any) => {
        if (
          q.kind === "list" &&
          q.nodes.some((k: any) => k.kind === "comment") &&
          !slot
        )
          slot = q;
        q.nodes.forEach(find);
      });
    };
    ed.roots().forEach(find);
    expect(slot).not.toBeNull();
    ed.insertText(slot, slot.nodes.length, "x");
    expect(checkLezerEditor(ed)).toEqual([]);
    let comments = 0;
    const count = (n: any) => {
      if (n.kind === "comment") comments++;
      n.slots.forEach((q: any) => q.nodes.forEach(count));
    };
    ed.roots().forEach(count);
    expect(comments).toBe(1);
    expect(ed.view.state.doc.toString()).toMatch(/x/);
  });
});
