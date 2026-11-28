/** @jest-environment jsdom */
/*
 * Lezer's incremental parse can put the comment that follows a statement inside its last token (found by the soak runner). The document
 * is cut down to what is needed: the fault depends on how much text there is around the edit.
 */
import { TreeFragment } from "@lezer/common";
import { checkLezerEditor, createLezerBlockEditor } from "../src/lezer-view";
import { javascriptParser } from "../src/lang-javascript";
import { LANGS, shape } from "./steps";

const host = (): HTMLElement =>
  document.body.appendChild(document.createElement("div"));

const MARK = "\u0001";
const END = "\u0002";

// soak seed 255682 (jsdom, textEdit): an edit far before a statement `x`, followed by a comment, makes the incremental parse put the comment
// INSIDE the name (VariableName x /** ... */ is one node that ends after the comment)
const JS =
  '  !!a && (Object.hasOwn(EVENTS, a.type) ? EVENTS[a.type](a) : validState(a));\nconst validState = (a) =>\n  ACTIONS.has(a.type) &&\n  (a.type !== "SET_AST" || typeof a.code === "string") &&\n  (a.type !== "SET_BLOCK_MODE" || typeof a.enabled === "boolean") &&\n  (!["COLLAPSE", "UNCOLLAPSE"].includes(a.type) || Number.isInteger(a.nid)) &&\n  (a.type !== "SET_FOCUS" || a.nid === null || Number.isInteger(a.nid));\n/**\n * The report in an issue body: `{ report, warnings }`, or `{ skip }` with the\n * reason when there is none we can use (an old-format issue, a block that\n * does not parse, the wrong shape).\n */\nconst validAction = (a) =>\n  !!a && (Object.hasOwn(EVENTS, a.type) ? EVENTS[a.type](a) : validState(a));\n\nconst validState = (a) =>\n  ACTIONS.has(a.type) &&\n  (a.type !== "SET_AST" || typeof a.code === "string") &&\n  (a.type !== "SET_BLOCK_MODE" || typeof a.enabled === "boolean") &&\n  (!["COLLAPSE", "UNCOLLAPSE"].includes(a.type) || Number.isInteger(a.nid)) &&\n  (a.type !== "SET_FOCUS" || a.nid === null || Number.isInteger(\u0001a.n\u0002id));\n\n/**\n * The report in an issue body: `{ report, warnings }`, or `{ skip }` with the\n * reason when there is none we can use (an old-format issue, a block that\n * does not parse, the wrong shape).\n */\nfunction parseJsdomFailure(title, message) {\n  const text = stripAnsi(message);\n  if (!text.includes("A randomized sequence of operations broke the editor")) {\n    return null;\n  }\n  const seed = /seed (\\d+)/.exec(title)?.[1];\n  const at = /failed at: (.*)/.exec(text)?.[1] ?? "?";\n  const problem = (\n    /problem:\\s+([^\\n]*(?:\\n {13}[^\\n]*)*)/.exec(text)?.[1] ?? "?"\n  )\n    .split(/\\n\\s+/)\n    .join(" | ")\n    .trim();\n  const shrunk = /Shrunk to (\\d+) of (\\d+) steps/.exec(text);\n  const replay = /CMB_RANDOM_REPLAY=\'(.*)\' npx jest/.exec(text)?.[1];\n  const ops = [...text.matchAll(/^\\s+\\d+\\. (.*)$/gm)].map((m) => m[1]);\n  return {\n    kind: "jsdom",\n    seed: seed === undefined ? undefined : Number(seed),\n    steps: Number(/\\((\\d+) steps\\)/.exec(title)?.[1]) || undefined,\n    failedAt: at,\n    problem,\n    shrunkTo: shrunk ? Number(shrunk[1]) : undefined,\n    trace: ops.slice(0, 40),\n    replay,\n  };\n}\nx\n/** Failures of the same kind get the same signature, whatever the ids and numbers */\nconst base = require("../../../packages/codemirror-blocks/webpack/example.config.js");\n\nconst group = (name, test, priority = 20) => ({\n  name,\n  test,\n  chunks: "all",\n  priority,\n  enforce: true,\n});\n\n\nfor (const n of f) {\n  if (true) {\n    const f = x("s1", 77) + "s9" < 75 - null;\n    null ? "s3" : true * "s8" === "s6" ? null - (f) => acc : "s5";\n    var fact = "s8";\n  }\n}\n[];\nfact(56);\nconst at = process.argv.indexOf("--port");\nconst port = at >= 0 ? Number(process.argv[at + 1]) : 8080;\nconst types = {\n  ".html": "text/html",\n  ".js": "text/javascript",\n  ".css": "text/css",\n  ".json": "application/json",\n  ".map": "application/json",\n  ".rkt": "text/plain",\n};\n\n// TODO\nconst x = "s7";\n// a b c\nn = (f) => total.fact(true);\nlet n = 80;\nvar x = lst() ? (n) => (total) => 12 : y(fact ? true : 73);\n\nfunction f(a, b) { return a * b; }\nf(1, 2);\nif (x) { f(1, 2); } else { g(); }\nconst chooseEngine = () => {\n  if (engines.length === 1) return engines[0];\n  const chromiumRunning = [...jobs].filter(\n    (j) => j.engine === "chromium"\n  ).length;\n  if (opts.alternate)\n    return !chromiumRunning && startedBatches - lastE2e >= opts.e2eEvery - 1\n      ? "chromium"\n      : "jsdom";\n  // both at once: Chromium gets about a third of the slots, at most --e2e-cores\n  return chromiumRunning <\n    Math.min(chromiumCap, Math.max(1, Math.ceil(limit() / 3)))\n    ? "chromium"\n    : "jsdom";\n};\nlet total = true;\n\n// note\ntrue;\n"s4";\n68;\nclass A {\n  m() {\n    return 1;\n  }\n}\nnew A().m();\nfunction replayCommand(record, file) {\n  return `npm run soak -w @bootstrapworld/cm6-blocks -- --replay ${file ?? record.seed}`;\n}\n\n/** A readable summary: new failures first, most common first, then the known ones */\nconst path = require("path");\nconst root = path.join(__dirname, "..", "demo");\nconst types = {\n  ".html": "text/html",\n  ".js": "text/javascript",';

