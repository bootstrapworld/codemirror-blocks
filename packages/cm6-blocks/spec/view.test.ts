/*
 * jsdom has no layout, so CodeMirror 6 runs here with the shims below (the only
 * ones it needed): Range.getClientRects / getBoundingClientRect, which its
 * measuring reads. Selection, focus and scrolling are what jsdom gives (weak):
 * the tests of focus say what they could and could not check.
 */
import { redo, undo } from "@codemirror/commands";
import { Transaction } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { applyText, children, walk } from "../src/doc";
import { wescheme } from "../src/wescheme";
import { BlockEditor, checkEditor, createBlockEditor } from "../src/view";
import { BNode, Slot, TextChange } from "../src/types";

// ---- shims
const zeroRect = {
  x: 0, y: 0, width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0,
  toJSON: () => ({}),
};
if (!Range.prototype.getClientRects) {
  Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
}
if (!Range.prototype.getBoundingClientRect) {
  Range.prototype.getBoundingClientRect = () => zeroRect as DOMRect;
}

const L = wescheme;
const made: BlockEditor[] = [];

function make(text: string): BlockEditor {
  const parent = document.createElement("div");
  document.body.appendChild(parent);
  const ed = createBlockEditor(parent, text, L);
  made.push(ed);
  return ed;
}
afterEach(() => {
  while (made.length) {
    const ed = made.pop() as BlockEditor;
    const parent = ed.view.dom.parentElement;
    ed.destroy();
    parent?.remove();
  }
});

const text = (ed: BlockEditor) => ed.view.state.doc.toString();
const roots = (ed: BlockEditor) => ed.doc.program.slots[0].nodes;
function slotOf(node: BNode, name: string): Slot {
  const s = node.slots.find((x) => x.name === name);
  if (!s) throw new Error(`no slot ${name} in ${node.kind}`);
  return s;
}
function find(ed: BlockEditor, t: string, kind?: string): BNode {
  let found: BNode | null = null;
  const s = text(ed);
  walk(ed.doc.program, (n) => {
    if (!found && n.kind !== "program" && s.slice(n.from, n.to) === t && (!kind || n.kind === kind)) found = n;
  });
  if (!found) throw new Error(`no node with text ${t} in ${s}`);
  return found;
}
function expectOk(ed: BlockEditor): void {
  expect(checkEditor(ed)).toEqual([]);
}
/** the element of every node that has one, by node (to see which stay the same objects) */
function elements(ed: BlockEditor): Map<BNode, HTMLElement> {
  const m = new Map<BNode, HTMLElement>();
  walk(ed.doc.program, (n) => {
    if (n.kind !== "program" && ed.renderer.has(n)) m.set(n, ed.renderer.element(n));
  });
  return m;
}
function type(ed: BlockEditor, from: number, to: number, insert: string): void {
  ed.view.dispatch({ changes: { from, to, insert } });
}
const blockDom = (ed: BlockEditor) => Array.from(ed.view.contentDOM.querySelectorAll(":scope > .cm-line > .blocks-node"));

describe("construction", () => {
  it("draws the roots as widgets in block mode; plain text is still the document", () => {
    const ed = make("(f a b)\n; note\n(g 1)\n42");
    expect(text(ed)).toBe("(f a b)\n; note\n(g 1)\n42");
    expect(roots(ed).map((r) => r.kind)).toEqual(["call", "call", "literal"]);
    expectOk(ed);
    expect(blockDom(ed).length).toBe(3);
    expect(ed.view.contentDOM.getAttribute("role")).toBe("tree");
    expect(ed.view.contentDOM.getAttribute("aria-label")).toBeTruthy();
    expect(ed.stats().widgetsBuilt).toBe(3);
    // every drawn block is the renderer's element for its root
    roots(ed).forEach((r) => expect(blockDom(ed)).toContain(ed.renderer.element(r)));
  });

  it("a text that does not parse is error roots, shown as text", () => {
    const ed = make("(f a\n(g 1)");
    expect(roots(ed).map((r) => r.kind)).toEqual(["error"]);
    expectOk(ed);
    expect(blockDom(ed).length).toBe(0);
    expect(ed.view.contentDOM.textContent).toContain("(f a");
  });

  it("parse gives detached nodes and throws on bad text", () => {
    const ed = make("(f)");
    expect(ed.parse("(g 1)")[0].kind).toBe("call");
    expect(() => ed.parse("(g")).toThrow();
  });
});

