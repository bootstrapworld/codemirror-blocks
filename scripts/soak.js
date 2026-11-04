#!/usr/bin/env node
/**
 * A soak test: run the randomized-sequence tests over and over, on seed after
 * seed, for as long as you like, and keep every failure. It needs no attention
 * and costs nothing while it runs; read soak-results/summary.md afterwards.
 *
 *   npm run soak                       one hour of jsdom sequences, 2 to 8 workers
 *   npm run soak -- --hours 0          until you stop it (Ctrl-C)
 *   npm run soak -- --alternate        jsdom, plus a Chromium batch every 20th
 *   npm run soak -- --e2e --hours 2    only Chromium (real input; slower)
 *   npm run soak -- --seed 50000       start somewhere else (it resumes by default)
 *   npm run soak -- --known "<text>"   mark failures whose signature has <text> as known
 *   npm run soak -- --promote 1004     print a regression test for seed 1004
 *   npm run soak -- --promote "<text>" ... or for the failure whose signature has <text>
 *
 * Workers: batches run in parallel on disjoint seed ranges, each in one jest
 * process (one core) at low priority (nice -n 19). --cores
 * MIN-MAX (default 2-14) bounds how many run at once. Every --sample-sec seconds
 * (default 10) the governor measures how busy the machine is apart from the
 * workers: to keep it under about 70% it pauses surplus workers at once (SIGSTOP,
 * the whole process group; never fewer than MIN run), and after two quiet
 * samples it resumes or starts one more (SIGCONT; never more than MAX). A
 * paused batch's timeout does not run down. The pids are kept in workers.json,
 * so a runner that was killed hard cannot leave workers stopped: the next start
 * ends them.
 *
 * Other options: --hours H (default 1; 0 = no limit), --batches N (stop after
 * N batches), --batch N (sequences per jest run: default 40; for e2e, seeds per
 * run: default 20), --steps N (jsdom steps per sequence; setting it turns the
 * ramp off), --ramp / --no-ramp (by default 20 steps, plus 5 every 300 batches,
 * up to 100), --alternate with --e2e-every K (default 20; one Chromium batch at
 * a time, in one worker slot), --timeout-min N (running time after which a
 * batch is killed: default 25), --seed N, --fresh (ignore saved progress),
 * --e2e-action-ms N (default 20000: the click and read timeout in Chromium sequences), --e2e-cores N (default 6: at most N workers run at once while a Chromium
 * batch does; the others are paused, then resumed), --status-min N (default 30: a status line every N minutes, also appended to
 * status.log), --field-min N (default 60; 0 = never: every N minutes, and at the start, new bug reports
 * from GitHub are recorded in failures.jsonl by scripts/field-reports.js), --out DIR (default soak-results). Stop it with Ctrl-C (or SIGTERM): it lets
 * the running batches finish, saves, and prints the summary; a second Ctrl-C
 * ends them at once.
 *
 * A sequence that breaks the editor is a failure. A run that dies without a
 * report (out of memory, a timeout, a crash of node or the browser) is
 * classified, and its seeds are then run one at a time, to find the seed that
 * does it; if none does alone, the batch simply ran out of memory by adding up,
 * and the batch size is halved.
 *
 * It writes, in the output directory: failures.jsonl (one line per failing
 * sequence or crash, with the shrunk steps and a replay command; at most 20
 * full records per signature, the rest are only counted), progress-<mode>.json
 * (where to resume, with next seeds kept per mode), summary.md (new failures
 * first, most common first, then the crashes; failures matching a substring in
 * known.json go into a collapsed "known" section), and logs/ (the output of
 * each crashed run).
 *
 * Run it on a tree that is not being edited: a half-saved file looks like a bug.
 */
/* eslint-disable no-console */
const { spawn, spawnSync, execFile } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const lib = require("./soak-lib");

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
};
const flag = (name) => args.includes(`--${name}`);

const root = path.resolve(__dirname, "..");
const out = path.resolve(root, opt("out", "soak-results"));
fs.mkdirSync(path.join(out, "logs"), { recursive: true });
const failuresFile = path.join(out, "failures.jsonl");
const knownFile = path.join(out, "known.json");
const readJson = (file, fallback) =>
  fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : fallback;
