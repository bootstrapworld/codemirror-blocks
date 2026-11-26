// shared by the fuzzers of the Lezer editor: the languages, a seeded random generator, and ONE random step (the fuzzer's own generator)
import { redo, undo } from "@codemirror/commands";
import { walk } from "../src/doc";
import {
  checkLezerEditor,
  divergences,
  type LezerBlockEditor,
  type LezerOptions,
} from "../src/lezer-view";
import { schemeParser, schemeTable } from "../src/lang-scheme";
import { javascriptParser, javascriptTable } from "../src/lang-javascript";
import { pythonParser, pythonTable } from "../src/lang-python";
import type { BNode } from "../src/types";

export type Lang = {
  opts: LezerOptions;
  start: string[];
  snippets: string[];
  words: string[];
};
export const LANGS: Record<string, Lang> = {
  scheme: {
    opts: { parser: schemeParser as never, table: schemeTable },
    start: [
      "(define x 5)\n(f 1 2)\n(if (> x 1) 2 3)",
      "(define (sq x) (* x x))\n(sq 3)\n(cond [(= x 2) 3] [else 4])\n42",
      "(a b c)\n(d)\n(e (f g) (h i))",
    ],
    snippets: ["7", "(g 1)", "x", '"s"', "(define y 2)"],
    words: [
      "(",
      ")",
      " ",
      "\n",
      "x",
      "12",
      "(f ",
      "define",
      '"',
      "[",
      "]",
      "; c\n",
      "if",
    ],
  },
  javascript: {
    opts: { parser: javascriptParser as never, table: javascriptTable },
    start: [
      "let x = 1 + 2;\nf(x, 3);\nwhile (x < 9) { x = x + 1; g(x); }",
      "function f(a, b) { return a * b; }\nf(1, 2);\nif (x) { f(1, 2); } else { g(); }",
      "a.b(c);\n[1, 2, 3];\nlet y = 5;",
    ],
    snippets: ["1", "g(2)", "x", '"s"', "[1, 2]"],
    words: [
      "(",
      ")",
      " ",
      "\n",
      "x",
      "12",
      "f(",
      ";",
      "{",
      "}",
      '"',
      "/*",
      "if (a) ",
      "//c\n",
    ],
  },
  python: {
    opts: { parser: pythonParser as never, table: pythonTable },
    start: [
      "x = 1 + 2\nf(x, 3)\nwhile x < 9:\n    x = x + 1\n    g(x)\ny = 2",
      "def f(a, b):\n    y = a\n    return y\nf(1, 2)\n",
      "if x:\n    f(1)\nelif y:\n    g()\nelse:\n    h()\n[1, 2]",
    ],
    snippets: ["1", "g(2)", "x", '"s"', "[1, 2]"],
    words: [
      "(",
      ")",
      " ",
      "\n",
      "x",
      "12",
      "f(",
      ":",
      "    ",
      "\n    ",
      '"',
      "#c\n",
      "if a:\n    b",
    ],
  },
};

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

/**
 * a block and what is in it as plain data (kind, text, slots), leaving out the blocks in `skip` and the comments (a comment is not counted,
 * and one left alone in an emptied list is no node at all: `f((a) =>//c` is `f(() =>//c` with the comment gone from the parameters)
 */
export function shape(
  n: BNode,
  skip: Set<BNode> | ((c: BNode) => boolean)
): unknown {
  const skipped = typeof skip === "function" ? skip : (c: BNode) => skip.has(c);
  return [
    n.kind,
    n.value ?? null,
    n.slots.map((sl) => [
      sl.name,
      sl.nodes
        .filter((c) => !skipped(c) && c.kind !== "comment")
        .map((c) => shape(c, skipped)),
    ]),
  ];
}
const clean = (ed: LezerBlockEditor): boolean => {
  // (a text the parser had to recover from is read as the recovery guesses: removing a block can make it guess otherwise)
  let bad = ed.modeProblem() !== null;
  for (const r of ed.roots())
    walk(r, (n) => {
      if (n.kind === "error") bad = true;
    });
  return !bad;
};
/**
 * The oracle for removals: when the tree was free of errors and only blocks of lists go, the text after the removal must parse to
 * the old tree minus the removed blocks (no stray separator may change what the text means). The tree comparison is not done for
 * Scheme: its grammar reads `(> (define y 2) 1)` as another structure than `(> 7 (define y 2) 1)` minus `7` (a call whose head is a call),
 * which is the language and not the separators; Scheme gets the text comparison and the bracket checks.
 */
