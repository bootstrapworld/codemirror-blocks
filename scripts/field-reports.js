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

/* eslint-disable no-console */
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
// What people did (format 2): keys, clicks, drags, text typed or pasted
const isNid = (n) => Number.isInteger(n);
const isLoc = (l) => !!l && isNid(l.line) && isNid(l.ch);
const isSel = (s) => !!s && isLoc(s.from) && isLoc(s.to);
const EVENTS = {
  KEY: (a) =>
    typeof a.key === "string" &&
    (a.nid === null || isNid(a.nid)) &&
    (a.mods === undefined || typeof a.mods === "string"),
  MOUSE: (a) => isNid(a.nid),
  DRAG: (a) =>
    !!a.from &&
    (isNid(a.from.nid) || typeof a.from.tool === "string") &&
    (a.to === undefined ||
      isNid(a.to.nid) ||
      isNid(a.to.gap) ||
      isLoc(a.to.ws) ||
      a.to.trash === true),
  EDIT: (a) => typeof a.text === "string" && ["enter", "blur"].includes(a.how),
  EDIT_CANCEL: () => true,
  TYPE: (a) => typeof a.char === "string" && isSel(a.sel),
  PASTE: (a) => typeof a.text === "string" && isSel(a.sel),
  CLIP: (a) => typeof a.text === "string",
  MODE: (a) => typeof a.blocks === "boolean",
  SEARCH: () => true,
};

const validAction = (a) =>
  !!a && (Object.hasOwn(EVENTS, a.type) ? EVENTS[a.type](a) : validState(a));

const validState = (a) =>
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
  if (!report || ![1, 2].includes(report.format)) {
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

const describeEvent = (a) => {
  const thing = (x) =>
    x.nid !== undefined
      ? `block ${x.nid}`
      : x.tool !== undefined
        ? `toolbar ${x.tool}`
        : x.gap !== undefined
          ? `gap ${x.gap}`
          : x.ws
            ? `whitespace ${x.ws.line}:${x.ws.ch}`
            : "trash";
  switch (a.type) {
    case "KEY":
      return `key ${a.mods ?? ""}${a.mods ? "-" : ""}${a.key} on ${a.nid ?? "editor"}`;
    case "MOUSE":
      return `click block ${a.nid}`;
    case "DRAG":
      return `${a.touch ? "touch " : ""}drag ${thing(a.from)} to ${a.to ? thing(a.to) : "nowhere"}`;
    case "EDIT":
      return `save box ${JSON.stringify(a.text.slice(0, 40))}`;
    case "EDIT_CANCEL":
      return "cancel box";
    case "TYPE":
      return `type ${JSON.stringify(a.char)}`;
    case "PASTE":
      return `paste ${JSON.stringify(a.text.slice(0, 40))}`;
    case "CLIP":
      return `clipboard ${JSON.stringify(a.text.slice(0, 40))}`;
    case "MODE":
      return a.blocks ? "button: blocks" : "button: text";
    default:
      return "search dialog";
  }
};

const describeAction = (a) =>
  Object.hasOwn(EVENTS, a.type)
    ? describeEvent(a)
    : a.type === "SET_AST"
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
    // how many of the actions are things the person did (a replay can drive those)
    events: report.actions.filter((a) => Object.hasOwn(EVENTS, a.type)).length,
    format: report.format,
    failedAt: report.error ? "error" : "reported",
    problem: report.error
      ? report.error.message.split("\n")[0]
      : `user-reported: ${String(issue.title ?? "").slice(0, 100)}`,
    trace: report.actions.slice(-40).map(describeAction),
    // (the replay re-drives the events when there are any, else the states)
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

/**
 * The values in `text`, which is what `gh api --paginate` prints: one JSON array
 * per page, one after another (`--slurp` would wrap them, but older gh has none).
 */
function jsonValues(text) {
  const values = [];
  let depth = 0;
  let inString = false;
  let escaped = false;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === '"') inString = false;
    } else if (c === '"') {
      inString = true;
    } else if (c === "[" || c === "{") {
      if (depth++ === 0) start = i;
    } else if (c === "]" || c === "}") {
      if (--depth === 0) values.push(JSON.parse(text.slice(start, i + 1)));
    }
  }
  return values;
}

function fetchIssues(repo) {
  const byNumber = new Map();
  for (const label of ["bug-report", "User Submitted"]) {
    const out = execFileSync(
      "gh",
      [
        "api",
        "--paginate",
        `repos/${repo}/issues?state=all&per_page=100&labels=${encodeURIComponent(label)}`,
      ],
      { encoding: "utf8", maxBuffer: 1 << 28 }
    );
    for (const page of jsonValues(out)) {
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

module.exports = {
  jsonValues,
  parseIssueBody,
  signature,
  toEntry,
  newEntries,
  ingest,
};

if (require.main === module) main(process.argv.slice(2));
