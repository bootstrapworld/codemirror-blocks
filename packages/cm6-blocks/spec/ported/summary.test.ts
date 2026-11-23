/** @jest-environment jsdom */
// @ts-nocheck
// PORTED from packages/codemirror-blocks/spec/summary-test.ts: only the imports changed (to ../compat/*); see doc/experiments/cm6-direct-tree.md, ninth round.
import { describeKinds, summarizeProgram } from "../compat/internals";
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

  // SKIPPED (I): the summary IS built (said when a program is first drawn as blocks; the tests above read it from the editor), but there is no `summarizeProgram` function here that takes node types: the old test calls it with made-up types, and the words are the table's labels (spec/describe.test.ts)

  it.skip("names each kind by what its type declares, with no list of them here", () => {
    const nodes = (...kinds: [string, string, string?][]) =>
      kinds.map(([type, label, pluralLabel]) => ({
        type,
        label,
        pluralLabel: pluralLabel ?? label + "s",
      })) as unknown as Parameters<typeof summarizeProgram>[0];
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
      options: { orphan },
    })) as unknown as Parameters<typeof describeKinds>[0];

  // edited: spoken words come from the language table
  it("counts the kinds, as part of a sentence", () => {
    expect(summary("42 43")).toBe(
      "At the top level, this program contains 2 numbers."
    );
    expect(summary("42")).toBe(
      "At the top level, this program contains 1 number."
    );
  });

  // edited: spoken words come from the language table (describeKinds is not a function here: the sentence is read from the editor)
  it("joins two with and, and three or more with commas and a last and", () => {
    expect(summary("(define y 1) (f y)")).toBe(
      "At the top level, this program contains 1 value definition and 1 call."
    );
    expect(summary("(define y 1) (f y) 42")).toBe(
      "At the top level, this program contains 1 value definition, 1 call, and 1 number."
    );
  });

  // edited: spoken words come from the language table
  it("names the kinds in the order they come, and each by its own type", () => {
    expect(summary("42 (f 1) 43")).toBe(
      "At the top level, this program contains 2 numbers and 1 call."
    );
  });

  // edited: spoken words come from the language table
  it("leaves out the comments that go with no node, unless they are asked for", () => {
    // edited (thirty-seventh round): a comment is not counted in the summary (the old editor counted a comment that goes with no node, as a kind)
    expect(summary(";; note\n(f 1)")).toBe(
      "At the top level, this program contains 1 call."
    );
  });

  // SKIPPED (I): there is no `describeKinds` function here (the summary is built, but only as the announcement); an empty program says nothing at all (tested above), so a rewrite would only repeat that test
  it.skip("is nothing for no nodes, or only comments that are left out", () => {
    expect(describeKinds([])).toBe("nothing");
    expect(describeKinds(nodes(["c", "comment", "comments", true]))).toBe(
      "nothing"
    );
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
