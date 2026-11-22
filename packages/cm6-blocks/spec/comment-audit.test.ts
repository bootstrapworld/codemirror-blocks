/** @jest-environment jsdom */
// Twenty-first round: comment blocks audited against the old editor (doc/experiments/cm6-direct-tree.md has the table).
// Each test asserts what THIS editor does; the title says what the old editor (CodeMirror 5 + React) did, with its letter in the table.
import { redo, undo } from "@codemirror/commands";
import { checkLezerEditor, LezerBlockEditor } from "../src/lezer-view";
import { make } from "./helpers";
import type { BNode } from "../src/types";

type Cfg = {
  call: string;
  call2: string;
  forms: string[];
  nested: string;
  inner: string;
};
const CFG: Record<string, Cfg> = {
  scheme: {
    call: "(f 1)",
    call2: "(g y)",
    forms: ["; apart", "#| apart |#"],
    nested: "(f 1\n\n ; apart\n\n 2\n)\n",
    inner: "2",
  },
  javascript: {
    call: "f(1);",
    call2: "g(y);",
    forms: ["// apart", "/* apart */"],
    nested: "function f() {\n  // apart\n\n  return 1;\n}\n",
    inner: "return 1;",
  },
  python: {
    call: "f(1)",
    call2: "g(y)",
    forms: ["# apart"],
    nested: "def f():\n    # apart\n\n    return 1\n",
    inner: "return 1",
  },
};
const LANGS = Object.keys(CFG);
const key = (el: Element, k: string, m: KeyboardEventInit = {}) =>
  el.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: k,
      bubbles: true,
      cancelable: true,
      ...m,
    })
  );
const clip = (el: Element, type: "copy" | "cut") => {
  const e = new Event(type, { bubbles: true, cancelable: true }) as Event & {
    clipboardData: unknown;
  };
  let out = "";
  e.clipboardData = {
    getData: () => "",
    setData: (_: string, v: string) => (out = v),
  };
  el.dispatchEvent(e);
  return out;
};
const D = (ed: LezerBlockEditor) => ed.view.state.doc.toString();
const T = (ed: LezerBlockEditor, n: BNode | null) =>
  n ? ed.view.state.doc.sliceString(n.from, n.to) : null;
const boxOf = (ed: LezerBlockEditor) =>
  ed.view.dom.querySelector("input.blocks-edit") as HTMLInputElement | null;
const ok = (ed: LezerBlockEditor) => expect(checkLezerEditor(ed)).toEqual([]);

/** an editor on `call`, a blank line, the comment `form`, a blank line, `call2` */
function rig(l: string, form = CFG[l].forms[0], src?: string) {
  const { call, call2 } = CFG[l];
  const ed = make(l, src ?? `${call}\n\n${form}\n\n${call2}\n`);
  const c = ed.roots().find((r) => r.kind === "comment")!;
  const el = (n: BNode) => ed.renderer.element(n);
  const press = (k: string, m: KeyboardEventInit = {}) =>
    key(el(ed.focusedNode()!), k, m);
  const focus = (n: BNode) => ed.focusNode(n);
  const calls = () => ed.roots().filter((r) => r.kind !== "comment");
  return { ed, c, el, press, focus, calls, call, call2, form };
}
const flat = (ed: LezerBlockEditor) => {
  const out: BNode[] = [];
  const w = (n: BNode) => {
    out.push(n);
    n.slots.forEach((s) => s.nodes.forEach(w));
  };
  ed.roots().forEach(w);
  return out;
};

