/** @jest-environment jsdom */
import { redo, undo } from "@codemirror/commands";
import { walk } from "../src/doc";
import {
  createLezerBlockEditor,
  checkLezerEditor,
  divergences,
  LezerBlockEditor,
  LezerOptions,
} from "../src/lezer-view";
import type { BNode } from "../src/types";
import { BIG } from "../demo/samples";
import { LANGS, mulberry32, randomStep } from "./steps";

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

const made: LezerBlockEditor[] = [];
function make(opts: LezerOptions, text: string): LezerBlockEditor {
  const parent = document.createElement("div");
  document.body.appendChild(parent);
  const ed = createLezerBlockEditor(
    parent,
    text,
    process.env.CMB_NORECONCILE ? { ...opts, reconcile: false } : opts
  );
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
const els = (ed: LezerBlockEditor) =>
  ed
    .roots()
    .filter((r) => r.kind !== "error")
    .map((r) => ed.renderer.element(r));

describe.each(Object.keys(LANGS))("lezer editor: %s", (name) => {
  const L = LANGS[name];
  const START = L.start[0];

  test("construct: roots, decorations, elements", () => {
    const ed = make(L.opts, START);
    expect(ed.roots().length).toBeGreaterThan(1);
    ok(ed);
    expect(ed.view.dom.querySelectorAll(".blocks-node").length).toBeGreaterThan(
      ed.roots().length
    );
  });

  test("typing between roots and inside a root: roots away from the edit keep node and element", () => {
    const ed = make(L.opts, L.start[0] + "\n" + L.start[0]);
    const all = ed.roots().slice();
    const last = all[all.length - 1];
    const lastEl = ed.renderer.element(last);
    const first = all[0];
    ed.view.dispatch({
      changes: { from: first.to, insert: "\n" + L.snippets[0] },
    });
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
    // (a root that goes leaves its line, blank, as in the old editor)
    expect(textOf(ed)).not.toBe(START);
    expect(textOf(ed).replace("\n\n", "\n")).toBe(START);
    ed.view.dispatch({
      changes: { from: 0, to: textOf(ed).length, insert: START },
    });
    ok(ed);
    // into / out of a list slot below a root
    let target: BNode | null = null;
    for (const r of ed.roots())
      walk(r, (n) => {
        if (
          !target &&
          n.slots.some(
            (s) => s.kind === "list" && s.name !== "rest" && s.nodes.length >= 2
          )
        )
          target = n;
      });
    expect(target).not.toBeNull();
    const slot = (target as unknown as BNode).slots.find(
      (s) => s.kind === "list" && s.name !== "rest" && s.nodes.length >= 2
    )!;
    const count = slot.nodes.length;
    const t0 = textOf(ed);
    ed.insertText(slot, 1, L.snippets[0]);
    ok(ed);
    const slot2 = ed
      .roots()
      .flatMap((r) => {
        const o: BNode[] = [];
        walk(r, (n) => o.push(n));
        return o;
      })
      .flatMap((n) => n.slots)
      .find((s) => s.name === slot.name && s.nodes.length === count + 1);
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
    ed.view.dispatch({
      changes: { from: roots[0].from, to: roots[0].to, insert: L.snippets[0] },
    });
    ok(ed);
    const now = ed.roots();
    const keptCount = now.filter((r) => roots.includes(r)).length;
    // the edited root and its next neighbour are read again and laid over the old nodes (reconcile.ts); the rest keep node and element untouched
    expect(keptCount).toBeGreaterThanOrEqual(roots.length - 2);
    expect(
      els(ed).filter((e) => elements.includes(e)).length
    ).toBeGreaterThanOrEqual(roots.length - 2);
    expect(ed.stats().rootsKept).toBe(roots.length - 2);
  });

  test("block mode off and on", () => {
    const ed = make(L.opts, START);
    ed.setBlockMode(false);
    expect(ed.view.dom.querySelectorAll(".blocks-node").length).toBe(0);
    ed.view.dispatch({ changes: { from: 0, insert: L.snippets[0] + "\n" } });
    ed.setBlockMode(true);
    ok(ed);
    expect(ed.view.dom.querySelectorAll(".blocks-node").length).toBeGreaterThan(
      0
    );
  });
});

/* ---------------------------------------------------------------- fuzzer */

describe("fuzzer", () => {
  test.each(Object.keys(LANGS))(
    "%s: 60 seeds x 25 steps, oracle after each step",
    (name) => {
      const L = LANGS[name];
      fuzz(name, L, L.start, Number(process.env.CMB_SEEDS) || 60);
    }
  );
  // a larger program, with classes, nested bodies and long argument lists: node-level reuse inside a root
  test.each(Object.keys(LANGS))(
    "%s: a larger program, 20 seeds x 25 steps",
    (name) => {
      fuzz(
        name,
        LANGS[name],
        [BIG[name].split("\n").slice(0, 70).join("\n")],
        Number(process.env.CMB_BIGSEEDS) || 20
      );
    }
  );
});

function fuzz(
  name: string,
  L: (typeof LANGS)[string],
  starts: string[],
  seeds: number
): void {
  {
    let steps = 0;
    let rebuilt = 0;
    let recon = 0;
    let kept = 0;
    let nodes = 0;
    let maxRoot = 0;
    let anchors = 0;
    let bails = 0;
    for (
      let seed = Number(process.env.CMB_SEED) || 1;
      seed <= (Number(process.env.CMB_SEED) || seeds);
      seed++
    ) {
      const rnd = mulberry32(seed * 7919 + name.length);
      const ed = make(L.opts, starts[seed % starts.length]);
      const log: string[] = [];
      for (let i = 0; i < 25; i++) {
        try {
          randomStep(ed, L, rnd, log);
        } catch (e) {
          throw new Error(
            `seed ${seed} step ${i}: threw ${(e as Error).message}\n${log.join("\n")}`,
            { cause: e }
          );
        }
        const problems = checkLezerEditor(ed);
        if (problems.length) {
          throw new Error(
            `seed ${seed} step ${i}: ${problems.join("; ")}\ntext: ${JSON.stringify(ed.view.state.doc.toString())}\nlog:\n  ${log.join("\n  ")}`
          );
        }
        log.push("   => " + JSON.stringify(ed.view.state.doc.toString()));
        steps++;
      }
      const st = ed.stats();
      rebuilt += st.rootsRebuilt;
      recon += st.rootsReconciled;
      kept += st.rootsKept;
      nodes += st.nodesRebuilt;
      maxRoot = Math.max(maxRoot, st.maxRootNodes);
      anchors += st.nodesAnchored;
      bails += st.anchorBails;
    }
    // eslint-disable-next-line no-console
    console.log(
      `${name}: ${steps} steps; roots rebuilt ${rebuilt} (mean ${(nodes / rebuilt).toFixed(1)} nodes, max ${maxRoot}), reconciled ${recon}, kept ${kept}, anchors taken ${anchors}, anchor bails ${bails}; divergences from a fresh parse so far ${divergences.count}`
    );
  }
}