const readKnown = () => readJson(knownFile, []);
const readFailures = () =>
  fs.existsSync(failuresFile)
    ? fs
        .readFileSync(failuresFile, "utf8")
        .split("\n")
        .filter(Boolean)
        .map((l) => JSON.parse(l))
    : [];

const git = (...a) =>
  spawnSync("git", a, { cwd: root, encoding: "utf8" }).stdout.trim();
const head = git("rev-parse", "--short", "HEAD");
const dirty = git("status", "--porcelain").length > 0;

// ---- per-mode state ----

const alternate = flag("alternate");
const modeNames = flag("e2e")
  ? ["e2e"]
  : alternate
    ? ["jsdom", "e2e"]
    : ["jsdom"];
const states = {};
for (const mode of modeNames) {
  const file = path.join(out, `progress-${mode}.json`);
  const saved =
    !flag("fresh") && fs.existsSync(file)
      ? JSON.parse(fs.readFileSync(file, "utf8"))
      : null;
  const e2e = mode === "e2e";
  states[mode] = {
    file,
    batchSize: Number(opt("batch", e2e ? 20 : 40)),
    progress: {
      mode,
      nextSeed: Number(opt("seed", saved?.nextSeed ?? (e2e ? 100 : 10000))),
      sequences: saved?.sequences ?? 0,
      batches: saved?.batches ?? 0,
      failures: saved?.failures ?? 0,
      crashes: saved?.crashes ?? [],
      loadFlakes: saved?.loadFlakes ?? 0,
      distinct: saved?.distinct ?? {},
      head,
      dirty,
    },
  };
}

const save = () => {
  for (const mode of modeNames) {
    const { file, progress } = states[mode];
    fs.writeFileSync(file, JSON.stringify(progress, null, 2));
    fs.writeFileSync(
      path.join(out, `summary-${mode}.md`),
      lib.summarize(progress, progress.distinct, readKnown())
    );
  }
  fs.writeFileSync(
    path.join(out, "summary.md"),
    modeNames
      .map((m) => fs.readFileSync(path.join(out, `summary-${m}.md`), "utf8"))
      .join("\n")
  );
};

// ---- commands that run nothing ----

if (opt("known", undefined) !== undefined) {
  const text = opt("known", "");
  const known = readKnown();
  if (text && !known.includes(text)) known.push(text);
  fs.writeFileSync(knownFile, JSON.stringify(known, null, 2));
  for (const mode of ["jsdom", "e2e"]) {
    const file = path.join(out, `progress-${mode}.json`);
    if (!fs.existsSync(file)) continue;
    const p = readJson(file, null);
    fs.writeFileSync(
      path.join(out, `summary-${mode}.md`),
      lib.summarize(p, p.distinct, known)
    );
  }
  const parts = ["jsdom", "e2e"]
    .map((m) => path.join(out, `summary-${m}.md`))
    .filter((f) => fs.existsSync(f));
  fs.writeFileSync(
    path.join(out, "summary.md"),
    parts.map((f) => fs.readFileSync(f, "utf8")).join("\n")
  );
  console.log(`known: ${JSON.stringify(known)}; summary regenerated`);
  process.exit(0);
}
if (opt("promote", undefined) !== undefined) {
  const record = lib.findForPromote(readFailures(), opt("promote", ""));
  if (!record) {
    console.error(`no failure with a replay matches "${opt("promote", "")}"`);
    process.exit(1);
  }
  console.log(lib.promoteCase(record));
  process.exit(0);
}

// ---- settings ----

const [minCores, maxCores] = String(opt("cores", "2-14"))
  .split("-")
  .map(Number);
const hours = Number(opt("hours", 1));
const maxBatches = Number(opt("batches", Infinity));
const explicitSteps = opt("steps", undefined) !== undefined;
const ramp = flag("ramp") || (!flag("no-ramp") && !explicitSteps);
const fixedSteps = Number(opt("steps", 30));
const e2eEvery = Number(opt("e2e-every", 20));
// while a Chromium batch runs, at most this many workers run at once: browsers
// flake when the machine is crowded
const e2eCores = Number(opt("e2e-cores", 6));
const batchTimeoutMs = Number(opt("timeout-min", 25)) * 60 * 1000;
/** A click or read in a Chromium sequence: longer than the suite's, as the machine is busy */
const e2eActionMs = Number(opt("e2e-action-ms", 20000));
const singleTimeoutMs = Math.min(batchTimeoutMs, 10 * 60 * 1000);
const sampleMs = Number(opt("sample-sec", 10)) * 1000;
const workersFile = path.join(out, "workers.json");

