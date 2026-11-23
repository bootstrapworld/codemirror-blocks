const lib = require("./soak-lib");

describe("parseArgs", () => {
  test("defaults: one hour, both engines, 2-14 workers, a ramp", () => {
    const o = lib.parseArgs([]);
    expect(o).toMatchObject({
      hours: 1,
      engines: ["jsdom", "chromium"],
      minCores: 2,
      maxCores: 14,
      e2eCores: 4,
      ramp: true,
      alternate: false,
      smoke: false,
    });
  });
  test("values, booleans and --x=v", () => {
    const o = lib.parseArgs([
      "--hours",
      "8",
      "--e2e",
      "--seed=50",
      "--skip",
      "a11y,focus",
      "--steps",
      "30",
    ]);
    expect(o.hours).toBe(8);
    expect(o.engines).toEqual(["chromium"]);
    expect(o.seed).toBe(50);
    expect(o.skip).toEqual(["a11y", "focus"]);
    expect(o.steps).toBe(30);
    expect(o.ramp).toBe(false); // (a fixed number of steps turns the ramp off)
  });
  test("--smoke is short and small; --motion is Chromium only; --cores MIN-MAX", () => {
    expect(lib.parseArgs(["--smoke"])).toMatchObject({
      smoke: true,
      maxCores: 2,
      minCores: 1,
    });
    expect(lib.parseArgs(["--smoke"]).hours).toBeLessThan(0.02);
    expect(lib.parseArgs(["--motion"]).engines).toEqual(["chromium"]);
    expect(lib.parseArgs(["--jsdom"]).engines).toEqual(["jsdom"]);
    expect(lib.parseArgs(["--cores", "3-5"])).toMatchObject({
      minCores: 3,
      maxCores: 5,
    });
  });
  test("the triage commands", () => {
    expect(lib.parseArgs(["--promote", "1004"]).promote).toBe("1004");
    expect(lib.parseArgs(["--replay-seed", "7"]).replaySeed).toBe(7);
    expect(lib.parseArgs(["--known", "setsize"]).known).toBe("setsize");
  });
});

describe("signature", () => {
  const base = { engine: "jsdom", invariant: "a11y", op: "textEdit" };
  test("the same kind of failure has the same signature whatever the numbers and the block", () => {
    const a = lib.signature({
      ...base,
      message: "setsize 10 but 9 siblings drawn @ while True | x",
    });
    const b = lib.signature({
      ...base,
      message: "setsize 21 but 20 siblings drawn @ if 41",
    });
    expect(a).toBe(b);
    expect(a).toBe(
      "jsdom :: a11y @ textEdit :: setsize # but # siblings drawn"
    );
  });
  test("a different invariant, op or engine is another signature", () => {
    const m = "x";
    const s = lib.signature({ ...base, message: m });
    expect(lib.signature({ ...base, invariant: "focus", message: m })).not.toBe(
      s
    );
    expect(lib.signature({ ...base, op: "moveNode", message: m })).not.toBe(s);
    expect(lib.signature({ ...base, engine: "chromium", message: m })).not.toBe(
      s
    );
  });
  test("only the first line counts, quoted text and ids are dropped", () => {
    const m = lib.normalizeMessage(
      'the text "(f 1)" differs at 12 (ab12cd)\n    at stack line'
    );
    expect(m).toBe('the text "…" differs at # (#)');
  });
});

describe("results of a worker", () => {
  const lines =
    JSON.stringify({ seed: 1, ok: true }) +
    "\n" +
    JSON.stringify({ seed: 2, invariant: "focus", steps: [{ op: "key" }] }) +
    "\n" +
    '{"seed": 3, "ok"'; // (cut: the worker was killed in the middle of a line)
  test("passed, failed, and what was done", () => {
    const r = lib.readResults(lines);
    expect(r.passed).toBe(1);
    expect(r.failures.map((f) => f.seed)).toEqual([2]);
    expect([...r.done]).toEqual([1, 2]);
  });
  test("the first seed that was not done is the one that was running", () => {
    expect(lib.missingSeeds([1, 2, 3, 4], lib.readResults(lines).done)).toEqual(
      [3, 4]
    );
    expect(lib.readResults("").done.size).toBe(0);
  });
});

describe("crashes", () => {
  test("classified", () => {
    expect(lib.classifyCrash({ status: 134 }, "")).toBe("out-of-memory");
    expect(
      lib.classifyCrash({ status: 1 }, "FATAL ERROR: Reached heap limit")
    ).toBe("out-of-memory");
    expect(lib.classifyCrash({ timedOut: true, signal: "SIGTERM" }, "")).toBe(
      "timeout"
    );
    expect(lib.classifyCrash({ signal: "SIGKILL" }, "")).toMatch(/killed/);
    expect(
      lib.classifyCrash(
        { status: 1 },
        "Target page, context or browser has been closed (chromium)"
      )
    ).toBe("browser-crash");
    expect(lib.classifyCrash({ status: 1 }, "x")).toBe("crash");
  });
});

