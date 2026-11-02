#!/usr/bin/env node
// Downloads bug reports made with the editor's bug button (see
// packages/codemirror-blocks/src/ui/bugReport.ts) and records them in
// soak-results/failures.jsonl, next to the soak's own failures, as kind "field".
//
//   node scripts/field-reports.js                 download and record new reports
//   node scripts/field-reports.js --list          show what is on GitHub, record nothing
//   node scripts/field-reports.js --file body.md  record one issue body (--file - reads stdin;
//                                                 --number N names it, default "local")
//   options: --repo owner/name   --out soak-results
//
// Each report is saved as soak-results/field/issue-N.json; the entry's `replay`
// is the command that runs it (spec/field-replay-test.ts). Reads GitHub with
// `gh api` only; it never files or changes an issue.

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const FENCE = /```json cmb-report[^\n]*\n([\s\S]*?)\n\s*```/;
const ACTIONS = new Set([
  "SET_AST",
  "SET_FOCUS",
  "SET_BLOCK_MODE",
  "COLLAPSE",
  "UNCOLLAPSE",
  "COLLAPSE_ALL",
  "UNCOLLAPSE_ALL",
  "UNDO",
  "REDO",
]);

const validAction = (a) =>
  !!a &&
  ACTIONS.has(a.type) &&
  (a.type !== "SET_AST" || typeof a.code === "string") &&
  (a.type !== "SET_BLOCK_MODE" || typeof a.enabled === "boolean") &&
  (!["COLLAPSE", "UNCOLLAPSE"].includes(a.type) || Number.isInteger(a.nid)) &&
  (a.type !== "SET_FOCUS" || a.nid === null || Number.isInteger(a.nid));

/**
 * The report in an issue body: `{ report, warnings }`, or `{ skip }` with the
 * reason when there is none we can use (an old-format issue, a block that
 * does not parse, the wrong shape).
 */
function parseIssueBody(body) {
  const m = FENCE.exec(String(body ?? ""));
  if (!m)
    return { skip: "no cmb-report block (an older or hand-written issue)" };
  let report;
  try {
    report = JSON.parse(m[1]);
  } catch (e) {
    return { skip: `the cmb-report block is not valid JSON (${e.message})` };
  }
  if (!report || report.format !== 1) {
    return { skip: `unknown report format ${JSON.stringify(report?.format)}` };
  }
  if (typeof report.language !== "string" || typeof report.code !== "string") {
    return { skip: "the report has no language or document" };
  }
  if (!Array.isArray(report.actions)) {
    return { skip: "the report has no list of actions" };
  }
  const warnings = [];
  const actions = report.actions.filter(validAction);
  if (actions.length < report.actions.length) {
    warnings.push(
      `${report.actions.length - actions.length} malformed actions ignored`
    );
  }
  return {
    report: { ...report, actions, droppedActions: report.droppedActions ?? 0 },
    warnings,
  };
}

/** Reports of the same kind of error get the same signature, whatever the numbers */
function signature(issue, report) {
  const first = String(report.error?.message ?? "").split("\n")[0];
  if (!first) return `field :: reported, no error :: issue ${issue.number}`;
  const where = /\bat (\S+)/.exec(String(report.error.stack ?? ""))?.[1] ?? "";
  return `field :: ${first
    .replace(/\b[0-9a-f]{2,8}\b/g, "#")
    .replace(/\d+/g, "#")
    .slice(0, 120)}${where ? " @ " + where : ""}`;
}

const describeAction = (a) =>
  a.type === "SET_AST"
    ? `text ${JSON.stringify(a.code.slice(0, 40))}`
    : a.type === "SET_FOCUS"
      ? `focus ${a.nid}`
      : a.type === "SET_BLOCK_MODE"
        ? a.enabled
          ? "to blocks"
          : "to text"
        : a.nid !== undefined
          ? `${a.type.toLowerCase()} ${a.nid}`
          : a.type.toLowerCase();

/** A line of failures.jsonl, in the shape the soak's entries have */
function toEntry(issue, report, outDir = "soak-results") {
  const file = path.join(outDir, "field", `issue-${issue.number}.json`);
  return {
    mode: "field",
    head: report.version,
    at: issue.created_at ?? new Date().toISOString(),
    kind: "field",
    issue: issue.number,
    url: issue.html_url,
    steps: report.actions.length,
    failedAt: report.error ? "error" : "reported",
    problem: report.error
      ? report.error.message.split("\n")[0]
      : `user-reported: ${String(issue.title ?? "").slice(0, 100)}`,
    trace: report.actions.slice(-40).map(describeAction),
    replay: `CMB_FIELD_REPLAY=${file} npx jest field-replay`,
    signature: signature(issue, report),
  };
}

