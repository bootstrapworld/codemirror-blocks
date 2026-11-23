// The soak runner's generator (spec/soak-gen.ts): the same seed gives the same sequence, steps are fractions, a failing list shrinks.
import {
  LANG_NAMES,
  makeSequence,
  mulberry32,
  randomProgram,
  shrink,
  Step,
} from "./soak-gen";

describe("soak generator", () => {
  test("a seed gives the same sequence, an engine another", () => {
    const a = makeSequence("jsdom", 42, 20);
    expect(makeSequence("jsdom", 42, 20)).toEqual(a);
    expect(makeSequence("chromium", 42, 20).steps).not.toEqual(a.steps);
    expect(a.steps).toHaveLength(20);
  });
  test("every step has an op and only fractions, numbers, booleans and texts", () => {
    for (const engine of ["jsdom", "chromium"] as const)
      for (let seed = 0; seed < 30; seed++)
        for (const s of makeSequence(engine, seed, 30).steps) {
          expect(typeof s.op).toBe("string");
          for (const [k, v] of Object.entries(s))
            if (k === "a" || k === "b" || k === "t") {
              expect(v).toBeGreaterThanOrEqual(0);
              expect(v).toBeLessThan(1);
            }
        }
  });
  test("the languages are all used, and a program is text", () => {
    const seen = new Set(
      Array.from({ length: 60 }, (_, i) => makeSequence("jsdom", i, 1).language)
    );
    expect([...seen].sort()).toEqual([...LANG_NAMES].sort());
    const rnd = mulberry32(3);
    for (const l of LANG_NAMES)
      expect(typeof randomProgram(l, rnd)).toBe("string");
  });
  test("the Chromium list has the mouse, the jsdom list the API", () => {
    const ops = (e: "jsdom" | "chromium") =>
      new Set(
        Array.from({ length: 40 }, (_, i) =>
          makeSequence(e, i, 40).steps.map((s) => s.op)
        ).flat()
      );
    expect(ops("chromium").has("dragBlock")).toBe(true);
    expect(ops("chromium").has("moveNode")).toBe(false);
    expect(ops("jsdom").has("moveNode")).toBe(true);
    expect(ops("jsdom").has("dragBlock")).toBe(false);
  });
  test("shrink keeps only the steps the failure needs", async () => {
    const steps = Array.from({ length: 16 }, (_, i) => ({ op: "k", i }));
    const needs = (c: Step[]) =>
      c.some((s) => s.i === 3) && c.some((s) => s.i === 11);
    const small = await shrink(steps, async (c) => needs(c), 100);
    expect(small.map((s) => s.i)).toEqual([3, 11]);
  });
  test("shrink stops at its limit", async () => {
    let runs = 0;
    await shrink(
      Array.from({ length: 16 }, (_, i) => ({ op: "k", i })),
      async () => ++runs > 0 && false,
      5
    );
    expect(runs).toBe(5);
  });
});
