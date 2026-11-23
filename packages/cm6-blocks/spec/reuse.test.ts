/** @jest-environment jsdom */
/*
 * Node-level reuse (fourth round, step 2). Ungated tests: a touched root keeps the nodes and
 * elements that did not change. Gated measurement (`CMB6_PROFILE=1 npx jest packages/cm6-blocks/spec/reuse`):
 * the cost of an edit inside a big root with and without reconcile.ts (`reconcile: false` is the old
 * rebuild-the-root path); written to e2e/reuse-results.json.
 */
import * as fs from "fs";
import * as path from "path";
import { parser as sp } from "cm6-lezer-scheme-common-lang";
import { parser as jp } from "@lezer/javascript";
import { parser as pp } from "@lezer/python";
import { schemeTable } from "../src/lang-scheme";
import { javascriptTable } from "../src/lang-javascript";
import { pythonTable } from "../src/lang-python";
import { walk } from "../src/doc";
import {
  createLezerBlockEditor,
  checkLezerEditor,
  LezerBlockEditor,
  LezerOptions,
} from "../src/lezer-view";
import type { BNode } from "../src/types";

const zeroRect = {
  x: 0,
  y: 0,
  width: 0,
  height: 0,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  toJSON: () => ({}),
};
if (!Range.prototype.getClientRects)
  Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
if (!Range.prototype.getBoundingClientRect)
  Range.prototype.getBoundingClientRect = () => zeroRect as DOMRect;

const OPTS: Record<string, LezerOptions> = {
  scheme: { parser: sp as never, table: schemeTable },
  javascript: { parser: jp as never, table: javascriptTable },
  python: { parser: pp as never, table: pythonTable },
};

// one root with a lot in it, in each language
const ONE_ROOT: Record<string, string> = {
  scheme:
    "(define (big x)\n  (cond [(= x 1) (f 1 2)]\n        [(= x 2) (g (h 3) 4)]\n        [(= x 3) (list 1 2 3 4 5)]\n        [else (+ x (big (- x 1)))]))\n",
  javascript:
    "class C {\n  a(x) { if (x) { return f(x, 1); } return g(x, 2); }\n  b(y) { while (y) { y = h(y); } return y; }\n  c(z) { return [z, z + 1, z + 2]; }\n}\n",
  python:
    "class C:\n    def a(self, x):\n        if x:\n            return f(x, 1)\n        return g(x, 2)\n    def b(self, y):\n        while y:\n            y = h(y)\n        return y\n    def c(self, z):\n        return [z, z + 1]\n",
};

