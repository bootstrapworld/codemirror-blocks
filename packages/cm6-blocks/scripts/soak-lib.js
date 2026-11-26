// The pure parts of scripts/soak.js (arguments, signatures, results, the governor, the summary, `--promote`), kept apart so that jest can test them.

const fs = require("fs");
const { spawnSync } = require("child_process");

const ESC = String.fromCharCode(27);
const stripAnsi = (s) =>
  String(s).replace(new RegExp(`${ESC}\\[[0-9;]*m`, "g"), "");

const MAX_E2E_CORES = 6;
/** Chromium workers at most: half of the workers, and never more than MAX_E2E_CORES */
function defaultE2eCores(maxWorkers) {
  return Math.max(1, Math.min(MAX_E2E_CORES, Math.floor(maxWorkers / 2)));
}

/** How many of `limit` workers may run Chromium now: half of them (at least one), at most `cap` */
function chromiumSlots(limit, cap) {
  return Math.min(Math.max(1, cap), Math.max(1, Math.floor(limit / 2)));
}

/** The command line as options. Every flag has a default; `--x v` and `--x=v` both work. */
function parseArgs(argv) {
  const raw = {};
  const flags = new Set();
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const eq = a.indexOf("=");
    if (eq > 0) {
      raw[a.slice(2, eq)] = a.slice(eq + 1);
      continue;
    }
    const name = a.slice(2);
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith("--")) {
      raw[name] = next;
      i++;
    } else flags.add(name);
  }
  const num = (name, fallback) =>
    raw[name] === undefined ? fallback : Number(raw[name]);
  const has = (name) => flags.has(name) || raw[name] !== undefined;
  const smoke = has("smoke");
  const e2eOnly = has("e2e") || has("motion");
  const jsdomOnly = has("jsdom");
  const [minCores, maxCores] = String(raw.cores ?? "2-14")
    .split("-")
    .map(Number);
  const hours = smoke ? 0.01 : num("hours", 1);
  const forever = !smoke && (has("forever") || hours === 0);
  const maxWorkers = smoke ? 2 : maxCores;
  return {
    smoke,
    forever,
    hours: forever ? 0 : hours,
    engines: e2eOnly
      ? ["chromium"]
      : jsdomOnly
        ? ["jsdom"]
        : ["jsdom", "chromium"],
    alternate: has("alternate"),
    e2eEvery: num("e2e-every", 20),
    motion: has("motion"),
    longDocs: has("no-long-docs")
      ? 0
      : raw["long-docs"] === undefined
        ? undefined
        : Number(raw["long-docs"]),
    language: raw.language,
    seed: raw.seed === undefined ? undefined : Number(raw.seed),
    fresh: has("fresh"),
    batches: num("batches", Infinity),
    batch: raw.batch === undefined ? undefined : Number(raw.batch),
    steps: raw.steps === undefined ? undefined : Number(raw.steps),
    ramp: has("ramp") || (!has("no-ramp") && raw.steps === undefined),
    minCores: smoke ? 1 : minCores,
    maxCores: maxWorkers,
    // (half of the workers may run Chromium, and no more than 6: more flaked under load, round 3)
    e2eCores: num("e2e-cores", defaultE2eCores(maxWorkers)),
    timeoutMin: num("timeout-min", 25),
    sampleSec: num("sample-sec", 10),
    statusMin: num("status-min", 30),
    shrinkRuns:
      raw["shrink-runs"] === undefined ? undefined : Number(raw["shrink-runs"]),
    skip: raw.skip ? String(raw.skip).split(",").filter(Boolean) : [],
    port: raw.port === undefined ? undefined : Number(raw.port),
    noBuild: has("no-build"),
    out: raw.out,
    known: raw.known,
    promote: raw.promote,
    replay: raw.replay,
    stop: has("stop"),
    status: has("status"),
    ingestIssues: has("ingest-issues"),
    ingestOnly: has("ingest-only"),
    replaySeed:
      raw["replay-seed"] === undefined ? undefined : Number(raw["replay-seed"]),
    help: has("help"),
  };
}