const stamp = () => new Date().toTimeString().slice(0, 8);
const log = (text) => console.log(`[${stamp()}] ${text}`);

// ---- leftovers of a runner that was killed hard ----

const group = (pid, sig) => {
  try {
    process.kill(-pid, sig);
    return true;
  } catch (_) {
    return false;
  }
};
for (const pid of readJson(workersFile, [])) {
  const cmd = spawnSync("ps", ["-o", "command=", "-p", String(pid)], {
    encoding: "utf8",
  }).stdout;
  if (/jest|playwright|npx|node/.test(cmd)) {
    log(`ending leftover worker ${pid} of an earlier run`);
    group(pid, "SIGCONT");
    group(pid, "SIGTERM");
  }
}

// ---- workers ----

// nice, not `taskpolicy -b`: background QoS keeps a process on the efficiency
// cores of Apple silicon (4 of 16 on an M3 Max) however many workers there are
const lowPriority = ["nice", "-n", "19"];

/** A job is one batch (with its one-at-a-time reruns if it crashes): one slot */
const jobs = new Set();
const writeWorkers = () =>
  fs.writeFileSync(
    workersFile,
    JSON.stringify(
      [...jobs].map((j) => j.child?.pid).filter((p) => p !== undefined)
    )
  );

const record = (mode, entry) =>
  fs.appendFileSync(
    failuresFile,
    JSON.stringify({ mode, head, at: new Date().toISOString(), ...entry }) +
      "\n"
  );

/**
 * Run one jest or Playwright process for `count` seeds from `from`, as part of
 * `job`. Resolves to {passed, failures}, or {crashed, kind, log}.
 */
