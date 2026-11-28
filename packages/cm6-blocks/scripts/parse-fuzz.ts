/*
 * PARSE-LEVEL DIFFERENTIAL FUZZER (no browser). Question: how often does Lezer's incremental parse (what `field.update` in
 * src/lezer-view.ts starts from) differ from a fresh parse, in what shapes, and which of those get past the editor's guards?
 *
 *   npm run fuzz:parse -- --seconds 300 --seed 1 [--lang python] [--max-size 60000] [--edits N] [--window 1,3]
 *                         [--l1-only | --l2-only] [--l2-sample 0.01] [--l2-max-size 25000] [--max-rss-mb 2500] [--chain 4] [--out DIR]
 *   npm run fuzz:parse -- --merge soak-results/parse-fuzz     (adds up the summary-*.json of several runs and prints the table)
 * (npm run fuzz:parse bundles this file with esbuild into scripts/parse-fuzz.build.cjs, which is git-ignored, and runs it with node; the
 * DOM of level 2 is jsdom, installed on the globals by `installDom`, so no jest and no server are needed.)
 *
 * LEVEL 1 (raw, no editor): a base document (real corpus chunks, generated programs from spec/soak-gen.ts, tracked files of the repository;
 * 0.5 KB to --max-size, some with a LONG comment (over 10k chars) or an unclosed string/comment/bracket) gets a random edit; the tree is
 * `parser.parse(new, TreeFragment.applyChanges(TreeFragment.addTree(oldTree), changes))`, compared with `parser.parse(new)`: the top-level
 * nodes (type, from, to) and the whole tree. A raw divergence is CLASSIFIED: language / edit kind / top-level or nested only / errors or
 * not / where the first difference is (before, at or after the change) / what it is (lost text, node count, extent, type, nested, or only
 * where a comment sits) / a long comment in the document.
 * LEVEL 2 (guarded): the same edit through the editor's own update path (`createLezerBlockEditor` with `freshParseBelow: 0`, a transaction),
 * the blocks compared with a fresh editor on the new text, with the soak's own rule (spec/soak-jsdom.ts `reparse`: a difference is a bug
 * unless the editor itself counted a divergence, and then only a difference beyond where a comment sits). ESCAPED = level 2 differs.
 * `--window K`: after the incremental parse, the K top-level nodes before and after the change are parsed again alone and compared with the
 * incremental tree's (the whole subtrees): the raw divergences it does not see are counted (a single local check).
 * A chain applies --chain edits in a row from the incremental tree (as the editor does), so that divergences can build up; level 2 replays
 * the chain through the editor. Minimised repros (delta-debugging on lines then characters) go to --out (default soak-results/parse-fuzz,
 * git-ignored) as JSON {language, before, edit, after, ...}. Seeded: the same --seed and --edits make the same edits.
 */
import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import { TreeFragment, type Parser, type Tree } from "@lezer/common";
import { schemeParser } from "../src/lang-scheme";
import { javascriptParser } from "../src/lang-javascript";
import { pythonParser } from "../src/lang-python";
import { LANGS } from "../spec/steps";
import {
  checkLezerEditor,
  createLezerBlockEditor,
  divergences,
  type LezerBlockEditor,
} from "../src/lezer-view";
import { walk } from "../src/doc";
import {
  longProgram,
  mulberry32,
  randomProgram,
  type Lang,
  type Rnd,
} from "../spec/soak-gen";

// ---------------------------------------------------------------- the comparison helpers (tested by spec/parse-fuzz.test.ts)

export const PARSERS: Record<Lang, Parser> = {
  scheme: schemeParser as unknown as Parser,
  javascript: javascriptParser as unknown as Parser,
  python: pythonParser as unknown as Parser,
};

export interface Change {
  fromA: number;
  toA: number;
  fromB: number;
  toB: number;
}
export interface Edit {
  from: number;
  to: number;
  insert: string;
  kind?: string;
}
export const applyEdit = (s: string, e: Edit): string =>
  s.slice(0, e.from) + e.insert + s.slice(e.to);
export const changeOf = (e: Edit): Change => ({
  fromA: e.from,
  toA: e.to,
  fromB: e.from,
  toB: e.from + e.insert.length,
});

/** the incremental tree for `newText`, from the tree of the text before the edit (what the editor's `field.update` starts from) */
export function incrementalParse(
  parser: Parser,
  oldTree: Tree,
  newText: string,
  changes: Change[]
): Tree {
  return parser.parse(
    newText,
    TreeFragment.applyChanges(TreeFragment.addTree(oldTree), changes)
  );
}

/** the top-level nodes: [type id, from, to] */
export function topNodes(tree: Tree): [number, number, number][] {
  const out: [number, number, number][] = [];
  const c = tree.cursor();
  if (c.firstChild())
    do out.push([c.type.id, c.from, c.to]);
    while (c.nextSibling());
  return out;
}

/** every node below the top node, in document order: type, from, to, depth (flat numbers); `lo`/`hi` keep the top-level nodes lo..hi only */
export function flatten(tree: Tree, lo = 0, hi = Infinity): number[] {
  const out: number[] = [];
  const c = tree.cursor();
  if (!c.firstChild()) return out;
  let depth = 0;
  let index = 0;
  for (;;) {
    if (depth > 0 || (index >= lo && index <= hi))
      out.push(c.type.id, c.from, c.to, depth);
    if ((depth > 0 || (index >= lo && index <= hi)) && c.firstChild()) {
      depth++;
      continue;
    }
    for (;;) {
      if (c.nextSibling()) {
        if (depth === 0) index++;
        break;
      }
      if (depth === 0) return out;
      c.parent();
      depth--;
    }
    if (depth === 0 && index > hi) return out;
  }
}

