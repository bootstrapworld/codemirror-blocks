#!/usr/bin/env node
/**
 * A soak test for the CodeMirror 6 block editor (packages/cm6-blocks): random sequences of operations, over and over, on seed after seed,
 * for as long as you like. Every failure is kept, deduplicated by a signature, with the steps that replay it. It needs no attention; read
 * soak-results/summary.md afterwards.
 *
 * TURN IT ON (from the repository root):
 *
 *   npm run soak -w @bootstrapworld/cm6-blocks -- --smoke              about 30 s, both engines, results in soak-results/smoke
 *   npm run soak -w @bootstrapworld/cm6-blocks -- --hours 8            eight hours, both engines (jsdom and Chromium), 2 to 14 workers
 *   nohup npm run soak -w @bootstrapworld/cm6-blocks -- --hours 8 > /tmp/soak.log 2>&1 &     the same, in the background
 *   npm run soak -w @bootstrapworld/cm6-blocks -- --forever            until you stop it (--hours 0 is the same); stop it with --stop (below)
 *   npm run soak -w @bootstrapworld/cm6-blocks -- --status             a table of what a run (or the last one) has found; changes nothing
 *   npm run soak -w @bootstrapworld/cm6-blocks -- --stop               a clean stop: finishes the running batches, writes the summary
 *
 * ONE SOAK PER RESULTS DIRECTORY. A lock file (soak.lock: pid, start time, arguments) is taken before anything else; a second soak on the same
 * directory refuses to start and says who holds it. A lock whose pid is dead (or is no soak) is stale: the next run takes it over. `--stop`
 * sends SIGINT to the pid in the lock (never to a guessed one) and waits until it is gone; Ctrl-C and `kill <pid>` (SIGINT, SIGTERM) are the
 * same clean stop: no new batches, the running ones finish (a second signal ends them now), then the summary is written.
 *
 * WHAT IT COVERS. Two engines, random language per sequence (scheme, javascript, python) and a random program per sequence (a hand-written
 * one, a generated one, or a piece of a real file from the corpora of scripts/corpus-lib.ts); the step lists are plain data (spec/soak-gen.ts).
 *   jsdom     (spec/soak-jsdom.ts)   the editor's real API and key handlers: keys, edit boxes (accepted and refused text), comments, collapse
 *                                    and expand, text/blocks toggle, undo and redo, search, text edits, top-level typing and paste (the
 *                                    pending box), selection, insert / remove / move / paste / replace, templates, a replaced document.
 *   chromium  (e2e/soak-run.ts)      the demo page with real keys, real pointer drags (a block to a gap, onto a block, to whitespace, to the
 *                                    end, to the trash can; a toolbar template; a multi-selection), typing and paste at the top level, edit
 *                                    boxes, comments (Shift-Ctrl-]), collapse/expand, the text/blocks toggle with the morph on and with
 *                                    reduced motion (some toggles are pressed again in the middle of the morph), undo and redo, search,
 *                                    line numbers (always on in the demo), scrolling.
 * SIZES AND WIDER STEPS (round 46): 18% of the sequences start from a LONG document (60 to 400 top-level forms, so that the viewport virtualizes;
 * fewer steps; in Chromium more scrolling, with a key or the toggle after it: --long-docs F, --no-long-docs); the steps also include
 * multi-line pastes, broken text typed in text mode and back to blocks, undo/redo runs, collapse bursts, multi-select with cut / copy / paste
 * and Delete by key, and comments next to comments (see the header of spec/soak-gen.ts).
 * INVARIANTS, checked after EVERY step; the first one that breaks ends the sequence and is reported with the seed and the shrunk steps:
 *   consistency   the blocks and the text agree (checkLezerEditor: the DOM against a fresh drawing, the tree against the text)
 *   reparse       (jsdom) the text read again by a fresh editor gives the same blocks as the ones shown
 *   focus         after the first focus, keyboard focus is never on the page body, on a detached element or outside the editor
 *   undo-all      undoing every step returns to the starting text; redo-all: redoing as many restores the end
 *   exception     no uncaught exception, no console.error / console.warn, no API call that throws except its documented refusals
 *   a11y          aria-posinset / setsize / expanded / selected / label of every block (and in Chromium, the accessibility tree: names, levels)
 *   line-numbers  (Chromium) each line number sits beside its first block, in blocks and in text mode
 *   selection     every selected and the focused block is in the tree
 *   stuck         a step takes longer than 10 s (jsdom) / 30 s (Chromium), or the page stops answering; a worker that never comes back is
 *                 killed after --timeout-min and the seed that was running is recorded as a "timeout" crash
 * EDITOR OPTIONS AND TOUCH (round 47): half of the sequences create the editor with other options than the default (line numbers, line
 * wrapping, collapseAll, the four "for measuring" switches off, a small activity limit; stored as `editor` in the record, so --replay and
 * --promote reproduce them; CMB6_SOAK_OPTIONS=0 turns it off). 30% of the Chromium sequences are touch sequences (taps, a long press and a
 * drag with a finger, a long press that lets go, a quick swipe that must not drag; CMB6_SOAK_TOUCH=0 turns it off), with real touch events.
 * WHAT IT CANNOT DO: see a screen (no pixels are compared), use a real screen reader, a phone (touch is emulated), a browser other than
 * Chromium, or a Mac's native key events; and the invariants say nothing about WHAT an operation should do, only that the editor stays
 * whole (a drop that puts the block in the wrong place is not a failure).
 *
 * FLAGS (all optional):
 *   --hours H            how long to start new batches (default 1; 0 or --forever = until --stop)
 *   --smoke              about 30 s, small batches, results in soak-results/smoke
 *   --jsdom | --e2e      only that engine (default: both; --e2e is Chromium)
 *   --alternate          jsdom, plus ONE Chromium batch at a time, every --e2e-every (20th) batch (instead of both at once)
 *   --motion             Chromium only, with the text/blocks toggle favoured and motion on in most sequences; results in soak-results/motion
 *   --language L         scheme, javascript or python (default: random per sequence)
 *   --long-docs F        the fraction F (0 to 1) of sequences that start from a LONG document of 60 to 400 top-level forms (default 0.18; 0 or
 *                        --no-long-docs: only small programs). A long document gets fewer steps, and in Chromium more scrolling
 *   --seed N             start there (it resumes where it stopped by default); --fresh forgets the saved progress
 *   --steps N            steps per sequence (default: a ramp, 20 and up to 100 for jsdom, 15 up to 60 for Chromium)
 *   --batch N            seeds per worker process (default 40 for jsdom, 6 for Chromium); --batches N stops after N batches
 *   --cores MIN-MAX      workers at once (default 2-14: jsdom may use all of them); --e2e-cores N: at most N of them Chromium (default: half
 *                        of MAX and no more than 6, so 6; Chromium flaked under load at 10 workers). Of the workers that run, half run
 *                        Chromium (4 of 8) up to that cap, the rest jsdom
 *   --ingest-issues      first read the open issues of bootstrapworld/codemirror-blocks that have a "bug" label (READ-ONLY: gh issue list),
 *                        take the first code block of each that looks like a program (language from its tag or a file name) and write them
 *                        to <out>/issue-programs.json (+ issue-programs.sources.json, the issue numbers) for the generator; gh missing, not
 *                        logged in or offline: a message, and the run goes on. --ingest-only does just that and exits
 *   --skip a11y,focus    do not check these invariants (a known finding that hides others)
 *   --shrink-runs N      tries to shorten a failing sequence (default 60 jsdom, 12 Chromium)
 *   --timeout-min N      a worker that runs this long (default 25 min of running time) is killed
 *   --port N             the port of the page server for Chromium (default: a free one; 8177 is refused: it is the dev server's)
 *   --no-build           do not run `npm run build:min` first (Chromium uses demo/demo.js as it is)
 *   --out DIR            results directory (default soak-results, git-ignored)
 *   --status-min N       a status line every N minutes (default 30; also in status.log)
 *
 * TRIAGE (the commands that run nothing else):
 *   cat soak-results/summary.md                       new failures first, most common first, then crashes, then the known ones
 *   npm run soak -w @bootstrapworld/cm6-blocks -- --replay 10042            replay the record of seed 10042 (or `--replay "<signature text>"`)
 *   npm run soak -w @bootstrapworld/cm6-blocks -- --replay-seed 10042 --jsdom     run seed 10042 again from scratch (for a crash, which has no steps)
 *   npm run soak -w @bootstrapworld/cm6-blocks -- --promote 10042           print a regression test for the seed (paste it into
 *                                                                           spec/soak-regressions.test.ts or e2e/soak-regressions.e2e.ts)
 *   npm run soak -w @bootstrapworld/cm6-blocks -- --known "<text>"          mark failures whose signature contains <text> as known
 * Files in the results directory: failures.jsonl (a line per failing sequence: engine, seed, language, program, shrunk steps, invariant, message;
 * at most 20 full records per signature, the rest are only counted), progress-<engine>.json, summary.md, status.log, known.json, logs/ (the
 * output of each crashed worker), workers.json (the pids; a runner that was killed hard cannot leave workers stopped: the next start ends them),
 * soak.lock, flakes.jsonl (the FULL record of every load flake: a failure that passed when run again alone, so it can still be replayed: copy
 * its line into failures.jsonl), lost.jsonl (a batch whose worker was killed or timed out: its seeds, how far it got, the last progress line
 * and the tail of the output; the summary counts them), issue-programs.json (from --ingest-issues).
 *
 * HOW IT RUNS: batches of seeds run in parallel in worker processes (jest for jsdom, Playwright for Chromium) on disjoint seed ranges, at low
 * priority (nice 19). A governor measures every 10 s how busy the machine is apart from the workers and pauses surplus workers (SIGSTOP) to keep
 * it under about 70%, and starts or resumes one more after two quiet samples. A worker that dies without a report is a crash: the seed that was
 * running is run once more alone, and recorded if it dies again; the rest of the batch is run again. A Chromium failure, and a jsdom "stuck"
 * (a step too slow by the clock, which depends on how busy the machine is), is run once more alone and counts only if it fails again. Run it on a tree that is not being edited: a half-saved file looks like a bug.
 */
