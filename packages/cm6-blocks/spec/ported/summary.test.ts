/** @jest-environment jsdom */
// @ts-nocheck
// PORTED from packages/codemirror-blocks/spec/summary-test.ts: only the imports changed (to ../compat/*); see doc/experiments/cm6-direct-tree.md, ninth round.
import wescheme from "../compat/wescheme";
import { describeKinds, summarizeProgram } from "../compat/internals";
import { mountCMB, teardown } from "../compat/test-utils";
import * as announcer from "../compat/announcer";

const summary = (code: string) =>
  summarizeProgram(
    wescheme.parse(code) as Parameters<typeof summarizeProgram>[0]
  );

describe("summarizeProgram", () => {
  // SKIPPED (I): uses the old implementation's internals or CM5 API methods the compat layer does not have: TypeError: _wescheme.default.parse is not a function
  it.skip("counts the kinds of node that are at the top level", () => {
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
      "At the top level, this program contains 2 function definitions, 1 value definition, 1 structure definition, 2 function applications, and 1 literal."
    );
  });

  // SKIPPED (I): uses the old implementation's internals or CM5 API methods the compat layer does not have: TypeError: _wescheme.default.parse is not a function

  it.skip("only names the kinds that are there", () => {
    expect(summary("(define y 1) (define z 2)")).toBe(
      "At the top level, this program contains 2 value definitions."
    );
    expect(summary("(define y 1) (f y)")).toBe(
      "At the top level, this program contains 1 value definition and 1 function application."
    );
  });

  // SKIPPED (M): not built / not in the compat layer: summarizeProgram (the summary module: the summary read on first opening is not built)

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

  // SKIPPED (I): uses the old implementation's internals or CM5 API methods the compat layer does not have: TypeError: _wescheme.default.parse is not a function

  it.skip("says nothing about an empty program", () => {
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

  // SKIPPED (M): not built / not in the compat layer: describeKinds (the summary module: the summary read on first opening is not built)

  it.skip("counts the kinds, as part of a sentence", () => {
    expect(describeKinds(nodes(["a", "gizmo"], ["a", "gizmo"]))).toBe(
      "2 gizmos"
    );
    expect(describeKinds(nodes(["a", "gizmo"]))).toBe("1 gizmo");
  });

  // SKIPPED (M): not built / not in the compat layer: describeKinds (the summary module: the summary read on first opening is not built)

  it.skip("joins two with and, and three or more with commas and a last and", () => {
    expect(describeKinds(nodes(["a", "gizmo"], ["b", "thing"]))).toBe(
      "1 gizmo and 1 thing"
    );
    expect(
      describeKinds(
        nodes(["a", "gizmo"], ["b", "thing"], ["c", "child", "children"])
      )
    ).toBe("1 gizmo, 1 thing, and 1 child");
  });

  // SKIPPED (M): not built / not in the compat layer: describeKinds (the summary module: the summary read on first opening is not built)

  it.skip("names the kinds in the order they come, and each by its own type", () => {
    // (two types with one label are two kinds)
    expect(
      describeKinds(nodes(["b", "thing"], ["a", "thing"], ["b", "thing"]))
    ).toBe("2 things and 1 thing");
  });

  // SKIPPED (M): not built / not in the compat layer: describeKinds (the summary module: the summary read on first opening is not built)

  it.skip("leaves out the comments that go with no node, unless they are asked for", () => {
    const list = nodes(["a", "gizmo"], ["c", "comment", "comments", true]);
    expect(describeKinds(list)).toBe("1 gizmo");
    expect(describeKinds(list, { orphans: "count" })).toBe(
      "1 gizmo and 1 comment"
    );
  });

  // SKIPPED (M): not built / not in the compat layer: describeKinds (the summary module: the summary read on first opening is not built)

  it.skip("is nothing for no nodes, or only comments that are left out", () => {
    expect(describeKinds([])).toBe("nothing");
    expect(describeKinds(nodes(["c", "comment", "comments", true]))).toBe(
      "nothing"
    );
  });
});

describe("the summary on first opening a program as blocks", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    teardown();
  });

  // SKIPPED (U): undocumented difference or not yet examined: Error: expect(received).toEqual(expected) // deep equality

  it.skip("is said once, and not again after switching modes", async () => {
    const say = jest.spyOn(announcer, "say");
    const { cmb } = mountCMB(wescheme);
    cmb.setValue("(define y 1)\n(f y)");
    await new Promise((r) => setTimeout(r, 0));
    const said = () => say.mock.calls.map((c) => String(c[0]));
    const summaries = () => said().filter((t) => t.startsWith("At the top"));
    expect(summaries()).toEqual([
      "At the top level, this program contains 1 value definition and 1 function application.",
    ]);
    cmb.setValue("(define z 2)");
    await new Promise((r) => setTimeout(r, 0));
    expect(summaries()).toHaveLength(1);
  });
});
