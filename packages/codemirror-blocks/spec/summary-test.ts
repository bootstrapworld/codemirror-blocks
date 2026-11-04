import wescheme from "../src/languages/wescheme";
import { summarizeProgram } from "../src/summary";
import { mountCMB, teardown } from "../src/toolkit/test-utils";
import * as announcer from "../src/announcer";

const summary = (code: string) =>
  summarizeProgram(
    wescheme.parse(code) as Parameters<typeof summarizeProgram>[0]
  );

describe("summarizeProgram", () => {
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
      "At the top level, this program contains 2 function definitions, 1 value definition, 1 structure definition, 2 function applications, and 1 literal."
    );
  });

  it("only names the kinds that are there", () => {
    expect(summary("(define y 1) (define z 2)")).toBe(
      "At the top level, this program contains 2 value definitions."
    );
    expect(summary("(define y 1) (f y)")).toBe(
      "At the top level, this program contains 1 value definition and 1 function application."
    );
  });

  it("names each kind by what its type declares, with no list of them here", () => {
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

describe("the summary on first opening a program as blocks", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    teardown();
  });

  it("is said once, and not again after switching modes", async () => {
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