/** The part of a message that says what kind of thing it is: no numbers, ids, names of blocks, or stack */
function normalizeMessage(message) {
  return stripAnsi(String(message ?? ""))
    .split("\n")[0]
    .split(" @ ")[0] // (an accessibility message names the block after " @ ")
    .replace(/"(?:[^"\\]|\\.)*"/g, '"…"')
    .replace(/\b[0-9a-f]{2,8}\b/g, "#")
    .replace(/\d+/g, "#")
    .replace(/\s+/g, " ")
    .slice(0, 110);
}

/** Failures of the same kind get the same signature, whatever the program, the ids and the numbers */
function signature(f) {
  return `${f.engine ?? "?"} :: ${f.invariant ?? "?"} @ ${f.op ?? "?"} :: ${normalizeMessage(f.message)}`;
}

/** a sequence whose `heightsStale` took more than this many ms in all is flagged in the summary */
const SLOW_STALE_MS = 50;

/**
 * Totals of the height check's counters (`ed.heightStats()`, one set per Chromium sequence) over a run: sums, the largest number of repairs
 * in one sequence, the sequences where `heightsStale` took over SLOW_STALE_MS in all (the seeds of the first ten kept).
 */
function addHeights(total, seed, h) {
  if (!h) return total;
  total.sequences = (total.sequences ?? 0) + 1;
  for (const k of [
    "checks",
    "staleCalls",
    "staleTrue",
    "staleMs",
    "remeasures",
    "repairs",
    "falsePositives",
    "stillStale",
    "capped",
    "cappedStale",
    "gutterSyncs",
  ])
    total[k] = (total[k] ?? 0) + (h[k] ?? 0);
  if ((h.repairs ?? 0) > (total.maxRepairs ?? 0)) {
    total.maxRepairs = h.repairs;
    total.maxRepairsSeed = seed;
  }
  if ((h.staleMs ?? 0) > SLOW_STALE_MS) {
    total.slow = (total.slow ?? 0) + 1;
    total.slowSeeds ??= [];
    if (total.slowSeeds.length < 10) total.slowSeeds.push(seed);
  }
  return total;
}

/** What a worker wrote (one JSON line per seed: `{seed, ok: true}` or a failure record) */
function readResults(text) {
  const done = new Set();
  const failures = [];
  const heights = [];
  let passed = 0;
  for (const line of String(text ?? "").split("\n")) {
    if (!line.trim()) continue;
    let r;
    try {
      r = JSON.parse(line);
    } catch (_) {
      continue; // (the last line of a worker that was killed)
    }
    if (r.seed === undefined) continue;
    done.add(r.seed);
    if (r.heights) heights.push({ seed: r.seed, h: r.heights });
    if (r.ok) passed++;
    else failures.push(r);
  }
  return { passed, failures, done, heights };
}

/** The seeds of a batch that no line says anything about, in order: the first is the one that was running when the worker died */
function missingSeeds(seeds, done) {
  return seeds.filter((s) => !done.has(s));
}

/**
 * Why a run that did not finish died. `run` is {status, signal, timedOut}, `output` is what it printed.
 */