describe.each(LANGS)("comment blocks, orphan: %s", (l) => {
  test("(a) old: Down / Up go to the next / previous node in document order; here the same", () => {
    const { ed, c, focus, press } = rig(l);
    focus(c);
    press("ArrowDown");
    expect(T(ed, ed.focusedNode())).toBe(CFG[l].call2);
    focus(c);
    press("ArrowUp");
    // (the last block of the call above, as the old getNodeBefore does)
    expect(ed.focusedNode()!.to).toBeLessThanOrEqual(c.from);
    expect(ed.focusedNode()!.from).toBeGreaterThan(0);
  });
  test("(a) old: Home / End go to the first / last block; here the same", () => {
    const { ed, c, focus, press } = rig(l);
    focus(c);
    press("Home");
    expect(ed.focusedNode()).toBe(ed.roots()[0]);
    focus(c);
    press("End");
    expect(ed.focusedNode()!.from).toBeGreaterThan(c.to);
  });
  test("(a)(m) old: Left collapses the comment (aria-expanded=false), Right on a collapsed one expands; here the same (reversed in the twenty-second round)", () => {
    const { ed, c, el, focus, press } = rig(l);
    focus(c);
    expect(el(c).getAttribute("aria-expanded")).toBe("true");
    press("ArrowLeft");
    expect(el(c).getAttribute("aria-expanded")).toBe("false");
    press("ArrowRight");
    expect(ed.focusedNode()).toBe(c);
    expect(el(c).getAttribute("aria-expanded")).toBe("true");
  });
  test("(a) old: backslash beeps at the top level (no ancestors); here it reads the top-level summary", () => {
    const { ed, c, focus, press } = rig(l);
    focus(c);
    press("\\");
    expect(ed.said[ed.said.length - 1]).toMatch(/^At the top level/);
  });
  test("(a) old: Shift-backslash reads the node's description; here it says there are no children", () => {
    const { ed, c, focus, press } = rig(l);
    focus(c);
    press("\\", { shiftKey: true });
    expect(ed.said[ed.said.length - 1]).toBe("no children");
  });
  test("(a)(l) old: a focused comment is read as `comment: <text>` (no marks); here `<marked text>, a comment`", () => {
    const { c, el } = rig(l);
    expect(el(c).getAttribute("aria-label")).toBe(
      "" + `${CFG[l].forms[0]}, a comment`
    );
    expect(el(c).getAttribute("role")).toBe("treeitem");
    expect(el(c).getAttribute("aria-posinset")).toBe("2");
    expect(el(c).getAttribute("aria-setsize")).toBe("3");
  });
  test("(l) old: the summary counts comments (`1 comment`); here the same", () => {
    const { ed } = rig(l);
    expect(ed.said[0]).toMatch(/and 1 comment\.$/);
  });

  test("(b) old: Space selects the comment, Delete removes only what is selected; here the same", () => {
    const { ed, c, el, focus, press } = rig(l);
    focus(c);
    press("Delete");
    expect(D(ed)).toContain("apart"); // nothing selected: nothing deleted
    press(" ");
    expect(el(c).getAttribute("aria-selected")).toBe("true");
    expect(ed.selection().length).toBe(1);
    press("Delete");
    expect(D(ed)).not.toContain("apart");
    expect(ed.roots().some((r) => r.kind === "comment")).toBe(false);
    ok(ed);
  });
  test("(b)(e) old: copy with nothing selected copies the focused node; cut takes only the selected; here the same (cut with none beeps and says `Nothing selected`)", () => {
    const { ed, c, el, focus, press, form } = rig(l);
    focus(c);
    expect(clip(el(c), "copy")).toBe(form);
    expect(D(ed)).toContain(form);
    expect(clip(el(c), "cut")).toBe("");
    expect(ed.said[ed.said.length - 1]).toBe("Nothing selected");
    expect(D(ed)).toContain(form);
    press(" ");
    expect(clip(el(c), "cut")).toBe(form);
    expect(D(ed)).not.toContain("apart");
  });

  test.each(CFG[l].forms)(
    "(c) old: Enter edits the whole text, marks included (%s); here the same, and a new text is written as typed",
    (form) => {
      const { ed, c, focus, press } = rig(l, form);
      focus(c);
      press("Enter");
      const b = boxOf(ed)!;
      expect(b.value).toBe(form);
      b.value = form.replace("apart", "elsewhere");
      key(b, "Enter");
      expect(D(ed)).toContain("elsewhere");
      expect(D(ed)).not.toContain("apart");
      expect(T(ed, ed.focusedNode())).toBe(form.replace("apart", "elsewhere"));
      ok(ed);
    }
  );
  test("(c) old: an empty commit, and Escape, change nothing; blur commits the new text; here the same", () => {
    const { ed, c, focus, press, form } = rig(l);
    const before = D(ed);
    focus(c);
    press("Enter");
    let b = boxOf(ed)!;
    b.value = "";
    key(b, "Enter");
    expect(D(ed)).toBe(before);
    expect(boxOf(ed)).toBeNull();
    press("Enter");
    b = boxOf(ed)!;
    b.value = "nothing to keep";
    key(b, "Escape");
    expect(D(ed)).toBe(before);
    expect(ed.focusedNode()).toBe(ed.roots().find((r) => r.kind === "comment"));
    press("Enter");
    b = boxOf(ed)!;
    b.value = form.replace("apart", "blurred");
    b.dispatchEvent(new FocusEvent("blur"));
    expect(D(ed)).toContain("blurred");
    ok(ed);
  });
  test("(c)(h) old: undo and redo of an edit restore and redo the text; here the same, saying UNDID / REDID", () => {
    const { ed, c, focus, press, form } = rig(l);
    const before = D(ed);
    focus(c);
    press("Enter");
    const b = boxOf(ed)!;
    b.value = form.replace("apart", "again");
    key(b, "Enter");
    const after = D(ed);
    expect(undo(ed.view)).toBe(true);
    expect(D(ed)).toBe(before);
    expect(ed.said[ed.said.length - 1]).toMatch(/^UNDID: /);
    expect(redo(ed.view)).toBe(true);
    expect(D(ed)).toBe(after);
    expect(ed.said[ed.said.length - 1]).toMatch(/^REDID: /);
  });

  test("(d)(h) old: Delete removes the comment (the line stays blank); focus goes to the next block; undo restores it and its focus; here the same", () => {
    const { ed, c, focus, press, call2 } = rig(l);
    focus(c);
    press(" ");
    press("Delete");
    expect(ed.roots().map((r) => r.kind)).not.toContain("comment");
    expect(T(ed, ed.focusedNode())).toBe(call2);
    undo(ed.view);
    expect(D(ed)).toContain("apart");
    expect(ed.roots().map((r) => r.kind)).toContain("comment");
    expect(ed.focusedNode()!.kind).toBe("comment");
    ok(ed);
  });

  test("(e) old: paste after / before a comment inserts a sibling beside it and focuses it; here the same", () => {
    const { ed, c } = rig(l);
    const n = ed.pasteText(c, CFG[l].call);
    expect(T(ed, n)).toBe(CFG[l].call);
    expect(n!.from).toBeGreaterThan(c.to);
    expect(ed.roots().filter((r) => r.kind === "comment").length).toBe(1);
    const ed2 = rig(l).ed;
    const c2 = ed2.roots().find((r) => r.kind === "comment")!;
    const m = ed2.pasteText(c2, CFG[l].call, true);
    expect(m!.to).toBeLessThanOrEqual(c2.from);
    ok(ed);
    ok(ed2);
  });

  test("(f) old: the comment can be dragged (it is a node) and dropped in a gap, staying an orphan (printed with a blank line after); here the same (fixed, twenty-first round)", () => {
    const { ed, c, call } = rig(l);
    const slot = ed.doc.program.slots[0];
    ed.moveNode(c, { slot, index: 0 });
    expect(D(ed).startsWith(CFG[l].forms[0] + "\n\n" + call)).toBe(true);
    expect(
      ed.commentOf(ed.roots().find((r) => r.kind !== "comment")!)
    ).toBeNull();
    ok(ed);
  });
  test("(f) old: a node cannot be dropped ON a comment (only in gaps); here the comment is replaced by the block", () => {
    const { ed, c, calls } = rig(l);
    ed.moveNode(calls()[1], { blank: c });
    expect(D(ed)).not.toContain("apart");
    ok(ed);
  });

  test("(g) old: text search matches the comment's text and focuses it; block-type search offers `comment`; here the same", () => {
    const { ed, focus } = rig(l);
    ed.search.set({ mode: "text", searchString: "apart" });
    focus(ed.roots()[0]);
    expect(ed.search.next()).toBe(true);
    expect(ed.focusedNode()!.kind).toBe("comment");
    expect(ed.search.types()).toContain("comment");
  });

  test("(i) old: deleting the block before or after an orphan leaves it, still an orphan; here the same", () => {
    for (const which of [0, 1]) {
      const { ed, press, focus, calls } = rig(l);
      focus(calls()[which]);
      press(" ");
      press("Delete");
      expect(ed.roots().filter((r) => r.kind === "comment").length).toBe(1);
      expect(
        ed.commentOf(ed.roots().find((r) => r.kind !== "comment")!)
      ).toBeNull();
      ok(ed);
    }
  });

  test("(j) old: a comment inside a list is a node of it (focusable, Down goes on, Left goes to the parent), and Delete removes it; here the same", () => {
    const ed = make(l, CFG[l].nested);
    const c = flat(ed).find((n) => n.kind === "comment")!;
    expect(c.parent!.kind).not.toBe("program");
    ed.focusNode(c);
    key(ed.renderer.element(c), "ArrowDown");
    expect(T(ed, ed.focusedNode())).toBe(CFG[l].inner);
    ed.focusNode(c);
    key(ed.renderer.element(c), "ArrowLeft"); // (collapses it first, as any block)
    expect(ed.renderer.isCollapsed(c)).toBe(true);
    key(ed.renderer.element(c), "ArrowLeft");
    expect(ed.focusedNode()).toBe(c.parent);
    ed.collapse(c, false);
    ed.focusNode(c);
    key(ed.renderer.element(c), "\\");
    expect(ed.said[ed.said.length - 1]).toMatch(/^.*apart, a comment, inside /);
    key(ed.renderer.element(c), " ");
    key(ed.renderer.element(c), "Delete");
    expect(D(ed)).not.toContain("apart");
    ok(ed);
  });

  test("(k) old: Ctrl-] / Ctrl-[ on a comment open a box for a sibling after / before it; here the same (top level)", () => {
    for (const [k, after] of [
      ["]", true],
      ["[", false],
    ] as const) {
      const { ed, c, focus, call } = rig(l);
      focus(c);
      key(ed.renderer.element(c), k, { ctrlKey: true });
      const b = boxOf(ed)!;
      expect(b).not.toBeNull();
      b.value = CFG[l].call;
      key(b, "Enter");
      const i = D(ed).indexOf(CFG[l].forms[0]);
      const j = D(ed).lastIndexOf(call);
      // (the new call is before the comment, or between it and the call that was after it)
      expect(after ? j > i : D(ed).indexOf(call) < i).toBe(true);
      ok(ed);
    }
  });
});