describe("operations", () => {
  it("insert: one transaction, text and tree and page agree, the rest of the page is the same objects", () => {
    const ed = make("(f a b)\n(g 1)\n(h)");
    const before = elements(ed);
    const [r0, r1, r2] = roots(ed);
    const a = find(ed, "a");
    let dispatches = 0;
    const orig = ed.view.dispatch.bind(ed.view);
    ed.view.dispatch = ((...args: unknown[]) => {
      dispatches++;
      return (orig as (...a: unknown[]) => void)(...args);
    }) as typeof ed.view.dispatch;
    ed.insert(slotOf(r0, "args"), 1, ed.parse("x")[0]);
    expect(dispatches).toBe(1);
    expect(text(ed)).toBe("(f a x b)\n(g 1)\n(h)");
    expect(text(ed).length).toBe(ed.doc.program.to);
    expectOk(ed);
    expect(roots(ed)).toEqual([r0, r1, r2]);
    expect(ed.renderer.element(r0)).toBe(before.get(r0));
    expect(ed.renderer.element(r1)).toBe(before.get(r1));
    expect(ed.renderer.element(r2)).toBe(before.get(r2));
    expect(ed.renderer.element(a)).toBe(before.get(a));
    expect(blockDom(ed)).toEqual([before.get(r0), before.get(r1), before.get(r2)]);
    // aria numbering of the siblings was patched
    const sizes = slotOf(r0, "args").nodes.map((n) => ed.renderer.element(n).getAttribute("aria-setsize"));
    expect(sizes).toEqual(["3", "3", "3"]);
    expect(ed.stats().ops).toBe(1);
    expect(ed.stats().reparses).toBe(0);
  });

  it("insert a root, remove a root, replace a root", () => {
    const ed = make("(a)\n(b)\n(c)");
    const before = elements(ed);
    const [a, b, c] = roots(ed);
    ed.insert(ed.doc.program.slots[0], 1, ed.parse("(new 1)")[0]);
    expect(text(ed)).toBe("(a)\n(new 1)\n(b)\n(c)");
    expectOk(ed);
    expect(ed.renderer.element(a)).toBe(before.get(a));
    expect(ed.renderer.element(b)).toBe(before.get(b));
    expect(ed.renderer.element(c)).toBe(before.get(c));
    expect(blockDom(ed).length).toBe(4);
    ed.remove(b);
    expect(text(ed)).toBe("(a)\n(new 1)\n(c)");
    expectOk(ed);
    expect(ed.renderer.has(b)).toBe(false);
    expect(blockDom(ed).length).toBe(3);
    const mid = roots(ed)[1];
    ed.replace(mid, ed.parse("[z 2 3]")[0]);
    expect(text(ed)).toBe("(a)\n[z 2 3]\n(c)");
    expectOk(ed);
    expect(ed.renderer.has(mid)).toBe(false);
    expect(ed.renderer.element(a)).toBe(before.get(a));
    expect(ed.renderer.element(c)).toBe(before.get(c));
    expect(ed.stats().ops).toBe(3);
  });

  it("remove and replace nested nodes; the siblings keep their elements", () => {
    const ed = make("(f (g 1) (h 2) 3)\n(k)");
    const before = elements(ed);
    const g = find(ed, "(g 1)");
    const h = find(ed, "(h 2)");
    const k = roots(ed)[1];
    ed.remove(g);
    expect(text(ed)).toBe("(f (h 2) 3)\n(k)");
    expectOk(ed);
    expect(ed.renderer.element(h)).toBe(before.get(h));
    expect(ed.renderer.element(k)).toBe(before.get(k));
    ed.replace(h, ed.parse("zz")[0]);
    expect(text(ed)).toBe("(f zz 3)\n(k)");
    expectOk(ed);
    expect(ed.renderer.element(roots(ed)[0])).toBe(before.get(roots(ed)[0]));
  });

  it("an operation that makes the text read as something else settles: a root becomes a definition (new element)", () => {
    const ed = make("(f a b)\n(g)");
    const before = elements(ed);
    const [r0, r1] = roots(ed);
    ed.replace(find(ed, "f"), ed.parse("define")[0]);
    expect(text(ed)).toBe("(define a b)\n(g)");
    expectOk(ed);
    expect(roots(ed)[0]).not.toBe(r0);
    expect(roots(ed)[0].kind).toBe("define");
    expect(roots(ed)[1]).toBe(r1);
    expect(ed.renderer.element(r1)).toBe(before.get(r1));
    expect(blockDom(ed)).toContain(ed.renderer.element(roots(ed)[0]));
    expect(ed.renderer.has(r0)).toBe(false);
    // and a root that goes from () to a call
    const ed2 = make("()");
    ed2.insert(slotOf(roots(ed2)[0], "elts"), 0, ed2.parse("x")[0]);
    expect(text(ed2)).toBe("(x)");
    expect(roots(ed2)[0].kind).toBe("call");
    expectOk(ed2);
  });

  it("each operation is its own undo step, and undo / redo bring the text back", () => {
    const ed = make("(f a)\n(g)\n(h)");
    const start = text(ed);
    const [r0, , r2] = roots(ed);
    const before = elements(ed);
    ed.insert(slotOf(r0, "args"), 1, ed.parse("x")[0]);
    ed.remove(find(ed, "(g)"));
    ed.replace(roots(ed)[1], ed.parse("(new)")[0]);
    const end = text(ed);
    expect(end).toBe("(f a x)\n(new)");
    expectOk(ed);

    undo(ed.view);
    expect(text(ed)).toBe("(f a x)\n(h)");
    expectOk(ed);
    undo(ed.view);
    expect(text(ed)).toBe("(f a x)\n(g)\n(h)");
    expectOk(ed);
    undo(ed.view);
    expect(text(ed)).toBe(start);
    expectOk(ed);
    expect(undo(ed.view)).toBe(false);

    redo(ed.view);
    redo(ed.view);
    redo(ed.view);
    expect(text(ed)).toBe(end);
    expectOk(ed);
    // the roots whose text did not change are the same objects with the same elements
    expect(ed.stats().reparses).toBe(6);
    expect(roots(ed).length).toBe(2);
    // r0 was changed by the first op; its text came back (new node), r2 was removed and came back (new node)
    expect(roots(ed)[0]).not.toBe(r0);
    expect(before.get(r2)).toBeDefined();
  });

  it("undo of an operation inside a root reads that root again, and leaves the other roots alone", () => {
    const ed = make("(a 1)\n(b 2)\n(c 3)");
    const [a, b, c] = roots(ed);
    const els = elements(ed);
    ed.insert(slotOf(b, "args"), 1, ed.parse("x")[0]);
    expect(roots(ed)[1]).toBe(b);
    undo(ed.view);
    expect(text(ed)).toBe("(a 1)\n(b 2)\n(c 3)");
    expectOk(ed);
    expect(roots(ed)[0]).toBe(a);
    expect(roots(ed)[2]).toBe(c);
    expect(ed.renderer.element(a)).toBe(els.get(a));
    expect(ed.renderer.element(c)).toBe(els.get(c));
    expect(roots(ed)[1]).not.toBe(b); // new node: its text is not what the undone change left
  });
});