// (lists of arguments, parameters, elements, statements: not the operands and operators of an expression, which are not a list of things)
const REMOVABLE = ["args", "params", "elements", "properties"];
export function removeOracle(
  ed: LezerBlockEditor,
  gone: BNode[],
  log: string[],
  shapes: boolean,
  run: () => void
): void {
  const check =
    clean(ed) &&
    gone.every(
      (n) =>
        n.slot &&
        n.slot.kind === "list" &&
        !n.slot.pieces &&
        REMOVABLE.includes(n.slot.name)
    );
  const text = ed.view.state.doc.toString();
  // (a Python `{x}` that loses its element is `{}`: an empty dict, another thing; the table has no block for a set, its elements show in the
  // parent's list, so the removal leaves braces with nothing between them: the same kind of language fact as Scheme's)
  const emptiesBraces = gone.some(
    (n) =>
      (text.slice(0, n.from).trimEnd().endsWith("{") &&
        text.slice(n.to).trimStart().startsWith("}")) ||
      // (the same for a Python grouping paren, which has no block either: `f(a, (b))` minus `b` is `f(a, ())`, an empty tuple; a paren that is
      // a call's own is told from it by what is before it: a comma or a bracket, not a name)
      (/[,([{]\s*\(\s*$/.test(text.slice(0, n.from)) &&
        text.slice(n.to).trimStart().startsWith(")"))
  );
  // (Lezer puts a skipped comment in another node when it reads on from an old tree, so the blocks the editor shows can differ from a fresh parse
  // of the same text, in where a comment is: a statement that ends without a `;` takes the comment after it. A removal that reparses far away
  // gives the other reading: then it is the parse, and not the removal, that changed the roots, and there is nothing to compare)
  const diverges = (): boolean => {
    const d0 = divergences.count;
    checkLezerEditor(ed);
    return divergences.count > d0;
  };
  const key = (n: BNode): string => `${n.kind}:${n.from}-${n.to}`;
  const goneKeys = new Set(gone.map(key));
  const mayCompare = check && shapes && !emptiesBraces;
  const editorDiverged = mayCompare && diverges();
  const before =
    mayCompare && !editorDiverged
      ? ed.roots().map((r) => shape(r, new Set(gone)))
      : null;
  // (forty-ninth round: the tree the editor holds differs from a fresh parse of the same text only in where a comment sits, so the editor's
  // tree is not what to compare with. The text itself still has a meaning: the fresh parse of the text before, minus the removed blocks
  // (found in it by kind and range), must be what a fresh parse of the text after gives. The editor's own state does not enter.)
  let beforeFresh: unknown[] | null = null;
  if (editorDiverged) {
    const present = new Set<string>();
    const fresh = ed.language.parse(text);
    fresh.forEach((r) => walk(r, (n) => present.add(key(n))));
    if (gone.every((n) => present.has(key(n))))
      beforeFresh = fresh.map((r) => shape(r, (c) => goneKeys.has(key(c))));
  }
  // the text, whatever the blocks: only the removed blocks and the blanks and commas between blocks may be different
  const norm = (x: string): string =>
    x
      .replace(/[\s,]+/g, " ")
      .replace(/ ?([()[\]{};:]) ?/g, "$1")
      .trim();
  const lists =
    check &&
    gone.length > 0 &&
    gone.every(
      (n) =>
        n.slot &&
        n.slot.kind === "list" &&
        !n.slot.pieces &&
        n.slot.owner.kind !== "program" &&
        // (a token that is no block touching the block, such as the `|...|` symbol that follows a stray `#` in `"a"#|`: the grammar has no node
        // for it, so what the removal makes of the text next to it is no separator question)
        !(
          text[n.to] !== undefined &&
          !/[\s,()[\]{};]/.test(text[n.to]) &&
          !n.slot.nodes.some((o) => o.from === n.to)
        )
    );
  let expected = "";
  if (lists) {
    let at = 0;
    for (const n of [...gone].sort((a, b) => a.from - b.from)) {
      expected += text.slice(at, n.from) + " ";
      at = n.to;
    }
    expected += text.slice(at);
  }
  run();
  if (lists && norm(ed.view.state.doc.toString()) !== norm(expected)) {
    throw new Error(
      `a removal changed more than the removed blocks and the separators\nbefore: ${JSON.stringify(text)}\nafter: ${JSON.stringify(ed.view.state.doc.toString())}\nlog: ${log.join(" | ")}`
    );
  }
  if (!before && !beforeFresh) return;
  if (!clean(ed)) return; // (the text no longer parses: a removal can break a statement, nothing to compare)
  let after: unknown[];
  if (before) {
    if (diverges()) return;
    after = ed.roots().map((r) => shape(r, new Set()));
  } else {
    after = ed.language
      .parse(ed.view.state.doc.toString())
      .map((r) => shape(r, new Set()));
  }
  const before2 = before ?? beforeFresh;
  if (JSON.stringify(before2) !== JSON.stringify(after)) {
    throw new Error(
      `a removal changed more than the removed blocks\nbefore: ${JSON.stringify(text)}\nafter: ${JSON.stringify(ed.view.state.doc.toString())}\nlog: ${log.join(" | ")}`
    );
  }
  const t = ed.view.state.doc.toString();
  const count = (re: RegExp, x: string): number => (x.match(re) ?? []).length;
  for (const [what, re] of [
    ["a blank before a closing bracket", / [)\]}]/g],
    ["a comma before a closing bracket", /,\s*[)\]}]/g],
    ["two commas", /,\s*,/g],
  ] as [string, RegExp][]) {
    // (a JavaScript elision, `[, 2]` or `[a, , b]`, is a comma that stands for a hole: the removal of what follows it leaves it, as it must)
    if (/[[,]\s*,/.test(text) && what !== "a blank before a closing bracket")
      continue;
    if (count(re, t) > count(re, text))
      throw new Error(
        `a removal left ${what}: ${JSON.stringify(t)} (was ${JSON.stringify(text)})`
      );
  }
}