function classifyCrash(run, output) {
  const text = String(output);
  if (
    /heap out of memory|Reached heap limit|Allocation failed|ERR_WORKER_OUT_OF_MEMORY/i.test(
      text
    ) ||
    run.status === 134
  )
    return "out-of-memory";
  if (run.timedOut) return "timeout";
  if (
    /Target (page|closed)|browser has been closed|crash/i.test(text) &&
    /chrom/i.test(text)
  )
    return "browser-crash";
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

/** Steps per sequence for the n-th batch: 20, plus 5 every 300 batches, up to 100 (Chromium: 15, plus 5 every 100, up to 60) */
function stepsFor(
  batchIndex,
  { steps = 30, ramp = false, engine = "jsdom" } = {}
) {
  if (!ramp) return steps;
  return engine === "chromium"
    ? Math.min(60, 15 + 5 * Math.floor(batchIndex / 100))
    : Math.min(100, 20 + 5 * Math.floor(batchIndex / 300));
}

/**
 * The governor. `cores` is the machine's core count, `others` the cores that programs other than ours are using, `running` our unpaused
 * workers. Returns how many workers should run, and the updated count of quiet samples. The machine is to stay under `load` busy: more load
 * pauses workers at once (never below `min`), and two quiet samples in a row add one (never above `max`).
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
  if (quietSamples + 1 >= 2)
    return { target: clamp(running + 1), quietSamples: 0 };
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

/** The failure to promote: by seed (the latest with steps) or by signature text (the shortest) */
function findForPromote(records, key) {
  const usable = records.filter((r) => r.steps && r.type !== "crash");
  if (/^\d+$/.test(String(key)))
    return usable.filter((r) => r.seed === Number(key)).at(-1) ?? null;
  const text = String(key).toLowerCase();
  const hits = usable.filter((r) =>
    String(r.signature ?? "")
      .toLowerCase()
      .includes(text)
  );
  hits.sort((a, b) => a.steps.length - b.steps.length);
  return hits[0] ?? null;
}

/** The record as the sequence a worker replays */
const sequenceOf = (r) => ({
  engine: r.engine,
  seed: r.seed,
  language: r.language,
  code: r.code,
  steps: r.steps,
  motion: r.motion,
  // (the editor's options: a record from before them has none, and the runner then uses the options of then)
  ...(r.editor ? { editor: r.editor } : {}),
});

/** A regression test for the record, ready to paste (jsdom: into a spec file; Chromium: into an e2e file) */
function promoteCase(record) {
  const seq = sequenceOf(record);
  const title =
    `soak seed ${record.seed}: ${record.invariant} after ${record.op}: ${normalizeMessage(record.message)}`.slice(
      0,
      150
    );
  const indent = (text, by) => text.replace(/\n/g, "\n" + " ".repeat(by));
  const body = indent(JSON.stringify(seq, null, 2), 6);
  if (record.engine === "chromium")
    return [
      `// packages/cm6-blocks/e2e/soak-regressions.e2e.ts (needs: import { test } from "@playwright/test"; import { runChromium } from "./soak-run";)`,
      `test(${JSON.stringify(title)}, async ({ browser }) => {`,
      `  const v = await runChromium(browser, ${indent(JSON.stringify(seq, null, 2), 2)}, { baseURL: \`http://127.0.0.1:\${process.env.CMB6_PORT || 8177}\` });`,
      `  expect(v).toBeNull();`,
      `});`,
    ].join("\n");
  return [
    `// packages/cm6-blocks/spec/soak-regressions.test.ts (needs: import { runJsdom } from "./soak-jsdom";)`,
    `it(${JSON.stringify(title)}, () => {`,
    `  expect(`,
    `    runJsdom(${body.replace(/^ {6}/gm, "      ")})`,
    `  ).toBeNull();`,
    `}, 120_000);`,
  ].join("\n");
}

/** How to replay a record: the command and the file it reads */
function replayCommand(record, file) {
  return `npm run soak -w @bootstrapworld/cm6-blocks -- --replay ${file ?? record.seed}`;
}

/** A readable summary: new failures first, most common first, then the known ones */
function summarize(progress, distinct, known = []) {
  const split = splitKnown(distinct, known);
  const lines = [
    `# Soak results (${progress.engine})`,
    ``,
    `${progress.sequences} sequences run, ${progress.failures} failed, ` +
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
      lines.push(
        `- ${c.kind}: seed ${c.seed}${c.log ? ` (log: ${c.log})` : ""}${c.note ? ` - ${c.note}` : ""}`
      );
      lines.push(
        `  replay: \`npm run soak -w @bootstrapworld/cm6-blocks -- --replay-seed ${c.seed} --${c.engine === "chromium" ? "e2e" : "jsdom"}\``
      );
    }
    lines.push(``);
  }
  if (progress.flakes?.length || progress.loadFlakes) {
    lines.push(
      `## Load flakes (${progress.loadFlakes ?? 0}: failed under load, passed on a rerun)`,
      ``
    );
    for (const f of (progress.flakes ?? []).slice(-30))
      lines.push(
        `- seed ${f.seed} (${f.language}): ${f.invariant} after ${f.op}: ${ascii(normalizeMessage(f.message))}`
      );
    lines.push(
      `- the full records are in flakes.jsonl (replay one with \`--replay <seed>\` after copying its line into failures.jsonl)`,
      ``
    );
  }
  if (progress.lost) {
    lines.push(
      `## Lost to kills and timeouts (${progress.lost} batches: ${progress.lostKilled ?? 0} killed, ${progress.lostTimeouts ?? 0} timed out)`,
      ``,
      `Their seeds and last progress are in lost.jsonl; the seeds were run again.`,
      ``
    );
  }
  for (const [sig, d] of split.fresh) {
    const ex = d.example;
    lines.push(`## ${d.count}x  ${sig}`, ``);
    lines.push(
      `- smallest example: seed ${ex.seed} (${ex.language}), ${ex.steps?.length ?? "?"} steps (of ${ex.originalSteps ?? "?"}), found after step ${ex.step}: ${String(ex.message).split("\n")[0].slice(0, 200)}`
    );
    lines.push(
      `- replay: \`npm run soak -w @bootstrapworld/cm6-blocks -- --replay ${ex.seed}\`; regression test: \`npm run soak -w @bootstrapworld/cm6-blocks -- --promote ${ex.seed}\``
    );
    lines.push(``);
  }
  const hh = progress.heights;
  if (hh?.sequences) {
    lines.push(
      `## Height check (Chromium, ${hh.sequences} sequences)`,
      ``,
      `- ${hh.checks} checks, ${hh.staleCalls} reads of the heights (${hh.staleMs.toFixed(0)} ms in all), ${hh.staleTrue} found them stale`,
      `- ${hh.repairs} repairs (most in one sequence: ${hh.maxRepairs ?? 0}${hh.maxRepairsSeed !== undefined ? `, seed ${hh.maxRepairsSeed}` : ""}), ${hh.remeasures} re-measures in all`,
      `- false positives (a repair that changed no height): ${hh.falsePositives}; repairs after which the page was still stale: ${hh.stillStale}; refused by the cap of two: ${hh.capped} (${hh.cappedStale} of them with stale heights); gutter redraws: ${hh.gutterSyncs}`
    );
    if (hh.slow)
      lines.push(
        `- SLOW: ${hh.slow} sequences spent over ${SLOW_STALE_MS} ms in heightsStale (seeds ${hh.slowSeeds.join(", ")})`
      );
    lines.push(``);
  }
  if (!split.fresh.length)
    lines.push(
      split.known.length ? `No new failures.` : `No failures so far.`,
      ``
    );
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

// ---- the lock: one soak per results directory ----

/** Is `pid` a live soak runner? (a dead pid, or one that a later program reused, is not) */
function soakAlive(pid) {
  try {
    process.kill(pid, 0);
  } catch (e) {
    if (e.code !== "EPERM") return false;
  }
  const r = spawnSync("ps", ["-o", "command=", "-p", String(pid)], {
    encoding: "utf8",
  });
  return r.status !== 0 || !r.stdout.trim() || /soak/.test(r.stdout);
}

function readLock(file) {
  try {
    const l = JSON.parse(fs.readFileSync(file, "utf8"));
    return Number.isInteger(l.pid) ? l : null;
  } catch (_) {
    return null;
  }
}

/**
 * Take the lock file: `{ok: true}` (with `tookOver: <old lock>` when the holder was dead) or `{ok: false, holder}`. The file is created
 * exclusively, so two runners that start together cannot both get it.
 */
function acquireLock(
  file,
  { pid = process.pid, now = Date.now(), alive = soakAlive, argv = [] } = {}
) {
  const mine = JSON.stringify({
    pid,
    startedAt: new Date(now).toISOString(),
    argv,
  });
  let tookOver;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      fs.writeFileSync(file, mine, { flag: "wx" });
      return tookOver ? { ok: true, tookOver } : { ok: true };
    } catch (e) {
      if (e.code !== "EEXIST") throw e;
    }
    const holder = readLock(file);
    if (holder && holder.pid !== pid && alive(holder.pid))
      return { ok: false, holder };
    tookOver = holder ?? { pid: null };
    fs.rmSync(file, { force: true });
  }
  return { ok: false, holder: readLock(file) ?? { pid: null } };
}