describe("bookkeeping", () => {
  const distinct = {
    "a :: one": { count: 3, example: {} },
    "b :: two": { count: 5, example: {} },
  };
  test("known failures are set apart, most common first", () => {
    const s = lib.splitKnown(distinct, ["one"]);
    expect(s.fresh.map((e) => e[0])).toEqual(["b :: two"]);
    expect(s.known.map((e) => e[0])).toEqual(["a :: one"]);
    expect(lib.splitKnown(distinct).fresh.map((e) => e[0])).toEqual([
      "b :: two",
      "a :: one",
    ]);
  });
  test("at most 20 full records of a signature", () => {
    expect(lib.mayStoreExample(distinct, "b :: two")).toBe(true);
    expect(lib.mayStoreExample({ s: { count: 20 } }, "s")).toBe(false);
  });
  test("steps ramp up with the batches, less for Chromium", () => {
    expect(lib.stepsFor(0, { ramp: true })).toBe(20);
    expect(lib.stepsFor(300, { ramp: true })).toBe(25);
    expect(lib.stepsFor(99999, { ramp: true })).toBe(100);
    expect(lib.stepsFor(0, { ramp: true, engine: "chromium" })).toBe(15);
    expect(lib.stepsFor(99999, { ramp: true, engine: "chromium" })).toBe(60);
    expect(lib.stepsFor(5, { steps: 33, ramp: false })).toBe(33);
  });
});

describe("the governor", () => {
  const base = { cores: 10, min: 2, max: 8 };
  test("a busy machine pauses workers at once, never below the minimum", () => {
    expect(lib.decideWorkers({ ...base, others: 6, running: 6 }).target).toBe(
      2
    );
    expect(lib.decideWorkers({ ...base, others: 4, running: 6 }).target).toBe(
      3
    );
  });
  test("two quiet samples add one worker, never above the maximum", () => {
    const base = { cores: 20, min: 2, max: 8 };
    const one = lib.decideWorkers({ ...base, others: 0, running: 4 });
    expect(one).toEqual({ target: 4, quietSamples: 1 });
    expect(
      lib.decideWorkers({ ...base, others: 0, running: 4, quietSamples: 1 })
        .target
    ).toBe(5);
    expect(
      lib.decideWorkers({ ...base, others: 0, running: 8, quietSamples: 1 })
        .target
    ).toBe(8);
  });
  test("busy cores from two samples of os.cpus()", () => {
    const cpu = (idle, busy) => ({
      times: { user: busy, nice: 0, sys: 0, irq: 0, idle },
    });
    expect(
      lib.busyCores([cpu(0, 0), cpu(0, 0)], [cpu(50, 50), cpu(100, 0)])
    ).toBeCloseTo(0.5);
  });
});

describe("promote", () => {
  const rec = {
    engine: "jsdom",
    seed: 1004,
    language: "scheme",
    code: "(f 1)",
    steps: [{ op: "key", key: "Delete", a: 0.5 }],
    motion: "full",
    invariant: "focus",
    op: "key",
    message: "keyboard focus is on the page body",
    signature: "jsdom :: focus @ key :: keyboard focus is on the page body",
  };
  test("finds a record by seed (the latest) or by signature text (the shortest)", () => {
    const longer = { ...rec, seed: 9, steps: [...rec.steps, ...rec.steps] };
    expect(
      lib.findForPromote([rec, { ...rec, code: "(g)" }], "1004").code
    ).toBe("(g)");
    expect(lib.findForPromote([longer, rec], "page body").seed).toBe(1004);
    expect(lib.findForPromote([{ ...rec, type: "crash" }], "1004")).toBeNull();
    expect(lib.findForPromote([rec], "nothing like it")).toBeNull();
  });
  test("a jsdom test that replays the steps", () => {
    const t = lib.promoteCase(rec);
    expect(t).toContain("runJsdom(");
    expect(t).toContain('"code": "(f 1)"');
    expect(t).toContain("toBeNull()");
    expect(t).toContain("soak seed 1004: focus after key");
  });
  test("a Chromium test for a Chromium record", () => {
    const t = lib.promoteCase({ ...rec, engine: "chromium" });
    expect(t).toContain("runChromium(browser");
  });
  test("the sequence a worker replays has no result in it", () => {
    expect(Object.keys(lib.sequenceOf(rec)).sort()).toEqual([
      "code",
      "engine",
      "language",
      "motion",
      "seed",
      "steps",
    ]);
  });
});

describe("summarize", () => {
  const ex = {
    seed: 5,
    language: "python",
    steps: [{}, {}],
    originalSteps: 30,
    step: 1,
    message: "boom\nmore",
  };
  const progress = {
    engine: "jsdom",
    sequences: 10,
    failures: 4,
    nextSeed: 99,
    head: "abc",
    dirty: false,
    crashes: [],
  };
  const distinct = {
    "jsdom :: focus @ key :: boom": { count: 4, example: ex },
  };
  test("new failures first, with how to replay and promote", () => {
    const md = lib.summarize(progress, distinct, []);
    expect(md).toContain(
      "10 sequences run, 4 failed, 1 distinct failures (0 known)"
    );
    expect(md).toContain("## 4x  jsdom :: focus @ key :: boom");
    expect(md).toContain("--replay 5");
    expect(md).toContain("--promote 5");
  });
  test("known ones are folded away", () => {
    const md = lib.summarize(progress, distinct, ["boom"]);
    expect(md).toContain("No new failures.");
    expect(md).toContain("<details>");
  });
  test("crashes are listed with the seed", () => {
    const md = lib.summarize(
      {
        ...progress,
        crashes: [{ kind: "timeout", seed: 7, engine: "jsdom", log: "x.txt" }],
      },
      {},
      []
    );
    expect(md).toContain("timeout: seed 7");
  });
});
