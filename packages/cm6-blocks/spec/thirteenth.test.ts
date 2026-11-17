/** @jest-environment jsdom */
// Thirteenth round: difference 11 (content hash), cut with nothing selected, finding 13, paste over a selection, the define shape
import { undo } from "@codemirror/commands";
import { contentHash } from "../src/hash";
import { keyOfNode } from "../src/lezer";
import { walk } from "../src/doc";
import { checkLezerEditor } from "../src/lezer-view";
import { LANGS, mulberry32, randomStep } from "./steps";
import { make, TEXT } from "./helpers";
import { undoDepth } from "@codemirror/commands";
import type { SoundEvent, SoundName } from "../src/sound";
import type { LezerBlockEditor } from "../src/lezer-view";
import type { BNode } from "../src/types";

const text = (ed: LezerBlockEditor) => ed.view.state.doc.toString();
const lits = (ed: LezerBlockEditor): BNode[] => {
  const o: BNode[] = [];
  ed.roots().forEach((r) => walk(r, (n) => o.push(n)));
  return o.filter((n) => n.kind === "literal");
};
const clipEvent = (type: string, data: { v: string }): Event => {
  const e = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(e, "clipboardData", { value: { setData: (_t: string, v: string) => (data.v = v), getData: () => data.v } });
  return e;
};
const rig = (l: string, src?: string) => {
  const heard: [SoundName, SoundEvent][] = [];
  return { ed: make(l, src, { playSound: (s, e) => heard.push([s, e]) }), heard };
};

describe("11. the content hash", () => {
  const h = (ed: ReturnType<typeof make>, n: Parameters<typeof contentHash>[0]) => contentHash(n, ed.view.state.doc);

  test("equal content, equal hash, whatever the place and the id; different content, different hash", () => {
    const ed = make("scheme", "(f 1 2)\n(f 1 2)\n(f 1 3)\n  (f  1   2)");
    const [a, b, c, d] = ed.roots();
    expect(a.id).not.toBe(b.id);
    expect(a.from).not.toBe(b.from);
    expect(h(ed, a)).toBe(h(ed, b));
    expect(h(ed, a)).toBe(h(ed, d));
    expect(h(ed, a)).not.toBe(h(ed, c));
  });

  test("a change gives the node and its ancestors a new hash, and leaves the others', in place", () => {
    const ed = make("scheme", "(f (g 1) (h 2))\n(k 3)");
    const [r0, r1] = ed.roots();
    const call = r0.slots.flatMap((s) => s.nodes);
    const before = [h(ed, r0), h(ed, r1), ...call.map((n) => h(ed, n))];
    const one = call.find((n) => n.kind === "call")!.slots.flatMap((s) => s.nodes).find((n) => n.value === "1")!;
    ed.view.dispatch({ changes: { from: one.from, to: one.to, insert: "7" } });
    expect(checkLezerEditor(ed)).toEqual([]);
    const after = [h(ed, ed.roots()[0]), h(ed, ed.roots()[1])];
    expect(after[0]).not.toBe(before[0]); // the root changed
    expect(after[1]).toBe(before[1]); // another root did not
    // and a text change back gives the first hash again
    ed.view.dispatch({ changes: { from: one.from, to: one.from + 1, insert: "1" } });
    expect(h(ed, ed.roots()[0])).toBe(before[0]);
  });

  test.each(Object.keys(LANGS))("%s: after random edits every node's hash is a fresh parse's (the oracle checks it after each step)", (name) => {
    const L = LANGS[name];
    for (let seed = 1; seed <= 40; seed++) {
      const rnd = mulberry32(seed * 31 + name.length);
      const ed = make(name, L.start[seed % L.start.length]);
      const log: string[] = [];
      for (let i = 0; i < 20; i++) {
        for (const r of ed.roots()) walk(r, (n) => h(ed, n)); // fill the cache before the step, so a stale entry would show
        randomStep(ed, L, rnd, log);
        const problems = checkLezerEditor(ed);
        if (problems.length) throw new Error(`seed ${seed} step ${i}: ${problems.join("; ")}\n${log.join("\n")}`);
        const fresh = ed.language.parse(ed.view.state.doc.toString());
        const roots = ed.roots();
        expect(roots.length).toBe(fresh.length);
        const v = {};
        roots.forEach((r, k) => expect(h(ed, r)).toBe(contentHash(fresh[k], v)));
      }
    }
  });
});