describe("text edits and the tree", () => {
  it("typing inside a root, between roots", () => {
    const ed = make("(f a)\n\n(g b)");
    const [r0, r1] = roots(ed);
    const els = elements(ed);
    const before = ed.stats().reparses;
    type(ed, text(ed).indexOf("b"), text(ed).indexOf("b"), "x");
    expect(text(ed)).toBe("(f a)\n\n(g xb)");
    expectOk(ed);
    expect(ed.stats().reparses).toBe(before + 1);
    expect(roots(ed)[0]).toBe(r0);
    expect(ed.renderer.element(r0)).toBe(els.get(r0));
    expect(roots(ed)[1]).not.toBe(r1);
    // between roots
    type(ed, 6, 6, "; note");
    expect(text(ed)).toBe("(f a)\n; note\n(g xb)");
    expectOk(ed);
    expect(roots(ed)[0]).toBe(r0);
    // a new form between
    type(ed, 6, 6, "(p)\n");
    expect(roots(ed).map((r) => r.kind)).toEqual(["call", "call", "call"]);
    expectOk(ed);
  });

  it("break a bracket: the text is shown; fix it: blocks come back", () => {
    const ed = make("(f a)\n(g)\n(h)");
    const els = elements(ed);
    const g = roots(ed)[1];
    const h = roots(ed)[2];
    type(ed, 4, 5, "");
    expect(roots(ed).map((r) => r.kind)).toEqual(["error", "call", "call"]);
    expectOk(ed);
    expect(blockDom(ed).length).toBe(2);
    expect(ed.view.contentDOM.textContent).toContain("(f a");
    expect(roots(ed)[1]).toBe(g);
    expect(ed.renderer.element(g)).toBe(els.get(g));
    type(ed, 4, 4, ")");
    expect(roots(ed).map((r) => r.kind)).toEqual(["call", "call", "call"]);
    expectOk(ed);
    expect(blockDom(ed).length).toBe(3);
    expect(roots(ed)[1]).toBe(g);
    expect(roots(ed)[2]).toBe(h);
    expect(ed.renderer.element(h)).toBe(els.get(h));
  });

  it("a multi-range change, a paste of several forms, a select-all replace", () => {
    const ed = make("(a)\n(b)\n(c)\n(d)");
    const [a, , , d] = roots(ed);
    // two ranges at once: turn b into (bb) and c into (cc)
    ed.view.dispatch({
      changes: [
        { from: 5, to: 5, insert: "b" },
        { from: 9, to: 9, insert: "c" },
      ],
    });
    expect(text(ed)).toBe("(a)\n(bb)\n(cc)\n(d)");
    expectOk(ed);
    expect(roots(ed)[0]).toBe(a);
    expect(roots(ed)[3]).toBe(d);
    // two transactions in one dispatch
    const s1 = ed.view.state.update({ changes: { from: 0, to: 0, insert: "(z)\n" } });
    const s2 = s1.state.update({ changes: { from: s1.state.doc.length, insert: "\n(y)" } });
    ed.view.dispatch([s1, s2]);
    expect(text(ed)).toBe("(z)\n(a)\n(bb)\n(cc)\n(d)\n(y)");
    expectOk(ed);
    // paste
    type(ed, 0, 0, "(p 1)\n(q 2)\n(r 3)\n");
    expect(roots(ed).length).toBe(9);
    expectOk(ed);
    // replace everything
    type(ed, 0, text(ed).length, "(only)");
    expect(roots(ed).length).toBe(1);
    expectOk(ed);
    type(ed, 0, text(ed).length, "");
    expect(roots(ed).length).toBe(0);
    expectOk(ed);
  });

  it("an operation after typing, and typing after an operation", () => {
    const ed = make("(a)\n(b)");
    type(ed, 3, 3, "\n(m)");
    ed.insert(slotOf(roots(ed)[0], "args"), 0, ed.parse("x")[0]);
    expect(text(ed)).toBe("(a x)\n(m)\n(b)");
    expectOk(ed);
    type(ed, 0, 0, "(first)\n");
    expectOk(ed);
    ed.remove(roots(ed)[1]);
    expectOk(ed);
    expect(text(ed)).toBe("(first)\n(m)\n(b)");
  });
});

