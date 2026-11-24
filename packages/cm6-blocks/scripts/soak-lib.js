// The pure parts of scripts/soak.js (arguments, signatures, results, the governor, the summary, `--promote`), kept apart so that jest can test them.

const ESC = String.fromCharCode(27);
const stripAnsi = (s) =>
  String(s).replace(new RegExp(`${ESC}\\[[0-9;]*m`, "g"), "");

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
  return {
    smoke,
    hours: smoke ? 0.01 : num("hours", 1),
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
    maxCores: smoke ? 2 : maxCores,
    e2eCores: num("e2e-cores", 4),
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

/** What a worker wrote (one JSON line per seed: `{seed, ok: true}` or a failure record) */
function readResults(text) {
  const done = new Set();
  const failures = [];
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
    if (r.ok) passed++;
    else failures.push(r);
  }
  return { passed, failures, done };
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

module.exports = {
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