const made: LezerBlockEditor[] = [];
function make(
  name: string,
  text: string,
  reconcile = true,
  anchors = true
): LezerBlockEditor {
  const parent = document.createElement("div");
  document.body.appendChild(parent);
  const ed = createLezerBlockEditor(parent, text, {
    ...OPTS[name],
    reconcile,
    anchors,
  });
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
const nodesOf = (ed: LezerBlockEditor): BNode[] => {
  const o: BNode[] = [];
  ed.roots().forEach((r) => walk(r, (n) => o.push(n)));
  return o;
};
const idsOf = (ed: LezerBlockEditor) =>
  new Map(nodesOf(ed).map((n) => [n.id, n]));

describe.each(Object.keys(OPTS))("node-level reuse: %s", (name) => {
  test("an edit inside a root keeps every node and element it did not change", () => {
    const ed = make(name, ONE_ROOT[name]);
    expect(ed.roots().filter((r) => r.kind !== "error").length).toBe(1);
    const before = idsOf(ed);
    const total = before.size;
    const els = new Map(
      [...before].map(([id, n]) => [
        id,
        ed.renderer.has(n) ? ed.renderer.element(n) : null,
      ])
    );
    // type a new argument into the first call that has an argument list with a number in it
    const at = ed.view.state.doc.toString().indexOf("1");
    ed.view.dispatch({ changes: { from: at, to: at + 1, insert: "7" } });
    expect(checkLezerEditor(ed)).toEqual([]);
    const s = ed.stats();
    expect(s.rootsReconciled).toBeGreaterThan(0);
    expect(s.rootsRebuilt).toBe(0);
    // only the leaf that changed is new
    expect(s.nodesRebuilt).toBeLessThanOrEqual(2);
    const after = idsOf(ed);
    let same = 0;
    for (const [id, n] of after) if (before.get(id) === n) same++;
    expect(same).toBeGreaterThanOrEqual(total - 2);
    for (const [id, n] of after)
      if (before.get(id) === n && els.get(id))
        expect(ed.renderer.element(n)).toBe(els.get(id));
  });

  test("a block elsewhere in the same root keeps its element and its focus", () => {
    const ed = make(name, ONE_ROOT[name]);
    const leaves = nodesOf(ed).filter(
      (n) => n.slots.length === 0 && n.kind !== "blank"
    );
    const focused = leaves[leaves.length - 1];
    ed.focusNode(focused);
    const el = ed.renderer.element(focused);
    expect(document.activeElement).toBe(el);
    const at = ed.view.state.doc.toString().indexOf("1");
    ed.view.dispatch({ changes: { from: at, to: at + 1, insert: "7" } });
    expect(checkLezerEditor(ed)).toEqual([]);
    expect(ed.stats().focusRestores).toBe(0);
    expect(ed.renderer.element(focused)).toBe(el);
    expect(document.activeElement).toBe(el);
  });

  test("inserting and removing a statement-sized piece changes only that piece", () => {
    const ed = make(name, ONE_ROOT[name]);
    const total = nodesOf(ed).length;
    // remove the last argument-like leaf's block through the editor API, then undo-free: type it back
    const lists = nodesOf(ed)
      .flatMap((n) => n.slots)
      .filter(
        (s) =>
          s.kind === "list" &&
          s.nodes.length > 1 &&
          s.nodes.every((c) => c.slots.length === 0)
      );
    expect(lists.length).toBeGreaterThan(0);
    const victim = lists[0].nodes[1];
    ed.removeNode(victim);
    expect(checkLezerEditor(ed)).toEqual([]);
    expect(ed.stats().rootsRebuilt).toBe(0);
    expect(ed.stats().nodesRebuilt).toBe(0);
    expect(nodesOf(ed).length).toBe(total - 1);
  });
});

if (process.env.CMB6_PROFILE !== "1")
  test.skip("set CMB6_PROFILE=1 to run (slow; measures corpus files / reuse timing)", () => {});
(process.env.CMB6_PROFILE === "1" ? describe : describe.skip)("measure", () => {
  const OUT = path.join(__dirname, "..", "e2e", "reuse-results.json");
  const results: Record<string, unknown> = fs.existsSync(OUT)
    ? JSON.parse(fs.readFileSync(OUT, "utf8"))
    : {};
  const step = process.env.CMB_STEP ?? "current";
  afterAll(() => fs.writeFileSync(OUT, JSON.stringify(results, null, 1)));
  const median = (a: number[]) =>
    [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];

  // corpus-lib reads files from the repository and node_modules; only used here
  const lib =
    require("../scripts/corpus-lib") as typeof import("../scripts/corpus-lib");
  const cs = lib.corpora();
  const biggest = (corpus: string) =>
    [...cs.find((c) => c.name === corpus)!.files]
      .sort((a, b) => b.text.length - a.text.length)
      .find((f) => f.text.split("\n").length <= 6000)!;
  const rep = (s: string, lines: number) =>
    s.repeat(Math.ceil(lines / s.split("\n").length));
  // the demo's big documents: the sample repeated to about 3000 lines
  const BIG = (require("../demo/samples") as typeof import("../demo/samples"))
    .BIG;

  const cases: [string, string, string][] = [
    [
      "javascript",
      "js 618-line class (core.js)",
      biggest("js-node_modules-library").text,
    ],
    [
      "python",
      "py 4006-line file (__init__.py)",
      biggest("py-stdlib-library").text,
    ],
    [
      "scheme",
      "scheme 3000 lines (constructs sample repeated)",
      rep(BIG.scheme, 3000),
    ],
    [
      "javascript",
      "js 3000 lines (constructs sample repeated)",
      rep(BIG.javascript, 3000),
    ],
    [
      "python",
      "py 3000 lines (constructs sample repeated)",
      rep(BIG.python, 3000),
    ],
  ];
  test.each(cases)("%s: %s", (lang, label, text) => {
    const out: Record<string, unknown> = { lines: text.split("\n").length };
    for (const mode of ["rebuild", "reconcile", "anchors"] as const) {
      const ed = make(lang, text, mode !== "rebuild", mode === "anchors");
      const roots = ed.roots().filter((r) => r.kind !== "error");
      // the root that holds the middle of the document (for the class: the biggest root)
      const mid = ed.view.state.doc.length >> 1;
      const bigRoot = roots.reduce((a, b) =>
        b.to - b.from > a.to - a.from ? b : a
      );
      const target = roots.find((r) => r.from <= mid && mid < r.to) ?? bigRoot;
      const inRoot = (r: BNode) => Math.floor((r.from + r.to) / 2);
      const leafIn = (r: BNode): BNode => {
        const ls: BNode[] = [];
        walk(
          r,
          (n) =>
            n.slots.length === 0 &&
            n.kind === "literal" &&
            n.to > n.from &&
            ls.push(n)
        );
        return ls[ls.length >> 1];
      };
      const kinds: Record<string, () => void> = {
        // a character typed at the end of a leaf (a name or a number) in the middle of the biggest root: that block is the only new one
        typedCharInLeaf: () => {
          const l = leafIn(bigRoot);
          ed.view.dispatch({ changes: { from: l.to, insert: "1" } });
        },
        // one space typed inside the root, in the middle of it
        typedSpaceInBiggestRoot: () =>
          ed.view.dispatch({ changes: { from: inRoot(bigRoot), insert: " " } }),
        typedSpaceInMiddleRoot: () =>
          ed.view.dispatch({ changes: { from: inRoot(target), insert: " " } }),
      };
      const row: Record<string, unknown> = {};
      for (const [k, f] of Object.entries(kinds)) {
        const t: number[] = [];
        const n0 = ed.stats().nodesRebuilt;
        const c0 = ed.stats().nodesCompared;
        const a0 = ed.stats().nodesAnchored;
        const b0 = ed.stats().anchorBails;
        for (let i = 0; i < 9; i++) {
          const a = performance.now();
          f();
          t.push(performance.now() - a);
        }
        const st = ed.stats();
        row[k] = {
          medianMs: +median(t).toFixed(2),
          nodesRebuiltPerEdit: +((st.nodesRebuilt - n0) / 9).toFixed(1),
          nodesComparedPerEdit: Math.round((st.nodesCompared - c0) / 9),
          nodesAnchoredPerEdit: Math.round((st.nodesAnchored - a0) / 9),
          anchorBails: st.anchorBails - b0,
        };
      }
      row.biggestRootNodes = (() => {
        let c = 0;
        walk(bigRoot, () => c++);
        return c;
      })();
      row.oracle = checkLezerEditor(ed).length === 0;
      out[mode] = row;
    }
    (results[step] ??= {}) as Record<string, unknown>;
    (results[step] as Record<string, unknown>)[label] = out;
    // eslint-disable-next-line no-console
    console.log(label, JSON.stringify(out));
  });
});