describe("block mode", () => {
  it("off: plain text and attributes gone, the tree kept up to date; on: blocks again", () => {
    const ed = make("(f a)\n(g)");
    expect(blockDom(ed).length).toBe(2);
    ed.setBlockMode(false);
    expect(blockDom(ed).length).toBe(0);
    expect(ed.view.contentDOM.getAttribute("role")).not.toBe("tree");
    expect(ed.view.contentDOM.textContent).toContain("(f a)");
    expectOk(ed);
    type(ed, 5, 5, "\n(h 1)");
    expect(roots(ed).length).toBe(3);
    expectOk(ed);
    ed.insert(slotOf(roots(ed)[0], "args"), 1, ed.parse("zz")[0]);
    expect(text(ed)).toBe("(f a zz)\n(h 1)\n(g)");
    expectOk(ed);
    expect(blockDom(ed).length).toBe(0);
    ed.setBlockMode(true);
    expect(blockDom(ed).length).toBe(3);
    expect(ed.view.contentDOM.getAttribute("role")).toBe("tree");
    expectOk(ed);
    // still editable
    ed.remove(roots(ed)[1]);
    expectOk(ed);
    expect(blockDom(ed).length).toBe(2);
  });

  it("the decorations are atomic ranges (one provider in block mode: the same set), none in plain mode", () => {
    const ed = make("(f a)\n(g)\n42");
    const provide = () => ed.view.state.facet(EditorView.atomicRanges);
    expect(provide().length).toBe(1);
    const set = provide()[0](ed.view);
    expect(set.size).toBe(3);
    const spans: [number, number][] = [];
    set.between(0, 100, (from, to) => void spans.push([from, to]));
    expect(spans).toEqual(roots(ed).map((r) => [r.from, r.to]));
    ed.setBlockMode(false);
    expect(provide().length).toBe(0);
    ed.setBlockMode(true);
    expect(provide().length).toBe(1);
  });

  it("a text edit is drawn once, from the final state (one view.update, one extra transaction inside it)", () => {
    const ed = make("(f a)\n(g)");
    let updates = 0;
    let sizes: number[] = [];
    const orig = ed.view.update.bind(ed.view);
    ed.view.update = ((trs: readonly Transaction[]) => {
      updates++;
      sizes.push(trs.length);
      return orig(trs);
    }) as typeof ed.view.update;
    type(ed, 2, 2, "x");
    expect(updates).toBe(1);
    expect(sizes).toEqual([2]); // the edit, and the effects of the roots
    sizes = [];
    ed.insert(slotOf(roots(ed)[0], "args"), 0, ed.parse("q")[0]);
    expect(sizes).toEqual([1]);
    type(ed, 0, 0, "; between\n"); // no change of roots: no extra transaction
    expect(sizes).toEqual([1, 1]);
    expectOk(ed);
  });
});