/** one random step on `ed` (a text edit, an insert, a remove, a selection, a removal of the selection, undo, redo); `log` gets a line saying which */
export function randomStep(
  ed: LezerBlockEditor,
  L: Lang,
  rnd: () => number,
  log: string[]
): void {
  const pick = <T>(a: T[]): T => a[Math.floor(rnd() * a.length)];
  const len = ed.view.state.doc.length;
  const r = rnd();
  const lists = ed
    .roots()
    .flatMap((root) => {
      const o: BNode[] = [];
      walk(root, (n) => o.push(n));
      return o;
    })
    .flatMap((n) => n.slots)
    .filter((s) => s.kind === "list" && s.nodes.length > 0);
  {
    if (r < 0.3) {
      const a = Math.floor(rnd() * (len + 1));
      const b = Math.min(len, a + Math.floor(rnd() * 4));
      const w = rnd() < 0.3 ? "" : pick(L.words);
      log.push(`text [${a},${b}) -> ${JSON.stringify(w)}`);
      ed.view.dispatch({ changes: { from: a, to: b, insert: w } });
    } else if (r < 0.55 && lists.some((q) => !q.pieces)) {
      const s = pick(lists.filter((q) => !q.pieces)); // (nothing is inserted into the text of a template string)
      const ix = Math.floor(rnd() * (s.nodes.length + 1));
      const sn = pick(L.snippets);
      log.push(`insert ${s.owner.kind}.${s.name}[${ix}] ${JSON.stringify(sn)}`);
      ed.insertText(s, ix, sn);
    } else if (r < 0.75 && lists.length) {
      const s = pick(lists);
      const n = pick(s.nodes);
      log.push(`remove ${n.kind} [${n.from},${n.to})`);
      removeOracle(ed, [n], log, L !== LANGS.scheme, () => ed.removeNode(n));
    } else if (r < 0.81) {
      const every = ed
        .roots()
        .flatMap((root) => {
          const o: BNode[] = [];
          walk(root, (n) => o.push(n));
          return o;
        })
        .filter((n) => n.kind !== "error");
      if (every.length) {
        const n = pick(every);
        log.push(`select ${n.kind} [${n.from},${n.to})`);
        ed.toggleSelect(n);
      }
    } else if (r < 0.86) {
      const sel = ed.selectedBlocks().filter((n) => n.slot);
      log.push(
        `remove the selection (${sel.map((n) => `${n.kind} [${n.from},${n.to})`).join(", ")})`
      );
      if (sel.length) {
        try {
          removeOracle(ed, sel, log, L !== LANGS.scheme, () =>
            ed.removeNodes(sel)
          );
        } catch (e) {
          if (!/overlap/.test((e as Error).message)) throw e; // two removals that cannot be one change
        }
      }
    } else if (r < 0.92) {
      log.push("undo");
      undo(ed.view);
    } else {
      log.push("redo");
      redo(ed.view);
    }
  }
}