const MARK: Record<string, string> = {
  scheme: ";",
  javascript: "//",
  python: "#",
};
/** `mine` directly above the first call (it goes with it), then two more calls */
function own(l: string) {
  const { call, call2 } = CFG[l];
  const src = `${MARK[l]} mine\n${call}\n\n${call2}\n${call}\n`;
  const ed = make(l, src);
  const f = ed.roots().find((r) => r.kind !== "comment")!;
  const el = (n: BNode) => ed.renderer.element(n);
  const press = (k: string, m: KeyboardEventInit = {}) =>
    key(el(ed.focusedNode()!), k, m);
  return { ed, f, el, press, call, call2, src };
}

describe.each(LANGS)("comment on a node (attached): %s", (l) => {
  test("(n)(l) old: a popup beside the node while it is active, aria-hidden, and `with comment: <text>` in the node's name; here the same, and a marker, data-comment and the label too", () => {
    const { ed, f, el } = own(l);
    expect(ed.commentOf(f)!.kind).toBe("comment");
    expect(el(f).getAttribute("aria-label")).toContain("with comment: mine");
    expect(el(f).getAttribute("data-comment")).toBe("mine");
    expect(el(f).classList.contains("blocks-has-comment")).toBe(true);
    const pop = el(f).querySelector(":scope > .blocks-comment");
    expect(pop?.getAttribute("aria-hidden")).toBe("true");
    expect(pop?.textContent).toBe("mine");
  });
  test("(o) old: Shift-Ctrl-] edits it in a box on the words, an empty commit removes it; here the same", () => {
    const { ed, f, press } = own(l);
    ed.focusNode(f);
    press("}", { ctrlKey: true, shiftKey: true, code: "BracketRight" });
    const b = boxOf(ed)!;
    expect(b.value).toBe("mine");
    b.value = "";
    key(b, "Enter");
    expect(D(ed)).not.toContain("mine");
    ok(ed);
  });
  test("(p) old: copy takes the comment with the node (a line above), cut too; here the same", () => {
    const { ed, f, el, press } = own(l);
    ed.focusNode(f);
    expect(clip(el(f), "copy")).toBe(`${MARK[l]} mine\n${CFG[l].call}`);
    press(" ");
    expect(clip(el(f), "cut")).toBe(`${MARK[l]} mine\n${CFG[l].call}`);
    expect(D(ed)).not.toContain("mine");
  });
  test("(q)(i) old: deleting the node leaves its comment behind, as an orphan; here the same", () => {
    const { ed, f, press } = own(l);
    ed.focusNode(f);
    press(" ");
    press("Delete");
    expect(D(ed)).toContain("mine");
    const c = ed.roots().find((r) => r.kind === "comment")!;
    expect(c).toBeDefined();
    expect(
      ed.commentOf(ed.roots().find((r) => r.kind !== "comment")!)
    ).toBeNull();
    ok(ed);
  });
  test("(p)(i) old: moving the node takes its comment along; here the same (fixed, twenty-first round)", () => {
    const { ed, f } = own(l);
    ed.moveNode(f, { slot: ed.doc.program.slots[0], index: 4 });
    expect(D(ed)).not.toContain("mine\n\n");
    expect(D(ed).trimEnd().endsWith(`${MARK[l]} mine\n${CFG[l].call}`)).toBe(
      true
    );
    expect(ed.focusedNode()!.kind).not.toBe("comment");
    ok(ed);
  });
  test("(i)(k) old: a node inserted before an owner (paste before, Ctrl-[) goes above the owner's comment; here the same (fixed, twenty-first round)", () => {
    const { ed, f } = own(l);
    ed.pasteText(f, CFG[l].call2, true);
    expect(
      D(ed).startsWith(`${CFG[l].call2}\n${MARK[l]} mine\n${CFG[l].call}`)
    ).toBe(true);
    ok(ed);
    const o = own(l);
    o.ed.focusNode(o.f);
    o.press("[", { ctrlKey: true });
    const b = boxOf(o.ed)!;
    b.value = CFG[l].call2;
    key(b, "Enter");
    expect(
      D(o.ed).startsWith(`${CFG[l].call2}\n${MARK[l]} mine\n${CFG[l].call}`)
    ).toBe(true);
    ok(o.ed);
  });
});

describe("a comment block in Scheme, other facts", () => {
  test("(c) old: a new comment text without marks is written as typed; here the same (Scheme: becomes code)", () => {
    const { ed, c, focus, press } = rig("scheme");
    focus(c);
    press("Enter");
    const b = boxOf(ed)!;
    b.value = "plain words";
    key(b, "Enter");
    expect(D(ed)).toContain("\n\nplain words\n\n");
    expect(ed.roots().some((r) => r.kind === "comment")).toBe(false);
  });
});
