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

const EXAMPLE_CAP = 20;

/** Whether another full record of this signature may still be stored */
function mayStoreExample(distinct, sig, cap = EXAMPLE_CAP) {
  return (distinct[sig]?.count ?? 0) < cap;
}

/** Split the distinct failures into new ones and those matching a known substring */
function splitKnown(distinct, known = []) {
  const fresh = [];
  const old = [];
  for (const entry of Object.entries(distinct)) {
    (known.some((k) => entry[0].includes(k)) ? old : fresh).push(entry);
  }
  const byCount = (a, b) => b[1].count - a[1].count;
  return { fresh: fresh.sort(byCount), known: old.sort(byCount) };
}

/** Steps per sequence for the n-th batch: 20, plus 5 every 300 batches, up to 100 */
function stepsFor(batchIndex, { steps = 30, ramp = false } = {}) {
  return ramp ? Math.min(100, 20 + 5 * Math.floor(batchIndex / 300)) : steps;
}

/**
 * The governor. `cores` is the machine's core count, `others` the cores that
 * programs other than ours are using, `running` our unpaused workers.
 * Returns how many workers should run, and the updated count of quiet samples.
 * The machine is to stay under `load` busy: more load pauses workers at once
 * (never below `min`), and two quiet samples in a row add one (never above `max`).
 */
function decideWorkers({
  cores,
  others,
  running,
  min,
  max,
  quietSamples = 0,
  load = 0.7,
}) {
  const room = Math.floor(load * cores - others);
  const clamp = (n) => Math.max(min, Math.min(max, n));
  if (room < running) return { target: clamp(room), quietSamples: 0 };
  if (room === running) return { target: clamp(running), quietSamples: 0 };
  if (quietSamples + 1 >= 2) {
    return { target: clamp(running + 1), quietSamples: 0 };
  }
  return { target: clamp(running), quietSamples: quietSamples + 1 };
}

/** os.cpus() before and after: how many cores were busy in between, on average */
function busyCores(before, after) {
  let busy = 0;
  let total = 0;
  after.forEach((cpu, i) => {
    const a = cpu.times;
    const b = before[i].times;
    const sum = (t) => t.user + t.nice + t.sys + t.irq + t.idle;
    total += sum(a) - sum(b);
    busy += a.idle - b.idle;
  });
  return total > 0 ? (after.length * (total - busy)) / total : 0;
}

/** The failure to promote: by seed (the latest with a replay) or by signature text */
function findForPromote(records, key) {
  const usable = records.filter((r) => r.replay && r.type !== "crash");
  if (/^\d+$/.test(String(key))) {
    return usable.filter((r) => r.seed === Number(key)).at(-1) ?? null;
  }
  const text = String(key).toLowerCase();
  const hits = usable.filter((r) =>
    String(r.signature ?? "")
      .toLowerCase()
      .includes(text)
  );
  hits.sort((a, b) => (a.shrunkTo ?? 1e9) - (b.shrunkTo ?? 1e9));
  return hits[0] ?? null;
}

/** An `it` for the "sequences that once broke the editor" block, ready to paste */
function promoteCase(record) {
  const { code, language, steps } = JSON.parse(record.replay);
  const title = `seed ${record.seed}: ${record.problem}`.slice(0, 160);
  const indent = (text, by) => text.replace(/\n/g, "\n" + " ".repeat(by));
  return [
    `  it(${JSON.stringify(title)}, () => {`,
    `    check({`,
    `      code: ${JSON.stringify(code)},`,
    ...(language ? [`      language: ${JSON.stringify(language)},`] : []),
    `      steps: ${indent(JSON.stringify(steps, null, 2), 6)},`,
    `    });`,
    `  }, 120_000);`,
  ].join("\n");
}

/** A readable summary: new failures first, most common first, then the known ones */
function summarize(progress, distinct, known = []) {
  const split = splitKnown(distinct, known);
  const lines = [
    `# Soak results`,
    ``,
    `${progress.sequences} sequences run (${progress.mode}), ${progress.failures} failed, ` +
      `${split.fresh.length + split.known.length} distinct failures (${split.known.length} known). Next seed: ${progress.nextSeed}.`,
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
  for (const [sig, d] of split.fresh) {
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
  if (!split.fresh.length) {
    lines.push(
      split.known.length ? `No new failures.` : `No failures so far.`,
      ``
    );
  }
  if (split.known.length) {
    const total = split.known.reduce((n, [, d]) => n + d.count, 0);
    lines.push(
      `<details><summary>Known (${split.known.length} signatures, ${total} failures)</summary>`,
      ``
    );
    for (const [sig, d] of split.known) lines.push(`- ${d.count}x  ${sig}`);
    lines.push(``, `</details>`, ``);
  }
  return lines.join("\n");
}

module.exports = {
  EXAMPLE_CAP,
  busyCores,
  decideWorkers,
  findForPromote,
  mayStoreExample,
  promoteCase,
  splitKnown,
  stepsFor,
  classifyCrash,
  parseJsdomFailure,
  readJestJson,
  readPlaywrightJson,
  signature,
  summarize,
  stripAnsi,
};
