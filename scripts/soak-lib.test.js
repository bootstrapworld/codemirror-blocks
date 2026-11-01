const lib = require("./soak-lib");

// what spec/random-sequences-test.ts throws when a sequence breaks the editor
const message = [
  "A randomized sequence of operations broke the editor.",
  "  seed:      1004 (30 steps)",
  '  document:  "(f x y)\\n(g z)\\nw"',
  "  failed at: undoing everything",
  "  problem:   Z did not undo",
  "",
  "Shrunk to 2 of 30 steps:",
  '  1. drag toolbar "square" to 1:0',
  '  2. type "7" at 0:3, committed',
  "",
  "Replay just this with:",
  `  CMB_RANDOM_REPLAY='{"code":"(f x)","steps":[{"op":"cut","r":[1,2,3,4]}]}' npx jest random-sequences`,
].join("\n");

describe("reading a failure of the random sequences", () => {
  const f = lib.parseJsdomFailure(
    "seed 1004 (30 steps) keeps the editor consistent, and undoes and redoes cleanly",
    message
  );

  it("gets the seed, where it failed, what was wrong and the shrunk steps", () => {
    expect(f).toMatchObject({
      kind: "jsdom",
      seed: 1004,
      steps: 30,
      failedAt: "undoing everything",
      problem: "Z did not undo",
      shrunkTo: 2,
    });
    expect(f.trace).toEqual([
      'drag toolbar "square" to 1:0',
      'type "7" at 0:3, committed',
    ]);
  });

  it("keeps a replay that can be pasted back", () => {
    expect(JSON.parse(f.replay)).toEqual({
      code: "(f x)",
      steps: [{ op: "cut", r: [1, 2, 3, 4] }],
    });
  });

  it("ignores other failures, and colored text", () => {
    expect(
      lib.parseJsdomFailure("seed 1", "expect(received).toBe(expected)")
    ).toBeNull();
    const colored = `\u001b[31m${message}\u001b[0m`;
    expect(lib.parseJsdomFailure("seed 1 (3 steps)", colored).failedAt).toBe(
      "undoing everything"
    );
  });

  it("gives failures of the same kind one signature, whatever the ids", () => {
    const a = {
      failedAt: "step 4 (cut)",
      problem: "block-node-1ad is not drawn",
    };
    const b = {
      failedAt: "step 9 (cut)",
      problem: "block-node-5f2 is not drawn",
    };
    const c = {
      failedAt: "step 9 (paste)",
      problem: "block-node-5f2 is not drawn",
    };
    expect(lib.signature(a)).toBe(lib.signature(b));
    expect(lib.signature(a)).not.toBe(lib.signature(c));
  });
});