/** Give the lock back (only if it is still ours) */
function releaseLock(file, pid = process.pid) {
  if (readLock(file)?.pid === pid) fs.rmSync(file, { force: true });
}

/** One line on who holds a lock */
function describeLock(l) {
  return `pid ${l.pid}, started ${l.startedAt ?? "at an unknown time"}${l.argv?.length ? `, arguments: ${l.argv.join(" ")}` : ""}`;
}

// ---- records that keep the evidence ----

/** The full record of a failure that passed on a rerun (a load flake), so that it can be replayed: seed, language, code, steps, options */
function flakeRecord(f, extra = {}) {
  return { type: "flake", ...extra, ...f };
}

/** The record of a batch whose worker was killed or timed out: its seeds, how far it got, and the end of what it printed */
function lostRecord({ engine, seeds, done, kind, lastLine, tail, steps, log }) {
  const doneSet = new Set(done);
  return {
    type: "lost",
    engine,
    kind,
    seeds,
    done: doneSet.size,
    missing: seeds.filter((s) => !doneSet.has(s)),
    steps,
    lastProgress: lastLine ?? null,
    outputTail: String(tail ?? "").slice(-3000),
    log,
  };
}

/** Is the crash kind one of the two that leave no logs: a kill (signal) or a timeout */
const isKillOrTimeout = (kind) => /^(timeout|killed)/.test(kind);

