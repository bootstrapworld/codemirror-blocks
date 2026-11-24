/** @jest-environment jsdom */
// PORTED from packages/codemirror-blocks/spec/summary-test.ts; see doc/experiments/cm6-direct-tree.md, ninth round and forty-fourth round.
// forty-fourth round: describeKinds / summarizeProgram are real functions now (src/summary.ts, over `Kind`s: a type, a label, a plural, an orphan flag
// instead of the old node objects), and the editor has them as methods (`ed.summarizeProgram()`, `ed.describeKinds(nodes)`, `ed.sayProgramSummary()`).
import { describeKinds, summarizeProgram } from "../../src/summary";
import { make } from "../helpers";

// edited: spoken words come from the language table. This editor has no summarizeProgram function: the summary is the first announcement made when
// a program is first drawn as blocks, so these tests read it from a new editor.
const summary = (code: string): string | null =>
  make("scheme", code).said.find((t: string) => t.startsWith("At the top")) ??
  null;

describe("summarizeProgram", () => {
  // edited: spoken words come from the language table (a struct definition is a call here, a literal is a number)
  it("counts the kinds of node that are at the top level", () => {
    const code = [
      "(define (f x) x)",
      "(define y 1)",
      "(define (g x) x)",
      "(define-struct p (a b))",
      "(f 1)",
      "(f 2)",
      "42",
    ].join("\n");
    expect(summary(code)).toBe(
      "At the top level, this program contains 2 function definitions, 1 value definition, 3 calls, and 1 number."
    );
  });

  // edited: spoken words come from the language table
  it("only names the kinds that are there", () => {
    expect(summary("(define y 1) (define z 2)")).toBe(
      "At the top level, this program contains 2 value definitions."
    );
    expect(summary("(define y 1) (f y)")).toBe(
      "At the top level, this program contains 1 value definition and 1 call."
    );
  });

  // edited: the nodes are `Kind`s (type, label, pluralLabel), what a table row makes of a node
  it("names each kind by what its type declares, with no list of them here", () => {
    const nodes = (...kinds: [string, string, string?][]) =>
      kinds.map(([type, label, pluralLabel]) => ({
        type,
        label,
        pluralLabel: pluralLabel ?? label + "s",
      }));
    expect(
      summarizeProgram(
        nodes(
          ["a", "gizmo"],
          ["b", "thing"],
          ["a", "gizmo"],
          ["c", "child", "children"]
        )
      )
    ).toBe(
      "At the top level, this program contains 2 gizmos, 1 thing, and 1 child."
    );
    expect(
      summarizeProgram(
        nodes(["c", "child", "children"], ["c", "child", "children"])
      )
    ).toBe("At the top level, this program contains 2 children.");
  });

  it("says nothing about an empty program", () => {
    expect(summary("")).toBeNull();
  });
});

describe("describeKinds", () => {
  const nodes = (...kinds: [string, string, string?, boolean?][]) =>
    kinds.map(([type, label, pluralLabel, orphan]) => ({
      type,
      label,
      pluralLabel: pluralLabel ?? label + "s",
      orphan,
    }));

  it("counts the kinds, as part of a sentence", () => {
    expect(describeKinds(nodes(["a", "gizmo"], ["a", "gizmo"]))).toBe(
      "2 gizmos"
    );
    expect(describeKinds(nodes(["a", "gizmo"]))).toBe("1 gizmo");
  });

  it("joins two with and, and three or more with commas and a last and", () => {
    expect(describeKinds(nodes(["a", "gizmo"], ["b", "thing"]))).toBe(
      "1 gizmo and 1 thing"
    );
    expect(
      describeKinds(
        nodes(["a", "gizmo"], ["b", "thing"], ["c", "child", "children"])
      )
    ).toBe("1 gizmo, 1 thing, and 1 child");
  });

  it("names the kinds in the order they come, and each by its own type", () => {
    // (two types with one label are two kinds)
    expect(
      describeKinds(nodes(["b", "thing"], ["a", "thing"], ["b", "thing"]))
    ).toBe("2 things and 1 thing");
  });

  it("leaves out the comments that go with no node, unless they are asked for", () => {
    const list = nodes(["a", "gizmo"], ["c", "comment", "comments", true]);
    expect(describeKinds(list)).toBe("1 gizmo");
    expect(describeKinds(list, { orphans: "count" })).toBe(
      "1 gizmo and 1 comment"
    );
  });

  it("is nothing for no nodes, or only comments that are left out", () => {
    expect(describeKinds([])).toBe("nothing");
    expect(describeKinds(nodes(["c", "comment", "comments", true]))).toBe(
      "nothing"
    );
  });

  // (new: the plural of a label with no plural of its own)
  it("makes the plural of a label that ends in s, x, sh or ch with es", () => {
    expect(
      describeKinds([
        { type: "a", label: "class" },
        { type: "a", label: "class" },
        { type: "b", label: "match" },
        { type: "b", label: "match" },
      ])
    ).toBe("2 classes and 2 matches");
  });

  // (new: the summary of a program of only comments is nothing, as of an empty one)
  it("says nothing of a program of only comments, and counts them only when asked", () => {
    const only = nodes(["c", "comment", "comments", true]);
    expect(summarizeProgram(only)).toBeNull();
    expect(summarizeProgram(only, { orphans: "count" })).toBe(
      "At the top level, this program contains 1 comment."
    );
  });
});

