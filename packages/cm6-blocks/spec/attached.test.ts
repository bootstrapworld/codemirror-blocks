/** @jest-environment jsdom */
/* Sixth round, step 4: a comment directly above a block (or after it on its line) goes with that block; Shift-Ctrl-] edits it. */
import { checkLezerEditor, LezerBlockEditor } from "../src/lezer-view";
import { make } from "./helpers";
import type { BNode } from "../src/types";

const LANGS = ["scheme", "javascript", "python"];
const TEXTS: Record<string, string> = {
  scheme: "; first\n(f 1)\n\n(g 2)\n(h 3) ; trailing\n(k 4)\n",
  javascript: "// first\nf(1);\n\ng(2);\nh(3); // trailing\nk(4);\n",
  python: "# first\nf(1)\n\ng(2)\nh(3)  # trailing\nk(4)\n",
};
const PRE: Record<string, string> = {
  scheme: ";",
  javascript: "//",
  python: "#",
};
const text = (ed: LezerBlockEditor) => ed.view.state.doc.toString();
const ok = (ed: LezerBlockEditor) => expect(checkLezerEditor(ed)).toEqual([]);
const root = (ed: LezerBlockEditor, name: string): BNode =>
  ed
    .roots()
    .find(
      (r) =>
        r.kind !== "comment" &&
        new RegExp(`^[(]?${name}[( ]`).test(text(ed).slice(r.from, r.to))
    )!;
const key = (el: Element, k: string, mods: Partial<KeyboardEventInit> = {}) =>
  el.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: k,
      bubbles: true,
      cancelable: true,
      ...mods,
    })
  );
const editKey = (ed: LezerBlockEditor, n: BNode) => {
  ed.focusNode(n);
  key(ed.renderer.element(n), "]", {
    ctrlKey: true,
    shiftKey: true,
    code: "BracketRight",
  });
  return ed.view.dom.querySelector(
    "input.blocks-edit"
  ) as HTMLInputElement | null;
};
const commit = (input: HTMLInputElement, v: string) => {
  input.value = v;
  key(input, "Enter");
};

describe.each(LANGS)("comments that go with a block: %s", (l) => {
  test("a comment directly above, or after it on its line, is drawn with the block and said in its label", () => {
    const ed = make(l, TEXTS[l]);
    const f = ed.renderer.element(root(ed, "f"));
    expect(f.classList.contains("blocks-has-comment")).toBe(true);
    expect(f.getAttribute("data-comment")).toBe("first");
    expect(f.getAttribute("aria-label")).toContain("with comment: first");
    const h = ed.renderer.element(root(ed, "h"));
    expect(h.getAttribute("aria-label")).toContain("with comment: trailing");
    // a blank line between, or no comment: not attached; the trailing comment is not also the one above k
    for (const n of ["g", "k"]) {
      const el = ed.renderer.element(root(ed, n));
      expect(el.classList.contains("blocks-has-comment")).toBe(false);
      expect(el.getAttribute("aria-label")).not.toContain("with comment");
    }
    // the comments are still blocks of their own
    expect(ed.roots().filter((r) => r.kind === "comment").length).toBe(2);
    ok(ed);
  });
  test("Shift-Ctrl-] on a block without a comment writes one above it, in the language's syntax; undo takes it away", () => {
    const ed = make(l, TEXTS[l]);
    const g = root(ed, "g");
    const input = editKey(ed, g)!;
    expect(input.value).toBe("");
    commit(input, "about g");
    expect(text(ed)).toContain(`${PRE[l]} about g\n`);
    const g2 = root(ed, "g");
    expect(ed.renderer.element(g2).getAttribute("aria-label")).toContain(
      "with comment: about g"
    );
    expect(ed.focusedNode()).toBe(g2);
    ok(ed);
    key(ed.renderer.element(g2), "z", { ctrlKey: true });
    expect(text(ed)).toBe(TEXTS[l]);
    expect(
      ed.renderer
        .element(root(ed, "g"))
        .classList.contains("blocks-has-comment")
    ).toBe(false);
    ok(ed);
  });
  test("with a comment, the box holds its words; new words replace them; deleting all the text removes the comment", () => {
    const ed = make(l, TEXTS[l]);
    let input = editKey(ed, root(ed, "f"))!;
    expect(input.value).toBe("first");
    commit(input, "second");
    expect(text(ed).split("\n")[0]).toBe(`${PRE[l]} second`);
    expect(
      ed.renderer.element(root(ed, "f")).getAttribute("data-comment")
    ).toBe("second");
    ok(ed);
    input = editKey(ed, root(ed, "f"))!;
    commit(input, "");
    expect(text(ed)).not.toContain("second");
    expect(ed.roots().filter((r) => r.kind === "comment").length).toBe(1);
    expect(
      ed.renderer
        .element(root(ed, "f"))
        .classList.contains("blocks-has-comment")
    ).toBe(false);
    ok(ed);
    // the trailing comment too
    input = editKey(ed, root(ed, "h"))!;
    expect(input.value).toBe("trailing");
    commit(input, "");
    expect(text(ed)).not.toContain("trailing");
    ok(ed);
  });
  // edited (twentieth round): the shortcut on a comment block opens the box on that comment (spec/comment-edit.test.ts); Escape closes it
  test("Escape cancels; the shortcut on a comment block opens its box", () => {
    const ed = make(l, TEXTS[l]);
    const input = editKey(ed, root(ed, "g"))!;
    input.value = "zzz";
    key(input, "Escape");
    expect(text(ed)).toBe(TEXTS[l]);
    ed.focusNode(ed.roots()[0]);
    key(ed.renderer.element(ed.roots()[0]), "]", {
      ctrlKey: true,
      shiftKey: true,
      code: "BracketRight",
    });
    const box = ed.view.dom.querySelector("input.blocks-edit")!;
    expect(box).not.toBeNull();
    key(box, "Escape");
    expect(text(ed)).toBe(TEXTS[l]);
    ok(ed);
  });
  test("a comment inside a block goes with the block under it; the box on an inner expression comments the outermost block that starts there", () => {
    const INNER: Record<string, string> = {
      scheme: "(f x\n  ; inside\n  (g x))\n",
      javascript: "function f(x) {\n  // inside\n  return g(x);\n}\n",
      python: "def f(x):\n    # inside\n    return g(x)\n",
    };
    const ed = make(l, INNER[l]);
    const all: BNode[] = [];
    const walk = (n: BNode) => {
      all.push(n);
      n.slots.forEach((s) => s.nodes.forEach(walk));
    };
    ed.roots().forEach(walk);
    const withC = all.filter(
      (n) =>
        ed.renderer.has(n) &&
        ed.renderer.element(n).classList.contains("blocks-has-comment")
    );
    expect(withC.length).toBe(1);
    expect(ed.renderer.element(withC[0]).getAttribute("data-comment")).toBe(
      "inside"
    );
    // a new comment on the inner call `g(x)`: it goes above the statement that holds it
    const gcall = all.find(
      (n) =>
        n.kind === "call" && /^[(]?g[( ]/.test(text(ed).slice(n.from, n.to))
    )!;
    const host = ed.commentHost(gcall);
    expect(host.from).toBeLessThanOrEqual(gcall.from);
    ok(ed);
  });
});