/** A failure that depends on how busy the machine is: a Chromium one, or a jsdom step that ran out of time */
function mayBeLoad(f, engine = f.engine) {
  return engine === "chromium" || f.invariant === "stuck";
}

// ---- the status table (`--status`), in ASCII ----

const ascii = (s) =>
  String(s ?? "")
    .replace(/[^\x20-\x7e]/g, "?")
    .replace(/\|/g, "/");

/** Markdown: one row per engine, then the distinct failures with a seed to replay */
function statusTable(progressByEngine, known = [], lock = null) {
  const lines = [];
  lines.push(
    lock
      ? `Soak running: ${ascii(describeLock(lock))}`
      : `No soak is running on this results directory.`,
    ``,
    `| engine | sequences | failures | distinct | crashes | load flakes | lost batches | next seed |`,
    `|---|---|---|---|---|---|---|---|`
  );
  for (const [e, p] of Object.entries(progressByEngine)) {
    if (!p) continue;
    lines.push(
      `| ${e} | ${p.sequences ?? 0} | ${p.failures ?? 0} | ${Object.keys(p.distinct ?? {}).length} | ${p.crashes?.length ?? 0} | ${p.loadFlakes ?? 0} | ${p.lost ?? 0} | ${p.nextSeed} |`
    );
  }
  lines.push(``, `Distinct failures (new first):`, ``);
  let any = false;
  for (const [e, p] of Object.entries(progressByEngine)) {
    if (!p) continue;
    const split = splitKnown(p.distinct ?? {}, known);
    for (const [label, list] of [
      ["new", split.fresh],
      ["known", split.known],
    ])
      for (const [sig, d] of list) {
        any = true;
        lines.push(
          `- ${e} ${label}: ${d.count}x seed ${d.example?.seed ?? "?"} - ${ascii(sig).slice(0, 160)}`
        );
      }
  }
  if (!any) lines.push(`- none`);
  return lines.join("\n") + "\n";
}

// ---- bug reports from GitHub issues (`--ingest-issues`) ----

const TAG_LANGUAGE = {
  scheme: "scheme",
  scm: "scheme",
  rkt: "scheme",
  racket: "scheme",
  wescheme: "scheme",
  lisp: "scheme",
  js: "javascript",
  javascript: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  py: "python",
  python: "python",
  python3: "python",
};
const EXT_LANGUAGE = {
  rkt: "scheme",
  scm: "scheme",
  ss: "scheme",
  js: "javascript",
  mjs: "javascript",
  py: "python",
};