// (forty-fourth round: the summaries as methods of the editor, in each language of the package)
describe("what the editor can say about a program and a block", () => {
  const CASES: Record<string, { text: string; summary: string }> = {
    scheme: {
      text: ";; note\n(define (f x) (g (h x) 2))\n(define y 1)\n(f 1)",
      summary:
        "At the top level, this program contains 1 function definition, 1 value definition, and 1 call.",
    },
    javascript: {
      text: "// note\nfunction f(x) { return g(h(x), 2); }\nlet y = 1;\nf(1);",
      summary: "",
    },
    python: {
      text: "# note\ndef f(x):\n  return g(h(x), 2)\ny = 1\nf(1)",
      summary: "",
    },
  };
  for (const l of Object.keys(CASES)) {
    describe(l, () => {
      const rig = () => make(l, CASES[l].text.replace(/\\n/g, "\n"));
      it("summarizes the program on request, with the labels of the table and no comment counted", () => {
        const ed = rig();
        const s = ed.summarizeProgram();
        expect(s).toMatch(/^At the top level, this program contains /);
        expect(s).not.toMatch(/comment/);
        if (CASES[l].summary) expect(s).toBe(CASES[l].summary);
        // (the same words, said by the editor, in the live region)
        expect(ed.sayProgramSummary()).toBe(true);
        expect(ed.said[ed.said.length - 1]).toBe(s);
        // (and it is the one said on first drawing the blocks)
        expect(ed.said[0]).toBe(s);
      });
      it("counts the kinds of a list of blocks, comments left out", () => {
        const ed = rig();
        const all = ed.roots();
        expect(all.some((r) => r.kind === "comment")).toBe(true);
        expect(ed.describeKinds(all)).toMatch(/\d/);
        expect(ed.describeKinds(all)).not.toMatch(/comment/);
        expect(ed.describeKinds([])).toBe("nothing");
      });
      it("reads the ancestors and the children of a block, as the keys do", () => {
        const ed = rig();
        const top = ed
          .roots()
          .find((r) => r.kind !== "comment" && r.slots.length)!;
        expect(ed.readAncestors(top)).toBeNull();
        const deepest = (n: typeof top): typeof top => {
          const k = n.slots.flatMap((s) => s.nodes).find((c) => c.slots.length);
          return k ? deepest(k) : n;
        };
        const d = deepest(top);
        expect(d).not.toBe(top);
        const said = ed.readAncestors(d)!;
        expect(said.startsWith(ed.language.describe(d))).toBe(true);
        expect(said).toContain(", inside ");
        expect(said).toContain(", at level 1");
        expect(ed.summarizeBlock(d)).toMatch(/, at level \d+$/);
        expect(ed.readChildren(top)).not.toBe("no children");
        const leaf = top.slots
          .flatMap((s) => s.nodes)
          .find((c) => !c.slots.some((s) => s.nodes.length))!;
        expect(ed.readChildren(leaf)).toBe("no children");
      });
    });
  }

  it("says nothing of an empty program, or one of only comments", () => {
    const ed = make("scheme", ";; just a note");
    expect(ed.summarizeProgram()).toBeNull();
    expect(ed.sayProgramSummary()).toBe(false);
    expect(ed.said).toEqual([]);
  });

  it("works in text mode, and saying it again says it again", () => {
    const ed = make("scheme", "(f 1)");
    ed.setMode("text");
    expect(ed.summarizeProgram()).toBe(
      "At the top level, this program contains 1 call."
    );
    ed.sayProgramSummary();
    ed.sayProgramSummary();
    expect(
      ed.said.filter((t: string) => t.startsWith("At the top"))
    ).toHaveLength(3);
  });
});

describe("the summary on first opening a program as blocks", () => {
  // edited: the editor is made with its program (the summary is said when blocks are first drawn with content), and a later change does not say it again
  it("is said once, and not again after switching modes", () => {
    const ed = make("scheme", "(define y 1)\n(f y)");
    const summaries = () =>
      ed.said.filter((t: string) => t.startsWith("At the top"));
    expect(summaries()).toEqual([
      "At the top level, this program contains 1 value definition and 1 call.",
    ]);
    ed.view.dispatch({
      changes: {
        from: 0,
        to: ed.view.state.doc.length,
        insert: "(define z 2)",
      },
    });
    expect(summaries()).toHaveLength(1);
  });
});