/* eslint-disable no-console */
const { spawn, spawnSync } = require("child_process");
const fs = require("fs");
const http = require("http");
const net = require("net");
const os = require("os");
const path = require("path");
const lib = require("./soak-lib");

const opts = lib.parseArgs(process.argv.slice(2));
// (the fraction of long documents: the workers read it from the environment, spec/soak-gen.ts `longDocs`)
if (opts.longDocs !== undefined)
  process.env.CMB6_SOAK_LONG_DOCS = String(opts.longDocs);
const pkg = path.resolve(__dirname, "..");
const repo =
  spawnSync("git", ["rev-parse", "--show-toplevel"], {
    cwd: pkg,
    encoding: "utf8",
  }).stdout.trim() || path.resolve(pkg, "../..");
if (opts.help) {
  const src = fs.readFileSync(__filename, "utf8");
  console.log(
    src.slice(src.indexOf("/**") + 4, src.indexOf("*/")).replace(/^ \* ?/gm, "")
  );
  process.exit(0);
}
const out = path.resolve(
  pkg,
  opts.out ??
    (opts.smoke
      ? "soak-results/smoke"
      : opts.motion
        ? "soak-results/motion"
        : "soak-results")
);
fs.mkdirSync(path.join(out, "logs"), { recursive: true });
const failuresFile = path.join(out, "failures.jsonl");
const knownFile = path.join(out, "known.json");
const workersFile = path.join(out, "workers.json");
const readJson = (file, fallback) => {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (_) {
    return fallback;
  }
};
const readFailures = () =>
  fs.existsSync(failuresFile)
    ? fs
        .readFileSync(failuresFile, "utf8")
        .split("\n")
        .filter(Boolean)
        .map((l) => JSON.parse(l))
    : [];