/** The language of a block: its tag, else a file name in the text around it, else a guess from the code; null if none fits */
function languageOfBlock(tag, code, context = "") {
  const t = String(tag ?? "")
    .trim()
    .toLowerCase();
  if (TAG_LANGUAGE[t]) return TAG_LANGUAGE[t];
  const ext = /[\w.-]+\.(rkt|scm|ss|mjs|js|py)\b/i.exec(context);
  if (ext) return EXT_LANGUAGE[ext[1].toLowerCase()];
  if (/^\s*\(\s*(define|let|cond|if|lambda|begin|require)\b/m.test(code))
    return "scheme";
  if (
    /^\s*(def \w+\(.*\)\s*:|import \w+|from \w+ import|class \w+.*:)/m.test(
      code
    )
  )
    return "python";
  if (
    /\b(function\s*\w*\s*\(|const |let |var |=>|console\.log)/.test(code) &&
    /[;{}]/.test(code)
  )
    return "javascript";
  return null;
}

/** Does a block look like a program rather than a log, a stack, a shell session or data? */
function looksLikeProgram(code) {
  const text = String(code ?? "");
  if (text.trim().length < 3 || text.length > 4000) return false;
  if (/^\s+at .+\(.*:\d+:\d+\)/m.test(text)) return false; // a stack
  if (/^\s*(\$|>|npm |yarn |git |cd |node |gh )/m.test(text)) return false; // a shell session
  if (/^\s*(Error|TypeError|RangeError|Uncaught|Warning)\b/m.test(text))
    return false;
  if (/^\s*[{[]\s*"/.test(text)) return false; // JSON
  if (/^\s*<\w+/.test(text)) return false; // markup
  return /[()[\]{}=:;]/.test(text);
}

/**
 * The first program in an issue body: `{language, code}` or null. Only fenced blocks count. Nothing of the issue but the code is kept.
 */
function programFromIssueBody(body) {
  const text = String(body ?? "").replace(/\r\n/g, "\n");
  const fence = /^(`{3,}|~{3,})[ \t]*([^\n`]*)\n([\s\S]*?)\n\1[ \t]*$/gm;
  let m;
  while ((m = fence.exec(text))) {
    const code = m[3];
    if (!looksLikeProgram(code)) continue;
    const context = text.slice(Math.max(0, m.index - 300), m.index);
    const language = languageOfBlock(m[2].split(/\s/)[0], code, context);
    if (language) return { language, code: code.replace(/\s+$/, "") + "\n" };
  }
  return null;
}

/** The issues (as `gh issue list --json number,labels,body` gives them) that carry a bug label, as programs by language */
function issuePrograms(issues) {
  const programs = { scheme: [], javascript: [], python: [] };
  const sources = [];
  for (const issue of issues ?? []) {
    const isBug = (issue.labels ?? []).some((l) =>
      /bug|user.?submitted/i.test(typeof l === "string" ? l : (l?.name ?? ""))
    );
    if (!isBug) continue;
    const p = programFromIssueBody(issue.body);
    if (!p || programs[p.language].includes(p.code)) continue;
    programs[p.language].push(p.code);
    sources.push({ issue: issue.number, language: p.language });
  }
  return { programs, sources };
}

const ISSUE_REPO = "bootstrapworld/codemirror-blocks";
/** The open issues, read-only (`gh issue list`); `{issues}` or `{error: <what to tell the user>}` */
function fetchIssues(run = spawnSync) {
  const r = run(
    "gh",
    [
      "issue",
      "list",
      "--repo",
      ISSUE_REPO,
      "--state",
      "open",
      "--limit",
      "300",
      "--json",
      "number,labels,body",
    ],
    { encoding: "utf8", timeout: 60000 }
  );
  if (r.error)
    return {
      error: `gh could not be run (${r.error.code ?? r.error.message})`,
    };
  if (r.status !== 0)
    return {
      error: `gh failed (not logged in with \`gh auth login\`, or offline): ${String(r.stderr).trim().split("\n")[0]}`,
    };
  try {
    return { issues: JSON.parse(r.stdout) };
  } catch (_) {
    return { error: "gh printed something that is not JSON" };
  }
}

module.exports = {
  SLOW_STALE_MS,
  addHeights,
  MAX_E2E_CORES,
  acquireLock,
  ascii,
  chromiumSlots,
  defaultE2eCores,
  describeLock,
  fetchIssues,
  flakeRecord,
  isKillOrTimeout,
  issuePrograms,
  languageOfBlock,
  looksLikeProgram,
  lostRecord,
  mayBeLoad,
  programFromIssueBody,
  readLock,
  releaseLock,
  soakAlive,
  statusTable,
  EXAMPLE_CAP,
  busyCores,
  classifyCrash,
  decideWorkers,
  findForPromote,
  mayStoreExample,
  missingSeeds,
  normalizeMessage,
  parseArgs,
  promoteCase,
  readResults,
  replayCommand,
  sequenceOf,
  signature,
  splitKnown,
  stepsFor,
  stripAnsi,
  summarize,
};
