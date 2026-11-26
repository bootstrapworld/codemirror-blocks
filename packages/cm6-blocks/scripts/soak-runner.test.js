// Tests of the runner's scheduling, lock, evidence records, status table and issue ingestion (scripts/soak-lib.js).
const fs = require("fs");
const os = require("os");
const path = require("path");
const lib = require("./soak-lib");

describe("scheduling defaults", () => {
  test("Chromium gets half of the workers, at most 6; --e2e-cores overrides", () => {
    expect(lib.defaultE2eCores(14)).toBe(6);
    expect(lib.defaultE2eCores(8)).toBe(4);
    expect(lib.defaultE2eCores(2)).toBe(1);
    expect(lib.parseArgs([]).e2eCores).toBe(6);
    expect(lib.parseArgs(["--cores", "2-8"]).e2eCores).toBe(4);
    expect(lib.parseArgs(["--e2e-cores", "3"]).e2eCores).toBe(3);
  });
  test("of the running workers half run Chromium, up to the cap", () => {
    expect(lib.chromiumSlots(8, 6)).toBe(4);
    expect(lib.chromiumSlots(14, 6)).toBe(6);
    expect(lib.chromiumSlots(14, 3)).toBe(3);
    expect(lib.chromiumSlots(1, 6)).toBe(1);
  });
  test("--forever and --hours 0 run until --stop", () => {
    expect(lib.parseArgs(["--forever"])).toMatchObject({
      forever: true,
      hours: 0,
    });
    expect(lib.parseArgs(["--hours", "0"]).forever).toBe(true);
    expect(lib.parseArgs([]).forever).toBe(false);
    expect(lib.parseArgs(["--stop"]).stop).toBe(true);
    expect(lib.parseArgs(["--status"]).status).toBe(true);
  });
});

describe("the lock", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "soak-lock-"));
  afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));
  test("a second soak is refused while the first is alive, and told who holds it", () => {
    const file = path.join(dir, "a.lock");
    expect(lib.acquireLock(file, { pid: 111, alive: () => true })).toEqual({
      ok: true,
    });
    const second = lib.acquireLock(file, { pid: 222, alive: () => true });
    expect(second.ok).toBe(false);
    expect(second.holder.pid).toBe(111);
    expect(lib.describeLock(second.holder)).toContain("pid 111");
  });
  test("a lock of a dead pid is taken over", () => {
    const file = path.join(dir, "b.lock");
    lib.acquireLock(file, { pid: 111, alive: () => true });
    const r = lib.acquireLock(file, { pid: 222, alive: () => false });
    expect(r.ok).toBe(true);
    expect(r.tookOver.pid).toBe(111);
    expect(lib.readLock(file).pid).toBe(222);
  });
  test("a garbled lock file is stale; release only gives back our own", () => {
    const file = path.join(dir, "c.lock");
    fs.writeFileSync(file, "not json");
    expect(lib.acquireLock(file, { pid: 5, alive: () => true }).ok).toBe(true);
    lib.releaseLock(file, 6);
    expect(fs.existsSync(file)).toBe(true);
    lib.releaseLock(file, 5);
    expect(fs.existsSync(file)).toBe(false);
  });
  test("a made-up pid is not alive", () => {
    expect(lib.soakAlive(2 ** 22 + 12345)).toBe(false);
  });
});

describe("evidence records", () => {
  test("a load flake keeps everything needed to replay it", () => {
    const f = {
      seed: 5495,
      language: "scheme",
      code: "(f)\n",
      steps: [{ op: "key" }],
      editor: { lineNumbers: true },
      invariant: "exception",
      message: "x",
    };
    expect(lib.flakeRecord(f)).toMatchObject({ type: "flake", ...f });
    expect(lib.sequenceOf(lib.flakeRecord(f))).toMatchObject({
      seed: 5495,
      code: "(f)\n",
      editor: { lineNumbers: true },
    });
  });
  test("a lost batch keeps its seeds, what is missing and the last progress line", () => {
    const r = lib.lostRecord({
      engine: "jsdom",
      seeds: [1, 2, 3, 4],
      done: new Set([1, 2]),
      kind: "timeout",
      lastLine: '{"seed":2,"ok":true}',
      tail: "x".repeat(5000),
      steps: 30,
      log: "l.txt",
    });
    expect(r).toMatchObject({
      type: "lost",
      seeds: [1, 2, 3, 4],
      missing: [3, 4],
      done: 2,
      lastProgress: '{"seed":2,"ok":true}',
    });
    expect(r.outputTail.length).toBe(3000);
    expect(lib.isKillOrTimeout("timeout")).toBe(true);
    expect(lib.isKillOrTimeout("killed (probably out of memory)")).toBe(true);
    expect(lib.isKillOrTimeout("crash")).toBe(false);
  });
  test("a stuck jsdom failure and any Chromium failure may be load; other jsdom failures are not", () => {
    expect(lib.mayBeLoad({ invariant: "stuck" }, "jsdom")).toBe(true);
    expect(lib.mayBeLoad({ invariant: "focus" }, "chromium")).toBe(true);
    expect(lib.mayBeLoad({ invariant: "focus" }, "jsdom")).toBe(false);
  });
  test("the summary lists load flakes and the batches lost", () => {
    const md = lib.summarize(
      {
        engine: "chromium",
        sequences: 5,
        failures: 0,
        nextSeed: 9,
        head: "h",
        loadFlakes: 1,
        flakes: [
          {
            seed: 5495,
            language: "python",
            invariant: "stuck",
            op: "key",
            message: "slow",
          },
        ],
        lost: 2,
        lostKilled: 1,
        lostTimeouts: 1,
      },
      {},
      []
    );
    expect(md).toContain("seed 5495 (python): stuck after key");
    expect(md).toContain("flakes.jsonl");
    expect(md).toContain("2 batches: 1 killed, 1 timed out");
  });
});

