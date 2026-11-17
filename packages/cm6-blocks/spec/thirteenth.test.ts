/** @jest-environment jsdom */
// Thirteenth round: difference 11 (content hash), cut with nothing selected, finding 13, paste over a selection, the define shape
import { undo } from "@codemirror/commands";
import { contentHash } from "../src/hash";
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