describe("2. cut with nothing selected beeps (CHANGED from the old editor, which only says it)", () => {
  test.each(["scheme", "javascript", "python"])("%s: says Nothing selected, beeps, cuts nothing: text, clipboard, history and focus stay", (l) => {
    const { ed, heard } = rig(l);
    const n = lits(ed)[1];
    ed.focusNode(n);
    const before = text(ed);
    const depth = undoDepth(ed.view.state);
    const data = { v: "kept" };
    const ev = clipEvent("cut", data);
    ed.renderer.element(n).dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true); // (the browser's own cut must not run either)
    expect(heard).toEqual([["beep", "cut-nothing"]]);
    expect(ed.said[ed.said.length - 1]).toBe("Nothing selected");
    expect(data.v).toBe("kept");
    expect(text(ed)).toBe(before);
    expect(undoDepth(ed.view.state)).toBe(depth);
    expect(ed.focusedNode()).toBe(n);
    expect(checkLezerEditor(ed)).toEqual([]);
  });

  test.each(["scheme", "javascript", "python"])("%s: copy with nothing selected still takes the focused block (as the old editor does), silently; cut of a selection works", (l) => {
    const { ed, heard } = rig(l);
    const n = lits(ed)[1];
    ed.focusNode(n);
    const data = { v: "" };
    ed.renderer.element(n).dispatchEvent(clipEvent("copy", data));
    expect(data.v).toBe(text(ed).slice(n.from, n.to));
    expect(heard).toEqual([]);
    ed.renderer.setSelected(n, true);
    ed.renderer.element(n).dispatchEvent(clipEvent("cut", data));
    expect(heard).toEqual([]);
    expect(text(ed)).not.toBe(TEXT[l]);
  });
});

