/** @jest-environment jsdom */
import { redo, undo } from "@codemirror/commands";
import { walk } from "../src/doc";
import { createLezerBlockEditor, checkLezerEditor, divergences, LezerBlockEditor, LezerOptions } from "../src/lezer-view";
import { schemeParser, schemeTable } from "../src/lang-scheme";
import { javascriptParser, javascriptTable } from "../src/lang-javascript";
import { pythonParser, pythonTable } from "../src/lang-python";
import type { BNode } from "../src/types";

const zeroRect = { x: 0, y: 0, width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0, toJSON: () => ({}) };
if (!Range.prototype.getClientRects) Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
if (!Range.prototype.getBoundingClientRect) Range.prototype.getBoundingClientRect = () => zeroRect as DOMRect;

export const LANGS: Record<string, { opts: LezerOptions; start: string[]; snippets: string[]; words: string[] }> = {
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

const made: LezerBlockEditor[] = [];
function make(opts: LezerOptions, text: string): LezerBlockEditor {
  const parent = document.createElement("div");
  document.body.appendChild(parent);
  const ed = createLezerBlockEditor(parent, text, opts);
  made.push(ed);
  return ed;
}
afterEach(() => {
  while (made.length) {
    const ed = made.pop() as LezerBlockEditor;
    const parent = ed.view.dom.parentElement;
    ed.destroy();
    parent?.remove();
  }
});
const textOf = (ed: LezerBlockEditor) => ed.view.state.doc.toString();
const ok = (ed: LezerBlockEditor) => expect(checkLezerEditor(ed)).toEqual([]);
const els = (ed: LezerBlockEditor) => ed.roots().filter((r) => r.kind !== "error").map((r) => ed.renderer.element(r));

describe.each(Object.keys(LANGS))("lezer editor: %s", (name) => {
  const L = LANGS[name];
  const START = L.start[0];

  test("construct: roots, decorations, elements", () => {
    const ed = make(L.opts, START);
    expect(ed.roots().length).toBeGreaterThan(1);
    ok(ed);
    expect(ed.view.dom.querySelectorAll(".blocks-node").length).toBeGreaterThan(ed.roots().length);
  });

  test("typing between roots and inside a root: roots away from the edit keep node and element", () => {
    const ed = make(L.opts, L.start[0] + "\n" + L.start[0]);
    const all = ed.roots().slice();
    const last = all[all.length - 1];
    const lastEl = ed.renderer.element(last);
    const first = all[0];
    ed.view.dispatch({ changes: { from: first.to, insert: "\n" + L.snippets[0] } });
    ok(ed);
    expect(ed.roots()[ed.roots().length - 1]).toBe(last);
    expect(ed.renderer.element(last)).toBe(lastEl);
    expect(ed.roots().length).toBeGreaterThan(all.length);
    const second = ed.roots()[1];
    ed.view.dispatch({ changes: { from: second.from, insert: "x" } });
    ok(ed);
    expect(ed.roots().includes(second)).toBe(false);
    expect(ed.roots()[ed.roots().length - 1]).toBe(last);
    expect(ed.renderer.element(last)).toBe(lastEl);
  });

  test("insert and remove through the editor", () => {
    const ed = make(L.opts, START);
    const n0 = ed.roots().length;
    ed.insertText(ed.doc.program.slots[0], 1, L.snippets[1]);
    ok(ed);
    expect(ed.roots().length).toBe(n0 + 1);
    expect(textOf(ed)).toContain(L.snippets[1]);
    ed.removeNode(ed.roots()[1]);
    ok(ed);
    expect(ed.roots().length).toBe(n0);
    expect(textOf(ed)).toBe(START);
    // into / out of a list slot below a root
    let target: BNode | null = null;
    for (const r of ed.roots()) walk(r, (n) => {
      if (!target && n.slots.some((s) => s.kind === "list" && s.name !== "rest" && s.nodes.length >= 2)) target = n;
    });
    expect(target).not.toBeNull();
    const slot = (target as unknown as BNode).slots.find((s) => s.kind === "list" && s.name !== "rest" && s.nodes.length >= 2)!;
    const count = slot.nodes.length;
    const t0 = textOf(ed);
    ed.insertText(slot, 1, L.snippets[0]);
    ok(ed);
    const slot2 = ed.roots().flatMap((r) => { const o: BNode[] = []; walk(r, (n) => o.push(n)); return o; }).flatMap((n) => n.slots).find((s) => s.name === slot.name && s.nodes.length === count + 1);
    expect(slot2).toBeDefined();
    ed.removeNode(slot2!.nodes[1]);
    ok(ed);
    expect(textOf(ed)).toBe(t0);
  });

  test("undo and redo", () => {
    const ed = make(L.opts, START);
    ed.insertText(ed.doc.program.slots[0], 0, L.snippets[0]);
    ed.removeNode(ed.roots()[2]);
    const after = textOf(ed);
    undo(ed.view);
    ok(ed);
    undo(ed.view);
    ok(ed);
    expect(textOf(ed)).toBe(START);
    redo(ed.view);
    redo(ed.view);
    ok(ed);
    expect(textOf(ed)).toBe(after);
  });

  test("a root far from the edit keeps its node and element", () => {
    const ed = make(L.opts, L.start[0] + "\n" + L.start[0] + "\n" + L.start[0]);
    const roots = ed.roots().slice();
    const elements = els(ed);
    ed.view.dispatch({ changes: { from: roots[0].from, to: roots[0].to, insert: L.snippets[0] } });
    ok(ed);
    const now = ed.roots();
    const keptCount = now.filter((r) => roots.includes(r)).length;
    // the edited root and its next neighbour are read again; the rest keep node and element
    expect(keptCount).toBe(roots.length - 2);
    expect(els(ed).filter((e) => elements.includes(e)).length).toBe(roots.length - 2);
  });

  test("block mode off and on", () => {
    const ed = make(L.opts, START);
    ed.setBlockMode(false);
    expect(ed.view.dom.querySelectorAll(".blocks-node").length).toBe(0);
    ed.view.dispatch({ changes: { from: 0, insert: L.snippets[0] + "\n" } });
    ed.setBlockMode(true);
    ok(ed);
    expect(ed.view.dom.querySelectorAll(".blocks-node").length).toBeGreaterThan(0);
  });
});

/* ---------------------------------------------------------------- fuzzer */

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("fuzzer", () => {
  test.each(Object.keys(LANGS))("%s: 60 seeds x 25 steps, oracle after each step", (name) => {
    const L = LANGS[name];
    const seeds = Number(process.env.CMB_SEEDS) || 60;
    let steps = 0;
    let rebuilt = 0;
    let kept = 0;
    let nodes = 0;
    let maxRoot = 0;
    let total = 0;
    for (let seed = Number(process.env.CMB_SEED) || 1; seed <= (Number(process.env.CMB_SEED) || seeds); seed++) {
      const rnd = mulberry32(seed * 7919 + name.length);
      const pick = <T,>(a: T[]): T => a[Math.floor(rnd() * a.length)];
      const ed = make(L.opts, L.start[seed % L.start.length]);
      const log: string[] = [];
      for (let i = 0; i < 25; i++) {
        const len = ed.view.state.doc.length;
        const r = rnd();
        const lists = ed.roots().flatMap((root) => { const o: BNode[] = []; walk(root, (n) => o.push(n)); return o; }).flatMap((n) => n.slots).filter((s) => s.kind === "list" && s.nodes.length > 0);
        try {
          if (r < 0.3) {
            const a = Math.floor(rnd() * (len + 1));
            const b = Math.min(len, a + Math.floor(rnd() * 4));
            const w = rnd() < 0.3 ? "" : pick(L.words);
            log.push(`text [${a},${b}) -> ${JSON.stringify(w)}`);
            ed.view.dispatch({ changes: { from: a, to: b, insert: w } });
          } else if (r < 0.55 && lists.length) {
            const s = pick(lists);
            const ix = Math.floor(rnd() * (s.nodes.length + 1));
            const sn = pick(L.snippets);
            log.push(`insert ${s.owner.kind}.${s.name}[${ix}] ${JSON.stringify(sn)}`);
            ed.insertText(s, ix, sn);
          } else if (r < 0.75 && lists.length) {
            const s = pick(lists);
            const n = pick(s.nodes);
            log.push(`remove ${n.kind} [${n.from},${n.to})`);
            ed.removeNode(n);
          } else if (r < 0.88) {
            log.push("undo");
            undo(ed.view);
          } else {
            log.push("redo");
            redo(ed.view);
          }
        } catch (e) {
          throw new Error(`seed ${seed} step ${i}: threw ${(e as Error).message}\n${log.join("\n")}`);
        }
        const problems = checkLezerEditor(ed);
        if (problems.length) {
          throw new Error(`seed ${seed} step ${i}: ${problems.join("; ")}\ntext: ${JSON.stringify(ed.view.state.doc.toString())}\nlog:\n  ${log.join("\n  ")}`);
        }
        log.push("   => " + JSON.stringify(ed.view.state.doc.toString()));
        steps++;
      }
      const st = ed.stats();
      rebuilt += st.rootsRebuilt;
      kept += st.rootsKept;
      nodes += st.nodesRebuilt;
      maxRoot = Math.max(maxRoot, st.maxRootNodes);
      total += ed.roots().length;
    }
    // eslint-disable-next-line no-console
    console.log(`${name}: ${steps} steps; roots rebuilt ${rebuilt} (mean ${(nodes / rebuilt).toFixed(1)} nodes, max ${maxRoot}), kept ${kept}; divergences from a fresh parse so far ${divergences.count}`);
  });
});
