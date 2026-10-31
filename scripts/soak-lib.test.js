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