const git = (...a) =>
  spawnSync("git", a, { cwd: pkg, encoding: "utf8" }).stdout.trim();
const head = git("rev-parse", "--short", "HEAD");
const dirty = git("status", "--porcelain").length > 0;
const stamp = () => new Date().toTimeString().slice(0, 8);
const log = (text) => console.log(`[${stamp()}] ${text}`);
const engines = opts.engines;
const modeFile = (e) => path.join(out, `progress-${e}.json`);
const lockFile = path.join(out, "soak.lock");
const writeSummaries = (progressByEngine, known) => {
  const parts = [];
  for (const e of Object.keys(progressByEngine)) {
    const p = progressByEngine[e];
    const md = lib.summarize(p, p.distinct, known);
    fs.writeFileSync(path.join(out, `summary-${e}.md`), md);
    parts.push(md);
  }
  fs.writeFileSync(path.join(out, "summary.md"), parts.join("\n"));
};
const savedProgress = () =>
  Object.fromEntries(
    ["jsdom", "chromium"]
      .filter((e) => fs.existsSync(modeFile(e)))
      .map((e) => [e, readJson(modeFile(e), null)])
  );

// ---- commands that run nothing, or run one sequence ----

/** the lock, if a live soak holds it */
const liveLock = () => {
  const l = lib.readLock(lockFile);
  return l && lib.soakAlive(l.pid) ? l : null;
};
if (opts.status) {
  console.log(
    lib.statusTable(savedProgress(), readJson(knownFile, []), liveLock())
  );
  process.exit(0);
}
if (opts.stop) {
  const holder = liveLock();
  if (!holder) {
    fs.rmSync(lockFile, { force: true });
    console.log(`no soak is running on ${out}`);
    process.exit(0);
  }
  console.log(
    `stopping the soak (${lib.describeLock(holder)}): SIGINT, then waiting until it is gone (it finishes the running batches first)`
  );
  process.kill(holder.pid, "SIGINT");
  const t0 = Date.now();
  let lastSaid = t0;
  setInterval(() => {
    const secs = Math.round((Date.now() - t0) / 1000);
    if (!lib.soakAlive(holder.pid)) {
      console.log(
        `stopped after ${secs} s; see ${path.join(out, "summary.md")}`
      );
      process.exit(0);
    }
    if (Date.now() - lastSaid > 60000) {
      lastSaid = Date.now();
      console.log(`  still running (${secs} s)`);
    }
  }, 500);
  return;
}