describe("4. paste over a selection replaces the focused block (the old editor's ReplaceNodeTarget)", () => {
  const find = (ed: LezerBlockEditor, src: string): BNode => {
    let o: BNode | undefined;
    ed.roots().forEach((r) => walk(r, (n) => { if (!o && n.kind !== "error" && text(ed).slice(n.from, n.to) === src) o = n; }));
    return o as BNode;
  };
  const pasteOn = (ed: LezerBlockEditor, n: BNode, clip: string, data = { v: clip }) => {
    ed.focusNode(n);
    ed.renderer.element(n).dispatchEvent(clipEvent("paste", data));
  };
  const select = (ed: LezerBlockEditor, ...ns: BNode[]) => ns.forEach((n) => ed.toggleSelect(n));

  test.each([
    ["scheme", "(f x y)", "x", "z", "(f z y)"],
    ["scheme", "a b", "a", "zzz", "zzz b"],
    ["scheme", "(f x y)", "y", "(g 1 2)", "(f x (g 1 2))"],
    ["javascript", "f(x, y);", "x", "z", "f(z, y);"],
    ["javascript", "a;\nb;", "a;", "zzz;", "zzz;\nb;"],
    ["python", "f(x, y)", "y", "z", "f(x, z)"],
    ["python", "g(1)\nh(2)\n", "g(1)", "z", "z\nh(2)\n"],
  ])("%s %j: select %j, paste %j gives %j; focus on the new block, selection cleared, one undo step, nothing said", (l, src, over, clip, result) => {
    const { ed, heard } = rig(l, src);
    const said = ed.said.length;
    select(ed, find(ed, over));
    const depth = undoDepth(ed.view.state);
    pasteOn(ed, find(ed, over), clip);
    expect(text(ed)).toBe(result);
    expect(undoDepth(ed.view.state)).toBe(depth + 1);
    expect(ed.selectedBlocks()).toEqual([]);
    expect(ed.said.length).toBe(said);
    expect(heard).toEqual([]);
    const f = ed.focusedNode()!;
    expect(text(ed).slice(f.from, f.to).trim()).toBe(clip.trim());
    expect(checkLezerEditor(ed)).toEqual([]);
    undo(ed.view);
    expect(text(ed)).toBe(src);
    expect(checkLezerEditor(ed)).toEqual([]);
  });

  test("with several blocks selected only the FOCUSED one is replaced, and the whole selection is cleared", () => {
    const { ed } = rig("scheme", "(f x y z)");
    const [x, y] = [find(ed, "x"), find(ed, "y")];
    select(ed, x, y);
    expect(ed.selectedBlocks()).toEqual([x, y]);
    pasteOn(ed, y, "w");
    expect(text(ed)).toBe("(f x w z)");
    expect(ed.selectedBlocks()).toEqual([]);
  });

  test("a block that is not selected is not replaced: the paste goes after it, and clears the selection", () => {
    const { ed } = rig("scheme", "(f x y z)");
    select(ed, find(ed, "x"));
    pasteOn(ed, find(ed, "y"), "w");
    expect(text(ed)).toBe("(f x y w z)");
    expect(ed.selectedBlocks()).toEqual([]);
  });

  test("the focused block inside a selected one (selecting selects what is inside) is the one replaced", () => {
    const { ed } = rig("scheme", "(f (g 1) y)");
    select(ed, find(ed, "(g 1)"));
    pasteOn(ed, find(ed, "1"), "w");
    expect(text(ed)).toBe("(f (g w) y)");
  });

  test("several blocks copied together replace the block as separate elements of its list; a place for one block refuses, with the beep, and nothing changes", () => {
    const { ed, heard } = rig("scheme", "1 2 (f x y)");
    const [one, two] = [find(ed, "1"), find(ed, "2")];
    select(ed, one, two);
    const data = { v: "" };
    ed.renderer.element(one).dispatchEvent(clipEvent("copy", data));
    ed.clearSelection();
    const x = find(ed, "x");
    select(ed, x);
    pasteOn(ed, x, data.v, data);
    expect(text(ed)).toBe("1 2 (f 1 2 y)");
    // the callee takes one block
    const g = rig("scheme", "(f x)\n1 2");
    const f = find(g.ed, "f");
    const d2 = { v: "" };
    select(g.ed, find(g.ed, "1"), find(g.ed, "2"));
    g.ed.renderer.element(find(g.ed, "1")).dispatchEvent(clipEvent("copy", d2));
    g.ed.clearSelection();
    select(g.ed, f);
    pasteOn(g.ed, f, d2.v, d2);
    expect(text(g.ed)).toBe("(f x)\n1 2");
    expect(g.heard).toEqual([["beep", "paste-refused"]]);
    expect(g.ed.said[g.ed.said.length - 1]).toBe("Cannot paste over this node.");
    expect(heard).toEqual([]);
  });

  test("the comment that goes with the block is replaced with it; an empty clipboard does nothing", () => {
    const { ed } = rig("scheme", "; about a\na\nb");
    const a = find(ed, "a");
    select(ed, a);
    pasteOn(ed, a, "zzz");
    expect(text(ed)).toBe("zzz\nb");
    const e2 = rig("scheme", "a b").ed;
    select(e2, find(e2, "a"));
    pasteOn(e2, find(e2, "a"), "  ");
    expect(text(e2)).toBe("a b");
  });
});

