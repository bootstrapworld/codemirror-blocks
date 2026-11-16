// EXPERIMENT: measuring the tables on real programs. Pure functions; the runner is spec/corpus.test.ts
// (gated by CMB_CORPUS). Nothing here copies corpus files anywhere: they are read where they are.
import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import * as ts from "typescript";
import type { Parser } from "@lezer/common";
import { BlockTable, lezerLanguage } from "../src/lezer";
import type { BNode } from "../src/types";

export const ROOT = path.resolve(__dirname, "../../..");

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** a fixed-seed sample of `n` items of a sorted list */
export function sample<T>(items: T[], n: number, seed: number): T[] {
  const rnd = mulberry32(seed);
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n).sort();
}
const sh = (cmd: string, cwd = ROOT): string[] => execSync(cmd, { cwd, maxBuffer: 1 << 28 }).toString().split("\n").filter(Boolean);
const tooBig = (f: string) => fs.statSync(f).size > 200 * 1024;
const minified = (text: string) => text.split("\n").some((l) => l.length > 400);

export interface Corpus {
  name: string;
  language: "scheme" | "javascript" | "python";
  files: { name: string; text: string }[];
  note: string;
}

const read = (f: string): string => fs.readFileSync(f, "utf8");

/** WeScheme programs that appear as string literals in the repo's tests and soak generators */
export function schemeLiterals(): { name: string; text: string }[] {
  const files = sh("git ls-files 'packages/codemirror-blocks/spec' 'packages/codemirror-blocks/e2e' 'packages/wescheme/spec' 'packages/wescheme-blocks/spec' 'scripts' 'packages/codemirror-blocks/scripts' | grep -E '\\.(ts|tsx|js)$' || true");
  const seen = new Set<string>();
  const out: { name: string; text: string }[] = [];
  for (const f of files) {
    const abs = path.join(ROOT, f);
    if (!fs.existsSync(abs)) continue;
    const sf = ts.createSourceFile(f, read(abs), ts.ScriptTarget.Latest, true);
    const visit = (n: ts.Node): void => {
      if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) {
        const t = n.text;
        const s = t.trim();
        const opens = (s.match(/[([]/g) ?? []).length;
        const closes = (s.match(/[)\]]/g) ?? []).length;
        if (s.length >= 8 && /^[([;]/.test(s) && opens > 0 && opens === closes && !/^\(\)\s*=>/.test(s) && !seen.has(s)) {
          seen.add(s);
          out.push({ name: `${f}:${sf.getLineAndCharacterOfPosition(n.getStart()).line + 1}`, text: t });
        }
      }
      ts.forEachChild(n, visit);
    };
    visit(sf);
  }
  return out;
}

export function corpora(): Corpus[] {
  const out: Corpus[] = [];
  // ---- Scheme
  const rkt = sh("git ls-files '*.rkt' '*.scm' '*.ss'").filter((f) => !tooBig(path.join(ROOT, f)));
  out.push({ name: "scheme-repo-files", language: "scheme", note: "every .rkt/.scm/.ss tracked in this repository", files: rkt.map((f) => ({ name: f, text: read(path.join(ROOT, f)) })) });
  out.push({ name: "scheme-test-literals", language: "scheme", note: "string literals in the repo's own tests that look like programs (what students' programs look like)", files: schemeLiterals() });
  // ---- JavaScript
  const own = sh("git ls-files '*.js' '*.mjs'").filter((f) => !/(^|\/)(dist|lib|build|vendors?)\//.test(f) && !/^packages\/wescheme\//.test(f) && !/\.min\./.test(f) && !/^packages\/cm6-blocks\/demo\/demo\.js$/.test(f) && !tooBig(path.join(ROOT, f)));
  out.push({ name: "js-repo-own", language: "javascript", note: "plain .js/.mjs tracked in this repository (not dist/lib, not the vendored WeScheme reader)", files: own.map((f) => ({ name: f, text: read(path.join(ROOT, f)) })) });
  const nm = sh("find node_modules -type f \\( -name '*.js' -o -name '*.mjs' \\) -size -200k -not -name '*.min.js' -not -name '*.d.ts' -not -path '*/test/*' -not -path '*/tests/*' -not -path '*/__tests__/*' -not -path '*/node_modules/.cache/*' -not -path '*/example*/*' | sort");
  const nmFiles = sample(nm, 600, 7).map((f) => ({ name: f, text: read(path.join(ROOT, f)) })).filter((f) => !minified(f.text)).slice(0, 200);
  out.push({ name: "js-node_modules-library", language: "javascript", note: `~200 non-minified .js/.mjs sampled (seed 7) from ${nm.length} files under node_modules: library code`, files: nmFiles });
  const ex = sh("find node_modules -type f -name '*.js' -size -50k \\( -path '*/examples/*' -o -path '*/example/*' -o -path '*/demo/*' \\) | sort");
  out.push({ name: "js-node_modules-examples", language: "javascript", note: `up to 40 example/demo .js sampled (seed 11) from ${ex.length} files: the nearest thing to beginner-style programs found locally`, files: sample(ex, 80, 11).map((f) => ({ name: f, text: read(path.join(ROOT, f)) })).filter((f) => !minified(f.text)).slice(0, 40) });
  // ---- Python
  const stdlib = execSync("python3 -c \"import sysconfig; print(sysconfig.get_paths()['stdlib'])\"").toString().trim();
  const py = sh(`find ${JSON.stringify(stdlib)} -type f -name '*.py' -size -200k -not -path '*/test/*' -not -path '*/tests/*' -not -path '*/idle_test/*' -not -path '*/site-packages/*' -not -path '*/turtledemo/*' -not -path '*/lib2to3/*' -not -name 'test_*' | sort`);
  out.push({ name: "py-stdlib-library", language: "python", note: `~200 .py sampled (seed 5) from ${py.length} files of the standard library of ${stdlib} (Python 3.6): library code`, files: sample(py, 200, 5).map((f) => ({ name: f.replace(stdlib, "stdlib"), text: read(f) })) });
  const demo = sh(`find ${JSON.stringify(path.join(stdlib, "turtledemo"))} -type f -name '*.py' | sort`);
  out.push({ name: "py-turtledemo", language: "python", note: "the standard library's turtledemo programs: beginner-style, the best local match", files: demo.map((f) => ({ name: f.replace(stdlib, "stdlib"), text: read(f) })) });
  return out;
}

/* ------------------------------------------------------------------ coverage */

const STATEMENT: Record<string, RegExp> = {
  scheme: /^Form$/,
  javascript: /(Statement|Declaration)$/,
  python: /(Statement|Definition)$/,
};
const COMMENT = /Comment/;

export interface Coverage {
  files: number;
  lines: number;
  chars: number;
  real: number;
  opaque: number;
  fallback: number;
  errorNodes: number;
  filesWithErrors: number;
  top: { fully: number; partly: number; none: number };
  all: { fully: number; partly: number; none: number };
  /** Lezer node type -> chars and instances that stayed uncovered (fallback) */
  missing: Record<string, { chars: number; n: number }>;
  /** the same for chars drawn as opaque text */
  opaqueTypes: Record<string, { chars: number; n: number }>;
  parseBuildMs: number;
  /** a few snippets per blamed type: the char's own token and a bit around it */
  examples: Record<string, string[]>;
}
export const emptyCoverage = (): Coverage => ({
  files: 0, lines: 0, chars: 0, real: 0, opaque: 0, fallback: 0, errorNodes: 0, filesWithErrors: 0,
  top: { fully: 0, partly: 0, none: 0 }, all: { fully: 0, partly: 0, none: 0 }, missing: {}, opaqueTypes: {}, parseBuildMs: 0, examples: {},
});

const WRAPPERS: Record<string, RegExp> = {
  scheme: /^(Program|Form|Datum|List|ListContent|AtomLike|Quoted)$/,
  javascript: /^(Script|ArgList|ParamList|ParenthesizedExpression|ForSpec|ForOfSpec)$/,
  python: /^(Script|ArgList|ParamList|ParenthesizedExpression)$/,
};

/**
 * Characters per class: 0 space or comment, 1 a real block (leaf value, keyword, or punctuation of a
 * block with slots), 2 opaque text (a recognised node drawn as its text), 3 not drawn: dropped from
 * a block that is drawn (an `else`), outside every block, or STRAY (a block built from inside a
 * construct the table has no row for: the `x` of a `throw x` shown as a block on its own).
 * Limit: punctuation inside a block with slots counts as real whether or not it is drawn.
 */
export function measure(language: string, parser: Parser, table: BlockTable, text: string, into: Coverage): void {
  const lang = lezerLanguage(parser, table);
  const t0 = performance.now();
  const roots = lang.parse(text);
  into.parseBuildMs += performance.now() - t0;
  const tree = parser.parse(text);
  const n = text.length;
  const cls = new Uint8Array(n);
  for (let i = 0; i < n; i++) cls[i] = /\s/.test(text[i]) ? 0 : 3;
  const deepId = new Int32Array(n).fill(-1);
  const attr = new Int32Array(n).fill(-1); // the Lezer node an uncovered or opaque char is blamed on
  const names: string[] = [];
  const parent: number[] = [];
  const hasKids: boolean[] = [];
  const range: string[] = [];
  const byRange = new Map<string, number>();
  const stmts: { from: number; to: number; top: boolean }[] = [];
  const stack: number[] = [];
  let errors = 0;
  const stmtRe = STATEMENT[language];
  tree.iterate({
    enter(node) {
      if (node.type.isError) errors++;
      if (COMMENT.test(node.name)) {
        for (let i = node.from; i < node.to; i++) cls[i] = 0;
        return false;
      }
      const id = names.push(node.name) - 1;
      parent.push(stack.length ? stack[stack.length - 1] : -1);
      hasKids.push(false);
      if (stack.length) hasKids[stack[stack.length - 1]] = true;
      const key = node.from + ":" + node.to;
      range.push(key);
      if (!byRange.has(key)) byRange.set(key, id);
      deepId.fill(id, node.from, node.to);
      if (stmtRe.test(node.name) && node.to > node.from) stmts.push({ from: node.from, to: node.to, top: stack.length === 1 });
      stack.push(id);
      return undefined;
    },
    leave() {
      stack.pop();
    },
  });
  // ranges of the blocks with slots: a Lezer ancestor with such a range is a block that encloses
  const compound = new Set<string>();
  const collectC = (b: BNode): void => {
    if (b.slots.length) compound.add(b.from + ":" + b.to);
    for (const s of b.slots) for (const c of s.nodes) collectC(c);
  };
  roots.forEach(collectC);
  const wrap = WRAPPERS[language];
  /** the nearest ancestor of block `b`'s Lezer node that is neither a block nor a plain wrapper, or -1 */
  const stray = (b: BNode): number => {
    let id = byRange.get(b.from + ":" + b.to);
    if (id === undefined) return -1;
    for (let a = parent[id]; a >= 0; a = parent[a]) {
      if (compound.has(range[a])) return -1;
      if (!wrap.test(names[a])) return a;
    }
    return -1;
  };
  const fill = (b: BNode, c: number, blame: number): void => {
    for (let i = b.from; i < b.to; i++) if (cls[i] !== 0) { cls[i] = c; attr[i] = blame; }
  };
  const mark = (b: BNode): void => {
    if (b.to <= b.from || b.kind === "error") return;
    const sa = stray(b);
    if (sa >= 0) return fill(b, 3, sa);
    if (b.kind === "unknown" && b.slots.length === 0) return fill(b, 2, byRange.get(b.from + ":" + b.to) ?? -1);
    if (b.slots.length === 0) return fill(b, 1, -1);
    const kwFrom = b.keyword && b.keywordTo !== undefined ? b.keywordTo - b.keyword.length : -1;
    for (let i = b.from; i < b.to; i++) {
      if (cls[i] === 0) continue;
      if (!/[\w$]/.test(text[i]) || (i >= kwFrom && i < (b.keywordTo ?? -1))) cls[i] = 1;
    }
    for (const s of b.slots) for (const c of s.nodes) mark(c);
  };
  for (const r of roots) if (r.kind !== "comment") mark(r);
  // totals, and who is to blame
  let real = 0, opaque = 0, fallback = 0;
  const seen = new Set<string>();
  for (let i = 0; i < n; i++) {
    const c = cls[i];
    if (c === 1) real++;
    else if (c === 2 || c === 3) {
      let blame = attr[i];
      let nm = "(outside any node)";
      if (blame >= 0) nm = names[blame];
      else if (deepId[i] >= 0) {
        // dropped from a block that is drawn: name the piece and the block that left it out ("IfStatement>ExpressionStatement"),
        // else the outermost construct under the top node
        let child = deepId[i];
        while (parent[child] >= 0 && !compound.has(range[parent[child]]) && parent[parent[child]] >= 0) child = parent[child];
        const par = parent[child];
        blame = child;
        nm = par >= 0 && compound.has(range[par]) ? names[par] + ">" + names[child] : names[child];
      }
      const into2 = c === 2 ? into.opaqueTypes : into.missing;
      const e = (into2[nm] ??= { chars: 0, n: 0 });
      e.chars++;
      const k = c + ":" + blame + ":" + nm;
      if (!seen.has(k)) {
        seen.add(k);
        e.n++;
        if (c === 3) {
          const ex = (into.examples[nm] ??= []);
          if (ex.length < 3) ex.push(JSON.stringify(text.slice(Math.max(0, i - 15), i + 25)) + " @ token " + (names[deepId[i]] ?? "?"));
        }
      }
      if (c === 2) opaque++;
      else fallback++;
    }
  }
  into.files++;
  into.lines += text.split("\n").length;
  into.chars += real + opaque + fallback;
  into.real += real;
  into.opaque += opaque;
  into.fallback += fallback;
  into.errorNodes += errors;
  if (errors) into.filesWithErrors++;
  for (const s of stmts) {
    let r = 0, o = 0;
    for (let i = s.from; i < s.to; i++) {
      if (cls[i] === 1) r++;
      else if (cls[i] >= 2) o++;
    }
    if (r + o === 0) continue;
    const k = o === 0 ? "fully" : r === 0 ? "none" : "partly";
    into.all[k]++;
    if (s.top) into.top[k]++;
  }
}

/** lines of a table file: its length, the rows of `nodes`, the lines of `rules` */
export function tableLines(language: string): { file: number; nodes: number; rules: number } {
  const lines = read(path.join(__dirname, "..", "src", `lang-${language}.ts`)).split("\n");
  const between = (open: RegExp, close: RegExp): number => {
    const i = lines.findIndex((l) => open.test(l));
    if (i < 0) return 0;
    if (close.test(lines[i])) return 1;
    let n = 0;
    for (let j = i + 1; j < lines.length && !close.test(lines[j]); j++) n++;
    return n;
  };
  return { file: lines.length, nodes: between(/^  nodes: \{$/, /^  \},$/), rules: between(/^  rules: \[/, /^  \],?$|^  rules: \[.*\],$/) };
}