if (opts.known !== undefined) {
  const known = readJson(knownFile, []);
  if (opts.known && !known.includes(opts.known)) known.push(opts.known);
  fs.writeFileSync(knownFile, JSON.stringify(known, null, 2));
  writeSummaries(savedProgress(), known);
  console.log(`known: ${JSON.stringify(known)}; summary regenerated`);
  process.exit(0);
}
if (opts.promote !== undefined) {
  const record = lib.findForPromote(readFailures(), opts.promote);
  if (!record) {
    console.error(`no failure with steps matches "${opts.promote}"`);
    process.exit(1);
  }
  console.log(lib.promoteCase(record));
  process.exit(0);
}

const freePort = () =>
  new Promise((resolve, reject) => {
    const s = net.createServer();
    s.listen(0, "127.0.0.1", () => {
      const port = s.address().port;
      s.close(() => resolve(port));
    });
    s.on("error", reject);
  });
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".map": "application/json",
};
/** the demo's static files, in this process (nothing to leave running afterwards) */
const startServer = (port) =>
  new Promise((resolve) => {
    const root = path.join(pkg, "demo");
    const server = http.createServer((req, res) => {
      const name =
        req.url.split("?")[0] === "/" ? "/index.html" : req.url.split("?")[0];
      const file = path.join(root, path.normalize(name));
      if (!file.startsWith(root) || !fs.existsSync(file)) {
        res.writeHead(404).end("not found");
        return;
      }
      res.writeHead(200, {
        "content-type": types[path.extname(file)] || "application/octet-stream",
      });
      fs.createReadStream(file).pipe(res);
    });
    server.listen(port, "127.0.0.1", () => resolve(server));
  });
const lowPriority = ["nice", "-n", "19"];
const jestBin = [
  "npx",
  "jest",
  "packages/cm6-blocks/spec/soak.test.ts",
  "--runInBand",
  "--silent=false",
];
const pwBin = [
  "npx",
  "playwright",
  "test",
  "-c",
  "packages/cm6-blocks/e2e/soak.config.ts",
  `--output=${path.join(out, "pw-output")}`,
];