/* ----------------------------------------------------------------- focus */

describe("focus", () => {
  it("a focused block keeps focus through an operation elsewhere and inside its own parent", () => {
    const ed = make("(f (g 1) (h 2))\n(k 3)\n(m)");
    const g = find(ed, "(g 1)");
    const el = ed.renderer.element(g);
    el.focus();
    // what jsdom lets us check: that focus() on a block works at all
    expect(document.activeElement).toBe(el);
    expect(ed.focusedNode()).toBe(g);

    // elsewhere: another root
    ed.insert(slotOf(roots(ed)[1], "args"), 1, ed.parse("x")[0]);
    expect(document.activeElement).toBe(el);
    expect(ed.stats().focusRestores).toBe(0);
    // elsewhere: after it in the same root, and a sibling inside its parent
    ed.insert(slotOf(roots(ed)[0], "args"), 2, ed.parse("y")[0]);
    expect(document.activeElement).toBe(el);
    expect(ed.stats().focusRestores).toBe(0);
    // inside the block itself
    ed.insert(slotOf(g, "args"), 1, ed.parse("z")[0]);
    expect(document.activeElement).toBe(el);
    expect(ed.stats().focusRestores).toBe(0);
    expect(ed.focusedNode()).toBe(g);
    expectOk(ed);
  });

  it("when the focused block is removed, focus goes to the node at its place (and is counted)", () => {
    const ed = make("(f (g 1) (h 2) (i 3))");
    const h = find(ed, "(h 2)");
    ed.renderer.element(h).focus();
    expect(ed.focusedNode()).toBe(h);
    ed.remove(h);
    expect(text(ed)).toBe("(f (g 1) (i 3))");
    // the element left the page; the editor gave the focus to the node now at that index
    const now = ed.focusedNode();
    expect(now).toBe(find(ed, "(i 3)"));
    expect(ed.stats().focusRestores).toBe(1);
    expectOk(ed);
  });

  it("when the focused root is rebuilt (undo), focus goes to the node at the same place", () => {
    const ed = make("(a 1)\n(b 2)\n(c 3)");
    ed.insert(slotOf(roots(ed)[1], "args"), 1, ed.parse("x")[0]);
    const inner = find(ed, "x");
    ed.focusNode(inner);
    expect(ed.focusedNode()).toBe(inner);
    undo(ed.view); // reads root b again: its nodes are new
    expect(text(ed)).toBe("(a 1)\n(b 2)\n(c 3)");
    expectOk(ed);
    // x is gone; its place is index 1 of the args of b, which now holds `2`
    const now = ed.focusedNode();
    expect(now).not.toBeNull();
    expect(now && text(ed).slice(now.from, now.to)).toBe("2");
    expect(ed.stats().focusRestores).toBe(1);
  });

  it("an edit before the focused block's line makes CodeMirror move its element: focus is lost and given back (counted)", () => {
    const ed = make("(f (g 1) (h 2))\n(k 3)");
    const g = find(ed, "(g 1)");
    const root = roots(ed)[0];
    const line = ed.renderer.element(root).parentElement;
    ed.focusNode(g);
    expect(ed.focusedNode()).toBe(g);
    const built = ed.stats().widgetsBuilt;
    // a root inserted at the very start shares the line of the first root
    ed.insert(ed.doc.program.slots[0], 0, ed.parse("(new)")[0]);
    expectOk(ed);
    // what CodeMirror did (observed): it called toDOM again for the root, which returned the SAME element,
    // and put it in another line element; jsdom, like a browser, drops the focus of an element that moves
    const moved = ed.renderer.element(root).parentElement !== line;
    const restores = ed.stats().focusRestores;
    console.info(`edit before the focused line: widgets built +${ed.stats().widgetsBuilt - built}, line element replaced: ${moved}, focus restores: ${restores}`);
    expect(ed.focusedNode()).toBe(g);
    expect(restores).toBe(moved ? 1 : 0);
    // an edit in a later line leaves it alone
    const before = ed.stats().focusRestores;
    ed.insert(slotOf(roots(ed)[2], "args"), 0, ed.parse("z")[0]);
    expect(ed.stats().focusRestores).toBe(before);
    expect(ed.focusedNode()).toBe(g);
  });

  it("nothing is restored when nothing had the focus", () => {
    const ed = make("(a 1)\n(b 2)");
    ed.insert(slotOf(roots(ed)[0], "args"), 0, ed.parse("x")[0]);
    undo(ed.view);
    expect(ed.stats().focusRestores).toBe(0);
    expect(ed.focusedNode()).toBeNull();
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

// No `|`, and no edit that leaves a lone `.` or `..`: the vendored reader does not return on those (see model.test.ts).
function dotsOk(s: string): boolean {
  return (s.match(/\.+/g) ?? []).every((r) => r === "...");
}
const PIECES = [
  "(", ")", "[", "]", '"', "a", "x1", " ", "\n", "(f 1)", "'", " ;c\n", "define", "...", "()", "[]", '""',
  "(define (g y) y)", "\n\n", "1 2", "#t", "cond", "lambda", "(cond [a 1])",
];
const SNIPPETS = ["x", "42", '"hi"', "...", "(f a b)", "(g)", "(h (i 1) [j 2])", "(cond [(a) 1] [else 2])",
  "(define (k p) (+ p 1))", "(lambda (u) u)", "(if a b c)", "define", "if", "()", "(define)"];
const CLAUSES = ["[a 1]", "[else 2 3]", "[b]"];
const START = [
  "(define (f x y) (if (> x y) x y))\n(define z 5)\n(f z 3)",
  "(cond [(= x 1) \"one\"] [else \"many\"])\n; a comment\n(lambda (a b) (+ a b))",
  "(a)(b c)\n\n   [d (e)]   ; end\n",
  "",
];

function benign(ed: BlockEditor): boolean {
  return roots(ed).every((r) => r.kind !== "error" || !/["#;'`,&]/.test(r.value ?? ""));
}

describe("fuzzer", () => {
  it("100 seeds x 30 steps of operations, text edits, undo and redo: text, tree, decorations and page agree", () => {
    const seeds = Number(process.env.CMB_SEEDS) || 100;
    const tally = { op: 0, edit: 0, undo: 0, redo: 0 };
    let restores = 0;
    let lastPage = 0;
    let focusedSteps = 0;
    let lost = 0; // steps after which a block that had the focus has none, and nothing to give it to
    for (let seed = 1; seed <= seeds; seed++) {
      const rnd = mulberry32(seed * 104729);
      const pick = <T,>(xs: T[]): T => xs[Math.floor(rnd() * xs.length)];
      const ed = make(START[seed % START.length]);
      const log: string[] = [];
      const fail = (i: number, msg: string): never => {
        throw new Error(`seed ${seed} step ${i}: ${msg}\ntext: ${JSON.stringify(text(ed))}\nlog:\n  ${log.join("\n  ")}`);
      };
      for (let i = 0; i < 30; i++) {
        // sometimes give a block the focus first
        if (rnd() < 0.3) {
          const drawn: BNode[] = [];
          walk(ed.doc.program, (n) => {
            if (n.kind !== "program" && n.kind !== "error" && ed.renderer.has(n)) drawn.push(n);
          });
          if (drawn.length > 0) ed.focusNode(pick(drawn));
        }
        const hadFocus = ed.focusedNode() !== null;
        try {
          const r = rnd();
          if (r < 0.4 && benign(ed)) {
            tally.op++;
            const nodes: BNode[] = [];
            const slots: Slot[] = [];
            walk(ed.doc.program, (n) => {
              if (n.kind === "error") return;
              if (n.kind !== "program") nodes.push(n);
              for (const s of n.slots) if (s.kind === "list") slots.push(s);
            });
            const k = rnd();
            if (k < 0.3 && nodes.length > 0) {
              const n = pick(nodes);
              log.push(`remove ${n.kind} [${n.from},${n.to})`);
              ed.remove(n);
            } else if (k < 0.65 || nodes.length === 0) {
              const s = pick(slots);
              const index = Math.floor(rnd() * (s.nodes.length + 1));
              const src = s.name === "clauses" ? pick(CLAUSES) : pick(SNIPPETS);
              log.push(`insert ${src} into ${s.owner.kind}.${s.name} at ${index}`);
              const node = s.name === "clauses" ? (L.parseAs as NonNullable<typeof L.parseAs>)("clause", src, 0) : L.parse(src)[0];
              if (!node) fail(i, "cannot make a clause");
              ed.insert(s, index, node as BNode);
            } else {
              const n = pick(nodes);
              const src = n.kind === "clause" ? pick(CLAUSES) : pick(SNIPPETS);
              log.push(`replace ${n.kind} [${n.from},${n.to}) with ${src}`);
              const node = n.kind === "clause" ? (L.parseAs as NonNullable<typeof L.parseAs>)("clause", src, 0) : L.parse(src)[0];
              if (!node) fail(i, "cannot make a clause");
              ed.replace(n, node as BNode);
            }
          } else if (r < 0.8) {
            const s = text(ed);
            const rs = roots(ed);
            const edge = rs.length > 0 && rnd() < 0.35 ? pick(rs) : null;
            const p = edge ? (rnd() < 0.5 ? edge.from : edge.to) : Math.floor(rnd() * (s.length + 1));
            const del = rnd() < 0.45;
            const change: TextChange = del
              ? edge && rnd() < 0.6
                ? { from: edge.from, to: edge.to, insert: "" }
                : { from: p, to: Math.min(s.length, p + 1 + Math.floor(rnd() * 5)), insert: "" }
              : { from: p, to: p, insert: pick(PIECES) };
            if (!dotsOk(applyText(s, change))) continue;
            tally.edit++;
            log.push(`edit [${change.from},${change.to}) -> ${JSON.stringify(change.insert)}`);
            type(ed, change.from, change.to, change.insert);
          } else if (r < 0.9) {
            tally.undo++;
            log.push("undo");
            undo(ed.view);
          } else {
            tally.redo++;
            log.push("redo");
            redo(ed.view);
          }
        } catch (e) {
          if (String(e).startsWith("Error: seed")) throw e;
          fail(i, String(e));
        }
        const problems = checkEditor(ed);
        if (problems.length > 0) fail(i, problems.slice(0, 5).join(" | "));
        if (hadFocus) {
          focusedSteps++;
          if (ed.focusedNode() === null) lost++;
        }
        lastPage = blockDom(ed).length;
      }
      restores += ed.stats().focusRestores;
    }
    expect(tally.op).toBeGreaterThan(seeds * 5);
    expect(tally.edit).toBeGreaterThan(seeds * 5);
    expect(tally.undo + tally.redo).toBeGreaterThan(seeds * 2);
    console.info(`view fuzzer: ${seeds} seeds, ${JSON.stringify(tally)}, focus restores ${restores}, steps that began with a focused block ${focusedSteps} (ended with none: ${lost}), last page ${lastPage} blocks`);
  });
});

// keep `children` imported for debugging helpers
void children;

describe("timing (logged, never fails on time)", () => {
  it("1500 lines in jsdom: operations and typed edits", () => {
    const program = ["(define (area r)", "  (* 3 (* r r)))", "; a comment", '(cond [(> x 1) "big"]', '      [else "small"])', "(f 1 2 (g 3))"].join("\n");
    const src = Array.from({ length: 250 }, () => program).join("\n");
    let t0 = performance.now();
    const ed = make(src);
    const createMs = performance.now() - t0;
    const rnd = mulberry32(7);
    const ops: number[] = [];
    const typed: number[] = [];
    for (let i = 0; i < 60; i++) {
      const rs = roots(ed);
      const r = rs[Math.floor(rnd() * rs.length)];
      const target = r.slots.find((s) => s.kind === "list") ?? null;
      t0 = performance.now();
      if (target) ed.insert(target, 0, ed.parse("x")[0]);
      else ed.replace(r, ed.parse("y")[0]);
      ops.push(performance.now() - t0);
      const rr = roots(ed)[Math.floor(rnd() * roots(ed).length)];
      t0 = performance.now();
      type(ed, rr.to, rr.to, " ");
      typed.push(performance.now() - t0);
    }
    expect(checkEditor(ed)).toEqual([]);
    const med = (a: number[]) => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)].toFixed(2);
    console.info(`view timing: ${roots(ed).length} roots, ${text(ed).split("\n").length} lines; create ${createMs.toFixed(0)} ms; operation median ${med(ops)} ms; typed edit between roots median ${med(typed)} ms; widgets built ${ed.stats().widgetsBuilt}`);
  });
});
