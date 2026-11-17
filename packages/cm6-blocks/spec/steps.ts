// shared by the fuzzers of the Lezer editor: the languages, a seeded random generator, and ONE random step (the fuzzer's own generator)
import { redo, undo } from "@codemirror/commands";
import { walk } from "../src/doc";
import type { LezerBlockEditor, LezerOptions } from "../src/lezer-view";
import { schemeParser, schemeTable } from "../src/lang-scheme";
import { javascriptParser, javascriptTable } from "../src/lang-javascript";
import { pythonParser, pythonTable } from "../src/lang-python";
import type { BNode } from "../src/types";

export type Lang = { opts: LezerOptions; start: string[]; snippets: string[]; words: string[] };
export const LANGS: Record<string, Lang> = {
  scheme: {
    opts: { parser: schemeParser as never, table: schemeTable },
    start: ["(define x 5)\n(f 1 2)\n(if (> x 1) 2 3)", "(define (sq x) (* x x))\n(sq 3)\n(cond [(= x 2) 3] [else 4])\n42", "(a b c)\n(d)\n(e (f g) (h i))"],
    snippets: ["7", "(g 1)", "x", '"s"', "(define y 2)"],
    words: ["(", ")", " ", "\n", "x", "12", "(f ", "define", "\"", "[", "]", "; c\n", "if"],
  },
  javascript: {
    opts: { parser: javascriptParser as never, table: javascriptTable },
    start: ["let x = 1 + 2;\nf(x, 3);\nwhile (x < 9) { x = x + 1; g(x); }", "function f(a, b) { return a * b; }\nf(1, 2);\nif (x) { f(1, 2); } else { g(); }", "a.b(c);\n[1, 2, 3];\nlet y = 5;"],
    snippets: ["1", "g(2)", "x", '"s"', "[1, 2]"],
    words: ["(", ")", " ", "\n", "x", "12", "f(", ";", "{", "}", "\"", "/*", "if (a) ", "//c\n"],
  },
  python: {
    opts: { parser: pythonParser as never, table: pythonTable },
    start: ["x = 1 + 2\nf(x, 3)\nwhile x < 9:\n    x = x + 1\n    g(x)\ny = 2", "def f(a, b):\n    y = a\n    return y\nf(1, 2)\n", "if x:\n    f(1)\nelif y:\n    g()\nelse:\n    h()\n[1, 2]"],
    snippets: ["1", "g(2)", "x", '"s"', "[1, 2]"],
    words: ["(", ")", " ", "\n", "x", "12", "f(", ":", "    ", "\n    ", "\"", "#c\n", "if a:\n    b"],
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

/** one random step on `ed` (a text edit, an insert, a remove, a selection, a removal of the selection, undo, redo); `log` gets a line saying which */
export function randomStep(ed: LezerBlockEditor, L: Lang, rnd: () => number, log: string[]): void {
  const pick = <T,>(a: T[]): T => a[Math.floor(rnd() * a.length)];
    const len = ed.view.state.doc.length;
    const r = rnd();
    const lists = ed.roots().flatMap((root) => { const o: BNode[] = []; walk(root, (n) => o.push(n)); return o; }).flatMap((n) => n.slots).filter((s) => s.kind === "list" && s.nodes.length > 0);
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
        ed.removeNode(n);
      } else if (r < 0.81) {
        const every = ed.roots().flatMap((root) => { const o: BNode[] = []; walk(root, (n) => o.push(n)); return o; }).filter((n) => n.kind !== "error");
        if (every.length) {
          const n = pick(every);
          log.push(`select ${n.kind} [${n.from},${n.to})`);
          ed.toggleSelect(n);
        }
      } else if (r < 0.86) {
        const sel = ed.selectedBlocks().filter((n) => n.slot);
        log.push(`remove the selection (${sel.map((n) => `${n.kind} [${n.from},${n.to})`).join(", ")})`);
        if (sel.length) {
          try {
            ed.removeNodes(sel);
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
