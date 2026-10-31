#!/usr/bin/env node
/**
 * A soak test: run the randomized-sequence tests over and over, on seed after
 * seed, for as long as you like, and keep every failure. It needs no attention
 * and costs nothing while it runs; read soak-results/summary.md afterwards.
 *
 *   npm run soak                       one hour of jsdom sequences (30 steps each)
 *   npm run soak -- --hours 8          overnight
 *   npm run soak -- --e2e --hours 2    the same in Chromium (real input; slower)
 *   npm run soak -- --seed 50000       start somewhere else (it resumes by default)
 *
 * Options: --hours H (default 1), --batches N (stop after N batches), --batch N
 * (sequences per jest run: default 40; for --e2e, seeds per run: default 20),
 * --steps N (jsdom steps per sequence: default 30), --timeout-min N (a batch
 * that takes longer is killed: default 25), --seed N, --fresh (ignore saved
 * progress), --out DIR (default soak-results). Stop it any time with Ctrl-C.
 *
 * A sequence that breaks the editor is a failure. A run that dies without a
 * report (out of memory, a timeout, a crash of node or the browser) is
 * classified, and its seeds are then run one at a time, to find the seed that
 * does it; if none does alone, the batch simply ran out of memory by adding up,
 * and the batch size is halved.
 *
 * It writes, in the output directory: failures.jsonl (one line per failing
 * sequence or crash, with the shrunk steps and a replay command),
 * progress-<mode>.json (where to resume), summary.md (distinct failures, most
 * common first, and the crashes), and logs/ (the output of each crashed run).
 *
 * Run it on a tree that is not being edited: a half-saved file looks like a bug.
 */
/* eslint-disable no-console */
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const lib = require("./soak-lib");

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
};
const flag = (name) => args.includes(`--${name}`);

const e2e = flag("e2e");
const mode = e2e ? "e2e" : "jsdom";
const hours = Number(opt("hours", 1));
const maxBatches = Number(opt("batches", Infinity));
let batchSize = Number(opt("batch", e2e ? 20 : 40));
const steps = Number(opt("steps", 30));
const batchTimeoutMs = Number(opt("timeout-min", 25)) * 60 * 1000;
const singleTimeoutMs = Math.min(batchTimeoutMs, 10 * 60 * 1000);
const root = path.resolve(__dirname, "..");
const out = path.resolve(root, opt("out", "soak-results"));
fs.mkdirSync(path.join(out, "logs"), { recursive: true });

const progressFile = path.join(out, `progress-${mode}.json`);
const failuresFile = path.join(out, "failures.jsonl");
const git = (...a) =>
  spawnSync("git", a, { cwd: root, encoding: "utf8" }).stdout.trim();
const head = git("rev-parse", "--short", "HEAD");
const dirty = git("status", "--porcelain").length > 0;

const saved =
  !flag("fresh") && fs.existsSync(progressFile)
    ? JSON.parse(fs.readFileSync(progressFile, "utf8"))
    : null;
const progress = {
  mode,
  nextSeed: Number(opt("seed", saved?.nextSeed ?? (e2e ? 100 : 10000))),
  sequences: saved?.sequences ?? 0,
  batches: saved?.batches ?? 0,
  failures: saved?.failures ?? 0,
  crashes: saved?.crashes ?? [],
  distinct: saved?.distinct ?? {},
  head,
  dirty,
};
const save = () => {
  fs.writeFileSync(progressFile, JSON.stringify(progress, null, 2));
  const summary = path.join(out, `summary-${mode}.md`);
  fs.writeFileSync(summary, lib.summarize(progress, progress.distinct));
  fs.copyFileSync(summary, path.join(out, "summary.md"));
};
const record = (entry) =>
  fs.appendFileSync(
    failuresFile,
    JSON.stringify({ mode, head, at: new Date().toISOString(), ...entry }) +
      "\n"
  );

let stop = false;
process.on("SIGINT", () => {
  console.log("\nstopping after this batch...");
  stop = true;
});