describe("reading a run", () => {
  it("counts the passes and collects the failures from jest's report", () => {
    const report = {
      testResults: [
        {
          assertionResults: [
            { title: "seed 1 (30 steps) keeps", status: "passed" },
            {
              title: "seed 1004 (30 steps) keeps",
              status: "failed",
              failureMessages: [message],
            },
            {
              title: "seed 7 (30 steps) keeps",
              status: "failed",
              failureMessages: ["boom"],
            },
          ],
        },
      ],
    };
    const { passed, failures } = lib.readJestJson(report);
    expect(passed).toBe(1);
    expect(failures.map((x) => [x.seed, x.failedAt])).toEqual([
      [1004, "undoing everything"],
      [7, "unparsed"],
    ]);
  });

  it("collects failures from Playwright's report", () => {
    const report = {
      suites: [
        {
          suites: [
            {
              specs: [
                {
                  title: "random sequence, seed 3",
                  tests: [{ results: [{ status: "passed" }] }],
                },
                {
                  title: "random sequence, seed 5",
                  tests: [
                    {
                      results: [
                        {
                          status: "failed",
                          error: {
                            message:
                              "seed 5 failed after 4 steps:\n  cut\n\nboom",
                          },
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };
    const { passed, failures } = lib.readPlaywrightJson(report);
    expect(passed).toBe(1);
    expect(failures[0]).toMatchObject({
      kind: "e2e",
      seed: 5,
      failedAt: "seed 5 failed after 4 steps",
    });
  });

  it("summarizes distinct failures, most common first, with a replay", () => {
    const f = lib.parseJsdomFailure("seed 1004 (30 steps) x", message);
    const text = lib.summarize(
      {
        sequences: 100,
        failures: 3,
        nextSeed: 10100,
        mode: "jsdom",
        head: "abc123",
        dirty: false,
      },
      { [lib.signature(f)]: { count: 3, example: f } }
    );
    expect(text).toContain("100 sequences run (jsdom), 3 failed, 1 distinct");
    expect(text).toContain("3x  undoing everything :: Z did not undo");
    expect(text).toContain("CMB_RANDOM_REPLAY='");
  });

  it("says so when nothing failed", () => {
    const text = lib.summarize(
      {
        sequences: 5,
        failures: 0,
        nextSeed: 6,
        mode: "jsdom",
        head: "x",
        dirty: true,
      },
      {}
    );
    expect(text).toContain("No failures so far.");
    expect(text).toContain("with uncommitted changes");
  });
});

describe("telling how a run died", () => {
  it("recognizes running out of memory, by what it printed or by the exit code", () => {
    expect(
      lib.classifyCrash(
        { status: 1 },
        "FATAL ERROR: Reached heap limit Allocation failed"
      )
    ).toBe("out-of-memory");
    expect(
      lib.classifyCrash({ status: 1 }, "JavaScript heap out of memory")
    ).toBe("out-of-memory");
    expect(lib.classifyCrash({ status: 134 }, "")).toBe("out-of-memory");
  });

  it("recognizes a timeout, a kill, and any other crash", () => {
    expect(
      lib.classifyCrash({ error: { code: "ETIMEDOUT" }, signal: "SIGTERM" }, "")
    ).toBe("timeout");
    expect(lib.classifyCrash({ signal: "SIGKILL" }, "")).toBe(
      "killed (probably out of memory)"
    );
    expect(lib.classifyCrash({ status: 1 }, "Segmentation fault")).toBe(
      "crash"
    );
  });

  it("lists crashes in the summary, with a replay for one seed", () => {
    const text = lib.summarize(
      {
        sequences: 10,
        failures: 0,
        nextSeed: 5,
        mode: "jsdom",
        head: "x",
        dirty: false,
        crashes: [
          {
            kind: "out-of-memory",
            seed: 42,
            steps: 30,
            mode: "jsdom",
            log: "logs/a.txt",
          },
          { kind: "timeout", seeds: [1, 40], mode: "jsdom", note: "adds up" },
        ],
      },
      {}
    );
    expect(text).toContain("Crashes and memory overflows (2)");
    expect(text).toContain("out-of-memory: seed 42");
    expect(text).toContain(
      "CMB_RANDOM_SEED=42 CMB_RANDOM_RUNS=1 CMB_RANDOM_STEPS=30"
    );
    expect(text).toContain("timeout: seeds 1-40");
  });
});

describe("the governor", () => {
  const base = { cores: 16, min: 2, max: 8, quietSamples: 0 };

  it("pauses surplus workers at once when others use the machine", () => {
    // 70% of 16 is 11.2; others use 9.7, so one worker fits, but never below min
    const d = lib.decideWorkers({ ...base, others: 9.7, running: 6 });
    expect(d).toEqual({ target: 2, quietSamples: 0 });
    expect(lib.decideWorkers({ ...base, others: 7, running: 6 }).target).toBe(
      4
    );
  });

  it("adds one worker only after two quiet samples", () => {
    const first = lib.decideWorkers({ ...base, others: 1, running: 3 });
    expect(first).toEqual({ target: 3, quietSamples: 1 });
    const second = lib.decideWorkers({
      ...base,
      others: 1,
      running: 3,
      quietSamples: first.quietSamples,
    });
    expect(second).toEqual({ target: 4, quietSamples: 0 });
  });

  it("never goes above max or below min", () => {
    expect(
      lib.decideWorkers({ ...base, others: 0, running: 8, quietSamples: 5 })
        .target
    ).toBe(8);
    expect(lib.decideWorkers({ ...base, others: 16, running: 2 }).target).toBe(
      2
    );
    expect(lib.decideWorkers({ ...base, others: 0, running: 0 }).target).toBe(
      2
    );
  });

  it("measures the cores busy between two samples", () => {
    const cpu = (user, idle) => ({
      times: { user, nice: 0, sys: 0, irq: 0, idle },
    });
    const busy = lib.busyCores(
      [cpu(0, 0), cpu(0, 0)],
      [cpu(100, 0), cpu(50, 50)]
    );
    expect(busy).toBeCloseTo(1.5);
  });
});

describe("keeping a soak run bounded and readable", () => {
  it("stores at most 20 full examples per signature", () => {
    const distinct = { a: { count: 19 }, b: { count: 20 } };
    expect(lib.mayStoreExample(distinct, "a")).toBe(true);
    expect(lib.mayStoreExample(distinct, "b")).toBe(false);
    expect(lib.mayStoreExample(distinct, "new")).toBe(true);
  });

  it("puts new signatures first and known ones in a collapsed section", () => {
    const example = { seed: 1, shrunkTo: 2 };
    const distinct = {
      "cut :: old bug": { count: 9, example },
      "paste :: new bug": { count: 1, example },
    };
    const split = lib.splitKnown(distinct, ["old bug"]);
    expect(split.fresh.map((e) => e[0])).toEqual(["paste :: new bug"]);
    expect(split.known.map((e) => e[0])).toEqual(["cut :: old bug"]);
    const text = lib.summarize(
      { sequences: 10, failures: 10, nextSeed: 5, mode: "jsdom" },
      distinct,
      ["old bug"]
    );
    expect(text.indexOf("new bug")).toBeLessThan(text.indexOf("<details>"));
    expect(text).toContain("Known (1 signatures, 9 failures)");
    expect(text).not.toContain("## 9x");
  });

  it("ramps the steps from 20 by 5 every 300 batches, up to 100", () => {
    const f = (n) => lib.stepsFor(n, { ramp: true });
    expect([f(0), f(299), f(300), f(900), f(100000)]).toEqual([
      20, 20, 25, 35, 100,
    ]);
    expect(lib.stepsFor(5000, { steps: 12 })).toBe(12);
  });
});

describe("promoting a failure to a regression test", () => {
  const replay = JSON.stringify({
    code: "(f x)\n(g)",
    steps: [{ op: "cut", r: [1, 2, 3, 4] }],
  });
  const records = [
    { seed: 7, signature: "cut :: bad", problem: "bad", shrunkTo: 3, replay },
    { seed: 9, signature: "cut :: bad", problem: "bad", shrunkTo: 1, replay },
    { type: "crash", seed: 7 },
  ];

  it("finds a failure by seed or by signature text (the smallest)", () => {
    expect(lib.findForPromote(records, "7").shrunkTo).toBe(3);
    expect(lib.findForPromote(records, "CUT").seed).toBe(9);
    expect(lib.findForPromote(records, "nothing")).toBeNull();
  });

  it("prints an it() in the format of the once-broke block", () => {
    expect(lib.promoteCase(records[0])).toBe(
      [
        '  it("seed 7: bad", () => {',
        "    check({",
        '      code: "(f x)\\n(g)",',
        "      steps: [",
        "        {",
        '          "op": "cut",',
        '          "r": [',
        "            1,",
        "            2,",
        "            3,",
        "            4",
        "          ]",
        "        }",
        "      ],",
        "    });",
        "  }, 120_000);",
      ].join("\n")
    );
  });
});