describe("5. the Scheme define has the old editor's shapes: name / params / body, and name / value", () => {
  const find = (ed: LezerBlockEditor, pred: (n: BNode) => boolean): BNode => {
    let o: BNode | undefined;
    ed.roots().forEach((r) => walk(r, (n) => { if (!o && pred(n)) o = n; }));
    return o as BNode;
  };
  const slot = (n: BNode, name: string) => n.slots.find((s) => s.name === name)!;
  const ok = (ed: LezerBlockEditor) => expect(checkLezerEditor(ed)).toEqual([]);

  test("the tree: a function definition has name, params (a list block of the identifiers) and body; a value definition has name and value", () => {
    const ed = make("scheme", "(define (f a b) (g a))\n(define (h) 1)\n(define x 5)\n(define [k z] 2)");
    const [fd, hd, vd, kd] = ed.roots();
    expect(fd.slots.map((s) => s.name)).toEqual(["name", "params", "body"]);
    const params = slot(fd, "params").nodes[0];
    expect(params.kind).toBe("params");
    expect(slot(params, "items").nodes.map((n) => n.value)).toEqual(["a", "b"]);
    expect(slot(fd, "name").nodes[0].value).toBe("f");
    expect(slot(hd, "params").nodes[0].slots[0].nodes).toEqual([]); // `(define (f) body)`: an empty list, not a missing one
    expect(vd.slots.map((s) => s.name)).toEqual(["name", "value"]);
    expect(kd.slots.map((s) => s.name)).toEqual(["name", "params", "body"]);
    expect(kd.brackets).toBe("()");
    ok(ed);
  });

  test("the wrong shapes are calls to `define` (the old parser refuses them)", () => {
    const ed = make("scheme", "(define)\n(define x)\n(define x 1 2)\n(define (f 1) x)\n(define () 1)\n(define 5 6)\n(define ((f a) b) c)");
    expect(ed.roots().map((r) => r.kind)).toEqual(Array(7).fill("call"));
    ok(ed);
  });

  test("spoken labels are the old editor's words", () => {
    const ed = make("scheme", "(define (area w h) (* w h))\n(define x 5)\n(define (g) 1)\n(define (one n) n)");
    const [a, v, g, o] = ed.roots();
    expect(ed.language.describe(a)).toBe("area: function definition with 2 arguments: w and h");
    expect(ed.language.describe(slot(a, "params").nodes[0])).toBe("2 arguments: w and h");
    expect(ed.language.describe(v)).toBe("x: value definition");
    expect(ed.language.describe(g)).toBe("g: function definition with 0 arguments");
    expect(ed.language.describe(o)).toBe("one: function definition with 1 argument: n");
    expect(ed.renderer.element(a).getAttribute("aria-label")).toBe("area: function definition with 2 arguments: w and h");
  });

  test("search types: value definition, function definition and arguments are block types", () => {
    const ed = make("scheme", "(define (f a) a)\n(define x 5)");
    const types = new Set<string>();
    ed.roots().forEach((r) => walk(r, (n) => types.add(ed.options.table.nodes[keyOfNode(n) ?? ""]?.label ?? n.kind)));
    expect([...types].sort()).toEqual(["arguments", "function definition", "symbol", "number", "value definition"].sort());
  });

  test("edits keep the tree and the text in step (and equal to a fresh parse): insert into an empty and a non-empty params, remove all, delete the list, the name, the body", () => {
    const ed = make("scheme", "(define (f) body)");
    const items = () => slot(find(ed, (n) => n.kind === "params"), "items");
    ed.insertText(items(), 0, "x");
    expect(text(ed)).toBe("(define (f x) body)");
    ok(ed);
    ed.insertText(items(), 1, "z");
    expect(text(ed)).toBe("(define (f x z) body)");
    ed.insertText(items(), 0, "w");
    expect(text(ed)).toBe("(define (f w x z) body)");
    ok(ed);
    ed.removeNodes([...items().nodes]);
    expect(text(ed)).toBe("(define (f) body)");
    ok(ed);
    expect(items().nodes).toEqual([]);
    ed.insertText(items(), 0, "q");
    expect(text(ed)).toBe("(define (f q) body)");
    ok(ed);
    // the list itself: a hole in its place
    ed.removeNode(find(ed, (n) => n.kind === "params"));
    expect(text(ed)).toBe("(define (f ...) body)");
    ok(ed);
    ed.removeNode(slot(ed.roots()[0], "name").nodes[0]);
    expect(text(ed)).toBe("(define (... ...) body)");
    ok(ed);
    ed.removeNode(slot(ed.roots()[0], "body").nodes[0]);
    expect(text(ed)).toBe("(define (... ...) ...)");
    ok(ed);
    undo(ed.view);
    undo(ed.view);
    expect(text(ed)).toBe("(define (f ...) body)");
    ok(ed);
  });

  test("a function template: a define with a hole for the name, one for a parameter and one for the body", () => {
    const ed = make("scheme", "(f 1)");
    ed.insertTemplate("function", ed.roots()[0]);
    // (the first hole is open for typing: cancel it to compare the page with a fresh drawing)
    (ed.view.dom.querySelector("input.blocks-edit") as HTMLInputElement).dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    ok(ed);
    const d = find(ed, (n) => n.kind === "define");
    expect(text(ed).slice(d.from, d.to)).toBe("(define (... ...) ...)");
    expect(slot(slot(d, "params").nodes[0], "items").nodes).toHaveLength(1);
  });
});