/** Entries not yet in `existing` (a list of parsed entries), by issue number */
function newEntries(entries, existing) {
  const seen = new Set(
    existing.filter((e) => e.kind === "field").map((e) => e.issue)
  );
  return entries.filter((e) => !seen.has(e.issue));
}

/** Everything in `issues` that carries a report: `{ entry, report }`, and why each other one was skipped */
function ingest(issues, existing, outDir) {
  const found = [];
  const skipped = [];
  for (const issue of issues) {
    if (issue.pull_request) continue;
    const p = parseIssueBody(issue.body);
    if (p.skip) {
      skipped.push({ number: issue.number, reason: p.skip });
      continue;
    }
    found.push({
      entry: toEntry(issue, p.report, outDir),
      report: p.report,
      warnings: p.warnings,
    });
  }
  const fresh = new Set(
    newEntries(
      found.map((f) => f.entry),
      existing
    ).map((e) => e.issue)
  );
  return {
    fresh: found.filter((f) => fresh.has(f.entry.issue)),
    known: found.filter((f) => !fresh.has(f.entry.issue)),
    skipped,
  };
}

function fetchIssues(repo) {
  const byNumber = new Map();
  for (const label of ["bug-report", "User Submitted"]) {
    const out = execFileSync(
      "gh",
      [
        "api",
        "--paginate",
        "--slurp",
        `repos/${repo}/issues?state=all&per_page=100&labels=${encodeURIComponent(label)}`,
      ],
      { encoding: "utf8", maxBuffer: 1 << 28 }
    );
    for (const page of JSON.parse(out)) {
      for (const issue of page) byNumber.set(issue.number, issue);
    }
  }
  return [...byNumber.values()].sort((a, b) => a.number - b.number);
}

function readEntries(file) {
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, "utf8")
    .split("\n")
    .filter(Boolean)
    .flatMap((l) => {
      try {
        return [JSON.parse(l)];
      } catch {
        return [];
      }
    });
}

function main(argv) {
  const opt = (name, fallback) =>
    argv.includes(name) ? argv[argv.indexOf(name) + 1] : fallback;
  const repo = opt("--repo", "bootstrapworld/codemirror-blocks");
  const outDir = opt("--out", "soak-results");
  const failures = path.join(outDir, "failures.jsonl");
  let issues;
  if (argv.includes("--file")) {
    const f = opt("--file");
    issues = [
      {
        number: opt("--number", "local"),
        title: "(local file)",
        html_url: f === "-" ? "stdin" : f,
        body: fs.readFileSync(f === "-" ? 0 : f, "utf8"),
      },
    ];
  } else {
    issues = fetchIssues(repo);
  }
  const { fresh, known, skipped } = ingest(
    issues,
    readEntries(failures),
    outDir
  );
  for (const s of skipped) console.log(`skipped #${s.number}: ${s.reason}`);
  if (argv.includes("--list")) {
    for (const f of [...fresh, ...known]) {
      const e = f.entry;
      console.log(
        `#${e.issue} ${fresh.includes(f) ? "new  " : "known"} ${e.steps} actions  ${e.problem}`
      );
    }
    return;
  }
  fs.mkdirSync(path.join(outDir, "field"), { recursive: true });
  for (const f of fresh) {
    const file = path.join(outDir, "field", `issue-${f.entry.issue}.json`);
    fs.writeFileSync(file, JSON.stringify(f.report, null, 1) + "\n");
    fs.appendFileSync(failures, JSON.stringify(f.entry) + "\n");
    for (const w of f.warnings) console.log(`#${f.entry.issue}: ${w}`);
    console.log(
      `recorded #${f.entry.issue}: ${f.entry.problem}\n  ${f.entry.replay}`
    );
  }
  console.log(
    `${fresh.length} new, ${known.length} already recorded, ${skipped.length} skipped`
  );
}

module.exports = { parseIssueBody, signature, toEntry, newEntries, ingest };

if (require.main === module) main(process.argv.slice(2));