describe("--status", () => {
  test("a markdown table in ASCII, with the distinct failures and a seed", () => {
    const p = {
      engine: "jsdom",
      sequences: 100,
      failures: 3,
      nextSeed: 10100,
      crashes: [{}],
      loadFlakes: 2,
      lost: 1,
      distinct: {
        "jsdom :: focus @ key :: café | boom": {
          count: 3,
          example: { seed: 10042 },
        },
      },
    };
    const md = lib.statusTable({ jsdom: p, chromium: null }, [], null);
    expect(md).toContain("| jsdom | 100 | 3 | 1 | 1 | 2 | 1 | 10100 |");
    expect(md).toContain("seed 10042");
    expect(md).toContain("No soak is running");
    // eslint-disable-next-line no-control-regex
    expect(/^[\x09\x0a\x20-\x7e]*$/.test(md)).toBe(true);
    expect(
      lib.statusTable({ jsdom: p }, [], { pid: 7, startedAt: "t" })
    ).toContain("Soak running: pid 7");
  });
});

describe("bug reports as programs", () => {
  const fence = "```";
  const body = (tag, code, before = "") =>
    `${before}\n${fence}${tag}\n${code}\n${fence}\nmore`;
  test("the first block that looks like a program, with a language from its tag", () => {
    const b = `Error:\n${fence}\nTypeError: x\n    at f (a.js:1:2)\n${fence}\n${body("scheme", "(define (f x) x)")}`;
    expect(lib.programFromIssueBody(b)).toEqual({
      language: "scheme",
      code: "(define (f x) x)\n",
    });
  });
  test("a language from a file name before an untagged block, or from the code", () => {
    expect(
      lib.programFromIssueBody(body("", "def f(x):\n  return x", "see a.py"))
        .language
    ).toBe("python");
    expect(
      lib.programFromIssueBody(body("", "function f(a) { return a; }")).language
    ).toBe("javascript");
    expect(lib.languageOfBlock("", "1 2 3", "in demo.rkt")).toBe("scheme");
  });
  test("logs, stacks, shell sessions and JSON are not programs; no language: skipped", () => {
    expect(lib.looksLikeProgram("$ npm test")).toBe(false);
    expect(lib.looksLikeProgram('{"version": "1"}')).toBe(false);
    expect(lib.looksLikeProgram("    at f (a.js:1:2)")).toBe(false);
    expect(lib.programFromIssueBody(body("", "hello world ()"))).toBeNull();
    expect(lib.programFromIssueBody("no code here")).toBeNull();
  });
  test("only issues with a bug label count; duplicates once; only the code and the number are kept", () => {
    const issues = [
      { number: 1, labels: [{ name: "bug" }], body: body("py", "x = (1)") },
      { number: 2, labels: [{ name: "Bug" }], body: body("py", "x = (1)") },
      {
        number: 3,
        labels: [{ name: "question" }],
        body: body("py", "y = (2)"),
      },
      { number: 4, labels: [{ name: "bug" }], body: "words only" },
    ];
    const r = lib.issuePrograms(issues);
    expect(r.programs.python).toEqual(["x = (1)\n"]);
    expect(r.sources).toEqual([{ issue: 1, language: "python" }]);
  });
  test("gh trouble is a message, not a throw; it only lists", () => {
    const calls = [];
    const fake = (cmd, args) => {
      calls.push([cmd, ...args]);
      return {
        status: 1,
        stderr: "gh: To get started with GitHub CLI, run: gh auth login\n",
      };
    };
    expect(lib.fetchIssues(fake).error).toContain("gh auth login");
    expect(
      lib.fetchIssues(() => ({ error: { code: "ENOENT" } })).error
    ).toContain("ENOENT");
    expect(calls[0].slice(0, 3)).toEqual(["gh", "issue", "list"]);
    expect(calls.flat()).not.toContain("create");
    expect(lib.fetchIssues(() => ({ status: 0, stdout: "[]" }))).toEqual({
      issues: [],
    });
  });
});