const runBatch = (job, mode, from, count, steps, timeout) =>
  new Promise((resolve) => {
    const e2e = mode === "e2e";
    const tmp = path.join(out, `batch-${mode}-${from}-${count}.json`);
    fs.rmSync(tmp, { force: true });
    const seeds = Array.from({ length: count }, (_, i) => from + i).join(",");
    const cmd = e2e
      ? [
          "npx",
          "playwright",
          "test",
          "-c",
          "packages/codemirror-blocks/playwright.config.ts",
          "random.e2e.ts",
          "--reporter=json",
        ]
      : [
          "npx",
          "jest",
          "packages/codemirror-blocks/spec/random-sequences-test.ts",
          "-t",
          "random sequences of operations",
          "--runInBand",
          "--json",
          `--outputFile=${tmp}`,
        ];
    const env = e2e
      ? {
          ...process.env,
          CMB_E2E_SEEDS: seeds,
          CMB_E2E_ACTION_TIMEOUT: String(e2eActionMs),
        }
      : {
          ...process.env,
          NODE_OPTIONS: "--max-old-space-size=8192",
          CMB_RANDOM_RUNS: String(count),
          CMB_RANDOM_STEPS: String(steps),
          CMB_RANDOM_SEED: String(from),
        };
    const [bin, ...rest] = [...lowPriority, ...cmd];
    const child = spawn(bin, rest, {
      cwd: root,
      env,
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    job.child = child;
    job.ranMs = 0;
    job.since = job.paused ? null : Date.now();
    job.timeout = timeout;
    job.timedOut = false;
    if (job.paused) group(child.pid, "SIGSTOP");
    writeWorkers();
    let stdout = "";
    let stderr = "";
    const keep = e2e ? 1 << 28 : 400000;
    child.stdout.on("data", (d) => (stdout = (stdout + d).slice(-keep)));
    child.stderr.on("data", (d) => (stderr = (stderr + d).slice(-400000)));
    const finish = (status, signal, error) => {
      job.child = null;
      writeWorkers();
      if (e2e && stdout) fs.writeFileSync(tmp, stdout);
      try {
        const json = JSON.parse(fs.readFileSync(tmp, "utf8"));
        fs.rmSync(tmp, { force: true });
        return resolve(
          e2e ? lib.readPlaywrightJson(json) : lib.readJestJson(json)
        );
      } catch (_) {
        // no usable report: the run died, or timed out
      }
      fs.rmSync(tmp, { force: true });
      const output = `${stdout}\n${stderr}`;
      const kind = lib.classifyCrash(
        { status, signal, error: job.timedOut ? { code: "ETIMEDOUT" } : error },
        output
      );
      const file = path.join(
        out,
        "logs",
        `${kind.split(" ")[0]}-${mode}-${from}-${count}.txt`
      );
      fs.writeFileSync(file, output.slice(-200000));
      resolve({ crashed: true, kind, log: file });
    };
    child.on("error", (e) => finish(null, null, e));
    child.on("close", (status, signal) => finish(status, signal));
  });

const pause = (job) => {
  job.paused = true;
  if (job.child) {
    job.ranMs += Date.now() - job.since;
    job.since = null;
    group(job.child.pid, "SIGSTOP");
  }
};
const resume = (job) => {
  job.paused = false;
  if (job.child) {
    job.since = Date.now();
    group(job.child.pid, "SIGCONT");
  }
};
/**
 * Running time only: a paused batch's clock stands still, and so does it while
 * the computer sleeps (a long gap between two ticks is the machine being
 * asleep, not a batch that hangs)
 */
let lastTick = Date.now();
const checkTimeouts = () => {
  const now = Date.now();
  const gap = now - lastTick;
  lastTick = now;
  if (gap > 10000) {
    for (const job of jobs) if (job.child && !job.paused) job.since += gap;
  }
  for (const job of jobs) {
    if (!job.child || job.paused || job.timedOut) continue;
    if (job.ranMs + (Date.now() - job.since) > job.timeout) {
      job.timedOut = true;
      group(job.child.pid, "SIGTERM");
      setTimeout(() => job.child && group(job.child.pid, "SIGKILL"), 10000);
    }
  }
};

// ---- the work of one job ----

let stopping = false;
let hardStop = false;

const countFailures = (state, failures) => {
  const { progress } = state;
  for (const f of failures) {
    progress.failures++;
    const sig = lib.signature(f);
    const store = lib.mayStoreExample(progress.distinct, sig);
    const d = (progress.distinct[sig] ??= { count: 0, example: f });
    d.count++;
    if ((f.shrunkTo ?? 1e9) < (d.example.shrunkTo ?? 1e9)) d.example = f;
    if (store) record(progress.mode, { ...f, signature: sig });
  }
};

const doJob = async (job, mode, from, size, steps) => {
  const state = states[mode];
  const { progress } = state;
  let result = await runBatch(job, mode, from, size, steps, batchTimeoutMs);
  if (result.crashed && hardStop) return; // ended by hand: not a finding
  if (result.crashed) {
    // Which seed did it? Run them one at a time. A seed that dies alone is a bug
    // to report; if none does, the batch ran out of memory by adding up.
    log(
      `${mode} seeds ${from}-${from + size - 1}: ${result.kind} (log: ${result.log}); running them one at a time`
    );
    const crashes = [];
    const alone = { passed: 0, failures: [] };
    for (let seed = from; seed < from + size && !hardStop; seed++) {
      const single = await runBatch(job, mode, seed, 1, steps, singleTimeoutMs);
      if (single.crashed) {
        crashes.push({ kind: single.kind, seed, steps, mode, log: single.log });
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
      state.batchSize = Math.max(5, Math.floor(size / 2));
    }
    for (const c of crashes) {
      progress.crashes.push({ ...c, at: new Date().toISOString() });
      record(mode, { type: "crash", ...c });
    }
    log(
      `  ${crashes.length} crash record(s); ${alone.passed} seeds ran fine on their own`
    );
    result = alone;
  }
  if (mode === "e2e" && !hardStop && result.failures.length) {
    // A Chromium failure may only be the machine being busy: run each once more,
    // by itself in this slot. It counts as a failure only if it fails again.
    const again = [];
    for (const f of result.failures) {
      const rerun =
        f.seed === undefined || hardStop
          ? null
          : await runBatch(job, mode, f.seed, 1, steps, singleTimeoutMs);
      if (rerun && !rerun.crashed && !rerun.failures.length) {
        progress.loadFlakes = (progress.loadFlakes ?? 0) + 1;
        log(
          `  e2e seed ${f.seed} failed under load but passed again: a load flake`
        );
      } else {
        again.push(f);
      }
    }
    result = {
      ...result,
      passed: result.passed + (result.failures.length - again.length),
      failures: again,
    };
  }
  progress.sequences += result.passed + result.failures.length;
  countFailures(state, result.failures);
  log(
    `${mode} seeds ${from}-${from + size - 1}: ${result.passed} passed, ${result.failures.length} failed` +
      ` (total ${progress.sequences} run, ${progress.failures} failed = ` +
      `${((100 * progress.failures) / Math.max(1, progress.sequences)).toFixed(2)}%, ` +
      `${Object.keys(progress.distinct).length} distinct, ${progress.crashes.length} crashes)`
  );
  save();
};

// ---- scheduling and the governor ----

const started = Date.now();
let startedBatches = 0;
let lastE2e = 0;
let target = Math.max(1, minCores);
/** The most workers to run now: fewer while a Chromium batch is running */
const ceiling = () =>
  [...jobs].some((j) => j.mode === "e2e")
    ? Math.max(1, Math.min(maxCores, e2eCores))
    : maxCores;
/** The workers to have running: the governor's target, within the ceiling */
const limit = () => Math.min(target, ceiling());
/** Pause the workers beyond the limit, Chromium batches last of all */
const pauseSurplus = () => {
  const running = [...jobs]
    .filter((j) => !j.paused)
    .sort((a, b) => (a.mode === "e2e") - (b.mode === "e2e"));
  for (const job of running.slice(limit())) pause(job);
};
let quiet = 0;
let lastReport = "";
let finished;

const counts = () => {
  const all = [...jobs];
  return {
    running: all.filter((j) => !j.paused).length,
    paused: all.filter((j) => j.paused).length,
  };
};
const report = (extra = "") => {
  const { running, paused } = counts();
  const line = `workers: ${running} running, ${paused} paused (target ${target}${extra})`;
  if (line.replace(/\(.*/, "") !== lastReport) {
    lastReport = line.replace(/\(.*/, "");
    log(line);
  }
};

const mayStart = () =>
  !stopping &&
  startedBatches < maxBatches &&
  (hours <= 0 || Date.now() - started < hours * 3600e3);

const pump = () => {
  // room first for paused workers, then for new ones
  let { running } = counts();
  for (const job of jobs) {
    if (running >= limit()) break;
    if (job.paused) {
      resume(job);
      running++;
    }
  }
  while (running < limit() && mayStart()) {
    const e2eBusy = [...jobs].some((j) => j.mode === "e2e");
    const wantE2e =
      modeNames.length === 1
        ? modeNames[0] === "e2e"
        : !e2eBusy && startedBatches - lastE2e >= e2eEvery - 1;
    const mode = wantE2e
      ? "e2e"
      : modeNames.includes("jsdom")
        ? "jsdom"
        : "e2e";
    if (mode === "e2e" && e2eBusy) break; // one browser batch at a time
    if (mode === "e2e" && modeNames.length > 1) lastE2e = startedBatches + 1;
    const state = states[mode];
    const from = state.progress.nextSeed;
    const size = state.batchSize;
    const steps = lib.stepsFor(state.progress.batches, {
      steps: fixedSteps,
      ramp,
    });
    state.progress.nextSeed = from + size;
    state.progress.batches++;
    startedBatches++;
    const job = { mode, paused: false, child: null };
    jobs.add(job);
    running++;
    doJob(job, mode, from, size, steps)
      .catch((e) => log(`batch ${mode} ${from} failed to run: ${e.stack}`))
      .then(() => {
        jobs.delete(job);
        writeWorkers();
        report();
        pump();
      });
  }
  pauseSurplus(); // a Chromium batch that has just started lowers the ceiling
  report();
  if (!jobs.size && !mayStart()) finished();
};

const ncpu = os.cpus().length;
let lastCpus = os.cpus();
const sample = () => {
  const cpus = os.cpus();
  const used = lib.busyCores(lastCpus, cpus);
  lastCpus = cpus;
  const { running } = counts();
  // each worker runs on about one core
  const others = Math.max(0, used - running);
  const d = lib.decideWorkers({
    cores: ncpu,
    others,
    running,
    min: minCores,
    max: ceiling(),
    quietSamples: quiet,
  });
  target = d.target;
  quiet = d.quietSamples;
  pauseSurplus();
  report(`, others using ${others.toFixed(1)} of ${ncpu} cores`);
  pump();
};

const stopNow = () => {
  if (stopping) {
    log("again: ending the running batches now");
    hardStop = true;
    for (const job of jobs) {
      if (job.child) {
        group(job.child.pid, "SIGCONT");
        group(job.child.pid, "SIGTERM");
      }
    }
    return;
  }
  stopping = true;
  log(
    "stopping: no new batches; waiting for the running ones (again to end them)"
  );
  for (const job of jobs) resume(job);
  pump();
};
process.on("SIGINT", stopNow);
process.on("SIGTERM", stopNow);

log(
  `soak (${modeNames.join("+")}) at ${head}${dirty ? "+changes" : ""}, ` +
    `${minCores}-${maxCores} workers on ${ncpu} cores (${lowPriority[0]}), ` +
    `seeds ${modeNames.map((m) => `${m} ${states[m].progress.nextSeed}`).join(", ")}, ` +
    `results in ${out}`
);
const startTotals = () => ({
  sequences: modeNames.reduce((n, m) => n + states[m].progress.sequences, 0),
  failures: modeNames.reduce((n, m) => n + states[m].progress.failures, 0),
});
const runStart = startTotals();
const runStartedAt = Date.now();
// a regular line saying how the run is going, kept in status.log too
const status = () => {
  const now = startTotals();
  const distinct = modeNames.reduce(
    (n, m) => n + Object.keys(states[m].progress.distinct).length,
    0
  );
  const crashes = modeNames.reduce(
    (n, m) => n + states[m].progress.crashes.length,
    0
  );
  const loadFlakes = modeNames.reduce(
    (n, m) => n + (states[m].progress.loadFlakes ?? 0),
    0
  );
  const hours = ((Date.now() - runStartedAt) / 3600000).toFixed(1);
  const rate = (failed, run) =>
    run ? `${((100 * failed) / run).toFixed(2)}%` : "n/a";
  const runSeqs = now.sequences - runStart.sequences;
  const runFails = now.failures - runStart.failures;
  const line =
    `status after ${hours} h: ${runSeqs} sequences, ${runFails} failures this run ` +
    `(rate ${rate(runFails, runSeqs)}; ${now.failures} in all, ` +
    `${rate(now.failures, now.sequences)}; ${distinct} distinct), ${crashes} crashes, ${loadFlakes} Chromium load flakes passed on a rerun`;
  log(line);
  fs.appendFileSync(
    path.join(out, "status.log"),
    `${new Date().toISOString()} ${line}\n`
  );
};

// New bug reports from the editor's bug button (and its error notice) go into
// failures.jsonl as kind "field", to be triaged with the soak's own failures.
const fieldReports = () => {
  execFile(
    process.execPath,
    [path.join(__dirname, "field-reports.js"), "--out", out],
    { cwd: root, timeout: 120000 },
    (error, stdout, stderr) => {
      if (error) {
        log(
          `field reports: could not read GitHub (${String(stderr || error.message).split("\n")[0]})`
        );
      } else if (/recorded #/.test(stdout)) {
        log(`field reports: ${stdout.trim().split("\n").pop()}`);
        for (const l of stdout.split("\n"))
          if (l.startsWith("recorded #")) log(`  ${l}`);
      }
    }
  );
};

new Promise((resolve) => {
  finished = resolve;
  const fieldMin = Number(opt("field-min", 60));
  if (fieldMin > 0) {
    fieldReports();
    setInterval(fieldReports, fieldMin * 60000);
  }
  setInterval(sample, sampleMs);
  setInterval(checkTimeouts, 1000);
  setInterval(status, Number(opt("status-min", 30)) * 60000);
  pump();
}).then(() => {
  save();
  fs.rmSync(workersFile, { force: true });
  const total = (key) =>
    modeNames.reduce((n, m) => n + states[m].progress[key], 0);
  const distinct = modeNames.reduce(
    (n, m) => n + Object.keys(states[m].progress.distinct).length,
    0
  );
  console.log(
    `done: ${total("sequences")} sequences, ${total("failures")} failures ` +
      `(${((100 * total("failures")) / Math.max(1, total("sequences"))).toFixed(2)}%, ${distinct} distinct), ${modeNames.reduce((n, m) => n + states[m].progress.crashes.length, 0)} crashes. ` +
      `See ${path.join(out, "summary.md")}`
  );
  process.exit(0);
});