export const hasError = (tree: Tree): boolean => {
  let bad = false;
  tree.iterate({
    enter: (n) => {
      if (n.type.isError) bad = true;
      return !bad;
    },
  });
  return bad;
};

/** the names of the nodes with the comments taken out (the editor's own `plain` of checkLezerEditor): a difference only in where a comment sits is equal here */
export function plain(tree: Tree): string {
  let out = "";
  const c = tree.cursor();
  const go = (): void => {
    do {
      const comment = /Comment$/.test(c.name);
      if (!comment) out += c.name;
      if (c.firstChild()) {
        if (!comment) out += "(";
        go();
        if (!comment) out += ")";
        c.parent();
      }
      if (!comment) out += ",";
    } while (c.nextSibling());
  };
  go();
  return out.replace(/([^,(]|^)\(\)/g, "$1");
}

export type DiffKind =
  "lost" | "count" | "type" | "extent" | "nested" | "comment";
export interface Diff {
  /** the top-level nodes differ (else only below them) */
  top: boolean;
  kind: DiffKind;
  where: "before" | "at" | "after";
  /** position (new document) of the first difference */
  pos: number;
}

/** text outside the top-level nodes that is not blank */
export function lostText(tree: Tree, s: string): boolean {
  let at = 0;
  for (const [, f, t] of topNodes(tree)) {
    if (s.slice(at, f).trim()) return true;
    at = Math.max(at, t);
  }
  return !!s.slice(at).trim();
}

/** how the incremental tree differs from the fresh one, or null when they are the same (top-level nodes and every node) */
export function compareTrees(
  inc: Tree,
  fresh: Tree,
  text: string,
  changes: Change[]
): Diff | null {
  const a = flatten(inc);
  const b = flatten(fresh);
  let i = 0;
  const n = Math.min(a.length, b.length);
  while (i < n && a[i] === b[i]) i++;
  if (i === n && a.length === b.length) return null;
  i -= i % 4;
  const pos = Math.min(
    i < a.length ? a[i + 1] : Infinity,
    i < b.length ? b[i + 1] : Infinity
  );
  const fromB = Math.min(...changes.map((c) => c.fromB));
  const toB = Math.max(...changes.map((c) => c.toB));
  const where = pos < fromB ? "before" : pos > toB ? "after" : "at";
  const ta = topNodes(inc);
  const tb = topNodes(fresh);
  const same = (x: number[], y: number[]) =>
    x.length === y.length && x.every((v, k) => v === y[k]);
  const top = !same(ta.flat(), tb.flat());
  let kind: DiffKind = "nested";
  if (plain(inc) === plain(fresh)) kind = "comment";
  else if (top) {
    if (lostText(inc, text) !== lostText(fresh, text)) kind = "lost";
    else if (ta.length !== tb.length) kind = "count";
    else if (ta.some((t, k) => t[0] !== tb[k][0])) kind = "type";
    else kind = "extent";
  }
  return { top, kind, where, pos };
}

/**
 * The single local check: the K top-level nodes before and after the change are parsed again alone (`parse(slice)`) and compared, whole
 * subtrees, with the incremental tree's. True = the check sees a difference.
 */
export function windowDiffers(
  parser: Parser,
  inc: Tree,
  text: string,
  changes: Change[],
  K: number
): boolean {
  const top = topNodes(inc);
  if (!top.length) return false;
  const fromB = Math.min(...changes.map((c) => c.fromB));
  const toB = Math.max(...changes.map((c) => c.toB));
  let i0 = top.findIndex((t) => t[2] >= fromB);
  if (i0 < 0) i0 = top.length;
  let i1 = -1;
  top.forEach((t, k) => {
    if (t[1] <= toB) i1 = k;
  });
  const lo = Math.max(0, i0 - K);
  const hi = Math.min(top.length - 1, Math.max(i1, i0 - 1) + K);
  if (hi < lo) return false;
  const from = top[lo][1];
  const to = top[hi][2];
  const win = parser.parse(text.slice(from, to));
  const a = flatten(inc, lo, hi);
  const b = flatten(win);
  if (a.length !== b.length) return true;
  for (let i = 0; i < a.length; i += 4)
    if (
      a[i] !== b[i] ||
      a[i + 1] - from !== b[i + 1] ||
      a[i + 2] - from !== b[i + 2] ||
      a[i + 3] !== b[i + 3]
    )
      return true;
  return false;
}

/** a signature for a raw divergence (the class a count is kept under) */
export function signature(
  lang: string,
  edit: Edit,
  d: Diff,
  errors: boolean,
  bigComment: boolean
): string {
  return [
    lang,
    edit.kind ?? "edit",
    d.top ? "top" : "nested",
    d.kind,
    d.where,
    errors ? "errors" : "clean",
    bigComment ? "bigcomment" : "nobig",
  ].join(" ");
}

/** is there a comment of at least `min` chars in the tree? */
export function bigCommentIn(tree: Tree, min: number): boolean {
  let big = false;
  tree.iterate({
    enter: (n) => {
      if (/Comment$/.test(n.name) && n.to - n.from >= min) big = true;
      return !big;
    },
  });
  return big;
}

/** ddmin-style shrink of a string by chunks (lines first, then characters); `ok` says the shrunk text still shows the fault */
export function shrinkString(
  s: string,
  ok: (t: string) => boolean,
  budget: { n: number }
): string {
  for (const unit of ["\n", ""]) {
    let parts = unit ? s.split(unit) : [...s];
    let size = Math.ceil(parts.length / 2);
    while (size >= 1 && budget.n > 0) {
      let i = 0;
      while (i < parts.length && budget.n > 0) {
        const cand = parts.slice(0, i).concat(parts.slice(i + size));
        if (cand.length < parts.length && ok(cand.join(unit))) {
          budget.n--;
          parts = cand;
        } else {
          budget.n--;
          i += size;
        }
      }
      size = size === 1 ? 0 : Math.ceil(size / 2);
    }
    s = parts.join(unit);
  }
  return s;
}

export interface Case {
  pre: string;
  del: string;
  ins: string;
  post: string;
}
export const caseText = (c: Case): { before: string; after: string } => ({
  before: c.pre + c.del + c.post,
  after: c.pre + c.ins + c.post,
});
/** shrink a one-edit case: the text before the edit, the text after it, and the two sides of the edit */
export function shrinkCase(
  c: Case,
  ok: (c: Case) => boolean,
  budget: number
): Case {
  const b = { n: budget };
  c = { ...c, pre: shrinkString(c.pre, (t) => ok({ ...c, pre: t }), b) };
  c = { ...c, post: shrinkString(c.post, (t) => ok({ ...c, post: t }), b) };
  c = { ...c, ins: shrinkString(c.ins, (t) => ok({ ...c, ins: t }), b) };
  c = { ...c, del: shrinkString(c.del, (t) => ok({ ...c, del: t }), b) };
  return c;
}

/** the raw divergence of one edit from a fresh tree of the text before it */
export function rawDiverges(lang: Lang, before: string, e: Edit): boolean {
  const p = PARSERS[lang];
  const after = applyEdit(before, e);
  const ch = [changeOf(e)];
  return (
    compareTrees(
      incrementalParse(p, p.parse(before), after, ch),
      p.parse(after),
      after,
      ch
    ) !== null
  );
}

// ---------------------------------------------------------------- level 2: the editor's own update path, in jsdom

/** the jsdom window that the globals point at: each level-2 run gets a window of its own and closes it (one window for the whole run grows without end) */
const dom: { w: Record<string, unknown> | null } = { w: null };
let globalsSet = false;
export function installDom(): void {
  const { JSDOM } = require("jsdom");
  dom.w = new JSDOM("<!doctype html><html><body></body></html>", {
    pretendToBeVisual: true,
    url: "http://localhost/",
  }).window as unknown as Record<string, unknown>;
  const win = dom.w as unknown as {
    Range: { prototype: Record<string, unknown> };
    focus: () => void;
  };
  // (what spec/globalSetup.ts does for jest: jsdom has no layout)
  const rects = { item: () => null, length: 0, [Symbol.iterator]: () => [] };
  win.Range.prototype.getClientRects = () => rects;
  win.Range.prototype.getBoundingClientRect = () => ({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  });
  win.focus = () => {};
  if (globalsSet) return;
  globalsSet = true;
  const g = globalThis as unknown as Record<string, unknown>;
  for (const k of Object.getOwnPropertyNames(dom.w)) {
    if (k in g && k !== "navigator") continue;
    try {
      Object.defineProperty(g, k, {
        configurable: true,
        get: () => dom.w![k],
        set: (v) => {
          Object.defineProperty(g, k, {
            value: v,
            writable: true,
            configurable: true,
          });
        },
      });
    } catch (_) {
      /* a global that cannot be redefined: the editor does not need it */
    }
  }
}
export function closeDom(): void {
  (dom.w as unknown as { close?: () => void } | null)?.close?.();
}

const shapeOf = (ed: LezerBlockEditor, loose: boolean): string => {
  const o: string[] = [];
  ed.roots().forEach((r) =>
    walk(r, (n) => {
      if (n.kind === "error") return;
      if (loose && n.kind === "comment") return;
      o.push(`${n.kind}:${loose ? "" : `${n.from}-${n.to}:`}${n.value ?? ""}`);
    })
  );
  return o.join("|");
};

export interface L2Result {
  /** the blocks differ from a fresh editor's, by the soak's own rule */
  escaped: boolean;
  /** they differ, but the editor counted a divergence and only where a comment sits (the soak accepts it) */
  tolerated: boolean;
  detail: string;
}
/** the edits through the editor (one transaction each, from `before`), the blocks compared after the last with a fresh editor on the new text */
export function runLevel2(lang: Lang, before: string, edits: Edit[]): L2Result {
  const own = typeof document === "undefined" || dom.w !== null;
  if (own) installDom();
  const L = LANGS[lang];
  const host = document.body.appendChild(document.createElement("div"));
  const host2 = document.body.appendChild(document.createElement("div"));
  let ed: LezerBlockEditor | null = null;
  let fresh: LezerBlockEditor | null = null;
  const realError = console.error;
  const realWarn = console.warn;
  console.error = console.warn = () => {};
  try {
    ed = createLezerBlockEditor(host, before, {
      ...L.opts,
      freshParseBelow: 0,
    });
    let d0 = 0;
    edits.forEach((e, i) => {
      if (i === edits.length - 1) d0 = divergences.count;
      ed!.view.dispatch({
        changes: { from: e.from, to: e.to, insert: e.insert },
      });
    });
    // (checkLezerEditor counts the editor's divergences from its own tree: the soak calls it before the comparison)
    const problems = checkLezerEditor(ed);
    const diverged = divergences.count > d0;
    const text = ed.view.state.doc.toString();
    fresh = createLezerBlockEditor(host2, text, L.opts);
    const a = shapeOf(ed, false);
    const b = shapeOf(fresh, false);
    const clean = ed.modeProblem() === null && fresh.modeProblem() === null;
    if (a === b)
      return {
        escaped: false,
        tolerated: false,
        detail: problems.length ? `check: ${problems[0]}` : "",
      };
    if (!clean)
      return { escaped: false, tolerated: true, detail: "errors in a tree" };
    if (!diverged) return { escaped: true, tolerated: false, detail: "blocks" };
    return shapeOf(ed, true) !== shapeOf(fresh, true)
      ? { escaped: true, tolerated: false, detail: "blocks (beyond comments)" }
      : { escaped: false, tolerated: true, detail: "comment placement" };
  } catch (e) {
    return {
      escaped: true,
      tolerated: false,
      detail: `exception: ${(e as Error).message}`,
    };
  } finally {
    console.error = realError;
    console.warn = realWarn;
    for (const x of [ed, fresh])
      try {
        x?.destroy();
      } catch (_) {
        /* broken: the result is the report */
      }
    host.remove();
    host2.remove();
    if (own) closeDom();
  }
}

// ---------------------------------------------------------------- base documents and edits

const int = (r: Rnd, lo: number, hi: number): number =>
  lo + Math.floor(r() * (hi - lo + 1));
const pick = <T>(r: Rnd, a: readonly T[]): T => a[Math.floor(r() * a.length)];

const CORPUS =
  process.env.CMB6_SOAK_CORPUS ||
  path.join(__dirname, "..", "soak-results", "corpus-chunks.json");
let chunkCache: Record<string, string[]> | null = null;
const chunks = (lang: Lang): string[] => {
  chunkCache ??= (() => {
    try {
      return JSON.parse(fs.readFileSync(CORPUS, "utf8"));
    } catch (_) {
      return {};
    }
  })();
  return chunkCache?.[lang] ?? [];
};
let fileCache: Record<string, string[]> | null = null;
/** whole real files (0.5 KB to 60 KB): tracked files of the repository, and a few of the CodeMirror and Lezer packages */
const files = (lang: Lang): string[] => {
  fileCache ??= (() => {
    const out: Record<string, string[]> = {};
    const root = path.resolve(__dirname, "../../..");
    const add = (l: string, f: string) => {
      try {
        const t = fs.readFileSync(f, "utf8");
        if (
          t.length >= 500 &&
          t.length <= 60000 &&
          t.split("\n").every((x) => x.length < 400)
        )
          (out[l] ??= []).push(t);
      } catch (_) {
        /* unreadable: skipped */
      }
    };
    try {
      const ls = execSync(
        "git ls-files '*.js' '*.mjs' '*.py' '*.rkt' '*.scm' '*.ss'",
        { cwd: root, maxBuffer: 1 << 26 }
      )
        .toString()
        .split("\n")
        .filter(Boolean);
      for (const f of ls) {
        const l = /\.py$/.test(f)
          ? "python"
          : /\.(rkt|scm|ss)$/.test(f)
            ? "scheme"
            : "javascript";
        add(l, path.join(root, f));
      }
    } catch (_) {
      /* no git: the generated programs do */
    }
    for (const p of [
      "@codemirror/state",
      "@codemirror/commands",
      "@lezer/common",
      "@lezer/lr",
    ])
      add("javascript", path.join(root, "node_modules", p, "dist", "index.js"));
    return out;
  })();
  return fileCache?.[lang] ?? [];
};

const COMMENTS: Record<Lang, { line: string; open: string; close: string }> = {
  scheme: { line: ";", open: "#|", close: "|#" },
  javascript: { line: "//", open: "/*", close: "*/" },
  python: { line: "#", open: '"""', close: '"""' },
};
const OPENERS: Record<Lang, string[]> = {
  scheme: ["#|", '"', "(", "[", "(define (f x"],
  javascript: ["/*", '"', "`", "(", "{", "[", "function f(a, b) "],
  python: ['"""', '"', "(", "[", "{", "def f(x):\n    if x:"],
};
const TOKENS: Record<Lang, string[]> = {
  scheme: [
    "(",
    ")",
    "[",
    "]",
    '"',
    "'",
    ";",
    "#|",
    "|#",
    "#;",
    " ",
    "\n",
    "\n  ",
    "x",
    "(f x)",
    "\\",
  ],
  javascript: [
    "(",
    ")",
    "[",
    "]",
    "{",
    "}",
    '"',
    "'",
    "`",
    "/*",
    "*/",
    "//",
    ";",
    "\n",
    "\n  ",
    " ",
    "=>",
    "x",
    "function f(a) ",
    "else ",
    "{}",
  ],
  python: [
    "(",
    ")",
    "[",
    "]",
    "{",
    "}",
    '"',
    "'",
    '"""',
    "#",
    ":",
    "\n",
    "\n    ",
    "\n  ",
    "\n\t",
    "    ",
    " ",
    "else:",
    "def f(x):",
    "return ",
    "\\\n",
    "x",
  ],
};

/** a long comment (10k to 14k chars) of the language, made of the document's own lines (commented-out code, as in the repros) */
function longComment(lang: Lang, base: string, r: Rnd): string {
  const lines = base.split("\n").filter((l) => l.trim());
  const target = int(r, 10_000, 14_000);
  let body = "";
  while (body.length < target)
    body += (lines.length ? pick(r, lines) : "x y z") + "\n";
  const c = COMMENTS[lang];
  if (lang === "python")
    return r() < 0.5
      ? `# ${body.replace(/\n/g, " ")}\n`
      : body
          .split("\n")
          .map((l) => `# ${l}`)
          .join("\n") + "\n";
  if (r() < 0.25) return `${c.line} ${body.replace(/\n/g, " ")}\n`;
  return `${c.open}\n${lang === "scheme" ? body.replace(/\|#/g, "") : body.replace(/\*\//g, "")}${c.close}\n`;
}

const lineStarts = (s: string): number[] => {
  const o = [0];
  for (let i = 0; i < s.length; i++) if (s[i] === "\n") o.push(i + 1);
  return o;
};

/** a base document of about `target` chars, with (sometimes) a long comment and (sometimes) an unclosed construct */
export function baseDoc(lang: Lang, r: Rnd, target: number): string {
  let doc = "";
  const src = r();
  if (src < 0.3 && files(lang).length) {
    const f = pick(r, files(lang));
    const ls = f.split("\n");
    // a slice of a real file from a line at column 0
    let s = int(r, 0, Math.max(0, ls.length - 5));
    while (s > 0 && /^\s/.test(ls[s])) s--;
    for (let i = s; i < ls.length && doc.length < target; i++)
      doc += ls[i] + "\n";
  } else {
    while (doc.length < target) {
      let piece =
        r() < 0.15
          ? longProgram(lang, r)
          : r() < 0.5 && chunks(lang).length
            ? pick(r, chunks(lang))
            : randomProgram(lang, r);
      if (piece.length > target * 1.5 && doc) piece = piece.slice(0, target);
      doc += piece.endsWith("\n") ? piece : piece + "\n";
      if (r() < 0.15) doc += "\n";
    }
  }
  const starts = lineStarts(doc).filter(
    (i) => !/^\s/.test(doc.slice(i, i + 1))
  );
  if (r() < 0.35 && starts.length) {
    const at = pick(r, starts);
    doc = doc.slice(0, at) + longComment(lang, doc, r) + doc.slice(at);
  }
  if (r() < 0.2 && starts.length) {
    const at = pick(r, starts);
    doc = doc.slice(0, at) + pick(r, OPENERS[lang]) + "\n" + doc.slice(at);
  }
  return doc;
}

/** one random edit of `doc` (the tree gives statement boundaries and comments to aim at) */
export function randomEdit(
  lang: Lang,
  r: Rnd,
  doc: string,
  tree: Tree,
  prev?: { edit: Edit; before: string }
): Edit {
  const n = doc.length;
  const kindR = r();
  if (prev && kindR < 0.08) {
    // the inverse of the last edit (an undo)
    const { edit, before } = prev;
    return {
      from: edit.from,
      to: edit.from + edit.insert.length,
      insert: before.slice(edit.from, edit.to),
      kind: "undo",
    };
  }
  // where
  let pos: number;
  const w = r();
  const comments: [number, number][] = [];
  if (w >= 0.55 && w < 0.7) {
    tree.iterate({
      enter: (x) => {
        if (/Comment$/.test(x.name)) comments.push([x.from, x.to]);
      },
    });
  }
  const tops = w >= 0.4 && w < 0.55 ? topNodes(tree) : [];
  let place = "any";
  if (w < 0.4) pos = int(r, 0, n);
  else if (w < 0.55) {
    if (tops.length) {
      const t = pick(r, tops);
      pos = r() < 0.5 ? t[1] : t[2];
      place = "boundary";
    } else pos = int(r, 0, n);
  } else if (w < 0.7) {
    if (comments.length) {
      const [f, t] = pick(r, comments);
      pos = Math.max(0, Math.min(n, int(r, f - 30, t + 30)));
      place = "comment";
    } else pos = int(r, 0, n);
  } else if (w < 0.82) {
    const ls = lineStarts(doc);
    pos = pick(r, ls);
    if (r() < 0.4) pos = Math.max(0, pos - 1);
    place = "line";
  } else if (w < 0.91) {
    pos = int(r, 0, Math.min(n, 30));
    place = "start";
  } else {
    pos = int(r, Math.max(0, n - 30), n);
    place = "end";
  }
  const delLen = (): number => {
    const x = r();
    return x < 0.6 ? int(r, 1, 3) : x < 0.9 ? int(r, 4, 40) : int(r, 41, 1500);
  };
  const k = r();
  let from = pos;
  let to = pos;
  let insert = "";
  let kind: string;
  if (k < 0.34) {
    insert = pick(r, TOKENS[lang]);
    kind = "token";
  } else if (k < 0.52) {
    to = Math.min(n, pos + delLen());
    kind = "delete";
  } else if (k < 0.66) {
    to = Math.min(n, pos + delLen());
    insert = pick(r, TOKENS[lang]);
    kind = "replace";
  } else if (k < 0.78) {
    // indentation and newlines: add or remove leading spaces of the line, or break it
    const ls = lineStarts(doc);
    let li = ls.findIndex((x) => x > pos) - 1;
    if (li < 0) li = ls.length - 1;
    from = ls[li];
    const lead = /^[ \t]*/.exec(doc.slice(from, from + 80))![0].length;
    if (r() < 0.5 && lead) {
      to = from + Math.min(lead, int(r, 1, 4));
      kind = "dedent";
    } else if (r() < 0.5) {
      to = from;
      insert = " ".repeat(int(r, 1, 4));
      kind = "indent";
    } else {
      from = to = pos;
      insert = "\n" + " ".repeat(pick(r, [0, 0, 2, 4]));
      kind = "newline";
    }
  } else {
    // a pasted multi-line fragment: a chunk, a generated program, or a slice of the document itself
    const x = r();
    if (x < 0.4) insert = randomProgram(lang, r).slice(0, 600);
    else if (x < 0.6 && chunks(lang).length) insert = pick(r, chunks(lang));
    else {
      const a = int(r, 0, n);
      insert = doc.slice(a, a + int(r, 20, 800));
    }
    kind = "paste";
  }
  return { from, to, insert, kind: `${kind}@${place}` };
}

// ---------------------------------------------------------------- the run

interface Counts {
  tried: number;
  raw: number;
  l2run: number;
  caught: number;
  escaped: number;
  tolerated: number;
  l2skipped: number;
  cleanL2run: number;
  cleanEscaped: number;
  /** per window K: raw divergences the check does not see, and clean edits it flags */
  missed: Record<string, number>;
  flagged: Record<string, number>;
  /** raw divergences by the part of the diff */
  top: number;
  nested: number;
  errors: number;
}
const zero = (): Counts => ({
  tried: 0,
  raw: 0,
  l2run: 0,
  caught: 0,
  escaped: 0,
  tolerated: 0,
  l2skipped: 0,
  cleanL2run: 0,
  cleanEscaped: 0,
  missed: {},
  flagged: {},
  top: 0,
  nested: 0,
  errors: 0,
});
const add = (a: Counts, b: Counts): void => {
  for (const k of Object.keys(a) as (keyof Counts)[]) {
    if (k === "missed" || k === "flagged")
      for (const [kk, v] of Object.entries(b[k]))
        a[k][kk] = (a[k][kk] ?? 0) + v;
    else (a[k] as number) += b[k] as number;
  }
};

interface Summary {
  seed: number;
  seconds: number;
  windows: number[];
  byLang: Record<string, Counts>;
  byClass: Record<string, Counts>;
  repros: { sig: string; escaped: boolean; file: string; size: number }[];
}

const rate = (n: number, of: number): string =>
  of ? ((n / of) * 1e5).toFixed(0) : "-";

export function table(s: Summary): string {
  const lines: string[] = [];
  const hdr = (title: string) => {
    lines.push("", title);
    lines.push(
      "edits     raw  /100k  top nest err | L2run caught  tol  ESCAPED  /100k  skip | clean-L2 esc | window misses"
    );
  };
  const row = (name: string, c: Counts) => {
    const win = s.windows
      .map((k) => `K=${k}: ${c.missed[k] ?? 0}/${c.raw}`)
      .join(" ");
    lines.push(
      `${String(c.tried).padStart(7)} ${String(c.raw).padStart(6)} ${rate(c.raw, c.tried).padStart(6)} ${String(c.top).padStart(4)} ${String(c.nested).padStart(4)} ${String(c.errors).padStart(3)} | ${String(c.l2run).padStart(5)} ${String(c.caught).padStart(6)} ${String(c.tolerated).padStart(4)} ${String(c.escaped).padStart(8)} ${rate(c.escaped, c.tried).padStart(6)} ${String(c.l2skipped).padStart(5)} | ${String(c.cleanL2run).padStart(5)} ${String(c.cleanEscaped).padStart(3)} | ${win}  ${name}`
    );
  };
  hdr("PER LANGUAGE");
  const all = zero();
  for (const [l, c] of Object.entries(s.byLang)) {
    row(l, c);
    add(all, c);
  }
  row("ALL", all);
  hdr(
    "PER CLASS (language, edit kind, top/nested, difference, where, errors, long comment)"
  );
  for (const [k, c] of Object.entries(s.byClass).sort(
    (a, b) => b[1].raw - a[1].raw
  ))
    row(k, c);
  if (s.windows.length) {
    lines.push(
      "",
      "WINDOW CHECK (false alarms: edits with no raw divergence that it flags)"
    );
    for (const k of s.windows)
      lines.push(
        `  K=${k}: ${all.flagged[k] ?? 0} of ${all.tried - all.raw} clean edits`
      );
  }
  return lines.join("\n");
}

const say = (...a: unknown[]): void => {
  process.stdout.write(a.join(" ") + "\n");
};

function parseArgs(argv: string[]): Record<string, string | boolean> {
  const o: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith("--")) continue;
    const k = argv[i].slice(2);
    const v = argv[i + 1];
    if (v === undefined || v.startsWith("--")) o[k] = true;
    else {
      o[k] = v;
      i++;
    }
  }
  return o;
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const outDir = String(
    args.out ?? path.join(__dirname, "..", "soak-results", "parse-fuzz")
  );
  fs.mkdirSync(outDir, { recursive: true });
  if (args.merge) {
    const dir = typeof args.merge === "string" ? args.merge : outDir;
    const m: Summary = {
      seed: 0,
      seconds: 0,
      windows: [],
      byLang: {},
      byClass: {},
      repros: [],
    };
    for (const f of fs
      .readdirSync(dir)
      .filter((x) => /^summary-.*\.json$/.test(x))) {
      const s = JSON.parse(
        fs.readFileSync(path.join(dir, f), "utf8")
      ) as Summary;
      m.seconds += s.seconds;
      m.windows = s.windows;
      m.repros.push(...s.repros);
      for (const [a, b] of [
        [m.byLang, s.byLang],
        [m.byClass, s.byClass],
      ] as const)
        for (const [k, c] of Object.entries(b)) add((a[k] ??= zero()), c);
    }
    // (the same classes without the edit kind: what the divergence is, not what edit found it)
    const coarse: Record<string, Counts> = {};
    for (const [k, c] of Object.entries(m.byClass)) {
      const f = k.split(" ");
      add((coarse[[f[0], ...f.slice(2)].join(" ")] ??= zero()), c);
    }
    say(table(m));
    say(
      table({ ...m, byLang: {}, byClass: coarse }).replace(
        "PER LANGUAGE",
        "COARSE CLASSES (no edit kind)"
      )
    );

    say("\nrepros:", m.repros.length, "(", m.seconds, "s of run time )");
    return;
  }
  const seed = Number(args.seed ?? 1);
  const seconds = Number(args.seconds ?? 60);
  const maxEdits = Number(args.edits ?? Infinity);
  const maxSize = Number(args["max-size"] ?? 60000);
  const l1Only = !!args["l1-only"];
  const l2Only = !!args["l2-only"];
  const l2Sample = Number(args["l2-sample"] ?? 0.01);
  const l2Max = Number(args["l2-max-size"] ?? 25000);
  const chainLen = Number(args.chain ?? 4);
  // (the editor and its blocks are not all freed when it is destroyed, about 19 MB for a 25 KB document: a run that has grown past this ends, and a
  // loop in the shell starts the next one with another seed)
  const maxRss = Number(args["max-rss-mb"] ?? 2500) * 1e6;
  const windows = String(args.window ?? "")
    .split(",")
    .filter(Boolean)
    .map(Number);
  const langs = (
    args.lang
      ? String(args.lang).split(",")
      : ["scheme", "javascript", "python"]
  ) as Lang[];
  const r = mulberry32(seed);
  const summary: Summary = {
    seed,
    seconds: 0,
    windows,
    byLang: {},
    byClass: {},
    repros: [],
  };
  const t0 = Date.now();
  let tried = 0;
  let lastLog = t0;
  const perClassSaved: Record<string, number> = {};

  const save = (
    sig: string,
    escaped: boolean,
    lang: Lang,
    before: string,
    edits: Edit[],
    note: string
  ): void => {
    const key = `${escaped ? "E" : "R"} ${lang} ${sig.split(" ").slice(1).join(" ")}`;
    // (a few repros per class: the first ones, minimised if one edit shows the fault from the text before it)
    const coarse = `${escaped ? "E" : "R"} ${sig
      .split(" ")
      .filter((_, i) => [0, 2, 3, 5].includes(i))
      .join(" ")}`;
    if ((perClassSaved[coarse] ?? 0) >= (escaped ? 3 : 1)) return;
    perClassSaved[coarse] = (perClassSaved[coarse] ?? 0) + 1;
    let rec: Record<string, unknown> = {
      language: lang,
      sig: key,
      note,
      before,
      edits,
      after: undefined,
    };
    const last = edits[edits.length - 1];
    let stateBefore = before;
    for (const e of edits.slice(0, -1)) stateBefore = applyEdit(stateBefore, e);
    const c0: Case = {
      pre: stateBefore.slice(0, last.from),
      del: stateBefore.slice(last.from, last.to),
      ins: last.insert,
      post: stateBefore.slice(last.to),
    };
    const pred = (c: Case): boolean => {
      const e: Edit = {
        from: c.pre.length,
        to: c.pre.length + c.del.length,
        insert: c.ins,
      };
      const b = c.pre + c.del + c.post;
      return escaped
        ? runLevel2(lang, b, [e]).escaped
        : rawDiverges(lang, b, e);
    };
    const tm = Date.now();
    if (pred(c0)) {
      const timed = (x: Case) => Date.now() - tm < 90_000 && pred(x);
      const c = shrinkCase(c0, timed, escaped ? 150 : 600);
      const t = caseText(c);
      rec = {
        language: lang,
        sig: key,
        note: `${note} (minimised from ${stateBefore.length} chars)`,
        before: t.before,
        edit: {
          from: c.pre.length,
          to: c.pre.length + c.del.length,
          insert: c.ins,
        },
        after: t.after,
      };
    } else {
      rec.note = `${note} (a chain of ${edits.length} edits: not reproduced from the text before the last one alone, not minimised)`;
      rec.after = edits.reduce(applyEdit, before);
    }
    const file = `${escaped ? "escaped" : "raw"}-${lang}-${seed}-${summary.repros.length}.json`;
    fs.writeFileSync(path.join(outDir, file), JSON.stringify(rec, null, 1));
    summary.repros.push({
      sig: key,
      escaped,
      file,
      size: String(rec.before).length,
    });
  };

  const counts = (lang: string, sig?: string): Counts[] => {
    const a = (summary.byLang[lang] ??= zero());
    return sig ? [a, (summary.byClass[sig] ??= zero())] : [a];
  };

  const finish = (): void => {
    summary.seconds = (Date.now() - t0) / 1000;
    fs.writeFileSync(
      path.join(outDir, `summary-${seed}.json`),
      JSON.stringify(summary)
    );
    say(table(summary));
    say(
      `\n${tried} edits in ${summary.seconds.toFixed(0)} s (seed ${seed}); repros in ${outDir}`
    );
  };

  let li = 0;
  while (
    Date.now() - t0 < seconds * 1000 &&
    tried < maxEdits &&
    process.memoryUsage().rss < maxRss
  ) {
    const lang = langs[li++ % langs.length];
    const P = PARSERS[lang];
    const target = Math.round(
      Math.exp(Math.log(500) + r() * (Math.log(maxSize) - Math.log(500)))
    );
    const base = baseDoc(lang, r, target);
    const baseTree = P.parse(base);
    // independent edits from the base tree, and one chain
    const plan: number[] = [1, 1, 1, 1, 1, 1, 1, 1, chainLen];
    for (const steps of plan) {
      let text = base;
      let tree = baseTree;
      const done: Edit[] = [];
      let prev: { edit: Edit; before: string } | undefined;
      for (let step = 0; step < steps; step++) {
        if (Date.now() - t0 >= seconds * 1000 || tried >= maxEdits) break;
        const edit = randomEdit(
          lang,
          r,
          text,
          tree,
          steps > 1 ? prev : undefined
        );
        const after = applyEdit(text, edit);
        const ch = [changeOf(edit)];
        done.push(edit);
        tried++;
        const cs = counts(lang);
        cs[0].tried++;
        let inc: Tree | null = null;
        let fresh: Tree | null = null;
        let diff: Diff | null = null;
        let sig = "";
        if (!l2Only) {
          inc = incrementalParse(P, tree, after, ch);
          fresh = P.parse(after);
          diff = compareTrees(inc, fresh, after, ch);
          if (diff) {
            const errors = hasError(inc) || hasError(fresh);
            sig = signature(
              lang,
              edit,
              diff,
              errors,
              bigCommentIn(fresh, 2000)
            );
            const [a, b] = counts(lang, sig);
            for (const c of [a, b]) {
              if (c === b) c.tried++;
              c.raw++;
              if (diff.top) c.top++;
              else c.nested++;
              if (errors) c.errors++;
            }
          }
          for (const k of windows) {
            const seen = windowDiffers(P, inc, after, ch, k);
            if (diff && !seen)
              for (const c of counts(lang, sig))
                c.missed[k] = (c.missed[k] ?? 0) + 1;
            if (!diff && seen) cs[0].flagged[k] = (cs[0].flagged[k] ?? 0) + 1;
          }
        }
        // level 2: every raw divergence, and a sample of the others (all of them with --l2-only: then it is the sample rate)
        const wantL2 =
          !l1Only &&
          (l2Only ? r() < l2Sample * 10 : diff ? true : r() < l2Sample);
        if (wantL2) {
          if (after.length > l2Max && base.length > l2Max) {
            if (diff) for (const c of counts(lang, sig)) c.l2skipped++;
          } else {
            const res = runLevel2(lang, base, done);
            const cl = counts(lang, sig || undefined);
            for (const c of cl) {
              if (diff) {
                c.l2run++;
                if (res.escaped) c.escaped++;
                else if (res.tolerated) c.tolerated++;
                else c.caught++;
              } else {
                c.cleanL2run++;
                if (res.escaped) c.cleanEscaped++;
              }
            }
            if (res.escaped) {
              if (!sig) {
                const [, b] = counts(
                  lang,
                  `${lang} ${edit.kind} no-tree-divergence`
                );
                b.tried++;
                b.cleanEscaped++;
              }
              save(
                sig || `${lang} ${edit.kind} l2only`,
                true,
                lang,
                base,
                done,
                res.detail
              );
            }
          }
        }
        if (diff && !l2Only)
          save(sig, false, lang, text, [edit], "raw divergence");
        // the next step starts from the incremental tree (as the editor's fragments do) unless it diverged
        if (!l2Only && inc && fresh) {
          tree = diff ? fresh : inc;
        } else tree = P.parse(after);
        prev = { edit, before: text };
        text = after;
        if (Date.now() - lastLog > 15000) {
          lastLog = Date.now();
          const all = zero();
          Object.values(summary.byLang).forEach((c) => add(all, c));
          say(
            `[${((lastLog - t0) / 1000).toFixed(0)}s] ${tried} edits, raw ${all.raw}, L2 run ${all.l2run}, caught ${all.caught}, escaped ${all.escaped} (clean-sample escapes ${all.cleanEscaped}/${all.cleanL2run})`
          );
        }
      }
    }
  }
  finish();
}

if (/parse-fuzz\.build\.cjs$/.test(process.argv[1] ?? "")) main();