it("soak seed 255682: a name that Lezer's incremental parse ends after the comment that follows it does not hold the comment", () => {
  const a = JS.indexOf(MARK);
  const b = JS.indexOf(END);
  const old = JS.replace(MARK, "").replace(END, "");
  const to = b - 1;
  const text = old.slice(0, a) + old.slice(to);
  const incremental = javascriptParser.parse(
    text,
    TreeFragment.applyChanges(
      TreeFragment.addTree(javascriptParser.parse(old)),
      [{ fromA: a, toA: to, fromB: a, toB: a }]
    )
  );
  let inside = false;
  incremental.iterate({
    enter: (n) => {
      if (n.name === "VariableName" && n.node.firstChild) inside = true;
    },
  });
  expect(inside).toBe(true); // (Lezer's: see above)

  const ed = createLezerBlockEditor(host(), old, {
    ...LANGS.javascript.opts,
    freshParseBelow: 0,
  });
  ed.view.dispatch({ changes: { from: a, to, insert: "" } });
  expect(checkLezerEditor(ed)).toEqual([]);
  const ref = createLezerBlockEditor(host(), text, {
    ...LANGS.javascript.opts,
    freshParseBelow: 0,
  });
  const loose = (e: typeof ed): string =>
    JSON.stringify(
      e
        .roots()
        .filter((r) => r.kind !== "comment")
        .map((r) => shape(r, new Set()))
    );
  expect(loose(ed)).toBe(loose(ref));
});
