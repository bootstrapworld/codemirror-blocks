// The soak runner's generator (spec/soak-gen.ts): the same seed gives the same sequence, steps are fractions, a failing list shrinks.
import {
  at,
  BROKEN,
  BROWSER_OPS,
  browserShare,
  browserStep,
  chooseEditor,
  defaultEditor,
  genStep,
  LANG_NAMES,
  longDocs,
  longProgram,
  makeSequence,
  mulberry32,
  randomProgram,
  RESIZE_WIDTHS,
  shrink,
  Step,
  stepsFor,
  TOUCH_OPS,
  topLevelForms,
  touchShare,
  ZOOM_LEVELS,
} from "./soak-gen";

describe("soak generator", () => {
  test("a seed gives the same sequence, an engine another", () => {
    const a = makeSequence("jsdom", 42, 20);
    expect(makeSequence("jsdom", 42, 20)).toEqual(a);
    expect(makeSequence("chromium", 42, 20).steps).not.toEqual(a.steps);
    expect(a.steps).toHaveLength(stepsFor(a.code, 20)); // (a long document gets fewer)
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

describe("soak generator: long documents and wider steps (forty-sixth round)", () => {
  const withLong = (v: string | undefined, fn: () => void) => {
    const old = process.env.CMB6_SOAK_LONG_DOCS;
    if (v === undefined) delete process.env.CMB6_SOAK_LONG_DOCS;
    else process.env.CMB6_SOAK_LONG_DOCS = v;
    try {
      fn();
    } finally {
      if (old === undefined) delete process.env.CMB6_SOAK_LONG_DOCS;
      else process.env.CMB6_SOAK_LONG_DOCS = old;
    }
  };
  test("longDocs is 0.18 by default, and the environment sets it", () => {
    withLong(undefined, () => expect(longDocs()).toBe(0.18));
    withLong("0", () => expect(longDocs()).toBe(0));
    withLong("1", () => expect(longDocs()).toBe(1));
    withLong("7", () => expect(longDocs()).toBe(1));
  });
  test("a long program has 60 to 400 top-level forms in every language, and the same seed gives the same one", () => {
    for (const l of LANG_NAMES)
      for (let seed = 1; seed <= 12; seed++) {
        const a = longProgram(l, mulberry32(seed));
        expect(longProgram(l, mulberry32(seed))).toBe(a);
        const n = topLevelForms(a);
        expect(n).toBeGreaterThanOrEqual(55); // (the count is of lines: a piece may hold a form or two more than it counts)
        expect(n).toBeLessThanOrEqual(500);
        expect(a.endsWith("\n")).toBe(true);
      }
  });
  test("about a fifth of the sequences have a long document; all of them with 1, none with 0", () => {
    const share = (v: string | undefined) => {
      let long = 0;
      withLong(v, () => {
        for (let seed = 0; seed < 200; seed++)
          if (topLevelForms(makeSequence("jsdom", seed, 1).code) > 60) long++;
      });
      return long / 200;
    };
    const d = share(undefined);
    expect(d).toBeGreaterThan(0.08);
    expect(d).toBeLessThan(0.3);
    expect(share("0")).toBe(0);
    expect(share("1")).toBeGreaterThan(0.85);
  });
  test("a long document gets fewer steps, a small one all of them", () => {
    expect(stepsFor("(a)\n(b)\n", 100)).toBe(100);
    const big = Array.from({ length: 400 }, () => "(f 1)").join("\n");
    expect(stepsFor(big, 100)).toBeLessThan(40);
    expect(stepsFor(big, 100)).toBeGreaterThanOrEqual(12);
    expect(stepsFor(big, 5)).toBe(5);
  });
  test("Chromium scrolls more in a long document, jsdom never scrolls", () => {
    const count = (engine: "jsdom" | "chromium", long: boolean, op: string) => {
      const rnd = mulberry32(9);
      return Array.from({ length: 3000 }, () =>
        genStep(rnd, "scheme", engine, false, long)
      ).filter((s) => s.op === op).length;
    };
    expect(count("chromium", true, "scroll")).toBeGreaterThan(
      3 * count("chromium", false, "scroll")
    );
    expect(count("chromium", true, "scrollKey")).toBeGreaterThan(0);
    expect(count("chromium", true, "scrollToggle")).toBeGreaterThan(0);
    expect(count("chromium", false, "scrollKey")).toBe(0);
    for (const op of ["scroll", "scrollKey", "scrollToggle"])
      expect(count("jsdom", true, op)).toBe(0);
  });
  test("each wider op appears in both engines, with valid fields", () => {
    for (const engine of ["jsdom", "chromium"] as const)
      for (const lang of LANG_NAMES) {
        const rnd = mulberry32(31);
        const steps = Array.from({ length: 4000 }, () =>
          genStep(rnd, lang, engine)
        );
        const of = (op: string) => steps.filter((s) => s.op === op);
        for (const op of [
          "pasteMulti",
          "brokenText",
          "undoRun",
          "collapseBurst",
          "collapseAllThen",
          "multiSelect",
          "commentNear",
        ])
          expect(of(op).length).toBeGreaterThan(0);
        for (const s of of("pasteMulti")) {
          expect(String(s.text).split("\n").length).toBeGreaterThanOrEqual(2);
          expect(String(s.text).split("\n").length).toBeLessThanOrEqual(4);
        }
        for (const s of of("brokenText")) {
          expect(BROKEN[lang]).toContain(s.w);
          expect(typeof s.back).toBe("boolean");
        }
        for (const s of of("undoRun")) {
          expect(s.n).toBeGreaterThanOrEqual(2);
          expect(s.n).toBeLessThanOrEqual(5);
        }
        for (const s of of("collapseBurst")) expect(s.n).toBeGreaterThan(2);
        for (const s of of("multiSelect")) {
          expect(s.n).toBeGreaterThanOrEqual(2);
          expect(s.n).toBeLessThanOrEqual(5);
          expect(["delete", "cut", "cutPaste", "copyPaste"]).toContain(s.then);
        }
        for (const s of of("commentNear")) expect([-1, 1]).toContain(s.dir);
      }
  });
  test("multi-form snippets reach the API's insert, paste, replace and replaced document", () => {
    const rnd = mulberry32(5);
    const steps = Array.from({ length: 4000 }, () =>
      genStep(rnd, "python", "jsdom")
    );
    for (const op of ["insertText", "pasteText", "replaceText", "replaceDoc"])
      expect(
        steps.some((s) => s.op === op && String(s.text).includes("\n"))
      ).toBe(true);
  });
});

describe("soak generator: editor options and touch (forty-seventh round)", () => {
  const withEnv = (k: string, v: string | undefined, fn: () => void) => {
    const old = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
    try {
      fn();
    } finally {
      if (old === undefined) delete process.env[k];
      else process.env[k] = old;
    }
  };
  test("a seed gives the same options, and they are part of the sequence", () => {
    for (const engine of ["jsdom", "chromium"] as const) {
      const a = makeSequence(engine, 77, 10);
      expect(a.editor).toEqual(chooseEditor(engine, 77));
      expect(makeSequence(engine, 77, 10).editor).toEqual(a.editor);
    }
  });
  test("about half of the sequences have options other than the default, each of them at least one; 0 turns it off", () => {
    for (const engine of ["jsdom", "chromium"] as const) {
      let other = 0;
      withEnv("CMB6_SOAK_OPTIONS", undefined, () => {
        for (let seed = 0; seed < 400; seed++)
          if (
            JSON.stringify(chooseEditor(engine, seed)) !==
            JSON.stringify(defaultEditor(engine))
          )
            other++;
      });
      expect(other / 400).toBeGreaterThan(0.4);
      expect(other / 400).toBeLessThan(0.6);
      withEnv("CMB6_SOAK_OPTIONS", "0", () => {
        for (let seed = 0; seed < 100; seed++)
          expect(chooseEditor(engine, seed)).toEqual(defaultEditor(engine));
      });
    }
  });
  test("every option takes both its values over the seeds", () => {
    const seen: Record<string, Set<unknown>> = {};
    for (let seed = 0; seed < 600; seed++)
      for (const [k, v] of Object.entries(chooseEditor("jsdom", seed)))
        (seen[k] ??= new Set()).add(v);
    for (const [k, vs] of Object.entries(seen))
      expect([k, vs.size > 1]).toEqual([k, true]);
    expect(seen.activityLimit.has(null)).toBe(true);
  });
  test("about 40% of the sequences parse incrementally (freshParseBelow 0) so the guards keep being soaked", () => {
    let zero = 0;
    withEnv("CMB6_SOAK_OPTIONS", undefined, () => {
      for (let seed = 0; seed < 400; seed++)
        if (chooseEditor("jsdom", seed).freshParseBelow === 0) zero++;
    });
    expect(zero / 400).toBeGreaterThan(0.3);
    expect(zero / 400).toBeLessThan(0.5);
  });
  test("the options do not change the program or the steps of a seed (the old steps of a seed stay)", () => {
    withEnv("CMB6_SOAK_OPTIONS", "0", () => {
      withEnv("CMB6_SOAK_TOUCH", "0", () => {
        const off = makeSequence("chromium", 12, 30);
        withEnv("CMB6_SOAK_OPTIONS", "1", () => {
          const on = makeSequence("chromium", 12, 30);
          expect({ ...on, editor: undefined }).toEqual({
            ...off,
            editor: undefined,
          });
        });
      });
    });
  });
  test("jsdom has no touch steps; Chromium has them in about 30% of its sequences, as the old ones elsewhere", () => {
    expect(touchShare()).toBe(0.3);
    for (let seed = 0; seed < 40; seed++)
      for (const s of makeSequence("jsdom", seed, 40).steps)
        expect(TOUCH_OPS).not.toContain(s.op);
    let touch = 0;
    for (let seed = 0; seed < 200; seed++)
      if (
        makeSequence("chromium", seed, 40).steps.some((s) =>
          TOUCH_OPS.includes(s.op)
        )
      )
        touch++;
    expect(touch / 200).toBeGreaterThan(0.15);
    expect(touch / 200).toBeLessThan(0.45);
    withEnv("CMB6_SOAK_TOUCH", "0", () => {
      for (let seed = 0; seed < 50; seed++)
        for (const s of makeSequence("chromium", seed, 40).steps)
          expect(TOUCH_OPS).not.toContain(s.op);
    });
  });
  test("touch steps keep the shape of the steps they replace, and all four ops appear", () => {
    const seen = new Set<string>();
    withEnv("CMB6_SOAK_TOUCH", "1", () => {
      for (let seed = 0; seed < 60; seed++) {
        const seq = makeSequence("chromium", seed, 60);
        for (const s of seq.steps) {
          if (!TOUCH_OPS.includes(s.op)) continue;
          seen.add(s.op);
          expect(s.a).toBeGreaterThanOrEqual(0);
          expect(s.a).toBeLessThan(1);
          if (s.op === "touchDrag")
            expect(["gap", "block", "whitespace", "end", "trash"]).toContain(
              s.where
            );
          if (s.op === "swipe") expect(["up", "down"]).toContain(s.dir);
        }
      }
    });
    expect([...seen].sort()).toEqual([...TOUCH_OPS].sort());
  });
});

const withEnvValue = <T>(k: string, v: string, fn: () => T): T => {
  const old = process.env[k];
  process.env[k] = v;
  try {
    return fn();
  } finally {
    if (old === undefined) delete process.env[k];
    else process.env[k] = old;
  }
};

describe("soak generator: long documents and the browser's steps in Chromium (forty-ninth round)", () => {
  const withEnv = (k: string, v: string | undefined, fn: () => void) => {
    const old = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
    try {
      fn();
    } finally {
      if (old === undefined) delete process.env[k];
      else process.env[k] = old;
    }
  };
  const longShare = (engine: "jsdom" | "chromium") => {
    let long = 0;
    for (let seed = 0; seed < 300; seed++)
      if (topLevelForms(makeSequence(engine, seed, 1).code) > 60) long++;
    return long / 300;
  };
  test("long documents: 18% for jsdom, 40% for Chromium; the environment sets both, or Chromium alone", () => {
    withEnv("CMB6_SOAK_LONG_DOCS", undefined, () =>
      withEnv("CMB6_SOAK_LONG_DOCS_CHROMIUM", undefined, () => {
        expect(longDocs()).toBe(0.18);
        expect(longDocs("jsdom")).toBe(0.18);
        expect(longDocs("chromium")).toBe(0.4);
        expect(longShare("chromium")).toBeGreaterThan(0.3);
        expect(longShare("chromium")).toBeLessThan(0.5);
      })
    );
    withEnv("CMB6_SOAK_LONG_DOCS", "0.7", () =>
      withEnv("CMB6_SOAK_LONG_DOCS_CHROMIUM", undefined, () => {
        expect(longDocs("jsdom")).toBe(0.7);
        expect(longDocs("chromium")).toBe(0.7);
      })
    );
    withEnv("CMB6_SOAK_LONG_DOCS", "0.7", () =>
      withEnv("CMB6_SOAK_LONG_DOCS_CHROMIUM", "0", () => {
        expect(longDocs("jsdom")).toBe(0.7);
        expect(longDocs("chromium")).toBe(0);
        expect(longShare("chromium")).toBe(0);
      })
    );
  });
  test("jsdom sequences are what they were: no browser step, the same long share", () => {
    for (let seed = 0; seed < 40; seed++)
      for (const s of makeSequence("jsdom", seed, 40).steps)
        expect(BROWSER_OPS).not.toContain(s.op);
    withEnv("CMB6_SOAK_LONG_DOCS", undefined, () =>
      withEnv("CMB6_SOAK_LONG_DOCS_CHROMIUM", undefined, () => {
        expect(longShare("jsdom")).toBeLessThan(0.3);
      })
    );
  });
  test("about 60% of the Chromium sequences have browser steps, all four ops appear, 0 turns them off", () => {
    expect(browserShare()).toBe(0.6);
    const seen = new Set<string>();
    let some = 0;
    for (let seed = 0; seed < 200; seed++) {
      const ops = makeSequence("chromium", seed, 40).steps.map((s) => s.op);
      if (ops.some((o) => BROWSER_OPS.includes(o))) some++;
      ops.filter((o) => BROWSER_OPS.includes(o)).forEach((o) => seen.add(o));
    }
    expect(some / 200).toBeGreaterThan(0.4);
    expect(some / 200).toBeLessThan(0.75);
    expect([...seen].sort()).toEqual([...BROWSER_OPS].sort());
    withEnv("CMB6_SOAK_BROWSER_STEPS", "0", () => {
      for (let seed = 0; seed < 50; seed++)
        for (const s of makeSequence("chromium", seed, 40).steps)
          expect(BROWSER_OPS).not.toContain(s.op);
    });
  });
  test("the steps of a seed that are not browser steps stay as they were", () => {
    for (let seed = 0; seed < 30; seed++) {
      const off = withEnvValue("CMB6_SOAK_BROWSER_STEPS", "0", () =>
        makeSequence("chromium", seed, 40)
      );
      const on = withEnvValue("CMB6_SOAK_BROWSER_STEPS", "1", () =>
        makeSequence("chromium", seed, 40)
      );
      expect(on.code).toBe(off.code);
      expect(on.steps).toHaveLength(off.steps.length);
      on.steps.forEach((s, i) => {
        if (!BROWSER_OPS.includes(s.op)) expect(s).toEqual(off.steps[i]);
      });
    }
  });
  test("browser steps have valid fields", () => {
    const rnd = mulberry32(5);
    for (let i = 0; i < 400; i++) {
      const s = browserStep(rnd);
      expect(BROWSER_OPS).toContain(s.op);
      if (s.op === "resize") {
        for (const k of ["w", "h"]) {
          expect(s[k]).toBeGreaterThanOrEqual(0);
          expect(s[k]).toBeLessThan(1);
        }
        expect(["keep", "on", "off"]).toContain(s.wrap);
      } else if (s.op === "zoom") {
        expect(at(s.z, ZOOM_LEVELS.length)).toBeGreaterThanOrEqual(0);
      } else if (s.op === "ime") {
        expect(["box", "text"]).toContain(s.target);
        expect((s.parts as string[]).length).toBeGreaterThan(0);
        expect(typeof s.final).toBe("string");
        expect(typeof s.cancel).toBe("boolean");
      } else {
        expect([1, 2, 3]).toContain(s.n);
        expect(["copy", "cut"]).toContain(s.how);
        expect(["gap", "block", "over"]).toContain(s.to);
      }
    }
    // (narrow phone widths are in the table, and zoom has fractional levels)
    expect(RESIZE_WIDTHS.filter((w) => w <= 414).length).toBeGreaterThan(2);
    expect(ZOOM_LEVELS.some((z) => z !== Math.round(z))).toBe(true);
  });
});

describe("programs from bug reports", () => {
  it("are used when issue-programs.json sits beside the corpus file, and not otherwise", () => {
    const fs = require("fs") as typeof import("fs");
    const os = require("os") as typeof import("os");
    const path = require("path") as typeof import("path");
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cmb6-issues-"));
    const old = process.env.CMB6_SOAK_CORPUS;
    try {
      fs.writeFileSync(path.join(dir, "corpus-chunks.json"), "{}");
      process.env.CMB6_SOAK_CORPUS = path.join(dir, "corpus-chunks.json");
      const draw = (): string[] => {
        let out: string[] = [];
        jest.isolateModules(() => {
          const gen = require("./soak-gen") as typeof import("./soak-gen");
          out = Array.from({ length: 400 }, (_, i) =>
            gen.randomProgram("python", gen.mulberry32(i + 1))
          );
        });
        return out;
      };
      expect(draw()).not.toContain("issue_program = 1\n");
      fs.writeFileSync(
        path.join(dir, "issue-programs.json"),
        JSON.stringify({ python: ["issue_program = 1\n"] })
      );
      const used = draw().filter((p) => p === "issue_program = 1\n").length;
      // (about one program in ten)
      expect(used).toBeGreaterThan(10);
      expect(used).toBeLessThan(90);
    } finally {
      if (old === undefined) delete process.env.CMB6_SOAK_CORPUS;
      else process.env.CMB6_SOAK_CORPUS = old;
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