/** One worker process to completion: resolves {status, signal, output, timedOut} */
const runWorker = (engine, env, { niceness = true, onChild, timeoutMs } = {}) =>
  new Promise((resolve) => {
    const cmd = engine === "chromium" ? pwBin : jestBin;
    const [bin, ...rest] = niceness ? [...lowPriority, ...cmd] : cmd;
    const child = spawn(bin, rest, {
      cwd: repo,
      env: {
        ...process.env,
        NODE_OPTIONS: "--max-old-space-size=8192",
        ...env,
      },
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    onChild?.(child);
    let output = "";
    const keep = (d) => (output = (output + d).slice(-300000));
    child.stdout.on("data", keep);
    child.stderr.on("data", keep);
    let timedOut = false;
    // (only for the reruns, which are not counted by the governor's clock: a worker of a batch is timed by checkTimeouts)
    const timer = timeoutMs
      ? setTimeout(() => {
          timedOut = true;
          group(child.pid, "SIGCONT");
          group(child.pid, "SIGKILL");
        }, timeoutMs)
      : null;
    child.on("error", (e) => {
      clearTimeout(timer);
      resolve({ status: null, signal: null, output: String(e), timedOut });
    });
    child.on("close", (status, signal) => {
      clearTimeout(timer);
      resolve({ status, signal, output, timedOut });
    });
  });

const group = (pid, sig) => {
  try {
    process.kill(-pid, sig);
    return true;
  } catch (_) {
    return false;
  }
};

// ---- replay of one record, or of one seed from scratch ----

const replayEnv = (portStr) => ({
  CMB6_PORT: portStr,
  CMB6_SOAK_CORPUS: path.join(out, "corpus-chunks.json"),
});
const ensureBuilt = () => {
  if (opts.noBuild) return;
  log("building the demo (npm run build:min)");
  const r = spawnSync("npm", ["run", "build:min", "--silent"], {
    cwd: pkg,
    encoding: "utf8",
  });
  if (r.status !== 0) {
    console.error(r.stdout + r.stderr);
    process.exit(1);
  }
};
const needsPort = async () => {
  if (opts.port === 8177) {
    console.error(
      "8177 is the dev server's port: pick another with --port, or leave it to the runner"
    );
    process.exit(1);
  }
  const port = opts.port ?? (await freePort());
  const server = await startServer(port);
  return { port: String(port), server };
};

if (opts.replay !== undefined || opts.replaySeed !== undefined) {
  (async () => {
    let record = null;
    if (opts.replay !== undefined) {
      record = fs.existsSync(opts.replay)
        ? readJson(opts.replay, null)
        : lib.findForPromote(readFailures(), opts.replay);
      if (!record) {
        console.error(
          `no failure with steps matches "${opts.replay}" (in ${failuresFile})`
        );
        process.exit(1);
      }
    }
    const engine = record ? record.engine : opts.engines[0];
    const tmp = path.join(out, `replay-${Date.now()}.json`);
    const env = { ...replayEnv("0") };
    let server = null;
    if (engine === "chromium") {
      ensureBuilt();
      const p = await needsPort();
      server = p.server;
      env.CMB6_PORT = p.port;
    }
    if (record) {
      fs.writeFileSync(tmp, JSON.stringify(lib.sequenceOf(record)));
      env.CMB6_SOAK_REPLAY = tmp;
    } else {
      const seed = opts.replaySeed;
      fs.writeFileSync(
        tmp,
        JSON.stringify({
          seeds: [seed],
          steps: opts.steps ?? 40,
          out: tmp + ".jsonl",
          language: opts.language,
          skip: opts.skip,
          shrinkRuns: 0,
        })
      );
      env.CMB6_SOAK_JOB = tmp;
    }
    const r = await runWorker(engine, env, { niceness: false });
    console.log(r.output.split("\n").slice(-60).join("\n"));
    if (!record && fs.existsSync(tmp + ".jsonl"))
      console.log(fs.readFileSync(tmp + ".jsonl", "utf8").slice(0, 3000));
    server?.close();
    fs.rmSync(tmp, { force: true });
    fs.rmSync(tmp + ".jsonl", { force: true });
    process.exit(r.status === 0 ? 0 : 1);
  })();
  return;
}

// ---- settings ----

const smoke = opts.smoke;
const minCores = opts.minCores;
const maxCores = opts.maxCores;
const batchSize = (e) =>
  opts.batch ??
  (smoke ? (e === "chromium" ? 2 : 4) : e === "chromium" ? 6 : 40);
const stepsOf = (e, batchIndex) =>
  smoke
    ? 12
    : lib.stepsFor(batchIndex, {
        steps: opts.steps ?? 30,
        ramp: opts.ramp,
        engine: e,
      });
const batchTimeoutMs = opts.timeoutMin * 60 * 1000;
const sampleMs = opts.sampleSec * 1000;
const hours = opts.hours;
const shrinkRuns = (e) => opts.shrinkRuns ?? (e === "chromium" ? 12 : 60);

// ---- the lock: one soak per results directory (before anything is changed or ended) ----

const lock = lib.acquireLock(lockFile, { argv: process.argv.slice(2) });
if (!lock.ok) {
  console.error(
    `another soak holds ${lockFile}: ${lib.describeLock(lock.holder)}.\n` +
      `Stop it with: npm run soak -w @bootstrapworld/cm6-blocks -- --stop${opts.out ? ` --out ${opts.out}` : ""}, or use another --out directory.`
  );
  process.exit(1);
}
if (lock.tookOver)
  log(
    `taking over a stale lock (${lib.describeLock(lock.tookOver)}: that process is gone)`
  );
const unlock = () => lib.releaseLock(lockFile);
process.on("exit", unlock);

// ---- bug reports as programs (read-only) ----

const ingestIssues = () => {
  const r = lib.fetchIssues();
  if (r.error) {
    log(`--ingest-issues skipped: ${r.error}`);
    return;
  }
  const { programs, sources } = lib.issuePrograms(r.issues);
  fs.writeFileSync(
    path.join(out, "issue-programs.json"),
    JSON.stringify(programs, null, 2)
  );
  fs.writeFileSync(
    path.join(out, "issue-programs.sources.json"),
    JSON.stringify(sources, null, 2)
  );
  log(
    `--ingest-issues: ${r.issues.length} open issues, ${sources.length} with a bug label and a program (` +
      `${Object.entries(programs)
        .map(([l, a]) => `${l} ${a.length}`)
        .join(", ")}) in ${path.join(out, "issue-programs.json")}`
  );
};
if (opts.ingestIssues || opts.ingestOnly) ingestIssues();
if (opts.ingestOnly) process.exit(0);

// ---- leftovers of a runner that was killed hard ----

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

// ---- per-engine state ----

const states = {};
for (const e of engines) {
  const saved = !opts.fresh && !smoke ? readJson(modeFile(e), null) : null;
  states[e] = {
    batchSize: batchSize(e),
    progress: {
      engine: e,
      nextSeed:
        opts.seed ?? saved?.nextSeed ?? (e === "chromium" ? 100 : 10000),
      sequences: saved?.sequences ?? 0,
      batches: saved?.batches ?? 0,
      failures: saved?.failures ?? 0,
      crashes: saved?.crashes ?? [],
      loadFlakes: saved?.loadFlakes ?? 0,
      flakes: saved?.flakes ?? [],
      lost: saved?.lost ?? 0,
      lostKilled: saved?.lostKilled ?? 0,
      lostTimeouts: saved?.lostTimeouts ?? 0,
      distinct: saved?.distinct ?? {},
      heights: saved?.heights,
      head,
      dirty,
    },
  };
}
const progressAll = () =>
  Object.fromEntries(engines.map((e) => [e, states[e].progress]));
const save = () => {
  for (const e of engines)
    fs.writeFileSync(modeFile(e), JSON.stringify(states[e].progress, null, 2));
  writeSummaries(progressAll(), readJson(knownFile, []));
};
const appendRecord = (file, engine, entry) =>
  fs.appendFileSync(
    path.join(out, file),
    JSON.stringify({ engine, head, at: new Date().toISOString(), ...entry }) +
      "\n"
  );
const record = (engine, entry) => appendRecord("failures.jsonl", engine, entry);

// ---- the jobs ----

const jobs = new Set();
const writeWorkers = () =>
  fs.writeFileSync(
    workersFile,
    JSON.stringify(
      [...jobs].map((j) => j.child?.pid).filter((p) => p !== undefined)
    )
  );
let stopping = false;
let hardStop = false;
let port = "0";
let server = null;
let batchCounter = 0;

/** run the seeds in one worker for `job`; resolves {passed, failures, missing, crash?} */
const runBatch = async (job, engine, seeds, steps, timeoutMs) => {
  const id = `${engine}-${seeds[0]}-${seeds.length}-${++batchCounter}`;
  const jobFile = path.join(out, `job-${id}.json`);
  const resFile = path.join(out, `result-${id}.jsonl`);
  fs.rmSync(resFile, { force: true });
  fs.writeFileSync(
    jobFile,
    JSON.stringify({
      seeds,
      steps,
      out: resFile,
      language: opts.language,
      motion: opts.motion,
      skip: opts.skip,
      shrinkRuns: shrinkRuns(engine),
    })
  );
  const env = { ...replayEnv(port), CMB6_SOAK_JOB: jobFile };
  job.timeout = timeoutMs;
  job.ranMs = 0;
  job.since = job.paused ? null : Date.now();
  const r = await runWorker(engine, env, {
    onChild: (child) => {
      job.child = child;
      if (job.paused) group(child.pid, "SIGSTOP");
      writeWorkers();
    },
  });
  const timedOut = job.timedOut;
  job.timedOut = false;
  job.child = null;
  writeWorkers();
  const resText = fs.existsSync(resFile)
    ? fs.readFileSync(resFile, "utf8")
    : "";
  const res = lib.readResults(resText);
  fs.rmSync(resFile, { force: true });
  fs.rmSync(jobFile, { force: true });
  const missing = lib.missingSeeds(seeds, res.done);
  let crash = null;
  if (missing.length && !hardStop) {
    const kind = lib.classifyCrash(
      { status: r.status, signal: r.signal, timedOut },
      r.output
    );
    const file = path.join(out, "logs", `${kind.split(" ")[0]}-${id}.txt`);
    fs.writeFileSync(file, r.output.slice(-200000));
    crash = { kind, log: file };
    if (lib.isKillOrTimeout(kind)) {
      // (such a worker leaves an empty log: keep what is known about its batch, so that the seeds can be run again by hand)
      const { progress } = states[engine];
      progress.lost++;
      if (kind === "timeout") progress.lostTimeouts++;
      else progress.lostKilled++;
      appendRecord(
        "lost.jsonl",
        engine,
        lib.lostRecord({
          engine,
          seeds,
          done: res.done,
          kind,
          steps,
          lastLine: resText.trim().split("\n").filter(Boolean).at(-1),
          tail: r.output,
          log: file,
        })
      );
    }
  }
  return {
    passed: res.passed,
    failures: res.failures,
    heights: res.heights,
    missing,
    crash,
  };
};

const countFailures = (state, failures) => {
  const { progress } = state;
  for (const f of failures) {
    progress.failures++;
    const sig = lib.signature(f);
    const store = lib.mayStoreExample(progress.distinct, sig);
    const d = (progress.distinct[sig] ??= { count: 0, example: f });
    d.count++;
    if ((f.steps?.length ?? 1e9) < (d.example.steps?.length ?? 1e9))
      d.example = f;
    if (store) record(progress.engine, { ...f, signature: sig });
  }
};

const doJob = async (job, engine, from, size, steps) => {
  const state = states[engine];
  const { progress } = state;
  let seeds = Array.from({ length: size }, (_, i) => from + i);
  let passed = 0;
  let failures = [];
  while (seeds.length && !hardStop) {
    const r = await runBatch(job, engine, seeds, steps, batchTimeoutMs);
    passed += r.passed;
    failures.push(...r.failures);
    for (const x of r.heights)
      lib.addHeights((progress.heights ??= {}), x.seed, x.h);
    if (!r.crash) break;
    const culprit = r.missing[0];
    const rest = r.missing.slice(1);
    log(
      `${engine} seed ${culprit}: ${r.crash.kind} (log: ${r.crash.log}); running it alone`
    );
    if (seeds.length === 1) {
      progress.crashes.push({
        ...r.crash,
        seed: culprit,
        steps,
        engine,
        at: new Date().toISOString(),
      });
      record(engine, {
        type: "crash",
        seed: culprit,
        steps,
        kind: r.crash.kind,
        log: r.crash.log,
      });
      break;
    }
    const alone = await runBatch(
      job,
      engine,
      [culprit],
      steps,
      Math.min(batchTimeoutMs, 10 * 60 * 1000)
    );
    passed += alone.passed;
    failures.push(...alone.failures);
    if (alone.crash) {
      progress.crashes.push({
        ...alone.crash,
        seed: culprit,
        steps,
        engine,
        at: new Date().toISOString(),
      });
      record(engine, {
        type: "crash",
        seed: culprit,
        steps,
        kind: alone.crash.kind,
        log: alone.crash.log,
      });
    } else {
      state.batchSize = Math.max(2, Math.floor(state.batchSize / 2));
      log(
        `  seed ${culprit} runs fine alone: the batch added up (${r.crash.kind}); the batch size is now ${state.batchSize}`
      );
    }
    seeds = rest;
  }
  if (!hardStop && failures.some((f) => lib.mayBeLoad(f, engine))) {
    // A Chromium failure, or a jsdom "stuck" step, may only be the machine being busy: run each once more, alone. It counts only if it
    // fails again; if it passes, its FULL record is kept in flakes.jsonl (it could not be replayed otherwise).
    const again = [];
    for (const f of failures) {
      if (!lib.mayBeLoad(f, engine)) {
        again.push(f);
        continue;
      }
      const tmp = path.join(out, `replay-${f.seed}-${++batchCounter}.json`);
      fs.writeFileSync(tmp, JSON.stringify(lib.sequenceOf(f)));
      const r = await runWorker(
        engine,
        { ...replayEnv(port), CMB6_SOAK_REPLAY: tmp },
        { timeoutMs: 600000 }
      );
      fs.rmSync(tmp, { force: true });
      if (r.status === 0) {
        progress.loadFlakes++;
        passed++;
        appendRecord("flakes.jsonl", engine, lib.flakeRecord(f));
        progress.flakes.push({
          seed: f.seed,
          language: f.language,
          invariant: f.invariant,
          op: f.op,
          message: String(f.message ?? "").slice(0, 300),
        });
        progress.flakes = progress.flakes.slice(-200);
        log(
          `  ${engine} seed ${f.seed} (${f.invariant}) failed under load but passed again: a load flake (kept in flakes.jsonl)`
        );
      } else again.push(f);
    }
    failures = again;
  }
  progress.sequences += passed + failures.length;
  countFailures(state, failures);
  log(
    `${engine} seeds ${from}-${from + size - 1}: ${passed} passed, ${failures.length} failed` +
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
const chromiumCap = opts.alternate ? 1 : Math.max(1, opts.e2eCores);
const limit = () => Math.min(target, maxCores);
const counts = () => ({
  running: [...jobs].filter((j) => !j.paused).length,
  paused: [...jobs].filter((j) => j.paused).length,
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
const pauseSurplus = () => {
  const live = [...jobs]
    .filter((j) => !j.paused)
    .sort((a, b) => (a.engine === "chromium") - (b.engine === "chromium"));
  for (const job of live.slice(limit())) pause(job);
};
let lastTick = Date.now();
const checkTimeouts = () => {
  const now = Date.now();
  const gap = now - lastTick;
  lastTick = now;
  if (gap > 10000)
    for (const job of jobs) if (job.child && !job.paused) job.since += gap; // (the computer slept)
  for (const job of jobs) {
    if (!job.child || job.paused || job.timedOut || !job.timeout) continue;
    if (job.ranMs + (Date.now() - job.since) > job.timeout) {
      job.timedOut = true;
      group(job.child.pid, "SIGTERM");
      setTimeout(() => job.child && group(job.child.pid, "SIGKILL"), 10000);
    }
  }
};
const mayStart = () =>
  !stopping &&
  startedBatches < opts.batches &&
  (hours <= 0 || Date.now() - started < hours * 3600e3);
let finished;
let lastReport = "";
const report = (extra = "") => {
  const { running: r, paused } = counts();
  const line = `workers: ${r} running, ${paused} paused (target ${target}${extra})`;
  if (line.replace(/\(.*/, "") !== lastReport) {
    lastReport = line.replace(/\(.*/, "");
    log(line);
  }
};
const chooseEngine = () => {
  if (engines.length === 1) return engines[0];
  const chromiumRunning = [...jobs].filter(
    (j) => j.engine === "chromium"
  ).length;
  if (opts.alternate)
    return !chromiumRunning && startedBatches - lastE2e >= opts.e2eEvery - 1
      ? "chromium"
      : "jsdom";
  // both at once: Chromium gets half of the slots (4 of 8), at most --e2e-cores (default 6)
  return chromiumRunning < lib.chromiumSlots(limit(), chromiumCap)
    ? "chromium"
    : "jsdom";
};
const pump = () => {
  let { running: r } = counts();
  for (const job of jobs) {
    if (r >= limit()) break;
    if (job.paused) {
      resume(job);
      r++;
    }
  }
  while (r < limit() && mayStart()) {
    const engine = chooseEngine();
    if (engine === "chromium") lastE2e = startedBatches + 1;
    const state = states[engine];
    const from = state.progress.nextSeed;
    const size = state.batchSize;
    const steps = stepsOf(engine, state.progress.batches);
    state.progress.nextSeed = from + size;
    state.progress.batches++;
    startedBatches++;
    const job = { engine, paused: false, child: null, timedOut: false };
    jobs.add(job);
    r++;
    doJob(job, engine, from, size, steps)
      .catch((e) => log(`batch ${engine} ${from} failed to run: ${e.stack}`))
      .then(() => {
        jobs.delete(job);
        writeWorkers();
        report();
        pump();
      });
  }
  pauseSurplus();
  report();
  if (!jobs.size && !mayStart()) finished();
};
const ncpu = os.cpus().length;
let lastCpus = os.cpus();
let quiet = 0;
const sample = () => {
  const cpus = os.cpus();
  const used = lib.busyCores(lastCpus, cpus);
  lastCpus = cpus;
  const { running: r } = counts();
  const others = Math.max(0, used - r);
  const d = lib.decideWorkers({
    cores: ncpu,
    others,
    running: r,
    min: minCores,
    max: maxCores,
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
    for (const job of jobs)
      if (job.child) {
        group(job.child.pid, "SIGCONT");
        group(job.child.pid, "SIGTERM");
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

const totals = (key) =>
  engines.reduce((n, e) => n + states[e].progress[key], 0);
const distinctCount = () =>
  engines.reduce(
    (n, e) => n + Object.keys(states[e].progress.distinct).length,
    0
  );
const status = (startSeqs, startFails, startedAt) => {
  const seqs = totals("sequences") - startSeqs;
  const fails = totals("failures") - startFails;
  const rate = (a, b) => (b ? `${((100 * a) / b).toFixed(2)}%` : "n/a");
  const line =
    `status after ${((Date.now() - startedAt) / 3600000).toFixed(1)} h: ${seqs} sequences, ${fails} failures this run ` +
    `(rate ${rate(fails, seqs)}; ${totals("failures")} in all, ${rate(totals("failures"), totals("sequences"))}; ${distinctCount()} distinct), ` +
    `${engines.reduce((n, e) => n + states[e].progress.crashes.length, 0)} crashes, ` +
    `${totals("loadFlakes")} load flakes passed on a rerun, ${totals("lost")} batches lost to kills and timeouts`;
  log(line);
  fs.appendFileSync(
    path.join(out, "status.log"),
    `${new Date().toISOString()} ${line}\n`
  );
};

(async () => {
  if (engines.includes("chromium")) {
    ensureBuilt();
    const p = await needsPort();
    port = p.port;
    server = p.server;
  }
  // the corpus pieces are scanned once, here, not by every worker
  const corpus = path.join(out, "corpus-chunks.json");
  if (!fs.existsSync(corpus)) {
    log("reading the corpora once (a minute at most)");
    await runWorker(
      "jsdom",
      { CMB6_SOAK_WARM: "1", CMB6_SOAK_CORPUS: corpus },
      { niceness: false }
    );
  }
  if (process.platform === "darwin")
    spawn("caffeinate", ["-i", "-w", String(process.pid)], {
      stdio: "ignore",
      detached: true,
    }).unref(); // (no idle sleep while this runs)
  log(
    `soak (${engines.join("+")}${opts.alternate ? ", alternating" : ""}${opts.motion ? ", motion" : ""}${smoke ? ", smoke" : ""}) at ${head}${dirty ? "+changes" : ""}, ` +
      `${minCores}-${maxCores} workers on ${ncpu} cores, seeds ${engines.map((e) => `${e} ${states[e].progress.nextSeed}`).join(", ")}, ` +
      `${hours > 0 ? `${hours} h` : "until --stop"}, results in ${out}${port !== "0" ? `, page server on port ${port}` : ""}`
  );
  const startSeqs = totals("sequences");
  const startFails = totals("failures");
  const startedAt = Date.now();
  await new Promise((resolve) => {
    finished = resolve;
    setInterval(sample, smoke ? 2000 : sampleMs).unref();
    setInterval(checkTimeouts, 1000).unref();
    setInterval(
      () => status(startSeqs, startFails, startedAt),
      opts.statusMin * 60000
    ).unref();
    pump();
  });
  save();
  fs.rmSync(workersFile, { force: true });
  server?.close();
  console.log(
    `done: ${totals("sequences")} sequences, ${totals("failures")} failures ` +
      `(${((100 * totals("failures")) / Math.max(1, totals("sequences"))).toFixed(2)}%, ${distinctCount()} distinct), ` +
      `${engines.reduce((n, e) => n + states[e].progress.crashes.length, 0)} crashes. See ${path.join(out, "summary.md")}`
  );
  process.exit(0);
})();
