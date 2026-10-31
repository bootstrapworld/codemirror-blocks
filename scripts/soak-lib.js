// Parsing and bookkeeping for scripts/soak.js, kept apart so that it can be tested.

const ESC = String.fromCharCode(27);
const stripAnsi = (s) =>
  String(s).replace(new RegExp(`${ESC}\\[[0-9;]*m`, "g"), "");

/**
 * What the randomized-sequence harness prints when a sequence breaks the editor
 * (see spec/random-sequences-test.ts), as data. Returns null for any other
 * failure message.
 */
function parseJsdomFailure(title, message) {
  const text = stripAnsi(message);
  if (!text.includes("A randomized sequence of operations broke the editor")) {
    return null;
  }
  const seed = /seed (\d+)/.exec(title)?.[1];
  const at = /failed at: (.*)/.exec(text)?.[1] ?? "?";
  const problem = (
    /problem:\s+([^\n]*(?:\n {13}[^\n]*)*)/.exec(text)?.[1] ?? "?"
  )
    .split(/\n\s+/)
    .join(" | ")
    .trim();
  const shrunk = /Shrunk to (\d+) of (\d+) steps/.exec(text);
  const replay = /CMB_RANDOM_REPLAY='(.*)' npx jest/.exec(text)?.[1];
  const ops = [...text.matchAll(/^\s+\d+\. (.*)$/gm)].map((m) => m[1]);
  return {
    kind: "jsdom",
    seed: seed === undefined ? undefined : Number(seed),
    steps: Number(/\((\d+) steps\)/.exec(title)?.[1]) || undefined,
    failedAt: at,
    problem,
    shrunkTo: shrunk ? Number(shrunk[1]) : undefined,
    trace: ops.slice(0, 40),
    replay,
  };
}

/** Failures of the same kind get the same signature, whatever the ids and numbers */
function signature(f) {
  const where = /^step \d+ \((.*)\)$/.exec(f.failedAt)?.[1] ?? f.failedAt;
  const problem = String(f.problem)
    .replace(/\b[0-9a-f]{2,8}\b/g, "#")
    .replace(/\d+/g, "#")
    .slice(0, 120);
  return `${where} :: ${problem}`;
}

/** The results of `jest --json` for the random-sequence spec */
function readJestJson(json) {
  let passed = 0;
  const failures = [];
  for (const file of json.testResults ?? []) {
    for (const t of file.assertionResults ?? []) {
      if (t.status === "passed") passed++;
      if (t.status !== "failed") continue;
      const parsed = parseJsdomFailure(
        t.title,
        (t.failureMessages ?? [])[0] ?? ""
      );
      failures.push(
        parsed ?? {
          kind: "jsdom",
          seed: Number(/seed (\d+)/.exec(t.title)?.[1]) || undefined,
          failedAt: "unparsed",
          problem: stripAnsi((t.failureMessages ?? [])[0] ?? "").slice(0, 400),
        }
      );
    }
  }
  return { passed, failures };
}

/** The results of Playwright's JSON reporter for e2e/random.e2e.ts */
function readPlaywrightJson(json) {
  let passed = 0;
  const failures = [];
  const visit = (suite) => {
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        const result = (test.results ?? []).at(-1);
        if (result?.status === "passed") passed++;
        else if (result) {
          const message = stripAnsi(result.error?.message ?? "no message");
          failures.push({
            kind: "e2e",
            seed: Number(/seed (\d+)/.exec(spec.title)?.[1]) || undefined,
            failedAt:
              /seed \d+ failed after (\d+) steps/.exec(message)?.[0] ?? "e2e",
            problem: message.split("\n").slice(-12).join(" | ").slice(0, 600),
            trace: message.split("\n").slice(0, 40),
          });
        }
      }
    }
    (suite.suites ?? []).forEach(visit);
  };
  (json.suites ?? []).forEach(visit);
  return { passed, failures };
}

/**
 * Why a run that produced no report died. `output` is what it printed, `run` is
 * what spawnSync returned (status, signal, error).
 */
function classifyCrash(run, output) {
  const text = String(output);
  if (
    /heap out of memory|Reached heap limit|Allocation failed|ERR_WORKER_OUT_OF_MEMORY/i.test(
      text
    ) ||
    run.status === 134
  ) {
    return "out-of-memory";
  }
  if (run.error?.code === "ETIMEDOUT" || run.signal === "SIGTERM")
    return "timeout";
  if (run.signal === "SIGKILL") return "killed (probably out of memory)";
  return "crash";
}

/** A readable summary: distinct failures, most common first, with a way to replay each */
function summarize(progress, distinct) {
  const lines = [
    `# Soak results`,
    ``,
    `${progress.sequences} sequences run (${progress.mode}), ${progress.failures} failed, ` +
      `${Object.keys(distinct).length} distinct failures. Next seed: ${progress.nextSeed}.`,
    `Code: ${progress.head}${progress.dirty ? " (with uncommitted changes)" : ""}.`,
    ``,
  ];
  if (progress.crashes?.length) {
    lines.push(
      `## Crashes and memory overflows (${progress.crashes.length})`,
      ``
    );
    for (const c of progress.crashes.slice(-50)) {
      const where =
        c.seed !== undefined
          ? `seed ${c.seed}`
          : `seeds ${c.seeds[0]}-${c.seeds[1]}`;
      lines.push(
        `- ${c.kind}: ${where}${c.log ? ` (log: ${c.log})` : ""}${c.note ? ` - ${c.note}` : ""}`
      );
      if (c.seed !== undefined && c.mode === "jsdom") {
        lines.push(
          `  replay: \`NODE_OPTIONS=--max-old-space-size=8192 CMB_RANDOM_SEED=${c.seed} CMB_RANDOM_RUNS=1 CMB_RANDOM_STEPS=${c.steps} npx jest random-sequences\``
        );
      }
    }
    lines.push(``);
  }
  const entries = Object.entries(distinct).sort(
    (a, b) => b[1].count - a[1].count
  );
  for (const [sig, d] of entries) {
    lines.push(`## ${d.count}x  ${sig}`, ``);
    lines.push(
      `- smallest example: seed ${d.example.seed}, shrunk to ${d.example.shrunkTo ?? "?"} steps`
    );
    if (d.example.replay) {
      lines.push(
        `- replay: \`CMB_RANDOM_REPLAY='${d.example.replay}' npx jest random-sequences\``
      );
    } else if (d.example.seed !== undefined) {
      lines.push(
        `- replay: \`CMB_E2E_SEEDS=${d.example.seed} npm run test:e2e -- random.e2e.ts\``
      );
    }
    lines.push(``);
  }
  if (!entries.length) lines.push(`No failures so far.`, ``);
  return lines.join("\n");
}

module.exports = {
  classifyCrash,
  parseJsdomFailure,
  readJestJson,
  readPlaywrightJson,
  signature,
  summarize,
  stripAnsi,
};
