import wescheme from "../src/languages/wescheme";
import { summarizeProgram } from "../src/summary";
import { mountCMB, teardown } from "../src/toolkit/test-utils";
import * as announcer from "../src/announcer";

const summary = (code: string) =>
  summarizeProgram(
    wescheme.parse(code) as Parameters<typeof summarizeProgram>[0]
  );

describe("summarizeProgram", () => {
  it("counts definitions and expressions at the top level", () => {
    const code = [
      "(define (f x) x)",
      "(define (g x) x)",
      "(define y 1)",
      "(define-struct p (a b))",
      "(f 1)",
      "(f 2)",
      "; a comment on the last form",
    ].join("\n");
    expect(summary(code)).toBe(
      "At the top level, this program contains 2 function definitions, 1 variable definition, 1 structure definition, and 2 expressions."
    );
  });

  it("leaves out the kinds there are none of", () => {
    expect(summary("(define y 1) (define z 2)")).toBe(
      "At the top level, this program contains 2 variable definitions."
    );
    expect(summary("(define y 1) (f y)")).toBe(
      "At the top level, this program contains 1 variable definition and 1 expression."
    );
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
      "At the top level, this program contains 1 variable definition and 1 expression.",
    ]);
    cmb.setValue("(define z 2)");
    await new Promise((r) => setTimeout(r, 0));
    expect(summaries()).toHaveLength(1);
  });
});