/** Run `count` seeds from `from`. Returns {passed, failures}, or {crashed, kind, log}. */
const runBatch = (from, count, timeout) => {
  const tmp = path.join(out, `batch-${mode}.json`);
  fs.rmSync(tmp, { force: true });
  let run;
  if (e2e) {
    const seeds = Array.from({ length: count }, (_, i) => from + i).join(",");
    run = spawnSync(
      "npx",
      [
        "playwright",
        "test",
        "-c",
        "packages/codemirror-blocks/playwright.config.ts",
        "random.e2e.ts",
        "--reporter=json",
      ],
      {
        cwd: root,
        env: { ...process.env, CMB_E2E_SEEDS: seeds },
        encoding: "utf8",
        maxBuffer: 1 << 28,
        timeout,
      }
    );
    if (run.stdout) fs.writeFileSync(tmp, run.stdout);
  } else {
    run = spawnSync(
      "npx",
      [
        "jest",
        "packages/codemirror-blocks/spec/random-sequences-test.ts",
        "-t",
        "random sequences of operations",
        "--json",
        `--outputFile=${tmp}`,
      ],
      {
        cwd: root,
        encoding: "utf8",
        maxBuffer: 1 << 28,
        timeout,
        env: {
          ...process.env,
          NODE_OPTIONS: "--max-old-space-size=8192",
          CMB_RANDOM_RUNS: String(count),
          CMB_RANDOM_STEPS: String(steps),
          CMB_RANDOM_SEED: String(from),
        },
      }
    );
  }
  try {
    const json = JSON.parse(fs.readFileSync(tmp, "utf8"));
    return e2e ? lib.readPlaywrightJson(json) : lib.readJestJson(json);
  } catch (_) {
    // no usable report: the run died, or timed out
  }
  const output = `${run.stdout ?? ""}\n${run.stderr ?? ""}`;
  const kind = lib.classifyCrash(run, output);
  const log = path.join(
    out,
    "logs",
    `${kind.split(" ")[0]}-${mode}-${from}-${count}.txt`
  );
  fs.writeFileSync(log, output.slice(-200000));
  return { crashed: true, kind, log };
};

const countFailures = (failures) => {
  for (const f of failures) {
    progress.failures++;
    const sig = lib.signature(f);
    const d = (progress.distinct[sig] ??= { count: 0, example: f });
    d.count++;
    if ((f.shrunkTo ?? 1e9) < (d.example.shrunkTo ?? 1e9)) d.example = f;
    record({ ...f, signature: sig });
  }
};

const started = Date.now();
console.log(
  `soak (${mode}) at ${head}${dirty ? "+changes" : ""}, from seed ${progress.nextSeed}, results in ${out}`
);
let batches = 0;
while (!stop && batches < maxBatches && Date.now() - started < hours * 3600e3) {
  const from = progress.nextSeed;
  const size = batchSize;
  let result = runBatch(from, size, batchTimeoutMs);
  batches++;
  progress.batches++;
  progress.nextSeed = from + size;

  if (result.crashed) {
    // Which seed did it? Run them one at a time. A seed that dies alone is a bug
    // to report; if none does, the batch ran out of memory by adding up.
    console.log(
      `seeds ${from}-${from + size - 1}: ${result.kind} (log: ${result.log}); running them one at a time`
    );
    const crashes = [];
    const alone = { passed: 0, failures: [] };
    for (let seed = from; seed < from + size && !stop; seed++) {
      const single = runBatch(seed, 1, singleTimeoutMs);
      if (single.crashed) {
        crashes.push({
          kind: single.kind,
          seed,
          steps,
          mode,
          log: single.log,
        });
      } else {
        alone.passed += single.passed;
        alone.failures.push(...single.failures);
      }
    }
    if (!crashes.length) {
      crashes.push({
        kind: result.kind,
        seeds: [from, from + size - 1],
        mode,
        log: result.log,
        note: `no single seed does it: the batch of ${size} adds up, so the batch size is halved`,
      });
      batchSize = Math.max(5, Math.floor(size / 2));
    }
    for (const c of crashes) {
      progress.crashes.push({ ...c, at: new Date().toISOString() });
      record({ type: "crash", ...c });
    }
    console.log(
      `  ${crashes.length} crash record(s); ${alone.passed} seeds ran fine on their own`
    );
    result = alone;
  }

  progress.sequences += result.passed + result.failures.length;
  countFailures(result.failures);
  console.log(
    `seeds ${from}-${from + size - 1}: ${result.passed} passed, ${result.failures.length} failed` +
      ` (total ${progress.sequences} run, ${progress.failures} failed, ` +
      `${Object.keys(progress.distinct).length} distinct, ${progress.crashes.length} crashes)`
  );
  save();
}
save();
console.log(
  `done: ${progress.sequences} sequences, ${progress.failures} failures ` +
    `(${Object.keys(progress.distinct).length} distinct), ${progress.crashes.length} crashes. ` +
    `See ${path.join(out, "summary.md")}`
);
